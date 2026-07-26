import { describe, expect, it } from 'vitest';

import {
  calendarMonth,
  goalEffectiveMonday,
  mondayOfLocalWeek,
  moveMonth,
} from '@/mvp/training-date';

describe('fechas locales de entrenamiento', () => {
  it('resuelve lunes actual y siguiente sin depender del huso del proceso', () => {
    expect(mondayOfLocalWeek('2026-07-26')).toBe('2026-07-20');
    expect(goalEffectiveMonday('2026-07-26', 'current')).toBe('2026-07-20');
    expect(goalEffectiveMonday('2026-07-26', 'next')).toBe('2026-07-27');
    expect(mondayOfLocalWeek('2027-01-01')).toBe('2026-12-28');
  });

  it('crea calendarios completos de lunes a domingo y mueve mes/año', () => {
    const july = calendarMonth('2026-07');
    expect(july).toHaveLength(42);
    expect(july[0]?.localDate).toBe('2026-06-29');
    expect(july.at(-1)?.localDate).toBe('2026-08-09');
    expect(moveMonth('2026-12', 1)).toBe('2027-01');
    expect(moveMonth('2026-01', -1)).toBe('2025-12');
  });
});
