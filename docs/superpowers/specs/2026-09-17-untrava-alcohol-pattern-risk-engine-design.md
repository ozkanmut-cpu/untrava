# UNTRAVA Alcohol Pattern/Risk Engine — Data Contract Design Specification

**Date:** 2026-09-17  
**Status:** Approved design direction; implementation not started  
**Branch:** `rescue-interventions`  
**Parent Alcohol spec:** `docs/superpowers/specs/2026-09-16-untrava-alcohol-module-design.md`  
**Withdrawal safety spec:** `docs/superpowers/specs/2026-09-16-untrava-alcohol-withdrawal-risk-engine-design.md`  
**Roadmap item:** #37 — Alcohol Pattern/Risk Engine data contracts.

## 1. Decision

Roadmap item #37 defines two separate Alcohol-derived data contracts:

1. `AlcoholPatternInsight` — a structured statement about a recurring or trending pattern observed in Alcohol module facts.
2. `AlcoholNearTermRiskAssessment` — a structured estimate of near-term **behavioral vulnerability** such as increased likelihood of unplanned use or exceeding a user-authored plan.

Both contracts share one evidence/provenance envelope containing:

- engine identity;
- rule-set/model identity and version;
- calculation time window;
- contributing `evidenceEventIds`;
- confidence;
- missingness/completeness information;
- `computedAt`.

These outputs are derived and recomputable. They never replace, rewrite or mutate canonical Alcohol events, plans, goals, Rescue history, Recovery history or safety decisions.

## 2. Critical semantic boundary

`AlcoholNearTermRiskAssessment` is **not** a medical-risk contract.

It must never be interpreted as:

- AUD diagnosis or severity;
- alcohol-dependence diagnosis;
- withdrawal-complication risk;
- current withdrawal severity;
- acute intoxication risk;
- Wernicke/nutrition risk;
- medication/substance-interaction risk;
- medical-vulnerability clearance;
- permission to stop, reduce or detox without assessment.

The existing Alcohol Safety / Withdrawal Safety decision is independent and authoritative for medical routing.

Precedence is one-way:

```text
Alcohol Safety disposition
        ↓ constrains
Pattern/Risk-driven product behavior
```

Never:

```text
Pattern/Risk output
        ↓ weakens or overrides
Alcohol Safety disposition
```

A low behavioral-risk assessment cannot downgrade `medical_assessment_advised`, `urgent_medical_assessment` or `emergency_response`.

## 3. Scope

#37 includes only:

- Zod/TypeScript data contracts for `AlcoholPatternInsight`;
- Zod/TypeScript data contracts for `AlcoholNearTermRiskAssessment`;
- a shared evidence/provenance envelope;
- enums and invariants required to keep association, confidence, missingness and medical-safety boundaries explicit;
- contract tests proving validation and boundary behavior;
- package exports.

#37 does **not** implement:

- pattern inference algorithms;
- statistical modeling;
- machine learning;
- AI-generated interpretation;
- risk scoring logic;
- automatic Rescue launch;
- automatic plan mutation;
- automatic notifications;
- automatic support contact;
- UI copy or dashboards;
- Safety Orchestrator changes;
- roadmap #38–#40.

## 4. Dependency direction

The contracts belong to the Alcohol Module.

Allowed:

- Alcohol Pattern/Risk contracts may import shared Core identifiers such as `EventId`.
- Later Alcohol application code may consume these derived contracts.
- Future Intelligence layers may read these contracts through explicit Alcohol adapters.

Forbidden:

- Core importing Alcohol Pattern/Risk schemas;
- Tobacco importing Alcohol Pattern/Risk schemas directly;
- Pattern/Risk contracts containing withdrawal-policy literals that duplicate `alcohol/safety.ts`;
- Pattern/Risk outputs mutating raw events, goals, plans or Safety decisions.

## 5. Shared evidence/provenance envelope

Both outputs use a shared provenance object so every derived statement can be traced to the facts and engine version that produced it.

Conceptual contract:

```ts
interface AlcoholDerivedEvidenceProvenance {
  engineId: string;
  ruleSetId: string;
  ruleSetVersion: number;
  windowStart: string;
  windowEnd: string;
  evidenceEventIds: EventId[];
  confidence: 'low' | 'medium' | 'high';
  missingness: 'none' | 'partial' | 'substantial';
  missingInputKeys: string[];
  computedAt: string;
}
```

### 5.1 Provenance invariants

- `engineId`, `ruleSetId` and `ruleSetVersion` are required and non-empty/positive.
- `windowStart`, `windowEnd` and `computedAt` are ISO datetimes.
- `windowStart <= windowEnd`.
- `evidenceEventIds` contains at least one event and no duplicates.
- `missingInputKeys` contains no duplicates.
- `missingness='none'` requires an empty `missingInputKeys` array.
- `missingness='partial' | 'substantial'` requires at least one `missingInputKeys` entry.
- `confidence` is an explicit contract field; it must never be inferred by consumers from absence of missingness alone.
- Source correction/retraction does not rewrite a stored historical derived object in place. A later engine run produces a new derived result from the then-effective canonical event view.

The exact persistence policy for derived outputs is deferred. The contract only guarantees traceability and reproducibility inputs.

## 6. `AlcoholPatternInsight`

A pattern insight represents an **association, concentration or trend** found in Alcohol module facts.

Conceptual contract:

```ts
interface AlcoholPatternInsight {
  schemaVersion: 1;
  moduleId: 'alcohol';
  insightId: string;
  insightType: AlcoholPatternInsightType;
  direction: AlcoholPatternDirection;
  strength: 'weak' | 'moderate' | 'strong';
  provenance: AlcoholDerivedEvidenceProvenance;
}
```

### 6.1 V1 insight types

The contract supports the V1 product-design pattern families:

```ts
type AlcoholPatternInsightType =
  | 'time_of_day_concentration'
  | 'day_of_week_concentration'
  | 'planned_vs_unplanned_trend'
  | 'plan_exceedance_pattern'
  | 'social_context_association'
  | 'first_drink_time_trend'
  | 'trigger_association'
  | 'alcohol_free_day_pattern'
  | 'rescue_outcome_association'
  | 'total_ethanol_trend';
```

### 6.2 Direction

V1 direction values are intentionally generic and non-causal:

```ts
type AlcoholPatternDirection =
  | 'increasing'
  | 'decreasing'
  | 'stable'
  | 'concentrated'
  | 'associated';
```

Each `insightType` may later restrict which direction values are meaningful through inference-engine logic, but #37 does not implement that logic.

### 6.3 Association, not causation

The contract must not encode unsupported causal semantics.

Allowed interpretation:

> Use was more frequent in records where the user reported stress.

Forbidden interpretation:

> Stress caused the user to drink.

For this reason the V1 contract does not include fields named `cause`, `causedBy`, `causalEffect`, `treatmentEffect` or equivalent.

`rescue_outcome_association` records association only; it must not claim an intervention caused a later outcome.

## 7. `AlcoholNearTermRiskAssessment`

A near-term risk assessment represents behavioral vulnerability over a bounded future horizon.

Conceptual contract:

```ts
interface AlcoholNearTermRiskAssessment {
  schemaVersion: 1;
  moduleId: 'alcohol';
  assessmentId: string;
  target: AlcoholNearTermRiskTarget;
  horizon: 'next_24_hours' | 'current_planning_day';
  riskBand: 'unknown' | 'baseline' | 'elevated' | 'high';
  contributingPatternIds: string[];
  provenance: AlcoholDerivedEvidenceProvenance;
}
```

### 7.1 V1 risk targets

```ts
type AlcoholNearTermRiskTarget =
  | 'unplanned_use'
  | 'plan_exceedance'
  | 'rescue_need';
```

These are product-behavior targets, not medical outcomes.

### 7.2 Risk-band semantics

- `unknown` — available evidence is insufficient for a meaningful behavioral-risk statement.
- `baseline` — no elevation was identified relative to the later engine's defined baseline policy.
- `elevated` — later engine logic identified increased behavioral vulnerability.
- `high` — later engine logic identified materially higher behavioral vulnerability requiring more prominent but still user-controlled support.

The contract does not define numeric probability thresholds. Any future quantitative model must be separately specified, versioned and validated before a probability field can be added.

`riskBand='unknown'` must never be interpreted as `baseline`.

### 7.3 Horizon boundary

V1 contracts support only short, bounded behavioral horizons:

- `next_24_hours`;
- `current_planning_day`.

The contract deliberately excludes long-range medical prognosis and long-range AUD/relapse prediction.

## 8. Contributing patterns and evidence

A risk assessment may reference zero or more `contributingPatternIds`.

- Zero pattern references are allowed because a future engine may derive risk directly from recent factual events.
- Pattern IDs must be unique when present.
- `contributingPatternIds` are explanatory references only; they do not replace the required provenance evidence event IDs.
- A risk assessment therefore remains auditable even if a referenced pattern insight is not locally materialized.

## 9. Missingness and confidence

Missingness is first-class.

Examples of inputs that may be missing in future inference include:

- no recent Alcohol events;
- unknown ABV, preventing reliable ethanol trend calculation;
- absent plan-relation context;
- absent social context;
- absent trigger tags;
- no daily check-in data;
- insufficient history for day/time concentration.

The contract does not require all such inputs to exist. It requires the producing engine to state missingness explicitly.

Important invariants:

- missing optional lifestyle/context data does not block factual logging;
- missingness may reduce confidence or produce `riskBand='unknown'`;
- missingness must never be filled with fabricated values;
- low confidence does not create permission to bypass Safety.

## 10. Medical-safety precedence contract

The Pattern/Risk contracts intentionally do not embed or duplicate `WithdrawalSafetyDecision`.

Application composition is responsible for evaluating Safety separately and applying the stricter product boundary.

Conceptually:

```ts
const safety = evaluateWithdrawalRisk(...);
const behavioralRisk = maybeReadNearTermRisk(...);

// safety decides what is medically permitted
// behavioralRisk may only personalize within that permitted surface
```

Examples:

- Safety=`behavior_change_support_allowed`, behavioral risk=`high` → app may offer stronger/earlier Rescue or planning support after explicit product logic exists.
- Safety=`medical_assessment_advised`, behavioral risk=`baseline` → medical assessment advice remains in force.
- Safety=`emergency_response`, any pattern/risk output → emergency surface wins; normal Pattern/Risk UX is suppressed.

No #37 contract field may encode a lower-priority override.

## 11. Determinism and versioning

#37 contracts are compatible with deterministic local engines and later validated statistical/ML engines, but every producer must identify itself and its rule/model version through provenance.

Contract requirements:

- same stored output remains interpretable after future engine upgrades;
- engine/model version changes do not rewrite source events;
- consumers must not compare outputs from different engine versions as though the semantics are guaranteed identical unless a later compatibility policy explicitly allows it;
- offline computation remains possible for future deterministic implementations;
- generative AI is not required to produce or validate these contracts.

## 12. Privacy/logging boundary

Pattern/Risk data is sensitive derived behavioral information.

Operational logs must not contain:

- full pattern payloads;
- behavioral risk payloads;
- raw evidence event lists;
- trigger/mood details;
- exact drinking histories;
- free-text narratives.

Allowed operational metadata may include constrained identifiers such as engine ID, rule-set version, insight/risk type and non-sensitive validation error class under the shared logging allowlist.

## 13. Error handling

Contract validation must reject:

- wrong `schemaVersion` or `moduleId`;
- invalid or inverted time windows;
- duplicate evidence event IDs;
- inconsistent missingness fields;
- duplicate contributing pattern IDs;
- empty engine/rule-set identifiers;
- non-positive rule-set versions;
- unsupported insight types, directions, risk targets, horizons or risk bands;
- malformed timestamps.

Validation failure must not mutate canonical source facts.

A malformed derived object is ignored/recomputed by later application logic; it must never be treated as a Safety decision.

## 14. Contract tests required by #37

Implementation must add RED→GREEN tests proving at least:

1. valid `AlcoholPatternInsight` parses;
2. valid `AlcoholNearTermRiskAssessment` parses;
3. both require `schemaVersion=1` and `moduleId='alcohol'`;
4. provenance requires non-empty engine/rule-set identity, positive version and valid timestamps;
5. inverted evidence windows fail;
6. duplicate `evidenceEventIds` fail;
7. `missingness='none'` with missing keys fails;
8. partial/substantial missingness without missing keys fails;
9. duplicate `contributingPatternIds` fail;
10. `riskBand='unknown'` is a valid explicit state;
11. no medical/withdrawal disposition field exists in the Pattern/Risk output contracts;
12. package exports expose the schemas and inferred TypeScript types.

Boundary tests should also demonstrate that existing `WithdrawalSafetyDecisionSchema` remains a separate contract with no import/dependency from Pattern/Risk into Safety.

## 15. Expected implementation files

The implementation plan should prefer a focused module such as:

```text
packages/contracts/src/alcohol/pattern-risk.ts
packages/contracts/test/alcohol-pattern-risk.test.ts
packages/contracts/src/index.ts
```

Exact file naming may be adjusted to existing repository conventions, but #37 should remain contract-only.

## 16. Acceptance criteria

Roadmap item #37 is complete only when:

- `AlcoholPatternInsight` and `AlcoholNearTermRiskAssessment` exist as separate validated contracts;
- both use the shared provenance envelope;
- provenance includes engine/rule-set/version, calculation window, evidence event IDs, confidence, missingness and computed time;
- pattern semantics are explicitly associative/non-causal;
- near-term risk is explicitly behavioral rather than medical;
- `unknown` is distinct from baseline/low-risk semantics;
- medical Safety/Withdrawal decisions remain separate and higher priority;
- no inference engine, UI, automation or #38–#40 behavior is implemented;
- contract tests and full repository verification pass;
- exact branch HEAD CI is `completed/success`.

## 17. Non-goals

This design does not:

- diagnose AUD;
- calculate withdrawal risk;
- alter `WithdrawalSafetyDecision`;
- authorize detox or abrupt cessation;
- produce taper or medication advice;
- compute pattern/risk outputs;
- choose interventions;
- launch Rescue automatically;
- change goals or plans;
- contact support;
- add server/AI dependencies;
- implement Alcohol vertical E2E (#38);
- implement Tobacco + Alcohol coexistence (#39);
- implement Intelligence Engines (#40);
- merge to `main`;
- touch production infrastructure.
