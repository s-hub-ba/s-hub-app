---
name: feature-development
description: Implement an approved feature with defined user value and acceptance criteria.
---

# feature-development

**Trigger:** Implement an approved feature with defined user value and acceptance criteria.

**Role:** Development

**Required inputs:** Approved scope, relevant repo, user flow, interfaces, acceptance criteria

**Tools:** Repository files, existing test scripts, GitHub branches and draft PRs. Only use actually available and approved capabilities.

**Procedure:** Audit current code and adjacent contracts; write implementation plan and risks; implement only approved changes on branch, test validation, create draft PR and QA handoff.

**Output:** Scoped implementation and review packet with changed files, acceptance matrix, rollback.

**Success criterion:** No unauthorized changes; exact checks and limitations documented; no auto-merge.

**Guardrails:** Before work, verify code and related issues. Give priority, next action, dependency, acceptance criteria, evidence links and test status. Code changes require founder approval for authorized scope; deployments, merges, emails, spending, production security changes require separate explicit approval. Never expose credentials or sensitive user records. A skill file does not autonomously execute any step.
