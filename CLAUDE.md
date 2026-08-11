# Project Architecture Map

This file is the baseline architecture and navigation map for this repository.

Primary goal:
- make future work fast without re-discovering the codebase from scratch;
- separate the whole portal/platform view from the MAYAK-specific domain;
- record the places where the repository is mixed, transitional, or easy to misread.

How to use this file:
- read `What Is Easy To Confuse First` before changing architecture or data flow;
- read `Portal / Platform` for shared app structure;
- read `MAYAK` for trainer, sessions, onboarding, admin, and runtime data;
- use `Task Index` when you need the fastest path to the right files.

Related files:
- `AGENTS.md` defines the required workflow for Codex work in this repo.
- `CODEX_LEARNINGS.md` stores reusable pitfalls and prevention rules.
- `docs/mayak-refactor-status.md` stores MAYAK refactor progress/status.
- `docs/local-product-context/README.md` explains the broader MAYAK product intent.

## What Is Easy To Confuse First

This repository is not a clean single-purpose app. It is a mixed operational shell with several layers living together:
- a general portal/platform UI and API proxy layer;
- a large embedded MAYAK subsystem;
- some legacy MAYAK implementations still kept for compatibility;
- some experimental or older sidecar flows that overlap conceptually with newer integrated code.

Important current ambiguities and transitions:

1. Portal plus MAYAK live in one Next.js app.
- `src/pages` contains both generic portal pages and MAYAK pages.
- `src/pages/api` contains both portal proxy endpoints and local MAYAK server logic.

2. MAYAK has both current and legacy frontend implementations.
- current refactor path: `src/components/features/tools-2/`
- older path: `src/components/features/tools/`
- current page entry: `src/pages/tools/mayak-oko.js`
- older/stable page: `src/pages/tools/mayak-oko-stable.js`

3. MAYAK content storage is transitional.
- preferred storage abstraction: `src/lib/mayakContentStorage.js`
- current runtime APIs: `/api/mayak/content-bundle`, `/api/mayak/content-file`, `/api/mayak/settings`
- older legacy content path still exists through `data/mayakData.json` and `/api/mayak/content-data`
- content directory resolution is environment-sensitive:
  - `MAYAK_CONTENT_DIR`
  - fallback `data/mayak-content`
  - fallback `public/tasks-2/v2`

4. Session mode and legacy token mode both exist.
- legacy token flow is still supported;
- experimental session flow is a separate domain with its own storage, participant registration, review queue, and admin screens;
- do not assume a token always means the old `mayakTokens.json` model.

5. MAYAK admin auth is separate from portal auth.
- portal auth is tied to external backend/auth cookies and profile APIs;
- MAYAK admin uses its own server-side password flow with `mayak_admin_auth` cookie and `MAYAK_ADMIN_PASSWORD`.

6. Runtime data and editable config live close to each other under `data/`.
- some files in `data/` are source-like configuration and belong to the project;
- others are runtime state, local artifacts, uploads, or operator data;
- several runtime files are gitignored now, but historical tracked files still exist in the repo.

7. There are two prep/session-related implementation tracks.
- integrated current track inside the main Next.js app: `src/pages/prep-session.js` plus `/api/mayak/prep-session/*`
- separate sidecar app under `telegram/session-app/`
- treat `telegram/session-app/` as a standalone prototype/older contour unless the task explicitly targets it.

8. Some documentation paths are stale.
- `AGENTS.md` references an old local absolute path (`D:\mayak-test\rsk_fr\...`);
- the intent is still correct, but in the current workspace the actual repo root is this folder.

9. Encoding risk is real.
- this repo already had Windows mojibake incidents in MAYAK files with Cyrillic strings;
- do not bulk-rewrite MAYAK source files without checking encoding carefully.

10. Product scope is broader than the trainer UI.
- MAYAK is not only a prompt-training screen;
- product context documents describe a larger assessment/diagnostic platform trajectory;
- not every concept from those documents is implemented in code yet.

Working default when the architecture feels contradictory:
- prefer the newer MAYAK server-side storage/admin/runtime path over older direct-public JSON flows;
- preserve compatibility unless a task explicitly asks for migration or removal;
- when unsure whether code is active or legacy, trace the concrete page entry and API call chain before editing.

## Portal / Platform

### What the portal is

The repository is a Next.js pages-router application that acts as the software shell for a broader platform. Inside that shell, MAYAK is one large direction, but the codebase also includes common portal areas such as authentication, profile, teams, organizations, projects, and courses.

The portal side does not appear to be a fully independent backend. A large part of its non-MAYAK API surface is implemented as Next.js proxy/BFF routes that forward requests to the external backend at `https://api.rosdk.ru`.

### Local Workspace With The Colocated Backend

In the current local workspace, the external backend is no longer just an abstract remote host. There is now a sibling backend repository at:
- `../back/RSK_back`

Working interpretation:
- `rsk_fr` is the frontend shell plus BFF/proxy layer;
- `../back/RSK_back` is the real portal backend codebase behind most non-MAYAK business logic;
- together they form one operational system, but they are still two separate repositories with separate ownership and startup flows.

What this changes for day-to-day work:
- if a portal bug is caused by request/response shape, auth cookies, OAuth callback behavior, or profile persistence, inspect both repos before patching only the frontend;
- do not treat `https://api.rosdk.ru` as a black box when the sibling backend repo is available locally;
- prefer fixing durable data-contract issues in the backend service that owns the contract, instead of adding frontend-only normalization unless the task is explicitly BFF-only;
- when changing frontend proxy code under `src/pages/api/*`, identify the backend service that owns the endpoint and inspect its real route/schema first.

### Portal Backend Ownership Map

The local backend repo uses Traefik path prefixes in `../back/RSK_back/docker-compose.yml`. For portal work from this repo, the most important ownership map is:

- `https://api.rosdk.ru/auth/*` -> `../back/RSK_back/auth_service`
- `https://api.rosdk.ru/users/*` -> `../back/RSK_back/user_profile`
- `https://api.rosdk.ru/teams/*` -> `../back/RSK_back/teams_service`
- `https://api.rosdk.ru/orgs/*` -> `../back/RSK_back/orgs_service`
- `https://api.rosdk.ru/projects/*` -> `../back/RSK_back/projects_service`
- `https://api.rosdk.ru/learning/*` -> `../back/RSK_back/learning_service`

Useful frontend-to-backend examples from this repo:
- `src/pages/api/auth/login.js` -> backend `auth_service` login route
- `src/pages/api/auth/reg.js` -> backend `auth_service` register route
- `src/pages/api/profile/info.js` -> backend `user_profile` get-my-profile route
- `src/pages/api/profile/update.js` -> backend `user_profile` update-my-profile and role routes
- `src/pages/api/org/*` -> backend `orgs_service`
- `src/pages/api/teams/*` -> backend `teams_service`
- `src/pages/api/projects/*` -> backend `projects_service`
- `src/pages/api/cours/*` and admin review routes -> backend `learning_service`

### Tech stack

- Next.js 16, pages router
- React 19
- Tailwind CSS 4
- custom webpack config for SVG handling in `next.config.mjs`
- JSON/file-backed local storage for MAYAK domains
- Telegram bot runtime through Node-side startup in `instrumentation.js`

Build/runtime note:
- use `next build --webpack` or `npm run build`;
- do not assume Turbopack build compatibility yet.

### Top-level directory map

- `src/` main application code
- `src/pages/` route entrypoints
- `src/pages/api/` Next.js API routes
- `src/components/` shared UI plus feature modules
- `src/lib/` server/domain logic, MAYAK storage, admin auth, runtime helpers
- `src/utils/` smaller helpers, cookies, auth helpers, token helpers
- `src/hooks/` shared hooks and portal fetch helpers
- `data/` JSON-backed MAYAK content/config/runtime files
- `docs/` product context and MAYAK architecture/refactor notes
- `public/` static assets and legacy MAYAK public task files
- `telegram/` sidecar/older Telegram session app
- `scripts/` support scripts

### Portal route structure

Main portal/user-facing areas observed in this repo:
- `/` home
- `/auth`
- `/profile`
- `/teams/*`
- `/organizations/*`
- `/projects/*`
- `/cours/*`
- `/tools/mayak-oko`
- `/admin` MAYAK admin hub
- `/conferencia` Regional-branch delegate package: form generates protocol, attendance list and consent, then collects signed scans
- `/conferencia/admin` Admin panel for received packages

Conference package notes (code lives under `src/lib/rosdk-confrencia/`, despite the route being `/conferencia`):
- `documents.js` builds the three DOCX blanks with the `docx` package — there is no template file to patch;
- `slots.js` is the shared, dependency-free description of every generated and uploaded file, imported by both the form and the API;
- `validation.js` owns the legal thresholds: quorum is more than half of members on record, the delegate needs at least 2/3 of those present;
- `data/rsk.sqlite` and `data/uploads/` hold passport data and scans — gitignored, never commit them;
- `node scripts/check-conferencia-package.mjs` covers thresholds, attendance list, DOCX generation and archive assembly.

Shared navigation is defined in:
- `src/components/layout/Aside/Nav.js`

Shared shell/layout lives mainly in:
- `src/components/layout/`
- `src/components/ui/`

### Portal auth and profile model

Portal auth is hybrid:
- real session/auth authority appears to come from external backend cookies/tokens;
- local frontend convenience state is also mirrored in cookies like `userData`;
- some local development behavior can rely on mocked profile behavior described in `CODEX_LEARNINGS.md`.

Backend ownership of auth/profile is split:
- auth/session/OAuth ownership lives in `../back/RSK_back/auth_service`;
- profile fields like `NameIRL`, `Surname`, `Patronymic`, organization, and role live in `../back/RSK_back/user_profile`;
- `user_profile` reads the JWT from the `users_access_token` cookie, not from frontend local state;
- user-profile creation is event-driven: `auth_service` publishes `user.created`, and `user_profile` consumes it to create the initial profile row.

Important portal auth files:
- `src/utils/auth.js`
- `src/utils/cookies.js`
- `src/pages/api/auth/login.js`
- `src/pages/api/profile/info.js`
- `src/pages/api/profile/update.js`

OAuth-related entrypoints:
- `src/pages/callback_auth.js`
- `src/pages/vk-callback.js`
- `src/pages/api/auth/oauth/callback.js`
- `src/pages/api/auth/vk/callback.js`

OAuth path caution with the sibling backend repo:
- frontend currently contains both a generic OAuth callback proxy and provider-specific VK handling;
- backend repo currently exposes provider-specific OAuth routes under `auth_service` (`/auth/yandex/*`, `/auth/vk/*`);
- when changing OAuth behavior, verify which callback path is actually active in the target flow before editing.

MAYAK-specific identity rule layered on top of portal auth:
- a user is not MAYAK-ready only because they are authorized;
- MAYAK entry also requires profile name completeness (`Surname` + `NameIRL`) because certificates/history/artifacts depend on it.

Important nuance when the sibling backend repo is available:
- OAuth/provider data may exist in `auth_service` before the profile in `user_profile` is complete;
- the initial profile row can still be missing MAYAK-required FIO structure even after successful social login;
- if a task is about auto-filling FIO from VK/Yandex, inspect both `../back/RSK_back/auth_service/app/services/*oauth*.py` and `../back/RSK_back/user_profile/app/services/rabbitmq.py`, not only the frontend callback pages.

### Portal API pattern

Non-MAYAK portal APIs in this repo are commonly thin wrappers around the external backend.

Examples:
- `src/pages/api/auth/*`
- `src/pages/api/profile/*`
- `src/pages/api/org/*`
- `src/pages/api/projects/*`
- `src/pages/api/teams/*`
- `src/pages/api/cours/*`

Working assumption for portal tasks:
- if the feature is not MAYAK-specific, first check whether the real business logic lives on `api.rosdk.ru` and this repo only adapts request/response handling.
- if the relevant backend service exists in `../back/RSK_back`, read that service before deciding whether a frontend change is sufficient.

### Portal task index

If the task is about:
- navigation or portal shell: start in `src/components/layout/`
- auth/profile UX: start in `src/pages/auth.js`, `src/pages/profile.js`, `src/utils/auth.js`, `src/pages/api/profile/*`
- teams/organizations/projects/courses: start in matching `src/pages/*` and `src/pages/api/*` directories
- cross-cutting styles/UI: check `src/components/ui/`, global styles, and page-level styles used by the target area

## MAYAK

### What MAYAK is inside this repository

Inside this repo, MAYAK is the largest embedded product contour. It already includes much more than the trainer page itself:
- trainer runtime;
- content storage and admin editing;
- token flows;
- separate session-mode runtime;
- onboarding/public preparation flows;
- result and artifact handling;
- analytics/report generation;
- Telegram bot integration;
- prep-session support.

Product-context default:
- treat the current codebase as the operational software shell of a broader MAYAK product;
- do not assume every concept from the product-context docs is already implemented;
- preserve current trainer/admin/runtime compatibility unless the task explicitly changes the contract.

### Active MAYAK route map

Main MAYAK user/admin routes:
- `/tools/mayak-oko` current trainer entry
- `/tools/mayak-oko-stable` older/stable trainer entry
- `/admin` MAYAK admin hub/login
- `/admin/mayak-content`
- `/admin/mayak-tokens`
- `/admin/mayak-sessions`
- `/admin/mayak-onboarding`
- `/admin/mayak-results`
- `/mayak-onboarding/[slug]`
- `/mayak-onboarding/[slug]/participant`
- `/mayak-onboarding/[slug]/tech`
- `/prep-session`

### MAYAK frontend structure

Current MAYAK page entry:
- `src/pages/tools/mayak-oko.js`

That page behaves like a mini-router between feature screens under:
- `src/components/features/tools-2/index.js`
- `src/components/features/tools-2/settings.js`
- `src/components/features/tools-2/trainer.js`
- `src/components/features/tools-2/history.js`
- `src/components/features/tools-2/admin.js`

Important current frontend interpretation:
- `tools-2` is the active/refactored MAYAK path;
- `tools` is the older implementation kept for compatibility/reference;
- when updating current MAYAK behavior, start in `tools-2` unless routing proves otherwise.

Trainer orchestration has already been decomposed out of the original monolith. The current `trainer.js` is still central, but many behaviors now live in dedicated hooks and utilities.

Key trainer hook modules include:
- `useMayakTaskManager`
- `useMayakAccessGate`
- `useMayakRuntimeData`
- `useMayakSessionActions`
- `useMayakQwenEvaluation`
- `useMayakPromptActions`
- `useMayakCompletionActions`
- `useMayakTaskExecutionActions`
- other MAYAK trainer hooks extracted around UI/runtime concerns

When changing trainer behavior:
- inspect `src/components/features/tools-2/trainer.js` first to find the actual hook wiring;
- then update the specific hook instead of pushing more logic back into the page-level orchestrator.

### MAYAK admin structure

MAYAK admin now has a unified entry surface:
- `src/pages/admin/index.js`

Admin auth/client/server helpers:
- `src/lib/mayakAdminClient.js`
- `src/lib/mayakAdminAuth.js`

Admin auth model:
- server-side password check;
- httpOnly cookie `mayak_admin_auth`;
- password from `MAYAK_ADMIN_PASSWORD`;
- no extra frontend-only auth source should become required.

Main MAYAK admin pages:
- `src/pages/admin/mayak-content.js`
- `src/pages/admin/mayak-tokens.js`
- `src/pages/admin/mayak-sessions.js`
- `src/pages/admin/mayak-onboarding.js`
- `src/pages/admin/mayak-results.js`

Compatibility/alias pages still exist:
- `src/pages/admin-content.js`
- `src/pages/admin-tokens.js`
- `src/pages/results.js`
- `src/pages/admin/sessions.js`
- `src/pages/admin/tokens.js`

Treat these alias routes as compatibility shims unless the task explicitly targets routing cleanup.

### MAYAK content architecture

Preferred content-storage abstraction:
- `src/lib/mayakContentStorage.js`

This layer is responsible for:
- resolving the active content directory;
- reading and writing manifest/section files;
- non-destructive section JSON updates;
- listing section files;
- serving section bundles to the runtime/admin UI.

Current content source selection order:
1. `MAYAK_CONTENT_DIR` if set
2. `data/mayak-content`
3. legacy fallback `public/tasks-2/v2`

Current runtime/admin content APIs:
- `src/pages/api/mayak/content-bundle.js`
- `src/pages/api/mayak/content-file.js`
- `src/pages/api/mayak/settings.js`

Legacy content path still present:
- `src/pages/api/mayak/content-data.js`
- `data/mayakData.json`

Important rule:
- prefer editing the newer storage/API path unless the task is explicitly about legacy compatibility.

Important invariant:
- `sectionId` is the slug/folder identifier;
- do not treat it as interchangeable with a numeric task range.

### MAYAK token model

Legacy token storage/helper:
- `src/utils/mayakTokens.js`
- backing file `data/mayakTokens.json`

Token validation/API entry:
- `src/pages/api/mayak/validate-token.js`

Token model notes:
- legacy tokens carry `sectionId` plus `taskRange`;
- localhost-only bypass behavior may still exist for local development;
- production assumptions should not rely on bypass tokens.

### MAYAK sessions domain

Sessions are a separate MAYAK domain, not just a small extension of legacy tokens.

Core storage/runtime files:
- `src/lib/mayakSessions.js`
- `src/lib/mayakSessionTokens.js`
- `src/lib/mayakSessionRuntime.js`

Backing data files:
- `data/mayak-sessions.json`
- `data/mayak-session-tokens.json`
- `data/mayak-session-runtime.json`
- `data/mayak-session-files/`

What session mode adds:
- session-scoped tokens;
- table selection and participant registration;
- role assignment;
- one-inspector-per-table enforcement;
- extra administrator reviewer role;
- review queue and review timers;
- uploaded task-review files;
- session-specific blocking/rework flow.

Session runtime APIs:
- `/api/mayak/session-runtime/state`
- `/api/mayak/session-runtime/participant`
- `/api/mayak/session-runtime/review`
- `/api/mayak/session-runtime/role`
- `/api/mayak/session-runtime/upload`
- `/api/mayak/session-runtime/file`

Admin/session APIs:
- `src/pages/api/admin/mayak-sessions/*`
- `src/pages/api/admin/mayak-session-tokens/*`

Important working rule:
- do not collapse session-mode assumptions back into the legacy token model;
- session-mode has its own contract and runtime state.

### MAYAK onboarding domain

Onboarding is another dedicated MAYAK domain with separate public routes, admin constructor, storage, and file handling.

Public routes:
- `src/pages/mayak-onboarding/[slug]/index.js`
- `src/pages/mayak-onboarding/[slug]/participant.js`
- `src/pages/mayak-onboarding/[slug]/tech.js`

Server/domain modules:
- `src/lib/mayakOnboarding.js`
- `src/lib/mayakOnboardingStorage.js`
- `src/lib/mayakOnboardingProgress.js`
- `src/lib/mayakOnboardingQuestionnaire.js`
- `src/lib/mayakOnboardingDefaults.js`
- `src/lib/mayakOnboardingClient.js`

Main data/config/runtime files:
- `data/mayak-onboarding-config.json`
- `data/mayak-onboarding-links.json`
- `data/mayak-onboarding-submissions.json`
- `data/mayak-onboarding-files/`

Current public-flow behavior:
- external questionnaire must be opened first on the current device;
- only after that does role selection/public summary become available;
- participant and tech-specialist flows have different completion logic;
- progress is derived from live validation, not just a manual flag.

Admin surface:
- `src/pages/admin/mayak-onboarding.js`

This page acts as a constructor/dashboard for:
- sections and checklists;
- services;
- questionnaire link;
- example photos/instructions;
- onboarding links and progress tracking.

### MAYAK results and profile artifacts

Artifact storage helper:
- `src/lib/mayakProfileArtifacts.js`

Artifact/result storage shape:
- artifact files under `data/mayak-profile-artifacts/<userId>/<artifactId>/...`
- flattened/legacy-compatible result metadata in `data/results.json`

APIs:
- `src/pages/api/profile/mayak-artifacts.js`
- `src/pages/api/profile/mayak-artifacts/file.js`
- `src/pages/api/admin/mayak-results.js`

Admin UI:
- `src/pages/admin/mayak-results.js`

Working interpretation:
- result metadata and artifact files coexist;
- do not assume `results.json` alone is the full source of truth for downloadable outputs.

### MAYAK analytics, certificates, and AI evaluation

Analytics/report generation:
- `src/lib/analyticsGenerator.js`

Notes:
- builds analytics PDF with `@react-pdf/renderer`;
- can call external AI/model APIs through OpenRouter;
- may read settings/env values from `.env.local` or `.env`.

Qwen integration:
- `src/lib/mayakQwen.js`

Notes:
- handles MAYAK-OKO field scoring/evaluation;
- uses external Qwen endpoint and token pool/failover logic.

When changing evaluation or result-generation behavior:
- inspect both trainer-side hook wiring and the server-side generator/evaluator helpers;
- the user-facing score/colors and the backend/report side are related but not always in the same file.

### MAYAK Telegram integration

Bot startup entry:
- `instrumentation.js`

Main bot/runtime module:
- `src/lib/telegramBot.js`

Current responsibilities include:
- bot startup;
- webhook/polling selection;
- settings fallback;
- MAYAK-related Telegram delivery;
- prep-session-related bot behavior.

Related APIs:
- `src/pages/api/mayak/telegram-webhook.js`
- `src/pages/api/mayak/telegram-prepare.js`

Important working rule:
- saved MAYAK settings may override pure env assumptions for bot token/webhook behavior;
- check both env and persisted settings before deciding the active bot runtime contract.

### Prep-session and sidecar session app

Integrated main-app prep-session flow:
- page `src/pages/prep-session.js`
- API `src/pages/api/mayak/prep-session/*`
- style `src/styles/prep-session.css`

Standalone sidecar app:
- `telegram/session-app/`

Current interpretation:
- the integrated Next.js flow is part of the main operational app;
- `telegram/session-app/` looks like a separate prototype/older implementation with overlapping concepts;
- do not edit the sidecar app unless the task explicitly targets it.

### MAYAK active vs legacy map

Prefer these current paths first:
- current trainer UI: `src/components/features/tools-2/`
- current content storage: `src/lib/mayakContentStorage.js`
- current admin auth: `src/lib/mayakAdminAuth.js`
- current admin hub/pages: `src/pages/admin/*`
- current sessions domain: `src/lib/mayakSessions.js`, `src/lib/mayakSessionRuntime.js`
- current onboarding domain: `src/lib/mayakOnboarding*.js`, `src/pages/mayak-onboarding/*`

Treat these as legacy or compatibility paths until proven otherwise:
- `src/components/features/tools/`
- `src/pages/tools/mayak-oko-stable.js`
- `src/pages/api/mayak/content-data.js`
- `data/mayakData.json`
- `public/tasks-2/v2` as content source of last resort
- `telegram/session-app/`

### MAYAK invariants and guardrails

Do not break these assumptions casually:
- `sectionId` is the stable content slug, not just a display range;
- portal auth and MAYAK admin auth are separate systems;
- MAYAK profile-dependent flows require complete user FIO, not only auth presence;
- session mode is isolated from legacy token mode even if both end at the trainer;
- runtime data under `data/` is not automatically safe to commit;
- Cyrillic literals in source files may be encoding-sensitive;
- build verification should use webpack mode;
- compatibility with existing tokens, admin flows, Telegram flows, and JSON-backed storage should be preserved unless the task explicitly changes them.

## Task Index

When a task says:

`change portal shell or navigation`
- start with `src/components/layout/`
- then inspect the specific page under `src/pages/`

`change profile/auth behavior`
- start with `src/utils/auth.js`
- `src/pages/api/profile/info.js`
- `src/pages/api/profile/update.js`
- MAYAK entry also checks `src/components/features/tools-2/settings.js`
- then inspect backend ownership in `../back/RSK_back/auth_service` and `../back/RSK_back/user_profile`

`change portal/backend contract`
- start with the frontend proxy route under `src/pages/api/*`
- map it to the owning service in `../back/RSK_back`
- inspect backend route, schema, and any event-driven side effects before changing response handling

`change MAYAK trainer behavior`
- start with `src/pages/tools/mayak-oko.js`
- then `src/components/features/tools-2/trainer.js`
- then the specific extracted MAYAK hook used by that behavior

`change MAYAK content structure or files`
- start with `src/lib/mayakContentStorage.js`
- then `src/pages/api/mayak/content-bundle.js`
- `src/pages/api/mayak/content-file.js`
- admin editor: `src/pages/admin/mayak-content.js`

`change MAYAK token validation`
- start with `src/pages/api/mayak/validate-token.js`
- then check `src/utils/mayakTokens.js`
- and session token helpers if the issue is session-mode specific

`change MAYAK session mode`
- start with `src/lib/mayakSessions.js`
- `src/lib/mayakSessionTokens.js`
- `src/lib/mayakSessionRuntime.js`
- admin UI: `src/pages/admin/mayak-sessions.js`
- trainer/session UX: `src/components/features/tools-2/settings.js` and trainer session hooks

`change MAYAK onboarding`
- start with `src/pages/admin/mayak-onboarding.js`
- public flows in `src/pages/mayak-onboarding/[slug]/*`
- storage/logic in `src/lib/mayakOnboarding*.js`

`change MAYAK results or downloadable artifacts`
- start with `src/lib/mayakProfileArtifacts.js`
- `src/pages/api/profile/mayak-artifacts.js`
- `src/pages/api/admin/mayak-results.js`
- admin UI: `src/pages/admin/mayak-results.js`

`change MAYAK analytics or AI scoring`
- start with `src/lib/analyticsGenerator.js`
- `src/lib/mayakQwen.js`
- then inspect trainer hooks that invoke them

`change Telegram or delivery behavior`
- start with `src/lib/telegramBot.js`
- then `instrumentation.js`
- then relevant `/api/mayak/telegram-*` routes

`change prep-session behavior`
- first decide whether the task targets the integrated app or the standalone sidecar;
- integrated app: `src/pages/prep-session.js` and `/api/mayak/prep-session/*`
- sidecar prototype: `telegram/session-app/`

## Current Open Questions To Re-Check Before Large Refactors

These are not blockers for normal work, but they should be verified before major cleanup or consolidation:

- whether `data/mayak-content` is the real active content source in the target environment, or whether deployments still rely on `MAYAK_CONTENT_DIR` or `public/tasks-2/v2`;
- how much of `src/components/features/tools/` is still exercised in real usage versus kept only as fallback/history;
- whether `telegram/session-app/` is still used operationally anywhere or can be treated as historical only;
- which files under `data/` are intentionally versioned fixtures versus local/operator runtime artifacts that only remain tracked for historical reasons;
- whether alias admin routes should remain as compatibility contract or can eventually be removed after usage confirmation.

## Update Rule

Update this file whenever a task meaningfully changes:
- portal structure that affects navigation or ownership boundaries;
- MAYAK architecture, API contracts, storage layout, or runtime model;
- active-vs-legacy routing assumptions;
- admin auth model;
- the recommended file/task entrypoints above.
