// ============================================================================
// Keyframe Evaluation Engine
// Binary-search for surrounding keyframes, normalize t, interpolate.
// ============================================================================

import BezierEasing from 'bezier-easing';
import type { AnimatableProperty, Keyframe, Vector2 } from '../types';

/** Evaluate a numeric animatable property at a given frame. */
export function evaluateNumber(
  prop: AnimatableProperty<number>,
  frame: number,
): number {
  if (prop.keyframes.length === 0) return prop.value;
  return interpolateKeyframes(prop.keyframes, frame, lerpNumber);
}

/** Evaluate a Vector2 animatable property at a given frame. */
export function evaluateVector2(
  prop: AnimatableProperty<Vector2>,
  frame: number,
): Vector2 {
  if (prop.keyframes.length === 0) return prop.value;
  return interpolateKeyframes(prop.keyframes, frame, lerpVector2);
}

// --- Generic interpolation ---------------------------------------------------

function interpolateKeyframes<T>(
  keyframes: Keyframe<T>[],
  frame: number,
  lerp: (a: T, b: T, t: number) => T,
): T {
  // Before first keyframe — hold first value
  if (frame <= keyframes[0].time) return keyframes[0].value;

  // After last keyframe — hold last value
  const last = keyframes[keyframes.length - 1];
  if (frame >= last.time) return last.value;

  // Binary search for the pair surrounding `frame`
  const idx = binarySearchRight(keyframes, frame);
  const kfA = keyframes[idx - 1];
  const kfB = keyframes[idx];

  // Hold interpolation — snap to kfA's value until kfB
  if (kfA.interpolation === 'hold') return kfA.value;

  // Normalize t in [0, 1]
  const duration = kfB.time - kfA.time;
  const rawT = duration === 0 ? 1 : (frame - kfA.time) / duration;

  // Apply easing curve
  let t: number;
  if (kfA.interpolation === 'bezier' && kfA.easing) {
    const { x1, y1, x2, y2 } = kfA.easing;
    const easingFn = BezierEasing(x1, y1, x2, y2);
    t = easingFn(rawT);
  } else {
    // linear
    t = rawT;
  }

  return lerp(kfA.value, kfB.value, t);
}

/** Find the index of the first keyframe with time > frame. */
function binarySearchRight<T>(keyframes: Keyframe<T>[], frame: number): number {
  let lo = 0;
  let hi = keyframes.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (keyframes[mid].time <= frame) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  return lo;
}

function lerpNumber(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpVector2(a: Vector2, b: Vector2, t: number): Vector2 {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  };
}
