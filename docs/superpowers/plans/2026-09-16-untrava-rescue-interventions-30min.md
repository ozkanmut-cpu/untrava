# UNTRAVA Rescue & Interventions — 30-Minute Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the first working local-first Rescue vertical slice in 30 focused minutes: validated versioned intervention contracts, deterministic selection, a resumable state machine, immutable event emission, offline recovery flow and green CI.

**Architecture:** Keep Rescue mobile-local and deterministic. Contracts live in `packages/contracts`; execution lives under `apps/mobile/src/rescue`; all historical facts are emitted through the existing `LocalEventStore`, while session state is separate operational state. No server, LLM or Support Circle dependency is allowed in the critical path.

**Tech Stack:** TypeScript 5.9, Zod 4, Vitest 3, existing mobile local event store/sync queue, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-16-untrava-rescue-interventions-design.md`

## Global Constraints

- Rescue is free, unlimited and offline-capable.
- No medication/NRT initiation or dosing advice.
- Deterministic eligibility/selection only; no LLM authority.
- Existing Quit Events remain append-oriented and immutable.
- Missing context reduces personalization; it never blocks core Rescue.
- `product_use` after Rescue transitions to Recovery without changing the user's goal automatically.
- Each task follows RED → minimal GREEN → commit; remote CI must be `completed/success` before the milestone is called green.

---

## Minute 0–5 — Task 1: Rescue contracts and library validation

**Files:**
- Create: `packages/contracts/src/rescue.ts`
- Modify: `packages/contracts/src/index.ts`
- Create: `packages/contracts/test/rescue.test.ts`

**Produces:** `RescueLibrarySchema`, `InterventionDefinitionSchema`, `RescueContextSchema`, `RescueOutcomeSchema`, `RescueSessionSchema` and inferred TS types.

- [ ] Write RED tests proving: schemaVersion must equal `1`; active interventions need at least one step; `(interventionId, version)` pairs are unique; at most one active version exists per intervention ID; `offlineCapable` must be `true`.
- [ ] Run `pnpm --filter @untrava/contracts test -- rescue.test.ts` and confirm failure because Rescue schemas do not exist.
- [ ] Implement Zod schemas with enums:
  - levels: `micro | guided | environment_escape | human_support`
  - families: `act | cbt | behavioral_coping | mindfulness_regulation | environment_change | human_support`
  - burden: `very_low | low | medium | high`
  - product intent: `cigarette | vape | heated_tobacco`
  - outcome: `no_use | use | unknown`
- [ ] Add `superRefine` library checks for duplicate identity/version and duplicate active IDs.
- [ ] Export all rescue schemas/types from `packages/contracts/src/index.ts`.
- [ ] Re-run contract test; commit `feat: add rescue intervention contracts`.

## Minute 5–10 — Task 2: Bundled library and deterministic selector

**Files:**
- Create: `apps/mobile/src/rescue/library.ts`
- Create: `apps/mobile/src/rescue/selector.ts`
- Create: `apps/mobile/test/rescue-selector.test.ts`

**Consumes:** `RescueLibrary`, `RescueContext`.

**Produces:** `selectIntervention(library, context, minimumLevel?) => InterventionSelection | null`.

- [ ] Write RED tests with a small in-test library proving: retired items are excluded; `canMoveEnvironment=false` excludes environment-change items; `canContactSupport=false` excludes human support; preferred IDs win; recently declined IDs lose priority; tie-breaking is stable by level → burden → ID → version.
- [ ] Run `pnpm --filter @untrava/mobile test -- rescue-selector.test.ts`; expect module-not-found failure.
- [ ] Implement selector as pure deterministic code; no random numbers, clock, server or AI.
- [ ] Add `createBundledRescueLibrary()` containing seven minimal definitions: regulation, urge-surfing, CBT reframe, delay/substitution, environment escape, human support, recovery action.
- [ ] Ensure every bundled item validates through `RescueLibrarySchema.parse(...)` before export.
- [ ] Re-run test; commit `feat: add deterministic rescue library selector`.

## Minute 10–15 — Task 3: Rescue state machine

**Files:**
- Create: `apps/mobile/src/rescue/session.ts`
- Create: `apps/mobile/test/rescue-session.test.ts`

**Produces:** `RescueSessionCoordinator` with `start`, `beginSelected`, `completeIntervention`, `reassess`, `requestSupport`, `reportUse`, `abandon`.

- [ ] Write RED tests for legal path `started → stabilizing → intervention_selected → intervention_active → reassessing → resolved` and escalation path `reassessing → escalating → intervention_selected`.
- [ ] Add RED tests that illegal transitions throw `invalid_rescue_transition`, `reportUse()` enters `recovery`, and `requestSupport()` enters `support_offered` only when context allows support.
- [ ] Run `pnpm --filter @untrava/mobile test -- rescue-session.test.ts`; confirm RED.
- [ ] Implement an explicit transition table; UI callers never set `state` directly.
- [ ] Pin each session to `libraryContentVersion`, `interventionId` and `interventionVersion` when selected.
- [ ] Re-run test; commit `feat: add rescue session state machine`.

## Minute 15–20 — Task 4: Immutable Rescue event emission

**Files:**
- Create: `apps/mobile/src/rescue/events.ts`
- Create: `apps/mobile/test/rescue-events.test.ts`
- Modify: `apps/mobile/src/foundation.ts`

**Consumes:** existing `LocalEventStore.append(event)` and existing `QuitEventEnvelope`.

**Produces:** `RescueEventSinkAdapter` and event factories for `intervention_started`, `intervention_completed`, `intervention_outcome`, `support_request`, `product_use`.

- [ ] Write RED tests using an in-memory `LocalEventDatabase` and real `LocalEventStore` proving event factories preserve `rescueSessionId`, intervention version, rescue level, library version and timestamps.
- [ ] Prove completion never rewrites start: after start+complete there are two distinct event IDs.
- [ ] Prove `reportUse` emits a new `product_use` event rather than mutating Rescue history.
- [ ] Run targeted test; confirm RED.
- [ ] Implement event factories accepting an injected `createEventId(): string` and clock timestamp so tests stay deterministic.
- [ ] Export `createRescueFoundation(...)` wiring coordinator + selector + event sink in `foundation.ts`.
- [ ] Re-run test; commit `feat: emit immutable rescue events`.

## Minute 20–25 — Task 5: Offline vertical Rescue + Recovery test

**Files:**
- Create: `apps/mobile/test/rescue-offline-flow.test.ts`
- Create: `apps/mobile/src/rescue/session-store.ts`

**Produces:** in-memory `RescueSessionStore` interface implementation suitable for current foundation tests; persistence adapter can later map to SQLite without changing coordinator API.

- [ ] Write one vertical RED test whose transport stub always throws `offline` but which still performs: start Rescue → select intervention → begin → complete → reassess → resolve; assert local event store contains start/completion/outcome events.
- [ ] In the same test start a second Rescue, call `reportUse`, enter recovery, select the `recoveryEligible` bundled intervention, complete it, and assert a local `product_use` plus recovery intervention events exist.
- [ ] Add resume assertion: save at `intervention_active`, recreate coordinator from stored session, and continue using the same pinned intervention/library version.
- [ ] Run `pnpm --filter @untrava/mobile test -- rescue-offline-flow.test.ts`; confirm RED.
- [ ] Implement minimal `MemoryRescueSessionStore` and coordinator persistence hooks after each valid transition.
- [ ] Re-run targeted test; commit `test: prove rescue works fully offline`.

## Minute 25–30 — Task 6: Full verification and remote gate

**Files:**
- Modify only if required by compiler/test discovery: `apps/mobile/tsconfig.json`.

- [ ] Ensure `src/rescue/**/*.ts` and all Rescue tests are inside mobile typecheck/test scope.
- [ ] Run full verification:
  ```bash
  pnpm lint
  pnpm typecheck
  pnpm test
  pnpm --filter @untrava/api prisma validate
  ```
- [ ] Fix only concrete failures; do not broaden scope into Intelligence, Support Circle, notifications or final content editorialization.
- [ ] Push `rescue-interventions` and inspect the check-run for the exact HEAD.
- [ ] If CI fails, inspect the first failing step/log, fix root cause, commit and repeat.
- [ ] Stop only when exact HEAD is `completed/success`.

## 30-Minute Acceptance Gate

This slice is complete when all are true:

- a bundled Rescue library validates and is usable without network;
- selection is deterministic and obeys eligibility/context;
- Rescue transitions are explicit and invalid transitions are rejected;
- every Rescue historical fact is an immutable local Quit Event;
- user product use enters Recovery without deleting/changing prior Rescue history or the goal;
- a Rescue session can resume from local operational state;
- an always-offline vertical test completes both resolve and recovery paths;
- full lint/typecheck/test/Prisma validation and remote CI are green.

Anything beyond this gate—evidence-library expansion, AI wording, predictive Risk, adaptive efficacy learning, notification delivery and real Support Circle—is intentionally deferred to later plans.