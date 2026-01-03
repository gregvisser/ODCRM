### OpenDoors CRM — Agent Charter

This repo uses a **multi-agent** workflow inside Cursor. Each agent owns a bounded set of files and is responsible for delivering changes only within that boundary unless the Project Manager (PM) explicitly coordinates an exception.

---

### Agent list

- **OpenDoors CRM – Project Manager (PM)**: orchestration, delegation, review, merge, prioritization (does not implement tab logic).
- **Customers Agent (OpenDoors Customers)**: Customers top-level tab placeholder + future Customers module.
- **Sales Agent (OpenDoors Sales)**: Sales top-level tab placeholder + future Sales module.
- **Marketing Agent (OpenDoors Marketing)**: Marketing top-level tab placeholder + future Marketing module.
- **Operations Agent (Operations)**: Operations top-level tab placeholder + future Operations module.
- **Onboarding Agent (Onboarding)**: Onboarding top-level tab placeholder + future Onboarding module.
- **UI Agent**: UI shell, layout, sidebar/nav rendering, shared UI components/styling.
- **Sync/Integrity Agent**: shared contracts/types, nav schema, cross-tab consistency, regression prevention.

---

### Responsibilities (high-level)

- **Tab agents**:
  - Own the **placeholder page** for their tab and tab-local module structure.
  - Do not modify shared contracts, shared layout, or other tabs.
- **UI Agent**:
  - Owns the **app shell** (sidebar + header + content frame) and shared UI components.
  - Does not implement business logic.
- **Sync/Integrity Agent**:
  - Owns the **single source of truth** for tab IDs/labels/owners (and optional future paths).
  - Ensures compile-time alignment between nav + pages.

---

### File ownership map (scaffolding phase)

#### Shared contracts (Sync/Integrity Agent only)

- `src/contracts/**`
  - Example: `src/contracts/nav.ts`

#### Shared UI / layout (UI Agent only)

- `src/layout/**`
- `src/components/nav/**`
- Shared placeholder renderer (if used):
  - `src/components/PlaceholderPage.tsx`
- Shared styling:
  - `src/theme.ts`, `src/App.css`, `src/index.css`

#### Tab modules (tab agents only)

- **Customers Agent**: `src/tabs/customers/**`
- **Sales Agent**: `src/tabs/sales/**`
- **Marketing Agent**: `src/tabs/marketing/**`
- **Operations Agent**: `src/tabs/operations/**`
- **Onboarding Agent**: `src/tabs/onboarding/**`

#### Integration touchpoints (coordinated by PM)

- `src/App.tsx`
  - Temporary integration point (until shell/contract are fully extracted).
  - Changes must be coordinated between **UI Agent** (rendering/layout) and **Sync/Integrity Agent** (nav contract wiring).

---

### Collaboration protocol (MANDATORY)

All agent messages must follow this structure:

- **Owned files:** (list)
- **Touched files:** (list)
- **Not touching:** (explicitly list shared files unless approved)
- **Plan:** (bullet steps)
- **Assumptions:** (bullets)
- **Risks:** (bullets)
- **Definition of done:** (bullets)
- **PR-ready checklist:** (bullets)

If a tab agent needs a shared type or nav contract change, they must **request it from Sync/Integrity Agent** (copy/paste the request into that agent’s thread).

---

### Definition of done (scaffolding)

- Sidebar shows a visible list of top-level tabs:
  - OpenDoors Customers
  - OpenDoors Sales
  - OpenDoors Marketing
  - Operations
  - Onboarding
- Each tab renders a placeholder page:
  - Title
  - “Coming soon”
  - Owner agent name
- No backend changes; no functional features; no new business logic.
- Build passes (`npm run build`).

---

### How to add a new tab/agent (standard process)

1. **PM**: create a new Cursor thread for the new agent and paste the agent SYSTEM PROMPT.
2. **New tab agent**: propose owned file paths under `src/tabs/<tab>/` and a placeholder page.
3. **Sync/Integrity Agent**: add the new tab to the shared nav contract in `src/contracts/**`.
4. **UI Agent**: render the new tab in the sidebar using the shared contract.
5. **PM**: sanity check build + nav and update this doc’s ownership map.


