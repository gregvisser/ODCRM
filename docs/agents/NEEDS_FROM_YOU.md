### OpenDoors CRM — What we need from you (by agent)

This is the “inputs checklist” to get the system to **100% working** and deployable.

---

### Customers Agent (OpenDoors Customers)

- **Customer model clarity**: confirm what “Customer” means in your org (tenant/client vs account vs contact) and the minimal fields for v1.
- **Source of truth**: confirm whether Customers should be stored in **Postgres** (recommended) and whether any legacy localStorage data should be migrated.
- **Sample data**: 3–5 real-ish customer examples (names, industries, notes) to validate UI flows.

---

### Sales Agent (OpenDoors Sales)

- **Pipeline definition**: your standard stages (names + order), and what “lead” vs “opportunity” means internally.
- **Required fields**: minimum data you must track for v1 (owner, stage, next step, value, close date, etc.).
- **Integrations** (optional later): where leads come from (forms, LinkedIn, imports, CRM, etc.).

---

### Marketing Agent (OpenDoors Marketing)

- **Google Sheets access**: confirm how leads sheets are structured (column headers, date formats), and whether links will be public or require auth.
- **Campaign requirements**: who can send campaigns, what compliance requirements apply (unsubscribe language, send windows, daily caps).
- **Existing assets**: email templates, brand tone, disclaimers.

---

### Operations Agent (Operations)

- **Process map**: your real provisioning/checklist lifecycle and who owns which step.
- **SLA definitions**: what SLA metrics matter (time-to-first-contact, turnaround, etc.).
- **Change requests**: what qualifies as a change request and its typical workflow.

---

### Onboarding Agent (Onboarding)

- **Onboarding stages**: canonical steps + required artifacts per step (docs, kickoff date, stakeholders).
- **Roles**: who performs each step and who can approve.
- **Document handling**: where documents live (SharePoint/Drive) and whether we store links or upload files.

---

### UI Agent

- **Brand direction**: approved logo, brand colors, typography constraints, and any UI references you like.
- **Information architecture**: confirm the sidebar hierarchy you ultimately want (top-level tabs + any sub-tabs).
- **Auth UX**: preferred login method (Microsoft/Google/email+password) and whether SSO is required.

---

### Sync/Integrity Agent

- **Canonical naming**: final approved labels for the main tabs and any reserved IDs.
- **Environments**: list of environments you want (local, staging, prod) and how you want release gating handled.
- **Security**: what data is sensitive, retention policies, audit requirements.

---

### Project Manager (PM)

- **Deploy target**: confirm the hosting combo (recommended: Vercel frontend + Vercel/Render API + managed Postgres).
- **Who owns credentials**: who will create/manage Azure App Registration + database + domain DNS.
- **Timeline**: when you need a staging link and when you need production live.


