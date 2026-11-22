# E2E catch-up Phase 1 — bug list + before/after numbers

| | |
| --- | --- |
| Date | 2026-11-22 |
| Branch | `chore/e2e-catchup-close-phase-1` (PR stack #87 → #88 → #89 → #90 → #91 → #92 → #93 → this PR) |
| Dev backend | API `v4.0.13-build.20261112.f529576a9` (dev CI deploys have been blocked by billing, so dev may lag BE `main`) |
| Source of truth | every `test.fail(` in `tests/` (57 pin sites, counted incl. fixture forms such as `hodTest.fail(` / `fcTest.fail(`, excluding comments: 47 in the default run (setup + login + chromium) and 10 in the opt-in movement / period-close specs. The full-run figure of 53 below is a different measure (cases executed in that run) and does not equal 46; it was not reconciled). A `test.fail` reports **passed** while the bug exists and turns **red ("unexpectedly passed")** once it is fixed — drop the marker then. |

Each row is one cause; several TC-IDs may share it. "Repro" is what the pinned test does, so
`bun run test -- tests/<spec> -g <TC-ID>` reproduces it on dev after `bun run data:reset --yes`.
Verdicts are the implementers' and reviewers' findings, checked against FE `main` (`../carmen-frontend`) and
BE `main` (`carmen-turborepo-backend`); none has been confirmed by a product owner. **Every row needs a per-item decision
(fix / accept / drop the case) from the user.**

## Before / after (SPEC-HEALTH + COVERAGE)

| Metric | Task 0 baseline (`c5b1a15`) | Now | Change |
| --- | --- | --- | --- |
| Cases declared | 1423 | 1255 | -168 (deleted: feature absent in FE at HEAD, duplicates) |
| Running | 1179 | 1102 | -77 |
| Skipped (static) | 201 | 153 | -48 |
| Fixme | 43 | 0 | -43 |
| Dormant | 17% | 12% | -5 pts |
| Running, asserting only via a page-object helper | 38 | 29 | -9 |
| Running, asserting nothing | 285 | 0 | -285 |
| Running, trivial-only assertions | 25 | 0 | -25 |
| Running, behind an in-body skip guard | 251 | 23 | -228 |
| Assertions in running cases | 1547 | 2831 | +1284 |
| Coverage modules: spec / catalog / none | 47 / 40 / 36 | 50 / 39 / 34 | +3 / -1 / -2 |

Full default run (`setup` + `login` + `chromium`, after `data:reset --yes`, 2.3 h): **1059 passed, 2 failed, 179 skipped**.
Both failures were investigated (see the PR body): `TC-CUR-040002` is flaky (passes in isolation and in a full 040 re-run); `TC-CN-530003` was a test race (typed the over-quantity before the GRN lookup had set the cap) and was fixed.
The 179 skips = 153 static `test.skip` + in-body data / precondition skips; the `test.fail` pins that executed in that run (53 as reported by that run; the code holds 57 sites, 47 of them in default-run specs) count as passed.
Playwright's list reporter prints the expected-failure pins with a red cross even though they count as passed.


## 1. Suspected bugs (one row per cause)

### 1a. Backend, or the contract between FE and BE

| Cause | Specs / TC-IDs | Actual vs expected | Repro | FE/BE suspect |
| --- | --- | --- | --- | --- |
| PR Draft save: a line carrying both `pricelist_detail_id: null` and `is_tax_included` is rejected | 301 TC-PR-020001; 302 TC-PR-050503 (edit line), TC-PR-050504 (add line); 311 TC-PR-080705, TC-PR-080706; 312 TC-PR-700003 | Expected: save answers 200 and the toast shows. Actual: `PATCH …/save` → 400 `Unknown argument product_id` (edit path) or `Argument is_tax_included is missing` (add path). Bisected by replaying the PATCH: dropping either of the two keys gives 200. | Open a seeded Draft PR as Requestor, change a qty (or add a line), Save. | FE `76ec45e4` (2026-11-09) added `is_tax_included` to the payload; BE schema `1ac85b1ae` (2026-11-09) has the column; dev runs build `f529576a9` (2026-11-13), so it is **not** a not-yet-deployed change. Suspect BE purchase-request details update/add path in micro-business. |
| FE sends the stock-replenishment create payload in the old shape (top-level `location_id` / `from_location`) | 711 TC-SRPL-300001, TC-SRPL-300002, TC-SRPL-300003 | Expected: create PR / SR from replenishment succeeds. Actual: `POST /stock-replenishments/pr` → 400 `products.0.location_id: expected string, received undefined`; `/sr` → 400 on `location_id` / `from_location`. | Stock Replenishment → pick a location + product → Create PR / Create SR. | FE `routes/store-operation/stock-replenishment/use-stock-replenishment.ts:64-83` (top-level). BE `apps/backend-gateway/src/common/dto/stock-replenishment/stock-replenishment.dto.ts:30,68-69` requires `products[].location_id` since `400fff4a9` (2026-08-24). Both mains disagree, so this is an FE fix, not a deploy. |
| `workflow-stages` only returns stages of PRs the caller requested | 303 TC-PR-060203, 304 TC-PR-070103 | Expected: the Stage filter lists the workflow's stages for approvers / purchasers. Actual: `GET purchase-requests/workflow-stages` returns `data: []`. | HOD / Purchase opens the PR list → Stage filter. | micro-business `purchase-request.service.ts` `findAllWorkflowStagesByPr` selects workflows from PRs where `requestor_id = caller`. |
| Gateway has no permission decorator on PR template / GRN / Credit Note writes, and the FE does not gate the actions either | 310 TC-PRT-010002 (create template), TC-PRT-040003 (delete confirm opens); 501 TC-GRN-030002, TC-GRN-040003, TC-GRN-050002 (New GRN enabled), TC-GRN-110002 (Commit), TC-GRN-120002 (Void); 601 TC-CN-100002 (Submit) | Expected: a view-only role (FC) cannot create / commit / void / submit. Actual: the buttons are enabled and `POST /purchase-request-templates` returns 201 for FC. | Log in as `fc@`, open the list / document, click the action. | FE: `prt-component` passes no `addDisabled` (PR / PO do), `prt-form.tsx` delete click unguarded, `grn-footer-action.tsx` Commit / Void and `cn-footer-action.tsx` Submit carry no permission check. BE: gateway controllers for templates, GRNs, credit notes have no permission decorator (only `purchase-requests` has 5). |
| SR submit not restricted to creator / stage | 701 TC-SR-050004 | Expected: a Requestor with only `store_requisition.view` who did not create the SR cannot submit it. Actual: `PATCH /store-requisitions/{id}/submit` → 200 (the same user gets 404 on GET and 422 `WORKFLOW_USER_NOT_STAGE_APPROVER` on approve). | API: Requestor submits a Purchase user's Draft SR. | Gateway / micro-business store-requisition submit path does not enforce ownership. |
| SR update with a stale `doc_version` answers 404, not 409 | 701 TC-SR-090005 | Expected: 409, so the FE shows "Someone else changed this document". Actual: 404 `SR_NOT_FOUND`, so the FE shows "This requisition no longer exists". | Open the SR in two sessions, save in one, save the other. | BE `store-requisition.service.ts:1184` `findFirst({id, doc_version})` → `SR_NOT_FOUND` before the 409 guard at L1231; FE `lib/error-message.ts:40-42` already maps 409. |
| SR line rejected next to an approved line is stored as approved | 701 TC-SR-110004 | Expected: the line keeps `reject_message` / `reject_by`. Actual: `last_action = approved`, `approved_qty 5`, reason in `approved_message`, `reject_message` null, though the line history says `reject`. | Approve stage: reject one line, approve another, read the SR via API. | micro-business store-requisition approve path. |
| Currency accepts a second currency with the same name | 040 TC-CUR-200003 | Expected: duplicate name refused. Actual: `POST` answers 2xx, dialog closes, record created. | Create a currency, create another with the same name. | BE currency create has no uniqueness guard (cf. department TC-DEP-010011). |
| Certification create always 400 | 043 TC-CERT-030001, 040001, 040002, 040003, 040004, 050001, 050002, 200002, 200003 | Expected: a certification is created. Actual: `POST /vendor-master-certificates` → 400 `metadata field is required`; the dependent cases then find no record. | Vendor Management → Certification → New → fill code / name → Save. | FE `certification-dialog.tsx` sends `{code, name, description, is_active}` without `metadata`. Fix on either side (add `metadata`, or relax the BE DTO). |

### 1b. Frontend

| Cause | Specs / TC-IDs | Actual vs expected | Repro | FE/BE suspect |
| --- | --- | --- | --- | --- |
| FOC Qty editable at the approver stage; Approved Qty editable at the purchaser stage | 303 TC-PR-060407, 304 TC-PR-070306 | Expected (spec FR-PR-011A / 024): read-only. Actual: enabled inputs. | HOD opens a PR at the HOD stage (FOC cell); Purchase opens a PR at the Purchase stage (Approved cell). | `foc-cell.tsx` shares `isQtyDisabled` with the approved cell; `approved-cell.tsx` only locks Requested outside Create (`use-pr-item-table.tsx:136`). |
| Voided PO shows no "Voided" chip in the detail header | 401 TC-PO-030004, 403 TC-PO-070311 | Expected: header shows Voided. Actual: only the doc-type chip and a dash, although the API says `po_status = voided`. | Reject a PO (confirm both dialogs), open it. | FE `po-header.tsx:88-90`: `PO_STATUS_CONFIG` lacks `voided`. |
| Vendor contact Primary checkbox does not re-render | 150 TC-VEN-030005, TC-VEN-030011 | Expected: ticked box shows ticked. Actual: stale. | Vendor → Contact → add a contact → tick Primary. | `vendor-contact.tsx:152` reads `form.getValues`, not `useWatch`. |
| Duplicate delivery-point name shows no feedback | 079 TC-DP-200002 | Expected: a message. Actual: the backend refuses with 409 `DELIVERY_POINT_ALREADY_EXISTS`, the dialog shows nothing. | Create two delivery points with the same name. | FE `components/share/delivery-point-dialog.tsx:60` already routes `DELIVERY_POINT_ALREADY_EXISTS` to the `name` field (`serverFieldErrors`), but `messages/en.json` has no `byCode.DELIVERY_POINT_ALREADY_EXISTS` entry (0 hits; other `*_ALREADY_EXISTS` codes have one), so there is no text to show. Likely fix: add the message string. |
| View-only roles see enabled Edit / Delete / Add on vendor-management documents | 159 TC-PL-030003 (Edit on a price list), 160 TC-PT-010004 (Add template), 1001 TC-CAM-040003 (Edit RFP), TC-CAM-080004 (Delete RFP) | Expected: disabled for roles holding only `.view`. Actual: enabled. | Log in as `requestor@` (price list / template) or `hod@` (RFP). | The lists do not pass `addDisabled` / edit gating. Note every role holds `.view`; only purchase@ has all write permissions. |
| Select from GRN offers a product already credited on another CN | 603 TC-CN-700004 | Expected: product disabled. Actual: selectable; the BE then answers 422 on Create. | CN from a GRN, a second CN for the same GRN → Select from GRN. | FE dialog does not use `GET good-received-notes/:id/ref`. |
| Inventory Adjustment Stock Out: draft shows estimated cost 0.00; editing a line qty makes Total NaN and Save sends nothing | 730 TC-IADJ-710003, TC-IADJ-710004 (opt-in `movement` project) | Expected: cost kept, edit saves. Actual: 0.00 on reopen; NaN total and silent zod rejection with no toast. | Stock Out draft → reopen / edit qty. | FE known bugs FE-5 / FE-4 carried from `_movement_play`. |
| SR Issue with the default Issued qty (0) completes the SR | 721 TC-SI-710007 (opt-in `movement` project) | Expected: the SR is not closed without moving stock. Actual: closed as completed, balance unchanged. | Issue stage → click Issue without entering a qty. | FE issue handler / BE issue approve path (not isolated). |
| PR template Save with no product / no items gives no feedback | 310 TC-PRT-070002 (row without product), TC-PRT-090003 (all items removed); both via `expectSilentlyBlocked` | Expected: a validation signal (aria-invalid on Select Product / Unit, an items-required message, or a toast). Actual: Save does nothing: no toast, no `aria-invalid` anywhere on the page (even after a later re-render), no write request; the form stays in edit mode. | Template → Edit → Add Item (leave it empty) → Save; or remove both items → Save. | FE `prt-form.tsx:228-230`: `handleSubmit(onSubmit, () => scrollToFirstInvalidField())` is the only invalid-path handler (no toast). Schema fails correctly (`prt-form-schema.ts:29-32` product, `:41-44` unit, `:59-61` `items.min(1)`), but nothing renders it: the cells read `form.formState.errors` from a prop (`use-prt-item-table.tsx:98-99`, `:149-150`, same pattern as the React-Compiler / table trap in `routes/CLAUDE.md`) and no component reads the array-level `errors.items` for the empty case (`prt-item-fields.tsx`, `prt-form.tsx` have no `errors` hit). Not isolated further whether the cells fail to re-render or the errors never reach `formState`. |
| PR template Save clicked while the new row's Unit select is still loading fails silently | 310 TC-PRT-070006 (pinned, deterministic: the units request is held with `page.route`); TC-PRT-010001, TC-PRT-070001, TC-PRT-070004 hit the same race by timing and wait with `settleUnit` | After picking a product the Unit select shows a spinner, is disabled and already carries `aria-invalid=true` (stale error); the product's units come from `GET units/order/product/:id`. Save clicked in that window sends nothing and shows nothing; the select later shows KG but stays `aria-invalid` and a second Save is needed. Reproduced 3 of 4 runs with Save right after the pick (TC-PRT-070004 has no typing step), 0 of 6 once the spinner is gone. Expected: Save waits for / re-validates after the unit auto-fill, or tells the user. Not a missing value: the PR template picker passes a workflow id, so it uses the workflow lookup endpoint, whose flat rows `normalizeWorkflowProduct` (`hooks/use-products-by-location.ts:30-41`) turns into `inventory_unit: {id, name}` when `inventory_unit_id` is present (it is, for 11110003), so `setProductToItem` (`use-prt-item-table.tsx:58-63`) writes `requested_unit_id` synchronously at the pick. Why the submit is still refused in that window is not isolated. | Template → Edit → Add Item → pick a product → click Save at once. | FE `lookup-product-unit.tsx` (auto-fill effect + `isLoading` disable) racing `handleSubmit`; stale error because `setValue` in `setProductToItem` (`use-prt-item-table.tsx:50`) does not revalidate. Data is not the cause: 11110003 has the same KG order / inventory unit as 11110001. The three timing-sensitive cases wait for the select to settle (`settleUnit`); the race itself is pinned by TC-PRT-070006. |
| CN Create with an over-quantity line gives no feedback on submit | 601 TC-CN-020004 (`expectSilentlyBlocked`) | Expected: Create shows a validation signal. Actual: the quantity input is flagged `aria-invalid` live while typing (form is `mode: "onChange"`), but clicking Create adds no toast, no new signal and sends no request, and focus does not move. Whether the inline flag alone is acceptable is a product call. | CN from a GRN → Add Item → Return qty above the received qty → Create. | FE credit-note form submit invalid path (same class as the 310 row above; not located further). |

## 2. Needs product decision

| Cause | Specs / TC-IDs | Actual vs expected | Repro | FE/BE suspect |
| --- | --- | --- | --- | --- |
| Partial issue completes the SR | 701 TC-SR-120003 | Issuing 2 of 5 completes the SR (`doc_status completed`, issued 2 < approved 5); no remaining qty is tracked and the SR never stays In Progress. Is that intended? | Issue stage → issue less than approved. | BE `/approve` with `stage_role issue`; FE `use-sr-form-actions.ts` `handleIssue` has no partial path. |
| Price-list template saves with no product | 160 TC-PT-020002, TC-PT-030003 | No validation message; nothing blocks the write. Decide: require a product, or accept empty templates. | New template → Save with no product. | FE form validation. |
| No upper bound on a PR template `requested_qty` | 310 TC-PRT-070005 | `999999999999999` is accepted and stored. | Template line → enter a huge qty → Save. | FE schema has `min(0)` only; BE stores it. |

## 3. Findings without a TC

| Finding | Evidence | FE/BE suspect |
| --- | --- | --- |
| PR template create / update ignores `is_active` | POST with `is_active: false` and PUT `is_active: false` both read back `true`; the Status switch does not persist. TC-PRT-100002 (filter by status) therefore only asserts Active. | BE `service.create` / `update` never write it. |
| Gateway has no permission decorator on template / GRN / CN writes | See the 1a row; FC `POST /purchase-request-templates` returned 201. | BE gateway controllers. |
| Comment dialog has no permission gate at all | Cases 150002 / 160002 / 090002 were deleted for that reason. | `components/ui/comment-sheet.tsx`. |
| `data:reset` needs a CA chain | dev serves only the leaf cert (YE2 and Root YE are not sent), so bun fails "unable to verify the first certificate" unless `NODE_EXTRA_CA_CERTS` points at a bundle built from the AIA URLs. | dev server TLS config. |
| Period-close bugs carried from `_movement_play` (pinned in 916 / 919, **not run here**) | TC-PE-460003 (GRN void refused with `GRN_RECEIPT_ALREADY_CONSUMED` shows the generic toast), TC-PE-490005 (CN dated the first day of the active period → 422 `CREDIT_NOTE_DATE_NOT_CURRENT_PERIOD`), TC-PE-490008 (SO / SI without a date stored with no date), TC-PE-490009 (micro-report#19: report lookups follow the newest open period), TC-PE-490011 (#723: `v_inventory_eop_checklist.period`). | BE #724 follow-ups, micro-report#19, SQL PR #723, FE #216. All evidence dates from 2026-10-02. |

## 4. BE not deployed on dev

No `test.fail` carries this classification today. The two clusters that looked like it were checked against BE `main` and are **not** missing deployments: the PR Draft 400s (dev build `f529576a9` already contains the column) and the stock-replenishment 400s (FE and BE `main` disagree).
Whether dev lags BE `main` is unknown (the dev deploy workflow fails on billing; a manual SSH deploy may or may not have happened). After the next BE deploy, re-run these and drop the marker of any that turn "unexpectedly passed":

- 301 TC-PR-020001, 302 TC-PR-050503 / 050504, 311 TC-PR-080705 / 080706, 312 TC-PR-700003 (draft 400 cluster)
- 701 TC-SR-050004, TC-SR-090005, TC-SR-110004 (BE store-requisition paths)
- 303 TC-PR-060203, 304 TC-PR-070103 (workflow-stages)

## 5. Not verified in this environment

| Area | What did not run | Why |
| --- | --- | --- |
| Period close, irreversible steps | 918 (Start / submit count / Close), 921, 924, and 920 / 922 which depend on them; the TC-PE-340001 body. Only 900 (18 cases, Close mocked) and 910 TC-PE-400002 ran. | User decision 2026-11-22: reversible steps only; `E2E_ALLOW_IRREVERSIBLE` never set; real period state untouched. Dev AVG also holds 9 pending GRN + 3 pending SR from the doc-flows, which would block a real Start. |
| Period close, environment-gated | 912 / 914 / 916 / 920 (future period 2612), 917 / 919 / 922 / 923 (need `E2E_DB_URL`), 910 TC-PE-400001 / 400003. The 916 / 919 `test.fail` pins never executed. | Scenario period 2612 is in the future on dev; `E2E_DB_URL` is absent. |
| 910 TC-PE-400004 | skipped | AVG `si.cost-from` is `last_cost` vs the scenario average; Default Setting writes the admin's default BU (FIFO). |
| Inventory Adjustment, date-gated | 730: 10 of 12 cases data-skip (both BUs have 2026-11 closed and 2026-12 in the future; FE `90018c6d` bars future dates), so the commit-stock assertion never ran. `E2E_MOVEMENT_STRICT=1` turns the skip into a failure. | No BU period contains today. |
| SR Issue FIFO variant | 721 with `E2E_SRI_BU=FIFO` | FC is denied GRN create on the FIFO BU. |
| Stock checks | 721 / 730 / movement specs assert through the API (721 period proxy "tx dated inside active period"), not the database | `E2E_DB_URL` is missing. |
| Movement project | Opt-in (`test:movement`): 21 pass / 18 skip / 0 fail at Task 4b. Not part of the default run. | Needs `E2E_MOVEMENT=1` and the CARMEN-AVG / FIFO users. |

## 6. Side effects on shared dev BUs

| BU / data | Effect | Cleanup |
| --- | --- | --- |
| CARMEN-AVG | `movement:setup-workflows` (Task 4b) added **84 products** to the `general item` workflow and to `PO inherit-sig test`. | Backup `runs/movement/workflows-backup.json`; `restore` reverts (it skips the SR workflow if the backup predates it). |
| CARMEN-AVG | The movement doc-flows left 9 GRN + 3 SR pending. They block a real period Start. | Void / delete by hand. |
| CARMEN-AVG SR workflow | The SR workflow was renamed on dev (`ใช่ตัวนี้`). Specs find it by stage shape; `E2E_SR_WORKFLOW` overrides; the helper throws unless exactly one workflow matches. | — |
| TEST BU (`GR2VYNKQ`) | `701-sr` leaves finished and voided SRs (no delete API); 501 / 601 consume products. | `bun run data:reset --yes` before every run (it rebuilds the BU). |
| Credentials | `tests/helpers/movement-users.ts` has hardcoded dev passwords (pre-existing; dev accounts only). | Move to env if the suite ever targets a non-dev backend. |
