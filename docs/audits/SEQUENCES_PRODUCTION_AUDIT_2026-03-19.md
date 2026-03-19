# Sequences production audit — 2026-03-19

Evidence from repo at `origin/main` (branch `codex/sequences-truth-and-safe-fixes` baseline). **DB is truth**; **tenant** is `X-Customer-Id` (or client-mode fixed id via `api.ts`).

---

## 1. Executive summary

**Mounted Marketing Sequences** is a single large surface: `src/tabs/marketing/components/SequencesTab.tsx` (~9.2k lines), rendered from `MarketingHomePage` when `view === 'sequences'`. It is wrapped in `RequireActiveClient` and uses `useScopedCustomerSelection()` for `customerHeaders` / `selectedCustomerId`. The UI implements the full operator loop: sequence + **EmailCampaign** linking, steps CRUD, enrollments, send-queue preview/worker consoles, dry-run, audits, archive/unarchive, suppression checks, lead-source batch materialization, and templated AI tweak.

**Verdict:** The mounted screen is **real** and **deeply wired** to production APIs — not a stub. Complexity and density create **partial/misleading** spots (merged “sequence vs campaign” mental model, many panels, legacy parallel file). One **guardrail bug** was found: `scripts/self-test-sequences-archive-contract.mjs` pointed at **`src/components/MarketingSequencesTab.tsx`** (unused in nav) instead of the **mounted** `SequencesTab.tsx` — fixed in this run.

**Deferred:** Removing unused `MarketingSequencesTab.tsx` (not imported anywhere), broad UX simplification, schema/worker changes.

---

## 2. Mounted Sequences path

| Step | Location | Role |
|------|----------|------|
| App shell | `src/App.tsx` | `marketing-home` tab; `navigateToMarketing` supports `view: 'sequences'` |
| Marketing chrome | `src/tabs/marketing/MarketingHomePage.tsx` | `import SequencesTab from './components/SequencesTab'`; nav item `id: 'sequences'`, `content: <SequencesTab />` |
| Mounted UI | `src/tabs/marketing/components/SequencesTab.tsx` | All Sequences operator UX |
| Guardrails | Same file | `RequireActiveClient`, `useScopedCustomerSelection`, `api` auto-injects `X-Customer-Id` when not overridden |

**Deep-link:** `?tab=marketing-home&view=sequences` (and path-based tab if configured in `CRM_TOP_TABS`).

---

## 3. Frontend surface map

- **Core:** Sequence list with filters (`operatorQuickFilter`, search, status); create/edit sequence modal; step editor; link to **campaigns** (`EmailCampaign`) for list/templates/prospects/start/pause.
- **Enrollments:** List/create/pause/resume/cancel; per-enrollment queue, dry-run, audit, enqueue.
- **Send queue:** Preview (`/api/send-queue/preview`), item detail/render, patch/skip/retry (admin secret), bulk patch, tick (admin).
- **Send worker / operator:** console, sequence-readiness, preflight, launch-preview, run-history, preview-vs-outcome, exception-center, identity-capacity, queue-workbench, audits + CSV, dry-run + live-tick + sequence-test-send.
- **Supporting:** `GET /api/customers` (picker), `GET /api/campaigns`, `GET/PUT/POST/DELETE /api/sequences*`, `GET /api/lists/*`, `GET /api/sheets/sources/*/lists`, lead-source APIs, `GET /api/templates`, `GET /api/outlook/identities`, `POST /api/suppression/check`, `GET /api/reports/outreach`, `POST /api/templates/ai/tweak`.

**Parallel / legacy:** `src/components/MarketingSequencesTab.tsx` exists in tree but **is not imported** by `App.tsx` or `MarketingHomePage.tsx` — **drift risk** only.

---

## 4. Backend route map (mounted usage)

| Prefix | Router file | SequencesTab usage |
|--------|-------------|-------------------|
| `/api/sequences` | `server/src/routes/sequences.ts` | List (`includeArchived`), CRUD, steps, enrollments list/create, archive/unarchive, dry-run, etc. |
| `/api/campaigns` | `server/src/routes/campaigns.ts` (via mount) | Create/update/start/pause/prospects/templates |
| `/api/enrollments` | `server/src/routes/enrollments.ts` | CRUD ops as above |
| `/api/send-queue` | `server/src/routes/sendQueue.ts` | preview, items, render, patch, tick, retry/skip (admin) |
| `/api/send-worker` | `server/src/routes/sendWorker.ts` | console, readiness, preflight, launch-preview, run-history, dry-run, live-tick, test-send, audits, etc. |
| `/api/reports/outreach` | reports | outreach metrics panel |
| `/api/lists`, `/api/sheets/sources/...` | lists/sheets | lists + snapshot lists |
| `/api/templates`, `/api/outlook/identities` | templates/outlook | editor + senders |
| `/api/suppression/check` | suppression | start-flow checks |

**Tenant:** Routes use `requireCustomerId` / request context patterns consistent with rest of app; UI passes `X-Customer-Id` on sensitive calls and relies on `api.ts` default for others when an active client exists.

---

## 5. Current production-usability verdict

- **Strong:** Single place for sequence lifecycle + queue + worker visibility; curl snippets and route labels in UI aid ops; archive/unarchive wired to `POST /api/sequences/:id/archive|unarchive`.
- **Heavy:** One file carries “product” + “debug console” — high cognitive load; easy to misunderstand which panel is authoritative for “can I send?”.
- **Honest gap:** Operator must reconcile **Sequence** (definition) vs **Campaign** (sending container); UI reflects backend truth but the model is inherently two-headed.

---

## 6. What is fully working

- Mounted path and API wiring for list/detail/steps/campaign linkage.
- Enrollments + queue endpoints used with tenant headers.
- Send-queue preview/patch and worker diagnostics routes consumed as implemented.
- Archive/unarchive and `includeArchived` list query aligned with backend.

---

## 7. What is partial / misleading / broken

| Area | Assessment |
|------|------------|
| **Self-test archive contract** | **Broken guardrail:** tested wrong file (`MarketingSequencesTab` vs mounted `SequencesTab`) — **fixed** this run. |
| **Unused `MarketingSequencesTab.tsx`** | Misleading for contributors searching “Sequences UI”; safe removal **deferred** (separate tiny PR). |
| **Monolith file** | Partial — hard to reason about “minimum path” for new operators (documentation helps). |
| **Lead-source + sheets** | Partial — many paths; `api.ts` injects tenant for snapshot list GETs when client selected. |

---

## 8. Safe-fix candidates for this run

1. **Archive contract self-test → mounted file** — proven mismatch; zero product behavior change; restores CI truth.

---

## 8b. Selected fixes implemented (this run)

| Fix | Rationale |
|-----|-----------|
| `scripts/self-test-sequences-archive-contract.mjs`: point `uiFile` at `src/tabs/marketing/components/SequencesTab.tsx` | Mounted Sequences is the real archive/unarchive UX; previous path validated an unmounted legacy file. |

Strings checked (`Show archived`, `Archive`, `Unarchive`) still exist in mounted file (verified via search).

---

## 9. Deferred larger issues

- Remove or archive `src/components/MarketingSequencesTab.tsx` if product confirms no external entry.
- UX: split operator vs diagnostics (product direction).
- Any send-engine semantics changes (worker, tick, limits) — needs explicit ops/product sign-off.
- Schema / migration work — out of scope.

---

*Audit completed: 2026-03-19. Repo: ODCRM.*
