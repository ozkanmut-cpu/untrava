import type {
  ProductType,
  QuitEventEnvelope,
  RescueLevel,
  RescueOutcome,
} from '../../../../packages/contracts/src/index';
import type { LocalEventStore } from '../local-event-store';

interface RescueEventBase {
  userId: string;
  deviceId: string;
  rescueSessionId: string;
  interventionId: string;
  interventionVersion: number;
  rescueLevel: RescueLevel;
  libraryContentVersion: number;
  occurredAt: string;
}

export interface InterventionStartedInput extends RescueEventBase {
  reasonCodes: string[];
}

export type InterventionCompletedInput = RescueEventBase;

export interface InterventionOutcomeInput extends RescueEventBase {
  outcome: RescueOutcome;
}

export interface SupportRequestInput {
  userId: string;
  deviceId: string;
  rescueSessionId: string;
  occurredAt: string;
}

export interface ProductUseInput {
  userId: string;
  deviceId: string;
  rescueSessionId: string;
  product: ProductType;
  quantity: number;
  occurredAt: string;
}

export class RescueEventSinkAdapter {
  constructor(
    private readonly store: LocalEventStore,
    private readonly createEventId: () => string,
    private readonly now: () => string,
  ) {}

  private envelope(
    input: { userId: string; deviceId: string; occurredAt: string },
    eventType: QuitEventEnvelope['eventType'],
    payload: Record<string, unknown>,
  ): QuitEventEnvelope {
    return {
      eventId: this.createEventId(),
      userId: input.userId,
      deviceId: input.deviceId,
      eventType,
      occurredAt: input.occurredAt,
      recordedAt: this.now(),
      schemaVersion: 1,
      payload,
    } as QuitEventEnvelope;
  }

  async interventionStarted(input: InterventionStartedInput): Promise<void> {
    await this.store.append(
      this.envelope(input, 'intervention_started', {
        rescueSessionId: input.rescueSessionId,
        interventionId: input.interventionId,
        interventionVersion: input.interventionVersion,
        rescueLevel: input.rescueLevel,
        libraryContentVersion: input.libraryContentVersion,
        reasonCodes: input.reasonCodes,
      }),
    );
  }

  async interventionCompleted(input: InterventionCompletedInput): Promise<void> {
    await this.store.append(
      this.envelope(input, 'intervention_completed', {
        rescueSessionId: input.rescueSessionId,
        interventionId: input.interventionId,
        interventionVersion: input.interventionVersion,
        rescueLevel: input.rescueLevel,
        libraryContentVersion: input.libraryContentVersion,
      }),
    );
  }

  async interventionOutcome(input: InterventionOutcomeInput): Promise<void> {
    await this.store.append(
      this.envelope(input, 'intervention_outcome', {
        rescueSessionId: input.rescueSessionId,
        interventionId: input.interventionId,
        interventionVersion: input.interventionVersion,
        rescueLevel: input.rescueLevel,
        libraryContentVersion: input.libraryContentVersion,
        ...input.outcome,
      }),
    );
  }

  async supportRequest(input: SupportRequestInput): Promise<void> {
    await this.store.append(
      this.envelope(input, 'support_request', {
        rescueSessionId: input.rescueSessionId,
      }),
    );
  }

  async productUse(input: ProductUseInput): Promise<void> {
    await this.store.append({
      eventId: this.createEventId(),
      userId: input.userId,
      deviceId: input.deviceId,
      eventType: 'product_use',
      occurredAt: input.occurredAt,
      recordedAt: this.now(),
      schemaVersion: 1,
      payload: {
        product: input.product,
        quantity: input.quantity,
      },
    });
  }
}
