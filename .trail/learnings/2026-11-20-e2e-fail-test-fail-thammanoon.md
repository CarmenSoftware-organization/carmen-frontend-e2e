---
title: E2E ที่ข้ามตัวเองเมื่อหาปุ่มไม่เจอ ทำให้เทสต์ตามแอปไม่ทันโดยไม่มีใครรู้ — ซ่อมโดยให้ fail จริง และแยกบั๊กด้วย test.fail
author: Thammanoon
date: 2026-11-20
branch: chore/e2e-catchup-phase-0
id: l-3bc1b5cd
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
  - docs/superpowers/specs/2026-11-20-e2e-catchup-phase-0-1-design.md
  - docs/superpowers/plans/2026-11-20-e2e-catchup-phase-0-1.md
---

## Decided
- 2026-11-20 ผู้ใช้เลือกซ่อม e2e ทั้งชุด (เฟส 0 วัดผล, เฟส 1 ซ่อม 47 โมดูลเดิม, เฟส 2–4 เพิ่ม spec ให้โมดูลที่ยังไม่มี)
- หลักเมื่อเทสต์แดงเพราะแอปทำงานต่างไป: ถ้าโยงไปหา commit/PR ที่ตั้งใจเปลี่ยนได้ → แก้เทสต์; ถ้าดูเป็นบั๊ก → `test.fail(true, "suspected bug: ...")` แล้วรวมเป็นรายการให้ผู้ใช้ตัดสิน; BE ที่ merge แล้วแต่ยังไม่ขึ้น dev → `test.fail` ด้วยเหตุผล "BE not deployed on dev" ไม่นับเป็นบั๊ก
- ทดสอบกับ dev ตามสภาพที่ deploy อยู่ ไม่ deploy BE ก่อน
- BU TEST (GR2VYNKQ) ไม่มีคนอื่นใช้ สั่ง data:reset ได้ทุกกลุ่มโดยไม่ต้องถาม; period close บน BU movement ยังต้องถามก่อน

## Tried and ruled out
- ซ่อมไล่ทีละไฟล์ตามเลข: UI ที่เปลี่ยนทั้งแอปจะถูกแก้ซ้ำหลายแบบ → แก้ page object ของกลางก่อน
- แตก subagent รันหลายโมดูลพร้อมกัน: workers:1 มีเหตุผล (state ร่วม + login rate limit) รันพร้อมกันบน DB dev ได้ผลแดงแบบสุ่ม

## Watch out
- pattern `if (!(await x.isVisible().catch(() => false))) test.skip()` ทำให้ UI เปลี่ยนแล้วเทสต์ "ข้าม" เขียวแทนแดง — รายงาน 4 พ.ย. นับได้ 248 เคสหลัง guard แบบนี้ และ 285 เคสที่รันแต่ไม่มี assert เลย ห้ามเขียน guard แบบนี้ใหม่; guard ที่ยอมให้มีคือขึ้นกับข้อมูล/ชนิด BU พร้อมเหตุผล
- `tests/results/*.json` ถูก git track รันแล้วไฟล์จะเปลี่ยน — ตั้งใจให้ commit
- dev server ที่ค้างอยู่บน :3000 ถูก reuse (reuseExistingServer) — ตรวจ cwd ของ process ก่อนเชื่อผลรัน

In the code:
- design: docs/superpowers/specs/2026-11-20-e2e-catchup-phase-0-1-design.md
- plan: docs/superpowers/plans/2026-11-20-e2e-catchup-phase-0-1.md
- รายงาน: bun audit:spec-health / bun audit:coverage (--check ตรวจว่ายังไม่เก่า)
