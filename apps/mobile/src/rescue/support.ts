import type { RescueContext } from '../../../../packages/contracts/src/index';

export interface SupportActionRequest {
  rescueSessionId: string;
  requestedAt: string;
  reason: 'user_requested' | 'rescue_escalation';
}

export interface SupportActionResult {
  status: 'offered' | 'started' | 'cancelled' | 'unavailable';
}

export interface SupportActionProvider {
  canOfferSupport(): Promise<boolean>;
  requestUserInitiatedSupport(input: SupportActionRequest): Promise<SupportActionResult>;
}

export interface SupportActionTarget {
  rescueSessionId: string;
  requestedAt: string;
}

export class RescueSupportCoordinator {
  constructor(private readonly provider?: SupportActionProvider) {}

  private async canOfferSupport(): Promise<boolean> {
    return this.provider ? this.provider.canOfferSupport() : false;
  }

  async resolveContext(context: RescueContext): Promise<RescueContext> {
    const providerAvailable = await this.canOfferSupport();
    return {
      ...context,
      canContactSupport: context.canContactSupport !== false && providerAvailable,
    };
  }

  async offerEscalation(_target: SupportActionTarget): Promise<SupportActionResult> {
    return (await this.canOfferSupport()) ? { status: 'offered' } : { status: 'unavailable' };
  }

  async requestUserInitiated(target: SupportActionTarget): Promise<SupportActionResult> {
    return this.request(target, 'user_requested');
  }

  async acceptEscalation(target: SupportActionTarget): Promise<SupportActionResult> {
    return this.request(target, 'rescue_escalation');
  }

  private async request(
    target: SupportActionTarget,
    reason: SupportActionRequest['reason'],
  ): Promise<SupportActionResult> {
    if (!this.provider || !(await this.provider.canOfferSupport())) {
      return { status: 'unavailable' };
    }

    return this.provider.requestUserInitiatedSupport({
      ...target,
      reason,
    });
  }
}
