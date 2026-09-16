# UNTRAVA — Rescue & Interventions Design Specification

**Date:** 2026-09-16  
**Status:** Approved in conversation; written-spec review pending  
**Parent specification:** `docs/superpowers/specs/2026-09-15-untrava-design.md`  
**Depends on:** completed Foundation milestone (Tasks 1–12)

## 1. Purpose

This specification defines the first follow-on subsystem after the UNTRAVA Foundation milestone: a versioned, local-first Rescue and Intervention system that can help a user through an imminent tobacco/nicotine-use moment without depending on network access, server availability or a generative model.

The subsystem must preserve the parent product principles:

- Rescue is free, unlimited and never paywalled.
- Rescue remains available offline.
- AI may personalize wording later, but it does not own eligibility, safety or intervention selection constraints.
- A lapse is data and a recovery opportunity, not a moral failure.
- Raw behavioral history remains append-oriented and immutable.
- NRT/treatment remains distinct from tobacco-use behavior.

Primary flow:

`Stabilize → Select intervention → Apply briefly → Reassess → Escalate if needed → Support or Recovery`

## 2. Scope

### In scope

- Versioned Local Rescue Library.
- Deterministic intervention eligibility and selection.
- Four Rescue escalation levels.
- Offline Rescue session execution.
- Reassessment after each intervention step.
- Outcome capture suitable for later Learning Engine use.
- Recovery Flow after product use.
- Immutable Rescue-related Quit Event generation.
- A support-action interface that can later connect to Support Circle.
- Safety metadata and deterministic safety gating boundaries.
- Library-version migration and compatibility rules.
- Tests proving complete Rescue operation without network access.

### Out of scope

- Risk Engine and predictive Pre-Craving selection.
- Personalized Learning Engine ranking beyond simple deterministic preference/history inputs.
- Generative-AI intervention creation.
- Medication/NRT initiation or dosing advice.
- Full Support Circle implementation or automatic supporter messaging.
- Notification Budget and Autopilot delivery.
- Health/wearable integrations.
- Public/community Together features.
- Clinical diagnosis or emergency triage beyond deterministic safety/escalation messages defined by approved rules.

## 3. Architectural approach

Use a **hybrid local-first intervention engine**.

The mobile client ships with a validated, versioned Rescue Library containing all content required for a basic Rescue session. The server may later distribute newer approved library versions and collect synced Rescue events, but server access is not required to start, continue or complete a session.

Core local pipeline:

`RescueContext → Safety/Eligibility Filter → Deterministic Selector → Rescue Session State Machine → Outcome → Immutable Events → Existing Local Event Store → Existing Sync Queue`

The implementation must expose stable interfaces so later Intelligence, Learning and Support modules can replace or enrich individual inputs without changing the basic Rescue state machine.

## 4. Domain model

### 4.1 Rescue level

```ts
export type RescueLevel =
  | 'micro'
  | 'guided'
  | 'environment_escape'
  | 'human_support';
```

Interpretation:

1. **Micro Rescue** — lowest-friction intervention, typically tens of seconds to roughly two minutes.
2. **Guided Rescue** — more structured exercise with several steps.
3. **Environment Escape** — physical/context change intended to interrupt an automatic-use loop.
4. **Human Support** — user-initiated contact or support action.

The engine should begin with the lowest-burden eligible option unless context or user choice requires otherwise.

### 4.2 Intervention family

Initial families:

- `act`
- `cbt`
- `behavioral_coping`
- `mindfulness_regulation`
- `environment_change`
- `human_support`

These families are classification metadata. The engine selects a specific intervention, not merely a family.

### 4.3 Intervention definition

Each intervention is editorially approved and versioned.

Required fields:

```ts
export interface InterventionDefinition {
  interventionId: string;
  version: number;
  status: 'active' | 'retired';
  family: InterventionFamily;
  level: RescueLevel;
  titleKey: string;
  summaryKey: string;
  steps: InterventionStep[];
  estimatedSeconds: number;
  burden: 'very_low' | 'low' | 'medium' | 'high';
  offlineCapable: true;
  eligibility: InterventionEligibility;
  safety: InterventionSafetyMetadata;
  outcomePrompts: InterventionOutcomePrompt[];
  contentHash: string;
}
```

The library must not contain executable arbitrary code. Rules are structured data interpreted by deterministic engine code.

### 4.4 Intervention step

A step may request a simple user action such as breathing/regulation, urge-surfing, delay, walking, changing room/location, removing immediate access to the product, drinking water, a short cognitive reframing prompt or contacting support.

A step definition should include:

- stable step ID;
- localized copy key;
- optional duration/timer;
- action kind;
- skippable flag;
- accessibility metadata where relevant.

The content model must support localization without changing clinical/behavioral meaning.

## 5. Rescue context

The selector consumes a compact context object, not unrestricted application state.

```ts
export interface RescueContext {
  userId: string;
  deviceId: string;
  startedAt: string;
  goalType: 'smoke_free' | 'tobacco_free' | 'nicotine_free' | 'reduction';
  productIntent?: 'cigarette' | 'vape' | 'heated_tobacco';
  cravingIntensity?: number;
  locationMode?: 'home' | 'work' | 'social' | 'travel' | 'unknown';
  canMoveEnvironment?: boolean;
  canUseAudio?: boolean;
  canContactSupport?: boolean;
  preferredInterventionIds?: string[];
  recentlyDeclinedInterventionIds?: string[];
  recentlyCompletedInterventionIds?: string[];
}
```

The first implementation may leave some fields undefined. Missing context must reduce personalization rather than block Rescue.

No location coordinate, health record or treatment information is required for core Rescue.

## 6. Eligibility and safety

### 6.1 Deterministic ownership

Eligibility and safety are deterministic. They cannot be delegated to an LLM.

The engine filters interventions before ranking. An ineligible intervention never reaches the selector.

Examples of eligibility constraints:

- requires ability to move environment;
- requires audio availability;
- requires support action availability;
- user has explicitly disabled a method;
- intervention is retired in the active library version.

### 6.2 Safety metadata

Safety metadata is versioned and auditable. Initial fields may include:

```ts
export interface InterventionSafetyMetadata {
  medicationAdvice: false;
  requiresHumanSupport?: boolean;
  avoidWhen?: string[];
  escalationMessageKey?: string;
}
```

This milestone does not create medical contraindication inference. Any future health-dependent eligibility belongs behind the deterministic Safety Engine with explicit approved rules.

No Rescue content may tell the user to start, stop or change the dose of NRT or prescription medication.

## 7. Deterministic selection

The first selector is deliberately simple and reproducible.

Selection order:

1. filter active and eligible definitions;
2. prefer lowest suitable Rescue level;
3. prefer explicitly user-favored interventions;
4. down-rank recently declined items;
5. avoid immediate repetition of a just-completed item when alternatives exist;
6. use stable deterministic tie-breaking, e.g. intervention ID/version order.

The selector returns:

```ts
export interface InterventionSelection {
  interventionId: string;
  version: number;
  reasonCodes: string[];
}
```

Reason codes are machine-readable and later suitable for human-readable explanation.

This milestone must not claim adaptive efficacy ranking. That belongs to `untrava-intelligence-engines`.

## 8. Rescue session state machine

A Rescue session is local-first and resumable.

States:

- `started`
- `stabilizing`
- `intervention_selected`
- `intervention_active`
- `reassessing`
- `escalating`
- `support_offered`
- `recovery`
- `resolved`
- `abandoned`

Allowed main path:

`started → stabilizing → intervention_selected → intervention_active → reassessing`

From reassessment:

- improved sufficiently → `resolved`
- still difficult → `escalating` → new eligible intervention
- user requests human support → `support_offered`
- user reports product use → `recovery`
- user exits → `abandoned`

State transitions must be explicit and tested. UI code does not mutate session state arbitrarily.

## 9. Reassessment and escalation

Reassessment should be deliberately brief.

Minimum inputs:

- current craving intensity, if the user wishes to provide it;
- whether product use occurred;
- whether the user wants another step;
- optionally whether environment changed or support was requested.

Escalation should not depend solely on a numeric craving threshold. User choice can escalate or stop at any point.

Default level progression:

`micro → guided → environment_escape → human_support`

Skipping levels is allowed when required by eligibility/context or explicitly selected by the user.

## 10. Outcome model

A Rescue session does not define success only as abstinence.

Outcome fields may include:

```ts
export interface RescueOutcome {
  cravingBefore?: number;
  cravingAfter?: number;
  delayMinutes?: number;
  environmentChanged?: boolean;
  exerciseCompleted?: boolean;
  supportRequested?: boolean;
  productUseOutcome?: 'no_use' | 'use' | 'unknown';
  userHelpfulRating?: 'helped' | 'neutral' | 'did_not_help';
}
```

Missing values are valid. The product must never force a user to fill a long questionnaire during Rescue.

Outcome data feeds later Learning Engine work but this subsystem only records facts.

## 11. Immutable events

Rescue uses the existing immutable Quit Event system. Existing event families are sufficient for the first implementation:

- `intervention_started`
- `intervention_completed`
- `intervention_outcome`
- `support_request`
- `product_use`
- `correction` / `retraction` where later corrections are needed

Recommended payload metadata includes:

- `rescueSessionId`;
- intervention ID and version;
- Rescue level;
- reason codes;
- outcome fields;
- library version.

An intervention completion must never rewrite its start event. A later correction produces a new correction event.

All Rescue events are written to the existing local event store before any network attempt.

## 12. Recovery Flow

If the user reports product use, the session transitions into `recovery` without shame language, punitive animation or blocked navigation.

Recovery Flow is short:

1. record the product-use event;
2. optionally capture minimal context;
3. offer one immediate recovery action;
4. allow the user to return to their current goal without silently changing strategy;
5. preserve prior progress and savings data.

A single use does not automatically change a goal to failed or relapse. Higher-level lapse/relapse interpretation belongs to later intelligence/product logic.

The recovery action itself may be a versioned intervention with `recoveryEligible: true` or a dedicated recovery definition using the same library format.

## 13. Human support interface

Support Circle is not implemented in this milestone. Rescue therefore depends only on an abstract interface:

```ts
export interface SupportActionProvider {
  canOfferSupport(): Promise<boolean>;
  requestUserInitiatedSupport(input: SupportActionRequest): Promise<SupportActionResult>;
}
```

Rules:

- support is user-initiated by default;
- no automatic message is sent merely because Rescue escalated;
- no contact data is embedded in the Rescue library;
- if no provider is configured, human-support interventions are filtered out or replaced with a generic user-controlled contact option supported by the host platform.

## 14. Versioned Local Rescue Library

The app ships with a default library bundle.

Library envelope:

```ts
export interface RescueLibrary {
  libraryId: 'untrava-rescue';
  schemaVersion: 1;
  contentVersion: number;
  publishedAt: string;
  interventions: InterventionDefinition[];
  contentHash: string;
}
```

Validation requirements:

- unique `(interventionId, version)` pairs;
- only known families, levels, action kinds and rule fields;
- no duplicate active version of the same intervention ID;
- every active intervention has at least one step;
- every intervention is explicitly offline capable;
- all referenced localization keys exist in the packaged locale baseline;
- hash/checksum mismatch fails closed to the last known valid bundled library.

## 15. Library updates and migration

A newer approved library may later arrive from the server, but Rescue startup must never block waiting for it.

Rules:

- bundled library is always available;
- downloaded library is validated completely before activation;
- invalid update is rejected and previous valid library remains active;
- an already-running Rescue session remains pinned to the intervention version with which it started;
- retired interventions remain readable in historical event interpretation;
- library schema migrations are explicit; unknown future schema versions are not activated by older clients.

## 16. Persistence and offline behavior

A Rescue session may be interrupted by app suspension or process death. The client therefore persists enough local session state to resume or cleanly close the session.

Required persisted data:

- rescue session ID;
- pinned library/content version;
- selected intervention ID/version;
- current state;
- current step index;
- started timestamp;
- compact reassessment/outcome data already captured.

No network acknowledgement is required before state advances locally.

Event persistence is authoritative for historical facts; resumable Rescue session state is operational state and may be deleted after a finalized session plus safe retention window.

## 17. Initial intervention content set

The first implementation should provide a deliberately small but complete editorial sample library sufficient to prove every flow and family boundary. It should not pretend to be the final evidence library.

Minimum functional set:

- one Micro Rescue breathing/regulation exercise;
- one urge-surfing / ACT-style exercise;
- one CBT reframing exercise;
- one behavioral delay/substitution exercise;
- one environment-change intervention;
- one human-support action;
- one Recovery Flow action.

Content copy should be neutral, concise and non-shaming. Exact final evidence/editorial wording can be expanded later without changing the engine contract.

## 18. Public interfaces

Expected module-level interfaces:

```ts
interface RescueLibraryRepository {
  getActiveLibrary(): Promise<RescueLibrary>;
  installValidatedLibrary(candidate: RescueLibrary): Promise<void>;
}

interface InterventionSelector {
  select(library: RescueLibrary, context: RescueContext): InterventionSelection | null;
}

interface RescueSessionStore {
  create(session: RescueSession): Promise<void>;
  get(sessionId: string): Promise<RescueSession | null>;
  save(session: RescueSession): Promise<void>;
  finalize(sessionId: string): Promise<void>;
}

interface RescueEventSink {
  append(event: QuitEventEnvelope): Promise<void>;
}
```

A coordinator/service owns state transitions and emits immutable events through the event sink.

## 19. Error handling

Rescue should fail soft where possible.

- Network unavailable: no effect on core Rescue.
- Server unavailable: no effect on core Rescue.
- AI unavailable: no effect on core Rescue.
- Downloaded library invalid: use last known valid/bundled library.
- Preferred intervention ineligible: select next eligible candidate.
- No eligible intervention: fall back to a built-in minimal stabilization/recovery-safe action and user-controlled support options.
- Local persistence failure: surface a clear non-shaming error and do not falsely claim the Rescue history was saved.

## 20. Privacy and logging

Sensitive Rescue contents and user-entered context must not be written to ordinary application logs.

Operational logs may include only low-risk metadata such as:

- session state transition names;
- intervention ID/version;
- library version;
- error class/code.

Do not log free text, health/treatment details, contact information, exact location or complete event payloads.

## 21. Testing strategy

Test-driven implementation is required.

### Contract tests

- valid/invalid Rescue library definitions;
- unknown schema version rejected;
- duplicate active intervention rejected;
- deterministic selector stability;
- eligibility filtering;
- retired definitions excluded from new selections.

### State-machine tests

- normal resolve path;
- reassessment and escalation;
- user-requested immediate escalation;
- product use → Recovery Flow;
- abandonment;
- process-resume from persisted state;
- running session remains pinned to its intervention/library version.

### Local-first tests

With a transport/server stub that always throws:

- Rescue starts;
- intervention is selected;
- steps complete;
- reassessment works;
- outcome is recorded;
- immutable events exist locally;
- the session resolves/recovery completes without network.

### Event tests

- intervention start and completion are distinct events;
- product-use event after Rescue is append-only;
- correction does not mutate originals;
- Rescue-generated events enter existing sync queue;
- replay remains idempotent at server boundary via the existing Foundation behavior.

### Library migration tests

- valid newer content activates;
- invalid hash/version does not replace active valid library;
- historical intervention version remains interpretable;
- active session does not silently jump versions.

## 22. Acceptance gate

The `untrava-rescue-interventions` milestone is complete only when all of the following are demonstrated by automated tests and remote CI:

- a Rescue session can be completed end to end with network disabled;
- the bundled library is versioned, validated and deterministic;
- selector never chooses an ineligible or retired intervention;
- four escalation levels are representable and transitions are explicit;
- reassessment can resolve, escalate, request support or enter Recovery Flow;
- product use during/after Rescue creates an immutable product-use event and does not rewrite prior events;
- recovery is non-punitive and does not silently change the user's goal;
- Rescue outcome facts are persisted for later learning without claiming causal efficacy;
- invalid downloaded library updates fail closed to the previous valid library;
- running sessions remain pinned to the intervention version they started with;
- Support Circle is optional through an interface and no automatic contact occurs by default;
- no medication/NRT dosing logic is introduced;
- lint, typecheck and all relevant tests pass in GitHub Actions.

## 23. Forward compatibility

This subsystem is intentionally built so later plans can consume it without rewriting the Rescue core:

- `untrava-intelligence-engines` may provide richer risk/context and candidate ranking.
- `untrava-core-mobile-ux` will render Rescue surfaces around the state machine.
- `untrava-autopilot-notifications-ai` may trigger/pre-fill Rescue context and personalize approved wording.
- `untrava-support-together` will provide a concrete `SupportActionProvider`.
- `untrava-health-wearables` may contribute optional context through deterministic safety/privacy boundaries.
- `untrava-reporting-release` may summarize Rescue outcomes while preserving uncertainty and privacy.

None of those later modules may make core Rescue dependent on network or generative AI availability.
