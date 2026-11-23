---
title: "เทส e2e ทุกชุดต้องรันบน TEST BU เดียว รวมทั้ง doc-flow และ period-close"
author: Thammanoon
date: 2026-11-23
branch: test/e2e-inventory-adjustment
id: l-3e0a234a
scope: repo
status: active
src: agent
touches:
  - ".gemini/settings.json"
  - ".github/copilot-instructions.md"
  - ".kiro/settings/mcp.json"
  - ".kiro/steering/trail.md"
  - AGENTS.md
  - CLAUDE.md
  - GEMINI.md
  - docs/superpowers/specs/2026-11-23-e2e-inventory-adjustment-bug-list.md
  - opencode.json
  - tests/731-inventory-adjustment.spec.ts
---

## Decided
ย้ายเทสที่ยังรันบน CARMEN-AVG / CARMEN-FIFO ทั้งหมด (doc-flow 6 ไฟล์ ราว 49 เคส และ period-close 14 ไฟล์ ราว 76 เคส) มารันบน TEST BU เดียว ต่อจากที่ย้าย Inventory Adjustment 730 → 731 ไปแล้ว เพื่อให้ข้อมูลทุกเทสอยู่บน BU ที่ data:reset คุมได้ (user ตัดสิน 23 พ.ย. 2026)

## Tried and ruled out
- ย้ายแค่ doc-flow แล้วปล่อย period-close ไว้บน CARMEN-AVG/FIFO (ทางที่แนะนำ): user ไม่เอา อยากให้ทุกชุดอยู่ BU เดียว
- สร้าง BU ทดสอบชุดที่ 2 (AVG + FIFO) ไว้ให้ period-close: ไม่เอา เพราะเป็นงานใหญ่และต้องมี BU ใหม่ฝั่ง backend

## Watch out
- TEST BU คิดต้นทุนแบบ average อย่างเดียว เคส FIFO (period-close และบางส่วนของ 502/721) จึงรันไม่ได้ ให้ทำเป็น skip/gap พร้อมเหตุผล อย่าลบทิ้ง
- period-close ปิดงวดจริง ชุดหลักทุกตัวต้องมีงวดเปิดที่ครอบคลุมวันนี้ ต้องรันแยกแบบ opt-in แล้ว data:reset ตามหลังทุกครั้ง

In the code: playwright.config.ts (projects movement / period-close, E2E_MOVEMENT, E2E_PERIOD_CLOSE), tests/movement-users.ts, tests/test-users.ts BU_CODE = GR2VYNKQ, tests/*-doc-flow.spec.ts, tests/9xx-period-close-*.spec.ts
