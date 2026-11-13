---
name: security-review
description: Assess permission rules, authorization, user-data boundaries or deployment readiness.
---

# security-review

**Trigger:** Assess permission rules, authorization, user-data boundaries or deployment readiness.

**Role:** QA & Security

**Required inputs:** Repo, roles, trust boundaries, sensitive fields and target environment

**Tools:** Source, Firestore rules, unit/emulator tests if present. Only use actually available and approved capabilities.

**Procedure:** Inspect privileged role paths, deny-by-default, multi-tenant ownership, cross-user access, webhook verification and logging; use synthetic tests only; rank findings; never touch live customer data.

**Output:** Severity-ranked findings with paths, safe test matrix and mitigations.

**Success criterion:** Distinguish confirmed pattern from exploited weakness and deployed behavior; never disclose secret.

**Guardrails:** Before work, verify code and related issues. Give priority, next action, dependency, acceptance criteria, evidence links and test status. Code changes require founder approval for authorized scope; deployments, merges, emails, spending, production security changes require separate explicit approval. Never expose credentials or sensitive user records. A skill file does not autonomously execute any step.
