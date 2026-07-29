import type { PhotoTransform } from '@/features/foods/food-photo-processing.web';

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const MIN_SIZE = 10;

export function clampCropRect(rect: CropRect): CropRect {
  const width = clamp(rect.width, MIN_SIZE, 100);
  const height = clamp(rect.height, MIN_SIZE, 100);
  const minimumX = Math.max(0, 100 - width - 45);
  const maximumX = Math.min(45, 100 - width);
  const minimumY = Math.max(0, 100 - height - 45);
  const maximumY = Math.min(45, 100 - height);
  return {
    width,
    height,
    x: clamp(rect.x, minimumX, maximumX),
    y: clamp(rect.y, minimumY, maximumY),
  };
}

export function resizeCropRect(rect: CropRect, scale: number, centerX = rect.x + rect.width / 2, centerY = rect.y + rect.height / 2): CropRect {
  const nextWidth = clamp(rect.width * scale, MIN_SIZE, 100);
  const nextHeight = clamp(rect.height * scale, MIN_SIZE, 100);
  const relativeX = rect.width ? (centerX - rect.x) / rect.width : 0.5;
  const relativeY = rect.height ? (centerY - rect.y) / rect.height : 0.5;
  return clampCropRect({
    width: nextWidth,
    height: nextHeight,
    x: centerX - nextWidth * relativeX,
    y: centerY - nextHeight * relativeY,
  });
}

export function moveCropRect(rect: CropRect, deltaX: number, deltaY: number): CropRect {
  return clampCropRect({ ...rect, x: rect.x + deltaX, y: rect.y + deltaY });
}

export function transformToOrientedRect(transform: PhotoTransform): CropRect {
  const source = {
    top: transform.cropTop,
    right: transform.cropRight,
    bottom: transform.cropBottom,
    left: transform.cropLeft,
  };
  const oriented = transform.rotation === 90
    ? { top: source.left, right: source.top, bottom: source.right, left: source.bottom }
    : transform.rotation === 180
      ? { top: source.bottom, right: source.left, bottom: source.top, left: source.right }
      : transform.rotation === 270
        ? { top: source.right, right: source.bottom, bottom: source.left, left: source.top }
        : source;
  return clampCropRect({
    x: oriented.left,
    y: oriented.top,
    width: 100 - oriented.left - oriented.right,
    height: 100 - oriented.top - oriented.bottom,
  });
}

export function orientedRectToTransform(rectInput: CropRect, rotation: PhotoTransform['rotation']): PhotoTransform {
  const rect = clampCropRect(rectInput);
  const oriented = {
    top: rect.y,
    right: 100 - rect.x - rect.width,
    bottom: 100 - rect.y - rect.height,
    left: rect.x,
  };
  const source = rotation === 90
    ? { top: oriented.right, right: oriented.bottom, bottom: oriented.left, left: oriented.top }
    : rotation === 180
      ? { top: oriented.bottom, right: oriented.left, bottom: oriented.top, left: oriented.right }
      : rotation === 270
        ? { top: oriented.left, right: oriented.top, bottom: oriented.right, left: oriented.bottom }
        : oriented;
  return {
    rotation,
    cropTop: rounded(source.top),
    cropRight: rounded(source.right),
    cropBottom: rounded(source.bottom),
    cropLeft: rounded(source.left),
  };
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function rounded(value: number) {
  return Math.round(value * 100) / 100;
}
