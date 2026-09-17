# UNTRAVA Alcohol Rescue Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement roadmap #35 by extracting the minimum domain-neutral intervention-library primitives needed by Alcohol Rescue, preserving Tobacco Rescue behavior, and adding an offline deterministic Alcohol Rescue library and safety-constrained selector.

**Architecture:** Keep the existing Tobacco public Rescue contract and runtime behavior as a compatibility façade. Add domain-neutral intervention primitives under Core, compose a separate Alcohol-owned Rescue contract/library from those primitives, generalize only the integrity mechanics that both domains need, and keep full shared Rescue session/context wiring out of scope until #38. Alcohol Safety remains authoritative over selection: urgent/emergency dispositions return safety routing, medical-assessment-advised permits only the approved supportive-coping allowlist, and ordinary behavior-change support uses deterministic lowest-burden selection.

**Tech Stack:** TypeScript 5.9, Zod 4, Vitest 3, pnpm 10.17.1.

**Spec:** `docs/superpowers/specs/2026-09-17-untrava-alcohol-rescue-library-design.md`

## Global Constraints

- Work only on branch `rescue-interventions`.
- Do not merge or write to `main` without explicit user approval.
- Do not use or touch any VDS or field-maintenance production system, including `srv.field-maintenance-prod.com` and `/opt/field-maintenance/app`.
- Roadmap #35 only: do not implement Alcohol Recovery Flow (#36), Pattern/Risk Engine data contracts (#37), full Alcohol offline vertical wiring (#38), cross-module coexistence (#39), or Intelligence Engines (#40).
- Core source must not import Tobacco or Alcohol domain schemas or contain domain goal/product semantics.
- Preserve existing Tobacco intervention IDs, selector ordering, hardcoded fallback behavior, library content/version behavior, and public exports.
- Do not add `moduleId` to the legacy Tobacco Rescue library object if doing so would change its serialized/hash compatibility; use the new collision-safe Core envelope for Alcohol and future generalized libraries while retaining the Tobacco compatibility façade.
- Alcohol library identity is `moduleId = "alcohol"`, `libraryId = "alcohol-rescue"`, `schemaVersion = 1`.
- Alcohol Rescue remains offline and AI-independent; no network or generative-AI dependency may enter the required validation, integrity, or selector path.
- Human support is offer-only and requires explicit user action; no automatic SMS, phone call, Support Circle notification, or other external contact.
- Alcohol Rescue must never produce taper schedules, drink-quantity/timing instructions intended to manage withdrawal, medication names/doses/schedules, prescription changes, thiamine doses, or benzodiazepine doses.
- `emergency_response` and `urgent_medical_assessment` block ordinary Alcohol Rescue selection.
- `medical_assessment_advised` may select only `breathing`, `urge_surfing`, `cognitive_reframe`, `environment_change`, or `human_support`; it must block `delay` and `substitution`.
- `behavior_change_support_allowed` may consider all otherwise eligible V1 Alcohol Rescue interventions.
- Missing/corrupt Alcohol library and missing required Alcohol localization fail closed; do not fabricate unversioned fallback intervention content.
- Every implementation slice follows RED -> confirm expected failure -> minimal GREEN -> focused regression -> commit.
- Do not call #35 GREEN or complete until the exact final SHA has GitHub Actions status `completed` and conclusion `success`.

---

## File Structure

`packages/contracts/src/core/interventions.ts`
: New domain-neutral intervention primitives, collision-safe library envelope base, and reusable library duplicate/active-version validation helper. It must not import any domain module.

`packages/contracts/src/tobacco/rescue.ts`
: Compatibility façade. Compose generic primitives from Core while retaining Tobacco-owned goal/product eligibility, legacy Rescue session/outcome contracts, legacy library shape, and all existing exported names.

`packages/contracts/src/alcohol/rescue.ts`
: Alcohol-owned Rescue context, Alcohol eligibility, Alcohol intervention definition, collision-safe Alcohol library schema, and Alcohol selector-facing types. It may import Core primitives plus Alcohol goal/safety contracts, never Tobacco contracts.

`packages/contracts/src/index.ts`
: Export the new Core and Alcohol Rescue surfaces without removing legacy exports.

`packages/contracts/test/core-import-boundary.test.ts`
: Extend the existing raw-source architecture guard so Core intervention code cannot acquire Alcohol/Tobacco imports or domain literals.

`packages/contracts/test/alcohol-rescue.test.ts`
: New contract tests for Alcohol context, identity, strict eligibility, duplicate/version semantics, support capability metadata, and safety/no-medication boundaries.

`packages/contracts/test/rescue.test.ts`
: Existing Tobacco compatibility characterization; add only assertions needed to prove extraction did not change the legacy façade.

`apps/mobile/src/rescue/library-integrity.ts`
: Generalize checksum/sealing mechanics over a structural versioned-library interface while retaining `sealRescueLibrary` and `hasValidRescueLibraryIntegrity` as Tobacco compatibility wrappers.

`apps/mobile/src/alcohol/rescue/localization.ts`
: Alcohol-owned locale baseline and required-key validation.

`apps/mobile/src/alcohol/rescue/library.ts`
: Bundled, sealed, versioned V1 Alcohol intervention library containing the seven approved craving-time families.

`apps/mobile/src/alcohol/rescue/selector.ts`
: Deterministic Alcohol selector, capability filtering, safety disposition precedence, medical-assessment supportive-coping allowlist, stable ranking, integrity fail-closed behavior, and safety-routing result union.

`apps/mobile/src/alcohol/rescue/index.ts`
: Alcohol Rescue exports only.

`apps/mobile/test/alcohol-rescue-library.test.ts`
: Bundled-library families, identity, integrity/tamper, localization, offline metadata, and forbidden content-surface tests.

`apps/mobile/test/alcohol-rescue-selector.test.ts`
: Safety precedence, deterministic ranking, preferences/history, minimum level, support capability, and fail-closed selector tests.

`apps/mobile/test/alcohol-rescue-boundary.test.ts`
: Raw-source architectural and safety guard proving no Tobacco contract import, no network/AI dependency, and no taper/medication-dosing output surface.

---

### Task 1: Extract domain-neutral intervention contract primitives without changing Tobacco behavior

**Files:**
- Create: `packages/contracts/src/core/interventions.ts`
- Modify: `packages/contracts/src/tobacco/rescue.ts`
- Modify: `packages/contracts/src/index.ts`
- Modify: `packages/contracts/test/core-import-boundary.test.ts`
- Modify: `packages/contracts/test/rescue.test.ts`

**Interfaces:**
- Produces: `InterventionLevelSchema`, `InterventionFamilySchema`, `InterventionBurdenSchema`, `InterventionActionKindSchema`, `InterventionStepSchema`, `InterventionBaseEligibilitySchema`, `InterventionSafetyMetadataSchema`, `InterventionOutcomePromptSchema`, `InterventionLibraryEnvelopeBaseSchema`, and `addInterventionLibraryIssues(interventions, ctx)` from Core.
- Preserves: legacy Tobacco exports `RescueLevelSchema`, `InterventionFamilySchema`, `InterventionBurdenSchema`, `InterventionActionKindSchema`, `InterventionStepSchema`, `InterventionEligibilitySchema`, `InterventionSafetyMetadataSchema`, `InterventionOutcomePromptSchema`, `InterventionDefinitionSchema`, `RescueLibrarySchema`, `RescueContextSchema`, and their inferred types.

- [ ] **Step 1: Write RED architecture/compatibility tests**

In `packages/contracts/test/core-import-boundary.test.ts`, add tokens that would detect accidental domain coupling in the new file while allowing the generic word `moduleId`:

```ts
const forbiddenCoreTokens = [
  // existing entries remain
  '../tobacco',
  '../alcohol',
  'GoalTypeSchema',
  'ProductTypeSchema',
  'AlcoholGoalTypeSchema',
  'WithdrawalSafetyDecisionSchema',
] as const;
```

In `packages/contracts/test/rescue.test.ts`, add a compatibility assertion proving the legacy Tobacco library still parses without `moduleId` and rejects a changed legacy library ID:

```ts
it('preserves the legacy Tobacco Rescue library facade', () => {
  const parsed = RescueLibrarySchema.parse(library([intervention()]));
  expect(parsed.libraryId).toBe('untrava-rescue');
  expect('moduleId' in parsed).toBe(false);
  expect(RescueLibrarySchema.safeParse(library([intervention()], { libraryId: 'alcohol-rescue' })).success).toBe(false);
});
```

Also add a compile/runtime import expectation for the Core primitives from `../src/index` so the test fails before the new file/export exists.

- [ ] **Step 2: Run focused tests and confirm the expected RED**

Run:

```bash
pnpm --filter @untrava/contracts test -- core-import-boundary.test.ts rescue.test.ts
```

Expected: FAIL because the new Core intervention exports do not exist yet. Existing Tobacco compatibility assertions should otherwise describe current behavior.

- [ ] **Step 3: Add the minimal Core primitives**

Create `packages/contracts/src/core/interventions.ts` with domain-neutral schemas. Use these exact universal values:

```ts
import { z } from 'zod';

export const InterventionLevelSchema = z.enum(['micro', 'guided', 'environment_escape', 'human_support']);

export const InterventionFamilySchema = z.enum([
  'act',
  'cbt',
  'behavioral_coping',
  'mindfulness_regulation',
  'environment_change',
  'human_support',
]);

export const InterventionBurdenSchema = z.enum(['very_low', 'low', 'medium', 'high']);

export const InterventionActionKindSchema = z.enum([
  'breathing',
  'urge_surfing',
  'cognitive_reframe',
  'delay',
  'substitution',
  'environment_change',
  'human_support',
  'recovery',
]);

export const InterventionStepSchema = z.object({
  stepId: z.string().min(1),
  copyKey: z.string().min(1),
  actionKind: InterventionActionKindSchema,
  skippable: z.boolean(),
  durationSeconds: z.number().int().positive().optional(),
  accessibility: z.record(z.string(), z.string()).optional(),
});

export const InterventionBaseEligibilitySchema = z.object({
  requiresEnvironmentMove: z.boolean().optional(),
  requiresAudio: z.boolean().optional(),
  requiresSupport: z.boolean().optional(),
});

export const InterventionSafetyMetadataSchema = z
  .object({
    medicationAdvice: z.literal(false),
    requiresHumanSupport: z.boolean().optional(),
    avoidWhen: z.array(z.string().min(1)).optional(),
    escalationMessageKey: z.string().min(1).optional(),
  })
  .strict();

export const InterventionOutcomePromptSchema = z.object({
  promptId: z.string().min(1),
  copyKey: z.string().min(1),
  kind: z.enum(['craving', 'delay', 'environment', 'exercise', 'support', 'product_use', 'helpfulness']),
  optional: z.boolean().default(true),
});

export const InterventionLibraryEnvelopeBaseSchema = z.object({
  moduleId: z.string().min(1),
  libraryId: z.string().min(1),
  schemaVersion: z.literal(1),
  contentVersion: z.number().int().positive(),
  publishedAt: z.iso.datetime(),
  contentHash: z.string().min(1),
});
```

Move the duplicate `interventionId:version`, one-active-version-per-ID, and active-requires-step checks into a Core helper that accepts only structural fields:

```ts
export interface LibraryInterventionIdentity {
  interventionId: string;
  version: number;
  status: 'active' | 'retired';
  steps: readonly unknown[];
}

export function addInterventionLibraryIssues(
  interventions: readonly LibraryInterventionIdentity[],
  ctx: z.RefinementCtx,
): void {
  // preserve the existing duplicate_intervention_version,
  // active_intervention_requires_step, and duplicate_active_intervention issues and paths exactly
}
```

Export inferred types for each Core schema.

- [ ] **Step 4: Compose Tobacco from Core while preserving public names and legacy library shape**

In `packages/contracts/src/tobacco/rescue.ts`, import the Core schemas. Preserve `RescueLevelSchema` as an alias:

```ts
export const RescueLevelSchema = InterventionLevelSchema;
```

Define Tobacco-owned eligibility by extending the Core base:

```ts
export const InterventionEligibilitySchema = InterventionBaseEligibilitySchema.extend({
  allowedGoalTypes: z.array(GoalTypeSchema).min(1).optional(),
});
```

Compose `InterventionDefinitionSchema` from Core fragments, keeping the same field names/defaults. Keep `RescueLibrarySchema` in its historical shape with only `libraryId: z.literal('untrava-rescue')`, no required `moduleId`, then call `addInterventionLibraryIssues(library.interventions, ctx)` in `.superRefine(...)`.

Do not change `RescueContextSchema`, `RescueOutcomeSchema`, `RescueSessionSchema`, product intent, or product-use outcome semantics.

Add `export * from './core/interventions';` to `packages/contracts/src/index.ts`.

- [ ] **Step 5: Run focused GREEN checks**

```bash
pnpm --filter @untrava/contracts test -- core-import-boundary.test.ts rescue.test.ts
pnpm --filter @untrava/contracts typecheck
```

Expected: PASS. Tobacco tests must prove the old library parses without `moduleId` and old goal-scoped eligibility still rejects unsupported Tobacco goals.

- [ ] **Step 6: Commit the extraction**

```bash
git add packages/contracts/src/core/interventions.ts packages/contracts/src/tobacco/rescue.ts packages/contracts/src/index.ts packages/contracts/test/core-import-boundary.test.ts packages/contracts/test/rescue.test.ts
git commit -m "refactor: extract core intervention primitives"
```

---

### Task 2: Add Alcohol-owned Rescue contracts and collision-safe library identity

**Files:**
- Create: `packages/contracts/src/alcohol/rescue.ts`
- Modify: `packages/contracts/src/index.ts`
- Create: `packages/contracts/test/alcohol-rescue.test.ts`

**Interfaces:**
- Consumes: Core primitives from Task 1; `AlcoholGoalTypeSchema`; `WithdrawalSafetyDispositionSchema`.
- Produces: `AlcoholRescueContextSchema`, `AlcoholInterventionEligibilitySchema`, `AlcoholInterventionDefinitionSchema`, `AlcoholRescueLibrarySchema`, `AlcoholRescueContext`, `AlcoholInterventionDefinition`, `AlcoholRescueLibrary`.

- [ ] **Step 1: Write the failing Alcohol contract tests**

Create `packages/contracts/test/alcohol-rescue.test.ts` covering these exact cases:

```ts
import { describe, expect, it } from 'vitest';
import {
  AlcoholRescueContextSchema,
  AlcoholRescueLibrarySchema,
} from '../src/index';

it('uses collision-safe Alcohol library identity', () => {
  expect(AlcoholRescueLibrarySchema.parse(validLibrary())).toMatchObject({
    moduleId: 'alcohol',
    libraryId: 'alcohol-rescue',
    schemaVersion: 1,
  });
});

it('accepts Alcohol goals and rejects Tobacco goal keys', () => {
  expect(AlcoholRescueContextSchema.safeParse(validContext({ goalType: 'reduction' })).success).toBe(true);
  expect(AlcoholRescueContextSchema.safeParse(validContext({ goalType: 'smoke_free' })).success).toBe(false);
});

it('rejects medication-control extensions', () => {
  const candidate = validLibraryWithIntervention({ safety: { medicationAdvice: false, doseMg: 10 } });
  expect(AlcoholRescueLibrarySchema.safeParse(candidate).success).toBe(false);
});
```

Also test duplicate ID/version, duplicate active ID, zero-step active items, invalid Alcohol `allowedGoalTypes`, and unknown eligibility fields.

- [ ] **Step 2: Run and confirm RED**

```bash
pnpm --filter @untrava/contracts test -- alcohol-rescue.test.ts
```

Expected: FAIL because Alcohol Rescue schemas/exports do not exist.

- [ ] **Step 3: Implement strict Alcohol context and eligibility**

Create `packages/contracts/src/alcohol/rescue.ts` importing Core primitives and `AlcoholGoalTypeSchema` only from the Alcohol module. The context must be strict and include identity/time fields needed by future session wiring without importing Tobacco context:

```ts
export const AlcoholRescueContextSchema = z
  .object({
    userId: UserIdSchema,
    deviceId: DeviceIdSchema,
    startedAt: z.iso.datetime(),
    goalType: AlcoholGoalTypeSchema,
    goalId: z.uuid().optional(),
    cravingIntensity: z.number().min(0).max(10).optional(),
    canMoveEnvironment: z.boolean().optional(),
    canUseAudio: z.boolean().optional(),
    canContactSupport: z.boolean().optional(),
    preferredInterventionIds: z.array(z.string().min(1)).optional(),
    recentlyDeclinedInterventionIds: z.array(z.string().min(1)).optional(),
    recentlyCompletedInterventionIds: z.array(z.string().min(1)).optional(),
    disabledInterventionIds: z.array(z.string().min(1)).optional(),
  })
  .strict();

export const AlcoholInterventionEligibilitySchema = InterventionBaseEligibilitySchema.extend({
  allowedGoalTypes: z.array(AlcoholGoalTypeSchema).min(1).optional(),
}).strict();
```

Compose `AlcoholInterventionDefinitionSchema` from Core fragments. Keep `offlineCapable: z.literal(true)`, `recoveryEligible: z.boolean().default(false)`, and `contentHash: z.string().min(1)`.

- [ ] **Step 4: Implement collision-safe Alcohol library schema**

Extend the Core envelope and add interventions:

```ts
export const AlcoholRescueLibrarySchema = InterventionLibraryEnvelopeBaseSchema.extend({
  moduleId: z.literal('alcohol'),
  libraryId: z.literal('alcohol-rescue'),
  interventions: z.array(AlcoholInterventionDefinitionSchema).min(1),
})
  .strict()
  .superRefine((library, ctx) => addInterventionLibraryIssues(library.interventions, ctx));
```

Export inferred types and add `export * from './alcohol/rescue';` to `packages/contracts/src/index.ts`.

- [ ] **Step 5: Run GREEN and architecture regression**

```bash
pnpm --filter @untrava/contracts test -- alcohol-rescue.test.ts core-import-boundary.test.ts rescue.test.ts
pnpm --filter @untrava/contracts typecheck
```

Expected: PASS, and Core source remains free of `AlcoholGoalTypeSchema`/Tobacco imports.

- [ ] **Step 6: Commit Alcohol contracts**

```bash
git add packages/contracts/src/alcohol/rescue.ts packages/contracts/src/index.ts packages/contracts/test/alcohol-rescue.test.ts
git commit -m "feat: add alcohol rescue contracts"
```

---

### Task 3: Generalize intervention-library integrity while retaining Tobacco wrappers

**Files:**
- Modify: `apps/mobile/src/rescue/library-integrity.ts`
- Modify: `apps/mobile/test/rescue-library-repository.test.ts`
- Create: `apps/mobile/test/alcohol-rescue-library.test.ts`

**Interfaces:**
- Produces: `sealInterventionLibrary<T>()`, `hasValidInterventionLibraryIntegrity<T>()` structural helpers.
- Preserves: `sealRescueLibrary(candidate: RescueLibrary): RescueLibrary` and `hasValidRescueLibraryIntegrity(candidate: RescueLibrary): boolean` behavior for existing Tobacco callers.

- [ ] **Step 1: Write RED tests for generic integrity and legacy compatibility**

In the new Alcohol library test, initially construct a minimal valid `AlcoholRescueLibrary` candidate and require:

```ts
const sealed = sealInterventionLibrary(candidate);
expect(AlcoholRescueLibrarySchema.safeParse(sealed).success).toBe(true);
expect(hasValidInterventionLibraryIntegrity(sealed)).toBe(true);
expect(hasValidInterventionLibraryIntegrity({
  ...sealed,
  interventions: [{ ...sealed.interventions[0]!, summaryKey: 'tampered' }],
})).toBe(false);
```

In the existing Tobacco repository/integrity coverage, retain assertions that `sealRescueLibrary` still produces a `RescueLibrarySchema`-valid legacy object and detects tampering.

- [ ] **Step 2: Run and confirm RED**

```bash
pnpm --filter @untrava/mobile test -- alcohol-rescue-library.test.ts rescue-library-repository.test.ts
```

Expected: FAIL because generic integrity exports do not exist.

- [ ] **Step 3: Implement structural generic helpers**

Refactor `apps/mobile/src/rescue/library-integrity.ts` so checksum/stable serialization remain unchanged. Add structural interfaces:

```ts
export interface IntegrityIntervention {
  contentHash: string;
}

export interface IntegrityLibrary<TIntervention extends IntegrityIntervention> {
  interventions: TIntervention[];
  contentHash: string;
}
```

Implement generic helpers without importing Alcohol or Tobacco schemas:

```ts
export function sealInterventionLibrary<
  TIntervention extends IntegrityIntervention,
  TLibrary extends IntegrityLibrary<TIntervention>,
>(candidate: TLibrary): TLibrary {
  const interventions = candidate.interventions.map((intervention) => {
    const content = { ...intervention, contentHash: undefined };
    return { ...intervention, contentHash: checksum(content) };
  }) as TLibrary['interventions'];
  const content = { ...candidate, interventions, contentHash: undefined };
  return { ...candidate, interventions, contentHash: checksum(content) };
}

export function hasValidInterventionLibraryIntegrity<
  TIntervention extends IntegrityIntervention,
  TLibrary extends IntegrityLibrary<TIntervention>,
>(candidate: TLibrary): boolean {
  const expected = sealInterventionLibrary(candidate);
  if (candidate.contentHash !== expected.contentHash) return false;
  return candidate.interventions.every(
    (intervention, index) => intervention.contentHash === expected.interventions[index]?.contentHash,
  );
}
```

Keep Tobacco wrappers and parse the generic sealed value through `RescueLibrarySchema`:

```ts
export function sealRescueLibrary(candidate: RescueLibrary): RescueLibrary {
  return RescueLibrarySchema.parse(sealInterventionLibrary(candidate));
}

export function hasValidRescueLibraryIntegrity(candidate: RescueLibrary): boolean {
  return hasValidInterventionLibraryIntegrity(candidate);
}
```

- [ ] **Step 4: Run GREEN + Tobacco regression**

```bash
pnpm --filter @untrava/mobile test -- alcohol-rescue-library.test.ts rescue-library-repository.test.ts rescue-offline-flow.test.ts
pnpm --filter @untrava/mobile typecheck
```

Expected: PASS. The generic helper must not change FNV-1a32 stable serialization behavior.

- [ ] **Step 5: Commit integrity extraction**

```bash
git add apps/mobile/src/rescue/library-integrity.ts apps/mobile/test/rescue-library-repository.test.ts apps/mobile/test/alcohol-rescue-library.test.ts
git commit -m "refactor: generalize rescue library integrity"
```

---

### Task 4: Add the bundled offline Alcohol Rescue library and localization fail-closed validation

**Files:**
- Create: `apps/mobile/src/alcohol/rescue/localization.ts`
- Create: `apps/mobile/src/alcohol/rescue/library.ts`
- Create: `apps/mobile/src/alcohol/rescue/index.ts`
- Modify: `apps/mobile/test/alcohol-rescue-library.test.ts`

**Interfaces:**
- Produces: `ALCOHOL_RESCUE_LOCALE_BASELINE`, `findMissingAlcoholRescueLocalizationKeys()`, `ALCOHOL_RESCUE_LIBRARY`.
- Consumes: `AlcoholRescueLibrarySchema`, `sealInterventionLibrary()`.

- [ ] **Step 1: Extend the Alcohol library test to RED on required families/content**

Require the exported bundled library to contain active interventions with these action kinds:

```ts
expect(new Set(ALCOHOL_RESCUE_LIBRARY.interventions.flatMap((item) => item.steps.map((step) => step.actionKind))))
  .toEqual(new Set([
    'breathing',
    'urge_surfing',
    'delay',
    'substitution',
    'environment_change',
    'cognitive_reframe',
    'human_support',
  ]));
```

Also assert:

```ts
expect(ALCOHOL_RESCUE_LIBRARY.moduleId).toBe('alcohol');
expect(ALCOHOL_RESCUE_LIBRARY.libraryId).toBe('alcohol-rescue');
expect(hasValidInterventionLibraryIntegrity(ALCOHOL_RESCUE_LIBRARY)).toBe(true);
expect(findMissingAlcoholRescueLocalizationKeys(ALCOHOL_RESCUE_LIBRARY)).toEqual([]);
expect(ALCOHOL_RESCUE_LIBRARY.interventions.every((item) => item.offlineCapable)).toBe(true);
expect(ALCOHOL_RESCUE_LIBRARY.interventions.every((item) => item.safety.medicationAdvice === false)).toBe(true);
```

- [ ] **Step 2: Run and confirm RED**

```bash
pnpm --filter @untrava/mobile test -- alcohol-rescue-library.test.ts
```

Expected: FAIL because bundled Alcohol library/localization exports do not exist.

- [ ] **Step 3: Add Alcohol-owned localization catalog**

Create `apps/mobile/src/alcohol/rescue/localization.ts` with keys under `alcohol.rescue.*`. Use neutral behavioral copy only. The catalog must include title, summary, and step copy for seven interventions, for example:

```ts
export const ALCOHOL_RESCUE_LOCALE_BASELINE = {
  'alcohol.rescue.micro-regulate.title': 'One-minute reset',
  'alcohol.rescue.micro-regulate.summary': 'Slow this moment down before deciding what to do next.',
  'alcohol.rescue.micro-regulate.step.1': 'Settle your posture and take a few slow, comfortable breaths.',
  'alcohol.rescue.urge-surf.title': 'Ride the urge',
  'alcohol.rescue.urge-surf.summary': 'Notice the urge as a changing experience rather than an instruction.',
  'alcohol.rescue.delay.title': 'Create a short pause',
  'alcohol.rescue.substitution.title': 'Choose a non-alcohol option',
  'alcohol.rescue.environment-change.title': 'Change the scene',
  'alcohol.rescue.cbt-reframe.title': 'Check the thought',
  'alcohol.rescue.human-support.title': 'Reach out for support',
} as const satisfies Readonly<Record<string, string>>;
```

Fill every referenced summary/step key with similarly neutral copy. Do not mention quantities, alcohol timing as withdrawal management, medication, detox dosing, or claims of medical safety.

Implement `findMissingAlcoholRescueLocalizationKeys(library)` by collecting title, summary, step, escalation-message, and outcome-prompt keys exactly as the existing Tobacco helper does, but checking only the Alcohol catalog.

- [ ] **Step 4: Build and seal the V1 Alcohol library**

Create `apps/mobile/src/alcohol/rescue/library.ts`. Build an unsealed candidate with:

```ts
moduleId: 'alcohol',
libraryId: 'alcohol-rescue',
schemaVersion: 1,
contentVersion: 1,
publishedAt: '2026-09-17T00:00:00.000Z',
contentHash: 'pending',
```

Use seven stable intervention IDs:

```text
alcohol-micro-regulate
alcohol-urge-surf
alcohol-delay
alcohol-substitution
alcohol-environment-change
alcohol-cbt-reframe
alcohol-human-support
```

Use `micro` for regulation/urge-surf, `guided` for delay/substitution/CBT, `environment_escape` for environment change, and `human_support` for support. Give the support intervention both `eligibility.requiresSupport: true` and `safety.requiresHumanSupport: true`. Give environment change `eligibility.requiresEnvironmentMove: true`. Keep all `recoveryEligible: false` because #36 owns Alcohol Recovery.

Seal generically, then validate:

```ts
const sealed = sealInterventionLibrary(candidate);
export const ALCOHOL_RESCUE_LIBRARY = AlcoholRescueLibrarySchema.parse(sealed);

if (findMissingAlcoholRescueLocalizationKeys(ALCOHOL_RESCUE_LIBRARY).length > 0) {
  throw new Error('alcohol_rescue_localization_incomplete');
}
```

This activation-time failure is local/offline and fail-closed.

- [ ] **Step 5: Export and run GREEN**

`apps/mobile/src/alcohol/rescue/index.ts`:

```ts
export * from './library';
export * from './localization';
```

Run:

```bash
pnpm --filter @untrava/mobile test -- alcohol-rescue-library.test.ts
pnpm --filter @untrava/mobile typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit the Alcohol library**

```bash
git add apps/mobile/src/alcohol/rescue/localization.ts apps/mobile/src/alcohol/rescue/library.ts apps/mobile/src/alcohol/rescue/index.ts apps/mobile/test/alcohol-rescue-library.test.ts
git commit -m "feat: add offline alcohol rescue library"
```

---

### Task 5: Add deterministic Alcohol selector with Safety -> Rescue precedence

**Files:**
- Create: `apps/mobile/src/alcohol/rescue/selector.ts`
- Modify: `apps/mobile/src/alcohol/rescue/index.ts`
- Create: `apps/mobile/test/alcohol-rescue-selector.test.ts`

**Interfaces:**
- Consumes: `AlcoholRescueLibrary | null`, `AlcoholRescueContext`, `WithdrawalSafetyDecision`, optional minimum intervention level.
- Produces: `selectAlcoholIntervention()` returning a discriminated `AlcoholRescueSelection` union.

Define the result union exactly:

```ts
export type AlcoholRescueSelection =
  | {
      kind: 'intervention';
      interventionId: string;
      version: number;
      reasonCodes: string[];
    }
  | {
      kind: 'safety_routing';
      disposition: 'urgent_medical_assessment' | 'emergency_response';
      reasonCodes: string[];
    }
  | {
      kind: 'unavailable';
      reasonCodes: string[];
    };
```

Function signature:

```ts
export function selectAlcoholIntervention(
  library: AlcoholRescueLibrary | null,
  context: AlcoholRescueContext,
  safety: WithdrawalSafetyDecision,
  minimumLevel: InterventionLevel = 'micro',
): AlcoholRescueSelection;
```

- [ ] **Step 1: Write RED safety-precedence tests**

Create tests proving:

```ts
expect(selectAlcoholIntervention(library, context, decision('emergency_response'))).toMatchObject({
  kind: 'safety_routing',
  disposition: 'emergency_response',
});

expect(selectAlcoholIntervention(library, context, decision('urgent_medical_assessment'))).toMatchObject({
  kind: 'safety_routing',
  disposition: 'urgent_medical_assessment',
});
```

For `medical_assessment_advised`, force `delay` and `substitution` to otherwise rank first and assert neither can be selected. Assert every returned intervention action kind is one of:

```ts
['breathing', 'urge_surfing', 'cognitive_reframe', 'environment_change', 'human_support']
```

- [ ] **Step 2: Write RED deterministic/capability tests**

Cover:

- same library/context/safety input returns identical selection repeatedly;
- explicitly disabled IDs are excluded;
- recently declined items are deprioritized before user-preferred ranking;
- user-preferred eligible items outrank non-preferred peers at the same admissible stage;
- recently completed items are deprioritized;
- minimum escalation level is enforced;
- lower burden wins after level;
- stable `interventionId`, then version, breaks the final tie;
- `requiresSupport` or `requiresHumanSupport` requires `canContactSupport === true`, not merely “not false”;
- `requiresEnvironmentMove` requires `canMoveEnvironment === true`;
- a null/corrupt library returns `{ kind: 'unavailable', reasonCodes: ['library_unavailable'] }` and never fabricates a fallback.

- [ ] **Step 3: Run and confirm RED**

```bash
pnpm --filter @untrava/mobile test -- alcohol-rescue-selector.test.ts
```

Expected: FAIL because selector/result types do not exist.

- [ ] **Step 4: Implement safety gate before ordinary eligibility**

At the top of `selectAlcoholIntervention()`:

```ts
if (safety.disposition === 'emergency_response' || safety.disposition === 'urgent_medical_assessment') {
  return {
    kind: 'safety_routing',
    disposition: safety.disposition,
    reasonCodes: [`safety:${safety.disposition}`],
  };
}

if (!library || !hasValidInterventionLibraryIntegrity(library)) {
  return { kind: 'unavailable', reasonCodes: ['library_unavailable'] };
}
```

Do not select any craving intervention before these checks.

- [ ] **Step 5: Implement Alcohol eligibility and medical-assessment allowlist**

Use a constant:

```ts
const MEDICAL_ASSESSMENT_SUPPORTIVE_ACTIONS = new Set<InterventionActionKind>([
  'breathing',
  'urge_surfing',
  'cognitive_reframe',
  'environment_change',
  'human_support',
]);
```

An intervention is permitted under `medical_assessment_advised` only when every step action kind is in this set. This makes mixed-action interventions fail closed.

Require capabilities with exact-true semantics for required features:

```ts
if (item.eligibility.requiresEnvironmentMove && context.canMoveEnvironment !== true) return false;
if ((item.eligibility.requiresSupport || item.safety.requiresHumanSupport) && context.canContactSupport !== true) return false;
if (item.eligibility.requiresAudio && context.canUseAudio !== true) return false;
```

Filter allowed Alcohol goals via `item.eligibility.allowedGoalTypes` against `context.goalType`.

- [ ] **Step 6: Implement stable ranking**

After filtering inactive, unsafe, ineligible, disabled, and below-minimum-level candidates, sort in this order:

```text
recently declined: no before yes
user preferred: yes before no
recently completed: no before yes
level rank: micro < guided < environment_escape < human_support
burden rank: very_low < low < medium < high
interventionId: localeCompare
version: ascending
```

Return `kind: 'intervention'`. Include `lowest_burden_eligible`, `user_preferred` when applicable, `minimum_level:<level>` when non-micro, and `safety:medical_assessment_advised` when that allowlist constrained selection.

If no candidate exists, return:

```ts
{ kind: 'unavailable', reasonCodes: ['no_eligible_intervention'] }
```

Do not copy Tobacco's `MINIMAL_STABILIZATION_FALLBACK` into Alcohol.

- [ ] **Step 7: Run GREEN + Tobacco selector regression**

```bash
pnpm --filter @untrava/mobile test -- alcohol-rescue-selector.test.ts rescue-selector.test.ts rescue-escalation-levels.test.ts
pnpm --filter @untrava/mobile typecheck
```

Expected: PASS with unchanged Tobacco selector behavior.

- [ ] **Step 8: Commit selector**

```bash
git add apps/mobile/src/alcohol/rescue/selector.ts apps/mobile/src/alcohol/rescue/index.ts apps/mobile/test/alcohol-rescue-selector.test.ts
git commit -m "feat: add safety constrained alcohol rescue selector"
```

---

### Task 6: Lock safety, offline, AI, support, import, and localization boundaries

**Files:**
- Create: `apps/mobile/test/alcohol-rescue-boundary.test.ts`
- Modify: `apps/mobile/test/alcohol-rescue-library.test.ts`
- Modify: `packages/contracts/test/core-import-boundary.test.ts`

**Interfaces:**
- Consumes: final #35 source tree.
- Produces: regression guards preventing later scope erosion.

- [ ] **Step 1: Write source-level boundary tests**

Use `import.meta.glob(..., { eager: true, query: '?raw', import: 'default' })` over `apps/mobile/src/alcohol/rescue/*.ts` and assert source does not contain Tobacco contract imports:

```ts
const forbiddenDomainImports = [
  '/tobacco/',
  '../tobacco',
  'GoalTypeSchema',
  'ProductTypeSchema',
  'RescueProductIntentSchema',
] as const;
```

Assert the required selector/library path contains no network/AI APIs:

```ts
const forbiddenRuntimeDependencies = [
  'fetch(',
  'axios',
  'openai',
  'chatgpt',
  'XMLHttpRequest',
  'WebSocket',
] as const;
```

Do not scan user-facing copy for the bare word `alcohol`; scan only for instruction/control surfaces forbidden by #34/#35, such as exported/property identifiers `doseMg`, `doseUnit`, `doseSchedule`, `taperPlan`, `prescriptionChange`, `thiamineDose`, `benzodiazepineDose`, and Tobacco/NRT control action kinds.

- [ ] **Step 2: Add content assertions for human support and medical boundaries**

In `alcohol-rescue-library.test.ts`, assert the human-support intervention contains no executable phone/SMS side effect function and its copy states that user action is required. Assert no Alcohol intervention uses `recovery` action kind in #35.

Also assert every active intervention has all localization keys and that deleting one key in a test fixture makes the missing-key validator report it.

- [ ] **Step 3: Run boundary tests and confirm they pass against the intended implementation**

```bash
pnpm --filter @untrava/mobile test -- alcohol-rescue-boundary.test.ts alcohol-rescue-library.test.ts alcohol-rescue-selector.test.ts
pnpm --filter @untrava/contracts test -- core-import-boundary.test.ts alcohol-rescue.test.ts rescue.test.ts
```

If a new test unexpectedly fails, inspect the first real failure and make the minimum change that enforces the spec; do not weaken the test to accommodate domain coupling or permissive fallback.

- [ ] **Step 4: Commit boundary guards**

```bash
git add apps/mobile/test/alcohol-rescue-boundary.test.ts apps/mobile/test/alcohol-rescue-library.test.ts packages/contracts/test/core-import-boundary.test.ts
git commit -m "test: lock alcohol rescue safety boundaries"
```

---

### Task 7: Full regression and exact-SHA completion gate

**Files:**
- No planned production-file changes. Only fix real regressions found by the full suite, with the smallest change consistent with the spec.

**Interfaces:**
- Consumes: Tasks 1-6.
- Produces: exact final SHA eligible to close roadmap #35.

- [ ] **Step 1: Run formatter/lint/typecheck/full test regression locally**

Run from repository root:

```bash
pnpm lint
pnpm typecheck
pnpm test
```

Expected: all commands exit 0.

- [ ] **Step 2: If a regression occurs, use the first real failure only**

Do not stack speculative fixes. Re-run the smallest failing test target, identify the root cause, add/adjust the minimum implementation, then re-run that focused target and the full three-command regression.

- [ ] **Step 3: Verify #35 scope diff before final push/commit state**

Confirm the branch diff for #35 contains only the planned contracts, Alcohol Rescue files/tests, generic integrity extraction, and documentation plan/spec. Confirm it does not contain:

```text
Alcohol Recovery implementation
Pattern/Risk Engine implementation
full Rescue session migration
cross-module coexistence implementation
Intelligence Engines
main-branch merge changes
VDS/deployment files
```

- [ ] **Step 4: Push the final branch state and obtain the exact SHA**

Record:

```bash
git rev-parse HEAD
```

The SHA from this command is the only SHA whose CI may close #35.

- [ ] **Step 5: Check GitHub Actions for that exact SHA**

Require the exact SHA check-run/workflow to reach:

```text
status: completed
conclusion: success
```

If status is `queued` or `in_progress`, #35 remains not complete. If conclusion is failure, open the run/jobs/logs, find the first real failing step, fix the root cause on `rescue-interventions`, repeat focused/full regression, and verify the new exact SHA.

- [ ] **Step 6: Closure report**

Report the final exact SHA, workflow run ID, check ID, `completed/success`, focused/full regression results, and a concise list of created/modified files. State explicitly that `main` and all VDS/production systems remained untouched.

Roadmap state after this gate only:

```text
#35 Alcohol Rescue Library: complete
Overall: 35/40
Next: #36 Alcohol Recovery Flow
```

Do not begin #36 in the same `Devam` execution.