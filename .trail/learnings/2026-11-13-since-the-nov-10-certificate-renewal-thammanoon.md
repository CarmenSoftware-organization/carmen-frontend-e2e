---
title: "Since the Nov 10 certificate renewal, the dev backend sends no intermediate certificate, so Bun scripts can't connect while browsers still can"
author: Thammanoon
date: 2026-11-13
branch: feature/data-reset-roles-currency
cost: { minutes: 1, tokens: 2703 }
id: l-925df5a2
scope: repo
status: active
src: agent
touches:
  - scripts/seed-master/api-client.ts
  - scripts/data-reset/sessions.ts
---

## Watch out
- Since the certificate renewal on 2026-11-10 17:46 GMT, `dev.blueledgers.com:4001` serves only its own certificate, without the Let's Encrypt intermediate (YE2). Browsers fetch the missing piece themselves, so the frontend and the Playwright suite keep working. Bun/Node scripts do not: `data:reset`, `seed:master` and any `scripts/` call fail at login with "unable to verify the first certificate" (UNABLE_TO_VERIFY_LEAF_SIGNATURE). It looks like the backend is down, but it isn't.
- Adding only YE2 is not enough. It is signed by "ISRG Root YE", a new root that Bun's built-in list doesn't have, so the error turns into "unable to get issuer certificate". The cross-signed Root YE (issued by ISRG Root X2) is needed as well.

## Decided
- Kept certificate checking on. The fix belongs on the server: serve the full chain. Until then, pass the missing certificates as extra trusted CAs for the one command, after verifying they chain up to the system's ISRG Root X2.

## Tried and ruled out
- `NODE_TLS_REJECT_UNAUTHORIZED=0`: it would work, but it turns off verification for a script that sends every test account's password.

In the code:
- where it fails: `login` in `scripts/seed-master/api-client.ts` (the fetch to `/api/auth/login`), reached through `createSessions` in `scripts/data-reset/sessions.ts`
- `curl -s http://ye2.i.lencr.org/ | openssl x509 -inform der` (YE2) and `curl -s http://ye.i.lencr.org/ | openssl x509 -inform der` (Root YE, cross-signed by X2); X2 from `security find-certificate -c "ISRG Root X2" -p /System/Library/Keychains/SystemRootCertificates.keychain`
- verify: `openssl verify -CAfile x2.pem -untrusted <ye2+ye>.pem leaf.pem` → OK, then `NODE_EXTRA_CA_CERTS=<ye2+ye+x2>.pem bun run data:reset ...`
- check whether the server is fixed: `echo | openssl s_client -connect dev.blueledgers.com:4001 -servername dev.blueledgers.com -showcerts | grep -c "BEGIN CERT"` (1 = still broken)
