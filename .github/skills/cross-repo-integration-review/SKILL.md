---
name: cross-repo-integration-review
description: Verify compatibility and shared backend assumptions between repositories.
---

# cross-repo-integration-review

**Trigger:** Verify compatibility and shared backend assumptions between repositories.

**Role:** Development + QA & Security

**Required inputs:** Both repository names, expected product roles, intended integrations

**Tools:** GitHub source, database rules, auth and API contracts, when available and authorized.

**Procedure:** Compare roles, Firebase initialization and environments without exposing values, Firestore collections, data isolation, routing and permission boundaries. Label shared backend unverified unless confirmed by source.

**Output:** Interface matrix and recommended test plan.

**Success:** Never assert shared production backend from matching dependencies alone.

Always report evidence, priority, next action, dependency and definition of done. Do not merge/deploy, change production rules, send client messages, incur costs or disclose secrets without separate explicit approval. A skill file is reusable instruction, not independent execution.
