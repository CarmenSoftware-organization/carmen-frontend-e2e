---
title: "ชุดปิดงวดบน TEST BU ปิดงวดเดือนก่อนจาก reset แบบมีประวัติที่ไม่ seed เอกสาร แล้วต้อง reset ปกติก่อนรันชุดหลัก"
author: Thammanoon
date: 2026-11-24
branch: test/e2e-period-close-test-bu
id: l-eed4bc47
scope: repo
status: active
replaces: l-2863f9ae
src: agent
touches:
  - ".gemini/settings.json"
  - ".github/copilot-instructions.md"
  - ".kiro/settings/mcp.json"
  - ".kiro/steering/trail.md"
  - AGENTS.md
  - GEMINI.md
  - opencode.json
  - scripts/data-reset/README.md
  - scripts/data-reset/cli.ts
  - scripts/data-reset/index.ts
---

## Decided
2026-11-24 ผู้ใช้เลือก: reset แบบ opt-in เปิดงวดเดือนก่อนเป็นงวดแรก (งวดปัจจุบันของ backend = งวดเปิดที่เก่าสุด) ชุดปิดงวดปิดงวดนั้น ส่วน reset แบบนี้ **ไม่ seed เอกสารของชุดหลักเลย** (seed แค่ master/บัญชี/role + สินค้าเฉพาะชุดปิดงวด) จบแล้ว reset ปกติอีกครั้งก่อนรันชุดหลัก

## Tried and ruled out
- ปิดงวดเดือนนี้จริงแล้ว reset ตาม: ชุดหลักพังจนกว่าจะ reset
- reset ทุกครั้งเปิดงวดย้อนหลัง: ชุดหลักเห็นงวดปัจจุบันเป็นเดือนก่อน
- seed เอกสารชุดหลักลงเดือนนี้ขณะงวดเดือนก่อนยังเป็นงวดปัจจุบัน: probe จริงพบใบลดหนี้ลงได้เฉพาะงวดปัจจุบัน (422 "dated inside the current period") และปฏิทินหน้าจอเปิดให้เลือกแค่วันของงวดปัจจุบัน
- seed เอกสารลงเดือนก่อน: เอกสารค้าง (GRN saved, SR รออนุมัติ) จะขวางการเริ่ม/ปิดงวดของชุดเอง
- seed เอกสารหลังปิดงวดโดยไม่ล้าง tenant: --skip-reset ไม่ยอมเมื่อ BU มี PR อยู่ ต้องเขียนเพิ่มมาก

## Watch out
- probe 24 พ.ย.: สร้างงวดย้อนหลังบน BU ว่างได้, GRN ลงวันที่เดือนก่อนและวันนี้ commit ผ่าน API ได้ (งวดเปิดทั้งคู่)
- เอกสารที่ลงวันที่นอกงวดปัจจุบันทำผ่านหน้าจอไม่ได้ ต้องยิง API
- รันชุดปิดงวดได้ 1 รอบต่อการ reset 1 ครั้ง ต่อ BU

In the code: `bun run data:reset --yes --bu <BU> --with-history` (ห้าม --bu all / ไม่ระบุ --bu) · `scripts/movement/probe-period-history.ts --bu <BU>` · env `E2E_PERIOD_BU` · design docs/superpowers/specs/2026-11-24-e2e-period-close-on-test-bus-design.md
