---
title: "รีเซ็ต TEST BU ใหม่ติดกฎ backend 3 ข้อที่ BU AVG ไม่เคยเจอ"
author: Thammanoon
date: 2026-11-23
branch: test/e2e-doc-flow-test-bu
id: l-8e9bbccf
scope: repo
status: active
src: agent
touches:
  - ".gemini/settings.json"
  - ".github/copilot-instructions.md"
  - ".kiro/settings/mcp.json"
  - ".kiro/steering/trail.md"
  - AGENTS.md
  - GEMINI.md
  - opencode.json
  - scripts/data-reset/docs/doc-flow.ts
  - scripts/data-reset/docs/pos.ts
  - scripts/data-reset/roles.ts
---

## Decided
- สร้าง application role ทีละชุด (POST ใส่ permission 20 ตัวแรก แล้ว PUT เพิ่มทีละ 20) เพราะ backend เขียน permission ทีละแถวใน interactive transaction ที่จำกัด 5 วินาที role Purchase ที่ใหญ่ที่สุดหมดเวลาที่ 5025 ms แล้วตอบ 400 "expired transaction"
- บน BU FIFO ลง stock-in ตั้งต้นของ POS วันนี้แทนวันต้นงวด เพราะ FIFO ตอบ 422 กับ stock-in ที่ลงวันก่อนใบรับล่าสุดของสินค้า/location เดียวกันในงวด และขั้น stock รับสินค้าตัวเดียวกันไปแล้ววันนี้ ส่วน BU AVG ยังลงวันต้นงวดเหมือนเดิม (141 อ่าน BU นั้น)
ผู้ใช้เลือก (24 พ.ย.) ให้ oracle ของเคส FIFO หา lot ที่ยังเปิดอยู่ด้วยการ replay: เรียงแถวรับ (in_qty > 0) เก่าไปใหม่ตาม lot_at_date และ lot_index แล้วหักยอด out_qty รวมของ location ออกจาก lot เก่าสุดก่อน ที่เหลือคือ lot ที่เปิดอยู่ แล้วค่อยคิดต้นทุนการจ่าย

## Watch out
- lookup `products-location-workflow/:from/:to/:workflow` ส่งกลับทีละ 10 แถว และตอบ 400 ถ้าขอ perpage มากกว่า 100 หรือ -1 การตรวจว่ามีสินค้าครบให้กรองด้วย `?search=<prefix>` ห้ามอ่านแค่หน้าแรก
- ใน product detail, `locations[].id` คือ id ของแถวผูก ไม่ใช่ id ของ location ต้องใช้ `locations[].location.id`

In the code: scripts/data-reset/roles.ts (PERMISSION_CHUNK, addPermissions) · scripts/data-reset/docs/pos.ts (fifo → ctx.today) · scripts/data-reset/docs/doc-flow.ts (lookup ?search=E2E-DF)
วิธีนี้ถือว่าการจ่ายครั้งก่อน ๆ ตัดแบบ FIFO ถูกแล้ว ถ้า backend ตัดผิดตั้งแต่ก่อนหน้า ค่าที่คาดไว้จะคลาดไปด้วย ซึ่งเคสก่อนหน้าควรจับได้อยู่แล้ว ถ้าเคส FIFO แดงที่ต้นทุน ให้ไล่ที่สมุด cost_layers ก่อนจะไปปรับ oracle

In the code: GET /api/<bu>/inventory-info/:product/:location?at_date= → data.cost_layers (ledger: in_qty, out_qty, balance_qty, lot_no, lot_index, lot_at_date, cost_per_unit) · tests/helpers/costing.ts

## Tried and ruled out
- จับคู่แถวจ่ายกับ lot ด้วย lot_no: ใช้ไม่ได้ เพราะแถวจ่าย (SR, transfer_out) ได้ lot_no ใหม่ที่ไม่โยงกลับไปหา lot ที่ถูกตัด
- ตรวจแค่โครงสร้าง (แถวจ่ายใช้ cost ของ lot ที่มีอยู่จริง): ไม่เลือก เพราะจับบั๊กตัดผิด lot ไม่ได้
- ขอ endpoint lot จาก backend: แม่นที่สุด แต่ต้องแก้ข้ามรีโป จึงพักไว้
