---
name: bug-detection-and-fix
description: Investigate a reported failure, regression or broken user flow.
---

# bug-detection-and-fix

**Trigger:** Investigate a reported failure, regression or broken user flow.

**Role:** Development → QA

**Required inputs:** Issue reproduction, expected result, repo and environment

**Tools:** GitHub code and test files, local test runner if available. Only use actually available and approved capabilities.

**Procedure:** Locate affected route/function; establish steps to reproduce; inspect errors without exposing secrets; create minimal fix plan and regression test; on approved branch implement then ask QA to validate.

**Output:** Bug report, patch/draft PR when approved, reproducibility and test results.

**Success criterion:** Observed failure and safe regression outcome evidenced; tests marked NOT RUN if unavailable.

**Guardrails:** Before work, verify code and related issues. Give priority, next action, dependency, acceptance criteria, evidence links and test status. Code changes require founder approval for authorized scope; deployments, merges, emails, spending, production security changes require separate explicit approval. Never expose credentials or sensitive user records. A skill file does not autonomously execute any step.
