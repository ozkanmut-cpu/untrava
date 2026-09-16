import {
  RescueSessionSchema,
  type RescueContext,
  type RescueOutcome,
  type RescueSession,
  type RescueSessionState,
} from '../../../../packages/contracts/src/index';
import type { RescueSessionStore } from './session-store';
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
  private constructor(
    private session: RescueSession,
    private readonly store?: RescueSessionStore,
  ) {}

  static start(input: StartRescueInput, store?: RescueSessionStore): RescueSessionCoordinator {
    const coordinator = new RescueSessionCoordinator(
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
      store,
    );
    coordinator.persist();
    return coordinator;
  }

  static resume(session: RescueSession, store?: RescueSessionStore): RescueSessionCoordinator {
    const coordinator = new RescueSessionCoordinator(RescueSessionSchema.parse(session), store);
    coordinator.persist();
    return coordinator;
  }

  snapshot(): RescueSession {
    return RescueSessionSchema.parse(structuredClone(this.session));
  }

  private persist(): void {
    this.store?.save(this.snapshot());
  }

  private commit(next: RescueSession): RescueSession {
    const parsed = RescueSessionSchema.parse(next);
    this.store?.save(structuredClone(parsed));
    this.session = parsed;
    return this.snapshot();
  }

  private requireState(...allowed: RescueSessionState[]): void {
    if (!allowed.includes(this.session.state) || terminalStates.has(this.session.state)) {
      throw new Error('invalid_rescue_transition');
    }
  }

  private transition(state: RescueSessionState, now: string): RescueSession {
    return this.commit(RescueSessionSchema.parse({ ...this.session, state, updatedAt: now }));
  }

  stabilize(now: string): RescueSession {
    this.requireState('started');
    return this.transition('stabilizing', now);
  }

  select(selection: InterventionSelection, now: string): RescueSession {
    this.requireState('stabilizing', 'escalating', 'recovery');
    return this.commit(
      RescueSessionSchema.parse({
        ...this.session,
        state: 'intervention_selected',
        interventionId: selection.interventionId,
        interventionVersion: selection.version,
        currentStepIndex: 0,
        updatedAt: now,
      }),
    );
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
    return this.commit(
      RescueSessionSchema.parse({
        ...this.session,
        outcome: input.outcome ?? this.session.outcome,
        state: input.wantsAnother ? 'escalating' : 'resolved',
        updatedAt: now,
      }),
    );
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
