// Trust the intermediates the dev backend fails to send (see certs/dev-backend-chain.pem).
// dev.blueledgers.com:4001 serves only its leaf certificate; browsers and macOS curl fetch the
// missing Let's Encrypt YE2 / Root YE through AIA, Bun and Node do not ("unable to verify the
// first certificate"). The chain ends in ISRG Root X2, which every bundled store already trusts,
// so this adds no new root of trust. Delete this file (and its two callers) once the server
// serves fullchain.pem.
//
// Loaded by bunfig.toml `preload` (every `bun run <script>`) and by playwright.config.ts (Node).
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import tls from "node:tls";

const extra = readFileSync(resolve(__dirname, "../certs/dev-backend-chain.pem"), "utf8");

if (typeof (globalThis as { Bun?: unknown }).Bun !== "undefined") {
  // Bun reads NODE_EXTRA_CA_CERTS only at process start and has no setDefaultCACertificates,
  // so give every fetch the bundled roots plus the chain unless the caller set its own `ca`.
  const ca = [...tls.rootCertificates, extra];
  const original = globalThis.fetch;
  globalThis.fetch = Object.assign(
    (input: Parameters<typeof fetch>[0], init: RequestInit & { tls?: { ca?: unknown } } = {}) =>
      original(input, { ...init, tls: { ...init.tls, ca: init.tls?.ca ?? ca } } as RequestInit),
    original,
  ) as typeof fetch;
} else {
  // Node 22.19+ / 24.5+; the repo's @types/node predates these two functions.
  const nodeTls = tls as typeof tls & {
    getCACertificates(type: "default"): string[];
    setDefaultCACertificates(certs: string[]): void;
  };
  nodeTls.setDefaultCACertificates([...nodeTls.getCACertificates("default"), extra]);
}
