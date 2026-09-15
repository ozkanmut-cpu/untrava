import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { IdentityService, type AnonymousIdentity, type IdentityRepository } from './service';

const CreateAnonymousIdentitySchema = z.object({ deviceId: z.uuid() });

class MemoryIdentityRepository implements IdentityRepository {
  private readonly sessions = new Map<string, { userId: string; deviceId: string; revokedAt: Date | null }>();

  async createAnonymousUser(input: { deviceId: string }): Promise<AnonymousIdentity> {
    const userId = randomUUID();
    const sessionId = randomUUID();
    this.sessions.set(sessionId, { userId, deviceId: input.deviceId, revokedAt: null });
    return { userId, sessionId, deviceId: input.deviceId };
  }

  async revokeDeviceSession(userId: string, sessionId: string, revokedAt: Date): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session || session.userId !== userId) return false;
    if (!session.revokedAt) session.revokedAt = revokedAt;
    return true;
  }
}

export async function registerIdentityRoutes(
  app: FastifyInstance,
  repository: IdentityRepository = new MemoryIdentityRepository(),
): Promise<void> {
  const service = new IdentityService(repository);

  app.post('/v1/identity/anonymous', async (request, reply) => {
    const parsed = CreateAnonymousIdentitySchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_request' });

    const identity = await service.createAnonymousUser(parsed.data.deviceId);
    return reply.code(201).send(identity);
  });
}
