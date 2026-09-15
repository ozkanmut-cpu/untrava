import type { FastifyInstance } from 'fastify';
import { GoalSchema, QuitProfileSchema } from '@untrava/contracts';
import { z } from 'zod';
import { ProfileService, type ProfileRepository } from './profile.service';

const UserHeaderSchema = z.uuid();
const GoalParamsSchema = z.object({ goalId: z.uuid() });
const EndGoalBodySchema = z.object({ endsAt: z.iso.datetime() });

export async function registerProfileRoutes(app: FastifyInstance, repository?: ProfileRepository): Promise<void> {
  if (!repository) return;
  const service = new ProfileService(repository);

  app.put('/v1/quit-profile', async (request, reply) => {
    const userId = UserHeaderSchema.safeParse(request.headers['x-untrava-user-id']);
    const body = QuitProfileSchema.safeParse(request.body);
    if (!userId.success || !body.success || body.data.userId !== userId.data) return reply.code(400).send({ error: 'invalid_request' });
    return reply.code(200).send(await service.createProfile(body.data));
  });

  app.post('/v1/goals', async (request, reply) => {
    const userId = UserHeaderSchema.safeParse(request.headers['x-untrava-user-id']);
    const body = GoalSchema.safeParse(request.body);
    if (!userId.success || !body.success || body.data.userId !== userId.data) return reply.code(400).send({ error: 'invalid_request' });
    return reply.code(201).send(await service.startGoal(body.data));
  });

  app.post('/v1/goals/:goalId/end', async (request, reply) => {
    const userId = UserHeaderSchema.safeParse(request.headers['x-untrava-user-id']);
    const params = GoalParamsSchema.safeParse(request.params);
    const body = EndGoalBodySchema.safeParse(request.body);
    if (!userId.success || !params.success || !body.success) return reply.code(400).send({ error: 'invalid_request' });
    const goal = await service.endGoal(userId.data, params.data.goalId, body.data.endsAt);
    if (!goal) return reply.code(404).send({ error: 'goal_not_found' });
    return reply.code(200).send(goal);
  });
}
