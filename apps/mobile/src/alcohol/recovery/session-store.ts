import {
  AlcoholRecoverySessionSchema,
  type AlcoholRecoverySession,
} from '../../../../../packages/contracts/src/index';

export interface AlcoholRecoverySessionStore {
  save(session: AlcoholRecoverySession): void;
  get(recoverySessionId: string): AlcoholRecoverySession | null;
}

export class MemoryAlcoholRecoverySessionStore implements AlcoholRecoverySessionStore {
  private readonly sessions = new Map<string, AlcoholRecoverySession>();

  save(session: AlcoholRecoverySession): void {
    const parsed = AlcoholRecoverySessionSchema.parse(session);
    this.sessions.set(parsed.context.recoverySessionId, structuredClone(parsed));
  }

  get(recoverySessionId: string): AlcoholRecoverySession | null {
    const session = this.sessions.get(recoverySessionId);
    return session ? AlcoholRecoverySessionSchema.parse(structuredClone(session)) : null;
  }
}
