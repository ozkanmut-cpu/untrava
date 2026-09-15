import { PrismaClient } from '@prisma/client';
import { buildApp } from './app';
import { PrismaIdentityRepository } from './modules/identity/repository';

export async function createProductionApp() {
  const prisma = new PrismaClient();
  const identityRepository = new PrismaIdentityRepository(prisma);

  try {
    const app = await buildApp({ identityRepository });
    return { app, prisma };
  } catch (error) {
    await prisma.$disconnect();
    throw error;
  }
}
