import {
  RescueLibrarySchema,
  type RescueLibrary,
} from '../../../../packages/contracts/src/index';
import { hasValidRescueLibraryIntegrity } from './library';
import { findMissingRescueLocalizationKeys } from './localization';

export interface RescueLibraryRepository {
  getActiveLibrary(): Promise<RescueLibrary>;
  getLibrary(contentVersion: number): Promise<RescueLibrary | null>;
  installValidatedLibrary(candidate: RescueLibrary): Promise<void>;
}

function cloneLibrary(library: RescueLibrary): RescueLibrary {
  return RescueLibrarySchema.parse(structuredClone(library));
}

function assertLocalizationBaseline(library: RescueLibrary): void {
  if (findMissingRescueLocalizationKeys(library).length > 0) {
    throw new Error('rescue_library_localization_error');
  }
}

export class MemoryRescueLibraryRepository implements RescueLibraryRepository {
  private readonly libraries = new Map<number, RescueLibrary>();
  private activeVersion: number;

  constructor(bundled: RescueLibrary) {
    const parsed = RescueLibrarySchema.parse(bundled);
    if (!hasValidRescueLibraryIntegrity(parsed)) {
      throw new Error('rescue_library_integrity_error');
    }
    assertLocalizationBaseline(parsed);
    this.activeVersion = parsed.contentVersion;
    this.libraries.set(parsed.contentVersion, cloneLibrary(parsed));
  }

  async getActiveLibrary(): Promise<RescueLibrary> {
    const active = this.libraries.get(this.activeVersion);
    if (!active) throw new Error('rescue_library_missing');
    return cloneLibrary(active);
  }

  async getLibrary(contentVersion: number): Promise<RescueLibrary | null> {
    const library = this.libraries.get(contentVersion);
    return library ? cloneLibrary(library) : null;
  }

  async installValidatedLibrary(candidate: RescueLibrary): Promise<void> {
    let parsed: RescueLibrary;
    try {
      parsed = RescueLibrarySchema.parse(candidate);
    } catch {
      throw new Error('invalid_rescue_library');
    }

    if (!hasValidRescueLibraryIntegrity(parsed)) {
      throw new Error('rescue_library_integrity_error');
    }
    assertLocalizationBaseline(parsed);

    const active = this.libraries.get(this.activeVersion);
    if (!active) throw new Error('rescue_library_missing');
    if (parsed.contentVersion <= active.contentVersion) {
      throw new Error('rescue_library_not_newer');
    }

    this.libraries.set(parsed.contentVersion, cloneLibrary(parsed));
    this.activeVersion = parsed.contentVersion;
  }
}
