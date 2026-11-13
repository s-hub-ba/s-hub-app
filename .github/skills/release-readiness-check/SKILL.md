---
name: release-readiness-check
description: Perform release QA checks before any deployment.
---

# release-readiness-check

**Trigger:** Perform release QA checks before any deployment.

**Role:** QA & Security → Chief of Staff

**Required inputs:** Target ref/PR, scope, risk assessment, rollback

**Tools:** Repo checks, CI and relevant QA evidence when available and authorized.

**Procedure:** Verify acceptance, reviewer evidence, auth/data controls, build/test status, migrations, rollback and founder approval.

**Output:** GO/NO-GO checklist with blockers.

**Success criterion:** No release action, no GO with open P0 or essential missing checks.

**Mandatory:** Evidence, priority, next action, dependencies and definition of done. Never expose secrets. A skill does not execute independently. Any merge, deployment, production IAM or Firebase rule change, client communication or spending requires explicit additional founder approval.
