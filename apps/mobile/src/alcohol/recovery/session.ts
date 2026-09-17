import {
  AlcoholRecoveryContextSchema,
  AlcoholRecoverySessionSchema,
  type AlcoholRecoveryContext,
  type AlcoholRecoveryNextAction,
  type AlcoholRecoveryReflection,
  type AlcoholRecoverySession,
  type AlcoholRecoverySessionState,
  type AlcoholRescueLibrary,
} from '../../../../../packages/contracts/src/index';
import { selectAlcoholIntervention } from '../rescue/selector';
import type { AlcoholRecoverySessionStore } from './session-store';

export interface StartAlcoholRecoveryInput {
  context: AlcoholRecoveryContext;
  libraryContentVersion: number;
  now: string;
}

function requiresSafetyRouting(context: AlcoholRecoveryContext): boolean {
  return context.safetyDecision.disposition === 'emergency_response' ||
    context.safetyDecision.disposition === 'urgent_medical_assessment';
}

export class AlcoholRecoverySessionCoordinator {
  private constructor(
    private session: AlcoholRecoverySession,
    private readonly store?: AlcoholRecoverySessionStore,
  ) {}

  static start(
    input: StartAlcoholRecoveryInput,
    store?: AlcoholRecoverySessionStore,
  ): AlcoholRecoverySessionCoordinator {
    const context = AlcoholRecoveryContextSchema.parse(input.context);
    return AlcoholRecoverySessionCoordinator.resume(
      {
        context,
        state: requiresSafetyRouting(context) ? 'safety_routing' : 'started',
        libraryContentVersion: input.libraryContentVersion,
        interventionId: null,
        interventionVersion: null,
        currentStepIndex: 0,
        startedAt: input.now,
        updatedAt: input.now,
      },
      store,
    );
  }

  static resume(
    session: AlcoholRecoverySession,
    store?: AlcoholRecoverySessionStore,
  ): AlcoholRecoverySessionCoordinator {
    const parsed = AlcoholRecoverySessionSchema.parse(structuredClone(session));
    store?.save(structuredClone(parsed));
    return new AlcoholRecoverySessionCoordinator(parsed, store);
  }

  snapshot(): AlcoholRecoverySession {
    return AlcoholRecoverySessionSchema.parse(structuredClone(this.session));
  }

  private commit(next: AlcoholRecoverySession): AlcoholRecoverySession {
    const parsed = AlcoholRecoverySessionSchema.parse(structuredClone(next));
    this.store?.save(structuredClone(parsed));
    this.session = parsed;
    return this.snapshot();
  }

  private requireState(...allowed: AlcoholRecoverySessionState[]): void {
    if (!allowed.includes(this.session.state)) {
      throw new Error('invalid_alcohol_recovery_transition');
    }
  }

  private requireBehaviorState(...allowed: AlcoholRecoverySessionState[]): void {
    this.requireState(...allowed);
    if (requiresSafetyRouting(this.session.context)) {
      throw new Error('invalid_alcohol_recovery_transition');
    }
  }

  private transition(state: AlcoholRecoverySessionState, now: string): AlcoholRecoverySession {
    return this.commit({ ...this.session, state, updatedAt: now });
  }

  beginReflection(now: string): AlcoholRecoverySession {
    this.requireBehaviorState('started');
    return this.transition('reflecting', now);
  }

  recordReflection(reflection: AlcoholRecoveryReflection, now: string): AlcoholRecoverySession {
    this.requireBehaviorState('reflecting');
    return this.commit({ ...this.session, reflection, updatedAt: now });
  }

  selectReset(library: AlcoholRescueLibrary, now: string): AlcoholRecoverySession {
    this.requireBehaviorState('reflecting');
    if (library.contentVersion !== this.session.libraryContentVersion) {
      throw new Error('alcohol_recovery_library_version_mismatch');
    }
    const selection = selectAlcoholIntervention(
      library,
      this.session.context,
      this.session.context.safetyDecision,
      'micro',
      'recovery',
    );
    if (selection.kind === 'safety_routing') {
      throw new Error('alcohol_recovery_safety_routing_required');
    }
    if (selection.kind === 'unavailable') {
      throw new Error('alcohol_recovery_reset_unavailable');
    }
    return this.commit({
      ...this.session,
      state: 'intervention_selected',
      interventionId: selection.interventionId,
      interventionVersion: selection.version,
      currentStepIndex: 0,
      updatedAt: now,
    });
  }

  beginSelected(now: string): AlcoholRecoverySession {
    this.requireBehaviorState('intervention_selected');
    return this.transition('intervention_active', now);
  }

  complete(nextAction: AlcoholRecoveryNextAction | undefined, now: string): AlcoholRecoverySession {
    this.requireBehaviorState('intervention_active');
    return this.commit({
      ...this.session,
      state: 'completed',
      ...(nextAction === undefined ? {} : {
        reflection: { ...this.session.reflection, nextAction },
      }),
      updatedAt: now,
    });
  }

  completeSafetyRouting(now: string): AlcoholRecoverySession {
    this.requireState('safety_routing');
    return this.transition('completed', now);
  }

  abandon(now: string): AlcoholRecoverySession {
    this.requireState('started', 'safety_routing', 'reflecting', 'intervention_selected', 'intervention_active');
    return this.transition('abandoned', now);
  }
}
