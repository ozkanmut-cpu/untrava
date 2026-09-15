import { z } from 'zod';

export const UserIdSchema = z.uuid();
export const DeviceIdSchema = z.uuid();
export const EventIdSchema = z.uuid();

export type UserId = z.infer<typeof UserIdSchema>;
export type DeviceId = z.infer<typeof DeviceIdSchema>;
export type EventId = z.infer<typeof EventIdSchema>;
