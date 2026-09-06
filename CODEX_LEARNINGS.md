# Codex Learnings

This file stores short project-specific lessons so repeated mistakes are not made across future tasks.

## Entry Format

- Problem: what failed or almost failed.
- Root cause: why it happened.
- Fix: what worked.
- Prevention: what to do next time before repeating the same action.

Add only verified, reusable lessons. Skip one-off noise.

## Learnings

### 2026-09-04 - Procedural Three.js props must not invoke useGLTF and Suspense; initial camera positioning on direct URL loads

- Problem: in 3D views with mixed procedural and GLTF models, procedural models could remain blank on initial load if `useGLTF` was invoked unconditionally in the same component, and direct URL navigation to a specific item (`?ray=...`) resulted in mid-flight camera captures due to damping delays.
- Root cause:
  1. Calling `useGLTF` triggers Suspense and asynchronous Draco WASM decoder initialization even when procedural geometry is being rendered, dropping the component to fallback `null`.
  2. With cylindrical damping camera animation, direct URL loads starting at `OVERVIEW` require seconds to interpolate to the target ray, causing headless tests or users to see a disoriented half-way view.
- Fix:
  1. Separate into `ProceduralProp` (instant synchronous Three.js group, rendered via `<primitive>` in idle mode) and `GLTFProp` (isolated inside `<Suspense fallback={null}>`).
  2. In `CameraRig`, check `isFirstMount`: on direct deep-link load with a ray specified, initialize camera and target immediately to `goal`, while keeping smooth damping for subsequent user clicks.
- Prevention: never wrap procedural Three.js assets in `useGLTF`/Suspense, and always snap camera to target on initial mount when deep-linking.

### 2026-09-04 - Three.js clipping planes must not be initialized with constant=0 and R3F animation loops require mutable refs

- Problem: 3D models displayed on pedestals in resting/idle mode (`isSolid`) were initially clipped away and invisible; additionally, during multi-phase transitions animation progress got trapped on frame 0 in `useFrame`.
- Root cause:
  1. `new THREE.Plane(new THREE.Vector3(0, -1, 0), 0)` evaluates `-y + constant < 0` (i.e. $y > 0$). Because pedestal top sits at $y = 0.1$, all model vertices have $y > 0.1$ and were clipped out before `useFrame` or during idle state.
  2. Reading and incrementing React `useState` within `useFrame` via `setT(t + dt)` reads the stale closure `t = 0` every frame, preventing time from advancing.
- Fix:
  1. Initialize `solidPlane` with `constant = 1000` (and `ghostPlane` with `-1000`), and set `clippingPlanes: isSolid ? [] : [solidPlane]` so resting models have clipping completely disabled.
  2. Maintain mutable transition timing in `progressRef` (`progressRef.current += dt / duration`) inside `useFrame` and synchronize to state with `setT(progressRef.current)`.
- Prevention: never initialize clipping planes with `constant = 0` when meshes sit above $y=0$, and always use `useRef` for delta accumulation inside animation loops.

### 2026-09-04 - React Three Fiber in frameloop="demand" requires warmup frames and explicit invalidate on async model resolution

- Problem: in `frameloop="demand"`, the 3D scene could stay blank on initial page load until an interactive DOM event occurred, even though the canvas mounted and GLTF models loaded.
- Root cause: with camera starting at the target position, `CameraRig` detected arrival on frame 0 and stopped requesting frames before asynchronous `<Suspense>` GLTF Draco decompression resolved. In `demand` mode, `useFrame` only runs during an actively requested frame, so it went completely idle.
- Fix: introduce a warmup counter in `CameraRig` rendering the first 25-30 frames on mount, and trigger `invalidate()` in `useEffect` whenever asynchronous models mount or props update.
- Prevention: when using `frameloop="demand"` with suspenseful 3D assets, always provide warmup frame invalidation on mount and dispatch `invalidate()` on asset readiness.

### 2026-03-27 - MAYAK portal auth must gate on profile name completeness, not on auth alone

- Problem: an already authorized platform user could still enter MAYAK with an empty profile name, which left certificate/history data without the required FIO.
- Root cause: the first linked MAYAK auth step treated a valid portal session and readable profile as sufficient, but certificate/runtime identity actually depends on `NameIRL + Surname`.
- Fix: keep the embedded portal auth flow, but after profile fetch explicitly require `Surname` and `NameIRL`; if either is missing, show an in-MAYAK mandatory FIO form and save it through `/api/profile/update` before trainer entry.
- Prevention: when MAYAK reuses platform identity for completion artifacts, validate the exact profile fields needed for those artifacts instead of assuming that “authorized user” automatically means “certificate-ready user”.

### 2026-03-27 - Embedded MAYAK OAuth needs an explicit return hook outside component state

- Problem: when platform OAuth was opened from MAYAK settings, Yandex could return the browser to the generic frontend entry instead of resuming the MAYAK token flow, and popup-based VK auth could finish without the original MAYAK tab noticing.
- Root cause: the backend OAuth callbacks redirect to the shared frontend URL, so an embedded MAYAK auth panel cannot rely on local React state alone to remember where to return or when auth finished.
- Fix: persist the MAYAK return target and pending token in web storage before external auth, redirect back to `/tools/mayak-oko` from `_app.js`, restore the pending token in MAYAK settings, and poll `/api/profile/info` for popup-based VK completion.
- Prevention: when embedding platform OAuth inside MAYAK instead of a dedicated auth page, always preserve return routing and token context outside the component tree before leaving the page.

### 2026-03-27 - MAYAK Telegram bot must read saved webhook settings before choosing polling

- Problem: the MAYAK Telegram bot could keep falling back to polling and spamming noisy polling errors even after the operator saved a webhook URL in admin settings.
- Root cause: bot startup read `TELEGRAM_WEBHOOK_URL` only from runtime env, while admin saved mutable bot settings in `data/mayak-settings.json`; webhook-only saves also did not trigger a bot restart.
- Fix: make bot startup resolve token/webhook from saved MAYAK settings with env fallback, and restart the bot after token or webhook changes only after both env values are updated.
- Prevention: when MAYAK admin can mutate bot runtime settings, make the bot read the same persisted source and restart once after all related fields are applied instead of relying on env-only state.

### 2026-03-26 - MAYAK onboarding runtime data should not live in source control by default

- Problem: onboarding link records, submissions, and uploaded participant photos accumulated in tracked `data/` files and started polluting release commits with manual test/runtime data.
- Root cause: MAYAK onboarding stores both editable config assets and live runtime state under nearby paths, so it is easy to treat everything under `data/mayak-onboarding-*` as commitable project content.
- Fix: keep runtime onboarding state out of Git by ignoring `data/mayak-onboarding-links.json`, `data/mayak-onboarding-submissions.json`, and `data/mayak-onboarding-files/submissions/`, while leaving intentionally tracked config/media assets under `data/mayak-onboarding-config.json` and `data/mayak-onboarding-files/links/config/`.
- Prevention: before committing MAYAK onboarding changes, separate config/schema/media updates from live link/submission/upload data and only stage the config side unless the task explicitly requires a fixture migration.

### 2026-03-26 - Bulk Windows rewrites can mojibake UTF-8 MAYAK admin files

- Problem: after scripted cleanup of MAYAK admin pages, Russian UI strings in `mayak-sessions.js` and `mayak-onboarding.js` turned into mojibake even though the code still built.
- Root cause: a bulk PowerShell rewrite on Windows re-saved UTF-8 JavaScript source through the wrong text path, which preserved code structure but corrupted Cyrillic string literals.
- Fix: after bulk cleanup, re-read the affected file with explicit UTF-8, reverse the mojibake where needed (`cp1251 bytes -> utf8`), and re-save with explicit UTF-8 without BOM.
- Prevention: when using scripted bulk edits on MAYAK files with Cyrillic UI text, always verify several Russian string literals and `git diff` immediately after the write instead of trusting a green build alone.

### 2026-03-26 - Hidden JSX still needs its component imports

- Problem: a MAYAK admin page crashed with `ReferenceError: Link is not defined` even though the old nav block was visually hidden with `display: none`.
- Root cause: React still evaluates JSX inside hidden blocks, so removing the `Link` import without deleting that hidden markup left a live runtime reference.
- Fix: restore the missing import immediately, then clean dead hidden JSX separately if needed.
- Prevention: when removing MAYAK navigation code, search for hidden JSX remnants before deleting component imports; hidden markup is still real runtime code.

### 2026-03-26 - MAYAK admin frontend must not require sessionStorage on top of the auth cookie

- Problem: direct opening of a MAYAK admin page could still show a login screen even when the valid MAYAK admin cookie already existed, and each admin page duplicated its own login UI.
- Root cause: frontend MAYAK admin pages were gating access by two conditions at once: the real server-side auth cookie and an extra page-local `sessionStorage` flag.
- Fix: keep `/api/admin/mayak-auth` + httpOnly cookie as the only auth source, move the login entry to `/admin`, and redirect unauthenticated MAYAK admin pages to `/admin?next=...`.
- Prevention: when extending MAYAK admin UX, do not introduce a second required client-side auth flag if the server cookie already represents the canonical admin session.

### 2026-03-25 - MAYAK participant laptop ownership must not gate required onboarding sections

- Problem: in onboarding, choosing that the organization provides the laptop could hide the participant's hardware checklist and service-registration confirmations, which made the flow look complete even though required preparation was skipped.
- Root cause: `participantLaptopType` was treated as a branching rule for which sections exist, instead of as metadata about who owns the laptop.
- Fix: keep the laptop-type choice only as informational metadata and always derive participant readiness from the full laptop checklist plus service confirmations once a laptop type is selected.
- Prevention: when MAYAK onboarding uses a choice only to classify context, do not let that flag remove required sections from progress calculation or UI rendering unless the product contract explicitly says the requirements differ.

### 2026-03-25 - This Next 16 repo must build with explicit `--webpack` until Turbopack config is added

- Problem: `npx next build` failed before useful validation with `This build is using Turbopack, with a webpack config and no turbopack config`.
- Root cause: after the Next 16 upgrade, Turbopack is the default builder, but this repository still relies on a custom `webpack` configuration and does not yet define a matching `turbopack` config.
- Fix: run production validation as `npx next build --webpack`, which compiled the project successfully.
- Prevention: until the repo is migrated to Turbopack or adds an explicit `turbopack` section in `next.config.js`, always use `--webpack` for reliable build verification in this workspace.

### 2026-03-24 - MAYAK admin file uploads must clear hidden input values after async handlers

- Problem: onboarding constructor image uploads could appear broken when an admin retried the same photo-instruction file for a tech-specialist block.
- Root cause: the hidden `input[type=file]` kept its previous value after the async upload handler finished, so selecting the same file again did not fire a new `change` event.
- Fix: always reset `event.target.value = ""` in the upload input `finally` block and keep the async state local to the uploader UI.
- Prevention: for MAYAK admin upload controls built on hidden file inputs, clear the input after every handled selection so retries with the same file remain possible.

### 2026-03-24 - Large MAYAK onboarding images should not be uploaded as base64 JSON

- Problem: some larger onboarding PNGs failed with `Maximum call stack size exceeded` even though the file size was well below the nominal route limits.
- Root cause: onboarding image uploads were sent as `data:` URLs inside JSON, which inflated payload size and hit unstable request/body handling on the Next.js upload routes.
- Fix: send onboarding images as `multipart/form-data`, parse them server-side as files in both admin and public tech-specialist flows, and keep the old JSON path only as a backward-compatible fallback.
- Prevention: for MAYAK onboarding image uploads, do not serialize real files into base64 JSON unless there is no binary upload option; prefer multipart transport from the start.

### 2026-03-25 - MAYAK delta-test storage must accept both nested per-user payloads and flat event payloads

- Problem: different MAYAK runtime paths sent delta/ranking data in two incompatible shapes, which risked broken writes or malformed keys in `DeltaTest.json`.
- Root cause: `saveDeltaTest` assumed only the nested `{ [userId]: { [timestamp]: value } }` format, while some callers already posted flat event objects with `user` and `date`.
- Fix: normalize both payload shapes server-side inside `/api/mayak/saveDeltaTest` before writing, so legacy and new runtime calls land in the same store.
- Prevention: when MAYAK uses JSON-backed append APIs, normalize payload variants at the route boundary instead of assuming every client path already shares one exact envelope.

### 2026-03-24 - MAYAK onboarding links must allow single-day sessions without a second required date

- Problem: admin could not create an onboarding link for a one-day event because the constructor required both start and end dates.
- Root cause: the form and `createMayakOnboardingLink()` treated `endDate` as mandatory instead of an optional multi-day window.
- Fix: keep `eventDate/startDate` required, make `endDate` optional in both UI and server validation, and display only one date when `endDate` is empty.
- Prevention: for MAYAK scheduling fields, model the single-day case explicitly instead of forcing operators to duplicate one date into two required inputs.

### 2026-03-24 - Participant laptop checks can disappear when onboarding config leaves `participantSections.laptop.items` empty

- Problem: the participant onboarding flow could lose the required personal-laptop parameter checklist even though the tech flow still showed the laptop requirements.
- Root cause: `data/mayak-onboarding-config.json` allowed `participantSections.laptop.items` to be empty, and the participant page trusted that empty array as the full contract.
- Fix: store the participant laptop checklist as its own `participantSections.laptop.items` array and also normalize old configs by cloning the tech `laptops` items into that participant section when it is empty.
- Prevention: for MAYAK onboarding JSON import/export, keep participant and tech laptop checklists as separate persisted section entities even if their initial contents are identical.

### 2026-03-24 - MAYAK onboarding readiness must be derived from live checklist validation, not from manual section-confirm buttons

- Problem: tech onboarding could keep showing stale progress after the user ticked checkboxes or uploaded the last required photo, and completion depended on extra manual `Раздел готов` / `Завершить подготовку` actions.
- Root cause: the UI percentage and final `completed` flag were tied to persisted `completedSections` markers instead of recalculating readiness from the current checklist state on every save.
- Fix: recompute `completedSections`, progress percentage, and final `completed` directly from the live checklist items and required photo counts inside each save path, so the last required action auto-completes the onboarding.
- Prevention: for MAYAK onboarding flows with autosave, do not treat `completedSections` as an independent source of truth; derive it from current validation every time checklist data changes.

### 2026-03-24 - New MAYAK pages must not rely on raw `button` defaults for card-like UI

- Problem: newly added MAYAK onboarding cards looked visually broken because some interactive blocks unexpectedly inherited black backgrounds and platform button typography.
- Root cause: the shared project styles define global rules for plain `button`, so new page-level card/button compositions can be restyled by the base MAYAK CSS unless they explicitly override it.
- Fix: for custom MAYAK surfaces, either use non-button containers for card navigation or add explicit override classes (`!bg-*`, `!border-*`, `!w-auto`, etc.) so the component does not depend on global button defaults.
- Prevention: when building new MAYAK UI outside the legacy design system, inspect global `button` rules first and harden interactive cards/buttons against inherited platform styling before polishing the layout.

### 2026-03-24 - MAYAK onboarding slug pages must read the dynamic slug from the router, not `window.location.pathname`

- Problem: a newly created onboarding link could open the public landing page with `Ссылка онбординга не найдена`, especially when the slug contained Cyrillic characters.
- Root cause: the landing page parsed the slug from `window.location.pathname`, which can keep the path segment URL-encoded; the client then encoded that value again for the API request and missed the stored slug.
- Fix: read the slug from `next/router` query params on the client, encode only when constructing outgoing URLs, and keep a server-side decode fallback in onboarding slug lookup.
- Prevention: for Next.js dynamic MAYAK routes, do not derive identifiers from raw `location.pathname` if the same identifier is later passed through `encodeURIComponent`; use router params as the source of truth.

### 2026-03-17 - Session-mode trainer code must not treat `active_user` as a raw cookie string

- Problem: MAYAK session features need `sessionId`, `tableNumber`, and `userId`, but some runtime code still treated `active_user` as a plain encoded cookie string.
- Root cause: older trainer helpers only needed a loose user key for local stats, so they read `document.cookie` directly instead of parsing the structured `active_user` payload.
- Fix: use `getUserFromCookies()` for MAYAK session/runtime work and pass explicit `activeUserId` into hooks that only need a stable identifier.
- Prevention: when adding new MAYAK session logic, do not read `active_user` through ad-hoc string splitting if the code needs structured participant/session fields.

### 2026-03-17 - Word preview conversion should not assume `libreoffice` is on PATH

- Problem: session review upload on local Windows failed with `spawn libreoffice ENOENT` during `doc/docx -> pdf` conversion.
- Root cause: the runtime called `libreoffice` directly and assumed the binary existed in the process PATH, which is not guaranteed on Windows or some server deployments.
- Fix: resolve the converter through `MAYAK_LIBREOFFICE_PATH` first, then fall back to standard `soffice/libreoffice` names and common Windows install paths, and return a human-readable setup error if nothing is found.
- Prevention: whenever MAYAK depends on external binaries, add an explicit env override and a readable configuration error instead of trusting PATH-only discovery.

### 2026-03-17 - MAYAK role constants must not depend on literal Cyrillic source bytes

- Problem: session runtime accepted a role value that looked like `ИНСПЕКТОР`, but the inspector-specific logic still did not fire and uniqueness checks were bypassed.
- Root cause: the source file had a codepage/encoding mismatch, so literal Cyrillic comparisons in JavaScript were not byte-stable even though they looked correct in some tools.
- Fix: move critical MAYAK role constants to Unicode-escaped literals and compare against those constants server-side.
- Prevention: for MAYAK business-critical string enums used in API/runtime logic, prefer stable constants (ASCII keys or Unicode escapes) instead of trusting visually correct Cyrillic literals in source files.

### 2026-03-06 - apply_patch sandbox failure in this workspace

- Problem: `apply_patch` can fail here with `windows sandbox: setup refresh failed with status exit code: 1`, which blocks normal file edits.
- Root cause: the current Codex Windows sandbox in this workspace is unstable for `apply_patch`, even when the target file is inside the writable project root.
- Fix: retry once, then switch to an escalated PowerShell write operation when the patch tool failure is environmental rather than a file-content conflict.
- Prevention: do not keep retrying `apply_patch` repeatedly in this repository after the same sandbox error appears; move to the PowerShell fallback and continue the task.

### 2026-03-06 - ESLint config fails before file-level validation

- Problem: `npx eslint src/components/features/tools-2/trainer.js` fails before linting with `TypeError: Converting circular structure to JSON`.
- Root cause: the current ESLint configuration chain in this repository contains a circular plugin/config structure, so lint cannot be trusted as a file verification step.
- Fix: when this happens, use an independent syntax check for the edited file, for example `@babel/parser` with the `jsx` plugin.
- Prevention: do not treat an ESLint failure in this repository as proof that the edited file is broken until the failure is separated from the shared ESLint config.

### 2026-03-06 - FFmpeg colorkey for transparent mascot video

- Problem: converting `mascot-bad.mp4` to a transparent video initially produced a WebM with alpha metadata, but the white background still stayed visually opaque.
- Root cause: applying `colorkey` before converting frames to RGBA was not enough for this asset; the keying step needed an explicit RGBA stage first.
- Fix: use `format=rgba,colorkey=0xFCFCFC:0.12:0.02,format=yuva420p` before VP9 WebM encoding.
- Prevention: for future MAYAK mascot/video cutouts, validate transparency on a test frame first instead of trusting `alpha_mode=1` alone.

### 2026-03-06 - APNG is easier to verify than alpha WebM for this mascot

- Problem: the alpha WebM pipeline exposed transparency metadata, but local frame extraction still made browser-visible transparency hard to trust.
- Root cause: VP9 alpha is more awkward to validate quickly in local tooling than a directly inspectable animated PNG.
- Fix: for this mascot, export a transparent APNG with `format=rgba,colorkey=0xFCFCFC:0.12:0.02` and use it as the animated asset.
- Prevention: when the goal is a short UI mascot animation without background, prefer APNG if you need straightforward visual and pixel-level verification.

### 2026-03-06 - Large APNG UI assets cause visible hanging

- Problem: the first transparent mascot APNG was about 60 MB at `960x960`, which made the small UI animation feel laggy and heavy.
- Root cause: the asset was exported at source resolution and full frame rate even though the interface only renders it around `96-112px`.
- Fix: re-export the mascot APNG close to display size (`224x224`) while keeping a smooth frame rate close to the source (`24 fps`), which preserved motion quality and kept the file around 3 MB.
- Prevention: for MAYAK UI mascots, export animated PNGs near their actual render size instead of relying on browser downscaling.

### 2026-03-06 - Qwen gateway reports expired tokens as 500, not 401

- Problem: the MAYAK Qwen gateway can return HTTP `500` when a token is expired or invalid, which makes naive status-only retry logic miss automatic rotation.
- Root cause: `https://qwen.aikit.club/v1/chat/completions` wraps session/token failures inside a generic upstream error body like `Your session has expired, or the token is no longer valid`.
- Fix: classify retryable Qwen failures by both status code and response text, then fall through to the next token in the pool.
- Prevention: do not rely only on `401/403/429` when implementing Qwen failover in this repository; inspect the upstream body for expiry/invalid/limit markers too.

### 2026-03-06 - PDF extraction is more reliable from an ASCII temp filename

- Problem: extracting local MAYAK reference PDFs through Node can fail or produce brittle path handling when the source filename stays in Cyrillic.
- Root cause: the current Windows toolchain in this workspace is more reliable with ASCII temp filenames when piping inline Node scripts and local file paths together.
- Fix: copy the source PDF to an ASCII scratch filename like `tmp_pdf_tools/input.pdf`, run `pdf-parse` there, and write the tracked UTF-8 markdown mirror back into `docs/local-product-context/`.
- Prevention: for future local reference-document conversions in this repository, stage the binary into an ASCII temp path before parsing instead of reading the Cyrillic path directly.

### 2026-03-06 - Qwen structured output is more stable with a minimal schema

- Problem: when the Qwen evaluator is asked to return rich per-field commentary, it is more likely to drift into alternative JSON wrappers or verbose extras.
- Root cause: the gateway model follows strict JSON more reliably when the required schema is narrow and the detailed user-facing phrasing is assembled server-side.
- Fix: request only `summary` plus ordered `field_assessments[{code, zone}]`, then derive compact strong/weak field feedback and overall zone inside `mayakQwen.js`.
- Prevention: for MAYAK prompt scoring, keep the model response schema minimal and move presentational aggregation out of the LLM prompt unless raw field comments are absolutely required.

### 2026-03-08 - Component callbacks cannot be referenced before declaration

- Problem: the trainer crashed at runtime with `Cannot access 'syncQwenEvaluationQuota' before initialization`.
- Root cause: a `useEffect` dependency referenced a `const ... = useCallback(...)` declared later in the same component, which hits the JavaScript temporal dead zone during component initialization.
- Fix: move the dependent `useEffect` below the callback declarations, or hoist the referenced function above all effects that use it.
- Prevention: when adding new hooks in large React components in this repository, keep helper callbacks above the effects that depend on them instead of relying on function-hoisting semantics that do not apply to `const`.

### 2026-03-09 - Animated WebP is a better final-format choice for smooth transparent MAYAK mascots

- Problem: APNG was easy to verify for transparent mascots, but smooth versions with interpolated frames became too heavy for responsive UI playback.
- Root cause: doubling frame count in APNG inflates file size quickly, while the browser still only renders a small mascot around 96-112px.
- Fix: keep APNG or PNG exports for verification/last-frame work, but ship the final smooth mascot as animated WebP near display size (`224x224`) with frame interpolation when the UI needs softer motion.
- Prevention: for future MAYAK mascot upgrades, compare transparent APNG against animated WebP before shipping and prefer animated WebP when motion smoothness matters more than pixel-inspection convenience.

### 2026-03-09 - Switching a mascot from animated WebP to a separate PNG can look like a fake blink

- Problem: the bad-result owl appeared to "blink" at the end even though the source animation did not actually close the eyes.
- Root cause: the UI swapped from the animated WebP to a separately exported PNG whose pose did not exactly match the final animation frame, creating a visible jump.
- Fix: keep the MAYAK mascot rendered on the animated asset instead of switching to a separate static fallback frame.
- Prevention: when a MAYAK mascot should visually stop on its last pose, do not assume an exported PNG matches the real final frame of the animated asset; verify exact frame parity first or avoid the swap entirely.

### 2026-03-09 - Qwen field scoring becomes falsely positive when the prompt forces praise and seeded green examples

- Problem: the MAYAK Qwen evaluator could praise clearly mismatched fields, for example treating an API-documentation mission as a strength for a dorm-activity task.
- Root cause: the model prompt pushed it to "first praise strong fields" and the JSON template itself seeded several fields as `green`, which biased the output toward artificial positives.
- Fix: rewrite the evaluator prompt to prioritize truthful task alignment, explicitly mark cross-domain substitutions as `red`, allow summaries with no strong fields, and use neutral zone placeholders in the response template instead of prefilled green examples.
- Prevention: for MAYAK scoring prompts, do not require balanced praise when the submission is plainly off-task, and do not anchor the model with example zone values that imply success by default.

### 2026-03-09 - Medium-quality MAYAK prompts need deterministic downgrades after Qwen scoring

- Problem: even after the prompt rewrite, Qwen still tended to over-score medium submissions as `green` when fields were generic but not obviously wrong.
- Root cause: model-side truthfulness improved for clearly bad cases, but generic phrases like short audience/role/format fields still sounded acceptable enough for the LLM to mark them green.
- Fix: pass raw `fields` and `taskContext` into `normalizeQwenEvaluation()` and apply field-specific specificity guards server-side, downgrading weakly grounded `green` fields straight to `red` because field-level scoring in MAYAK now allows only `green/red`; keep the intermediate `yellow` only for the overall prompt result by green-field count.
- Prevention: for MAYAK scoring, do not trust the upstream model alone for the middle band; keep a deterministic post-normalization layer that checks task anchoring, numeric requirements, and field specificity.

### 2026-03-09 - User-facing Qwen summaries must not leak transport field names

- Problem: the MAYAK Qwen evaluator could mention transport keys like `task_context` in the user-visible summary, which reads like debug output instead of product text.
- Root cause: the prompt and normalization layer allowed the model to echo technical input names back into the final explanation.
- Fix: explicitly forbid service-key mentions in the prompt and sanitize the final summary server-side before returning it to the trainer.
- Prevention: when MAYAK passes structured payloads to an LLM, treat transport field names as internal API details and strip them from any user-facing text.

### 2026-03-09 - One-shot animated WebP mascots need a timeout because <img> has no ended event

- Problem: a MAYAK mascot animation that should fly away once and disappear cannot be stopped cleanly when rendered as an animated WebP inside <img>.
- Root cause: animated WebP keeps playing inside the image element, but the browser does not provide an ended event for that playback.
- Fix: store per-asset playback metadata like hideAfterMs, schedule a timeout when the asset starts, and hide the mascot after that duration.
- Prevention: when a MAYAK animated WebP must behave like a one-shot clip instead of a loop, attach explicit timing metadata in code instead of expecting media-style lifecycle events.

### 2026-03-09 - Short field-fix guidance is safer to assemble server-side than to request as verbose LLM output

- Problem: users need a bit more explanation about what to fix in weak MAYAK fields, but widening the Qwen JSON schema makes structured output less stable.
- Root cause: the more per-field prose the model is forced to emit, the easier it is for the response to drift away from the exact JSON contract.
- Fix: keep the upstream schema minimal (`summary` + `field_assessments`) and build one short server-side correction sentence that is folded into the main summary instead of asking the model for verbose field commentary.
- Prevention: when MAYAK needs corrective feedback, prefer a compact summary plus strong/weak field lists over a separate long `Как усилить` block with repetitive phrasing.

### 2026-03-09 - Anchor-word hints create noisy MAYAK feedback

- Problem: server-generated Qwen hints started repeating low-value phrases like `мэрия, запускает, новый` in every recommendation.
- Root cause: the guidance layer tried to reuse extracted task-anchor words literally, which reads mechanical and rarely helps the user improve the prompt.
- Fix: remove anchor-word hints and keep one compact weak-fields note built from field semantics instead of raw task tokens.
- Prevention: when MAYAK needs corrective feedback, do not surface extracted anchor words directly to the user unless they carry clear instructional value.

### 2026-03-09 - Qwen field guards should reject only obvious noise, not overfit task details

- Problem: server-side MAYAK field guards started downgrading valid fields like `Миссия` because of incidental details such as `15 минут` in the task text.
- Root cause: numeric and highly specific heuristics in `applyFieldSpecificityGuards()` were overfitting task wording and overriding otherwise sensible LLM judgments.
- Fix: remove numeric and field-specific micro-rules from the guard layer and keep only a soft fallback that downgrades obviously empty or meaningless `green` fields.
- Prevention: use server-side guards only for broad sanity checks; do not encode narrow task-pattern logic there unless the product explicitly requires rigid validation.

### 2026-03-09 - Single-process Qwen pools should pick the least-loaded token, not always start from the first

- Problem: when several users hit MAYAK Qwen at once, always iterating the token pool from the first token concentrates load on the same credential and makes rate-limit spikes more likely.
- Root cause: the old handler treated the token pool only as failover order, not as a live load-balancing pool.
- Fix: keep per-token active-request counters in process memory, choose the least-loaded token for each new request, and still release the token in `finally` so failover retries and concurrent users rebalance naturally within one Node instance.
- Prevention: in this repository, if Qwen traffic can overlap and the app runs as a single Node process, prefer least-loaded in-memory token selection over fixed first-token iteration.

### 2026-03-09 - Do not assign or depend on NEXT_PUBLIC env vars inside Next API routes

- Problem: the MAYAK admin settings API started failing with SyntaxError: Invalid left-hand side in assignment and returned the Next HTML error page instead of JSON.
- Root cause: process.env.NEXT_PUBLIC_BASE_URL was used inside an API route; Next inlined it to a string literal in the dev bundle, and an old runtime assignment produced invalid compiled code in the server bundle.
- Fix: remove runtime assignment to NEXT_PUBLIC_BASE_URL, stop reading NEXT_PUBLIC values in this server route, and use server-managed settings or a server-only env like BASE_URL instead.
- Prevention: never write to process.env.NEXT*PUBLIC*\* at runtime inside API routes, and avoid using public env names as mutable server configuration.

### 2026-03-09 - Animated WebP mascots should restart by remount, not by cache-busting the URL

- Problem: MAYAK owl animations could feel much less smooth in the trainer than the source asset, especially on repeated plays.
- Root cause: the UI restarted the mascot by appending a changing `?v=...` query to the animated WebP URL, which forced the browser to treat each playback as a new resource and re-decode the heavy asset.
- Fix: restart the mascot by remounting the `<img>` with a React `key`, keep the URL stable, and preload the mascot assets once on page load.
- Prevention: for MAYAK animated mascot playback, do not use cache-busting query params as the replay mechanism unless a real asset version change is intended.

### 2026-03-11 - Live MAYAK content should not be served to the trainer directly from public JSON files

- Problem: editable MAYAK v2 content could load slowly and become inconsistent after admin edits because the trainer fetched many public JSON files directly and the running Next process could keep serving stale or missing files.
- Root cause: the trainer treated live MAYAK content as static web assets in `public/tasks-2/v2`, while that content is actually server-managed runtime data that changes through the admin panel.
- Fix: move the runtime contract behind server APIs and a shared MAYAK content storage module, then let the trainer and admin previews read files through those APIs instead of direct `/tasks-2/v2/...` URLs.
- Prevention: for MAYAK content that is editable in production, do not couple the trainer runtime to direct public-file fetches; use a server-side storage path plus API facade from the start.

### 2026-03-10 - MAYAK empty ranges break when index.json loses task numbers

- Problem: some MAYAK sections opened in the content admin without row numbering because the range looked empty even though index.json still had 100 entries.
- Root cause: those index.json files had been saved with truncated task objects that no longer included the required `number` field, and the admin tasks API trusted that malformed payload on save.
- Fix: restore the missing `number` values in the broken section files and reject future saves in `/api/admin/mayak-content/tasks` when any task row has an empty number.
- Prevention: when creating or bulk-editing MAYAK ranges, verify that every index.json row keeps its `number` before saving; do not accept partial task objects as valid section content.

### 2026-03-11 - MAYAK admin auth should use server env plus httpOnly cookie, not hardcoded passwords in UI or API

- Problem: MAYAK admin pages and API routes kept the same hardcoded password in multiple client and server files, which made the secret part of the bundle and forced every admin request to resend it.
- Root cause: admin access had grown from local page-level checks instead of a shared server-side auth contract.
- Fix: move MAYAK admin password to `MAYAK_ADMIN_PASSWORD`, add a dedicated `/api/admin/mayak-auth` login route that sets an httpOnly cookie, and let MAYAK admin pages and APIs trust that cookie instead of query/body passwords.
- Prevention: for MAYAK admin flows, never keep the admin password in frontend code or duplicate it across API handlers; use one shared server auth helper.

### 2026-03-11 - MAYAK token validation must not keep server-side bypass tokens after client cleanup

- Problem: even after removing fixed and bypass token logic from the MAYAK client, `/api/mayak/validate-token` could still accept a hardcoded admin bypass token and skip the real token storage rules.
- Root cause: token-flow cleanup only touched the frontend first, while the API still had a legacy special-case branch.
- Fix: remove `ADMIN_BYPASS_TOKEN` handling from the MAYAK token validation API and let both token checks and token usage go only through `validateToken()` and `useToken()` from the shared token store.
- Prevention: when cleaning MAYAK auth or token flows, audit both client and API layers; removing a bypass only on the frontend is incomplete.

- 2026-03-11: PowerShell write flows can corrupt Cyrillic in MAYAK source/config files into mojibake/question marks. Root cause: `Set-Content`, `Out-File`, or here-string -> node replacements can pass through the wrong encoding/BOM path on Windows. Fix: prefer `apply_patch`; if a script fallback is unavoidable, force UTF-8 without BOM and verify the saved bytes with Node or Git diff, not PowerShell display alone. Prevention: do not use generic PowerShell file writes for MAYAK files that contain Cyrillic UI, config text, or business strings.

### 2026-03-11 - MAYAK refactor progress should be tracked in a dedicated status file before context compression

- Problem: long MAYAK refactor sessions can lose operational progress after context compression if the current state lives only in chat memory.
- Root cause: `CODEX_LEARNINGS.md` stores reusable lessons, not the live status of what was refactored, what remains, and what still needs server follow-up.
- Fix: keep a dedicated progress file at `docs/mayak-refactor-status.md`, update it after important MAYAK changes and before likely compression points, and read it first after compression.
- Prevention: do not rely on conversational memory alone for long MAYAK refactors; preserve live execution status in the dedicated status file and reserve `CODEX_LEARNINGS.md` for reusable lessons only.

### 2026-03-11 - Default MAYAK storage fallback must prefer a valid content root, not the first existing directory

- Problem: MAYAK runtime could silently load empty content when `data/mayak-content` existed but did not actually contain valid MAYAK files, because that directory was chosen ahead of the real legacy content root.
- Root cause: content storage fallback previously selected the first existing directory instead of checking whether it contained a valid MAYAK manifest or section data.
- Fix: keep `MAYAK_CONTENT_DIR` as the explicit override, but otherwise choose the first valid MAYAK storage root and use atomic JSON writes for manifest/section saves.
- Prevention: when MAYAK content can live in multiple candidate directories, treat directory existence and content validity as separate checks; do not let an empty placeholder directory win over a valid storage root.

### 2026-03-18 - LibreOffice conversion on Windows needs an ASCII temp/workspace, not the default user TEMP

- Problem: MAYAK `docx/pptx -> pdf` preview conversion could hang in `processing` or fail with `source file could not be loaded` / `Io Write Code:16`, even when LibreOffice was installed correctly.
- Root cause: in this Windows environment the default TEMP/TMP path and profile/temp handling for LibreOffice are unreliable; direct conversion from the long workspace path left `soffice` processes hanging or unable to load/write files.
- Fix: run LibreOffice with an isolated ASCII workspace inside the repo, copy the source file to a short ASCII temp path, set `TEMP` and `TMP` explicitly for the conversion process, and log stdout/stderr for diagnosis.
- Prevention: for MAYAK office preview conversion on Windows, do not invoke `soffice` directly against the original workspace path with the ambient TEMP; stage files into an ASCII temp workdir and override `TEMP/TMP` first.

### 2026-03-18 - Session upload text limits must match in trainer UI and upload API

- Problem: MAYAK session review popup showed a 1000-character text limit, but users still got a 300-character error when sending the answer.
- Root cause: the upload API had already been updated to 1000, but rainer.js still kept an older client-side guard and error message for 300.
- Fix: update both the trainer-side validation and the API/runtime storage to the same limit, and verify the full request path instead of only the endpoint.
- Prevention: when MAYAK changes user-visible limits in session review flow, grep both trainer UI and runtime API/storage for the old numeric guard before considering the task done.

### 2026-03-19 - Reviewer permissions must not be hardcoded to `ИНСПЕКТОР` if a second reviewer role exists

- Problem: adding a session-level `АДМИНИСТРАТОР` reviewer role would look correct in UI/admin data but still fail to receive queues or resolve reviews if runtime checks stayed tied to `ИНСПЕКТОР` only.
- Root cause: the original session review logic encoded reviewer capability as one literal role instead of a shared reviewer-role group.
- Fix: centralize reviewer-role checks in runtime and use that helper everywhere queue access and review resolution are validated.
- Prevention: when MAYAK adds a role with reused business permissions, audit all server-side role comparisons before shipping the new UI.
- Prevention: when changing MAYAK submission limits, search both trainer UI guards and API/runtime validators so the contract stays synchronized.

### 2026-03-18 - Session table selects need an explicit default when the placeholder is removed

- Problem: after removing the placeholder option from the session registration table select, users could not reliably choose table 1.
- Root cause: the controlled React select still held an empty value, while the browser visually showed the first option, so choosing the first real option did not change state.
- Fix: when session-mode registration becomes available and no table is selected yet, prefill ableNumber with "1".
- Prevention: if a controlled MAYAK select has no placeholder option, initialize it to a valid real option instead of leaving the value empty.
