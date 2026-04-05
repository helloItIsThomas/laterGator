// ============================================================================
// LaterGator — Core Data Model
// ============================================================================

export interface Vector2 {
  x: number;
  y: number;
}

// --- Keyframes & Animation ---------------------------------------------------

export interface BezierControlPoints {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface SpringParams {
  stiffness: number;
  damping: number;
  mass: number;
}

export interface Keyframe<T> {
  id: string;
  time: number; // frame
  value: T;
  interpolation: 'linear' | 'hold' | 'bezier';
  easing: BezierControlPoints | null;
}

export interface AnimatableProperty<T> {
  value: T; // static value when no keyframes
  keyframes: Keyframe<T>[];
}

// --- Property Links ----------------------------------------------------------

export type PropertyLink = SimpleLinkV1 | ExpressionLinkV2;

export interface SimpleLinkV1 {
  type: 'simple';
  sourceLayer: string;
  sourceProperty: string;
  offset: number;
  multiplier: number;
  delay: number; // frames
  behavior: 'direct' | 'wiggle' | 'loop-cycle' | 'loop-pingpong' | null;
}

export interface ExpressionLinkV2 {
  type: 'expression';
  expression: string;
  dependencies: string[];
}

// --- Effects -----------------------------------------------------------------

export interface EffectParamDef {
  name: string;
  defaultValue: number;
  min?: number;
  max?: number;
}

export interface EffectDef {
  type: string;
  name: string;
  params: EffectParamDef[];
}

export interface Effect {
  id: string;
  type: string;
  enabled: boolean;
  order: number;
  params: Record<string, AnimatableProperty<number>>;
}

// --- Transform ---------------------------------------------------------------

export interface Transform {
  anchorPoint: AnimatableProperty<Vector2>;
  position: AnimatableProperty<Vector2>;
  scale: AnimatableProperty<Vector2>;
  rotation: AnimatableProperty<number>;
  opacity: AnimatableProperty<number>;
}

// --- Blending ----------------------------------------------------------------

export type BlendingMode =
  | 'normal'
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'darken'
  | 'lighten'
  | 'color-dodge'
  | 'color-burn'
  | 'hard-light'
  | 'soft-light'
  | 'difference'
  | 'exclusion';

// --- Shapes ------------------------------------------------------------------

export type SolidShape = 'rectangle' | 'circle' | 'ellipse' | 'rounded-rect' | 'triangle';

// --- Layers ------------------------------------------------------------------

export type LayerType = 'solid' | 'media' | 'precomp' | 'adjustment' | 'null';

export interface Layer {
  id: string;
  name: string;
  type: LayerType;
  source: string | null; // asset ID or composition ID
  solidColor: string | null; // for solid layers
  solidShape: SolidShape; // shape type for solid layers
  solidWidth: number | null; // shape width (null = comp width)
  solidHeight: number | null; // shape height (null = comp height)
  solidCornerRadius: number; // for rounded-rect
  inPoint: number; // frames
  outPoint: number; // frames
  startTime: number; // frames
  enabled: boolean;
  solo: boolean;
  locked: boolean;
  shy: boolean;
  blendingMode: BlendingMode;
  transform: Transform;
  effects: Effect[];
  parentLayer: string | null; // layer ID
  propertyLinks: Record<string, PropertyLink>;
  color: string; // label color
}

// --- Composition -------------------------------------------------------------

export interface Composition {
  id: string;
  name: string;
  width: number;
  height: number;
  frameRate: number;
  duration: number; // frames
  backgroundColor: string;
  layers: Layer[];
}

// --- Assets ------------------------------------------------------------------

export interface Asset {
  id: string;
  name: string;
  type: 'image' | 'video';
  url: string;
  width: number;
  height: number;
  duration?: number;
}

// --- Project -----------------------------------------------------------------

export interface ProjectSettings {
  fps: number;
  defaultDuration: number; // frames
  colorDepth: 8 | 16;
}

export interface Project {
  id: string;
  name: string;
  version: number;
  settings: ProjectSettings;
  assets: Asset[];
  compositions: Composition[];
}

// --- Helpers -----------------------------------------------------------------

export const LABEL_COLORS = [
  '#FF6B6B', // red
  '#FFA94D', // orange
  '#FFD43B', // yellow
  '#69DB7C', // green
  '#4DABF7', // blue
  '#9775FA', // purple
  '#F783AC', // pink
  '#868E96', // gray
] as const;

export function createDefaultTransform(): Transform {
  return {
    anchorPoint: { value: { x: 0, y: 0 }, keyframes: [] },
    position: { value: { x: 0, y: 0 }, keyframes: [] },
    scale: { value: { x: 100, y: 100 }, keyframes: [] },
    rotation: { value: 0, keyframes: [] },
    opacity: { value: 1, keyframes: [] },
  };
}

export function createDefaultProjectSettings(): ProjectSettings {
  return {
    fps: 30,
    defaultDuration: 150, // 5 seconds at 30fps
    colorDepth: 8,
  };
}
