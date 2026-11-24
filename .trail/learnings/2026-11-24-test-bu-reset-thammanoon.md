---
title: "ชุดทดสอบปิดงวดบน TEST BU ปิดงวดเดือนก่อน ไม่ปิดเดือนนี้ — reset แบบมีประวัติเปิดงวดย้อนหลังให้"
author: Thammanoon
date: 2026-11-24
branch: test/e2e-period-close-test-bu
id: l-2863f9ae
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
---

## Decided
2026-11-24 ผู้ใช้เลือก: ชุดปิดงวด 910–924 ย้ายลง TEST BU ทั้งสาม โดย reset แบบ opt-in เปิดงวดเดือนก่อนเป็นงวดแรก (งวดปัจจุบันของ backend = งวดเปิดที่เก่าสุด) เทสปิดงวดนั้น แล้วงวดปัจจุบันจะกลับมาเป็นเดือนนี้เอง ชุดหลักรันต่อได้โดยไม่ต้อง reset ซ้ำ — รันชุดปิดงวดได้ 1 รอบต่อการ reset 1 ครั้ง ต่อ BU

## Tried and ruled out
- ปิดงวดเดือนนี้จริงแล้ว reset ตาม: ชุดหลักพังจนกว่าจะ reset (เอกสารวันนี้ตกงวดที่ปิด) และรันสลับกันไม่ได้
- ให้ reset ทุกครั้งเปิดงวดย้อนหลัง: ชุดหลักเห็นงวดปัจจุบันเป็นเดือนก่อน spec ที่อิงงวดปัจจุบัน (900, physical count, seed ที่ลงวันแรกของงวด) เพี้ยน

## Watch out
- สร้างงวดด้วยมือได้เฉพาะตอน BU ไม่มีงวดเลย จึงต้องทำทันทีหลัง reset
- ยังไม่ได้ยืนยันกับ backend จริงว่ารับงวดย้อนหลัง และ commit เอกสารเดือนนี้ได้ขณะงวดเดือนก่อนยังเป็นงวดปัจจุบัน — Task 1 ของ plan เป็น probe หยุดรอ
- ด่านวันที่ของ phase เดิมข้ามเคสเมื่องวดไม่ครอบวันนี้ ต้องเปลี่ยนเป็นข้ามเฉพาะงวดในอนาคต ไม่งั้นข้ามทั้งชุดเงียบ ๆ

In the code: design docs/superpowers/specs/2026-11-24-e2e-period-close-on-test-bus-design.md · plan docs/superpowers/plans/2026-11-24-e2e-period-close-on-test-bus.md · flag ที่จะเพิ่ม `data:reset --bu <BU> --with-history` · env `E2E_PERIOD_BU`
