# Sequences handover — 2026-03-19

## 1. What was audited

- Mounted path: `MarketingHomePage` → `SequencesTab.tsx`.
- Backend: `/api/sequences`, `/api/campaigns`, `/api/enrollments`, `/api/send-queue`, `/api/send-worker`, plus templates, lists, sheets, suppression, reports as used by the tab.
- Guardrail scripts touching Sequences.

## 2. What was proven

- Single mounted Sequences surface; `RequireActiveClient` + scoped customer selection.
- Archive/unarchive and `includeArchived` align with `server/src/routes/sequences.ts`.
- `self-test-sequences-archive-contract.mjs` was validating the **wrong** UI file; it now targets **`src/tabs/marketing/components/SequencesTab.tsx`**.

## 3. What safe fixes were completed

- Updated `scripts/self-test-sequences-archive-contract.mjs` to use the mounted Sequences component path.
- Added `docs/audits/SEQUENCES_PRODUCTION_AUDIT_2026-03-19.md` (source of truth for routes/mount).

## 4. What remains deferred

- ~~Optional removal of unused `src/components/MarketingSequencesTab.tsx`~~ **Done** — file removed after grep proved zero imports.
- Any Sequences UX split / simplification (product).
- Deeper worker/send policy changes (ops/product).

## 5. Current Sequences production truth

- Operators use **Marketing → Sequences** → `SequencesTab.tsx`.
- Truth for sending state is **campaign + queue + worker** APIs, not the sequence row alone.

## 6. Recommended next Sequences/product step

- ~~Legacy `MarketingSequencesTab.tsx`~~ **Removed** — only mounted `SequencesTab.tsx` remains.

## 7. Recommended next repo/ops step

- Run `npm run test:sequences-archive-contract` in CI or before releases (now points at mounted UI).
- After merge, run `prod-check` with merge SHA.

---

*Handover: 2026-03-19.*
