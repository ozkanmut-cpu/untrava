import type { PrismaClient } from '@prisma/client';
import type { AnonymousIdentity, IdentityRepository } from './service';

export class PrismaIdentityRepository implements IdentityRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createAnonymousUser(input: { deviceId: string }): Promise<AnonymousIdentity> {
    const user = await this.prisma.user.create({
      data: {
        deviceSessions: {
          create: { deviceId: input.deviceId },
        },
      },
      include: { deviceSessions: true },
    });

    const session = user.deviceSessions[0];
    if (!session) throw new Error('identity_session_not_created');

    return { userId: user.id, sessionId: session.id, deviceId: session.deviceId };
  }

  async revokeDeviceSession(userId: string, sessionId: string, revokedAt: Date): Promise<boolean> {
    const session = await this.prisma.deviceSession.findFirst({
      where: { id: sessionId, userId },
      select: { revokedAt: true },
    });
    if (!session) return false;
    if (session.revokedAt) return true;

    await this.prisma.deviceSession.update({
      where: { id: sessionId },
      data: { revokedAt },
    });
    return true;
  }
}
