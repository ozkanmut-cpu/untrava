# UNTRAVA Alcohol Recovery Flow Design

**Date:** 2026-09-17  
**Roadmap item:** #36 — Alcohol Recovery Flow  
**Branch:** `rescue-interventions`  
**Status:** Approved design; implementation not started

## 1. Purpose

Alcohol Recovery is a brief, non-punitive, offline-first flow that may follow an immutable Alcohol use fact. It helps the user acknowledge what happened, optionally capture a small amount of context, choose an immediate next step, and return to the same goal unless the user explicitly enters the separate Planner/Goal flow.

Recovery is not a relapse classifier, a medical treatment protocol, a taper planner, or an automatic goal editor. A single use event remains a fact rather than a judgment.

## 2. Scope

Roadmap #36 delivers:

- Alcohol-owned Recovery contracts and exports;
- immutable Recovery reflection and outcome event contracts;
- one bundled, sealed, localized, recovery-eligible Alcohol intervention;
- a backward-compatible Recovery selection mode in the Alcohol selector;
- a deterministic, resumable, offline Alcohol Recovery coordinator;
- hard Withdrawal Safety precedence;
- non-punitive goal/history invariants;
- architecture, safety, offline and Tobacco-compatibility tests.

The following remain out of scope:

- full mobile screens, navigation and entry-point wiring;
- Planner → Log → Recovery vertical wiring, which belongs to #38;
- Alcohol Pattern/Risk Engine contracts or inference, which belong to #37;
- Tobacco + Alcohol coexistence implementation, which belongs to #39;
- Intelligence Engines;
- server, deployment, VDS or production changes;
- changes to `main`.

## 3. Binding product decisions

### 3.1 Entry policy

Every use is first recorded as an immutable `alcohol_use` fact.

- Unplanned, plan-exceeding, or goal-conflicting use may cause the product layer to offer Recovery.
- Planned use does not force Recovery; the user may start it explicitly.
- Recovery may also be opened later by explicit user action.
- Declining, abandoning, or skipping Recovery never removes the use fact, rewrites history, changes the goal, or creates a failure/relapse judgment.

The exact UI trigger wiring is deferred to #38. #36 defines the contracts and deterministic flow that #38 will call.

### 3.2 Required and optional information

The triggering `alcohol_use` event identity, Recovery session identity, pinned goal context, timestamps, and validated Withdrawal Safety decision identity are required.

All reflection answers are optional:

- plan-relation confirmation;
- trigger tags;
- context tags;
- immediate next-action preference.

The user may complete or abandon Recovery without filling in a form.

### 3.3 Goal and plan authority

Recovery preserves the pinned `goalId` and `goalType` by default.

- Recovery does not emit `goal_changed`.
- `review_plan` records only an explicit user intent to open the separate Planner/Goal flow.
- A real plan or goal change occurs only inside that separate flow through a separate explicit user action.
- Missing, skipped, unavailable, or interrupted Recovery leaves the goal unchanged.

## 4. Architecture

The implementation uses an incremental extension of the existing intervention infrastructure.

```text
Core intervention primitives
        │
        ├── Tobacco Rescue/Recovery compatibility façade (unchanged)
        │
        └── Alcohol intervention library
                ├── Rescue entries (recoveryEligible = false)
                └── alcohol-recovery-reset (recoveryEligible = true)

Alcohol use fact
        ↓
Withdrawal Safety decision
        ↓
Alcohol Recovery coordinator
        ├── safety routing
        ├── optional reflection
        ├── recovery-mode intervention selection
        └── immutable Recovery outcome
```

Alcohol Recovery must not import Tobacco domain contracts or reuse Tobacco goal/product enums. It may reuse domain-neutral Core primitives and generic integrity mechanics.

A second Recovery library, a second integrity algorithm, and a second localization activation mechanism are explicitly rejected. The existing sealed Alcohol intervention library remains the single versioned content envelope.

## 5. Alcohol Recovery contracts

Create `packages/contracts/src/alcohol/recovery.ts` and export its public schemas/types through the Alcohol/root contract surface without breaking existing exports.

### 5.1 Next action

`AlcoholRecoveryNextActionSchema` is the frozen V1 enum:

```text
continue_goal
open_rescue
offer_support
review_plan
finish
```

These are user choices or navigation intents. They do not themselves send a message, place a call, start Rescue, or change a goal.

### 5.2 Reflection

`AlcoholRecoveryReflectionSchema` is strict and contains only optional fields:

- `planRelation`: existing `AlcoholPlanRelationSchema`;
- `triggerTags`: non-empty strings;
- `contextTags`: non-empty strings;
- `nextAction`: `AlcoholRecoveryNextActionSchema`.

Unknown fields fail validation. Empty reflection is valid so that Recovery remains skippable.

### 5.3 Context

`AlcoholRecoveryContextSchema` is strict and includes:

- `recoverySessionId`: UUID;
- `triggeringUseEventId`: `EventIdSchema`;
- `userId`: `UserIdSchema`;
- `deviceId`: `DeviceIdSchema`;
- `startedAt`: ISO datetime;
- `goalType`: `AlcoholGoalTypeSchema`;
- optional pinned `goalId`: UUID;
- optional capabilities: `canMoveEnvironment`, `canUseAudio`, `canContactSupport`;
- the exact Withdrawal Safety decision used to enter the flow.

The safety decision is embedded in the local session snapshot so resume uses the same audited decision. A caller that wants a newer decision must explicitly restart or refresh through a future product-layer operation; silent safety downgrades are forbidden.

### 5.4 Session

`AlcoholRecoverySessionStateSchema` is the frozen V1 enum:

```text
started
safety_routing
reflecting
intervention_selected
intervention_active
completed
abandoned
```

`AlcoholRecoverySessionSchema` is strict and includes:

- context;
- state;
- Alcohol library content version;
- nullable selected intervention id/version;
- current step index;
- optional reflection;
- start/update timestamps.

`completed` and `abandoned` are terminal. The coordinator rejects illegal transitions with the stable local error `invalid_alcohol_recovery_transition`.

## 6. Immutable Alcohol Recovery events

Extend the Alcohol event union with:

- `alcohol_recovery_reflection`;
- `alcohol_recovery_outcome`.

Both retain `moduleId = alcohol` and `schemaVersion = 1` in the existing behavior event envelope.

### 6.1 Reflection event

The reflection payload contains:

- `recoverySessionId`;
- `triggeringUseEventId`;
- only the reflection fields the user supplied.

No reflection event is required when the user supplied no reflection data. The triggering use event is never modified to add later answers.

### 6.2 Outcome event

The outcome payload contains factual fields only:

- `recoverySessionId`;
- `triggeringUseEventId`;
- pinned optional `goalId`;
- outcome: `completed`, `abandoned`, or `safety_routed`;
- optional user-selected next action;
- optional intervention id/version actually used;
- when safety-routed, the disposition plus engine/rule-set identity and version required for audit.

The payload must not contain unsupported causal claims, `failed`, `relapse`, automatic goal changes, dosage, taper, medication instructions, or fabricated reflection answers.

## 7. Bundled Recovery intervention

Add exactly one V1 Recovery definition to the existing Alcohol Rescue Library:

```text
interventionId: alcohol-recovery-reset
version: 1
status: active
family: behavioral_coping
level: micro
actionKind: recovery
burden: very_low
offlineCapable: true
recoveryEligible: true
estimatedSeconds: 60–90
medicationAdvice: false
```

All steps are skippable and localized under `alcohol.recovery.*`. The content must:

- acknowledge use without punishment or shame;
- preserve the current goal;
- offer optional reflection;
- let the user choose what would help next;
- state that support actions remain user-controlled;
- avoid promises that the intervention worked.

The existing seven craving-time Alcohol interventions remain `recoveryEligible: false`.

Library activation remains fail-closed:

1. construct candidate;
2. seal with `sealInterventionLibrary()`;
3. parse with `AlcoholRescueLibrarySchema`;
4. verify all referenced localization keys;
5. reject corrupt or incomplete content without fabricating fallback copy.

## 8. Selector evolution

Preserve existing call behavior by adding mode as the final defaulted parameter:

```ts
selectAlcoholIntervention(
  library,
  context,
  safety,
  minimumLevel = 'micro',
  mode = 'rescue',
)
```

`AlcoholInterventionModeSchema` contains `rescue | recovery`.

- Rescue mode excludes every `recoveryEligible: true` intervention.
- Recovery mode requires `recoveryEligible: true`.
- Existing four-argument callers retain Rescue behavior.
- Existing deterministic ranking remains unchanged after the mode/safety/capability filters.
- Capability requirements still require exact `true`; `undefined` is not available.
- Null, corrupt, unsealed, or localization-incomplete libraries return `unavailable` with `library_unavailable`.
- No hardcoded Alcohol fallback may be added.

## 9. Withdrawal Safety precedence

Withdrawal Safety executes before normal library candidate selection or reflection.

### `emergency_response`

- enter `safety_routing`;
- do not run reflection or a normal Recovery intervention;
- emit a factual `safety_routed` outcome when the routing action is recorded.

### `urgent_medical_assessment`

- enter `safety_routing`;
- do not run reflection or a normal Recovery intervention;
- emit the same minimal auditable outcome shape.

### `medical_assessment_advised`

- allow brief optional reflection;
- allow only the bundled low-risk Recovery reset and explicitly user-controlled low-risk support routing;
- prohibit delay, substitution, drink timing/quantity schedules, tapering, medication or prescription advice.

### `behavior_change_support_allowed`

- allow the normal Recovery flow.

This disposition is product permission for ordinary behavior-change support, not a declaration that home detoxification is medically safe.

Invalid or missing safety decisions fail closed. They never default to `behavior_change_support_allowed`.

## 10. Coordinator behavior

Create an Alcohol-owned coordinator under `apps/mobile/src/alcohol/recovery/`. It implements the approved state transitions without importing Tobacco contracts.

Required behavior:

- start from a validated context and sealed library version;
- immediately enter safety routing for emergency/urgent dispositions;
- otherwise enter optional reflection;
- select only through Alcohol selector Recovery mode;
- persist every committed session snapshot through an injected local store interface;
- resume only validated snapshots;
- preserve `triggeringUseEventId`, `goalId`, safety identity and prior event history;
- produce event candidates rather than performing network or support side effects;
- complete or abandon without changing the goal.

The coordinator is deterministic for the same validated inputs. It does not call AI, network services, SMS, telephony, Support Circle or Planner APIs.

## 11. Offline, integrity and error behavior

- Recovery must work with network transport unavailable.
- Session persistence is local and resumable after process restart.
- Corrupt session snapshots fail validation rather than being silently repaired.
- Corrupt/missing library returns an unavailable result; the use fact and goal remain intact.
- Missing localization fails library activation.
- Store failures must not mutate the in-memory session as though persistence succeeded.
- A Recovery failure never deletes or rewrites the triggering use fact.
- No server or AI outage can lower a safety disposition.

## 12. Privacy and support boundaries

- Reflection captures only user-supplied structured values.
- No free-text journal is introduced in #36.
- No automatic SMS, call, support message or contact lookup occurs.
- `offer_support` records a user choice; the actual user-controlled capability is invoked later by the product layer.
- Safety audit fields are constrained identifiers/dispositions, not copied medical narratives.

## 13. Compatibility requirements

Tobacco behavior must remain unchanged:

- intervention ids and ranking;
- Rescue/Recovery selection;
- legacy library shape/hash/version semantics;
- session behavior;
- public exports;
- hardcoded Tobacco fallback behavior where it already exists.

Alcohol Rescue behavior must remain unchanged for existing callers because selector mode defaults to `rescue`.

Core remains domain-neutral and must not import Alcohol/Tobacco goals, Withdrawal Safety contracts, Recovery copy, or domain event enums.

## 14. Test strategy and acceptance criteria

Implementation follows RED → expected failure → minimum GREEN → regression for each feature/refactor task.

Required tests:

1. Alcohol Recovery schemas accept the approved shapes and reject unknown/unsafe fields.
2. Event schemas append reflection/outcome facts without rewriting `alcohol_use`.
3. The sealed library contains exactly one active `recoveryEligible: true` entry.
4. Every Recovery localization key exists; missing keys fail closed.
5. Rescue mode cannot select Recovery content.
6. Recovery mode cannot select craving-time content.
7. Existing four-argument selector calls keep prior behavior.
8. Emergency/urgent safety routes before reflection or candidate filtering.
9. Medical-assessment-advised mode permits only the safe Recovery reset/support boundary and blocks delay/substitution/control surfaces.
10. Required capabilities use exact-true semantics.
11. Null/corrupt library and invalid safety inputs fail closed without fallback.
12. Coordinator legal/illegal transitions are deterministic.
13. Resume preserves the triggering event, goal, safety identity and selected content version.
14. Completion/abandonment never emits `goal_changed`, failure or relapse semantics.
15. No network/AI/taper/dose/automatic-support dependency appears in Alcohol Recovery sources.
16. Existing Tobacco and Alcohol Rescue regressions remain green.
17. Full repository lint, typecheck, tests and Prisma CI pass for the exact final SHA.

Roadmap #36 is complete only when the final `rescue-interventions` HEAD has a real GitHub Actions `completed/success` result. Queued or in-progress CI is not completion.

## 15. Implementation sequencing

After this design is approved and committed:

1. write a task-by-task implementation plan;
2. execute it with subagent-driven development;
3. use one fresh implementer per substantive task;
4. run an independent task review after every task;
5. run one broad final branch review;
6. verify exact-SHA CI before declaring #36 complete.

No implementation may start before the written plan exists.
