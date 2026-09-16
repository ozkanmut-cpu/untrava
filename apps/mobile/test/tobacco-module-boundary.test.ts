import { describe, expect, it } from 'vitest';
import { createRescueFoundation } from '../src/foundation';
import { createBundledRescueLibrary } from '../src/rescue/library';
import { selectIntervention } from '../src/rescue/selector';
import {
  createBundledTobaccoRescueLibrary,
  selectTobaccoIntervention,
} from '../src/tobacco/rescue';

const context = {
  userId: '11111111-1111-4111-8111-111111111111',
  deviceId: '22222222-2222-4222-8222-222222222222',
  startedAt: '2026-09-16T00:00:00.000Z',
  goalType: 'smoke_free' as const,
  goalId: '33333333-3333-4333-8333-333333333333',
  productIntent: 'cigarette' as const,
  cravingIntensity: 8,
  canMoveEnvironment: true,
  canUseAudio: true,
  canContactSupport: true,
};

describe('Tobacco mobile module boundary', () => {
  it('owns bundled Rescue composition while preserving legacy library behavior', () => {
    const tobaccoLibrary = createBundledTobaccoRescueLibrary();
    const legacyLibrary = createBundledRescueLibrary();

    expect(tobaccoLibrary).toEqual(legacyLibrary);
    expect(tobaccoLibrary.contentHash).toBe(legacyLibrary.contentHash);
  });

  it('owns Tobacco selection while preserving the legacy selector result', () => {
    const library = createBundledTobaccoRescueLibrary();

    expect(selectTobaccoIntervention(library, context)).toEqual(
      selectIntervention(library, context),
    );
  });

  it('keeps the existing Rescue foundation compatibility entry point', () => {
    expect(typeof createRescueFoundation).toBe('function');
  });
});
