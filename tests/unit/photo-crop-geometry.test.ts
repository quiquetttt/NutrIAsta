import { describe, expect, it } from 'vitest';

import {
  moveCropRect,
  orientedRectToTransform,
  resizeCropRect,
  transformToOrientedRect,
} from '@/features/foods/photo-crop-geometry';

describe('geometría del recorte táctil', () => {
  it('conserva el mismo recorte al convertir entre orientación y coordenadas fuente', () => {
    for (const rotation of [0, 90, 180, 270] as const) {
      const original = { rotation, cropTop: 12, cropRight: 18, cropBottom: 21, cropLeft: 9 };
      expect(orientedRectToTransform(transformToOrientedRect(original), rotation)).toEqual(original);
    }
  });

  it('separa dos dedos para acercar sin permitir que desaparezca el área conservada', () => {
    const original = { x: 10, y: 10, width: 80, height: 80 };
    expect(resizeCropRect(original, 0.5)).toEqual({ x: 30, y: 30, width: 40, height: 40 });
    expect(resizeCropRect(original, 0.01)).toEqual({ x: 45, y: 45, width: 10, height: 10 });
  });

  it('limita el movimiento para mantener como máximo un 45 % recortado por lado', () => {
    expect(moveCropRect({ x: 20, y: 20, width: 40, height: 40 }, 100, 100)).toEqual({
      x: 45,
      y: 45,
      width: 40,
      height: 40,
    });
  });
});
