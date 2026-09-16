# UNTRAVA Behavior Change Core — Boundary Contract Specification

**Date:** 2026-09-16  
**Status:** Approved refinement of the Core-generalization architecture  
**Parent spec:** `docs/superpowers/specs/2026-09-16-untrava-core-generalization-design.md`  
**Scope:** Define the reusable Core boundaries for Goals, Events, Rescue, Recovery, Support and Intelligence without moving Tobacco- or Alcohol-specific semantics into Core.

## 1. Boundary rule

Every shared subsystem follows the same rule:

```text
Core owns lifecycle + invariants + persistence mechanics + orchestration contracts
Domain module owns meaning + domain schemas + domain safety + domain content
Application composition wires Core and modules together
```

Core must never import Tobacco or Alcohol schemas. Domain modules may import Core contracts. Cross-module behavior may occur only through explicit Core contracts or explicit normalized adapters.

## 2. Dependency direction

```text
                        Application Composition
                         /                 \
                        v                   v
                 Tobacco Module      Alcohol Module
                        \                   /
                         \                 /
                          v               v
                           Behavior Change Core
              ┌───────────┼───────────┬───────────┐
              v           v           v           v
            Goals       Events      Rescue      Support
                                      |
                                      v
                                   Recovery
                                      |
                                      v
                                 Intelligence
```

Allowed:
- module → Core contracts/services;
- application composition → Core + modules;
- Intelligence adapters → validated Core facts + module feature builders.

Forbidden:
- Core → Tobacco/Alcohol imports;
- module A → module B raw domain schemas;
- Intelligence → direct mutation of goals, events, Rescue state or safety decisions;
- Support provider → bypass of consent/explicit-action rules.

## 3. Goals boundary

### Core owns

- `goalId` identity;
- `userId` + `moduleId` ownership;
- start/end lifecycle;
- historical goal-change facts;
- one explicit current-goal resolution policy per module context;
- immutable goal history;
- goal pinning into Rescue/Recovery;
- protection against silent goal replacement.

Conceptual Core record:

```ts
interface CoreGoalRecord<TConfig = unknown> {
  goalId: string;
  userId: string;
  moduleId: string;
  goalTypeKey: string;
  goalSchemaVersion: number;
  config: TConfig;
  startsAt: string;
  endsAt: string | null;
}
```

### Module owns

- valid `goalTypeKey` values;
- configuration schema and semantic meaning;
- progress calculations;
- whether a configuration is valid for that domain;
- domain labels/copy.

Examples:
- Tobacco: `smoke_free`, `tobacco_free`, `nicotine_free`, `reduction`.
- Alcohol: `abstinence`, `reduction`, `alcohol_free_days`, `usage_limit`.

### Inputs

- explicit create/change/end command;
- validated module goal configuration;
- actor/user/device context;
- timestamps.

### Outputs

- immutable goal lifecycle fact/event;
- current goal reference for that module;
- pinned `goalId` usable by Rescue/Recovery.

### Forbidden

- Core interpreting domain goal semantics;
- Recovery silently replacing `goalId`;
- Intelligence changing goals directly;
- one module changing another module's goal.

### Acceptance test

A Recovery flow in module A preserves its pinned `goalId` and cannot alter the active goal in module B.

## 4. Events boundary

### Core owns

- event envelope identity and timestamps;
- `moduleId` namespacing;
- append-only storage;
- correction/retraction mechanics;
- local-first persistence;
- sync queue integration;
- server replay/idempotence;
- immutable historical ordering semantics.

Conceptual envelope:

```ts
interface BehaviorEventEnvelope<TPayload = unknown> {
  eventId: string;
  userId: string;
  deviceId: string;
  moduleId: string;
  eventType: string;
  occurredAt: string;
  recordedAt: string;
  schemaVersion: number;
  payload: TPayload;
}
```

### Module owns

- allowed event types;
- payload schemas;
- domain units;
- domain validation;
- interpretation of the event.

### Inputs

- validated module event payload;
- Core envelope metadata;
- optional target event for correction/retraction.

### Outputs

- immutable locally persisted event;
- sync-eligible queue item;
- duplicate-safe server ingestion result.

### Forbidden

- Core normalizing raw domain quantities without an explicit adapter;
- in-place historical mutation;
- interpreting Tobacco payloads as Alcohol payloads or vice versa;
- logging full event payloads through normal operational logs.

### Acceptance test

Tobacco and Alcohol events with the same local `eventType` string remain collision-safe because `moduleId` scopes validation and interpretation, and both can share the same local store/sync queue.

## 5. Rescue boundary

### Core owns

- Rescue session identity;
- state machine and legal transition graph;
- local session persistence/resume;
- deterministic selection orchestration;
- escalation levels;
- pinned library/intervention versions;
- pinned module + goal identity;
- fail-closed persistence semantics;
- outcome fact persistence mechanics;
- support-offer transition mechanics.

Conceptual session identity:

```ts
interface CoreRescueSession<TContext = unknown, TOutcome = unknown> {
  rescueSessionId: string;
  moduleId: string;
  goalId?: string;
  state: string;
  libraryContentVersion: number;
  interventionId: string | null;
  interventionVersion: number | null;
  context: TContext;
  outcome?: TOutcome;
}
```

### Module owns

- Rescue context extension schema;
- intervention definitions/content;
- domain action kinds;
- domain eligibility rules;
- domain safety metadata;
- factual outcome fields meaningful to that domain.

### Inputs

- module context;
- validated versioned intervention library;
- current module goal reference;
- capability flags;
- explicit user actions.

### Outputs

- deterministic selection result;
- persisted session transition;
- immutable intervention events/outcome facts;
- optional transition to Support or Recovery.

### Forbidden

- AI choosing around safety gates;
- module content changing Core state directly;
- medication/treatment start-stop-dose actions through generic Rescue;
- silent intervention/library version jumps during a running session.

### Acceptance test

The same Core state machine can run a Tobacco and an Alcohol Rescue session while each uses a different context schema/library/safety policy and neither Core nor the other module needs domain-specific branching.

## 6. Recovery boundary

Recovery is not a separate domain engine; it is a Core lifecycle mode reached from a domain use event or explicit recovery entry.

### Core owns

- transition into `recovery`;
- non-punitive invariants;
- preservation of historical events;
- preservation of the pinned `goalId`;
- recovery-only intervention eligibility flag/mechanics;
- immutable recording of Recovery activity/outcomes;
- prohibition on causal efficacy claims from raw outcome facts.

### Module owns

- domain-specific use-event details;
- Recovery copy/content;
- domain progress consequences that are mathematically appropriate;
- additional domain safety checks before/within Recovery.

### Inputs

- immutable domain use fact;
- current Rescue/goal/module context;
- recovery-eligible intervention library.

### Outputs

- Recovery session state;
- recovery intervention events;
- factual outcome record;
- return to the same current goal unless the user explicitly changes it.

### Forbidden

- deleting prior progress/history;
- automatically marking a goal failed/relapsed from a single use;
- silently creating a new goal;
- rewriting the triggering use event.

### Acceptance test

A single use in either Tobacco or Alcohol appends a use fact, enters Recovery, preserves history and `goalId`, and does not automatically produce a `goal_changed` event.

## 7. Support boundary

### Core owns

- support capability interface;
- capability availability state;
- consent/authorization check integration;
- explicit-user-action requirement;
- support request/event recording;
- distinction between `support_offered` and external contact execution.

Conceptual contract:

```ts
interface SupportActionProvider<TRequest = unknown> {
  isAvailable(): boolean;
  executeExplicitAction(request: TRequest): Promise<void>;
}
```

### Module owns

- domain-specific support wording;
- domain-specific support eligibility/context;
- domain-specific suggested request payload after Core privacy/consent rules.

### Inputs

- explicit user action;
- permitted recipient/action configuration;
- current module context.

### Outputs

- support request fact;
- external action only when explicitly authorized and available.

### Forbidden

- automatic message/call because risk or craving is high;
- module bypass of Core consent;
- Support provider mutating goals/Rescue history;
- raw private health/treatment/event payload leakage.

### Acceptance test

Escalation may reach `support_offered` with zero external side effects; only a later explicit permitted action can call the provider.

## 8. Intelligence boundary

Intelligence is advisory/derived, never the source of truth for raw facts or deterministic safety.

### Core owns

- versioned input/output interface shape;
- provenance/evidence references;
- confidence/state metadata;
- reproducibility metadata;
- separation of raw fact vs derived inference;
- rule that Intelligence cannot directly mutate Core state.

Conceptual output:

```ts
interface IntelligenceResult<TValue = unknown> {
  moduleId: string;
  engineId: string;
  engineVersion: string;
  value: TValue;
  confidence?: number;
  evidenceEventIds: string[];
  computedAt: string;
}
```

### Module owns

- feature construction from domain facts;
- domain-specific risk/learning models;
- domain-specific meaning of outputs;
- domain-specific safety gate applied before action selection.

### Inputs

- immutable Core events;
- current goal/module context;
- module-derived features;
- versioned engine configuration.

### Outputs

- derived risk/pattern/ranking candidates with evidence/provenance;
- no direct side effect.

### Forbidden

- writing raw facts;
- changing goals;
- bypassing Rescue eligibility/safety;
- triggering external support automatically;
- making medication/taper/dosing decisions;
- presenting correlation as proven causation.

### Acceptance test

An Intelligence result may influence candidate ranking only after the module safety/eligibility gate; identical versioned inputs produce reproducible metadata, and removing Intelligence entirely does not break manual offline Rescue.

## 9. Cross-boundary orchestration

Normal direction of data flow:

```text
Module-validated fact
    ↓
Events Core
    ↓
Goal/Context lookup
    ↓
Optional Intelligence (derived only)
    ↓
Module Safety + Eligibility
    ↓
Rescue Core orchestration
    ↓
Outcome facts → Events Core
    ↓
Recovery if use occurred
    ↓
Support only after explicit action
```

No arrow is allowed to point from Intelligence directly into Goals, Event mutation, Support execution or safety override.

## 10. Shared vs module-owned matrix

| Capability | Core | Module |
| --- | --- | --- |
| Identity/device | owns | uses |
| Consent mechanics | owns | declares extra categories |
| Event envelope/store/sync | owns | payload semantics |
| Goal lifecycle | owns | goal meaning/config |
| Rescue state machine | owns | context/library/safety |
| Recovery invariants | owns | use/progress semantics |
| Support execution boundary | owns | copy/context |
| Operational privacy/logging | owns | constrained safe metadata only |
| Intelligence interface/provenance | owns | features/models/meaning |
| Treatment/withdrawal domain rules | no domain semantics | owns |
| Streak/savings/standard-drink math | no | owns |

## 11. Architectural acceptance gate

This boundary definition is considered implemented only when later code proves all of the following:

1. Core packages compile without importing Tobacco or Alcohol schemas.
2. Core Goal lifecycle accepts module-owned goal types/config without a global domain enum.
3. Core Events stores and syncs multiple module payload families without collision.
4. Core Rescue runs with module-provided context/library/safety contracts.
5. Core Recovery preserves goal/history independently of module semantics.
6. Support remains optional and explicit-action-only across modules.
7. Intelligence has no direct state mutation/safety authority.
8. Tobacco behavior remains compatible with all existing Rescue acceptance tests.
9. Alcohol can be added without modifying Core domain enums.
10. A cross-module offline test proves Tobacco + Alcohol coexist on the same event store/sync infrastructure.

## 12. Implementation order implied by this boundary spec

The next implementation work should proceed in this dependency order:

1. extract domain-neutral Core contracts/interfaces;
2. introduce Tobacco Module adapters around existing schemas/behavior;
3. add import-boundary tests;
4. move Tobacco-specific ownership behind the module boundary;
5. only then add Alcohol contracts/module behavior;
6. prove coexistence;
7. only after Core + both modules are stable, begin Intelligence Engines.

This document refines the parent architecture; it does not itself migrate code, change Tobacco behavior, create Alcohol behavior, merge to `main`, or touch production infrastructure.
