import { describe, expect, it } from 'vitest';
import { ConsentActionSchema, ConsentCategorySchema } from '../src/index';

describe('consent ledger contracts', () => {
  it('defines explicit grant and revoke actions', () => {
    expect(ConsentActionSchema.parse('grant')).toBe('grant');
    expect(ConsentActionSchema.parse('revoke')).toBe('revoke');
  });

  it('defines foundation consent categories', () => {
    expect(ConsentCategorySchema.parse('cessation_data_processing')).toBe(
      'cessation_data_processing',
    );
    expect(ConsentCategorySchema.parse('support_circle_sharing')).toBe('support_circle_sharing');
    expect(ConsentCategorySchema.parse('health_data_processing')).toBe('health_data_processing');
  });
});
