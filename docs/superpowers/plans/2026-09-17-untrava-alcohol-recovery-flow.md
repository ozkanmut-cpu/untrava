# Alcohol Recovery Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a deterministic, resumable, offline Alcohol Recovery flow that records immutable reflection/outcome facts, obeys Withdrawal Safety precedence, and preserves the current goal and all Tobacco behavior.

**Architecture:** Extend the Alcohol-owned contracts and the existing sealed Alcohol intervention envelope rather than creating a second library. Add a backward-compatible selector mode and an Alcohol-owned coordinator/store/event sink; keep all product wiring for #38 and all pattern inference for #37 out of scope.

**Tech Stack:** TypeScript 5.9, Zod, Vitest, pnpm workspaces, existing local event/session storage and FNV-1a integrity helpers.

**Spec:** `docs/superpowers/specs/2026-09-17-untrava-alcohol-recovery-flow-design.md`

## Global Constraints

- Work only on `rescue-interventions`; do not modify or merge `main`.
- Do not use any VDS and do not touch `srv.field-maintenance-prod.com` or `/opt/field-maintenance/app`.
- Every feature/refactor task follows RED → expected failure → minimum GREEN → regression.
- Never call a task GREEN until its exact SHA has a real GitHub Actions `completed/success` result.
- `alcohol_use` remains immutable; later Recovery facts never rewrite it.
- Recovery never emits `goal_changed`, failure, or relapse semantics.
- Recovery never creates drink timing/quantity schedules, tapering, medication, dose, prescription, thiamine, or benzodiazepine advice.
- Emergency/urgent Withdrawal Safety routes before reflection or normal candidate filtering.
- Invalid/missing safety, corrupt library, or missing localization fails closed; no Alcohol hardcoded fallback.
- Existing four-argument `selectAlcoholIntervention()` calls retain Rescue behavior.
- Existing seven craving-time interventions remain `recoveryEligible: false`; exactly one bundled V1 entry is `recoveryEligible: true`.
- Human support remains offer-only and user-controlled; no automatic SMS, call, contact lookup, or Support Circle message.
- Core remains domain-neutral; Alcohol Recovery sources must not import Tobacco contracts.
- #37 Pattern/Risk, #38 UI/vertical wiring, #39 coexistence implementation, Intelligence Engines, server and deployment changes are out of scope.

## File map

| File | Responsibility |
|---|---|
| `packages/contracts/src/alcohol/recovery.ts` | Recovery enums, context, reflection and resumable session schemas/types. |
| `packages/contracts/src/alcohol/events.ts` | Immutable Alcohol use/correction/retraction/Recovery event union. |
| `packages/contracts/src/index.ts` | Stable public exports. |
| `apps/mobile/src/alcohol/rescue/library.ts` | Single sealed Alcohol intervention envelope, including one Recovery definition. |
| `apps/mobile/src/alcohol/rescue/localization.ts` | Rescue and Recovery baseline copy plus missing-key validation. |
| `apps/mobile/src/alcohol/rescue/selector.ts` | Safety-first deterministic Rescue/Recovery-mode selection. |
| `apps/mobile/src/alcohol/recovery/session-store.ts` | Validated local Recovery session persistence interface and memory implementation. |
| `apps/mobile/src/alcohol/recovery/session.ts` | Alcohol-owned Recovery state machine. |
| `apps/mobile/src/alcohol/recovery/events.ts` | Validated immutable Recovery reflection/outcome append adapter. |
| `apps/mobile/src/alcohol/recovery/index.ts` | Recovery public surface. |
| `apps/mobile/src/local-event-store.ts` | Backward-compatible schema-injected local immutable envelope storage. |
| `apps/mobile/test/alcohol-recovery-*.test.ts` | Contract, content, selector, session, event, offline and boundary acceptance tests. |

---

### Task 1: Alcohol Recovery contracts

**Files:**
- Create: `packages/contracts/src/alcohol/recovery.ts`
- Modify: `packages/contracts/src/alcohol/events.ts`
- Modify: `packages/contracts/src/index.ts`
- Create: `packages/contracts/test/alcohol-recovery.test.ts`

**Interfaces:**
- Consumes: `UserIdSchema`, `DeviceIdSchema`, `EventIdSchema`, `AlcoholGoalTypeSchema`, `WithdrawalSafetyDecisionSchema`.
- Produces: `AlcoholRecoveryNextActionSchema`, `AlcoholRecoveryReflectionSchema`, `AlcoholRecoveryContextSchema`, `AlcoholRecoverySessionStateSchema`, `AlcoholRecoverySessionSchema` and inferred types.
- Compatibility: `AlcoholPlanRelationSchema` moves from `events.ts` to `recovery.ts`; `events.ts` re-exports it so existing direct imports remain valid.

- [ ] **Step 1: Add the RED contract test**

Create a test that dynamically verifies all new root exports, accepts an empty reflection, accepts a complete strict session, pins Alcohol goal/safety identity, rejects unknown fields, rejects an invalid state, and rejects Tobacco goal values. Use UUID `550e8400-e29b-41d4-a716-446655440000` and disposition `behavior_change_support_allowed` with the existing complete `WithdrawalSafetyDecision` shape.

The expected state list is exactly:

```ts
[
  'started',
  'safety_routing',
  'reflecting',
  'intervention_selected',
  'intervention_active',
  'completed',
  'abandoned',
]
```

- [ ] **Step 2: Run RED**

Run: `pnpm --filter @untrava/contracts test -- alcohol-recovery.test.ts`

Expected: FAIL because the Recovery schemas are not exported.

- [ ] **Step 3: Implement the strict schemas**

Implement `recovery.ts` with:

```ts
export const AlcoholPlanRelationSchema = z.enum(['planned', 'unplanned', 'unknown']);
export const AlcoholRecoveryNextActionSchema = z.enum([
  'continue_goal', 'open_rescue', 'offer_support', 'review_plan', 'finish',
]);
export const AlcoholRecoveryReflectionSchema = z.object({
  planRelation: AlcoholPlanRelationSchema.optional(),
  triggerTags: z.array(z.string().min(1)).optional(),
  contextTags: z.array(z.string().min(1)).optional(),
  nextAction: AlcoholRecoveryNextActionSchema.optional(),
}).strict();
export const AlcoholRecoverySessionStateSchema = z.enum([
  'started', 'safety_routing', 'reflecting', 'intervention_selected',
  'intervention_active', 'completed', 'abandoned',
]);
```

`AlcoholRecoveryContextSchema` must contain UUID session id, triggering `EventId`, user/device ids, ISO start time, Alcohol goal type, optional UUID goal id, optional capability booleans, and a strict `WithdrawalSafetyDecisionSchema` value. `AlcoholRecoverySessionSchema` must contain context, state, positive `libraryContentVersion`, nullable intervention id/version, nonnegative step index, optional reflection and ISO start/update times.

- [ ] **Step 4: Preserve the plan-relation export and add root exports**

Remove the local enum declaration from `events.ts`, import it from `recovery.ts`, and re-export it from `events.ts`. Add `export * from './alcohol/recovery';` to the root index.

- [ ] **Step 5: Run GREEN regression**

Run:

```bash
pnpm --filter @untrava/contracts test -- alcohol-recovery.test.ts alcohol-events.test.ts
pnpm --filter @untrava/contracts typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

Commit message: `feat: add alcohol recovery contracts`

---

### Task 2: Immutable Alcohol Recovery events

**Files:**
- Modify: `packages/contracts/src/alcohol/events.ts`
- Modify: `packages/contracts/test/alcohol-events.test.ts`

**Interfaces:**
- Consumes: Task 1 Recovery session/reflection/next-action schemas.
- Produces: `AlcoholRecoveryOutcomeStatusSchema`, strict reflection/outcome payload schemas and two new `AlcoholEventEnvelopeSchema` variants.

- [ ] **Step 1: Extend the event test first**

Add RED cases for:

```ts
eventType: 'alcohol_recovery_reflection'
payload: {
  recoverySessionId: id,
  triggeringUseEventId: id,
  planRelation: 'unplanned',
  triggerTags: ['stress'],
  nextAction: 'continue_goal',
}
```

and:

```ts
eventType: 'alcohol_recovery_outcome'
payload: {
  recoverySessionId: id,
  triggeringUseEventId: id,
  goalId: id,
  outcome: 'completed',
  nextAction: 'continue_goal',
  interventionId: 'alcohol-recovery-reset',
  interventionVersion: 1,
}
```

Also assert that unknown payload fields, `failed`, `relapse`, and safety-routed outcomes without complete engine/rule-set/disposition identity are rejected. Confirm the original `alcohol_use` object remains byte-for-byte unchanged after validating later event candidates.

- [ ] **Step 2: Run RED**

Run: `pnpm --filter @untrava/contracts test -- alcohol-events.test.ts`

Expected: FAIL because both event types are absent.

- [ ] **Step 3: Implement event payloads and union variants**

Add `alcohol_recovery_reflection` and `alcohol_recovery_outcome` to `AlcoholEventTypeSchema`. Reflection payload extends the strict Task 1 reflection with required UUID session/use-event ids. Outcome status is exactly `completed | abandoned | safety_routed`; include optional goal/next-action/intervention fields and a strict optional safety audit object:

```ts
{
  engineId: z.literal('alcohol_withdrawal_risk'),
  ruleSetId: z.string().min(1),
  ruleSetVersion: z.number().int().positive(),
  disposition: z.enum(['urgent_medical_assessment', 'emergency_response']),
}
```

Use `superRefine` so `safety_routed` requires that audit object and non-safety outcomes reject it. Add both strict envelope variants to the discriminated union.

- [ ] **Step 4: Run GREEN regression**

Run:

```bash
pnpm --filter @untrava/contracts test -- alcohol-events.test.ts alcohol-recovery.test.ts
pnpm --filter @untrava/contracts typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

Commit message: `feat: add immutable alcohol recovery events`

---

### Task 3: Bundled Recovery content and localization

**Files:**
- Modify: `apps/mobile/src/alcohol/rescue/library.ts`
- Modify: `apps/mobile/src/alcohol/rescue/localization.ts`
- Modify: `apps/mobile/test/alcohol-rescue-library.test.ts`

**Interfaces:**
- Consumes: existing Alcohol intervention schema, sealing helper and missing-key validator.
- Produces: `ALCOHOL_RESCUE_LIBRARY` content version 2 with exactly one active Recovery entry.

- [ ] **Step 1: Write the RED content tests**

Update the expected library `contentVersion` to `2` and intervention count to `8`. Assert exactly one active item has `recoveryEligible === true`, with:

```ts
{
  interventionId: 'alcohol-recovery-reset',
  version: 1,
  family: 'behavioral_coping',
  level: 'micro',
  burden: 'very_low',
  offlineCapable: true,
  estimatedSeconds: 60,
  safety: { medicationAdvice: false, requiresHumanSupport: false },
}
```

Assert every existing item remains Recovery-ineligible, every Recovery step is skippable and uses `actionKind: 'recovery'`, all localization keys exist, copy is non-punitive, and copy contains no dose/taper/medication/drink-schedule or causal-success language.

- [ ] **Step 2: Run RED**

Run: `pnpm --filter @untrava/mobile test -- alcohol-rescue-library.test.ts`

Expected: FAIL because content version 1 has seven non-Recovery entries.

- [ ] **Step 3: Add exact Recovery copy**

Add:

```ts
'alcohol.recovery.reset.title': 'Reset without judgment',
'alcohol.recovery.reset.summary': 'Record what happened, keep your current goal, and choose what would help next.',
'alcohol.recovery.reset.step.1': 'Take a brief pause. This use is information, not a verdict on your goal.',
'alcohol.recovery.reset.step.2': 'If you want, note the context and choose your next step. Nothing is sent or changed automatically.',
```

- [ ] **Step 4: Add and seal the definition**

Extend the internal definition helper to accept `recoveryEligible` and an optional explicit step array without changing the seven existing definitions. Add `alcohol-recovery-reset` with the exact metadata above and two 30-second skippable Recovery steps. Increment only Alcohol library `contentVersion` from 1 to 2, then seal, schema-parse and localization-check exactly as before.

- [ ] **Step 5: Run GREEN regression**

Run:

```bash
pnpm --filter @untrava/mobile test -- alcohol-rescue-library.test.ts alcohol-rescue-selector.test.ts
pnpm --filter @untrava/mobile typecheck
```

Expected: PASS with existing selector behavior unchanged because Recovery mode is not yet enabled.

- [ ] **Step 6: Commit**

Commit message: `feat: add alcohol recovery reset content`

---

### Task 4: Backward-compatible Recovery selector mode

**Files:**
- Modify: `packages/contracts/src/alcohol/recovery.ts`
- Modify: `apps/mobile/src/alcohol/rescue/selector.ts`
- Modify: `apps/mobile/test/alcohol-rescue-selector.test.ts`

**Interfaces:**
- Consumes: Task 3 library and Task 1 Recovery contracts.
- Produces: `AlcoholInterventionModeSchema/type` and selector signature `selectAlcoholIntervention(library, context, safety, minimumLevel?, mode?)`.

- [ ] **Step 1: Add RED selector cases**

Prove:

- default and explicit `rescue` never select `alcohol-recovery-reset`;
- `recovery` selects only `recoveryEligible: true`;
- recovery mode with a library lacking such content returns `no_eligible_intervention`;
- a correctly sealed library whose Recovery entry references a missing localization key returns `library_unavailable`;
- emergency/urgent returns safety routing before corrupt-library handling;
- `medical_assessment_advised` allows the safe Recovery reset but never delay/substitution;
- all existing four-argument ranking tests remain unchanged.

- [ ] **Step 2: Run RED**

Run: `pnpm --filter @untrava/mobile test -- alcohol-rescue-selector.test.ts`

Expected: FAIL because the fifth mode argument has no behavior.

- [ ] **Step 3: Add the frozen mode contract**

Add `AlcoholInterventionModeSchema = z.enum(['rescue', 'recovery'])` and its inferred type to `recovery.ts`.

- [ ] **Step 4: Implement the minimum selector change**

Add `mode: AlcoholInterventionMode = 'rescue'` as the final parameter. Before ranking, require:

```ts
mode === 'recovery' ? item.recoveryEligible === true : item.recoveryEligible !== true
```

Keep emergency/urgent precedence before library validation. For `medical_assessment_advised`, allow `actionKind: 'recovery'` only when `mode === 'recovery'`; retain the existing Rescue allowlist otherwise. Do not alter the ranking comparator or existing reason ordering. Add `mode:recovery` to selected Recovery reason codes.

Before candidate filtering, call `findMissingAlcoholRescueLocalizationKeys(library)` after integrity validation and return `library_unavailable` when any referenced key is absent. This check must not run before emergency/urgent routing.

- [ ] **Step 5: Run GREEN regression**

Run:

```bash
pnpm --filter @untrava/mobile test -- alcohol-rescue-selector.test.ts alcohol-rescue-library.test.ts
pnpm --filter @untrava/mobile typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

Commit message: `feat: add alcohol recovery selection mode`

---

### Task 5: Resumable safety-first Recovery coordinator

**Files:**
- Create: `apps/mobile/src/alcohol/recovery/session-store.ts`
- Create: `apps/mobile/src/alcohol/recovery/session.ts`
- Create: `apps/mobile/src/alcohol/recovery/index.ts`
- Create: `apps/mobile/test/alcohol-recovery-session.test.ts`

**Interfaces:**
- Consumes: `AlcoholRecoverySessionSchema`, Task 4 selector, sealed library and pinned context safety decision.
- Produces: `AlcoholRecoverySessionStore`, `MemoryAlcoholRecoverySessionStore`, `AlcoholRecoverySessionCoordinator`, `StartAlcoholRecoveryInput`.

- [ ] **Step 1: Write RED state-machine tests**

Cover:

- behavior-change allowed: `started → reflecting → intervention_selected → intervention_active → completed`;
- medical-assessment-advised follows the same low-risk reset path;
- emergency/urgent start directly in `safety_routing` and cannot reflect/select;
- empty optional reflection is valid;
- abandon from nonterminal state preserves use event, goal and safety identity;
- resume round-trips a validated snapshot;
- terminal and illegal transitions throw `invalid_alcohol_recovery_transition`;
- injected store failure leaves in-memory state unchanged.

- [ ] **Step 2: Run RED**

Run: `pnpm --filter @untrava/mobile test -- alcohol-recovery-session.test.ts`

Expected: FAIL because the Recovery module does not exist.

- [ ] **Step 3: Implement the validated store**

Follow `RescueSessionStore` semantics but parse only `AlcoholRecoverySessionSchema`, deep-clone on save/get, and key by `context.recoverySessionId`.

- [ ] **Step 4: Implement the coordinator**

`start()` parses context and creates a session. Emergency/urgent initial state is `safety_routing`; all other valid decisions start at `started`. Required methods:

```ts
snapshot(): AlcoholRecoverySession
beginReflection(now: string): AlcoholRecoverySession
recordReflection(reflection: AlcoholRecoveryReflection, now: string): AlcoholRecoverySession
selectReset(library: AlcoholRescueLibrary, now: string): AlcoholRecoverySession
beginSelected(now: string): AlcoholRecoverySession
complete(nextAction: AlcoholRecoveryNextAction | undefined, now: string): AlcoholRecoverySession
completeSafetyRouting(now: string): AlcoholRecoverySession
abandon(now: string): AlcoholRecoverySession
```

`selectReset` calls the selector with minimum `micro` and mode `recovery`; unavailable/safety-routing selector results throw stable local errors without committing state. Every commit must persist the parsed clone before assigning the in-memory session so store failures are atomic.

`complete(nextAction, now)` stores an explicit next action by merging it into the optional strict reflection object; it never invents a value when `nextAction` is undefined.

- [ ] **Step 5: Run GREEN regression**

Run:

```bash
pnpm --filter @untrava/mobile test -- alcohol-recovery-session.test.ts alcohol-rescue-selector.test.ts
pnpm --filter @untrava/mobile typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

Commit message: `feat: add resumable alcohol recovery session`

---

### Task 6: Schema-injected local event storage

**Files:**
- Modify: `apps/mobile/src/local-event-store.ts`
- Modify: `apps/mobile/test/local-event-store.test.ts`

**Interfaces:**
- Consumes: existing `QuitEventEnvelopeSchema` default and Task 2 `AlcoholEventEnvelopeSchema`.
- Produces: backward-compatible `LocalEventStore<TEvent>` whose constructor accepts an optional strict runtime schema.

- [ ] **Step 1: Write RED generic-storage tests**

Keep every existing Tobacco test unchanged. Add a test that constructs:

```ts
new LocalEventStore<AlcoholEventEnvelope>(database, AlcoholEventEnvelopeSchema)
```

Append/get/list one `alcohol_recovery_outcome` event and assert schema validation, idempotent identical append and `conflicting_event_id` behavior. Add an invalid Alcohol candidate case and assert rejection before database insertion.

- [ ] **Step 2: Run RED**

Run: `pnpm --filter @untrava/mobile test -- local-event-store.test.ts`

Expected: Typecheck/test FAIL because the constructor does not accept an Alcohol schema and methods are fixed to `QuitEventEnvelope`.

- [ ] **Step 3: Implement the backward-compatible generic**

Define a structural parser interface:

```ts
interface EnvelopeSchema<TEvent extends BehaviorEventEnvelopeBase> {
  parse(candidate: unknown): TEvent;
}
```

Make the class generic with `TEvent extends BehaviorEventEnvelopeBase = QuitEventEnvelope`. Keep `QuitEventEnvelopeSchema` as the default constructor schema so every existing `new LocalEventStore(database)` call remains source- and behavior-compatible. Use the injected schema for append, duplicate comparison, get and listPending. Do not weaken validation to `BehaviorEventEnvelopeBaseSchema` alone.

- [ ] **Step 4: Run GREEN regression**

Run:

```bash
pnpm --filter @untrava/mobile test -- local-event-store.test.ts rescue-events.test.ts rescue-offline-flow.test.ts
pnpm --filter @untrava/mobile typecheck
```

Expected: PASS with unchanged Tobacco event behavior.

- [ ] **Step 5: Commit**

Commit message: `refactor: generalize local event envelope storage`

---

### Task 7: Immutable event sink and offline Recovery acceptance

**Files:**
- Create: `apps/mobile/src/alcohol/recovery/events.ts`
- Modify: `apps/mobile/src/alcohol/recovery/index.ts`
- Create: `apps/mobile/test/alcohol-recovery-events.test.ts`
- Create: `apps/mobile/test/alcohol-recovery-offline-flow.test.ts`

**Interfaces:**
- Consumes: Task 2 event union, Task 5 coordinator snapshots and Task 6 schema-injected store.
- Produces: `AlcoholRecoveryEventSinkAdapter` with `reflection()` and `outcome()` methods.

- [ ] **Step 1: Write RED event and offline tests**

Event tests must prove:

- reflection appends only user-supplied structured values;
- empty reflection causes no fabricated reflection event;
- completed/abandoned/safety-routed outcomes validate through `AlcoholEventEnvelopeSchema`;
- support/Planner choices remain inert event data;
- original use event and prior store order remain unchanged;
- no `goal_changed`, `failed` or `relapse` appears.

Offline acceptance must use a transport stub that throws if called, append a real `alcohol_use`, run a complete Recovery reset, resume once from the local store, append outcome, and finish with zero transport calls and the same goal id.

- [ ] **Step 2: Run RED**

Run:

```bash
pnpm --filter @untrava/mobile test -- alcohol-recovery-events.test.ts alcohol-recovery-offline-flow.test.ts
```

Expected: FAIL because the sink is absent.

- [ ] **Step 3: Implement the event sink**

Inject `LocalEventStore<AlcoholEventEnvelope>`, `createEventId`, and `now` exactly like the existing Rescue event adapter. Construct candidates with `moduleId: 'alcohol'`, `schemaVersion: 1`, validate with `AlcoholEventEnvelopeSchema`, then append. `reflection()` returns without appending when the strict reflection has no keys. `outcome()` maps only snapshot facts and explicit next action; it never infers success or changes a goal.

- [ ] **Step 4: Run GREEN regression**

Run:

```bash
pnpm --filter @untrava/mobile test -- alcohol-recovery-events.test.ts alcohol-recovery-offline-flow.test.ts alcohol-recovery-session.test.ts
pnpm --filter @untrava/mobile typecheck
```

Expected: PASS with zero transport calls.

- [ ] **Step 5: Commit**

Commit message: `feat: record offline alcohol recovery facts`

---

### Task 8: Boundary guards, full regression and exact-SHA gate

**Files:**
- Create: `apps/mobile/test/alcohol-recovery-boundary.test.ts`
- Modify: `apps/mobile/test/alcohol-rescue-boundary.test.ts` only if its #35 Recovery prohibition needs narrowing to the Rescue-only source set.
- Modify: `packages/contracts/test/core-import-boundary.test.ts` only to add Recovery-specific Alcohol/Tobacco tokens when required.

**Interfaces:**
- Consumes: complete #36 implementation from Tasks 1–7.
- Produces: enforceable architectural guards and final completion evidence.

- [ ] **Step 1: Add source-level boundary assertions**

Scan `../src/alcohol/recovery/*.ts` and assert absence of:

```text
/tobacco/
../tobacco
fetch(
axios
openai
chatgpt
XMLHttpRequest
WebSocket
doseMg
doseUnit
doseSchedule
drinkSchedule
taperPlan
prescriptionChange
thiamineDose
benzodiazepineDose
sendSms(
makePhoneCall(
notifySupportCircle(
goal_changed
```

Assert Recovery sources do not import Pattern/Risk, Intelligence, UI navigation, or server modules. Assert Core sources do not import Alcohol Recovery/safety symbols.

- [ ] **Step 2: Run focused boundaries**

Run:

```bash
pnpm --filter @untrava/mobile test -- alcohol-recovery-boundary.test.ts alcohol-rescue-boundary.test.ts
pnpm --filter @untrava/contracts test -- core-import-boundary.test.ts
```

Expected: PASS. If a test first exposes a real boundary violation, treat that as RED and fix only the violating dependency/content before rerunning.

- [ ] **Step 3: Run full regression**

Run:

```bash
pnpm lint
pnpm typecheck
pnpm test
```

Expected: all workspace packages PASS.

- [ ] **Step 4: Audit scope**

Diff from the #36 spec parent through HEAD. Confirm there is no #37 Pattern/Risk implementation, #38 UI/vertical wiring, #39 coexistence implementation, Intelligence Engine, deployment, VDS, production or `main` change.

- [ ] **Step 5: Commit boundary guards if changed**

Commit message: `test: lock alcohol recovery boundaries`

- [ ] **Step 6: Run the subagent-driven final whole-branch review**

Use the plan-specific SDD review package from the #36 implementation base through final HEAD. Resolve Critical/Important findings through the prescribed single fix/re-review loops; ledger every ruling.

- [ ] **Step 7: Verify exact final SHA remotely**

Read `rescue-interventions` HEAD, locate the Actions run whose `head_sha` exactly matches it, and require:

```text
status = completed
conclusion = success
```

Confirm Lint, Typecheck, Tests, Prisma migration deploy, Prisma client generation and Prisma schema validation all succeeded. Do not declare #36 or roadmap progress complete while queued/in-progress/failed.

---

## Completion state

When Task 8 is exact-SHA GREEN:

- mark #36 Alcohol Recovery Flow complete;
- report roadmap progress as `36/40`;
- leave #37 as next and unstarted;
- leave `main`, all VDS systems and production untouched.
