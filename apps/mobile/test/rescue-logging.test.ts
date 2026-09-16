import { describe, expect, it } from 'vitest';
import { RescueOperationalLogger } from '../src/rescue/logging';

describe('RescueOperationalLogger', () => {
  it('allows only low-risk metadata and never writes sensitive Rescue contents', () => {
    const entries: unknown[] = [];
    const logger = new RescueOperationalLogger({
      info(entry) {
        entries.push(entry);
      },
      error(entry) {
        entries.push(entry);
      },
    });

    logger.info({
      fromState: 'intervention_active',
      toState: 'reassessing',
      interventionId: 'micro-regulate',
      interventionVersion: 1,
      libraryVersion: 1,
      errorCode: 'rescue.persistence_failed',
      errorClass: 'PersistenceError',
      freeText: 'SENSITIVE_FREE_TEXT_42',
      healthTreatment: 'SENSITIVE_NRT_21MG',
      contactInformation: 'SENSITIVE_CONTACT_555',
      exactLocation: { latitude: 38.123456, longitude: 26.123456 },
      eventPayload: {
        eventId: '550e8400-e29b-41d4-a716-446655440099',
        payload: { note: 'SENSITIVE_FULL_EVENT_PAYLOAD' },
      },
    });

    expect(entries).toEqual([
      {
        fromState: 'intervention_active',
        toState: 'reassessing',
        interventionId: 'micro-regulate',
        interventionVersion: 1,
        libraryVersion: 1,
        errorCode: 'rescue.persistence_failed',
        errorClass: 'PersistenceError',
      },
    ]);

    const serialized = JSON.stringify(entries);
    expect(serialized).not.toContain('SENSITIVE_FREE_TEXT_42');
    expect(serialized).not.toContain('SENSITIVE_NRT_21MG');
    expect(serialized).not.toContain('SENSITIVE_CONTACT_555');
    expect(serialized).not.toContain('38.123456');
    expect(serialized).not.toContain('26.123456');
    expect(serialized).not.toContain('SENSITIVE_FULL_EVENT_PAYLOAD');
  });

  it('drops unsafe values even when supplied through otherwise allowed keys', () => {
    const entries: unknown[] = [];
    const logger = new RescueOperationalLogger({
      info(entry) {
        entries.push(entry);
      },
      error(entry) {
        entries.push(entry);
      },
    });

    logger.error({
      fromState: 'not-a-real-state',
      interventionId: 'free text with phone +90 555 000 00 00',
      errorCode: 'email@example.com',
      errorClass: 'Error with treatment NRT 21 mg',
      libraryVersion: -1,
    });

    expect(entries).toEqual([{}]);
  });
});
