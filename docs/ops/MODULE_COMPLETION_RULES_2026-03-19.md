# Module completion rules — 2026-03-19

When to consider a module “complete” for a given scope and how to avoid re-opening the same work without product direction.

---

## What “module complete” means here

- **Scope is defined:** e.g. “Inbox: thread list, thread detail, reply, mark read, opt-out, refresh (inbox-message pull), replies list.”
- **Mounted path and backend are the single source of truth:** One UI component and one route module; no duplicate or superseded implementations left on main.
- **Documented:** Audit or closeout doc states what is shipped, what is out of scope, and what should not be changed without explicit product direction.
- **Operationally settled:** No open PRs that contradict the documented state; parity and tests pass.

---

## Rules

1. **One canonical implementation per surface.** If a new implementation replaces an old one (e.g. InboxTab vs MarketingInboxTab), the old one should be removed or clearly deprecated in a dedicated change. Do not leave two “Inbox” UIs both in the tree without a clear “which one is used” note.
2. **Closeout doc before calling a module “done”.** Create or update an audit doc (e.g. in `docs/audits/`) that records: mounted path, main backend routes, shipped capabilities, known limitations, and what is off-limits without product approval.
3. **No speculative redesign in the same module.** Once a module is closed out, do not start a large UX/feature redesign (e.g. “Outlook-style inbox”) in the same area without explicit product direction. Use the closeout doc to defer such work and document it.
4. **Superseded PRs are closed.** When replacing an old PR with a new one for the same scope, close the old PR and point to the new one. Avoid “which PR is truth?” confusion.

---

## References

- Inbox closeout: `docs/audits/INBOX_CLOSEOUT_2026-03-19.md`
- Marketing sweep: `docs/audits/MARKETING_TAB_FUNCTIONALITY_SWEEP_2026-03-19.md`
- Workflow: `docs/ops/WORKFLOW_GUARDRAILS_2026-03-19.md`
- Testing: `TESTING-CHECKLIST.md`

---

*Created: 2026-03-19. Repo: ODCRM.*
