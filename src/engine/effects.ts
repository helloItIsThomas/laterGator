// ============================================================================
// Effects Registry — Curated PixiJS filter set
// ============================================================================

import * as PIXI from 'pixi.js';
import type { EffectDef } from '../types';
import { registerEffectClampRule } from './clamp';

// --- Effect Definitions ------------------------------------------------------

export const EFFECT_DEFS: EffectDef[] = [
  {
    type: 'blur',
    name: 'Gaussian Blur',
    params: [
      { name: 'strength', defaultValue: 4, min: 0, max: 200 },
      { name: 'quality', defaultValue: 4, min: 1, max: 10 },
    ],
  },
  {
    type: 'brightness',
    name: 'Brightness',
    params: [{ name: 'amount', defaultValue: 1, min: 0, max: 5 }],
  },
  {
    type: 'contrast',
    name: 'Contrast',
    params: [{ name: 'amount', defaultValue: 1, min: 0, max: 5 }],
  },
  {
    type: 'saturate',
    name: 'Saturate',
    params: [{ name: 'amount', defaultValue: 1, min: 0, max: 5 }],
  },
  {
    type: 'hue-rotate',
    name: 'Hue Rotation',
    params: [{ name: 'rotation', defaultValue: 0, min: 0, max: 360 }],
  },
  {
    type: 'invert',
    name: 'Invert',
    params: [{ name: 'amount', defaultValue: 1, min: 0, max: 1 }],
  },
  {
    type: 'grayscale',
    name: 'Grayscale',
    params: [{ name: 'amount', defaultValue: 1, min: 0, max: 1 }],
  },
  {
    type: 'sepia',
    name: 'Sepia',
    params: [{ name: 'amount', defaultValue: 1, min: 0, max: 1 }],
  },
  {
    type: 'noise',
    name: 'Noise',
    params: [
      { name: 'amount', defaultValue: 0.5, min: 0, max: 1 },
      { name: 'seed', defaultValue: 0, min: 0, max: 100 },
    ],
  },
  {
    type: 'alpha',
    name: 'Alpha',
    params: [{ name: 'alpha', defaultValue: 1, min: 0, max: 1 }],
  },
];

// Register clamp rules for effect parameters
for (const def of EFFECT_DEFS) {
  for (const param of def.params) {
    if (param.min !== undefined || param.max !== undefined) {
      registerEffectClampRule(def.type, param.name, {
        min: param.min,
        max: param.max,
      });
    }
  }
}

// --- Filter Factory ----------------------------------------------------------

export function createPixiFilter(
  effectType: string,
  params: Record<string, number>,
): PIXI.Filter | null {
  switch (effectType) {
    case 'blur': {
      const filter = new PIXI.BlurFilter();
      filter.blur = params.strength ?? 4;
      filter.quality = params.quality ?? 4;
      return filter;
    }
    case 'brightness': {
      const filter = new PIXI.ColorMatrixFilter();
      filter.brightness(params.amount ?? 1, false);
      return filter;
    }
    case 'contrast': {
      const filter = new PIXI.ColorMatrixFilter();
      filter.contrast(params.amount ?? 1, false);
      return filter;
    }
    case 'saturate': {
      const filter = new PIXI.ColorMatrixFilter();
      filter.saturate(params.amount ?? 1, false);
      return filter;
    }
    case 'hue-rotate': {
      const filter = new PIXI.ColorMatrixFilter();
      filter.hue(params.rotation ?? 0, false);
      return filter;
    }
    case 'invert': {
      const filter = new PIXI.ColorMatrixFilter();
      filter.negative(false);
      return filter;
    }
    case 'grayscale': {
      const filter = new PIXI.ColorMatrixFilter();
      filter.greyscale(params.amount ?? 1, false);
      return filter;
    }
    case 'sepia': {
      const filter = new PIXI.ColorMatrixFilter();
      filter.sepia(false);
      return filter;
    }
    case 'noise': {
      const filter = new PIXI.NoiseFilter();
      filter.noise = params.amount ?? 0.5;
      filter.seed = params.seed ?? 0;
      return filter;
    }
    case 'alpha': {
      const filter = new PIXI.AlphaFilter(params.alpha ?? 1);
      return filter;
    }
    default:
      return null;
  }
}

export function updatePixiFilter(
  filter: PIXI.Filter,
  effectType: string,
  params: Record<string, number>,
): void {
  switch (effectType) {
    case 'blur': {
      const f = filter as PIXI.BlurFilter;
      f.blur = params.strength ?? 4;
      f.quality = params.quality ?? 4;
      break;
    }
    case 'brightness': {
      const f = filter as PIXI.ColorMatrixFilter;
      f.reset();
      f.brightness(params.amount ?? 1, false);
      break;
    }
    case 'contrast': {
      const f = filter as PIXI.ColorMatrixFilter;
      f.reset();
      f.contrast(params.amount ?? 1, false);
      break;
    }
    case 'saturate': {
      const f = filter as PIXI.ColorMatrixFilter;
      f.reset();
      f.saturate(params.amount ?? 1, false);
      break;
    }
    case 'hue-rotate': {
      const f = filter as PIXI.ColorMatrixFilter;
      f.reset();
      f.hue(params.rotation ?? 0, false);
      break;
    }
    case 'grayscale': {
      const f = filter as PIXI.ColorMatrixFilter;
      f.reset();
      f.greyscale(params.amount ?? 1, false);
      break;
    }
    case 'sepia': {
      const f = filter as PIXI.ColorMatrixFilter;
      f.reset();
      f.sepia(false);
      break;
    }
    case 'noise': {
      const f = filter as PIXI.NoiseFilter;
      f.noise = params.amount ?? 0.5;
      f.seed = params.seed ?? 0;
      break;
    }
    case 'alpha': {
      const f = filter as PIXI.AlphaFilter;
      f.alpha = params.alpha ?? 1;
      break;
    }
  }
}
