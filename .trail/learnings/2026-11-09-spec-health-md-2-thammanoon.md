---
title: SPEC-HEALTH.md มี 2 คอลัมน์ที่ต้องอ่านคู่กัน
author: Thammanoon
date: 2026-11-09
id: l-4953042d
scope: repo
status: active
touches:
  - docs/test-cases/SPEC-HEALTH.md
---

## Decided
`docs/test-cases/SPEC-HEALTH.md` (สร้างด้วย `bun audit:spec-health`) แยกการ "ไม่รัน" เป็น 2 แบบ
และ **ต้องอ่านทั้งสองคอลัมน์** ไม่งั้นจะสรุปผิดว่าสเปกสุขภาพดี

| คอลัมน์ | นับอะไร | AST เห็นตอนไหน |
|---|---|---|
| Skip / Fixme / Dormant | `adminTest.skip("TC-...", {...}, fn)` — ประกาศไม่รัน | ตอน parse |
| **Guarded** | `adminTest.skip(cond, "reason")` ที่อยู่ **ใน body** | ตอน parse แต่ผลจริงตัดสินตอนรัน |

Guard ที่เป็นจริงเสมอ = เคสที่ไม่เคยรันและ **reporter ยังรายงานว่าเขียว**

ตัวอย่างที่ยืนยันแล้ว (2026-09-20): `304-pr-purchaser-journey.spec.ts` dormant **0%**
แต่ guarded 22 — `itemRow(i)` หา Vendor/Unit Price ในแถวที่ยังหุบ ทั้งที่ฟิลด์อยู่ใน
`expandedContent` ⇒ `TC-PR-070302..070305` skip ทุกรอบ
ทั้งสูท 223 เคสอยู่หลัง guard · 302/303/304/402 dormant 0% แต่ guarded 21–26

## Watch out
ก่อนบอกว่าสเปกไหน "ครอบแล้ว" ให้ดู guarded ด้วยเสมอ ถ้าสูงให้เปิดไฟล์
ดูว่าเงื่อนไข guard เป็นจริงตลอดหรือไม่ (มักมาจาก page object ที่ล้าสมัย — ดู
project_vendor_prodcat_page_objects_stale และ reference_playwright_hang_traps)

pre-commit ตรวจความสดของไฟล์นี้ผ่าน lefthook 3 คำสั่ง (`audit-specs` / `audit-catalogs` /
`audit-generators`) — glob ของ lefthook **ไม่ brace-expand** จึงต้องแยกคำสั่งต่อ path

_From Claude Code's memory of this repo, last updated Sep 20._
