# UNTRAVA Rescue & Interventions — Acceptance Audit

**Date:** 2026-09-16  
**Specification:** `docs/superpowers/specs/2026-09-16-untrava-rescue-interventions-design.md`  
**Code baseline audited:** `e82951a6db20de752abe5731e915781355adea04`  
**Scope:** Section 21 testing strategy + Section 22 acceptance gate, with high-risk normative invariants from Sections 19–20 cross-checked.  
**Result:** PASS — every listed acceptance/testing requirement has an automated test mapping. No uncovered Rescue acceptance requirement was found in this audit.

## 1. Section 21 — Testing strategy mapping

### Contract tests

| Specification requirement | Automated evidence |
| --- | --- |
| Valid/invalid Rescue library definitions | `packages/contracts/test/rescue.test.ts` — accepts a valid offline Rescue library; rejects invalid active-step/offline-capability/treatment-control shapes. |
| Unknown schema version rejected | `packages/contracts/test/rescue.test.ts` — `requires schema version 1`. |
| Duplicate active intervention rejected | `packages/contracts/test/rescue.test.ts` — duplicate `(interventionId, version)` rejection and only one active version per ID. |
| Deterministic selector stability | `apps/mobile/test/rescue-selector.test.ts` — repeated selection equality under identical context. |
| Eligibility filtering | `apps/mobile/test/rescue-selector.test.ts` — capability, goal-type, support, environment and disabled/ineligible filtering. |
| Retired definitions excluded from new selections | `apps/mobile/test/rescue-selector.test.ts` — retired `micro-regulate` is not selected. |
| Recovery mode only selects `recoveryEligible` definitions | `apps/mobile/test/rescue-selector.test.ts` — recovery mode resolves to `recovery-reset`. |

### State-machine tests

| Specification requirement | Automated evidence |
| --- | --- |
| Normal resolve path | `apps/mobile/test/rescue-session.test.ts` — legal resolve path reaches `resolved`. |
| Reassessment and escalation | `apps/mobile/test/rescue-session.test.ts` — reassessment with `wantsAnother: true` reaches `escalating` and returns to selection. |
| User-requested immediate escalation | `apps/mobile/test/rescue-session.test.ts` — active intervention can explicitly escalate immediately. |
| Product use → Recovery Flow | `apps/mobile/test/rescue-session.test.ts` and `apps/mobile/test/rescue-offline-flow.test.ts`. |
| Abandonment | `apps/mobile/test/rescue-session.test.ts` — persists terminal `abandoned` state and rejects further transitions. |
| Process resume from persisted state | `apps/mobile/test/rescue-offline-flow.test.ts` — persisted active session is resumed with pinned metadata. |
| Running session remains pinned to intervention/library version | `apps/mobile/test/rescue-session.test.ts`, `apps/mobile/test/rescue-library-repository.test.ts`, and offline resume coverage. |

### Local-first tests

All items below are covered by `apps/mobile/test/rescue-offline-flow.test.ts`, especially `resolves Rescue, recovers after use, and resumes without any network dependency`:

| Specification requirement | Automated evidence |
| --- | --- |
| Rescue starts | `RescueSessionCoordinator.start(...)` is exercised with local stores. |
| Intervention is selected | Bundled library + deterministic selector + session `select(...)`. |
| Steps complete | Selected interventions enter `intervention_active` and `completeIntervention(...)`. |
| Reassessment works | Normal Rescue and Recovery paths reassess locally. |
| Outcome is recorded | `intervention_outcome` is appended locally before resolution. |
| Immutable events exist locally | Local event store is inspected for started/completed/outcome/product-use event sequence. |
| Session resolves / Recovery completes without network | Transport stub is configured to throw; core flow completes with zero transport calls. |

### Event tests

| Specification requirement | Automated evidence |
| --- | --- |
| Intervention start and completion are distinct events | `apps/mobile/test/rescue-events.test.ts` — distinct IDs and event types. |
| Product-use event after Rescue is append-only | `apps/mobile/test/rescue-events.test.ts` — original event remains byte-for-byte equal after product-use append. |
| Correction does not mutate originals | `apps/mobile/test/rescue-events.test.ts` — correction and retraction append new IDs while target remains unchanged. |
| Rescue-generated events enter existing sync queue | `apps/mobile/test/rescue-events.test.ts` — shared `SyncEventDatabase` with real `PersistentSyncQueue.listDue(...)`. |
| Replay remains idempotent at server boundary via Foundation | `apps/api/test/events.service.test.ts` — the same client event is accepted once, then reported `duplicate`, with repository count remaining one. |

### Library migration tests

All migration requirements are covered by `apps/mobile/test/rescue-library-repository.test.ts`:

| Specification requirement | Automated evidence |
| --- | --- |
| Valid newer content activates | Valid contentVersion 2 activates while v1 remains stored. |
| Invalid hash/version does not replace active valid library | Corrupt library hash/intervention hash and non-newer version fail closed to v1. |
| Historical intervention/library version remains interpretable | `getLibrary(1)` remains equal to the retained bundled library after v2 activation. |
| Active session does not silently jump versions | Session started/pinned on v1 remains v1 after repository activates v2. |

## 2. Section 22 — Acceptance gate mapping

| Acceptance gate | Automated evidence | Status |
| --- | --- | --- |
| Rescue can complete end-to-end with network disabled | `apps/mobile/test/rescue-offline-flow.test.ts` | PASS |
| Bundled library is versioned, validated and deterministic | `packages/contracts/test/rescue.test.ts`; `apps/mobile/test/rescue-library-repository.test.ts`; `apps/mobile/test/rescue-selector.test.ts` | PASS |
| Selector never chooses ineligible or retired intervention | `apps/mobile/test/rescue-selector.test.ts` | PASS |
| Four escalation levels are representable and transitions explicit | `apps/mobile/test/rescue-escalation-levels.test.ts` — `micro → guided → environment_escape → human_support` | PASS |
| Reassessment can resolve, escalate, request support or enter Recovery | `apps/mobile/test/rescue-session.test.ts` — all four exits from `reassessing` | PASS |
| Product use creates immutable event and does not rewrite prior events | `apps/mobile/test/rescue-events.test.ts` | PASS |
| Recovery uses same versioned intervention model and cannot silently change goal | `apps/mobile/test/rescue-offline-flow.test.ts` — recovery intervention comes from same bundled library; `goalType` + `goalId` remain pinned | PASS |
| Recovery is non-punitive | `apps/mobile/test/rescue-offline-flow.test.ts` — prior history preserved; no `goal_changed`; no `failed`/`relapse` semantics | PASS |
| Rescue outcome facts persist without causal efficacy claim | `apps/mobile/test/rescue-outcome-facts.test.ts` — causal/efficacy fields rejected; observational facts persist | PASS |
| Invalid downloaded library update fails closed | `apps/mobile/test/rescue-library-repository.test.ts` | PASS |
| Running sessions remain pinned to starting intervention version | `apps/mobile/test/rescue-library-repository.test.ts` and `apps/mobile/test/rescue-session.test.ts` | PASS |
| Support Circle is optional and no automatic contact occurs | `apps/mobile/test/rescue-support.test.ts` — escalation only offers; provider called only on explicit user request; absent provider fails soft | PASS |
| No medication/NRT dosing logic is introduced | `packages/contracts/test/rescue.test.ts` — `medicationAdvice:true`, unknown treatment metadata and `nrt_dosing` action kind are rejected | PASS |
| Lint, typecheck and relevant tests pass in GitHub Actions | Remote exact-HEAD CI is required by the development workflow; verification run is recorded when this audit commit is closed | PASS-PENDING-THIS-COMMIT-CI |

## 3. High-risk normative invariants outside the Section 22 list

These are not separate Section 22 bullets but are explicitly normative elsewhere in the Rescue spec and were cross-checked during this audit.

| Invariant | Automated evidence | Status |
| --- | --- | --- |
| No eligible intervention → hard-coded, non-medical minimal fallback | `apps/mobile/test/rescue-selector.test.ts` | PASS |
| Local persistence failure must not advance in-memory state | `apps/mobile/test/rescue-session.test.ts` | PASS |
| Downloaded library localization reference must fail closed | `apps/mobile/test/rescue-library-repository.test.ts` | PASS |
| Sensitive Rescue context must not enter ordinary logs | `apps/mobile/test/rescue-logging.test.ts` — allowlist-only operational metadata; free text, treatment, contact, exact coordinates and event payloads are dropped | PASS |
| Goal identity, not merely goal type, remains stable through Recovery | `apps/mobile/test/rescue-offline-flow.test.ts` using pinned `goalId` | PASS |
| No automatic support-provider action on escalation | `apps/mobile/test/rescue-support.test.ts` | PASS |
| Correction/retraction are append-only | `apps/mobile/test/rescue-events.test.ts` | PASS |
| Rescue events are wired to the Foundation persistent sync queue | `apps/mobile/test/rescue-events.test.ts` | PASS |
| Server replay remains idempotent | `apps/api/test/events.service.test.ts` | PASS |

## 4. Audit conclusion

No uncovered requirement was found in Section 21 or Section 22. The existing automated suite provides traceable evidence for every Rescue acceptance item. Therefore the next work item after this audit is not another Rescue behavior change; it is the dedicated exact-HEAD full CI gate, followed by Tobacco Rescue milestone closure.

This audit intentionally does **not** close the milestone itself and does **not** authorize work on `untrava-intelligence-engines`.
