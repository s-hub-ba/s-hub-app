---
name: github-repository-audit
description: Audit codebase when beginning or resuming project work or when status is unknown.
---

# github-repository-audit

**Trigger:** Audit codebase when beginning or resuming project work or when status is unknown.

**Role:** Chief of Staff → Development

**Required inputs:** Repository full name, intended project, known requirements

**Tools:** GitHub repository metadata, README, package files, recent commits, issues and PRs. Only use actually available and approved capabilities.

**Procedure:** Confirm exact repository and default-branch SHA; inspect scripts, CI, architecture, recent changes and existing issue state; separate implemented code from prose claims; identify risks and smallest safe next action.

**Output:** Evidence-linked audit with P0–P3 findings, unknowns and recommended first task.

**Success criterion:** Every implementation claim cites source; missing tests and deployment unknowns are explicit.

**Guardrails:** Before work, verify code and related issues. Give priority, next action, dependency, acceptance criteria, evidence links and test status. Code changes require founder approval for authorized scope; deployments, merges, emails, spending, production security changes require separate explicit approval. Never expose credentials or sensitive user records. A skill file does not autonomously execute any step.
