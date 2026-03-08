# ODCRM Information Architecture

## Current IA (As Implemented)
Top-level tabs from [`src/contracts/nav.ts`](../../src/contracts/nav.ts):
1. Dashboards
2. OpenDoors Clients
3. OpenDoors Marketing
4. Onboarding
5. Settings

### Current Characterization
- Daily-use: Dashboards, Marketing
- Setup/maintenance: Clients, Onboarding
- Admin: Settings

## Recommended IA (Near-Term, No Structural Rewrite)
Keep top-level tabs unchanged, but adjust framing and guidance:
- **Dashboards**: “monitor now, choose next action”
- **OpenDoors Marketing**: “daily outreach operations”
- **OpenDoors Clients**: “data maintenance/setup support”
- **Onboarding**: “new-client setup progression”
- **Settings**: “admin configuration”

## Rationale
- Avoid disruptive nav restructuring while improving user comprehension.
- Marketing is already strongest operational chain; promote it as execution home.
- Clients/Onboarding/Settings are still essential but should be clearly classified as setup/admin or maintenance.

## Suggested Future IA Evolution (Optional)
After usage validation, consider role-sensitive nav emphasis rather than tab removal:
- Operator-focused default emphasis: Dashboard + Marketing.
- Setup/admin emphasis when role/context requires it.
