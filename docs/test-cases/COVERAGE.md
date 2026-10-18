# Coverage Matrix — routes ↔ specs ↔ catalogs

**Generated file — do not edit.** Run `bun audit:coverage` to refresh.

Parsed from the frontend router (`routes/router.tsx`): **190 routes** across **114 modules**.

> **What `spec` means here:** a spec names the module's URL, in its own file or in a page object it imports. A spec that reaches a route only by *clicking* — never by `goto()` — is invisible to this matcher, so the route reads as uncovered. `/procurement/purchase-request/from-template` is the known case: `302-pr-creator-journey` drives it through `selectFirstTemplate()`, which clicks a card. Check the spec before concluding a gap is real.

| Status | Meaning | Modules |
| --- | --- | --- |
| ✅ spec | an automated Playwright spec drives this module | 47 |
| 📄 catalog | a hand-authored test-case catalog documents it, no spec yet | 40 |
| ❌ none | neither — this is the coverage gap | 27 |

## *

| Module | Routes | Spec | Catalog | Status |
| --- | --- | --- | --- | --- |
| `/*` | 1 | — | `1204-section-landing.md` | 📄 catalog |

## Accounting

| Module | Routes | Spec | Catalog | Status |
| --- | --- | --- | --- | --- |
| `/accounting` | 14 | — | — | ❌ none |
| `/accounting/accounts-payable` | 1 | — | — | ❌ none |
| `/accounting/accounts-payable/invoice` | 2 | — | — | ❌ none |
| `/accounting/accounts-payable/payment` | 2 | — | — | ❌ none |
| `/accounting/accounts-payable/payment-approvals` | 1 _(redirect → `/accounting/accounts-payable/payment?lifecycle=submitted`)_ | — | — | ❌ none |
| `/accounting/accounts-receivable/invoice` | 2 | — | — | ❌ none |
| `/accounting/journal-voucher` | 2 | — | — | ❌ none |

## Config (master data)

| Module | Routes | Spec | Catalog | Status |
| --- | --- | --- | --- | --- |
| `/config` | 1 | `002-spa-smoke.spec.ts` | `1204-section-landing.md` | ✅ spec |
| `/config/account-grouping` | 1 | — | — | ❌ none |
| `/config/account-mapping` | 1 _(redirect → `/config/chart-of-account-mapping`)_ | `081-chart-of-account-mapping.spec.ts` | — | ✅ spec |
| `/config/adjustment-type` | 1 | `031-adjustment-type.spec.ts` | — | ✅ spec |
| `/config/asset-category` | 1 | — | — | ❌ none |
| `/config/bank-account` | 1 | — | — | ❌ none |
| `/config/business-type` | 1 | `029-business-type.spec.ts` | — | ✅ spec |
| `/config/chart-of-account-mapping` | 1 | `081-chart-of-account-mapping.spec.ts` | — | ✅ spec |
| `/config/chart-of-accounts` | 3 | `082-chart-of-accounts.spec.ts` | — | ✅ spec |
| `/config/cost-center` | 1 | — | — | ❌ none |
| `/config/cost-center-group` | 1 | — | — | ❌ none |
| `/config/credit-note-reason` | 1 | `602-cn-reason.spec.ts` | — | ✅ spec |
| `/config/credit-term` | 1 | `032-credit-term.spec.ts` | — | ✅ spec |
| `/config/currency` | 1 | `040-currency.spec.ts` | — | ✅ spec |
| `/config/delivery-point` | 1 | `079-delivery-point.spec.ts` | — | ✅ spec |
| `/config/department` | 3 | `002-spa-smoke.spec.ts`<br>`010-department.spec.ts` | — | ✅ spec |
| `/config/dimension` | 1 | — | — | ❌ none |
| `/config/exchange-rate` | 1 | `041-exchange-rate.spec.ts` | — | ✅ spec |
| `/config/extra-cost` | 1 | `030-extra-cost.spec.ts` | — | ✅ spec |
| `/config/gl-period` | 1 | — | — | ❌ none |
| `/config/jv-prefix` | 1 | — | — | ❌ none |
| `/config/location` | 3 | `080-location.spec.ts` | — | ✅ spec |
| `/config/payment-type` | 1 | — | — | ❌ none |
| `/config/shelf` | 1 | `083-shelf.spec.ts` | — | ✅ spec |
| `/config/tax-profile` | 1 | `042-tax-profile.spec.ts` | — | ✅ spec |
| `/config/title-master` | 1 | — | — | ❌ none |
| `/config/unit` | 1 | `002-spa-smoke.spec.ts`<br>`020-unit.spec.ts` | — | ✅ spec |
| `/config/wht-form` | 1 | — | — | ❌ none |
| `/config/wht-service-type` | 1 | — | — | ❌ none |

## Dashboard

| Module | Routes | Spec | Catalog | Status |
| --- | --- | --- | --- | --- |
| `/dashboard` | 1 | `001-login.spec.ts`<br>`002-spa-smoke.spec.ts` | `1200-dashboard.md`<br>`1204-section-landing.md` | ✅ spec |

## design-system

| Module | Routes | Spec | Catalog | Status |
| --- | --- | --- | --- | --- |
| `/design-system` | 1 | — | — | ❌ none |

## forgot-password

| Module | Routes | Spec | Catalog | Status |
| --- | --- | --- | --- | --- |
| `/forgot-password` | 1 | — | `005-password-recovery.md` | 📄 catalog |

## Inventory Management

| Module | Routes | Spec | Catalog | Status |
| --- | --- | --- | --- | --- |
| `/inventory-management` | 1 | — | `1204-section-landing.md` | 📄 catalog |
| `/inventory-management/inventory-adjustment` | 3 | — | — | ❌ none |
| `/inventory-management/period-end` | 2 | `900-period-end.spec.ts`<br>`914-period-close-out-of-period-docs.spec.ts`<br>`918-period-close-start.spec.ts`<br>`920-period-close-close-gate.spec.ts`<br>_+2 more_ | — | ✅ spec |
| `/inventory-management/physical-count` | 5 | — | `750-physical-count.md` | 📄 catalog |
| `/inventory-management/spot-check` | 4 | — | `760-spot-check.md` | 📄 catalog |
| `/inventory-management/transaction` | 1 | — | `740-stock-transaction.md` | 📄 catalog |

## invitations

| Module | Routes | Spec | Catalog | Status |
| --- | --- | --- | --- | --- |
| `/invitations` | 2 | — | `004-invitation.md` | 📄 catalog |

## login

| Module | Routes | Spec | Catalog | Status |
| --- | --- | --- | --- | --- |
| `/login` | 1 | `001-login.spec.ts` | — | ✅ spec |
| `/login/callback` | 1 | — | — | ❌ none |

## notifications

| Module | Routes | Spec | Catalog | Status |
| --- | --- | --- | --- | --- |
| `/notifications` | 1 | `002-spa-smoke.spec.ts` | `1203-notifications.md` | ✅ spec |

## Operation Plan

| Module | Routes | Spec | Catalog | Status |
| --- | --- | --- | --- | --- |
| `/operation-plan` | 1 | — | `1204-section-landing.md` | 📄 catalog |
| `/operation-plan/category` | 3 | `110-op-category.spec.ts` | — | ✅ spec |
| `/operation-plan/cuisine` | 3 | `111-cuisine.spec.ts` | — | ✅ spec |
| `/operation-plan/equipment` | 3 | — | `130-equipment.md` | 📄 catalog |
| `/operation-plan/equipment-category` | 1 | `131-equipment-category.spec.ts` | — | ✅ spec |
| `/operation-plan/recipe` | 4 | — | `120-recipe.md` | 📄 catalog |
| `/operation-plan/recipe-equipment-category` | 1 | `121-recipe-equipment-category.spec.ts` | — | ✅ spec |

## pl

| Module | Routes | Spec | Catalog | Status |
| --- | --- | --- | --- | --- |
| `/pl` | 1 | — | `1002-external-price-list.md` | 📄 catalog |

## privacy

| Module | Routes | Spec | Catalog | Status |
| --- | --- | --- | --- | --- |
| `/privacy` | 1 | — | `006-legal.md` | 📄 catalog |

## Procurement

| Module | Routes | Spec | Catalog | Status |
| --- | --- | --- | --- | --- |
| `/procurement` | 1 | `002-spa-smoke.spec.ts` | `1204-section-landing.md` | ✅ spec |
| `/procurement/approval` | 1 _(redirect → `/procurement/my-approval`)_ | `002-spa-smoke.spec.ts`<br>`201-my-approvals.spec.ts`<br>`303-pr-approver-journey.spec.ts` | — | ✅ spec |
| `/procurement/credit-note` | 3 | `002-spa-smoke.spec.ts`<br>`601-cn.spec.ts`<br>`603-cn-doc-flow.spec.ts` | — | ✅ spec |
| `/procurement/goods-receive-note` | 3 | `002-spa-smoke.spec.ts`<br>`501-grn.spec.ts`<br>`710-wastage-reporting.spec.ts` | — | ✅ spec |
| `/procurement/goods-receive-note/from-po` | 1 | — | — | ❌ none |
| `/procurement/my-approval` | 1 | `002-spa-smoke.spec.ts`<br>`201-my-approvals.spec.ts`<br>`303-pr-approver-journey.spec.ts` | — | ✅ spec |
| `/procurement/purchase-order` | 3 | `002-spa-smoke.spec.ts`<br>`401-po.spec.ts`<br>`402-po-purchaser-journey.spec.ts`<br>`403-po-approver-journey.spec.ts`<br>_+3 more_ | — | ✅ spec |
| `/procurement/purchase-order/from-pr` | 1 | — | — | ❌ none |
| `/procurement/purchase-order/from-price-list` | 1 | — | — | ❌ none |
| `/procurement/purchase-request` | 3 | `002-spa-smoke.spec.ts`<br>`201-my-approvals.spec.ts`<br>`301-pr.spec.ts`<br>`302-pr-creator-journey.spec.ts`<br>_+5 more_ | — | ✅ spec |
| `/procurement/purchase-request-template` | 3 | `002-spa-smoke.spec.ts`<br>`310-pr-template.spec.ts` | — | ✅ spec |
| `/procurement/purchase-request/from-template` | 1 | — | — | ❌ none |

## Product Management

| Module | Routes | Spec | Catalog | Status |
| --- | --- | --- | --- | --- |
| `/product-management` | 1 | — | `1204-section-landing.md` | 📄 catalog |
| `/product-management/category` | 1 | `101-product-category.spec.ts` | — | ✅ spec |
| `/product-management/eco` | 1 | `044-eco.spec.ts` | — | ✅ spec |
| `/product-management/product` | 3 | — | `100-product.md` | 📄 catalog |

## Profile

| Module | Routes | Spec | Catalog | Status |
| --- | --- | --- | --- | --- |
| `/profile` | 1 | `002-spa-smoke.spec.ts` | `1201-profile.md` | ✅ spec |
| `/profile/setting` | 1 | — | `1201-profile.md` | 📄 catalog |

## register

| Module | Routes | Spec | Catalog | Status |
| --- | --- | --- | --- | --- |
| `/register` | 1 | — | `003-register.md` | 📄 catalog |
| `/register/verify` | 1 | — | `003-register.md` | 📄 catalog |

## Report

| Module | Routes | Spec | Catalog | Status |
| --- | --- | --- | --- | --- |
| `/report` | 1 | — | `1202-report.md` | 📄 catalog |
| `/report/history` | 1 | — | `1202-report.md` | 📄 catalog |
| `/report/list` | 1 | `002-spa-smoke.spec.ts` | `1202-report.md` | ✅ spec |
| `/report/schedules` | 1 | — | `1202-report.md` | 📄 catalog |

## reset-password

| Module | Routes | Spec | Catalog | Status |
| --- | --- | --- | --- | --- |
| `/reset-password` | 1 | — | `005-password-recovery.md` | 📄 catalog |

## Store Operation

| Module | Routes | Spec | Catalog | Status |
| --- | --- | --- | --- | --- |
| `/store-operation` | 1 | — | `1204-section-landing.md` | 📄 catalog |
| `/store-operation/stock-replenishment` | 1 | `711-stock-replenishment.spec.ts` | — | ✅ spec |
| `/store-operation/store-requisition` | 3 | `701-sr.spec.ts`<br>`702-sr-doc-flow.spec.ts`<br>`720-stock-issue.spec.ts`<br>`721-sr-issue-doc-flow.spec.ts`<br>_+1 more_ | — | ✅ spec |
| `/store-operation/wastage-reporting` | 1 | `710-wastage-reporting.spec.ts` | — | ✅ spec |

## Platform / System Admin

| Module | Routes | Spec | Catalog | Status |
| --- | --- | --- | --- | --- |
| `/system-admin` | 1 | — | `1204-section-landing.md` | 📄 catalog |
| `/system-admin/activity-log` | 1 | — | `1109-activity-log.md` | 📄 catalog |
| `/system-admin/business-setting` | 1 _(redirect → `/system-admin/company-profile`)_ | — | `1114-company-profile.md` | 📄 catalog |
| `/system-admin/company-profile` | 1 | — | `1114-company-profile.md` | 📄 catalog |
| `/system-admin/dashboard-dataset` | 1 | — | `1112-dashboard-dataset.md` | 📄 catalog |
| `/system-admin/default-setting` | 1 | `910-period-close-prestep.spec.ts` | `1115-default-setting.md` | ✅ spec |
| `/system-admin/document` | 1 | — | `1107-document.md` | 📄 catalog |
| `/system-admin/email-profile` | 1 | — | `1116-email-profile.md` | 📄 catalog |
| `/system-admin/email-template` | 1 | — | `1117-email-template.md` | 📄 catalog |
| `/system-admin/interface` | 2 | — | `1118-interface.md` | 📄 catalog |
| `/system-admin/interface/accounting/external` | 1 _(redirect → `/system-admin/interface/export/external`)_ | — | — | ❌ none |
| `/system-admin/inventory-period` | 1 | — | `1105-system-period.md` | 📄 catalog |
| `/system-admin/notification-template` | 3 | — | `1104-notification-template.md` | 📄 catalog |
| `/system-admin/period` | 1 _(redirect → `/system-admin/inventory-period`)_ | — | `1105-system-period.md` | 📄 catalog |
| `/system-admin/role` | 3 | — | `1101-role.md` | 📄 catalog |
| `/system-admin/running-code` | 1 | — | `1110-running-code.md` | 📄 catalog |
| `/system-admin/user` | 2 | `910-period-close-prestep.spec.ts` | `1102-user.md` | ✅ spec |
| `/system-admin/user-activity` | 1 | — | `1106-user-activity.md` | 📄 catalog |
| `/system-admin/workflow` | 6 | — | `1103-workflow.md` | 📄 catalog |

## terms

| Module | Routes | Spec | Catalog | Status |
| --- | --- | --- | --- | --- |
| `/terms` | 1 | — | `006-legal.md` | 📄 catalog |

## Vendor Management

| Module | Routes | Spec | Catalog | Status |
| --- | --- | --- | --- | --- |
| `/vendor-management` | 1 | — | `1204-section-landing.md` | 📄 catalog |
| `/vendor-management/certification` | 1 | `043-certification.spec.ts` | — | ✅ spec |
| `/vendor-management/price-list` | 3 | `159-pl.spec.ts` | — | ✅ spec |
| `/vendor-management/price-list-template` | 3 | `160-pl-template.spec.ts` | — | ✅ spec |
| `/vendor-management/request-price-list` | 3 | `1001-campaign.spec.ts` | — | ✅ spec |
| `/vendor-management/vendor` | 3 | `150-vendor.spec.ts` | — | ✅ spec |
