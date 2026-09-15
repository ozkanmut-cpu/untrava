import type { FastifyInstance } from 'fastify';
import { SyncBatchRequestSchema } from '@untrava/contracts';
import { z } from 'zod';
import { EventService, type EventRepository } from './event.service';

const UserHeaderSchema = z.uuid();

export async function registerEventRoutes(app: FastifyInstance, repository?: EventRepository): Promise<void> {
  if (!repository) return;
  const service = new EventService(repository);

  app.post('/v1/events/batch', async (request, reply) => {
    const userId = UserHeaderSchema.safeParse(request.headers['x-untrava-user-id']);
    const body = SyncBatchRequestSchema.safeParse(request.body);
    if (!userId.success || !body.success) return reply.code(400).send({ error: 'invalid_request' });

    try {
      return reply.code(200).send(await service.ingestBatch(userId.data, body.data.events));
    } catch (error) {
      if (error instanceof Error && /event user|target/.test(error.message)) {
        return reply.code(400).send({ error: 'invalid_event', message: error.message });
      }
      throw error;
    }
  });
}
