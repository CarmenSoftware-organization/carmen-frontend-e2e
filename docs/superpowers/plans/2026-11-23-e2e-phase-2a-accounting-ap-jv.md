# E2E Phase 2a — Accounting AP + JV Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cover the AP + JV money path (AP invoice / deposit / debit note / credit note, GRN→AP auto, payment with WHT, payment approvals, manual JV, JV templates) with e2e specs that assert money outcomes through the API, before Accounting goes live.

**Architecture:** `data:reset` gains an accounting base on TEST BU (COA with types, `gl_setting`, GL period, bank, tax profiles, vendor AP account, AP-payment + JV workflows, two accounting roles) and a stable read set. Specs read the read set for list/detail/number checks and create fresh documents through new API helpers for state changes, so they re-run without a reset. Expected amounts come from `tests/helpers/money.ts`, an oracle written from the FE accounting design docs, never from FE code.

**Tech Stack:** Playwright (workers 1), TypeScript, Bun, vitest (`unit/**`), dev backend via `:4000` → shared dev DB.

**Spec:** `docs/superpowers/specs/2026-11-23-e2e-phase-2a-accounting-ap-jv-design.md` (read it, especially "Facts found in code" and "User decisions").

## Global Constraints

- New `tests/8xx-*.spec.ts` files and new `unit/**/*.test.ts` files are the deliverable of this plan (user approved the design whose goal is new specs, 2026-11-23). Create only the files this plan names.
- Irreversible actions (posting, void, reverse) **only on TEST BU `GR2VYNKQ`**. Never on CARMEN-AVG / CARMEN-FIFO. Never set `E2E_ALLOW_IRREVERSIBLE`.
- Oracle = `../carmen-frontend/docs/accounting/specs/accounts-payable-invoice-design.md`, `accounts-payable-payment-design.md`, `general-ledger-journal-voucher-design.md`, and `../carmen-frontend/docs/accounting/ap-payment-save-rules.md`. Where they are silent: VAT 7% on the pre-VAT base, WHT on the pre-VAT base, round half-up to the BU's decimals. Each such case writes "assumption:" in its `expected` annotation.
- Failure policy (Phase 1, policy ข): an intentional change → update it and cite the FE/BE commit · a suspected bug → `test.fail(true, "suspected bug: …")` placed **after setup**, plus a row in `docs/superpowers/specs/2026-11-23-e2e-phase-2a-bug-list.md` · BE merged but not deployed → `test.fail(true, "BE not deployed on dev: <PR>")` · racy bug → pin it deterministically by holding the response with `page.route`.
- No visibility-based skips, no new `fixme`, no `waitForTimeout`, no `.catch(() => null)`. Outcome waits use `expectBlocked` / `expectRefused` / `expectSaved` from `tests/helpers/settle.ts`.
- A BU setting a spec changes (`gl_setting.ap_auto_from_grn`) is restored in `finally`.
- Every case carries all 5 annotations. The CLAUDE.md pre/exp audit prints nothing. `bun audit:tc-ids` passes. `bun docs:user-stories` is regenerated in the same commit; revert footer-only changes in other files. `bun test:unit` is green.
- TC-ID prefixes: add a row per new spec to `docs/test-id-scheme.md` (`801` APINV, `802` APDOC, `803` APPAY, `804` APAPR, `805` APGRN, `810` JV, `811` JVT, `820` ACCT).
- `workers: 1`, `retries: 0`. Run with `bun run test -- --project=chromium <spec>`. The `data:reset --yes` command needs `NODE_EXTRA_CA_CERTS` (a CA chain built from the dev cert's AIA URLs; never commit it).
- Commits in Thai, PR text in English, merge commits only, no merge without the user. One branch per PR, stacked: PR1 = Tasks 0–3, PR2 = Tasks 4–5, PR3 = Task 6, PR4 = Tasks 7–8.
- Stage files by explicit path. Never stage `.trail/hook.cjs` or the deleted tooling files. Run `git restore tests/results` before handing off.

## Review Focus

1. **Re-run without reset:** every state-changing spec passes twice in a row with no `data:reset` between runs. 601 fails this today, so do not repeat it. Owned by Tasks 4–7: each task's verification step runs its spec twice.
2. **No open GL period / missing `gl_setting` account:** a spec must fail with a message that names the missing setup (via the Task 3 precondition `assertAccountingReady()`), not with an opaque `GL_PERIOD_NOT_OPEN` toast timeout. Owned by Task 3.
3. **Rounding edge:** a line of 3 × 333.33 (net 999.99) → VAT 70.00, WHT 3% 30.00. Inc-VAT line 1,070.00 → net 1,000.00, VAT 70.00. Owned by Tasks 3 (unit test) and 4 (posted JV amounts).
4. **Partial payments:** paying 400 of 1,000 leaves 600 open; a second payment of 600 closes it; voiding the second payment restores 600. Owned by Task 6.
5. **Subledger JV immutability:** voiding or reversing an AP-generated JV directly is refused with `GL_JV_IMMUTABLE`, and the source document stays posted. Owned by Task 7.

---

### Task 0: Preflight — environment, licenses and oracle notes

**Files:**
- Create: `docs/superpowers/specs/2026-11-23-e2e-phase-2a-preflight.md`

- [ ] **Step 1: Record the dev BE build** with the same method as Phase 0 (`docs/superpowers/specs/2026-11-20-e2e-catchup-triage.md`, which records the dev API version string), plus the FE `main` SHA.
- [ ] **Step 2: Probe gating as Admin on TEST BU:**
  - `GET /api/GR2VYNKQ/ap-invoice`, `…/ap-payment`, `…/gl-jv` (or the list endpoints the FE uses: `API_ENDPOINTS.AP_INVOICE_LIST`, `AP_PAYMENT_LIST`, `GL_JV_LIST`).
  - Record the status of each: 200, 403 license, 403 allowlist, or 404.
  - Check that the TEST BU license covers `accounting.ap`, `accounting.gl` and `accounting.gl.jv_template` (FE `/accounting/accounts-payable` does not show the locked page).
- [ ] **Step 3: Record current GL state:** whether any GL period exists, the current `gl_setting` value (GET app-config `gl_setting`), and whether bank accounts or tax profiles exist.
- [ ] **Step 4: Write the oracle notes.**
  - Extract every numeric rule from the four oracle docs, each with a doc:line citation: VAT base, WHT base and timing (invoice or payment), rounding, deposit application, debit/credit note sign, partial payment, and the save rules.
  - List the gaps where the docs are silent, and the assumption used for each.
- [ ] **Step 5: Stop condition.** If a license or allowlist blocks AP or GL on dev, **stop and report to the user**. It cannot be fixed from this repo (it needs backstage / dev deploy). Do not add skips.
- [ ] **Step 6: Commit** — `docs(e2e): preflight เฟส 2a — สถานะ dev, license, กฎตัวเลขจากเอกสารบัญชี`

### Task 1: data:reset — accounting base

**Files:**
- Create: `scripts/data-reset/accounting.ts`, `unit/data-reset/accounting.test.ts`
- Modify: `scripts/data-reset/fixtures/chart-of-accounts.json` (add name + type to every code; add the accounts below), `scripts/data-reset/index.ts` (step order and dry-run log line), `scripts/data-reset/README.md`

**Interfaces:**
- Produces: `seedAccountingBase(sessions, cfg): Promise<StepResult & { accounts: AccountingAccounts }>`, where `AccountingAccounts = { apControl, inputVat, whtPayable, advanceDeposit, expense, inventory, bank, fxGain, fxLoss: string /* COA id */ }`. It is exported for Tasks 2–3.

- [ ] **Step 1: Write failing vitest cases** in `unit/data-reset/accounting.test.ts`, using the mock backend pattern of `unit/data-reset/run.test.ts`:
  - `seeds gl_setting with every account id` asserts a PUT/PATCH to the `gl_setting` app-config containing `ap_control_account_id`, `input_vat_account_id`, `wht_payable_account_id`, `advance_deposit_account_id`, `realized_fx_gain_account_id`, `realized_fx_loss_account_id`, and `ap_auto_from_grn: false`.
  - `creates an open GL period covering today unless one exists` creates one when none exists and is skipped when one already covers today.
  - `creates a bank account mapped to the bank COA`.
  - `creates WHT 3% and VAT 7% tax profiles mapped to accounts`.
  - `sets ap_chart_of_accounts_id on every seeded vendor`.
  - `dry run writes nothing`.
- [ ] **Step 2: Run** `bun test:unit -- unit/data-reset/accounting.test.ts`. Expected: FAIL, because the module is missing.
- [ ] **Step 3: Implement `seedAccountingBase`.**
  - Find the endpoints from the BE gateway (`apps/backend-gateway/src/application/*`): app-config, gl-period, bank-account, tax-profile, vendor.
  - Idempotent: skip what exists.
  - Run after the `coa` step and before `workflows` in `runDataReset`.
  - Stop the run on failure, like the `bu-currency` step.
- [ ] **Step 4: Run** `bun test:unit`. Expected: all pass, including `run.test.ts`. Update its step-order list if the new writes come before `workflows`, but never repeat a path prefix (`firstWrite` finds only the first).
- [ ] **Step 5: Live check.** Run `bun run data:reset --yes`. The summary table shows an `accounting` row with 0 failed. Re-run Task 0 Steps 2–3 and record the after-state in the preflight doc.
- [ ] **Step 6: Commit** — `feat(data-reset): ฐานบัญชีบน TEST BU — ผังบัญชีมีชนิด, gl_setting, งวด GL, ธนาคาร, tax profile, บัญชีเจ้าหนี้ของ vendor`

### Task 2: data:reset — accounting workflows, roles, read set

**Files:**
- Modify: `scripts/data-reset/fixtures/workflows.json` (add `ap_payment` and `journal_voucher` workflows), `scripts/data-reset/access.ts` (accounting roles), `scripts/data-reset/verify-dataset.ts` (counts)
- Create: `scripts/data-reset/docs/accounting.ts`, `unit/data-reset/accounting-docs.test.ts`

**Interfaces:**
- Consumes: `AccountingAccounts` (Task 1).
- Produces:
  - Roles: **Budget** = accounting approver (AP invoice / payment approve, JV approve, `accounting.ap.void`, `accounting.gl.void`). **Requestor** = accounting viewer (view only, no approve or void).
  - Read set, identified by `vendor_invoice_no` prefix `E2E-AP-` and JV description prefix `E2E-JV-`:

| Key | Document | Lines | State |
|---|---|---|---|
| `E2E-AP-POSTED` | invoice | 3 × 333.33, VAT 7% | posted |
| `E2E-AP-INCVAT` | invoice | 1 × 1,070.00 Inc-VAT | posted |
| `E2E-AP-PARTIAL` | invoice | 1 × 1,000.00, VAT 7% | posted, paid 400.00 + WHT on that payment |
| `E2E-AP-PAID` | invoice | 1 × 500.00, VAT 7% | posted, fully paid |
| `E2E-AP-DRAFT` | invoice | 1 × 100.00 | draft |
| `E2E-AP-DEPOSIT` | deposit | 1 × 2,000.00 | posted |
| `E2E-AP-DN` | debit_note | 1 × 150.00 | posted |
| `E2E-AP-CN` | credit_note | 1 × 120.00 | posted |
| `E2E-JV-POSTED` | manual JV | Dr expense 250.00 / Cr bank 250.00 | posted |
| `E2E-JVT-1` | JV template | the same two lines | active |

- [ ] **Step 1: Write failing vitest cases:**
  - `creates every read-set document once` (10 creates, all idempotent by key).
  - `posts through submit/approve with the approver role`.
  - `adds AP payment and JV workflows with Budget as approver`.
  - `grants accounting roles to budget and requestor`.
- [ ] **Step 2: Run** `bun test:unit -- unit/data-reset/accounting-docs.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement the module.**
  - Documents are created through `POST /api/GR2VYNKQ/ap-invoice` (body per the design's Facts section) and the gl-jv / jv-template endpoints the FE uses.
  - Payments go through the ap-payment endpoints.
  - The verify step counts each key.
- [ ] **Step 4: Run** `bun test:unit`, then `bun run data:reset --yes`. Expected: 0 failed, and the verify table lists the 10 keys.
- [ ] **Step 5: Commit** — `feat(data-reset): workflow AP payment/JV, role บัญชี และชุดเอกสารอ่านอย่างเดียวของเฟส 2a`

### Task 3: Money oracle + accounting API helpers

**Files:**
- Create: `tests/helpers/money.ts`, `unit/money.test.ts`, `tests/helpers/ap-api.ts`, `tests/helpers/gl-api.ts`

**Interfaces:**
- Produces:
  - `money.ts`: `round(n: number, decimals: number): number` (half-up) · `vatOf(net: number, rate: number, decimals: number): number` · `netFromIncVat(gross: number, rate: number, decimals: number): number` · `whtOf(base: number, rate: number, decimals: number): number` · `expectBalanced(lines: { dr: number; cr: number }[]): void`
  - `ap-api.ts`:
    - `createApDoc(type: "invoice" | "debit_note" | "credit_note" | "deposit", opts: { lines: { qty: number; price: number; incVat?: boolean }[]; tag: string }): Promise<{ id: string; no: string }>`
    - `submitApDoc(id, role?: Role)`, `approveApDoc(id, role?: Role)`, `voidApDoc(id, role?: Role)`
    - `getApDoc(id)`: returns totals and the open balance
    - `seededApDoc(key: string)`: looks up a Task 2 read-set document
    - `createPayment(invoiceIds: { id: string; amount: number }[], opts?: { whtProfile?: boolean }): Promise<{ id: string }>`, `submitPayment`, `approvePayment`, `voidPayment`
  - `gl-api.ts`:
    - `jvOfSource(sourceType: string, sourceId: string): Promise<JvLine[]>`, `createManualJv(lines, tag)`, `submitJv`, `approveJv`, `voidJv`, `reverseJv`
    - `withGlSetting<T>(patch: Partial<GlSetting>, fn: () => Promise<T>): Promise<T>`: restores the previous value in `finally`
    - `assertAccountingReady(): Promise<void>`: throws "accounting setup missing on TEST BU: <what> — run data:reset" when there is no open GL period or a `gl_setting` account is missing
    - `buDecimals(): Promise<number>`
  - Tags make documents findable: `vendor_invoice_no` / description `E2E-T-<spec>-<ts>`.
- [ ] **Step 1: Write failing `unit/money.test.ts`:**
  - `round(69.9993, 2) === 70` · `round(0.005, 2) === 0.01` (half-up)
  - `vatOf(999.99, 7, 2) === 70` · `whtOf(999.99, 3, 2) === 30`
  - `netFromIncVat(1070, 7, 2) === 1000`
  - `expectBalanced` throws on `[{dr:100,cr:0},{dr:0,cr:99.99}]`
- [ ] **Step 2: Run** `bun test:unit -- unit/money.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement `money.ts`** with integer minor units to avoid float drift.
- [ ] **Step 4: Implement `ap-api.ts` and `gl-api.ts`** on `buSend` from `tests/helpers/bu-api.ts`, following the `grn-api.ts` style.
- [ ] **Step 5: Run** `bun test:unit`. Expected: pass. Type-check with `bunx tsc --noEmit -p .` filtered to `tests/`, with 0 errors under `tests/`.
- [ ] **Step 6: Commit** — `feat(e2e): oracle คำนวณเงิน + helper API ของ AP/GL`
- [ ] **Step 7: Open PR1** covering Tasks 0–3 against `main` (English). The body lists the preflight results and the oracle assumptions.

### Task 4: 801 AP invoice spec

**Files:**
- Create: `tests/801-ap-invoice.spec.ts`, `tests/pages/ap-invoice.page.ts`
- Modify: `docs/test-id-scheme.md`

**Interfaces:**
- Consumes: Task 3 helpers and Task 2 read set.
- Produces: `ApInvoicePage` with `gotoList()`, `gotoDetail(id)`, `gotoNew(type)`, and locator factories `row(no)`, `statusChip()`, `totalField(name: "net" | "vat" | "total" | "open")`.

Cases (sections: 01 list, 02 detail, 03 create, 04 edit, 10 security, 20 validation, 40 posting):
- [ ] **Step 1: Write the cases:**
  - **01 list:** the list shows the read-set invoices; search finds `E2E-AP-POSTED`; the status filter shows only the selected status.
  - **02 detail:** `E2E-AP-POSTED` shows net 999.99, VAT 70.00 and total 1,069.99, equal to `getApDoc` and to `money.ts`; the Inc-VAT document shows net 1,000.00 and VAT 70.00.
  - **03 create:** create through the UI `/new` with 2 lines → `expectSaved` → the API record has the typed amounts and status draft.
  - **04 edit:** a draft line qty change → the total is recomputed and saved.
  - **20 validation:** a missing vendor or zero lines → `expectBlocked` with a field error; a duplicate `vendor_invoice_no` for the same vendor → per the oracle doc (refused, or assumption).
  - **40 posting:** submit and approve a fresh invoice as Budget → `jvOfSource` lines are balanced; Dr expense = net; Dr input VAT = VAT; Cr the vendor AP account = total; the accounts equal `AccountingAccounts`.
  - **40 void:** void a posted invoice with no payment → a reversing JV exactly cancels the original; `E2E-AP-PARTIAL` void → refused `AP_INVOICE_HAS_PAYMENT`.
  - **10 security:** Requestor (viewer) sees no Approve or Void, and an API approve as Requestor is refused (`expectRefused` / 4xx).
  - **Precondition:** `assertAccountingReady()` runs in `beforeAll`.
- [ ] **Step 2: Run** `bun run test -- --project=chromium tests/801-ap-invoice.spec.ts` **twice in a row** (Review Focus 1). Expected: green both times, with suspected bugs pinned per policy.
- [ ] **Step 3: Gates and commit** — `test(e2e): 801 AP invoice — รายการ รายละเอียด สร้าง ลงบัญชี void สิทธิ์ และตัวเลขเทียบ oracle`

### Task 5: 802 AP deposit / debit note / credit note + 805 GRN→AP auto

**Files:**
- Create: `tests/802-ap-doc-types.spec.ts`, `tests/805-ap-from-grn.spec.ts`
- Modify: `docs/test-id-scheme.md`

- [ ] **Step 1: Write the 802 cases**, one describe per type using `ApInvoicePage.gotoNew(type)`:
  - Each type creates, posts, and has a JV that is balanced, with signs per the oracle (a debit note increases the AP payable and a credit note reduces it; confirm the direction in the oracle notes).
  - A deposit posts to `advanceDeposit`.
  - The read-set `E2E-AP-DN` / `E2E-AP-CN` / `E2E-AP-DEPOSIT` details match the API.
- [ ] **Step 2: Write the 805 cases**, each inside `withGlSetting({ ap_auto_from_grn: true }, …)`:
  - Commit a fresh GRN (reuse `grn-api.ts` helpers) → an AP invoice with `doc_source` `grn_auto` exists for it, with amounts equal to the GRN lines and Dr accounts from the product category mapping.
  - With the switch off (the default) → no invoice.
  - Voiding the GRN-side handles the `grn_auto` invoice per BE `ap-invoice.service.ts:393-430`.
- [ ] **Step 3: Run each spec twice in a row.** Expected: green, and `ap_auto_from_grn` is back to `false` after the run (check it with a GET).
- [ ] **Step 4: Gates and commit** — `test(e2e): 802 AP deposit/debit/credit note + 805 สร้าง AP จาก GRN อัตโนมัติ`
- [ ] **Step 5: Open PR2** covering Tasks 4–5, stacked on PR1.

### Task 6: 803 AP payment + 804 payment approvals

**Files:**
- Create: `tests/803-ap-payment.spec.ts`, `tests/804-ap-payment-approvals.spec.ts`, `tests/pages/ap-payment.page.ts`
- Modify: `docs/test-id-scheme.md`

- [ ] **Step 1: Write the 803 cases:**
  - Pay a fresh 1,000.00 + VAT invoice in full with the WHT 3% profile → the JV is balanced: Dr AP = paid amount, Cr bank = paid − WHT, Cr WHT payable = `whtOf(base)`, where the base is per the oracle notes. The invoice open balance is 0.
  - **Partial:** 400 then 600 → open 600, then 0. Voiding the second payment → open 600 again, and the reversing JV cancels exactly (Review Focus 4).
  - **Overpay:** more than the open amount → refused per `ap-payment-save-rules.md`.
  - The `E2E-AP-PARTIAL` read-set detail shows open 670.00 (1,070.00 − 400.00). Correct this figure if the oracle says WHT reduces the open amount; record the rule in the case.
- [ ] **Step 2: Write the 804 cases:**
  - A submitted payment appears in `/accounting/accounts-payable/payment-approvals` for Budget, not for Requestor.
  - Approve as Budget → posted, with its JV present.
  - Reject → back to draft or rejected, with no JV.
  - A stage threshold on `base_net_paid_amount` (from the workflow mapper), if the seeded workflow has one.
- [ ] **Step 3: Run each spec twice in a row.** Expected: green.
- [ ] **Step 4: Gates and commit** — `test(e2e): 803 AP payment (WHT, จ่ายบางส่วน, void) + 804 payment approvals`
- [ ] **Step 5: Open PR3** stacked on PR2.

### Task 7: 810 manual JV + 811 JV templates

**Files:**
- Create: `tests/810-journal-voucher.spec.ts`, `tests/811-jv-template.spec.ts`, `tests/pages/journal-voucher.page.ts`
- Modify: `docs/test-id-scheme.md`

- [ ] **Step 1: Write the 810 cases:**
  - Create through the UI with 2 lines → `expectSaved`. An unbalanced JV is blocked (`expectBlocked`, with the message shown).
  - Submit and approve as Budget → posted.
  - The JV detail shows every header field even when empty (per the 2026-11-04 decision on the JV detail page).
  - `voidJv` → status void, with no new JV.
  - `reverseJv` → a mirror JV dated later, balanced, and with swapped sides.
  - An AP-generated JV: void and reverse are refused with `GL_JV_IMMUTABLE`, and the source stays posted (Review Focus 5).
  - Requestor cannot approve or void.
- [ ] **Step 2: Write the 811 cases:**
  - The template, recurring and allocation lists load the read set.
  - A JV created from `E2E-JVT-1` copies its lines.
  - An allocation template splits the amounts per its percentages (expected value computed with `money.round`).
  - The recurring `post_at` / run-due path is **out of scope** unless it is callable on demand. Note this in the spec header.
- [ ] **Step 3: Run each spec twice in a row.** Expected: green.
- [ ] **Step 4: Gates and commit** — `test(e2e): 810 JV ทำมือ (ลงบัญชี void reverse ห้ามแก้ JV จาก subledger) + 811 JV template`

### Task 8: 820 settings/dashboard smoke, bug list, close Phase 2a

**Files:**
- Create: `tests/820-accounting-settings.spec.ts`, `docs/superpowers/specs/2026-11-23-e2e-phase-2a-bug-list.md`
- Modify: `docs/test-id-scheme.md`, `docs/test-cases/COVERAGE.md`, `docs/test-cases/SPEC-HEALTH.md` (regenerated)

- [ ] **Step 1: Write the 820 cases:**
  - `/accounting/settings` shows the seeded `gl_setting` accounts by code.
  - The view-only role cannot save.
  - `/accounting/accounts-payable` and `/accounting` dashboards load with figures that are non-empty for the read set. This is a smoke check; deep widget numbers are out of scope.
- [ ] **Step 2: Write the bug list** in the Phase 1 format: one row per cause, then TC-IDs, actual vs expected, repro, the FE/BE suspect, and whether the oracle rule is an assumption.
- [ ] **Step 3: Verify:**
  - `bun run data:reset --yes`
  - all `tests/8*.spec.ts` (chromium) **twice in a row**
  - then the full default run (setup + login + chromium), with no new failures outside 8xx compared with the Phase 1 close run (1059 passed; any differences are listed)
  - `bun audit:coverage`, `bun audit:spec-health`, `bun audit:tc-ids`, `bun test:unit`
- [ ] **Step 4: Commit** — `docs(e2e): สรุปบั๊กเฟส 2a + ตัวเลข coverage` and **open PR4** stacked on PR3. The PR body lists every `test.fail` with its reason, flaky cases, and each `withGlSetting` restore check.
