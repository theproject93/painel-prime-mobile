import { describe, it, expect } from 'vitest';
import { LUXURY_TOKENS } from '../../branding';

describe('LUXURY_TOKENS & UI Components Contract', () => {
  it('defines valid hex/rgba strings for luxury tokens', () => {
    expect(LUXURY_TOKENS.canvas).toBe('#F8F9FA');
    expect(LUXURY_TOKENS.navyPrimary).toBe('#0F172A');
    expect(LUXURY_TOKENS.goldChampagne).toBe('#D4AF37');
    expect(LUXURY_TOKENS.borderGoldSubtle).toContain('rgba');
  });
});
