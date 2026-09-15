import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ConsentActionSchema, ConsentCategorySchema } from '@untrava/contracts';
import { ConsentService, type ConsentRepository } from './consent.service';

const UserHeaderSchema = z.uuid();
const ConsentBodySchema = z.object({
  recipientId: z.uuid().nullable().optional(),
  category: ConsentCategorySchema,
  purpose: z.string().min(1),
  action: ConsentActionSchema,
  version: z.number().int().positive(),
});
const EffectiveQuerySchema = z.object({
  category: ConsentCategorySchema,
  recipientId: z.uuid().optional(),
});

export async function registerConsentRoutes(
  app: FastifyInstance,
  repository?: ConsentRepository,
): Promise<void> {
  if (!repository) return;
  const service = new ConsentService(repository);

  app.post('/v1/consents', async (request, reply) => {
    const userId = UserHeaderSchema.safeParse(request.headers['x-untrava-user-id']);
    const body = ConsentBodySchema.safeParse(request.body);
    if (!userId.success || !body.success) return reply.code(400).send({ error: 'invalid_request' });

    const entry = await service.record({ userId: userId.data, ...body.data });
    return reply.code(201).send(entry);
  });

  app.get('/v1/consents/effective', async (request, reply) => {
    const userId = UserHeaderSchema.safeParse(request.headers['x-untrava-user-id']);
    const query = EffectiveQuerySchema.safeParse(request.query);
    if (!userId.success || !query.success) return reply.code(400).send({ error: 'invalid_request' });

    const action = await service.getEffective(userId.data, query.data.category, query.data.recipientId);
    return reply.code(200).send({ action });
  });
}
