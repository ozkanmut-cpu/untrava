import { describe, expect, it } from 'vitest';
import { createProductionApp } from '../src/server-app';

describe('production API composition', () => {
  it('builds with the Prisma identity repository', async () => {
    const production = await createProductionApp();

    expect(production.app).toBeDefined();
    expect(production.prisma).toBeDefined();

    await production.app.close();
    await production.prisma.$disconnect();
  });
});
