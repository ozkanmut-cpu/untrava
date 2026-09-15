import { Prisma, type PrismaClient } from '@prisma/client';
import { QuitEventEnvelopeSchema, type QuitEventEnvelope } from '@untrava/contracts';
import type { EventAppendStatus, EventRepository } from './event.service';

export class PrismaEventRepository implements EventRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async append(event: QuitEventEnvelope): Promise<EventAppendStatus> {
    const existing = await this.prisma.quitEvent.findUnique({ where: { eventId: event.eventId }, select: { eventId: true } });
    if (existing) return 'duplicate';
    try {
      await this.prisma.quitEvent.create({
        data: {
          eventId: event.eventId, userId: event.userId, deviceId: event.deviceId,
          eventType: event.eventType, occurredAt: new Date(event.occurredAt), recordedAt: new Date(event.recordedAt),
          schemaVersion: event.schemaVersion, payload: event.payload as Prisma.InputJsonValue,
        },
      });
      return 'accepted';
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return 'duplicate';
      throw error;
    }
  }

  async findByEventId(eventId: string): Promise<QuitEventEnvelope | null> {
    const row = await this.prisma.quitEvent.findUnique({ where: { eventId } });
    if (!row) return null;
    return QuitEventEnvelopeSchema.parse({
      eventId: row.eventId, userId: row.userId, deviceId: row.deviceId, eventType: row.eventType,
      occurredAt: row.occurredAt.toISOString(), recordedAt: row.recordedAt.toISOString(),
      schemaVersion: row.schemaVersion, payload: row.payload,
    });
  }
}
