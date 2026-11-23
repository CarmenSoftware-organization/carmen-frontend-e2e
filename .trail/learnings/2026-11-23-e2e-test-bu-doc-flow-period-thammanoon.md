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
เมื่อ backend รับเอกสาร Stock In/Out ที่ควรถูกปฏิเสธ (qty/cost ติดลบ, qty 0) เทสจัดการตามผลของ commit ที่วัดได้จริง:
(a) ไม่มีผลสต๊อก → ไม่ void, ติดป้าย description "E2E-IA 732 accepted-bad" แล้ว cleanup ปล่อยไว้;
(b) มีผลสต๊อก → void แล้วยืนยันว่า on-hand กลับเท่าค่าก่อน commit ถ้าไม่กลับ ถือเป็นบั๊กแยกอีกข้อ (void-symmetry)
cleanup จะ throw ถ้า void ในเคสล้มเหลว ไม่ปล่อยให้สต๊อกรั่วเงียบ ๆ
23 พ.ย. 2026 มี BU ทดสอบบน dev สามตัว แยกตามวิธีคิดต้นทุน:
TEST BU (AVG) = BU-GR2VYNKQ (เดิม GR2VYNKQ, รหัสเดิมตอบ 403 แล้ว), TEST BU (FIFO) = BU-96EAT3GX, TEST BU (AVG-LOCATION) = BU-0706T34Y (Average per location)
เคสที่ผลขึ้นกับวิธีคิดต้นทุนควรรันครบทั้งสาม BU

## Tried and ruled out
- ย้ายแค่ doc-flow แล้วปล่อย period-close ไว้บน CARMEN-AVG/FIFO (ทางที่แนะนำ): user ไม่เอา อยากให้ทุกชุดอยู่ BU เดียว
- สร้าง BU ทดสอบชุดที่ 2 (AVG + FIFO) ไว้ให้ period-close: ไม่เอา เพราะเป็นงานใหญ่และต้องมี BU ใหม่ฝั่ง backend
ลงเอกสาร Stock In ชดเชย ("drift-fix") เพื่อดึงยอดกลับ: เลิกแล้ว เพราะเป็นการซ่อนบั๊ก และทิ้งเอกสารจริงไว้บน TEST BU ที่ทุกชุดใช้ร่วมกัน

## Watch out
- TEST BU คิดต้นทุนแบบ average อย่างเดียว เคส FIFO (period-close และบางส่วนของ 502/721) จึงรันไม่ได้ ให้ทำเป็น skip/gap พร้อมเหตุผล อย่าลบทิ้ง
- period-close ปิดงวดจริง ชุดหลักทุกตัวต้องมีงวดเปิดที่ครอบคลุมวันนี้ ต้องรันแยกแบบ opt-in แล้ว data:reset ตามหลังทุกครั้ง

In the code: playwright.config.ts (projects movement / period-close, E2E_MOVEMENT, E2E_PERIOD_CLOSE), tests/movement-users.ts, tests/test-users.ts BU_CODE = GR2VYNKQ, tests/*-doc-flow.spec.ts, tests/9xx-period-close-*.spec.ts
ใบ accepted-bad ที่ไม่มีผลสต๊อกจะค้างอยู่ไม่กี่ใบต่อรอบจนกว่าจะ data:reset ซึ่งไม่กระทบเทส เพราะทุกเคสเทียบ delta จากค่าที่อ่านสดตอนรัน
ยอดมูลค่าใน ledger อัปเดตช้ากว่าสถานะเอกสาร ต้องอ่าน delta ผ่าน expect.poll เสมอ

In the code: tests/helpers/ia-api.ts (cleanupIaRun, leakedBad), tests/732-inventory-adjustment-stock.spec.ts, bug list docs/*inventory-adjustment-bug-list.md
- รหัส BU ถูกใช้ประกอบ URL ของ API ทุกเส้น (/api/<code>/..., /api/config/<code>/...) เปลี่ยนรหัสบน dev = เทสทั้งชุดพังทันที ต้องแก้ค่าคงที่และ fixture ของ data:reset ตาม
- 23 พ.ย. ตอนเปิดใช้: BU-96EAT3GX ยังไม่มีสินค้า, BU-0706T34Y ตอบ 503
- dev :4001 ไม่ส่ง intermediate cert (Let's Encrypt YE2) → Bun/Node ขึ้น "unable to verify the first certificate" ทำให้ data:reset รันไม่ได้ ส่วน curl บน macOS ผ่าน แก้ที่ server ให้เสิร์ฟ fullchain

In the code: tests/test-users.ts BU_CODE, scripts/data-reset/fixtures/workflows.json bu_code, scripts/data-reset/workflow-template.ts, tests/helpers/bu-api.ts
