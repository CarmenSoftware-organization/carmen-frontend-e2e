# Persona Docs

Persona- and journey-oriented source documentation for the Carmen Blue app. Each area folder describes how a persona moves through a module: screens, key fields/columns, actions, validation, and the test cases that cover each step.

These complement two other layers:
- **`../test-cases/`** — per-module test-case catalogs (TC-ID, preconditions, steps, expected).
- **`../user-stories/`** — per-module "As a / I want / so that" views (generated from specs where they exist; hand-authored from the catalogs otherwise).

## Areas

### Procurement (original, spec-backed)
- [Purchase Request/](Purchase%20Request/) — Creator, Approver, Purchaser, Dashboard journeys
- [Purchase Order/](Purchase%20Order/) — Purchaser, Approver journeys
- [System Process/](System%20Process/) — transaction/process flows: GRN, CRN, SR, issues, sales, stock-in/out adjustments, spot-check, physical stocktake, period close, wastage, inventory-update, lot management, cost calculation

### Platform / System Admin
- [Platform Administration/](Platform%20Administration/) — **Platform Administrator**: roles & permissions, user assignment, workflow configuration
- [Platform Operations/](Platform%20Operations/) — notification templates, system periods, audit logs (user-activity + activity-log)
- [Platform Data & Config/](Platform%20Data%20%26%20Config/) — query dataset (SQL workbench), document repository, running code, config email, dashboard dataset, signature config

### Operational modules
- [Inventory Management/](Inventory%20Management/) — **Inventory Controller**: inventory adjustment, stock transaction ledger, physical count, spot check
- [Operation Plan/](Operation%20Plan/) — **Operation Planner**: recipe build (ingredients/yield/cost/compliance) + culinary/equipment master data
- [Store Operation/](Store%20Operation/) — **Store Manager**: wastage reporting, stock replenishment (cross-links to the SR spec)
- [Product Management/](Product%20Management/) — **Product Manager**: product master maintenance
- [General & Reporting/](General%20%26%20Reporting/) — **Any authenticated user**: dashboard, profile & settings, report, notifications

> The Procurement areas are the original, spec-backed personas. The Platform and Operational areas were authored alongside the test-case catalogs for modules that do not yet have an automated spec — grounded by reading the React route source, not generated.
