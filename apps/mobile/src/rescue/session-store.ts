import {
  RescueSessionSchema,
  type RescueSession,
} from '../../../../packages/contracts/src/index';

export interface RescueSessionStore {
  save(session: RescueSession): void;
  get(rescueSessionId: string): RescueSession | null;
}

export class MemoryRescueSessionStore implements RescueSessionStore {
  private readonly sessions = new Map<string, RescueSession>();

  save(session: RescueSession): void {
    const parsed = RescueSessionSchema.parse(session);
    this.sessions.set(parsed.rescueSessionId, structuredClone(parsed));
  }

  get(rescueSessionId: string): RescueSession | null {
    const session = this.sessions.get(rescueSessionId);
    return session ? RescueSessionSchema.parse(structuredClone(session)) : null;
  }
}
