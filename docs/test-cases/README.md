# Test-Case Catalogs

Stakeholder-friendly **test-case documentation** for the carmen-frontend app. These are **specification documents only** — they describe what each test case verifies (preconditions / steps / expected) but are **not yet automated Playwright specs**. They were authored by reading the actual React route modules, so every case is grounded in real UI fields, columns, filters, and flows.

Each file follows the TC-ID scheme in [`../test-id-scheme.md`](../test-id-scheme.md): `TC-<PREFIX>-<SS><NNNN>` (SS = section block, NNNN = sequence). Titles / preconditions / steps / expected are in Thai (matching the suite); Priority and Test Type are in English.

> **Relationship to `docs/user-stories/`:** that folder holds the **generated** stakeholder views of modules that already have automated specs (login, config master-data, vendor, PR/PO/GRN/CN/SR suites, etc.). This folder (`docs/test-cases/`) holds **hand-authored catalogs for modules that do not yet have a spec** — i.e. the coverage gap, including the entire Platform / System-Admin module. To graduate any catalog into an automated spec, register its prefix in `../test-id-scheme.md` first (the audit gate scans specs only, so these catalogs do not affect CI today).

**Totals:** 39 catalogs · 1377 documented test cases (plus 40 gap reports · 1511 cases in [`gaps/`](gaps/)).

> **`gaps/`** holds the remainder of a catalog whose module has since gained a spec: only the cases the spec does **not** cover. It reuses the spec's own prefix, so it needs no row in the TC-ID scheme. Delete a case from there once it is automated, and delete the file when it empties.
>
> **Is the suite actually testing?** [`SPEC-HEALTH.md`](SPEC-HEALTH.md) counts, per spec, how many cases run rather than how many exist — plus the ones that run without asserting anything. `COVERAGE.md` says a module has a spec; this says whether that spec checks anything. Refresh with `bun audit:spec-health`.
>
> **Where the gaps are:** [`COVERAGE.md`](COVERAGE.md) is the generated matrix of every frontend route against the spec or catalog that covers it — 102 modules, and it names the ones with neither. It also lists catalogs whose declared route the app no longer serves. Refresh it with `bun audit:coverage` (or `bun audit:coverage:check` in CI); never edit it by hand. The tables below stay as the human-readable index of what each catalog contains.

## Platform / System Admin (the "platform module")

| Doc | Module | Prefix | URL | TCs |
| --- | --- | --- | --- | --- |
| [1101-role.md](1101-role.md) | Role & Permissions | `ROLE` | `/system-admin/role` | 27 |
| [1102-user.md](1102-user.md) | User Management | `USR` | `/system-admin/user` | 26 |
| [1103-workflow.md](1103-workflow.md) | Workflow Configuration | `WF` | `/system-admin/workflow` | 30 |
| [1104-notification-template.md](1104-notification-template.md) | Notification Template | `NTPL` | `/system-admin/notification-template` | 26 |
| [1105-system-period.md](1105-system-period.md) | System Period | `SPER` | `/system-admin/period` | 27 |
| [1106-user-activity.md](1106-user-activity.md) | User Activity (audit) | `UACT` | `/system-admin/user-activity` | 16 |
| [1107-document.md](1107-document.md) | Document Repository | `DOC` | `/system-admin/document` | 18 |
| [1108-query-dataset.md](1108-query-dataset.md) | Query Dataset (SQL Workbench) | `QDS` | `/system-admin/query-dataset` | 21 |
| [1109-activity-log.md](1109-activity-log.md) | Activity Log (audit) | `ALOG` | `/system-admin/activity-log` | 18 |
| [1110-running-code.md](1110-running-code.md) | Running Code (sequences) | `RUNC` | `/system-admin/running-code` | 19 |
| [1111-config-email.md](1111-config-email.md) | Config Email (SMTP) | `CEML` | `/system-admin/config-email` | 14 |
| [1112-dashboard-dataset.md](1112-dashboard-dataset.md) | Dashboard Dataset | `DDS` | `/system-admin/dashboard-dataset` | 13 |

## Inventory Management

| Doc | Module | Prefix | URL | TCs |
| --- | --- | --- | --- | --- |
| [gaps/730-inventory-adjustment-gap.md](gaps/730-inventory-adjustment-gap.md) | Inventory Adjustment — gap report (spec: `tests/730-inventory-adjustment-doc-flow.spec.ts`, movement suite) | `IADJ` | `/inventory-management/inventory-adjustment` | 60 |
| [740-stock-transaction.md](740-stock-transaction.md) | Stock Transaction / Movement | `STKT` | `/inventory-management/transaction` | 22 |
| [750-physical-count.md](750-physical-count.md) | Physical Count | `PCNT` | `/inventory-management/physical-count` | 33 |
| [760-spot-check.md](760-spot-check.md) | Spot Check | `SPC` | `/inventory-management/spot-check` | 32 |

## Operation Plan

| Doc | Module | Prefix | URL | TCs |
| --- | --- | --- | --- | --- |
| [110-op-category.md](110-op-category.md) | Operation Plan — Category | `OPCAT` | `/operation-plan/category` | 16 |
| [111-cuisine.md](111-cuisine.md) | Cuisine Type | `CUIS` | `/operation-plan/cuisine` | 15 |
| [120-recipe.md](120-recipe.md) | Recipe | `RCP` | `/operation-plan/recipe` | 28 |
| [121-recipe-equipment-category.md](121-recipe-equipment-category.md) | Recipe Equipment Category | `RECC` | `/operation-plan/recipe-equipment-category` | 13 |
| [130-equipment.md](130-equipment.md) | Equipment | `EQP` | `/operation-plan/equipment` | 18 |
| [131-equipment-category.md](131-equipment-category.md) | Equipment Category | `EQPC` | `/operation-plan/equipment-category` | 14 |

## Store Operation

| Doc | Module | Prefix | URL | TCs |
| --- | --- | --- | --- | --- |
| [710-wastage-reporting.md](710-wastage-reporting.md) | Wastage Reporting | `WAST` | `/store-operation/wastage-reporting` | 26 |
| [711-stock-replenishment.md](711-stock-replenishment.md) | Stock Replenishment | `SRPL` | `/store-operation/stock-replenishment` | 23 |

_(Store Requisition is already covered by the automated `701-sr` spec.)_

## Product Management

| Doc | Module | Prefix | URL | TCs |
| --- | --- | --- | --- | --- |
| [100-product.md](100-product.md) | Product | `PROD` | `/product-management/product` | 30 |

_(Product Category is already covered by the automated `101-product-category` spec.)_

## Vendor Management

| Doc | Module | Prefix | URL | TCs |
| --- | --- | --- | --- | --- |
| [1002-external-price-list.md](1002-external-price-list.md) | External Price List (public vendor portal) | `EPL` | `/external/pl/:url_token` | 22 |

_(Vendor, Price List, Price List Template, and Request-for-Pricing/Campaign are already covered by the automated `150-vendor` / `159-pl` / `160-pl-template` / `1001-campaign` specs. This catalog covers the **external vendor-facing** side of the price-list request, which has no spec.)_

## Cross-cutting

| Doc | Module | Prefix | URL | TCs |
| --- | --- | --- | --- | --- |
| [1200-dashboard.md](1200-dashboard.md) | Dashboard | `DASH` | `/dashboard` | 16 |
| [1201-profile.md](1201-profile.md) | Profile & Settings | `PROF` | `/profile` | 18 |
| [1202-report.md](1202-report.md) | Report | `RPT` | `/report` | 16 |
| [1203-notifications.md](1203-notifications.md) | Notifications | `NTFY` | `/notifications` | 14 |
| [1204-section-landing.md](1204-section-landing.md) | Section landing pages & 404 | `LAND` | section `/…` landings + Not-Found | 16 |

## Already covered by automated specs

See [`../user-stories/`](../user-stories/) for the generated catalogs of modules that already have Playwright specs: Login, SPA smoke, the 14 config master-data modules (Department, Unit, Business Type, Extra Cost, Adjustment Type, Credit Term, Currency, Exchange Rate, Tax Profile, Certification, ECO, Delivery Point, Location, Credit Note Reason), Product Category, Vendor, Price List, Price List Template, My Approvals, Purchase Request (+ creator/approver/purchaser/returned journeys & template), Purchase Order (+ journeys), Goods Receive Note, Credit Note, Store Requisition, Stock Issue, Period End, and Campaign.
