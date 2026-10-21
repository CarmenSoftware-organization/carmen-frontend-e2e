---
version: 1.0.0
last_updated: 2026-04-26
changelog:
  - 1.0.0 | 2026-04-26 | Initial draft
---

# Process 01 — Inventory Update

**What this process does:** Adjusts the quantity on hand (QOH) at an inventory location when a transaction posts. It is the most fundamental process in the system — every transaction except End Period Close's snapshot step changes at least one location's QOH.

---

## P1 Overview (Business Layer)

When a transaction is confirmed, the system immediately updates the quantity recorded at the relevant storage location. The update is always location-specific — Carmen Blue tracks QOH per product per location, not as a single warehouse-wide figure.

**Simple example — GRN arriving 50 units of Product A at Location WH-01:**

| | Before | After |
|---|---|---|
| Product A · WH-01 QOH | 100 | 150 |
| Product A · WH-02 QOH | 30 | 30 (unchanged) |

---

## P2 Rules (Business Analyst Layer)

### Trigger Conditions

| Transaction | Direction | Location Type(s) Affected |
|---|---|---|
| GRN | +qty | Inventory |
| CRN | −qty | Inventory |
| SR | −qty source / +qty destination | Inventory (source) → Direct or Consignment (dest) |
| Issues | −qty | Inventory |
| Sales | −qty | Inventory |
| Stock In (adj) | +qty | Inventory |
| Stock Out (adj) | −qty | Inventory |
| Physical Stocktake | ±qty (variance only) | Inventory |
| End Period Close | snapshot (no net change) | All |

### Decision Table — Direction and Scope

| Condition | Outcome |
|---|---|
| Transaction adds stock (GRN, Stock In adj) | QOH increases at the receiving inventory location |
| Transaction removes stock (CRN, Issues, Sales, Stock Out adj) | QOH decreases at the source inventory location |
| SR (internal transfer) | QOH decreases at inventory source; QOH increases at direct/consignment destination |
| Physical Stocktake has no variance | QOH unchanged |
| Physical Stocktake has positive variance | QOH increases (system had less than actual) |
| Physical Stocktake has negative variance | QOH decreases (system had more than actual) |
| End Period Close | No change to current QOH; a period snapshot is recorded separately |

### Sequence — When Does This Run?

Inventory Update runs **immediately on transaction confirmation** (not on draft or pending states). For Physical Stocktake, the update runs when the stocktake count is submitted and approved.

---

## P3 System Behaviour (Developer Layer)

### Input Contract

| Input | Source |
|---|---|
| Product ID | Transaction line item |
| Location ID | Transaction line item (source) and/or destination |
| Quantity delta | Transaction line item qty (positive or negative) |
| Transaction type | Determines direction and whether lot management also runs |

### Output Contract

| Output | Where it lands |
|---|---|
| Updated QOH record | `inventory_balance` table (product × location) |
| Transaction journal entry | `inventory_transaction_log` |

### Sequencing with Other Processes

1. **Inventory Update** — posts the qty delta first
2. **Lot Management** — updates lot records at the affected inventory location(s)
3. **Cost Calculation** — recalculates unit cost using updated qty (if triggered)

For SR: steps 1 and 2 run at the source inventory location only. Cost Calculation is **not triggered** — goods move at existing cost.

### What This Process Does NOT Do

- Does not validate that QOH will go negative (that is a separate pre-confirmation check)
- Does not calculate cost (that is Process 03)
- Does not track lot numbers (that is Process 02)
- Does not lock or snapshot periods (that is Process 03 / tx-09)

---

## P4 Open Questions / Confirmed Answers

| # | Question | Answer | Source |
|---|---|---|---|
| 1 | Can QOH go negative? | TBC — pre-confirmation check behaviour not yet verified | — |
| 2 | Does Direct location QOH show in the same inventory balance view? | TBC | — |
| 3 | Is the End Period snapshot a separate record type or a flag on the balance? | TBC | — |

---

## Related Documents

→ [INDEX.md](INDEX.md) — transaction × process matrix  
→ [proc-02-lot-management.md](proc-02-lot-management.md) — lot updates that follow inventory update  
→ [proc-03-cost-calculation.md](proc-03-cost-calculation.md) — cost recalculation triggered after qty change  
→ [tx-03-sr.md](tx-03-sr.md) — SR: the only transaction where Inventory Update runs but Cost Calculation does not
