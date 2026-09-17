import { describe, expect, it } from 'vitest';
import {
  hasValidInterventionLibraryIntegrity,
  sealInterventionLibrary,
} from '../src/rescue/library-integrity';

const genericLibrary = () => ({
  moduleId: 'alcohol',
  libraryId: 'alcohol-rescue',
  schemaVersion: 1 as const,
  contentVersion: 1,
  publishedAt: '2026-09-17T00:00:00.000Z',
  interventions: [
    {
      interventionId: 'alcohol-micro-regulate',
      version: 1,
      contentHash: '',
    },
  ],
  contentHash: '',
});

describe('generic intervention library integrity', () => {
  it('seals and validates a domain-neutral intervention library', () => {
    const sealed = sealInterventionLibrary(genericLibrary());

    expect(sealed.contentHash).toMatch(/^fnv1a32:v1:[0-9a-f]{8}$/);
    expect(sealed.interventions[0]?.contentHash).toMatch(/^fnv1a32:v1:[0-9a-f]{8}$/);
    expect(hasValidInterventionLibraryIntegrity(sealed)).toBe(true);
  });

  it('detects tampering in intervention content', () => {
    const sealed = sealInterventionLibrary(genericLibrary());
    const tampered = {
      ...sealed,
      interventions: [{ ...sealed.interventions[0]!, interventionId: 'tampered' }],
    };

    expect(hasValidInterventionLibraryIntegrity(tampered)).toBe(false);
  });
});
