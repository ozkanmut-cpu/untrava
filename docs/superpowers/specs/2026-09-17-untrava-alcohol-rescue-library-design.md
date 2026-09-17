# UNTRAVA Alcohol Rescue Library — Design Specification

**Date:** 2026-09-17  
**Status:** Approved design direction; written spec for review  
**Branch:** `rescue-interventions`  
**Parent architecture:** `docs/superpowers/specs/2026-09-16-untrava-core-generalization-design.md`  
**Alcohol V1 design:** `docs/superpowers/specs/2026-09-16-untrava-alcohol-module-design.md`  
**Withdrawal safety design:** `docs/superpowers/specs/2026-09-16-untrava-alcohol-withdrawal-risk-engine-design.md`  
**Scope:** Roadmap item #35 — extract the minimum domain-neutral intervention-library infrastructure needed by Alcohol Rescue, add an Alcohol-owned Rescue Library and deterministic selector, and bind them to Alcohol safety without changing Tobacco product behavior.

## 1. Decision

Roadmap item #35 will use an **incremental intervention-infrastructure extraction** rather than reusing Tobacco Rescue contracts directly or migrating the entire Rescue session stack in one step.

The existing mobile Rescue coordinator/state machine is reusable in behavior but its current contract surface still depends on Tobacco-specific `GoalTypeSchema` and `ProductTypeSchema`. Alcohol must not be added by widening those Tobacco enums.

The implementation therefore separates three layers:

```text
Core intervention infrastructure
├── generic intervention identity/version/status
├── generic level/family/burden
├── generic step/action metadata
├── generic safety metadata
├── generic outcome-prompt metadata
├── generic library envelope/version/integrity
└── deterministic library mechanics

Tobacco Module
└── existing Tobacco Rescue contract + library + selector
    └── compatibility preserved

Alcohol Module
└── Alcohol Rescue
    ├── Alcohol Rescue context
    ├── Alcohol eligibility
    ├── Alcohol Rescue Library
    ├── deterministic Alcohol selector
    └── Alcohol Safety decision constraint
```

This is intentionally smaller than a full Rescue contract migration. Shared Alcohol session wiring remains a roadmap #38 concern, where the Alcohol vertical is proven offline end-to-end.

## 2. Why direct reuse is rejected

The current `packages/contracts/src/tobacco/rescue.ts` owns reusable-looking schemas, but several of them import Tobacco-specific goal/product contracts.

Directly importing those schemas from Alcohol would violate the approved architecture invariants:

- Core must remain domain-agnostic.
- Alcohol must not extend Tobacco enums.
- Tobacco and Alcohol must coexist without cross-domain interpretation.
- Future domain modules must not inherit Tobacco semantics accidentally.

Therefore #35 does not create Alcohol types by aliasing `GoalTypeSchema`, `ProductTypeSchema`, `RescueProductIntentSchema` or Tobacco `RescueContextSchema`.

## 3. Why a full Rescue migration is rejected for #35

The current mobile coordinator, session store, events and support boundary already work and have broad Tobacco acceptance coverage.

Migrating all session/context contracts now would combine two independent goals:

1. extracting generic intervention-library infrastructure;
2. rewiring the full Rescue session model for multiple domains.

That would unnecessarily increase regression risk and duplicate work already planned for #38.

#35 therefore extracts only what Alcohol Rescue needs to define, validate, seal, select and safety-gate interventions.

## 4. Core intervention contract boundary

A new domain-neutral contract surface will live under the Core namespace, conceptually:

```text
packages/contracts/src/core/interventions.ts
```

Exact final symbol names may follow existing naming conventions, but ownership is fixed by this spec.

Core intervention infrastructure may own:

- `InterventionLevel`;
- `InterventionFamily`;
- `InterventionBurden`;
- generic `InterventionActionKind` values that are behavior-support mechanics rather than Tobacco/Alcohol facts;
- step identity/copy/action/duration metadata;
- generic safety metadata;
- generic outcome-prompt metadata;
- intervention identity/version/status/content hash;
- library schema version/content version/published time/content hash;
- module/library namespace fields;
- duplicate-version and duplicate-active-item validation;
- integrity/checksum mechanics.

Core must not own:

- Alcohol goal types;
- Tobacco goal types;
- beverage/product types;
- cigarette/vape semantics;
- withdrawal-risk interpretation;
- Alcohol safety dispositions;
- user-facing Alcohol content;
- Tobacco content.

### 4.1 Generic action kinds

The following existing action kinds are sufficiently domain-neutral to remain generic mechanics:

```text
breathing
urge_surfing
cognitive_reframe
delay
substitution
environment_change
human_support
recovery
```

They describe an interaction mechanic, not a Tobacco or Alcohol fact.

Adding a future domain-specific action kind requires either proving it is generic or placing it in that domain's extension schema. Core must not become a registry of every future addiction-specific action.

### 4.2 Generic safety metadata

Core intervention safety metadata keeps universal invariants such as:

```text
medicationAdvice = false
requiresHumanSupport?
avoidWhen?
escalationMessageKey?
```

`medicationAdvice` remains fixed to `false`.

Alcohol-specific medical gating is not encoded as free-form `avoidWhen` strings. It is enforced by the Alcohol selector against the structured Alcohol Safety decision.

## 5. Library identity and module namespacing

The current Tobacco `RescueLibrarySchema` fixes `libraryId` to `untrava-rescue`. That is not sufficient for multi-module coexistence.

The extracted Core library envelope must make identity collision-safe. Preferred conceptual shape:

```ts
interface InterventionLibraryEnvelope {
  moduleId: string;
  libraryId: string;
  schemaVersion: number;
  contentVersion: number;
  publishedAt: string;
  interventions: InterventionDefinition[];
  contentHash: string;
}
```

For V1:

```text
Tobacco compatibility identity:
moduleId = tobacco
libraryId = untrava-rescue

Alcohol identity:
moduleId = alcohol
libraryId = alcohol-rescue
```

Historical Tobacco behavior must remain readable and existing public exports must remain compatible. If migration requires a new Core envelope while keeping the old Tobacco schema as a compatibility facade, that is preferred over rewriting historical Tobacco assumptions.

## 6. Tobacco compatibility strategy

The existing Tobacco Rescue API remains supported.

The migration should move reusable schema fragments into Core and have the Tobacco contract compose/import them, while preserving the existing Tobacco-facing exports and validation meaning.

Required compatibility invariants:

- existing Tobacco intervention IDs remain unchanged;
- existing Tobacco library content/version semantics remain unchanged;
- existing Tobacco selector ordering remains unchanged;
- existing Tobacco fallback remains unchanged;
- current Tobacco goal/product eligibility remains unchanged;
- existing Tobacco tests remain green in meaning;
- no historical Tobacco data rewrite is introduced.

This extraction is an ownership refactor, not a Tobacco feature redesign.

## 7. Alcohol Rescue contract

Alcohol owns a separate Rescue context/eligibility contract under the Alcohol namespace.

Conceptual context:

```ts
interface AlcoholRescueContext {
  goalType:
    | 'observe_only'
    | 'abstinence'
    | 'reduction'
    | 'alcohol_free_days'
    | 'usage_limit';
  cravingIntensity?: number;
  canMoveEnvironment?: boolean;
  canContactSupport?: boolean;
  preferredInterventionIds?: string[];
  recentlyDeclinedInterventionIds?: string[];
  recentlyCompletedInterventionIds?: string[];
  disabledInterventionIds?: string[];
}
```

The exact implementation may also carry Core identity/timestamp fields where needed, but it must not import Tobacco `GoalTypeSchema` or `ProductTypeSchema`.

Alcohol eligibility may constrain interventions by:

- allowed Alcohol goal types;
- environment-move capability;
- support capability;
- explicit disable/preference/recent-history lists;
- Alcohol Safety disposition.

## 8. Alcohol Rescue Library V1

The bundled Alcohol library is versioned, sealed and offline-capable.

V1 includes at least these intervention families:

| Purpose | Family | Action kind | Intended level |
|---|---|---|---|
| micro regulation | mindfulness/regulation | `breathing` | micro |
| ACT urge surfing | ACT | `urge_surfing` | micro/guided |
| short delay | behavioral coping | `delay` | guided |
| non-alcohol substitution | behavioral coping | `substitution` | guided |
| environment change | environment change | `environment_change` | environment escape |
| CBT reframe | CBT | `cognitive_reframe` | guided |
| explicit human support | human support | `human_support` | human support |

A Recovery-specific reset remains roadmap #36 ownership and does not need to be added to the primary #35 Alcohol Rescue library unless required as a compatibility hook. #35 focuses on craving-time Rescue.

### 8.1 Content constraints

Alcohol Rescue content must not:

- provide a taper schedule;
- tell the user how much alcohol to drink to avoid withdrawal;
- calculate an alcohol dose/timing schedule;
- provide medication names/doses/timing as instructions;
- tell the user to start/stop/change a prescribed medication;
- claim that an intervention prevents withdrawal complications;
- claim causal medical efficacy from user outcome data;
- bypass urgent/emergency routing.

Content keys should be namespaced under Alcohol rather than reusing Tobacco copy keys, for example conceptually:

```text
alcohol.rescue.<intervention>.title
alcohol.rescue.<intervention>.summary
alcohol.rescue.<intervention>.step.<n>
```

## 9. Integrity and offline behavior

The existing FNV-1a32 stable serialization/integrity mechanics are reusable infrastructure.

Extraction should preserve the existing deterministic checksum behavior while making it operate on the domain-neutral Core library envelope.

Required behavior:

- each intervention is sealed with a content hash;
- the library is sealed with a content hash;
- modified/tampered content fails integrity validation;
- a corrupt Alcohol library must not silently become trusted;
- essential library validation works offline;
- library selection has no network or AI dependency.

If the bundled Alcohol library is missing/corrupt, the system must fail safely. It must not synthesize a new Alcohol intervention using generative AI.

## 10. Deterministic Alcohol selector

Alcohol owns its selector rather than reusing the Tobacco selector by importing Tobacco context semantics.

Selection order follows the already-validated Rescue mechanics:

1. filter inactive items;
2. apply Alcohol safety gate;
3. apply Alcohol goal/capability eligibility;
4. exclude explicitly disabled interventions;
5. deprioritize recently declined items;
6. prefer explicit user preferences;
7. deprioritize recently completed items;
8. choose the lowest eligible escalation level;
9. choose the lowest burden;
10. use stable intervention ID/version ordering as final tie-breaker.

The selector must be deterministic for the same library, context and safety decision.

The selector returns factual selection metadata/reason codes, not medical interpretation.

## 11. Safety-to-Rescue boundary

Alcohol Safety is authoritative over Rescue eligibility.

Conceptual input:

```text
AlcoholRescueContext
+ validated Alcohol Rescue Library
+ WithdrawalSafetyDecision
        ↓
Alcohol Rescue selector
```

Safety precedence is fixed:

### 11.1 `emergency_response`

Ordinary Alcohol Rescue intervention selection is blocked.

The product surface must route to the emergency safety UX. No breathing/ACT/delay/substitution flow is allowed to delay emergency routing.

### 11.2 `urgent_medical_assessment`

Ordinary Alcohol Rescue intervention selection is blocked.

The product surface routes to urgent medical assessment. Rescue cannot be used as an alternative to that route.

### 11.3 `medical_assessment_advised`

Only a narrowly defined **supportive coping allowlist** may remain available while the app continues to advise medical assessment.

Allowed V1 action kinds:

```text
breathing
urge_surfing
cognitive_reframe
environment_change
human_support
```

Blocked V1 action kinds:

```text
delay
substitution
```

Reason: `delay` or `substitution` can be interpreted as guidance about when/how to consume or replace alcohol in a user for whom major reduction/abstinence may require medical assessment. #35 will not use these tools in that disposition.

Even allowed supportive coping content must remain neutral about alcohol quantity/timing and may not imply that the user is medically safe to stop or reduce.

### 11.4 `behavior_change_support_allowed`

All otherwise eligible V1 Alcohol Rescue interventions may be considered.

This disposition does **not** mean “home detox is safe.” It only means the deterministic safety engine did not identify a blocking signal from the available structured evidence for ordinary behavior-change support.

## 12. Human support boundary

Human support is user-controlled only.

The Alcohol Rescue library may select/offer a human-support intervention only when support capability is available.

The intervention may expose an explicit action such as:

```text
Call support person
Message support person
```

but the system does not automatically execute contact merely because the intervention was selected.

Existing Core support invariants remain authoritative:

- no automatic SMS;
- no automatic phone call;
- no automatic Support Circle notification;
- no external action without explicit user action and required consent/capability.

## 13. Fallback behavior

Tobacco's existing hardcoded minimal stabilization fallback is a Tobacco compatibility behavior and is not automatically copied into Alcohol.

For Alcohol:

- emergency/urgent safety states never fall back into ordinary Rescue;
- medical-assessment-advised state may use only an explicitly validated supportive-coping intervention from the installed Alcohol library;
- corrupt/missing Alcohol library returns a safe unavailable/safety-routing result rather than fabricated content;
- behavior-change-support-allowed with no eligible intervention may return `null`/unavailable and let the product show a neutral fallback surface, but that fallback must not create unversioned Alcohol intervention content.

If implementation needs a hardcoded Alcohol fallback, that requires a separate explicit design decision; it is not authorized by this spec.

## 14. Localization

Alcohol content keys are domain-owned.

The existing localization validation infrastructure may be reused, but validation must ensure that every active Alcohol intervention resolves all required title/summary/step keys for the installed locale bundle before activation.

Missing required Alcohol localization must fail closed for that intervention/library activation rather than showing Tobacco copy or raw keys.

## 15. Privacy and logging

Operational logs may include constrained identifiers such as:

```text
moduleId = alcohol
libraryContentVersion
interventionId
interventionVersion
selectionReasonCode
safetyDisposition
```

Normal logs must not include:

- free-text craving narratives;
- drinking-event details;
- exact alcohol quantities;
- withdrawal symptom narratives;
- medication details;
- support-contact details;
- exact location.

This extends existing Core privacy/logging invariants rather than creating a new logging path.

## 16. AI boundary

Alcohol Rescue V1 is fully functional without generative AI.

AI may later personalize wording or ranking only behind the deterministic safety and eligibility boundaries. AI may never:

- activate an intervention that the deterministic selector rejects;
- override a safety disposition;
- invent a taper schedule;
- invent medication instructions;
- fabricate an intervention when the validated library is unavailable;
- automatically contact support.

#35 implementation contains no network/AI dependency in its required safety or selector path.

## 17. Expected package/file direction

Preferred implementation direction:

```text
packages/contracts/src/core/interventions.ts      # extracted generic schemas/types
packages/contracts/src/tobacco/rescue.ts          # composes Core + preserves compatibility
packages/contracts/src/alcohol/rescue.ts          # Alcohol context/eligibility contracts
packages/contracts/src/index.ts                    # public exports

apps/mobile/src/rescue/library-integrity.ts        # generalized integrity mechanics
apps/mobile/src/tobacco/rescue/*                   # unchanged behavior
apps/mobile/src/alcohol/rescue/library.ts          # bundled Alcohol library
apps/mobile/src/alcohol/rescue/selector.ts         # deterministic Alcohol selector
apps/mobile/src/alcohol/rescue/index.ts            # Alcohol Rescue exports
```

Exact decomposition may vary slightly during implementation if existing code structure requires it, but ownership boundaries may not change without a new design review.

## 18. TDD and migration sequence

Implementation must proceed in small RED → GREEN slices.

Expected sequence:

1. RED: Core intervention contracts are absent / Tobacco contract still owns generic primitives.
2. GREEN: extract generic intervention primitives while preserving Tobacco exports and acceptance behavior.
3. RED: Alcohol Rescue context/library contracts absent.
4. GREEN: add Alcohol-owned contracts without Tobacco imports.
5. RED: Alcohol bundled library absent.
6. GREEN: add versioned/sealed Alcohol library containing required intervention families.
7. RED: Alcohol selector/safety disposition behavior absent.
8. GREEN: deterministic selector with fixed safety precedence and supportive-coping allowlist.
9. Add integrity/tamper, offline/AI-independence, localization/boundary and Tobacco regression guards.
10. Run full exact-HEAD CI and require `completed/success` before #35 closes.

Existing behavior that already satisfies an acceptance criterion may be locked with characterization coverage rather than inventing a fake production RED.

## 19. Acceptance tests

#35 is complete only when tests prove all of the following:

1. Core intervention contracts do not import Tobacco or Alcohol schemas.
2. Tobacco public Rescue contracts remain compatible in behavior.
3. Tobacco bundled library and selector acceptance tests remain green.
4. Alcohol Rescue context accepts only Alcohol goal semantics and imports no Tobacco goal/product schema.
5. Alcohol library is independently namespaced and versioned.
6. Alcohol library includes breathing/regulation, ACT urge surfing, delay, non-alcohol substitution, environment change, CBT reframe and human support.
7. Every active Alcohol intervention is offline-capable and has `medicationAdvice = false`.
8. Alcohol library integrity detects intervention or library tampering.
9. Alcohol selector is deterministic.
10. Disabled/capability-ineligible interventions are not selected.
11. User preference/recent-decline/recent-completion ordering follows the specified stable policy.
12. `emergency_response` blocks ordinary Rescue selection.
13. `urgent_medical_assessment` blocks ordinary Rescue selection.
14. `medical_assessment_advised` allows only the specified supportive-coping action kinds and blocks `delay`/`substitution`.
15. `behavior_change_support_allowed` may consider all otherwise eligible Alcohol V1 interventions.
16. Human support cannot be selected when support capability is false.
17. Selection never automatically contacts another person.
18. Alcohol Rescue runtime does not call network/AI services.
19. Alcohol Rescue contains no taper or medication-dosing output surface.
20. Corrupt/missing Alcohol library does not generate unversioned/fabricated fallback content.
21. Core/Tobacco/Alcohol import-boundary tests remain green.
22. Exact final HEAD CI is `completed/success`.

## 20. Explicit non-goals

#35 does not:

- implement Alcohol Recovery Flow (#36);
- implement Alcohol Pattern/Risk Engine contracts (#37);
- wire the full Alcohol Rescue session through persistence/sync E2E (#38);
- implement Tobacco + Alcohol shared-storage coexistence E2E (#39);
- implement Intelligence Engines (#40);
- add doctor communication;
- add breathalyzer/BAC verification;
- add autonomous taper guidance;
- add medication dosing;
- redesign Tobacco UX/content;
- rewrite historical Tobacco Rescue events or sessions;
- merge `rescue-interventions` into `main`;
- touch any production VDS.

## 21. Decision summary

Chosen:

**Incrementally extract domain-neutral intervention-library infrastructure, preserve Tobacco compatibility, and implement a separate Alcohol Rescue Library + deterministic safety-constrained selector.**

Rejected:

- importing Tobacco Rescue contracts directly into Alcohol;
- expanding Tobacco goal/product enums with Alcohol values;
- migrating the full Rescue session stack during #35;
- allowing AI-generated fallback content;
- allowing ordinary Rescue to override urgent/emergency withdrawal routing.

This design preserves the existing Tobacco product while making Alcohol Rescue a first-class module that follows the approved Shared Core + typed domain-module architecture.