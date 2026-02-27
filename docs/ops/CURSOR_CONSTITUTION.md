# ODCRM — Cursor Constitution (canonical)

Canonical operating rules for Cursor when working on this repo. Any new Cursor chat can load these from here (no hunting elsewhere).

---

## Cursor must do everything

- Do **everything** end-to-end yourself: git, gh, npm, prod:check, comments, verification.
- **Never** instruct the user to run terminal/PowerShell commands.
- Only stop if physically blocked (e.g. GitHub approval/permissions). Then output: (1) exact error, (2) exact UI click path required.

---

## Hard failure conditions (strict)

1. **Never** say “run these commands…” to the user — run them yourself and report results.
2. **Never** offload tool setup — install missing tools yourself (winget/choco/npm/npx) or use alternatives.
3. **Never** ask the user to look up IDs — obtain via repo/docs/scripts or generate via existing flows (API/UI).

---

## Workflow rules

- Small sequential PRs off `origin/main`; no stacked PRs.
- Never push local main if diverged. Always:
  - `git fetch origin`
  - `git checkout main`
  - `git reset --hard origin/main`
- No stash unless explicitly instructed.
- DB is truth; tenant via `X-Customer-Id`; no silent defaults (no auto-pick tenant).
- Agency mode only unless explicitly changing client mode.

---

## Gates (run and record exit codes)

- `npm run lint` (baseline may exit 1; must not worsen)
- `npx tsc --noEmit`
- `npm run build`
- `cd server && npm run build`

---

## Prod parity (mandatory after merge)

- **Canonical endpoints:**
  - Frontend: https://odcrm.bidlow.co.uk/__build.json
  - Backend:  https://odcrm-api-hkbsfbdzdvezedg8.westeurope-01.azurewebsites.net/api/_build
- Always run parity with **EXPECT_SHA** equal to the merge SHA (full).
- **Windows cmd.exe preferred (shell-safe):**
  ```bash
  npx --yes cross-env EXPECT_SHA=<sha> node scripts/prod-check.cjs
  ```
- Avoid `set EXPECT_SHA=... && ...` when shell context is uncertain.

---

## File locks (“file busy / locked”)

- **Must** use Sysinternals **Handle**. Paste output showing **PID + process name** holding the file.
- **Never** guess (e.g. “probably Excel”).
- If `handle` is not on PATH, locate `handle.exe` (e.g. WinGet) and run by **full path**.
- Then stop the process safely (graceful then force if needed), delete file, confirm `git status --porcelain` clean.

---

## Session bootstrap proof (before any “Understood” or plan)

Run and paste outputs:

- `whoami`
- `git rev-parse --is-inside-work-tree`
- `cmd /c ver`
- `$PSVersionTable.PSVersion`
- `node -v`, `npm -v`, `gh --version`, `git --version`
- `git fetch origin`
- `git status --porcelain`
- `git rev-parse HEAD`
- `git rev-parse origin/main`

If you cannot execute commands, STOP immediately (do not give commands to the user).

---

## Required end-of-task output

- PR URL (if applicable)
- Merge SHA (full) (if applicable)
- Gates summary with exit codes
- `prod:check` PASS snippet (if applicable)
- `git show --name-only --oneline HEAD`
- `git status --porcelain` (clean)

---

## Self-correct

If about to violate a rule: STOP, state which rule, switch to a compliant approach, then proceed.
