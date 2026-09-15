import { describe, expect, it } from 'vitest';
import * as contracts from '../src/index';

describe('@untrava/contracts', () => {
  it('loads as a workspace package', () => {
    expect(contracts).toBeDefined();
  });
});
