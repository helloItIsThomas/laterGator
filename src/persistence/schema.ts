// ============================================================================
// Zod Schemas — Project file validation & versioning
// ============================================================================

import { z } from 'zod';

const Vector2Schema = z.object({
  x: z.number(),
  y: z.number(),
});

const BezierControlPointsSchema = z.object({
  x1: z.number(),
  y1: z.number(),
  x2: z.number(),
  y2: z.number(),
});

const KeyframeSchema = z.object({
  id: z.string(),
  time: z.number(),
  value: z.any(),
  interpolation: z.enum(['linear', 'hold', 'bezier']),
  easing: BezierControlPointsSchema.nullable(),
});

const AnimatablePropertySchema = z.object({
  value: z.any(),
  keyframes: z.array(KeyframeSchema),
});

const SimpleLinkSchema = z.object({
  type: z.literal('simple'),
  sourceLayer: z.string(),
  sourceProperty: z.string(),
  offset: z.number(),
  multiplier: z.number(),
  delay: z.number(),
  behavior: z.enum(['direct', 'wiggle', 'loop-cycle', 'loop-pingpong']).nullable(),
});

const ExpressionLinkSchema = z.object({
  type: z.literal('expression'),
  expression: z.string(),
  dependencies: z.array(z.string()),
});

const PropertyLinkSchema = z.discriminatedUnion('type', [
  SimpleLinkSchema,
  ExpressionLinkSchema,
]);

const EffectSchema = z.object({
  id: z.string(),
  type: z.string(),
  enabled: z.boolean(),
  order: z.number(),
  params: z.record(AnimatablePropertySchema),
});

const TransformSchema = z.object({
  anchorPoint: AnimatablePropertySchema,
  position: AnimatablePropertySchema,
  scale: AnimatablePropertySchema,
  rotation: AnimatablePropertySchema,
  opacity: AnimatablePropertySchema,
});

const LayerSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['solid', 'media', 'precomp', 'adjustment', 'null']),
  source: z.string().nullable(),
  solidColor: z.string().nullable(),
  solidShape: z.enum(['rectangle', 'circle', 'ellipse', 'rounded-rect', 'triangle']).default('rectangle'),
  solidWidth: z.number().nullable().default(null),
  solidHeight: z.number().nullable().default(null),
  solidCornerRadius: z.number().default(0),
  inPoint: z.number(),
  outPoint: z.number(),
  startTime: z.number(),
  enabled: z.boolean(),
  solo: z.boolean(),
  locked: z.boolean(),
  shy: z.boolean(),
  blendingMode: z.string(),
  transform: TransformSchema,
  effects: z.array(EffectSchema),
  parentLayer: z.string().nullable(),
  propertyLinks: z.record(PropertyLinkSchema),
  color: z.string(),
});

const CompositionSchema = z.object({
  id: z.string(),
  name: z.string(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  frameRate: z.number().positive(),
  duration: z.number().int().positive(),
  backgroundColor: z.string(),
  layers: z.array(LayerSchema),
});

const AssetSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['image', 'video']),
  url: z.string(),
  width: z.number(),
  height: z.number(),
  duration: z.number().optional(),
});

const ProjectSettingsSchema = z.object({
  fps: z.number().positive(),
  defaultDuration: z.number().int().positive(),
  colorDepth: z.union([z.literal(8), z.literal(16)]),
});

export const ProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  version: z.number().int(),
  settings: ProjectSettingsSchema,
  assets: z.array(AssetSchema),
  compositions: z.array(CompositionSchema),
});

export type ProjectData = z.infer<typeof ProjectSchema>;

// --- Migrations --------------------------------------------------------------

export function migrateProject(data: unknown): ProjectData {
  // V1 is the initial version — no migrations needed yet.
  // Future versions add migration steps here.
  const parsed = ProjectSchema.parse(data);
  return parsed;
}
