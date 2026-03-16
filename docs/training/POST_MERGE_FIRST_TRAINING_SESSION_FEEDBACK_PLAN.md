# Post-Merge First Training Session Feedback Plan

## Purpose
Use this plan during the first real ODCRM operator-training session after the training docs ship. The goal is to capture training friction that can be fixed with a small follow-up docs PR.

## Who should use this
- the trainer running the session,
- the internal admin or team lead observing the session,
- the first real operator using the docs while completing the workflow.

## Workflow to test with a real user
Run one operator through this workflow using the docs as written:
1. Select the correct client.
2. Connect an email account.
3. Create a template.
4. Improve the template with AI.
5. Preview the template.
6. Create or prepare a sequence.
7. Run a test batch.
8. Check schedule status.
9. Review inbox replies or opt-outs.
10. Check reports.

## What friction to capture
Capture only real training friction:
- user got stuck,
- wrong label,
- unclear step,
- missing prerequisite,
- unexpected result,
- user did not know what to do next.

For each friction point, capture:
- which doc the user was following,
- which step number they were on,
- what they expected,
- what they saw instead,
- what unblocked them.

## What not to capture
Do not capture:
- broad product redesign ideas,
- feature requests unrelated to training clarity,
- generic opinions without a concrete friction point,
- engineering solutions before the friction is described clearly.

## Lightweight issue logging template
Use one entry per friction point:

| Field | Notes |
|---|---|
| Date | When the session happened |
| User role | Who was being trained |
| Doc used | Which training doc or playbook they were following |
| Workflow step | The exact step number or heading |
| Friction type | `stuck`, `wrong label`, `unclear step`, `missing prerequisite`, `unexpected result`, `didn't know what to do next` |
| What happened | One short factual description |
| How they recovered | What unblocked the user |
| Doc fix needed | `yes` or `no` |

## Criteria for a small follow-up doc-fix PR
Open a small follow-up PR only if the issue:
- can be fixed in docs alone,
- happened to a real user during the tested workflow,
- has a clear page and step to update,
- improves operator clarity without changing product behavior.

Good examples:
- change a label in the docs to match the UI,
- add a missing prerequisite,
- clarify the next tab after a step,
- split one dense instruction into shorter numbered steps.

Do not open a docs-fix PR for:
- product bugs,
- missing features,
- requests that require UI or backend changes,
- feedback that is not tied to a concrete training failure.
