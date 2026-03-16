# Shift Me Up — Repository Audit v2

Date: 2026-03-16  
Scope: End-to-end audit of the current repository state (no code rewrite).

## Executive summary

The repository is a promising **UI prototype + schema draft**, but it is not yet a stable production MVP. The largest blockers are:
1. **Architecture mismatch** with stated direction (Next.js PWA vs current Vite SPA + Express).
2. **Data model split-brain** (`agencies/nannies/profiles` vs `agency_profiles/nanny_profiles`).
3. **Security/integrity gaps** in backend auth, billing webhooks, and policy coverage.
4. **Agency-first rule not fully enforced server-side** (Family → Agency → Nanny).

This means feature work should pause until schema/auth contracts are stabilized.

---

## 1) Current architecture (as implemented)

### 1.1 Runtime topology
- Node/Express process in `server.ts`:
  - mounts `/api/health`
  - mounts `/api/paypal`, `/api/agency`, `/api/nanny`
  - in dev, mounts Vite middleware for SPA
  - in prod, serves `dist` static assets + SPA fallback
- Frontend is React (not Next.js), bootstrapped through `src/main.tsx`.

### 1.2 Frontend architecture
- Routing and role segmentation are centralized in `src/App.tsx`:
  - public pages
  - family protected routes
  - nanny protected routes
  - agency protected routes
  - admin protected routes
- Auth/session state uses `AuthContext` + Supabase auth, with mock-login fallback.
- Most data operations are direct Supabase calls in `src/lib/api.ts`.

### 1.3 Backend architecture
- PayPal integration routes are currently stubs (`server/paypal.ts`).
- Agency routes support recruiter seat operations and invite-link generation (`server/routes/agency.ts`).
- Nanny registration route supports invite-code lookup and writes into user/profile/nanny tables (`server/routes/nanny.ts`).
- Backend uses elevated Supabase client (`server/supabase.ts`).

### 1.4 Database architecture
- Migration chain under `supabase/migrations/` defines `users/profiles/nannies/agencies/jobs/...` and family messaging/application tables.
- Separate `supabase/schema.sql` defines a different model (`agency_profiles`, `nanny_profiles`, enum differences).
- `supabase/seed.sql` targets migration-style tables but has column-name drift.

---

## 2) What appears auto-generated from Gemini / AI Studio

These are strong indicators of generated scaffolding rather than deliberate production design:
- Gemini-specific env injection in Vite config (`process.env.GEMINI_API_KEY`).
- AI Studio-oriented comments in Vite config (HMR behavior note).
- `.env.example` includes `GEMINI_API_KEY` + `APP_URL` applet-style variables.
- `@google/genai` dependency present without productized AI feature surface.
- SPDX header in `src/App.tsx` and broad template-like UI/page population.
- Multiple mock/stub implementation paths:
  - mock login fallback
  - mock UUID user creation in server routes
  - PayPal stubs/webhook TODO comments
  - placeholder Supabase credentials fallbacks

Interpretation: generated starter + iterative prompt extension, not yet converged architecture.

---

## 3) Critical findings (with severity)

## P0 — must fix before shipping

### P0.1 Data contract inconsistency across app/server/db
- Frontend reads `agency_profiles`/`nanny_profiles` in some places and writes `agencies`/`nannies` in others.
- Onboarding pages insert into `agency_profiles` and `nanny_profiles` while server registration writes `profiles` and `nannies`.
- `supabase/schema.sql` conflicts with migration model and statuses.

**Risk:** runtime query failures, broken onboarding, impossible reliable deploys.

### P0.2 Insecure authorization model in server routes
- Agency owner middleware trusts `x-agency-id` header instead of JWT validation.
- Any caller can impersonate agency context if endpoint is publicly reachable.

**Risk:** privilege escalation, unauthorized recruiter/billing/invite operations.

### P0.3 Billing and webhook integrity incomplete
- PayPal create-subscription and webhook handlers are stubs.
- Webhook signature verification is not implemented.

**Risk:** subscription tampering, false payment state, billing fraud exposure.

### P0.4 Agency-first policy not system-enforced
- Product rule is clear: families do not contact nannies directly.
- Current data model includes family↔agency messaging, but enforcement is mostly structural, not policy-guaranteed across all write paths.

**Risk:** accidental direct-contact regressions as features expand.

## P1 — high priority after P0

### P1.1 Migration and seed drift
- Families table uses `location_borough/location_neighborhood`, but seed inserts use `borough/neighborhood`.
- Job status semantics differ between migration model (`open`) and alternate schema (`draft/published`).

**Risk:** broken local bootstrap and unreliable CI/dev onboarding.

### P1.2 Production start/build mismatch
- `npm start` uses `node server.ts`.
- Build script only compiles frontend; backend artifact/runtime strategy is undefined.

**Risk:** deployment failure in standard Node runtime.

### P1.3 Type safety debt
- Broad use of `any` in API/page logic.
- No generated DB types or strict DTO contracts between frontend/server.

**Risk:** silent runtime bugs and difficult refactoring.

## P2 — medium priority

### P2.1 Test coverage absent
- No unit, integration, or e2e tests observed.

### P2.2 PWA requirements not implemented
- No web manifest/service worker/offline strategy currently detected.

---

## 4) Specific mismatch matrix

| Layer | Evidence | Why it matters |
|---|---|---|
| Frontend data API | `src/lib/api.ts` mixes `agency_profiles` reads with `agencies` updates; `nanny_profiles` reads with `nannies` updates | Data model ambiguity and runtime inconsistency |
| Frontend onboarding | `JoinAgency` inserts `agency_profiles`; `JoinNanny` inserts `nanny_profiles`; `JoinFamily` inserts `families` | Onboarding contracts diverge from server registration path |
| Server registration | `server/routes/nanny.ts` writes `users`, `profiles`, `nannies` | Different canonical model from parts of frontend |
| SQL model A | `supabase/migrations/*` define `agencies`, `nannies`, `profiles` | One candidate canonical model |
| SQL model B | `supabase/schema.sql` defines `agency_profiles`, `nanny_profiles` + different enums | Competing canonical model |
| Seed script | `supabase/seed.sql` uses outdated family column names | Fresh setup likely breaks |

---

## 5) Roadmap (clean continuation plan)

## Phase 0 — Architecture freeze (1 day)
1. Decide short-term runtime:
   - **Recommended:** keep Vite+Express until contracts stabilize.
2. Declare one canonical DB model (recommend migration chain model).
3. Mark `supabase/schema.sql` as deprecated or regenerate it from canonical migrations.

## Phase 1 — Data/auth hardening (3–5 days)
1. Create canonical schema doc + role/RLS matrix.
2. Reconcile migrations + seed so `reset + seed` is deterministic.
3. Implement JWT auth middleware on all privileged server routes.
4. Remove header-trust authorization patterns.

## Phase 2 — Agency-first workflow enforcement (4–6 days)
1. Move sensitive write paths to backend endpoints.
2. Add policy checks ensuring family interactions are agency-mediated.
3. Add DB constraints and server validations to prevent direct family↔nanny messaging.

## Phase 3 — Billing and reliability (3–5 days)
1. Implement real PayPal subscription lifecycle.
2. Verify webhook signatures and make handlers idempotent.
3. Add billing/audit event tables for traceability.

## Phase 4 — Developer quality system (3–5 days)
1. Add generated Supabase types and remove `any` in hot paths.
2. Add unit + integration + e2e coverage for core funnels.
3. Add CI checks for typecheck/tests/migration validation.

## Phase 5 — Next.js PWA transition (optional, after stability)
1. Migrate route-by-route once contracts are stable.
2. Add PWA manifest/service worker/installability.
3. Preserve backend/domain contracts during frontend migration.

---

## 6) Immediate deliverables (recommended next PRs)

1. `docs/ARCHITECTURE.md` — runtime + request/role flow diagrams.
2. `docs/DATA_MODEL_CANONICAL.md` — final table map + deprecations.
3. `docs/RLS_MATRIX.md` — allowed operations by role/table.
4. `docs/SECURITY_GAPS.md` — auth/webhook/secrets hardening checklist.
5. `docs/IMPLEMENTATION_BACKLOG.md` — ticketized roadmap with acceptance criteria.

---

## 7) Bottom line

The project is a strong prototype but not yet an enforceable agency-first marketplace backend. The highest-leverage step is to **freeze one data model and secure auth/write paths** before adding features or migrating to Next.js.
