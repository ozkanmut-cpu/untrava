import { describe, expect, it } from 'vitest';
import type { RescueContext } from '../../../packages/contracts/src/index';
import { createBundledRescueLibrary } from '../src/rescue/library';
import { selectIntervention } from '../src/rescue/selector';
import {
  RescueSupportCoordinator,
  type SupportActionProvider,
  type SupportActionRequest,
  type SupportActionResult,
} from '../src/rescue/support';

class FakeSupportProvider implements SupportActionProvider {
  requests: SupportActionRequest[] = [];

  constructor(private readonly available = true) {}

  async canOfferSupport(): Promise<boolean> {
    return this.available;
  }

  async requestUserInitiatedSupport(input: SupportActionRequest): Promise<SupportActionResult> {
    this.requests.push(input);
    return { status: 'started' };
  }
}

const baseContext: RescueContext = {
  userId: '550e8400-e29b-41d4-a716-446655440001',
  deviceId: '550e8400-e29b-41d4-a716-446655440002',
  startedAt: '2026-09-16T05:30:00.000Z',
  goalType: 'smoke_free',
  canMoveEnvironment: true,
  canContactSupport: true,
};

const supportRequest = {
  rescueSessionId: '550e8400-e29b-41d4-a716-446655440010',
  requestedAt: '2026-09-16T05:31:00.000Z',
} as const;

describe('RescueSupportCoordinator', () => {
  it('offers escalation without triggering a provider action automatically', async () => {
    const provider = new FakeSupportProvider();
    const support = new RescueSupportCoordinator(provider);

    expect(await support.offerEscalation(supportRequest)).toEqual({ status: 'offered' });
    expect(provider.requests).toEqual([]);
  });

  it('calls the provider only after an explicit user-initiated request', async () => {
    const provider = new FakeSupportProvider();
    const support = new RescueSupportCoordinator(provider);

    expect(await support.requestUserInitiated(supportRequest)).toEqual({ status: 'started' });
    expect(provider.requests).toEqual([
      {
        ...supportRequest,
        reason: 'user_requested',
      },
    ]);
  });

  it('fails soft when no provider is configured and filters human-support selection', async () => {
    const support = new RescueSupportCoordinator();
    expect(await support.offerEscalation(supportRequest)).toEqual({ status: 'unavailable' });
    expect(await support.requestUserInitiated(supportRequest)).toEqual({ status: 'unavailable' });

    const context = await support.resolveContext(baseContext);
    expect(context.canContactSupport).toBe(false);
    expect(selectIntervention(createBundledRescueLibrary(), context, 'human_support')).toBeNull();
  });

  it('does not override a user context that already disallows support', async () => {
    const support = new RescueSupportCoordinator(new FakeSupportProvider());
    const context = await support.resolveContext({ ...baseContext, canContactSupport: false });
    expect(context.canContactSupport).toBe(false);
  });
});
