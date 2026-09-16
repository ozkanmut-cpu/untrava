import { describe, expect, it } from 'vitest';
import type { RescueContext } from '../../../packages/contracts/src/index';
import { createBundledRescueLibrary, sealRescueLibrary } from '../src/rescue/library';
import { MemoryRescueLibraryRepository } from '../src/rescue/library-repository';
import { RescueSessionCoordinator } from '../src/rescue/session';
import { selectIntervention } from '../src/rescue/selector';

const context: RescueContext = {
  userId: '550e8400-e29b-41d4-a716-446655440001',
  deviceId: '550e8400-e29b-41d4-a716-446655440002',
  startedAt: '2026-09-16T05:40:00.000Z',
  goalType: 'smoke_free',
};

function newerLibrary() {
  const bundled = createBundledRescueLibrary();
  return sealRescueLibrary({
    ...bundled,
    contentVersion: 2,
    publishedAt: '2026-09-16T06:00:00.000Z',
    interventions: bundled.interventions.map((item) =>
      item.interventionId === 'micro-regulate'
        ? { ...item, version: 2, titleKey: 'rescue.micro-regulate.v2.title' }
        : item,
    ),
  });
}

describe('MemoryRescueLibraryRepository', () => {
  it('activates a valid newer library while retaining the previous version for history', async () => {
    const bundled = createBundledRescueLibrary();
    const repository = new MemoryRescueLibraryRepository(bundled);
    const next = newerLibrary();

    await repository.installValidatedLibrary(next);

    expect((await repository.getActiveLibrary()).contentVersion).toBe(2);
    expect(await repository.getLibrary(1)).toEqual(bundled);
    expect(await repository.getLibrary(2)).toEqual(next);
  });

  it('fails closed on checksum mismatch or non-newer versions', async () => {
    const bundled = createBundledRescueLibrary();
    const repository = new MemoryRescueLibraryRepository(bundled);
    const next = newerLibrary();

    await expect(
      repository.installValidatedLibrary({ ...next, contentHash: 'fnv1a32:v1:corrupt' }),
    ).rejects.toThrow('rescue_library_integrity_error');
    expect((await repository.getActiveLibrary()).contentVersion).toBe(1);

    await expect(repository.installValidatedLibrary(bundled)).rejects.toThrow('rescue_library_not_newer');
    expect((await repository.getActiveLibrary()).contentVersion).toBe(1);
  });

  it('rejects a corrupted intervention checksum without replacing the active library', async () => {
    const bundled = createBundledRescueLibrary();
    const repository = new MemoryRescueLibraryRepository(bundled);
    const next = newerLibrary();
    const corrupted = structuredClone(next);
    corrupted.interventions[0] = { ...corrupted.interventions[0]!, contentHash: 'fnv1a32:v1:corrupt' };

    await expect(repository.installValidatedLibrary(corrupted)).rejects.toThrow('rescue_library_integrity_error');
    expect(await repository.getActiveLibrary()).toEqual(bundled);
  });

  it('does not silently move an active rescue session to a newly installed library version', async () => {
    const bundled = createBundledRescueLibrary();
    const repository = new MemoryRescueLibraryRepository(bundled);
    const selection = selectIntervention(bundled, context);
    if (!selection) throw new Error('expected bundled selection');

    const session = RescueSessionCoordinator.start({
      rescueSessionId: '550e8400-e29b-41d4-a716-446655440040',
      context,
      libraryContentVersion: bundled.contentVersion,
      now: context.startedAt,
    });
    session.stabilize('2026-09-16T05:40:01.000Z');
    session.select(selection, '2026-09-16T05:40:02.000Z');

    await repository.installValidatedLibrary(newerLibrary());

    expect((await repository.getActiveLibrary()).contentVersion).toBe(2);
    expect(session.snapshot()).toMatchObject({
      libraryContentVersion: 1,
      interventionId: selection.interventionId,
      interventionVersion: selection.version,
    });
  });
});
