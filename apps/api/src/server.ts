import { createProductionApp } from './server-app';
import { env } from './lib/env';

const { app, prisma } = await createProductionApp();

try {
  await app.listen({ host: env.HOST, port: env.PORT });
} catch (error) {
  app.log.error(error);
  await prisma.$disconnect();
  process.exit(1);
}
