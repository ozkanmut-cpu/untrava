# UNTRAVA Alcohol Withdrawal Risk Engine — Design Specification

**Date:** 2026-09-16  
**Status:** Approved design direction; implementation not started  
**Branch:** `rescue-interventions`  
**Parent Alcohol spec:** `docs/superpowers/specs/2026-09-16-untrava-alcohol-module-design.md`  
**Core boundary spec:** `docs/superpowers/specs/2026-09-16-untrava-behavior-change-core-boundaries.md`  
**Roadmap item:** #33 — Alcohol-specific Safety Engine for dangerous withdrawal risk, separate from Core Rescue.

## 1. Decision

UNTRAVA Alcohol V1 will implement withdrawal-risk safety as a **versioned deterministic evidence + policy engine**, not as a single boolean rule, a drink-count threshold, a PAWSS-derived consumer clearance score, or an AI judgment.

The engine answers one bounded question:

> Given the structured withdrawal-risk evidence currently available and the user's intended degree of alcohol change, what product routing is permitted now?

It does **not** diagnose alcohol withdrawal, alcohol dependence, or AUD. It does **not** prescribe treatment. It does **not** determine medication doses. It does **not** generate an alcohol taper. It does **not** declare a user medically cleared for home detox.

The engine is independent of the generic Rescue state machine. Rescue may consume its routing result but may never override it.

## 2. Why this architecture

Three approaches were considered.

### 2.1 Rejected: single boolean risk flag

A `risk: true | false` model is too coarse. It cannot preserve which evidence was present, which evidence was missing, which policy version was applied, or why the decision was made.

### 2.2 Rejected: score-first / PAWSS-like consumer permission model

A score can be clinically useful in the population and setting in which it was validated, but a direct-to-consumer app must not reinterpret a low score as permission for unsupported detox. UNTRAVA therefore will not implement rules such as:

```text
PAWSS < threshold → safe to stop at home
```

PAWSS concepts may inform evidence categories or later validated workflows, but no score is the sole authority for self-guided withdrawal safety.

### 2.3 Chosen: structured evidence + versioned deterministic policy

The chosen design stores risk-relevant facts explicitly and evaluates them through a versioned pure policy function. This provides:

- auditable reason codes;
- explicit unknown/missing states;
- deterministic offline behavior;
- reproducibility;
- policy versioning;
- separation between evidence collection and medical routing;
- no dependence on AI, network access, doctor communication, breathalyzer hardware or BAC estimation.

## 3. Clinical design basis

This architecture is informed by major alcohol-withdrawal guidance rather than by product marketing logic.

The ASAM Clinical Practice Guideline on Alcohol Withdrawal Management identifies important risk factors for complicated withdrawal including prior withdrawal seizure or delirium, repeated withdrawal episodes, prolonged heavy regular alcohol use, seizure during the current episode, marked autonomic hyperactivity, and physiological dependence on GABAergic agents such as benzodiazepines or barbiturates. It also notes that multiple risk factors compound concern.

The UK Clinical Guidelines for Alcohol Treatment, published in 2025 and updated in 2026, distinguish community medically assisted withdrawal from higher-acuity care and identify severe withdrawal complications such as seizures, delirium tremens and Wernicke's encephalopathy. High-risk decisions are based on individual clinical assessment rather than a single consumption threshold.

This specification converts those safety principles into a conservative **routing boundary** only. It does not attempt to reproduce clinical detox management.

Primary references:

- American Society of Addiction Medicine, *The ASAM Clinical Practice Guideline on Alcohol Withdrawal Management*.
- UK Department of Health and Social Care, *Clinical guidelines for alcohol treatment — Community based medically assisted withdrawal*, updated 17 April 2026.
- UK Department of Health and Social Care, *Clinical guidelines for alcohol treatment — Pharmacological interventions*, updated 17 April 2026.
- NICE CG100, *Alcohol-use disorders: diagnosis and management of physical complications*.

## 4. Scope

Roadmap item #33 implements only the first Alcohol medical-safety gate:

```text
Alcohol Safety Orchestrator
└── WithdrawalRiskGate   ← #33
```

The following remain separate gates or later work:

- acute intoxication / overdose;
- active withdrawal symptom monitoring beyond the minimal emergency signals needed by this gate;
- Wernicke/nutrition risk;
- medication/substance interaction policy;
- pregnancy and other medical-vulnerability policy;
- Alcohol Rescue content;
- Recovery;
- Pattern/Risk Intelligence.

A later orchestrator may evaluate all gates together. #33 must not expand into that full orchestrator implementation.

## 5. Dependency direction

The dependency direction remains:

```text
Application Composition
        ↓
Alcohol Module
        ↓
Behavior Change Core
```

The withdrawal-risk implementation belongs to the Alcohol Module.

Allowed:

- Alcohol safety contracts → import Core identifiers/types where useful;
- Alcohol mobile/application code → evaluate Alcohol withdrawal policy;
- application composition → pass the decision into Alcohol goal/Rescue UX.

Forbidden:

- Core importing Alcohol safety schemas;
- generic Rescue containing Alcohol withdrawal literals or thresholds;
- Tobacco importing Alcohol safety schemas;
- AI generating or modifying a withdrawal disposition;
- remote/server availability being required for the core safety decision.

## 6. Evidence model

Risk-relevant evidence must distinguish **present**, **absent** and **unknown**. Plain booleans are not sufficient because `false` and `not assessed` have different safety meanings.

Conceptual primitive:

```ts
type EvidenceState = 'present' | 'absent' | 'unknown';
```

Each structured fact may also preserve source/provenance where available.

Conceptual evidence item:

```ts
interface WithdrawalEvidenceItem {
  state: 'present' | 'absent' | 'unknown';
  source: 'self_report' | 'recorded_history' | 'derived_local';
  observedAt?: string;
  evidenceEventIds?: string[];
}
```

Exact implementation may use typed object fields rather than an array, but semantic tri-state behavior is required.

## 7. Change intent

Safety routing depends partly on what the app is about to encourage.

```ts
type AlcoholChangeIntent =
  | 'observe'
  | 'reduce'
  | 'abstain'
  | 'unknown';
```

`observe` means the user is logging/understanding use without an app-guided cessation or substantial-reduction action.

`reduce` and `abstain` can expose withdrawal risk and therefore require adequate evidence before the app encourages a major change.

`unknown` must not be silently interpreted as low risk. For permissioning purposes V1 treats `unknown` conservatively like a change intent: it cannot unlock app-guided major reduction/abstinence when critical evidence is missing.

## 8. Withdrawal-risk evidence domains

V1 evidence is grouped for clarity. Exact question wording is a later UX concern; the engine consumes normalized facts.

### 8.1 Prior severe withdrawal history

Structured evidence includes:

- `previousWithdrawalSeizure`;
- `previousWithdrawalDelirium`;
- `previousSevereWithdrawal`;
- `repeatedWithdrawalEpisodes`;
- `priorMedicallyAssistedWithdrawalComplication`.

A prior seizure or withdrawal delirium is never neutralized by a low current drink count or a favorable AI interpretation.

### 8.2 Current withdrawal / complication indicators

The withdrawal-risk gate may consume a limited set of current safety indicators necessary to prevent ordinary behavior-change UX from continuing through an emergency:

- `currentSeizure`;
- `severeConfusionOrDisorientation`;
- `withdrawalSymptomsAfterReduction`;
- `markedAutonomicSymptoms`;
- `significantPerceptualDisturbance`.

Detailed symptom trajectories belong to the later `ActiveWithdrawalMonitor`; #33 uses these only for routing precedence.

### 8.3 Dependence-pattern evidence

Structured evidence may include:

- `longDurationHeavyRegularUse`;
- `morningDrinkingOrReliefDrinking`;
- `priorWithdrawalSymptomsWhenCuttingDownOrStopping`.

The contract intentionally does not define one universal alcohol-quantity threshold as proof of safe or unsafe withdrawal. Quantitative drinking history can contribute to the evidence builder, but the routing policy is not reducible to drink count.

### 8.4 Co-risk evidence directly relevant to withdrawal

Structured evidence includes:

- `sedativeHypnoticPhysiologicalDependence`;
- `epilepsy`;
- `significantUnstableMedicalIllness`;
- `significantActivePsychiatricIllnessOrCognitiveImpairment`.

Broad interaction details, pregnancy policy and Wernicke-risk logic remain owned by their dedicated future gates. They are not duplicated here.

## 9. Evidence completeness

Completeness is **computed**, not trusted as a caller-supplied boolean.

The V1 policy defines the following critical evidence keys for `reduce`, `abstain` and permission-sensitive `unknown` intent:

- `currentSeizure`;
- `severeConfusionOrDisorientation`;
- `withdrawalSymptomsAfterReduction`;
- `previousWithdrawalSeizure`;
- `previousWithdrawalDelirium`;
- `longDurationHeavyRegularUse`;
- `morningDrinkingOrReliefDrinking`;
- `priorWithdrawalSymptomsWhenCuttingDownOrStopping`;
- `sedativeHypnoticPhysiologicalDependence`;
- `epilepsy`;
- `significantUnstableMedicalIllness`;
- `significantActivePsychiatricIllnessOrCognitiveImpairment`.

Conceptual behavior:

```text
observe
→ incomplete withdrawal assessment may still allow logging/observation

reduce / abstain / permission-sensitive unknown intent
→ any required safety evidence unknown
→ fail safe; do not provide app-guided major reduction/abstinence instructions
```

Missing information does not create a diagnosis. It creates a routing constraint.

The policy result must include missing/unknown critical evidence reason codes where those unknowns affected the result.

## 10. Policy engine

The policy engine is a pure deterministic function over validated evidence plus a pinned policy version.

Conceptually:

```ts
evaluateWithdrawalRisk(
  evidence: WithdrawalRiskEvidence,
  policy: WithdrawalRiskPolicy,
  decidedAt: string,
): WithdrawalSafetyDecision
```

Properties:

- no network access;
- no generative AI;
- no hidden server state;
- no mutation of goals or events;
- same normalized input + same policy version → same disposition/reason codes, excluding the caller-supplied timestamp;
- policy version is explicit and auditable.

## 11. Routing dispositions

#33 uses four product-routing dispositions:

```ts
type WithdrawalSafetyDisposition =
  | 'behavior_change_support_allowed'
  | 'medical_assessment_advised'
  | 'urgent_medical_assessment'
  | 'emergency_response';
```

### 11.1 `behavior_change_support_allowed`

Meaning:

> On the currently available structured evidence, this withdrawal-risk gate has not found a reason to block ordinary behavior-change support.

It explicitly does **not** mean:

- medically cleared;
- safe to detox at home;
- no withdrawal risk exists;
- no clinical assessment could be appropriate.

### 11.2 `medical_assessment_advised`

Used when the app should not encourage self-guided major reduction/abstinence before medical assessment, including when significant historical risk factors or critical missing evidence make unsupported change inappropriate.

This is care routing only. UNTRAVA V1 has no doctor messaging, telemedicine or clinician integration.

### 11.3 `urgent_medical_assessment`

Used for concerning active findings that should interrupt ordinary reduction/abstinence guidance and direct the user toward urgent medical evaluation.

### 11.4 `emergency_response`

Used for emergency-level evidence such as a current seizure or severe confusion/disorientation consistent with a potentially serious withdrawal complication.

Emergency routing outranks all ordinary product flows.

## 12. Precedence

The policy has deterministic precedence.

Conceptually:

```text
1. emergency evidence
      ↓
   emergency_response

2. serious active-withdrawal concern
      ↓
   urgent_medical_assessment

3. major historical/co-risk concern
   OR critical unknown evidence for reduce/abstain
      ↓
   medical_assessment_advised

4. otherwise
      ↓
   behavior_change_support_allowed
```

Lower-severity evidence can never downgrade a higher-severity disposition.

A favorable consumption pattern, current calmness or AI-generated reassurance cannot cancel a prior withdrawal seizure, withdrawal delirium or other policy-defined blocking evidence.

### 12.1 Frozen V1 policy table

The initial rule set is intentionally conservative and explicit.

**Emergency — any one present:**

- `currentSeizure`;
- `severeConfusionOrDisorientation`.

Result: `emergency_response` for every change intent, including `observe`.

**Urgent — any one present, unless Emergency already matched:**

- `markedAutonomicSymptoms`;
- `significantPerceptualDisturbance`.

Result: `urgent_medical_assessment` for every change intent, including `observe`.

**Medical assessment before app-guided major reduction/abstinence — any one present, unless a higher precedence matched:**

- `withdrawalSymptomsAfterReduction`;
- `previousWithdrawalSeizure`;
- `previousWithdrawalDelirium`;
- `previousSevereWithdrawal`;
- `repeatedWithdrawalEpisodes`;
- `priorMedicallyAssistedWithdrawalComplication`;
- `longDurationHeavyRegularUse`;
- `morningDrinkingOrReliefDrinking`;
- `priorWithdrawalSymptomsWhenCuttingDownOrStopping`;
- `sedativeHypnoticPhysiologicalDependence`;
- `epilepsy`;
- `significantUnstableMedicalIllness`;
- `significantActivePsychiatricIllnessOrCognitiveImpairment`.

For `reduce`, `abstain`, or permission-sensitive `unknown` intent, result: `medical_assessment_advised`.

For `observe`, these historical/co-risk items do not block factual logging or observation. They are preserved as evidence and must be re-evaluated if the user later enters a reduction/abstinence action. This preserves progressive, non-medicalized onboarding without weakening safety at the point where withdrawal risk becomes actionable.

**Critical missing data:**

For `reduce`, `abstain`, or permission-sensitive `unknown` intent, if any critical evidence key listed in section 9 remains `unknown` after the required assessment opportunity, result: `medical_assessment_advised` with `insufficient.required_evidence_unknown` and the exact missing keys.

For `observe`, missing historical risk evidence does not by itself block logging. Emergency/urgent current-symptom evidence is still evaluated whenever supplied.

**Allow ordinary behavior-change support:**

Only when no higher-precedence rule matches and the applicable critical evidence is complete enough for the requested change intent does the engine return `behavior_change_support_allowed`.

This disposition remains a product-permission result, never a medical clearance statement.

## 13. Reason codes

Every non-trivial decision must be explainable through stable machine-readable reason codes.

Initial conceptual families:

```text
emergency.current_seizure
emergency.severe_confusion
urgent.marked_autonomic_symptoms
urgent.significant_perceptual_disturbance
history.previous_withdrawal_seizure
history.previous_withdrawal_delirium
history.repeated_withdrawal
history.previous_severe_withdrawal
history.prior_assisted_withdrawal_complication
risk.withdrawal_symptoms_after_reduction
risk.sedative_hypnotic_dependence
risk.epilepsy
risk.unstable_medical_illness
risk.active_psychiatric_or_cognitive_concern
risk.heavy_regular_use_pattern
risk.morning_or_relief_drinking
risk.prior_symptoms_on_reduction
insufficient.required_evidence_unknown
```

Exact codes will be frozen in implementation tests. User-facing localized wording is separate from machine reason codes.

## 14. Decision contract

Conceptual output:

```ts
interface WithdrawalSafetyDecision {
  engineId: 'alcohol_withdrawal_risk';
  ruleSetId: string;
  ruleSetVersion: number;
  disposition: WithdrawalSafetyDisposition;
  reasonCodes: string[];
  evaluatedEvidenceKeys: string[];
  unknownCriticalEvidenceKeys: string[];
  decidedAt: string;
}
```

The final Zod contract may refine names, but must preserve:

- engine identity;
- rule-set identity/version;
- routing disposition;
- deterministic reason codes;
- evaluated evidence trace;
- critical missing-data trace;
- decision timestamp.

No free-form AI rationale is part of the authoritative decision.

## 15. Persistence and auditability

A safety decision is derived from evidence and policy, but when a decision materially gates a user action, the app should be able to record an immutable factual audit reference containing at minimum:

- decision identity or equivalent event reference;
- policy/rule-set version;
- disposition;
- reason codes;
- evidence references where available;
- decision time.

Historical evidence and prior decisions are not rewritten when a new policy version is installed. A future UI may recompute a current recommendation under a newer policy, but that does not change which policy produced the historical decision.

The exact event-persistence integration may be implemented alongside or immediately after the engine as the plan determines, but the engine contract must support it from day one.

## 16. Offline and failure behavior

The installed withdrawal policy required for fundamental routing is bundled/versioned and works offline.

If the policy bundle is missing, invalid or fails integrity validation:

- the app must not silently fall back to permissive self-guided abstinence/reduction guidance;
- `reduce`/`abstain` flows fail closed to an appropriate assessment-routing surface;
- observation/logging may remain available when it does not create a risky cessation instruction;
- emergency static routing content must remain available where technically possible.

No server or AI outage may convert a restricted disposition into `behavior_change_support_allowed`.

## 17. Rescue boundary

Withdrawal Safety is evaluated **before** Alcohol Rescue or goal guidance attempts to recommend a behavior that may conflict with the safety decision.

Conceptual relationship:

```text
Alcohol change action / craving context
        ↓
WithdrawalRiskGate
        ↓
allowed product surface
        ↓
Alcohol Rescue / Goal UX
```

Rules:

1. Rescue cannot change the withdrawal disposition.
2. Rescue cannot suppress reason codes.
3. Rescue cannot generate taper schedules.
4. Rescue cannot recommend prescription medication start/stop/dose changes.
5. Safe low-burden coping support may remain available when it does not delay emergency/urgent action or contradict the safety routing.
6. Emergency routing interrupts ordinary Rescue flow.
7. Generic Core Rescue remains free of Alcohol withdrawal semantics.

## 18. AI boundary

AI may later:

- localize or simplify already-determined explanatory text;
- summarize factual history for the user;
- suggest non-medical reflection prompts after deterministic routing is complete.

AI may not:

- change evidence states;
- infer an absent risk factor from missing data;
- lower a safety disposition;
- override a reason code;
- declare home detox safe;
- generate taper instructions;
- calculate medication doses;
- choose whether medical assessment is necessary.

Removing AI entirely must not reduce the correctness of #33.

## 19. Privacy and logging

Operational logs must not contain full withdrawal assessments or sensitive raw health payloads.

Permitted operational metadata should be minimal, for example:

- engine/rule-set version;
- success/failure of evaluation;
- coarse disposition when operationally necessary and privacy-reviewed;
- non-sensitive error category.

Raw answers, psychiatric details, substance-use history and medical-history fields stay in the protected domain data/event layer rather than ordinary logs.

## 20. Implementation boundaries

The implementation plan should target focused files such as:

```text
packages/contracts/src/alcohol/safety.ts
packages/contracts/test/alcohol-safety.test.ts
apps/mobile/src/alcohol/safety/withdrawal-risk.ts
apps/mobile/test/alcohol-withdrawal-risk.test.ts
```

Exact paths may follow existing repository conventions discovered during planning.

The implementation must not require changes to Tobacco behavior or Core domain enums.

## 21. Test strategy

Implementation must use RED → GREEN TDD.

Required test groups:

### 21.1 Contract tests

- valid evidence contract;
- tri-state evidence values;
- valid versioned decision contract;
- valid dispositions;
- rejection of invalid/missing policy identity;
- Alcohol module ownership without Core Alcohol literals.

### 21.2 Emergency precedence

- current seizure → `emergency_response`;
- severe confusion/disorientation → `emergency_response`;
- emergency evidence cannot be downgraded by otherwise reassuring evidence.

### 21.3 Urgent routing

- marked autonomic symptoms → `urgent_medical_assessment`;
- significant perceptual disturbance → `urgent_medical_assessment`;
- urgent routing outranks historical-only assessment routing.

### 21.4 Historical/high-risk routing

- previous withdrawal seizure → `medical_assessment_advised` for reduction/abstinence;
- previous withdrawal delirium → `medical_assessment_advised` for reduction/abstinence;
- each V1 blocking evidence key is covered by a direct routing test;
- sedative-hypnotic physiological dependence cannot be overridden by low alcohol quantity;
- the same historical evidence does not prevent `observe` logging in the absence of current urgent/emergency signals.

### 21.5 Missing-data fail-safe

- any critical unknown + `abstain` → no ordinary app-guided abstinence permission;
- any critical unknown + `reduce` → no ordinary app-guided major-reduction permission;
- incomplete evidence + `observe` can retain safe observation/logging behavior;
- `unknown` intent cannot unlock change guidance with missing critical evidence;
- exact missing keys are included in `unknownCriticalEvidenceKeys`.

### 21.6 Determinism/versioning

- same evidence + same rule-set version → same disposition/reason codes;
- reason-code ordering is deterministic;
- changing policy version does not mutate historical decision objects;
- no network/AI dependency in engine tests.

### 21.7 Boundary tests

- Core source contains no Alcohol safety imports/literals;
- generic Rescue does not import withdrawal-risk policy;
- Tobacco does not import Alcohol safety contracts;
- Alcohol safety decision can gate an Alcohol flow without changing Core.

## 22. Acceptance criteria

Roadmap item #33 is complete only when all of the following are true:

1. Withdrawal risk is implemented as an Alcohol-owned deterministic safety gate separate from Rescue.
2. Evidence distinguishes present/absent/unknown.
3. The gate is versioned and auditable.
4. Current seizure and severe confusion/disorientation have explicit emergency precedence.
5. Marked autonomic symptoms and significant perceptual disturbance have explicit urgent precedence in V1.
6. Each frozen V1 blocking evidence item routes reduction/abstinence to `medical_assessment_advised` unless a higher-precedence rule matched.
7. Critical missing evidence fails safe for reduction/abstinence and permission-sensitive unknown intent.
8. Observation/logging is not unnecessarily blocked by historical/missing withdrawal-risk evidence in the absence of current urgent/emergency signals.
9. No alcohol quantity threshold by itself provides detox clearance.
10. PAWSS is not used as sole consumer detox permission.
11. CIWA-Ar is not used as a pre-cessation clearance mechanism.
12. No taper is generated.
13. No medication start/stop/dose advice is generated.
14. AI cannot influence the authoritative safety decision.
15. Core and Tobacco remain domain-isolated.
16. Fundamental routing works offline.
17. Operational logs do not contain full sensitive assessment payloads.
18. RED → GREEN tests cover precedence, missingness, determinism and boundaries.
19. Exact branch HEAD has real CI `completed/success` before #33 is declared implemented.

## 23. Deferred work

This spec deliberately leaves the following to later roadmap work:

- #34 explicit implementation/tests for the no-taper/no-medication-authority invariant across the Alcohol module;
- AcuteIntoxicationGate implementation;
- ActiveWithdrawalMonitor implementation beyond minimal emergency-routing evidence;
- WernickeNutritionGate;
- InteractionGate;
- MedicalVulnerabilityGate;
- Alcohol Rescue Library (#35);
- Alcohol Recovery (#36);
- Pattern/Risk Engine (#37);
- Alcohol offline vertical E2E (#38);
- Tobacco + Alcohol shared-Core coexistence test (#39).

## 24. Non-goals

#33 does not:

- diagnose AUD;
- diagnose physical dependence;
- diagnose alcohol withdrawal syndrome;
- calculate safe drinking limits;
- determine inpatient vs outpatient detox treatment plans;
- prescribe benzodiazepines or any other medication;
- prescribe thiamine;
- generate alcohol taper schedules;
- communicate with a doctor;
- use a breathalyzer;
- estimate BAC as a safety authority;
- implement full Alcohol Rescue or Recovery;
- modify `main`;
- touch production infrastructure.

## 25. Final invariant

The fundamental safety invariant is:

> **UNTRAVA may help a user change alcohol behavior only within the product surface allowed by deterministic, versioned Alcohol safety policy. Missing information, AI output, low reported quantity, or a behavioral goal can never be used to bypass a known withdrawal-safety concern.**
