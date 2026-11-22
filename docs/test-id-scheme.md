# Test ID Scheme

Format: `TC-<PREFIX>-XXYYYY` where `XX` = section block (01–99), `YYYY` = sequence within section (0001–9999).

Strict regex: `^TC-[A-Z]{2,5}-\d{6}$`

## Section block template

| Block | Purpose |
|-------|---------|
| 01 | List / Search / Filter |
| 02 | Detail / View |
| 03 | Create |
| 04 | Edit / Update |
| 05 | Delete |
| 06–09 | Sub-journeys (Creator / Approver / Purchaser / Returned, etc.) |
| 10–19 | Security / Authorization |
| 20–29 | Validation |
| 30–39 | Integration / External |
| 40–89 | Module-specific |
| 90–99 | Edge cases / experimental |

## Module catalog

| Spec file | Prefix | Sections used | Notes |
|-----------|--------|---------------|-------|
| `001-login.spec.ts` | `LOGIN` | 01, 10–19 | Login flows + security |
| `002-spa-smoke.spec.ts` | `SPA` | 01 | Cross-section smoke (covers the React SPA port) |
| `010-department.spec.ts` | `DEP` | 01, 03–05, 10, 20 | CRUD + security |
| `020-unit.spec.ts` | `UN` | 01, 03–05, 10, 20 | CRUD + security |
| `029-business-type.spec.ts` | `BT` | 01, 03–05, 10, 20 | CRUD + security |
| `030-extra-cost.spec.ts` | `EC` | 01, 03–05, 10, 20 | CRUD + security |
| `031-adjustment-type.spec.ts` | `AT` | 01, 03–05, 10, 20 | CRUD + security |
| `032-credit-term.spec.ts` | `CT` | 01, 03–05, 10, 20 | CRUD + security |
| `040-currency.spec.ts` | `CUR` | 01, 03–05, 10, 20 | CRUD + security |
| `041-exchange-rate.spec.ts` | `ER` | 01–02, 10 | List/Detail + security |
| `042-tax-profile.spec.ts` | `TP` | 01, 03–05, 10, 20 | CRUD + security |
| `043-certification.spec.ts` | `CERT` | 01, 03–05, 10, 20 | CRUD + security |
| `044-eco.spec.ts` | `ECO` | 01, 03–05, 10, 20 | CRUD + security |
| `081-chart-of-account-mapping.spec.ts` | `ACMAP` | 01, 10, 40, 90 | List/Search/Tabs + security |
| `082-chart-of-accounts.spec.ts` | `COA` | 01–05, 10, 20, 30, 90 | CRUD + validation |
| `083-shelf.spec.ts` | `SHLF` | 01–05, 10, 20, 30, 90 | Smoke + error-state stubs (backend endpoint pending) |
| `110-op-category.spec.ts` | `OPCAT` | 01–05, 10, 20, 90 | CRUD + security |
| `111-cuisine.spec.ts` | `CUIS` | 01–05, 10, 20, 90 | CRUD + validation |
| `079-delivery-point.spec.ts` | `DP` | 01, 03–05, 10–19, 20 | CRUD + security |
| `080-location.spec.ts` | `LOC` | 01, 03–05, 10, 20 | CRUD + security |
| `101-product-category.spec.ts` | `CAT` | 01–15, 20–29, 90 | Multi-prefix collapse (CATEG/PRODU/RECIP) |
| `121-recipe-equipment-category.spec.ts` | `RECC` | 01–05, 10, 20, 90 | CRUD + security (graduated draft — runtime-unverified) |
| `131-equipment-category.spec.ts` | `EQPC` | 01–05, 10, 20, 90 | CRUD + security (graduated draft — runtime-unverified) |
| `150-vendor.spec.ts` | `VEN` | 01, 03–05, 10–19, 20 | CRUD + security |
| `159-pl.spec.ts` | `PL` | 01–08, 90 | CRUD + sub-journeys + edge cases |
| `160-pl-template.spec.ts` | `PT` | 01–06, 20, 90 | CRUD + sub-journeys + edge cases |
| `201-my-approvals.spec.ts` | `MA` | 01–06, 90 | CRUD + edge cases |
| `301-pr.spec.ts` | `PR` | 01–09, 10–13, 20–22, 30–39, 40–49, 60–63, 70, 90 | Module entry point + sub-journeys (05–08); 70 = movement doc flow (`312-pr-doc-flow.spec.ts`) |
| `310-pr-template.spec.ts` | `PRT` | 01–11, 20–29, 90 | CRUD + validation |
| `401-po.spec.ts` | `PO` | 01–07, 10–19, 20–29, 30–39, 70, 90 | Module entry point + sub-journeys (06–07); 70 = movement doc flow (`404-po-doc-flow.spec.ts`) |
| `501-grn.spec.ts` | `GRN` | 01–18, 70, 90 | CRUD + sub-journeys + security + edge cases; 70 = movement doc flow (`502-grn-doc-flow.spec.ts`) |
| `601-cn.spec.ts` | `CN` | 01–11, 20–29, 30–39, 50–54, 70, 90 | CRUD + validation + integration; 70 = movement doc flow (`603-cn-doc-flow.spec.ts`) |
| `602-cn-reason.spec.ts` | `CNR` | 01, 03–05, 10, 20 | CRUD + security |
| `801-ap-invoice.spec.ts` | `APINV` | 01–04, 10, 20, 40 | Accounting AP invoice on TEST BU: list, detail, create, edit, validation, posting (JV), void, viewer permissions |
| `802-ap-doc-types.spec.ts` | `APDOC` | 01–03 | Accounting AP deposit (01), debit note (02), credit note (03) on TEST BU: create, posting (JV signs), read set |
| `805-ap-from-grn.spec.ts` | `APGRN` | 01–04 | GRN -> AP invoice auto-creation (`ap_auto_from_grn`): switch on (01), off (02), GRN-side header edit voids and re-issues (03), setting restored (04) |
| `701-sr.spec.ts` | `SR` | 01–12, 70, 90 | CRUD + sub-journeys + security + edge cases; 70 = movement doc flow (`702-sr-doc-flow.spec.ts`) |
| `720-stock-issue.spec.ts` | `SI` | 01–06, 70–71, 90 | CRUD + sub-journeys + edge cases; 70–71 = movement SR → Issue flow, AVG / FIFO (`721-sr-issue-doc-flow.spec.ts`) |
| `730-inventory-adjustment-doc-flow.spec.ts` | `IADJ` | 01–06, 10, 20, 30, 70–71, 90 | Movement doc flow: 70 = Stock In, 71 = Stock Out; the rest are open cases in `test-cases/gaps/730-inventory-adjustment-gap.md` |
| `900-period-end.spec.ts` | `PE` | 01–04, 31–34, 40–42, 44, 46–54, 90 | CRUD + integration + edge cases; 40–54 = movement period-close phases (`910`–`924-period-close-*.spec.ts`, one section per phase; 43 and 45 were p03-only regressions, dropped) |
| `1001-campaign.spec.ts` | `CAM` | 01–10, 90 | CRUD + sub-journeys + edge cases |
| `710-wastage-reporting.spec.ts` | `WAST` | 01–05, 10, 20, 90 | Lot-based wastage read-only |
| `711-stock-replenishment.spec.ts` | `SRPL` | 01–02, 06, 10, 30, 90 | Replenishment + PR/SR wizard |

## Documented-only test-case catalogs (no spec yet)

These prefixes are reserved by hand-authored test-case catalogs in [`test-cases/`](test-cases/) — coverage gaps that do not yet have an automated spec (including the entire Platform / System-Admin module). `bun audit:tc-ids` scans these catalogs too and **fails on their findings**, same as for specs. It reported them as warnings while the pre-existing drift was being cleared; that finished on 2026-09-20 and the audit has been at zero findings since, so a finding now means something new broke. `bun audit:tc-ids:lenient` downgrades them to warnings for local spelunking. When a catalog graduates into a spec, move its row into the **Module catalog** table above **and delete the catalog** — or, if the spec covers only part of it, keep the remainder as a gap report under [`test-cases/gaps/`](test-cases/gaps/), which reuses the spec's own prefix and needs no row of its own — leaving both makes two files own the same IDs, which the audit reports as a cross-file duplicate.

| Catalog doc | Prefix | Area | Sections used |
|-------------|--------|------|---------------|
| `test-cases/100-product.md` | `PROD` | Product Management | 01–05, 10, 20, 40, 90 |
| `test-cases/120-recipe.md` | `RCP` | Operation Plan | 01–05, 10, 20, 40–44 |
| `test-cases/130-equipment.md` | `EQP` | Operation Plan | 01–05, 10, 20, 40–42 |
| `test-cases/740-stock-transaction.md` | `STKT` | Inventory Management | 01–03, 10, 90 |
| `test-cases/750-physical-count.md` | `PCNT` | Inventory Management | 01, 03–08, 10, 20, 90 |
| `test-cases/760-spot-check.md` | `SPC` | Inventory Management | 01, 03, 06–07, 10, 20 |
| `test-cases/1002-external-price-list.md` | `EPL` | Vendor Management | 01, 04, 10, 20, 30, 90 |
| `test-cases/1101-role.md` | `ROLE` | Platform / System Admin | 01–05, 10, 20, 40 |
| `test-cases/1102-user.md` | `USR` | Platform / System Admin | 01–02, 04–05, 10, 20, 40 |
| `test-cases/1103-workflow.md` | `WF` | Platform / System Admin | 01–05, 10, 20, 40, 90 |
| `test-cases/1104-notification-template.md` | `NTPL` | Platform / System Admin | 01–05, 10, 20 |
| `test-cases/1105-system-period.md` | `SPER` | Platform / System Admin | 01–05, 10, 20, 30, 90 |
| `test-cases/1106-user-activity.md` | `UACT` | Platform / System Admin | 01–02, 04, 10, 30 |
| `test-cases/1107-document.md` | `DOC` | Platform / System Admin | 01, 03, 05, 10, 20, 90 |
| `test-cases/1109-activity-log.md` | `ALOG` | Platform / System Admin | 01–02, 04, 10, 30 |
| `test-cases/1110-running-code.md` | `RUNC` | Platform / System Admin | 01, 03–05, 10, 20, 30 |
| `test-cases/1112-dashboard-dataset.md` | `DDS` | Platform / System Admin | 01–02, 09–10 |
| `test-cases/1200-dashboard.md` | `DASH` | Cross-cutting | 01–05, 09–10 |
| `test-cases/1201-profile.md` | `PROF` | Cross-cutting | 01–05, 10, 20 |
| `test-cases/1202-report.md` | `RPT` | Cross-cutting | 01–05, 10, 20 |
| `test-cases/1203-notifications.md` | `NTFY` | Cross-cutting | 01–02, 04, 09–10 |
| `test-cases/1204-section-landing.md` | `LAND` | Cross-cutting | 01, 10, 40, 90 |

| `test-cases/1114-company-profile.md` | `COMP` | Platform / System Admin | 01–02, 04, 10, 20, 40, 90 |
| `test-cases/1115-default-setting.md` | `DSET` | Platform / System Admin | 01–02, 04, 10, 30, 40, 90 |
| `test-cases/1116-email-profile.md` | `EPROF` | Platform / System Admin | 01, 03–05, 10, 20, 30, 40, 90 |
| `test-cases/1117-email-template.md` | `ETPL` | Platform / System Admin | 01, 03–05, 10, 20, 30, 40, 90 |
| `test-cases/1118-interface.md` | `INTF` | Platform / System Admin | 01–02, 04, 10, 40, 90 |
| `test-cases/003-register.md` | `REG` | Auth (public) | 01–03, 10, 20, 30, 40, 90 |
| `test-cases/004-invitation.md` | `INVT` | Auth (public) | 01–03, 10, 20, 30, 40, 90 |
| `test-cases/005-password-recovery.md` | `PWD` | Auth (public) | 01–04, 10, 20, 30, 90 |
| `test-cases/006-legal.md` | `LEGAL` | Auth (public) | 01–02, 10, 40, 90 |

## Adding a new module

1. Pick a unique 2–5 letter prefix not already in the table.
2. Add the row above with the section blocks you intend to use.
3. Commit the catalog change with the spec that introduces the prefix.
4. The audit script reads this table; an unknown prefix or unregistered section will fail CI.

## Adding a section to an existing module

1. Edit the row's "Sections used" column.
2. Commit alongside the new tests.
