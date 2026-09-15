export interface AnonymousIdentity {
  userId: string;
  sessionId: string;
  deviceId: string;
}

export interface IdentityRepository {
  createAnonymousUser(input: { deviceId: string }): Promise<AnonymousIdentity>;
  revokeDeviceSession(userId: string, sessionId: string, revokedAt: Date): Promise<boolean>;
}

export class IdentityService {
  constructor(private readonly repository: IdentityRepository) {}

  createAnonymousUser(deviceId: string): Promise<AnonymousIdentity> {
    return this.repository.createAnonymousUser({ deviceId });
  }

  async revokeDeviceSession(userId: string, sessionId: string): Promise<{ revoked: boolean }> {
    const revoked = await this.repository.revokeDeviceSession(userId, sessionId, new Date());
    return { revoked };
  }
}
