import { RescueSessionStateSchema, type RescueSessionState } from '../../../../packages/contracts/src/index';

export interface RescueOperationalLogEntry {
  fromState?: RescueSessionState;
  toState?: RescueSessionState;
  interventionId?: string;
  interventionVersion?: number;
  libraryVersion?: number;
  errorCode?: string;
  errorClass?: string;
}

export interface RescueOperationalLogWriter {
  info(entry: Readonly<RescueOperationalLogEntry>): void;
  error(entry: Readonly<RescueOperationalLogEntry>): void;
}

const SAFE_TOKEN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

function safeToken(value: unknown): string | undefined {
  return typeof value === 'string' && SAFE_TOKEN.test(value) ? value : undefined;
}

function safePositiveInteger(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : undefined;
}

export function sanitizeRescueOperationalLogEntry(input: unknown): RescueOperationalLogEntry {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};

  const source = input as Record<string, unknown>;
  const entry: RescueOperationalLogEntry = {};

  const fromState = RescueSessionStateSchema.safeParse(source.fromState);
  if (fromState.success) entry.fromState = fromState.data;

  const toState = RescueSessionStateSchema.safeParse(source.toState);
  if (toState.success) entry.toState = toState.data;

  const interventionId = safeToken(source.interventionId);
  if (interventionId) entry.interventionId = interventionId;

  const interventionVersion = safePositiveInteger(source.interventionVersion);
  if (interventionVersion) entry.interventionVersion = interventionVersion;

  const libraryVersion = safePositiveInteger(source.libraryVersion);
  if (libraryVersion) entry.libraryVersion = libraryVersion;

  const errorCode = safeToken(source.errorCode);
  if (errorCode) entry.errorCode = errorCode;

  const errorClass = safeToken(source.errorClass);
  if (errorClass) entry.errorClass = errorClass;

  return entry;
}

export class RescueOperationalLogger {
  constructor(private readonly writer: RescueOperationalLogWriter) {}

  info(input: unknown): void {
    this.writer.info(sanitizeRescueOperationalLogEntry(input));
  }

  error(input: unknown): void {
    this.writer.error(sanitizeRescueOperationalLogEntry(input));
  }
}
