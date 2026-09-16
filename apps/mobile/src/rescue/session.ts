import {
  RescueSessionSchema,
  type RescueContext,
  type RescueOutcome,
  type RescueSession,
  type RescueSessionState,
} from '../../../../packages/contracts/src/index';
import type { InterventionSelection } from './selector';

export interface StartRescueInput {
  rescueSessionId: string;
  context: RescueContext;
  libraryContentVersion: number;
  now: string;
}

export interface ReassessInput {
  wantsAnother: boolean;
  outcome?: RescueOutcome;
}

const terminalStates = new Set<RescueSessionState>(['resolved', 'abandoned']);

export class RescueSessionCoordinator {
  private constructor(private session: RescueSession) {}

  static start(input: StartRescueInput): RescueSessionCoordinator {
    return new RescueSessionCoordinator(
      RescueSessionSchema.parse({
        rescueSessionId: input.rescueSessionId,
        context: input.context,
        state: 'started',
        libraryContentVersion: input.libraryContentVersion,
        interventionId: null,
        interventionVersion: null,
        currentStepIndex: 0,
        startedAt: input.now,
        updatedAt: input.now,
      }),
    );
  }

  static resume(session: RescueSession): RescueSessionCoordinator {
    return new RescueSessionCoordinator(RescueSessionSchema.parse(session));
  }

  snapshot(): RescueSession {
    return RescueSessionSchema.parse(structuredClone(this.session));
  }

  private requireState(...allowed: RescueSessionState[]): void {
    if (!allowed.includes(this.session.state) || terminalStates.has(this.session.state)) {
      throw new Error('invalid_rescue_transition');
    }
  }

  private transition(state: RescueSessionState, now: string): RescueSession {
    this.session = RescueSessionSchema.parse({ ...this.session, state, updatedAt: now });
    return this.snapshot();
  }

  stabilize(now: string): RescueSession {
    this.requireState('started');
    return this.transition('stabilizing', now);
  }

  select(selection: InterventionSelection, now: string): RescueSession {
    this.requireState('stabilizing', 'escalating', 'recovery');
    this.session = RescueSessionSchema.parse({
      ...this.session,
      state: 'intervention_selected',
      interventionId: selection.interventionId,
      interventionVersion: selection.version,
      currentStepIndex: 0,
      updatedAt: now,
    });
    return this.snapshot();
  }

  beginSelected(now: string): RescueSession {
    this.requireState('intervention_selected');
    return this.transition('intervention_active', now);
  }

  completeIntervention(now: string): RescueSession {
    this.requireState('intervention_active');
    return this.transition('reassessing', now);
  }

  reassess(input: ReassessInput, now: string): RescueSession {
    this.requireState('reassessing');
    this.session = RescueSessionSchema.parse({
      ...this.session,
      outcome: input.outcome ?? this.session.outcome,
      state: input.wantsAnother ? 'escalating' : 'resolved',
      updatedAt: now,
    });
    return this.snapshot();
  }

  requestSupport(now: string): RescueSession {
    this.requireState('stabilizing', 'intervention_selected', 'intervention_active', 'reassessing', 'escalating');
    if (this.session.context.canContactSupport !== true) throw new Error('support_unavailable');
    return this.transition('support_offered', now);
  }

  reportUse(now: string): RescueSession {
    this.requireState(
      'started',
      'stabilizing',
      'intervention_selected',
      'intervention_active',
      'reassessing',
      'escalating',
      'support_offered',
    );
    return this.transition('recovery', now);
  }

  abandon(now: string): RescueSession {
    if (terminalStates.has(this.session.state)) throw new Error('invalid_rescue_transition');
    return this.transition('abandoned', now);
  }
}
