import {
  AlcoholEventEnvelopeSchema,
  AlcoholRecoverySessionSchema,
  type AlcoholEventEnvelope,
  type AlcoholRecoverySession,
} from '../../../../../packages/contracts/src/index';
import type { LocalEventStore } from '../../local-event-store';

export class AlcoholRecoveryEventSinkAdapter {
  constructor(
    private readonly store: LocalEventStore<AlcoholEventEnvelope>,
    private readonly createEventId: () => string,
    private readonly now: () => string,
  ) {}

  private async append(
    session: AlcoholRecoverySession,
    eventType: 'alcohol_recovery_reflection' | 'alcohol_recovery_outcome',
    payload: Record<string, unknown>,
  ): Promise<void> {
    const event = AlcoholEventEnvelopeSchema.parse({
      eventId: this.createEventId(),
      userId: session.context.userId,
      deviceId: session.context.deviceId,
      moduleId: 'alcohol',
      schemaVersion: 1,
      eventType,
      occurredAt: session.updatedAt,
      recordedAt: this.now(),
      payload,
    });
    await this.store.append(event);
  }

  async reflection(snapshot: AlcoholRecoverySession): Promise<void> {
    const session = AlcoholRecoverySessionSchema.parse(snapshot);
    const reflection = Object.fromEntries(
      Object.entries(session.reflection ?? {}).filter(([, value]) => value !== undefined),
    );
    if (Object.keys(reflection).length === 0) return;

    await this.append(session, 'alcohol_recovery_reflection', {
      recoverySessionId: session.context.recoverySessionId,
      triggeringUseEventId: session.context.triggeringUseEventId,
      ...reflection,
    });
  }

  async outcome(snapshot: AlcoholRecoverySession): Promise<void> {
    const session = AlcoholRecoverySessionSchema.parse(snapshot);
    if (session.state !== 'completed' && session.state !== 'abandoned') {
      throw new Error('alcohol_recovery_outcome_requires_terminal_session');
    }

    const { context } = session;
    const { engineId, ruleSetId, ruleSetVersion, disposition } = context.safetyDecision;
    const safetyRouted = session.state === 'completed' &&
      (disposition === 'emergency_response' || disposition === 'urgent_medical_assessment');

    await this.append(session, 'alcohol_recovery_outcome', {
      recoverySessionId: context.recoverySessionId,
      triggeringUseEventId: context.triggeringUseEventId,
      ...(context.goalId === undefined ? {} : { goalId: context.goalId }),
      outcome: safetyRouted ? 'safety_routed' : session.state,
      ...(session.reflection?.nextAction === undefined ? {} : { nextAction: session.reflection.nextAction }),
      ...(session.interventionId === null ? {} : { interventionId: session.interventionId }),
      ...(session.interventionVersion === null ? {} : { interventionVersion: session.interventionVersion }),
      ...(safetyRouted ? { safetyAudit: { engineId, ruleSetId, ruleSetVersion, disposition } } : {}),
    });
  }
}
