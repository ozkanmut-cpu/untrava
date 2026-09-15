import Fastify, { type FastifyInstance } from 'fastify';
import { registerIdentityRoutes } from './modules/identity/routes';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'request.headers.authorization',
          'request.headers.cookie',
          'req.body',
          'request.body',
        ],
        censor: '[REDACTED]',
      },
    },
  });

  app.get('/health', async () => ({ status: 'ok' as const }));
  await registerIdentityRoutes(app);

  return app;
}
