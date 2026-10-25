import { describe, it, expect } from "vitest";
import { decideOutcome, sameScreen } from "../../tests/wiki-screenshots/signature";
import type { PageSignature } from "../../tests/wiki-screenshots/types";

const sig = (over: Partial<PageSignature> = {}): PageSignature => ({
  heading: "Purchase Request",
  actions: ["Add", "Export"],
  columns: ["Code", "Date", "Status"],
  hasRows: true,
  ...over,
});

describe("sameScreen", () => {
  it("treats identical signatures as the same screen", () => {
    expect(sameScreen(sig(), sig())).toBe(true);
  });

  it("treats a different heading as a different screen", () => {
    expect(sameScreen(sig(), sig({ heading: "My Approvals" }))).toBe(false);
  });

  it("treats different page actions as a different screen", () => {
    expect(sameScreen(sig(), sig({ actions: ["Approve", "Reject"] }))).toBe(false);
  });

  it("treats different table columns as a different screen", () => {
    expect(sameScreen(sig(), sig({ columns: ["Code", "Date"] }))).toBe(false);
  });

  it("ignores hasRows — it reflects data scope, not UI shape", () => {
    expect(sameScreen(sig({ hasRows: true }), sig({ hasRows: false }))).toBe(true);
  });

  it("ignores list ordering when the members match", () => {
    const a = sig({ actions: ["Export", "Add"], columns: ["Status", "Code", "Date"] });
    expect(sameScreen(a, sig())).toBe(true);
  });

  it("treats a missing action as a different screen even when the rest matches", () => {
    expect(sameScreen(sig(), sig({ actions: ["Add"] }))).toBe(false);
  });
});

/**
 * Fixtures mirror the real app's DOM (../carmen-frontend):
 * - AccessDeniedBlock  — components/route-guard.tsx (h2 "Permission Denied")
 * - ErrorState         — components/ui/error-state.tsx (no heading; <p> text)
 * - ProfileError       — components/share/profile-gate.tsx (h2)
 * - widget notices     — routes/dashboard/dashboard-component.tsx,
 *                        routes/config/config-dashboard.tsx (page keeps its h1)
 */
describe("decideOutcome", () => {
  it("returns ok for an ordinary page", () => {
    expect(decideOutcome(["Purchase Request"], [])).toEqual({ outcome: "ok" });
  });

  it("returns ok for a page with no heading and no alert", () => {
    expect(decideOutcome([], [])).toEqual({ outcome: "ok" });
  });

  it("reads a denial off the AccessDeniedBlock heading", () => {
    const r = decideOutcome(["Permission Denied"], [
      "Restricted Permission Denied You don't have permission to view this page. Go Back",
    ]);
    expect(r.outcome).toBe("denied");
    expect(r.reason).toBe("Permission Denied");
  });

  it("still sees a denial when a page-title strip renders above the guard", () => {
    // The old sibling-count heuristic flipped this case to "ok", which made
    // capture write a Permission Denied card to the canonical wiki path.
    expect(decideOutcome(["Extra Cost", "Permission Denied"], []).outcome).toBe("denied");
  });

  it("classifies a page-level ErrorState 404 from its alert text", () => {
    const r = decideOutcome([], [
      "Something went wrong\nDepartment not found\nBack to list\nGo to dashboard",
    ]);
    expect(r.outcome).toBe("not-found");
  });

  it("classifies a page-level ErrorState 5xx as an error", () => {
    const r = decideOutcome([], [
      "Something went wrong\nSomething went wrong on our end. Please try again.",
    ]);
    expect(r.outcome).toBe("error");
  });

  it("ignores a widget-level notice because the page kept its own heading", () => {
    // The exact /dashboard regression: this notice made the route classify
    // unreachable for all nine roles.
    const r = decideOutcome(
      ["Good morning, Somchai", "Saved widgets"],
      ["Failed to load saved widgets: business unit not found"],
    );
    expect(r).toEqual({ outcome: "ok" });
  });

  it("ignores a config-dashboard load-error notice for the same reason", () => {
    const r = decideOutcome(["Configuration"], ["Could not load widgets: 403 forbidden"]);
    expect(r).toEqual({ outcome: "ok" });
  });

  it("prefers denied over not-found when a page reads as both", () => {
    expect(decideOutcome(["Permission Denied"], ["Vendor not found"]).outcome).toBe("denied");
  });

  it("recognises the standalone 404 page by its heading", () => {
    expect(decideOutcome(["We can't find that page"], []).outcome).toBe("not-found");
  });

  it("recognises the profile-gate failure heading", () => {
    expect(decideOutcome(["Couldn't load your profile"], []).outcome).toBe("error");
  });

  it("does not read a status code out of a document number", () => {
    expect(decideOutcome(["PO-2024045"], []).outcome).toBe("ok");
    expect(decideOutcome(["REQ-40412"], []).outcome).toBe("ok");
  });

  it("collapses whitespace in the reason it reports", () => {
    expect(decideOutcome(["  Permission   Denied \n"], []).reason).toBe("Permission Denied");
  });

  it("ignores blank headings when deciding whether to consult alert text", () => {
    // An empty <h1> must not gate off the secondary signal.
    expect(decideOutcome(["", "   "], ["Vendor not found"]).outcome).toBe("not-found");
  });
});
