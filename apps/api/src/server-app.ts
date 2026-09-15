import { PrismaClient } from '@prisma/client';
import { buildApp } from './app';
import { PrismaIdentityRepository } from './modules/identity/repository';
import { PrismaConsentRepository } from './modules/consent/consent.repository';
import { PrismaEventRepository } from './modules/events/event.repository';
import { PrismaProfileRepository } from './modules/quit-profile/profile.repository';

export async function createProductionApp() {
  const prisma = new PrismaClient();
  const identityRepository = new PrismaIdentityRepository(prisma);
  const consentRepository = new PrismaConsentRepository(prisma);
  const eventRepository = new PrismaEventRepository(prisma);
  const profileRepository = new PrismaProfileRepository(prisma);
  try {
    const app = await buildApp({ identityRepository, consentRepository, eventRepository, profileRepository });
    return { app, prisma };
  } catch (error) { await prisma.$disconnect(); throw error; }
}
