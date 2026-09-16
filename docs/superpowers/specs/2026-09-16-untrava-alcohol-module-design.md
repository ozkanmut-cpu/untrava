# UNTRAVA Alcohol Module — V1 Product & Safety Design Specification

**Date:** 2026-09-16  
**Status:** Approved V1 product and safety direction  
**Branch:** `rescue-interventions`  
**Parent architecture:** `docs/superpowers/specs/2026-09-16-untrava-core-generalization-design.md`  
**Core boundary spec:** `docs/superpowers/specs/2026-09-16-untrava-behavior-change-core-boundaries.md`  
**Scope:** Define the Alcohol Module V1 as a self-guided, safety-aware alcohol-change system with abstinence and reduction paths, without doctor communication, clinician-plan integration, breathalyzer hardware or BAC verification.

## 1. Product decision

UNTRAVA Alcohol V1 will be an **adaptive dual-path behavior-change system** rather than a sobriety-only app.

A user may:

- observe drinking before committing to change;
- reduce drinking;
- create alcohol-free days;
- use explicit amount/time rules;
- choose abstinence;
- move between goals only through explicit goal changes.

All paths share the same deterministic Alcohol Safety Orchestrator.

The product position is:

> **A safety-aware personal alcohol change system.**

The V1 principles are:

- **Safety without medicalizing every interaction.**
- **Progress without shame.**
- **Personalization without giving AI clinical authority.**
- **Useful before, during and after a drinking decision.**
- **No dependency on doctor communication or breathalyzer hardware.**

## 2. V1 architecture

```text
UNTRAVA Core
│
└── Alcohol Module
    ├── Observe / Baseline
    ├── Alcohol Goals
    │   ├── abstinence
    │   ├── reduction
    │   ├── alcohol-free days
    │   └── usage limits / planning rules
    ├── Weekly Planner
    ├── Alcohol Use Events + Measurement
    ├── Alcohol Safety Orchestrator
    │   ├── AcuteIntoxicationGate
    │   ├── WithdrawalRiskGate
    │   ├── ActiveWithdrawalMonitor
    │   ├── WernickeNutritionGate
    │   ├── InteractionGate
    │   └── MedicalVulnerabilityGate
    ├── Alcohol Rescue Library
    ├── Alcohol Recovery
    ├── Pattern Engine
    ├── Progress / Reporting
    ├── Micro Learning
    └── AI Personalization
```

The shared Core continues to own identity, consent, immutable event-envelope mechanics, local-first storage, sync/idempotence, goal lifecycle, Rescue state-machine mechanics, Recovery invariants, support boundaries, privacy/logging defaults and future Intelligence interfaces.

Core does not know what beer, spirits, ethanol grams, abstinence, alcohol-free days, withdrawal, standard drinks or alcohol intoxication mean.

## 3. Explicit V1 exclusions

The following are deliberately **not** part of Alcohol V1:

- doctor messaging;
- telemedicine;
- clinician dashboard;
- clinician-plan ingestion/synchronization;
- prescription or medication-plan import;
- automatic appointment booking;
- health-professional data sharing as part of normal Alcohol flows;
- Bluetooth breathalyzer;
- camera/device-based sobriety verification;
- BAC measurement as truth;
- BAC prediction as a safety authority;
- biomarker-based sobriety proof;
- contingency rewards that require alcohol verification hardware.

These exclusions are architectural: V1 must not depend on these features to work safely.

The app may still tell the user that medical assessment is advisable or urgent. That is **care routing**, not doctor integration.

## 4. Core product loop

The primary behavior loop is:

```text
Observe
   ↓
Plan
   ↓
Live / Drink / Don't Drink
   ↓
Rescue when needed
   ↓
Log facts
   ↓
Reflect / Recovery
   ↓
Learn
   ↓
Improve next plan
```

The loop must support both abstinence and moderation/reduction goals.

A drinking event does not erase previous progress and does not automatically label the user as relapsed or failed.

## 5. Onboarding and progressive assessment

The first product question is behavior-focused rather than diagnostic:

> “Alkolle ilişkin konusunda neyi değiştirmek istiyorsun?”

Initial choices:

- `observe_only` — önce düzenimi anlamak istiyorum;
- `reduction`;
- `alcohol_free_days`;
- `abstinence`;
- `not_sure`.

The app does not require the user to identify as “alcoholic” or accept an AUD diagnosis to begin.

### 5.1 Baseline

V1 should establish a lightweight recent baseline, preferably covering roughly the prior 7–14 days where the user can recall it:

- drinking days;
- approximate beverage and quantity;
- usual first-drink time;
- common context such as alone/social;
- common planned vs spontaneous use where known.

Perfect recall is not required. Missingness and estimation are explicit rather than fabricated.

### 5.2 Progressive safety questions

Medical safety assessment expands only when relevant signals appear.

Example:

```text
daily or near-daily use
        ↓
morning drinking / withdrawal-like symptoms / previous difficult stopping
        ↓
expanded WithdrawalRisk assessment
```

This preserves a lightweight onboarding experience for lower-risk users without weakening safety for higher-risk users.

## 6. Alcohol Safety Orchestrator

Alcohol safety is **not** one score and is **not** embedded inside Rescue. It is a separate deterministic orchestration layer composed of independent gates.

Conceptual flow:

```text
alcohol use / change intent / symptom report
        ↓
Alcohol Safety Orchestrator
        ↓
self-guided behavior support allowed
   OR medical assessment advised
   OR urgent medical assessment
   OR emergency response
        ↓
allowed product surface
```

Conceptual output:

```ts
interface AlcoholSafetyDecision {
  ruleSetVersion: string;
  disposition:
    | 'self_guided_behavior_support_allowed'
    | 'medical_assessment_advised'
    | 'urgent_medical_assessment'
    | 'emergency_response';
  triggeredGateIds: string[];
  evidenceFactIds: string[];
  decidedAt: string;
}
```

The exact TypeScript shape is deferred to the safety implementation task. The invariant is that Safety produces **routing**, never diagnosis, medication or taper instructions.

### 6.1 Medical-safety invariants

1. **No autonomous detox authority.** UNTRAVA does not declare a physiologically dependent person safe to detox without clinical assessment.
2. **No autonomous taper plan.** UNTRAVA never invents a schedule such as “drink X today, Y tomorrow”.
3. **No medication dosing.** UNTRAVA never starts, stops, changes or calculates doses for withdrawal medication, relapse-prevention medication, thiamine or any other medication.
4. **No AI safety authority.** Generative AI cannot override deterministic safety gates.
5. **No single-score shortcut.** AUD screening, physical-dependence risk, complicated-withdrawal risk, current withdrawal severity and acute intoxication are separate concepts.
6. **Emergency conditions override behavior-change flows.** Suspected overdose, seizure, severe confusion, inability to wake or serious breathing abnormality interrupt normal Rescue/goal UX.
7. **Withdrawal risk is evaluated before the app encourages abrupt abstinence or major reduction.**
8. **History matters.** Prior withdrawal seizure, delirium tremens and repeated withdrawal episodes materially affect routing.
9. **Pregnancy with suspected dependence requires medical/specialist assessment rather than autonomous abrupt-cessation advice.**
10. **Wernicke/nutrition risk is separate from withdrawal severity.**
11. **Alcohol plus other CNS depressants is a separate safety concern.**
12. **Safety rules are versioned and auditable.**
13. **Essential blocking safety works offline.**
14. **Risky actions fail closed when required safety information or a validated local rule set is unavailable.**

### 6.2 AcuteIntoxicationGate

Purpose: interrupt ordinary product UX when acute alcohol poisoning or another emergency may be present.

Potential validated signals include:

- inability to remain conscious or inability to wake;
- seizure;
- serious breathing difficulty, markedly slow breathing or long pauses;
- severe confusion/stupor;
- repeated vomiting with impaired consciousness;
- severe hypothermia-like signs, cyanosis/pallor or loss of protective responses.

The gate must not estimate safety from drink count alone and must not wait for Rescue completion.

### 6.3 WithdrawalRiskGate

Purpose: determine whether stopping or substantially reducing alcohol should trigger medical assessment rather than ordinary self-guided abstinence/reduction guidance.

Structured risk evidence may include:

- previous alcohol-withdrawal seizure;
- previous delirium tremens or severe withdrawal hallucinosis;
- repeated previous withdrawal episodes;
- prolonged/heavy regular use pattern;
- current withdrawal-like signs after reduction;
- concurrent physiological dependence on benzodiazepines, barbiturates or relevant sedative-hypnotics;
- epilepsy;
- significant unstable medical illness;
- significant active psychiatric illness or cognitive impairment;
- age/vulnerability factors covered by the installed clinical policy;
- prior medically assisted withdrawal and complications.

No quantity threshold by itself authorizes home withdrawal.

### 6.4 PAWSS policy

PAWSS may inform the structured risk-factor model because it has validation for predicting complicated withdrawal in medically ill inpatient populations.

UNTRAVA must not turn PAWSS into a consumer permission rule such as:

```text
PAWSS < 4 → safe to detox at home
```

Risk factors can be represented as evidence with provenance, but routing remains a broader versioned policy.

### 6.5 ActiveWithdrawalMonitor

Purpose: allow structured symptom tracking when a user has already reduced/stopped alcohol or reports possible withdrawal symptoms.

It is not a diagnostic engine and does not prescribe treatment.

Potential symptom fields include:

- tremor;
- sweating;
- nausea/vomiting;
- agitation/anxiety;
- sleep disturbance;
- perceptual disturbance;
- confusion/disorientation;
- seizure.

Serious complications route to urgent/emergency assessment.

### 6.6 CIWA-Ar / SAWS policy

CIWA-Ar is a withdrawal-severity tool, not a general pre-cessation predictor for asymptomatic users.

Therefore:

- CIWA-Ar must not be the sole pre-cessation risk gate;
- self-scoring must not become an autonomous treatment or medication algorithm;
- future SAWS-style self-monitoring is symptom monitoring only;
- no symptom score can calculate medication doses.

### 6.7 WernickeNutritionGate

Purpose: identify malnutrition/thiamine-deficiency/Wernicke-risk situations needing medical routing.

Potential risk evidence includes:

- long-term harmful/dependent alcohol use;
- malnutrition or substantial recent weight loss;
- low body-mass/nutritional concern;
- persistent vomiting;
- decompensated liver disease or other high-risk medical context;
- peripheral neuropathy/cognitive concerns.

Potential urgent neurologic signals include new confusion, ataxia/unsteadiness and abnormal eye-movement/ophthalmologic signs.

UNTRAVA may route risk but must not calculate thiamine route or dose.

### 6.8 InteractionGate

Purpose: identify alcohol + substance/medication combinations that materially increase acute risk.

High-priority categories include:

- opioids;
- benzodiazepines;
- other sedative-hypnotics/CNS depressants;
- other medication categories represented in a versioned interaction policy.

The app may warn or escalate, but it must not tell the user how to alter a prescribed medication.

### 6.9 MedicalVulnerabilityGate

Purpose: lower the threshold for medical assessment where ordinary self-guided change needs additional context.

Examples include:

- pregnancy;
- epilepsy;
- significant liver disease;
- unstable cardiac disease;
- severe active psychiatric illness;
- major cognitive impairment;
- serious concurrent illness.

This gate routes; it does not diagnose.

## 7. Goal system

Alcohol goals are module-owned and use the Core Goal lifecycle.

Initial V1 goal families:

- `observe_only`;
- `abstinence`;
- `reduction`;
- `alcohol_free_days`;
- `usage_limit`.

Core stores `goalId`, `moduleId`, lifecycle and immutable history. Alcohol Module owns goal semantics and configuration.

Safety is orthogonal to user preference. A user may choose abstinence while Safety advises medical assessment before abrupt cessation.

The app does not silently change that goal.

### 7.1 Primary Goal + planning rules

A goal may have explicit planning rules without becoming a new global goal type.

Example:

```text
Primary goal: reduction
Rules:
- Mon–Thu alcohol-free
- Friday limit X
- Saturday limit Y
- no drinking before a selected time
- no unplanned drinking
```

Another user may choose:

```text
Primary goal: abstinence
Start date: explicit date
Preferred action when craving: Rescue first
```

Exact goal-config contracts are defined in roadmap item #31.

## 8. Weekly Planner

V1 includes a first-class weekly planning surface.

Each day can contain an explicit intent such as:

- alcohol-free;
- planned drinking with a user-defined limit;
- observation/no committed limit;
- a time-based rule where supported by the selected goal.

Plans are user-authored. AI may suggest reflection prompts or proposed adjustments, but it cannot change the plan without explicit confirmation.

Historical plans are retained so outcomes can be compared against what the user actually intended at the time.

## 9. Alcohol use-event model and measurement

Detailed contracts are defined in roadmap item #32, but the architecture fixes the canonical facts.

A use event should be able to represent:

- beverage/category;
- volume;
- ABV when known;
- calculated pure ethanol amount;
- event time;
- social/environment context;
- planned vs unplanned status;
- trigger/mood context when voluntarily supplied;
- source/provenance;
- confidence for estimated quantities.

### 9.1 Fast logging

Logging must remain low-friction.

V1 should support user-defined or learned favorites such as:

```text
50 cl beer, 5%
150 ml wine, 13%
50 ml spirit, 40%
```

A one-tap “same as previous” action is desirable.

The user is never forced to complete every contextual field before a factual use event can be recorded.

### 9.2 Standard-drink policy

A standard drink is jurisdiction-dependent. Canonical storage must therefore not be only `standardDrinks`.

Raw facts and pure-ethanol representation are preserved. Standard-drink or unit conversion uses an explicit versioned measurement/guidance profile.

Changing locale or guideline does not rewrite historical raw facts.

Core does not know any standard-drink definition.

### 9.3 No alcoholmeter/BAC dependency

Self-report is the V1 source of truth for drinking facts unless another non-device source is explicitly added later.

V1 does not use:

- breathalyzer readings;
- BAC estimates as safety truth;
- camera verification;
- intoxication proof;
- sobriety verification hardware.

The absence of these devices must not reduce the correctness of deterministic symptom/history-based safety gates.

## 10. Planned vs unplanned drinking

Plan adherence is modeled as factual comparison rather than moral judgment.

Examples:

```text
Plan: 3
Actual: 3
→ plan fulfilled
```

```text
Plan: 1
Actual: 3
→ plan exceeded
```

```text
Plan: alcohol-free
Actual: 1
→ unplanned use
```

The third state is not automatically emitted as `relapse` or `goal_failed`.

This distinction becomes a core input for Progress, Recovery and later Pattern Intelligence.

## 11. Alcohol Rescue

Alcohol Rescue reuses the Core Rescue state machine with Alcohol-owned context, content, eligibility and safety policy.

The primary UX includes an always-accessible action equivalent to:

> **“Şu an içmek istiyorum.”**

Rescue remains offline and starts with the least burdensome useful intervention.

Potential V1 intervention families:

- micro regulation/breathing;
- urge surfing / ACT;
- short delay;
- non-alcohol substitution;
- environment change;
- CBT reframe;
- brief distraction/action task;
- explicit user-controlled human support;
- Recovery-specific reset/support.

Conceptual escalation:

```text
micro reset
   ↓ still craving
urge surfing / guided intervention
   ↓ still craving
delay
   ↓ still craving
environment change
   ↓ still craving
optional human support offer
```

The user can explicitly request escalation sooner.

Safety always precedes or constrains Rescue when medically relevant. Rescue cannot instruct abrupt cessation when withdrawal risk requires medical assessment.

Human support remains explicit-action only; no automatic message/call is sent.

## 12. Alcohol Recovery

Alcohol Recovery is triggered after a use event when reflection/support is useful, especially after unplanned or plan-exceeding use.

The tone is factual and non-punitive.

Conceptual flow:

```text
What happened?
   ↓
Was this planned?
   ↓
What was the trigger/context?
   ↓
Do you want Rescue now?
   ↓
Keep tomorrow's plan or explicitly change it?
```

Core invariants remain:

- use is appended as fact;
- previous progress/history is preserved;
- a single event does not automatically create relapse/failure;
- current `goalId` is preserved unless explicitly changed;
- outcome facts do not make causal efficacy claims.

## 13. Pattern Engine

Pattern analysis is part of Alcohol V1 product design, while detailed data contracts remain roadmap item #37.

Potential derived patterns include:

- time-of-day concentration;
- day-of-week concentration;
- planned vs unplanned use trends;
- plan-exceedance patterns;
- drinking-alone vs social associations;
- first-drink-time trends;
- trigger/mood associations;
- alcohol-free-day patterns;
- Rescue usage/outcome associations;
- total ethanol trends.

The system must distinguish association from causation.

Example acceptable wording:

> “Stres bildirdiğin günlerde kullanımın daha yüksek görünüyor.”

Not acceptable as an unsupported causal claim:

> “Stres içmene neden oluyor.”

## 14. Personal Trigger Map

V1 may summarize recurring combinations as a user-facing trigger map:

```text
WHEN: Friday evening
WHERE/CONTEXT: home
WITH: alone
BEFORE: stress reported
DRINK: spirits
RESULT: plan often exceeded
```

This is derived evidence with provenance, not a diagnosis.

## 15. Daily check-in

Daily check-in should be optional and brief rather than a mandatory questionnaire.

Potential fields:

- mood;
- craving 0–10;
- today’s plan readiness;
- sleep quality.

The user can disable reminders/check-ins.

Check-in data may enrich Pattern Engine and personalization but cannot become a safety override.

## 16. Micro-learning journey

V1 includes short educational/behavior-change content rather than requiring long courses.

Candidate topics:

- craving and habit loops;
- trigger → urge → behavior;
- alcohol and sleep;
- tolerance;
- planning and implementation intentions;
- social pressure;
- ACT;
- CBT;
- urge surfing;
- lapse/use event ≠ total failure;
- interpreting progress across abstinence and reduction goals.

Content can adapt to user-relevant patterns. Irrelevant lessons should not be repeatedly forced.

Educational personalization does not change deterministic safety policy.

## 17. Progress model

Progress is multi-dimensional rather than dominated by a single sober streak.

Possible V1 metrics:

- alcohol-free days;
- plan-fulfilled days;
- pure-ethanol trend;
- heavy-use episode trend where a versioned guidance definition is applicable;
- unplanned-use trend;
- plan-exceedance trend;
- Rescue usage count;
- factual Rescue outcomes;
- average first-drink time;
- money estimate where user supplies sufficient data;
- craving trend;
- sleep association where data exists.

Metric prominence depends on the user’s goal.

Abstinence users may see alcohol-free/sober-day metrics first. Reduction users see reduction, planning and heavy-use metrics first.

### 17.1 Streak policy

Streaks may be displayed but must not erase history.

If an alcohol-free streak ends, the prior alcohol-free days remain part of the user’s progress.

Example:

```text
Current streak: 0
Last streak: 12 days
Alcohol-free days in last 30: 27
```

This prevents one event from visually destroying all prior progress.

## 18. “Safe drinking” language

UNTRAVA does not label an amount as universally safe.

The product may display jurisdiction-specific **lower-risk guidance**, but guidance must be:

- source-attributed;
- versioned;
- jurisdiction-aware;
- clearly differentiated from a guarantee of safety.

Raw historical facts are never rewritten when guidance changes.

## 19. Alcohol use-risk vs AUD vs dependence vs withdrawal

The Alcohol Module keeps these distinct:

```text
AlcoholUseRisk
AUDScreeningSignal
PhysicalDependenceRisk
WithdrawalComplicationRisk
CurrentWithdrawalSeverity
AcuteIntoxicationRisk
```

AUDIT/AUDIT-C-style screening may become a validated input, but:

- screening does not independently diagnose AUD;
- AUD score is not a withdrawal-safety score;
- withdrawal routing uses withdrawal-specific history and current medical context.

## 20. Connected health/lab boundary

Future health connections may contribute labs, medication lists, diagnoses, sleep/activity or other data.

V1 architecture rules:

- labs are contextual evidence, not autonomous AUD diagnosis;
- normal liver tests do not prove absence of alcohol-related liver disease;
- abnormal tests do not prove alcohol causation;
- medication data may inform InteractionGate but never authorize medication changes;
- provenance and freshness are explicit;
- uncertainty/missingness is explicit.

No doctor communication is implied by reading connected health data.

## 21. AI personalization

AI may assist with:

- journal/reflection summarization;
- pattern explanation;
- weekly review;
- personalized micro-learning selection;
- Rescue wording personalization;
- goal reflection;
- suggested plan questions.

Example weekly review:

> “Bu hafta 4 alcohol-free day hedefledin ve 4'ünü tamamladın. Cuma planın 2 idi, 4 olarak kaydettin. Son üç haftada cuma akşamları benzer bir pattern var. Gelecek cuma planını gözden geçirmek ister misin?”

AI may not:

- reduce or override a safety disposition;
- authorize withdrawal/detox;
- generate taper schedules;
- prescribe medication;
- mutate raw use facts;
- silently change goals or weekly plans;
- automatically contact support;
- present correlation as proven causation.

Removing AI entirely must not break Safety, logging, Rescue, Recovery or basic Progress.

## 22. User-controlled support

Doctor communication is excluded, but user-controlled personal support remains allowed through the shared Support boundary.

The user may optionally save people they choose to contact when struggling.

UNTRAVA may offer:

> “Destek kişini aramak ister misin?”

External action occurs only after explicit user action.

The app sends no automatic message and makes no automatic call.

Community/social network functionality is **not** required for V1. It may be designed later because moderation, harmful advice and privacy substantially expand scope.

## 23. Privacy and logging

Alcohol data is sensitive behavioral/health information.

Operational logs must not contain:

- free-text drinking narratives;
- full use-event payloads;
- medication lists;
- pregnancy status;
- withdrawal symptom detail;
- support contact details;
- exact location.

Safe operational metadata may include constrained identifiers such as module id, rule-set version, gate id, coarse disposition code and non-sensitive error class under the shared Core logging allowlist.

Local-first operation remains preferred. Sync must not be required for immediate Safety/Rescue/Recovery use.

## 24. Safety rule versioning

Every deterministic Alcohol safety policy has immutable version identity.

Conceptually:

```text
alcoholSafetyRuleSetId
alcoholSafetyRuleSetVersion
publishedAt
sourceGuidelineRefs[]
checksum
```

Every safety decision records the installed rule-set version and evidence references used.

A running safety decision must not silently jump rule versions.

Invalid/corrupt essential rule sets fail closed for risky self-guided withdrawal decisions.

## 25. Offline behavior

The following must work without server or generative AI:

- use-event capture;
- measurement calculations from installed profiles;
- essential emergency/withdrawal blocking gates;
- current safety rule-set lookup;
- Weekly Planner read/write;
- Rescue;
- Recovery;
- local immutable event persistence;
- basic progress calculations;
- queued sync.

If essential safety rules are unavailable/corrupt, facts may still be recorded but risky self-guided withdrawal guidance is not authorized.

## 26. Cross-module coexistence

A user may have Tobacco and Alcohol goals simultaneously.

Requirements:

- `moduleId` namespaces data;
- Alcohol cannot mutate Tobacco goals/events;
- Tobacco cannot interpret Alcohol event schemas;
- Alcohol Safety does not alter Tobacco rules;
- both use shared Core event store/sync infrastructure;
- corrections/retractions retain module identity;
- any future cross-module Intelligence requires explicit normalized adapters and consent.

## 27. Error handling / fail-closed behavior

Examples:

- invalid Alcohol safety rule set → do not authorize risky self-guided withdrawal;
- impossible measurement input → preserve draft/error state, do not fabricate ethanol quantity;
- stale medication/medical context → represent freshness uncertainty and route conservatively where policy requires;
- unavailable AI/server → deterministic Safety/Planner/Rescue/Recovery continue locally;
- persistence failure during state transition → state does not advance until local persistence succeeds;
- missing breathalyzer/BAC data → irrelevant because V1 does not depend on those data sources.

## 28. V1 acceptance criteria

The Alcohol V1 architecture is implemented only when later tasks prove all of the following:

1. Core contains no Alcohol goal enums, beverage types, standard-drink rules or withdrawal logic.
2. Alcohol Module has module-owned goal and use-event schemas.
3. Observe, abstinence and reduction-oriented paths can coexist without separate product silos.
4. Raw beverage/volume/ABV facts and pure-ethanol representation are preserved independently of standard-drink display.
5. Weekly plans are explicit user-owned records and can be compared with actual use.
6. Planned vs unplanned use is represented without automatically creating relapse/failure facts.
7. Acute intoxication/emergency routing can interrupt normal Rescue.
8. Withdrawal risk is independent of craving/Rescue.
9. PAWSS is not a consumer stand-alone detox-permission rule.
10. CIWA-Ar is not used as a pre-withdrawal risk predictor or autonomous medication algorithm.
11. Wernicke/nutrition risk has an independent gate.
12. Opioid/benzodiazepine/sedative interaction risk has an independent gate.
13. Pregnancy + suspected dependence routes to medical/specialist assessment rather than autonomous abrupt-cessation advice.
14. UNTRAVA generates no taper schedule.
15. UNTRAVA generates no medication dosing.
16. Alcohol Rescue cannot override medical safety gates.
17. Alcohol Recovery preserves history and goal identity and remains non-punitive.
18. Pattern insights distinguish association from causation.
19. Progress is multi-dimensional; one use event does not erase prior progress.
20. Essential Safety, Planner, Rescue and Recovery work offline with validated local rules/content.
21. No doctor communication, clinician-plan integration, breathalyzer or BAC verification is required for V1 operation.
22. User support actions remain explicit-action only.
23. Tobacco acceptance behavior remains unchanged.
24. Tobacco + Alcohol coexist on the shared event-store/sync path without schema collision.
25. Exact-HEAD CI is green after each implementation milestone.

## 29. Roadmap mapping

This spec defines product/safety architecture. Implementation remains decomposed:

- **#31** Alcohol goal types and goal-config contracts, including Observe and planning-compatible goal configuration.
- **#32** Alcohol use-event model, canonical measurement and planned/unplanned facts.
- **#33** Alcohol Safety Orchestrator and dangerous-withdrawal/emergency routing.
- **#34** Hard invariant: no taper or medication-dosing authority.
- **#35** Alcohol Rescue Library.
- **#36** Alcohol Recovery Flow.
- **#37** Alcohol Pattern/Risk Engine data contracts.
- **#38** Alcohol vertical offline E2E including Planner → Log → Rescue/Recovery → Progress.
- **#39** Tobacco + Alcohol cross-module coexistence test.
- **#40** Intelligence Engines only after Core + Tobacco + Alcohol prerequisites are green.

Weekly Planner, progress semantics, micro-learning and AI personalization are architectural requirements introduced by this V1 design and should be decomposed into explicit implementation tasks before the Alcohol milestone is considered product-complete. They must not be silently omitted merely because the older roadmap ended at #39.

## 30. Medical evidence and source policy

The safety architecture is grounded in authoritative guidance and validation literature available as of 2026-09-16. References guide architecture; they are not copied into code as permanent unversioned medical truth. Production safety rules must record source/version metadata so guideline changes can be reviewed and deployed deliberately.

Primary references:

1. American Society of Addiction Medicine (ASAM), *The ASAM Clinical Practice Guideline on Alcohol Withdrawal Management* (2020). https://www.asam.org/docs/default-source/quality-science/the_asam_clinical_practice_guideline_on_alcohol-1.pdf
2. UK Department of Health and Social Care, *Clinical guidelines for alcohol treatment — Harm reduction*; published 2025-11-28, updated 2026-04-17. https://www.gov.uk/guidance/clinical-guidelines-for-alcohol-treatment/8-harm-reduction
3. UK Department of Health and Social Care, *Clinical guidelines for alcohol treatment — Pharmacological interventions*. https://www.gov.uk/guidance/clinical-guidelines-for-alcohol-treatment/10-pharmacological-interventions
4. UK Department of Health and Social Care, *Clinical guidelines for alcohol treatment — Community based medically assisted withdrawal*. https://www.gov.uk/guidance/clinical-guidelines-for-alcohol-treatment/11-community-based-medically-assisted-withdrawal
5. UK Department of Health and Social Care, *Clinical guidelines for alcohol treatment — Alcohol care in acute hospitals*. https://www.gov.uk/guidance/clinical-guidelines-for-alcohol-treatment/16-alcohol-care-in-acute-hospitals
6. NICE CG115, *Alcohol-use disorders: diagnosis, assessment and management of harmful drinking and alcohol dependence*. https://www.nice.org.uk/guidance/cg115/chapter/Recommendations
7. NICE CG192, pregnancy/postnatal recommendations for harmful/dependent alcohol misuse and assisted withdrawal. https://www.nice.org.uk/guidance/cg192/chapter/Recommendations
8. NIAAA, *Understanding the Dangers of Alcohol Overdose*. https://www.niaaa.nih.gov/publications/brochures-and-fact-sheets/understanding-dangers-of-alcohol-overdose
9. NIAAA, *Alcohol-Medication Interactions: Potentially Dangerous Mixes*. https://www.niaaa.nih.gov/health-professionals-communities/core-resource-on-alcohol/alcohol-medication-interactions-potentially-dangerous-mixes
10. NIAAA, *What is a Standard Drink*. https://rethinkingdrinking.niaaa.nih.gov/how-much-too-much/whats-standard-drink
11. WHO, *Alcohol* fact sheet. https://www.who.int/news-room/fact-sheets/detail/alcohol
12. WHO Global Health Observatory, *Alcohol policy: standard drink defined*. https://www.who.int/data/gho/data/indicators/indicator-details/GHO/standard-drink-defined
13. Maldonado JR et al. *Prospective Validation Study of the Prediction of Alcohol Withdrawal Severity Scale (PAWSS) in Medically Ill Inpatients*. Alcohol Alcohol. 2015;50(5):509-518. PMID 25999438. https://pubmed.ncbi.nlm.nih.gov/25999438/

## 31. Non-goals

This V1 spec does not:

- diagnose AUD;
- create a medical-device claim;
- define medication regimens;
- define a taper protocol;
- implement PAWSS/CIWA-Ar medication logic;
- communicate with doctors;
- ingest clinician-authored treatment plans;
- require a breathalyzer;
- require BAC calculation/verification;
- require community/social networking;
- implement final #31–#39 contracts/flows inside this design-doc commit;
- merge to `main`;
- touch production infrastructure.
