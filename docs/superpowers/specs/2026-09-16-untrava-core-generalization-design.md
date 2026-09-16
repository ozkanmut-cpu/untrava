# UNTRAVA Core Generalization — Architecture Design Specification

**Date:** 2026-09-16  
**Status:** Approved architecture direction; implementation not started  
**Branch:** `rescue-interventions`  
**Scope:** Generalize UNTRAVA from a tobacco-first codebase into a shared behavior-change platform without changing existing Tobacco behavior.

## 1. Decision

UNTRAVA will use a **Shared Core + typed domain modules** architecture.

The Core owns behavior-change infrastructure that is valid across domains. Tobacco, Alcohol and future domains own their domain semantics, measurements, safety extensions, goals and content.

Target structure:

```text
UNTRAVA Core
├── Identity / Device
├── Consent
├── Immutable Event Envelope
├── Local Event Store / Sync
├── Goal Lifecycle
├── Rescue Session Engine
├── Recovery Semantics
├── Support Boundary
├── Versioned Intervention Infrastructure
├── Privacy / Logging
└── Intelligence Interfaces

Domain Modules
├── Tobacco Module
│   ├── Tobacco goals
│   ├── Tobacco-use schemas
│   ├── Tobacco Rescue Library
│   ├── Tobacco-specific safety
│   └── Tobacco reporting/progress semantics
└── Alcohol Module
    ├── Alcohol goals
    ├── Alcohol-use schemas
    ├── Alcohol Rescue Library
    ├── Alcohol-specific withdrawal/safety rules
    └── Alcohol reporting/progress semantics
```

The Core must not know what a cigarette, vape, nicotine dose, beer, standard drink, alcohol-free day or alcohol withdrawal state means.

## 2. Why this architecture

The current code has three tobacco-specific seams that prevent clean expansion:

- `GoalTypeSchema` contains only `smoke_free | tobacco_free | nicotine_free | reduction`.
- `ProductTypeSchema` contains only `cigarette | vape | heated_tobacco`.
- `QuitEventEnvelope` and Rescue context import these tobacco-specific types directly.

Extending those enums with every future behavior would turn the Core into a growing domain registry and force unrelated domains to depend on each other. A runtime plugin system would avoid that coupling, but it would add unnecessary discovery, loading and validation complexity at this stage.

Typed domain modules preserve compile-time contracts while keeping domain concepts outside the Core.

## 3. Architectural invariants

These are non-negotiable:

1. **Core is domain-agnostic.** Core source must not contain tobacco/alcohol product enums, domain goal enums, standard-drink rules, nicotine concepts or domain-specific withdrawal logic.
2. **Domain modules are strongly typed.** Each module owns schemas for its goals, usage events, progress semantics, Rescue context extension and safety policy.
3. **History is immutable.** Existing Tobacco events are never rewritten to achieve the migration.
4. **Offline-first behavior remains intact.** Rescue, Recovery and event capture remain usable without server or generative AI.
5. **Safety remains deterministic.** Generative AI never becomes the authority for eligibility, dosing, treatment changes or withdrawal-risk decisions.
6. **Recovery remains non-punitive.** A use event never silently destroys history, changes a goal, or marks a goal failed unless an explicit domain rule and explicit user action say so.
7. **Module coexistence is required.** A single user may eventually have active Tobacco and Alcohol behavior-change contexts without namespace collisions or cross-domain interpretation.
8. **Existing Tobacco acceptance behavior must remain unchanged during extraction.** Generalization is an architectural migration, not a Tobacco product redesign.

## 4. Core responsibilities

### 4.1 Identity and consent

Core owns:

- user/device identity;
- device sessions;
- consent ledger mechanics;
- recipient/purpose/data-category authorization boundaries;
- consent revocation semantics.

Modules may declare additional data categories, but cannot bypass Core consent enforcement.

### 4.2 Generic immutable event envelope

The transport/storage envelope becomes domain-neutral in concept.

Conceptual shape:

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

Core validates envelope-level invariants and owns append-only storage, correction/retraction mechanics, replay and sync idempotence.

The owning module validates `eventType` + `payload` semantics.

Existing `QuitEventEnvelope` remains supported during migration through a Tobacco compatibility adapter. No existing stored event needs to be rewritten in-place.

### 4.3 Goal lifecycle

Core owns goal identity and lifecycle facts:

```text
goalId
userId
moduleId
goalTypeKey
goalSchemaVersion
startsAt
endsAt
createdAt
```

Core does **not** interpret `goalTypeKey`.

The domain module owns the schema and meaning of goal configuration. Examples:

- Tobacco: `smoke_free`, `tobacco_free`, `nicotine_free`, `reduction`.
- Alcohol: `abstinence`, `reduction`, `alcohol_free_days`, `usage_limit`.

Rules shared by all modules:

- goal changes are historical events, not silent mutation;
- Rescue/Recovery pins `goalId`;
- Recovery may not silently switch goals;
- ending/changing a goal requires an explicit lifecycle action.

### 4.4 Rescue engine

Core owns the reusable Rescue machinery:

- session identity;
- state machine;
- transition rules;
- escalation levels;
- local persistence/resume;
- intervention version pinning;
- deterministic selector infrastructure;
- outcome persistence mechanics;
- support boundary;
- fail-closed persistence behavior.

Core states remain conceptually reusable:

```text
started
→ stabilizing
→ intervention_selected
→ intervention_active
→ reassessing
→ resolved | escalating | support_offered | recovery | abandoned
```

The Core must not decide what domain use means or what constitutes dangerous withdrawal.

### 4.5 Recovery semantics

Core owns universal Recovery invariants:

- no shame/punitive state;
- historical events remain intact;
- a use event is appended rather than rewriting history;
- current `goalId` remains pinned unless the user explicitly changes it;
- Recovery may select only interventions marked recovery-eligible;
- Recovery completion records facts, not a causal claim that an intervention worked.

The module owns domain wording, use-event details and domain-specific progress calculations.

### 4.6 Support boundary

Core owns the `SupportActionProvider`-style boundary:

- support capability is optional;
- escalation may offer support;
- no automatic contact by default;
- external action occurs only after an explicit permitted user action;
- consent and privacy are enforced by Core.

Modules may customize support content and eligibility but not bypass these invariants.

### 4.7 Versioned intervention infrastructure

Core owns:

- library schema versioning mechanics;
- content version pinning;
- checksum/integrity checks;
- active/retired semantics;
- deterministic install/activation behavior;
- historical library retention;
- localization-key validation infrastructure;
- generic burden/level/version concepts.

Domain modules own:

- actual intervention definitions;
- action kinds that are meaningful for that domain;
- domain-specific eligibility fields;
- domain-specific safety metadata;
- outcome prompt definitions.

Core must not contain an Alcohol or Tobacco content library.

### 4.8 Privacy and logging

Core owns the default operational logging boundary and safe metadata allowlist.

Modules may contribute safe identifiers/classification metadata through a constrained interface. They may not put free text, full event payloads, treatment information, contact information or exact location into normal logs.

### 4.9 Intelligence interfaces

Core will later define interfaces for derived intelligence but not domain algorithms.

Conceptually:

```text
Module facts/context
→ module-specific feature builder
→ shared intelligence interface
→ module-specific safety/eligibility gate
→ intervention candidate ranking
→ outcome facts
```

Risk, learning and recommendation outputs must carry version/confidence/evidence metadata. AI remains a communication/personalization layer and cannot override deterministic safety.

## 5. Domain Module contract

Each behavior domain must expose a typed module definition conceptually equivalent to:

```ts
interface BehaviorModule {
  moduleId: string;
  moduleVersion: number;
  goalSchema: Schema;
  usageEventSchemas: EventSchemaRegistry;
  rescueContextSchema: Schema;
  interventionLibraryProvider: InterventionLibraryProvider;
  safetyPolicy: ModuleSafetyPolicy;
  progressPolicy: ProgressPolicy;
}
```

The exact TypeScript API will be designed in the implementation plan; this spec defines responsibilities, not final syntax.

A module must be independently testable and must not mutate another module's data.

## 6. Tobacco Module boundary

The first migration target is the existing Tobacco behavior.

Tobacco Module owns:

- `cigarette`, `vape`, `heated_tobacco` and future tobacco/nicotine product definitions;
- Tobacco goal types;
- Quit strategy semantics specific to Tobacco;
- product-use payload validation;
- craving/withdrawal semantics specific to Tobacco;
- Tobacco Rescue Library content;
- Tobacco progress/streak/savings semantics;
- treatment/NRT domain records and their safety/privacy semantics;
- Tobacco-specific report labels and user-facing terminology.

The module must preserve all existing Tobacco Rescue acceptance behavior.

## 7. Alcohol Module boundary

Alcohol is a separate module, not an extension of Tobacco enums.

Alcohol Module will own:

- alcohol goal types;
- beverage/use-event representation;
- amount and standard-drink interpretation;
- planned/unplanned use context;
- Alcohol Rescue Library;
- Alcohol Recovery semantics layered on Core Recovery invariants;
- Alcohol pattern/risk inputs;
- Alcohol-specific safety engine, especially dangerous withdrawal risk.

Critical safety rule: the Alcohol module may identify when clinical evaluation is appropriate, but must not invent taper schedules or medication dosing. Generative AI is never the authority for withdrawal-risk classification.

## 8. Safety architecture

Safety is intentionally two-layered.

### Core safety invariants

Universal rules include:

- no generative-AI authority over deterministic safety;
- no module may silently alter a user's current goal;
- no medication/treatment start, stop or dose change through generic Rescue actions;
- explicit consent is required for external support actions;
- unknown safety-control fields fail closed where schemas require strictness;
- unsafe or unrecognized module data cannot silently downgrade validation.

### Module safety policies

A module may add stricter domain rules.

Examples:

- Tobacco: NRT/cessation-treatment boundaries.
- Alcohol: withdrawal-risk detection and clinical escalation.

Module rules can only restrict or escalate behavior; they cannot weaken Core invariants.

## 9. Event namespacing and coexistence

Events must be unambiguous when multiple modules coexist.

Preferred direction:

```text
moduleId = "tobacco" | "alcohol" | ...
eventType = module-local or shared semantic key
```

Core lifecycle events may use shared semantics where truly universal. Domain facts remain module-scoped.

A Tobacco `product_use` and an Alcohol `use` event must never be interpreted through the other module's schema.

Cross-module analytics may read normalized derived signals only through explicit adapters; raw domain units must not be casually normalized or erased.

## 10. Migration strategy

Migration is incremental and must remain continuously green.

### Phase A — Extract Core contracts

Introduce domain-neutral concepts alongside current Tobacco names. Do not delete or rewrite Tobacco contracts yet.

### Phase B — Add Tobacco compatibility adapter

Map current `QuitProfile`, `GoalType`, `ProductType`, `QuitEventEnvelope` and Rescue context into the new Core + Tobacco Module boundaries while preserving external behavior.

### Phase C — Move ownership

Move Tobacco-specific schemas/content behind the Tobacco Module boundary. Core tests must prove that Core does not import Tobacco schemas.

### Phase D — Prove coexistence

Add Alcohol contracts and instantiate both modules on the same Core local event/sync infrastructure.

### Phase E — Retire compatibility names only when safe

Legacy names such as `QuitEvent*` may remain aliases for compatibility until all callers migrate. Removal, if ever performed, requires a separate explicit migration and is not part of this spec.

## 11. Compatibility requirements

During generalization:

- existing event IDs stay stable;
- existing stored event payloads remain readable;
- corrections/retractions retain their original targets;
- active Rescue sessions retain pinned library/intervention versions;
- current Tobacco goal IDs remain stable;
- existing Rescue/Recovery tests continue to pass;
- sync replay remains idempotent;
- no historical data rewrite is required;
- no `main` merge is implied by completing this architecture work.

## 12. Package and dependency direction

Target dependency rule:

```text
Core contracts / Core services
        ↑
        │
Tobacco Module   Alcohol Module   Future Module
        ↑              ↑
        └──── Application composition ────┘
```

Core may not import a domain module.

Domain modules may import Core contracts.

Application composition may import both Core and one or more domain modules.

This rule should become testable through import-boundary or dependency tests once extraction begins.

## 13. Testing strategy

Generalization is complete only when tests prove architectural behavior, not merely compilation.

Required categories:

1. **Core contract tests** — generic event envelope, generic goal lifecycle, module identity/versioning.
2. **Import-boundary tests** — Core cannot import Tobacco or Alcohol packages/schemas.
3. **Tobacco compatibility tests** — all current Tobacco Rescue/Recovery acceptance tests still pass unchanged in meaning.
4. **Module isolation tests** — Tobacco data cannot validate as Alcohol data and vice versa.
5. **Shared persistence tests** — both modules use the same LocalEventStore/SyncQueue without collisions.
6. **Goal isolation tests** — Recovery in one module cannot change the goal of another module.
7. **Safety composition tests** — module safety may strengthen but never weaken Core invariants.
8. **Cross-module coexistence E2E** — Tobacco + Alcohol sessions/events coexist offline and sync through the same Core infrastructure.

## 14. Explicit non-goals

This architecture task does not:

- implement Alcohol behavior yet;
- implement Intelligence Engines;
- redesign Tobacco UX/content;
- introduce runtime-loaded plugins;
- create microservices;
- migrate or rewrite historical production data;
- merge `rescue-interventions` to `main`;
- change production VDS infrastructure.

## 15. Acceptance criteria for the Core-generalization milestone

The subsequent implementation is acceptable only when all are true:

- Core source contains no Tobacco/Alcohol domain enums or unit semantics;
- Tobacco behavior runs through a typed Tobacco Module;
- Alcohol can be introduced without editing Core domain enums;
- generic events and goals are module-scoped and collision-safe;
- shared Rescue/Recovery mechanics remain deterministic/offline-capable;
- Recovery preserves module-specific `goalId` without silent changes;
- Core safety/privacy invariants cannot be weakened by modules;
- existing Tobacco acceptance suite remains green;
- Tobacco + Alcohol can share event storage/sync in one coexistence test;
- exact HEAD CI is `completed/success` before the milestone is considered green.

## 16. Decision summary

Chosen: **Shared Core + typed domain modules**.

Rejected for now:

- expanding a single global `ProductType`/`GoalType` union for every behavior domain;
- a fully dynamic runtime plugin/registry system.

This design gives UNTRAVA a stable reusable behavior-change foundation while preserving strict domain ownership, safety isolation, local-first behavior and the already-validated Tobacco Rescue system.
