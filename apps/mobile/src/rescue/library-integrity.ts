import {
  RescueLibrarySchema,
  type InterventionDefinition,
  type RescueLibrary,
} from '../../../../packages/contracts/src/index';

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, stableValue(item)]),
    );
  }
  return value;
}

function checksum(value: unknown): string {
  const serialized = JSON.stringify(stableValue(value));
  let hash = 0x811c9dc5;
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `fnv1a32:v1:${hash.toString(16).padStart(8, '0')}`;
}

function sealIntervention(intervention: InterventionDefinition): InterventionDefinition {
  const content = { ...intervention, contentHash: undefined };
  return { ...intervention, contentHash: checksum(content) };
}

export function sealRescueLibrary(candidate: RescueLibrary): RescueLibrary {
  const interventions = candidate.interventions.map(sealIntervention);
  const content = { ...candidate, interventions, contentHash: undefined };
  return RescueLibrarySchema.parse({
    ...candidate,
    interventions,
    contentHash: checksum(content),
  });
}

export function hasValidRescueLibraryIntegrity(candidate: RescueLibrary): boolean {
  const expected = sealRescueLibrary(candidate);
  if (candidate.contentHash !== expected.contentHash) return false;
  return candidate.interventions.every(
    (intervention, index) => intervention.contentHash === expected.interventions[index]?.contentHash,
  );
}
