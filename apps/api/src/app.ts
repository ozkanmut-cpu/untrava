import Fastify, { type FastifyInstance } from 'fastify';
import { registerIdentityRoutes } from './modules/identity/routes';
import type { IdentityRepository } from './modules/identity/service';
import { registerConsentRoutes } from './modules/consent/consent.routes';
import type { ConsentRepository } from './modules/consent/consent.service';
import { registerEventRoutes } from './modules/events/event.routes';
import type { EventRepository } from './modules/events/event.service';

export interface BuildAppOptions {
  identityRepository?: IdentityRepository;
  consentRepository?: ConsentRepository;
  eventRepository?: EventRepository;
}

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      redact: {
        paths: [
          'req.headers.authorization', 'req.headers.cookie', 'request.headers.authorization',
          'request.headers.cookie', 'req.body', 'request.body',
        ],
        censor: '[REDACTED]',
      },
    },
  });

  app.get('/health', async () => ({ status: 'ok' as const }));
  await registerIdentityRoutes(app, options.identityRepository);
  await registerConsentRoutes(app, options.consentRepository);
  await registerEventRoutes(app, options.eventRepository);
  return app;
}
