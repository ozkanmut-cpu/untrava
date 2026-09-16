# Tobacco Module Boundary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move Tobacco-specific contracts and Rescue composition behind an explicit Tobacco Module boundary while preserving all existing Tobacco behavior and compatibility APIs.

**Architecture:** Keep `@untrava/contracts` as the workspace package for now, but split ownership inside it into domain-neutral `core/` contracts and Tobacco-owned `tobacco/` contracts. In mobile, keep reusable Rescue engine mechanics under `apps/mobile/src/rescue/` and move Tobacco bundled content/eligibility composition under `apps/mobile/src/tobacco/rescue/`. Existing exports and `createRescueFoundation()` remain compatibility façades during migration.

**Tech Stack:** TypeScript, Zod, Vitest, pnpm workspace, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-16-untrava-core-generalization-design.md` and `docs/superpowers/specs/2026-09-16-untrava-behavior-change-core-boundaries.md`

## Global Constraints

- Work only on branch `rescue-interventions`.
- Do not merge or modify `main`.
- Do not use or modify any VDS/production environment.
- Existing Tobacco event IDs, goal IDs, Rescue/Recovery semantics and acceptance behavior must remain unchanged.
- Core code must not import Tobacco schemas.
- Compatibility names such as `QuitEvent*`, `GoalType`, and `createRescueFoundation()` remain available during this migration.
- Exact HEAD GitHub CI must be `completed/success` before #29 is complete.

---

### Task 1: Add domain-neutral Core contracts and boundary test

**Files:**
- Create: `packages/contracts/src/core/events.ts`
- Create: `packages/contracts/src/core/goals.ts`
- Create: `packages/contracts/test/core-boundary.test.ts`
- Modify: `packages/contracts/src/index.ts`

**Interfaces:**
- Produces `BehaviorEventEnvelopeBaseSchema`, `CoreGoalRecordSchema`, `ModuleIdSchema`.
- Existing Tobacco contracts continue to compile unchanged.

- [ ] **Step 1: Write failing boundary/contract tests**

Create tests that import `../src/core/events` and `../src/core/goals`, parse a non-Tobacco module id such as `example_behavior`, and verify no Tobacco-specific enum is required.

- [ ] **Step 2: Run contracts tests and verify RED**

Run: `pnpm --filter @untrava/contracts test -- core-boundary.test.ts`
Expected: FAIL because the new Core modules do not exist.

- [ ] **Step 3: Add minimal domain-neutral schemas**

`core/goals.ts`:
```ts
import { z } from 'zod';
import { UserIdSchema } from '../ids';

export const ModuleIdSchema = z.string().min(1);

export const CoreGoalRecordSchema = z.object({
  goalId: z.uuid(),
  userId: UserIdSchema,
  moduleId: ModuleIdSchema,
  goalTypeKey: z.string().min(1),
  goalSchemaVersion: z.number().int().positive(),
  config: z.unknown(),
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime().nullable(),
});

export type ModuleId = z.infer<typeof ModuleIdSchema>;
export type CoreGoalRecord = z.infer<typeof CoreGoalRecordSchema>;
```

`core/events.ts`:
```ts
import { z } from 'zod';
import { DeviceIdSchema, EventIdSchema, UserIdSchema } from '../ids';
import { ModuleIdSchema } from './goals';

export const BehaviorEventEnvelopeBaseSchema = z.object({
  eventId: EventIdSchema,
  userId: UserIdSchema,
  deviceId: DeviceIdSchema,
  moduleId: ModuleIdSchema,
  eventType: z.string().min(1),
  occurredAt: z.iso.datetime(),
  recordedAt: z.iso.datetime(),
  schemaVersion: z.number().int().positive(),
  payload: z.unknown(),
});

export type BehaviorEventEnvelopeBase = z.infer<typeof BehaviorEventEnvelopeBaseSchema>;
```

Export these from `src/index.ts`.

- [ ] **Step 4: Run contracts tests and verify GREEN**

Run: `pnpm --filter @untrava/contracts test -- core-boundary.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

Commit message: `feat: add domain-neutral core contracts`

### Task 2: Move Tobacco-owned contracts behind `tobacco/`

**Files:**
- Create: `packages/contracts/src/tobacco/profile.ts`
- Create: `packages/contracts/src/tobacco/events.ts`
- Create: `packages/contracts/src/tobacco/rescue.ts`
- Modify: `packages/contracts/src/profile.ts`
- Modify: `packages/contracts/src/events.ts`
- Modify: `packages/contracts/src/rescue.ts`
- Modify: `packages/contracts/src/index.ts`
- Add/modify tests under `packages/contracts/test/`

**Interfaces:**
- Tobacco module owns `ProductTypeSchema`, `GoalTypeSchema`, `QuitStrategySchema`, Tobacco `QuitEventEnvelopeSchema`, and Tobacco Rescue context/eligibility extensions.
- Legacy files become compatibility façades that re-export Tobacco-owned symbols.

- [ ] **Step 1: Write failing ownership tests**

Add tests importing Tobacco types from `src/tobacco/*` and asserting legacy imports resolve to equivalent schemas/types.

- [ ] **Step 2: Run tests and verify RED**

Run: `pnpm --filter @untrava/contracts test`
Expected: FAIL because `src/tobacco/*` does not exist.

- [ ] **Step 3: Move definitions without changing values or validation**

Copy current Tobacco schema definitions into `src/tobacco/profile.ts`, `src/tobacco/events.ts`, and `src/tobacco/rescue.ts`. Preserve enum values, schema versions and runtime behavior exactly.

Replace legacy `profile.ts`, `events.ts`, and `rescue.ts` with compatibility re-exports from the Tobacco paths plus any Core exports required by existing callers.

- [ ] **Step 4: Add an import-boundary test**

Test source files under `src/core/` as text and fail if they contain imports from `../tobacco`, `/tobacco/`, `ProductTypeSchema`, `GoalTypeSchema`, or Tobacco-specific literal values such as `cigarette`, `vape`, `heated_tobacco`, `smoke_free`, `tobacco_free`, `nicotine_free`.

- [ ] **Step 5: Run full contracts test/typecheck**

Run:
```bash
pnpm --filter @untrava/contracts test
pnpm --filter @untrava/contracts typecheck
```
Expected: PASS.

- [ ] **Step 6: Commit**

Commit message: `refactor: isolate tobacco contracts`

### Task 3: Move Tobacco Rescue composition out of shared mobile Rescue engine

**Files:**
- Create: `apps/mobile/src/tobacco/rescue/library.ts`
- Create: `apps/mobile/src/tobacco/rescue/selector.ts`
- Create: `apps/mobile/src/tobacco/rescue/index.ts`
- Modify: `apps/mobile/src/rescue/library.ts`
- Modify: `apps/mobile/src/rescue/selector.ts`
- Modify: `apps/mobile/src/foundation.ts`
- Modify: `apps/mobile/tsconfig.json`
- Add: `apps/mobile/test/tobacco-module-boundary.test.ts`

**Interfaces:**
- Shared Rescue engine keeps state machine, persistence, support, logging, library repository/integrity mechanics and event persistence mechanics.
- Tobacco module owns bundled Tobacco Rescue content and Tobacco-specific eligibility that depends on Tobacco goal/product semantics.
- Existing imports from `src/rescue/library` and `src/rescue/selector` remain compatibility façades.

- [ ] **Step 1: Write failing mobile boundary test**

Test that `apps/mobile/src/tobacco/rescue/index.ts` exports `createBundledTobaccoRescueLibrary` and `selectTobaccoIntervention`, and that existing `createRescueFoundation()` still returns the same public shape.

- [ ] **Step 2: Run targeted tests and verify RED**

Run: `pnpm --filter @untrava/mobile test -- tobacco-module-boundary.test.ts`
Expected: FAIL because Tobacco mobile module paths do not exist.

- [ ] **Step 3: Move bundled library and selector implementation**

Move the current bundled library implementation to `tobacco/rescue/library.ts` and current selector implementation to `tobacco/rescue/selector.ts`. Rename primary exports to `createBundledTobaccoRescueLibrary` and `selectTobaccoIntervention`.

Leave `rescue/library.ts` and `rescue/selector.ts` as compatibility façades that re-export the Tobacco functions under the legacy names `createBundledRescueLibrary` and `selectIntervention` while continuing to expose generic integrity/fallback helpers needed by current callers.

- [ ] **Step 4: Rewire foundation composition**

Update `foundation.ts` so `createRescueFoundation()` explicitly composes the Tobacco module exports while preserving its current signature and return shape.

- [ ] **Step 5: Include new paths in TypeScript config**

Add `src/tobacco/**/*.ts` and `test/tobacco-*.test.ts` to `apps/mobile/tsconfig.json`.

- [ ] **Step 6: Run mobile tests/typecheck**

Run:
```bash
pnpm --filter @untrava/mobile test
pnpm --filter @untrava/mobile typecheck
```
Expected: PASS with existing Rescue/Recovery acceptance behavior unchanged.

- [ ] **Step 7: Commit**

Commit message: `refactor: isolate tobacco rescue module`

### Task 4: Prove compatibility and exact-HEAD CI

**Files:**
- Modify only tests/docs if verification exposes a missing acceptance proof.

**Interfaces:**
- No new production behavior.

- [ ] **Step 1: Run workspace quality commands**

Run:
```bash
pnpm lint
pnpm typecheck
pnpm test
```
Expected: PASS.

- [ ] **Step 2: Verify architecture conditions**

Confirm:
- Core source has no Tobacco imports or Tobacco enum literals.
- Tobacco schemas are available from `packages/contracts/src/tobacco/*`.
- Legacy exports remain available.
- Tobacco bundled Rescue and selector are module-owned.
- Existing Tobacco Rescue acceptance tests pass unchanged in meaning.

- [ ] **Step 3: Commit any verification-only test change if needed**

Commit message if needed: `test: prove tobacco module compatibility`

- [ ] **Step 4: Verify exact HEAD GitHub Actions**

Require the exact branch HEAD check-run to show `status=completed` and `conclusion=success`, with lint, typecheck, test and Prisma validation all successful.
