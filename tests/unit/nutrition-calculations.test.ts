import { describe, expect, it } from 'vitest';
import { energyScenarios, macroEnergy, maintenanceEstimate, restingEnergyEstimate } from '@/mvp/nutrition-calculations';

describe('orientaciones nutricionales puras', () => {
  it('aplica Mifflin–St Jeor y el PAL sin redondear internamente', () => {
    expect(restingEnergyEstimate({ weightKg: 70, heightCm: 175, age: 22, formulaSex: 'male' })).toBe(1688.75);
    expect(restingEnergyEstimate({ weightKg: 60, heightCm: 165, age: 22, formulaSex: 'female' })).toBe(1360.25);
    expect(maintenanceEstimate({ weightKg: 70, heightCm: 175, age: 22, formulaSex: 'male', pal: 1.6 })).toBe(2702);
  });
  it('calcula escenarios y energía implícita 4/4/9', () => {
    expect(energyScenarios(2000)).toEqual({ deficit5: 1900, deficit10: 1800, surplus5: 2100, surplus10: 2200 });
    expect(macroEnergy(100, 200, 50)).toBe(1650);
  });
});
