import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { IdentityService, type IdentityRepository } from './service';

const CreateAnonymousIdentitySchema = z.object({ deviceId: z.uuid() });
const SessionParamsSchema = z.object({ sessionId: z.uuid() });
const UserHeaderSchema = z.uuid();

export async function registerIdentityRoutes(
  app: FastifyInstance,
  repository?: IdentityRepository,
): Promise<void> {
  if (!repository) throw new Error('identity repository is required');
  const service = new IdentityService(repository);

  app.post('/v1/identity/anonymous', async (request, reply) => {
    const parsed = CreateAnonymousIdentitySchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_request' });

    const identity = await service.createAnonymousUser(parsed.data.deviceId);
    return reply.code(201).send(identity);
  });

  app.delete('/v1/device-sessions/:sessionId', async (request, reply) => {
    const params = SessionParamsSchema.safeParse(request.params);
    const userId = UserHeaderSchema.safeParse(request.headers['x-untrava-user-id']);
    if (!params.success || !userId.success) {
      return reply.code(400).send({ error: 'invalid_request' });
    }

    const result = await service.revokeDeviceSession(userId.data, params.data.sessionId);
    if (!result.revoked) return reply.code(404).send({ error: 'session_not_found' });
    return reply.code(200).send(result);
  });
}
