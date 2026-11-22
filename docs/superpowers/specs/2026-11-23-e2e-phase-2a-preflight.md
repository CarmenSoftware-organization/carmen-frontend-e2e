# E2E Phase 2a — Preflight (Task 0)

Date: 2026-11-23 · Branch `feat/e2e-phase-2a-accounting-data` (base `98a3c6b`) · Read-only probe, GETs only

## 1. Environment

| Item | Value |
|---|---|
| Dev BE build | `GET <BACKEND_URL>/version` -> `{"version":"4.0.13-build.20261112.f529576a9","commit":"27fbc585f"}` (same string the Phase 0 triage recorded from the app footer, `2026-11-20-e2e-catchup-triage.md:8`) |
| FE `main` SHA (`../carmen-frontend`) | `4c4e15fa` |
| e2e SHA | `98a3c6b` |
| Backend | shared dev DB behind the gateway the helpers resolve from `/config.json` (`tests/helpers/bu-api.ts`) |

The dev BE build is from 12 Nov. Anything merged to BE `main` after that and not deployed is "BE not deployed on dev".

## 2. Gating on TEST BU `GR2VYNKQ` (Admin)

| Endpoint | Status | Result |
|---|---|---|
| `GET /api/GR2VYNKQ/ap-invoice` | **200** | empty list (total 0) |
| `GET /api/GR2VYNKQ/ap-payment` | **200** | empty list |
| `GET /api/GR2VYNKQ/gl-jv` | **200** | empty list |
| `GET /api/GR2VYNKQ/gl-jv-templates` | **200** | empty list |
| `GET /api/GR2VYNKQ/ap-payment/outstanding` (no params) | 400 | uuid validation only; route exists (not 403 / 404) |
| `GET /api/GR2VYNKQ/vendor`, `/gl-jv-prefixes` | 404 | wrong paths (not routes); `/api/config/GR2VYNKQ/gl-jv-prefixes` is 200 |
| Budget and Purchase roles `GET /ap-invoice` | 200 | |

`GET /api/license`: one BU entry, `state: active`, `end_date 2027-12-31`, `expired_features: []`. Features include
`accounting.ap`: **true**, `accounting.gl`: **true**, `accounting.gl.jv_template`: **true**.
No license or allowlist block. Step 5 stop condition is **not** triggered. (The FE locked page was not opened in a
browser; the gateway returning 200 with the license present is the evidence.)

Permissions (`/api/user/profile`): Admin returns no `accounting.*` keys (presumably an admin bypass, not verified).
Budget: `accounting.ap.view/void`, `ar.view/void`, `gl.view`, `accounting.view` (view-only; no submit, post, approve).
Purchase: broad `accounting.config.gl.*`, `gl.post/reverse/void`, `gl.jv_template.*`, `ap.view/void`, no AP create/approve keys seen.
Neither holds the AP create / approve / pay keys, so Task 1 needs its own accounting roles, as the spec says.

## 3. GL state (what `data:reset` has on dev now)

| Item | State |
|---|---|
| GL periods | **none** (`/config/GR2VYNKQ/gl-periods` -> empty). Every AP / JV post would fail `GL_PERIOD_NOT_OPEN` |
| `gl_setting` | **404 "Config key not found"**. App-config keys present: `grn_running_no`, `pr_running_no`, `sr_running_no` only. So `ap_control_account_id`, `input_vat_account_id`, `wht_payable_account_id`, `advance_deposit_account_id` are unset |
| Bank accounts | **none** |
| Tax profiles | 2: `None` (vat, 0) and `Vat 7%` (vat, 7); both `chart_of_accounts_id = null`; **no WHT profile** |
| COA | 13 accounts WITH description + category (spec said "no name or type"; it has them now): 1100 Cash and Bank, 1140/1150/1160 Inventory, 1170 Input VAT, 2100 Accounts Payable, 2110 Accrued Expenses, 3100 Retained Earnings, 4100/4200 Sales, 5100/5200/5300 expenses. Missing: WHT payable, advance deposit / prepaid, FX gain/loss |
| AP / JV workflows | none (workflows: purchase_order, purchase_request, store_requisition only) |
| AP / JV documents, JV templates | none |
| JV prefixes | present (`JV`, system default) |
| BU decimal settings | not found in app-config (only 3 running-no keys); read from a BU/currency setting later, not hardcoded |

Conclusion: licenses are fine; the data gaps listed in the spec are real and Task 1 must seed them. The empty COA gaps are
smaller than the spec assumed (names and categories exist).

## 4. Oracle notes (FE docs, `../carmen-frontend/docs/accounting/`)

Cites are `file:line`. `inv` = `specs/accounts-payable-invoice-design.md`, `pay` = `specs/accounts-payable-payment-design.md`,
`jv` = `specs/general-ledger-journal-voucher-design.md`, `rules` = `ap-payment-save-rules.md`.

### 4.1 Answers the plan needs

- **Does WHT reduce the AP open balance? Not at invoice; yes at payment, as a settlement component.**
  - Invoice: WHT "ไม่หักจาก Invoice grand total ใน default Thailand policy" (inv:102); "ไม่ลด AP liability ตอน Invoice" (inv:83); acceptance "WHT eligibility ไม่ลด default invoice liability ก่อน payment" (inv:254).
  - Payment: the save rule is `Invoice total = Payment total + WHT total - Other Expense total` (rules:17), so the amount applied to the invoice equals cash + WHT - other expense. The payment JV is `Dr AP control (carrying amount settled) / Cr WHT payable / Cr Bank` (pay:127-130). So a payment with WHT reduces the open amount by cash + WHT, not by cash alone.
  - `open_amount = posted document total - posted applications - posted credits` (inv:97).
  - For `E2E-AP-PARTIAL` (1,070.00 invoice): **670.00 is correct only if the 400.00 payment carries no WHT** (the open amount drops by exactly 400.00). If the case adds WHT of W, open = 1,070.00 - (cash + W). Decide the amounts so that the equation at rules:17 holds, and say in the case which one it is. Do not change 670.00 unless WHT is added.
- **When is WHT computed? At payment, not at invoice.** Invoice shows only an "eligible / estimated" amount (inv:83, inv:102). The WHT amount, base, rate and certificate belong to the payment (pay:98-106). Backend re-validates the balance equation using the WHT amount it resolves from master, not the browser's (rules:22). Certificate is created once when the payment posts (pay:112).
- **WHT base:** eligible pre-VAT / service amount, not the whole invoice total (pay:110). Amount = base x service rate, with an override that stores calculated value, override, reason and approver (rules:12, pay:111). Matches the plan's "WHT on the pre-VAT base" assumption.

### 4.2 Numeric and rule list

| Topic | Rule | Cite |
|---|---|---|
| Line math | `line_subtotal = qty x unit_price`; `line_net = subtotal - discount`; `line_payable = line_net + line_vat + other payable taxes`; `document_total = sum(line_payable) + header charges - document offsets` | inv:92-98 |
| VAT | per line from tax profile (or approved override with permission and reason); taxable base, rate, amount, input / pending VAT account | inv:82, inv:96 |
| VAT inclusive | taxable base is backed out with a defined rounding rule; "not always `amount x 7%`" | inv:103 |
| Rounding | decimal arithmetic at currency precision; functional amount rounded per posting line; difference goes to the rounding account when in tolerance | inv:90, inv:105 |
| Invoice JV | `Dr Expense/Inventory/Asset = line net`, `Dr (Pending) Input VAT = claimable tax`, `Cr Trade AP = document payable` | inv:162-166 |
| Settlement | partial payment -> `partially_paid`, full -> `paid`; lifecycle stays `posted` | inv:188, inv:257 |
| Debit / credit note sign | one sign convention in the API; never flip both document sign and Dr/Cr | inv:106 |
| Credit note / deposit application | applied as separate links to posted open items, reduces cash; no free-typed offset | pay:62, pay:90, pay:264 |
| Payment equation | `Invoice total = Payment + WHT - Other Expense`; all three non-negative; payment may be 0 | rules:17-19 |
| Other expense | signed total: Debit +, Credit -; API sends a positive amount + `is_credit`; DB stores credit as negative | rules:20, rules:23 |
| WHT lines | 0 allowed; if added, 1-3 services, with Form and Condition non-empty; Form defaults to vendor profile else PND.53 (`PND53`); Condition 1/2/3, default 1 | rules:9-12 |
| Zero payment | no zero bank leg; any currency rounding remainder goes to realized FX | rules:24 |
| Unbalanced | cannot save; backend re-checks | rules:22 |
| Save vs post | Save Draft does not post and does not reduce the debt; Submit or final approval posts | rules:26, pay:188 |
| Over-apply | partial allowed; cannot exceed available open amount, even with concurrent users | pay:263 |
| Payment JV | `Dr AP control / Dr-Cr Realized FX / Cr WHT payable / Cr Bank` | pay:127-130 |
| Payment errors | 403 SoD / workflow; 422 invalid WHT base / rate, period locked, hold | pay:253-255 |
| JV balance | Dr and Cr mutually exclusive per line; Submit disabled when base debit != credit; 400 on unbalanced | jv:166-168, jv:281 |
| JV save vs submit | Save Draft need not be balanced; Submit must be; workflow off = post | jv:241-242 |
| JV reverse / void | Reverse only for posted manual JV, creates a linked JV with Dr/Cr swapped that cancels the functional amount; Void for draft / submitted / scheduled / post_failed, reason required | jv:221-222, jv:246-247, jv:300 |
| Source JV | AP / AR / inventory JVs are immutable projections; correct from the source owner | jv:315 |
| Closed period | posting or reversal becomes an exception; the date is not moved | jv:226, jv:301 |

### 4.3 Gaps (docs silent) and the assumption each case uses

All use the plan's Global Constraints rule; each case writes `assumption:` in `expected`.

| Gap | Assumption |
|---|---|
| Rounding per line vs per document | round half-up per line to the BU decimals, then sum |
| VAT on a discounted line | 7% on `line_net` (after discount) |
| WHT rate per service | take from the seeded WHT tax profile (Task 1), not from the doc |
| WHT rounding | half-up to the BU decimals on the WHT total per payment (the doc says only "aggregate per certificate rule", pay:92) |
| WHT base on Inc-VAT lines | the backed-out pre-VAT base (inv:103), then the rate |
| Credit / debit note sign in API | positive amounts; credit note reduces the vendor's open balance, debit note increases it. The doc fixes no sign (inv:106) |
| Deposit application ordering / allocation across invoices | oldest invoice first; the doc only says a "configured allocation rule" (pay:134) |
| Whether other expense is used in the money cases | not used, except in one equation case |
| BU decimals source | not in app-config on dev today; read from the API once per run when found, else 2 |

## 5. Stop condition

Not triggered: AP and GL answer 200 on TEST BU, the three license features are active, `expired_features` is empty.
The blockers for the money path are data, not gating (no GL period, no `gl_setting`, no bank account, no WHT profile,
no accounting workflow), all within Task 1 scope.
