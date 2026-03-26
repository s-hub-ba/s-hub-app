## Plan: 2-Week Ship-Ready Audit Execution

Ship core app functionality in 2 weeks by prioritizing feature flow stability while closing only the highest-risk security and data integrity gaps that can break production. Execute in parallel tracks (Frontend reliability, Backend hardening, Product docs/ops), but gate releases on auth safety + billing reliability.

**Steps**
1. Day 1: Baseline and freeze contracts (*blocks most downstream work*).
2. Day 1: Define canonical data model and role rules from current Firebase implementation, remove drift in docs/config references to Supabase where not used (*blocks backend/frontend consistency work*).
3. Day 1-2: Add lightweight release gates (typecheck, build, smoke checklist) to prevent regressions while feature work continues (*parallel with step 2*).
4. Day 2-4: Harden auth and authorization on server routes without full platform rewrite (*depends on step 2*).
5. Day 2-4: Replace header-trust checks with verified identity flow in agency and nanny routes; lock role escalation paths and input whitelists (*depends on step 4*).
6. Day 3-5: Stabilize billing and webhook lifecycle to avoid fake activation/state drift (*parallel with step 5 once auth contract is defined*).
7. Day 3-6: Finish user-critical messaging and inquiry reliability pass and regression sweep across family/agency/nanny dashboards and applications (*parallel with steps 5-6*).
8. Day 5-8: Feature-speed refactors only where they unblock fast delivery (shared message logic, shared validation/status helpers) (*depends on step 7 findings*).
9. Day 7-10: Execute top-priority product features using stabilized contracts (agency inquiry flow polish, application lifecycle consistency, onboarding completion states) (*depends on steps 5 and 7*).
10. Day 10-12: End-to-end bug bash and role-based manual QA matrix; triage and fix ship blockers (*depends on steps 6-9*).
11. Day 12-14: Deployment hardening, release checklist, and launch candidate verification (*depends on step 10*).

**Parallel Workstreams (solo time-slicing)**
1. Workstream A (Security/Core API): auth verification, server route guards, request validation, webhook verification.
2. Workstream B (Feature Reliability): messaging/applications/onboarding behavior, loading/error states, edge-case handling.
3. Workstream C (Delivery Ops): docs alignment, script gates, release checklist, smoke tests.

**Relevant files**
- c:/Users/amrai/Desktop/Shift Me Up/s-hub-app/server/routes/agency.ts — highest-risk auth/billing/inquiry write paths; currently trusts headers and performs non-transactional billing updates.
- c:/Users/amrai/Desktop/Shift Me Up/s-hub-app/server/routes/nanny.ts — auth middleware and profile update path; currently allows broad update surface including role changes.
- c:/Users/amrai/Desktop/Shift Me Up/s-hub-app/server/paypal.ts — subscription + webhook are stubs; must become real verified lifecycle.
- c:/Users/amrai/Desktop/Shift Me Up/s-hub-app/server.ts — global middleware posture (CORS scope, body size limits, request logging hooks).
- c:/Users/amrai/Desktop/Shift Me Up/s-hub-app/src/contexts/AuthContext.tsx — role normalization and fallback behavior.
- c:/Users/amrai/Desktop/Shift Me Up/s-hub-app/src/components/ProtectedRoute.tsx — route-level role enforcement and redirects.
- c:/Users/amrai/Desktop/Shift Me Up/s-hub-app/src/lib/api.ts — shared data contracts and client messaging/inquiry helpers.
- c:/Users/amrai/Desktop/Shift Me Up/s-hub-app/src/pages/family/Messages.tsx — family messaging reliability and error/retry UX.
- c:/Users/amrai/Desktop/Shift Me Up/s-hub-app/src/pages/agency/Messages.tsx — agency side message/inquiry state transitions.
- c:/Users/amrai/Desktop/Shift Me Up/s-hub-app/src/pages/nanny/Messages.tsx — nanny message behavior consistency.
- c:/Users/amrai/Desktop/Shift Me Up/s-hub-app/src/App.tsx — route map and protected flow coverage.
- c:/Users/amrai/Desktop/Shift Me Up/s-hub-app/README.md — outdated platform documentation currently mismatched with implementation.
- c:/Users/amrai/Desktop/Shift Me Up/s-hub-app/docs/REPOSITORY_AUDIT.md — prior audit context to reconcile with current Firebase state.

**Verification**
1. Run type/build gates on every milestone cut: npm run lint and npm run build.
2. API auth smoke checks: verify unauthorized requests to agency/nanny privileged routes are rejected.
3. Billing/webhook smoke checks: replay duplicate webhook events and verify idempotent state (no double activation).
4. Messaging E2E manual matrix: family inquiry -> agency response -> family follow-up; agency <-> nanny thread send/refresh/reload.
5. Role routing matrix: each role can access only intended dashboard/routes and is redirected correctly on restricted routes.
6. Regression pass on top funnels: signup/login, onboarding, apply flow, inquiry flow, messages, billing status display.

**Decisions**
- Included scope: ship-critical stabilization plus fast feature delivery support for 2-week completion.
- Excluded scope: full architecture migration, deep design-system rewrite, broad non-critical refactors.
- Priority tradeoff: feature speed first, but no release until minimum auth and billing integrity gates are in place.
- Execution style: parallel workstreams but sequenced dependencies for a solo developer.

**Further Considerations**
1. Security depth for this release: Option A minimal route hardening for critical endpoints, Option B full JWT/RBAC sweep now. Recommendation: Option A in week 1 plus targeted Option B on highest-risk routes.
2. Testing depth for 2 weeks: Option A smoke/manual + lint/build gates, Option B add minimal automated API integration tests for auth/billing/messaging. Recommendation: Option B for three critical flows only.
3. Billing launch posture: Option A keep billing sandbox until post-launch, Option B enable production billing with verified webhooks before launch. Recommendation: Option B only if webhook idempotency and signature verification are complete.

**Iterative QA Loop (User-Driven)**
1. Test one feature at a time in this order: Auth/Login -> Onboarding -> Agency Inquiry -> Messaging -> Applications -> Billing status.
2. After each test, report: role used, exact page URL, steps taken, expected result, actual result, screenshot/error text.
3. I triage each report into: confirmed bug, cannot reproduce, or expected behavior mismatch.
4. For confirmed bugs, I provide fix plan first, then implementation and verification steps.
5. We do not move to the next feature until current feature is either fixed or explicitly deferred with reason.
6. Every fix cycle ends with lint/build pass plus targeted regression checks for adjacent flows.
