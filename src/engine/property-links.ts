// ============================================================================
// Property Link System — DAG Construction, Topological Sort, Evaluation
// ============================================================================

import type { Composition, Layer, PropertyLink, SimpleLinkV1 } from '../types';
import { evaluateNumber, evaluateVector2 } from './keyframe';

// --- Types -------------------------------------------------------------------

export interface EvaluationContext {
  currentFrame: number;
  compositionFps: number;
  compositionDuration: number;
  getPropertyValue(
    layerId: string,
    propertyPath: string,
    frame: number,
  ): number | number[];
}

interface LinkEvaluator {
  evaluate(link: PropertyLink, ctx: EvaluationContext): number | number[];
}

interface DAGNode {
  layerId: string;
  propertyPath: string;
  link: PropertyLink;
}

// --- DAG Construction & Topological Sort -------------------------------------

export interface ResolvedDAG {
  order: DAGNode[];
  hasCycles: boolean;
}

export function buildDAG(composition: Composition): ResolvedDAG {
  const nodes: DAGNode[] = [];
  const nodeKey = (layerId: string, prop: string) => `${layerId}:${prop}`;

  // Collect all nodes
  for (const layer of composition.layers) {
    for (const [propPath, link] of Object.entries(layer.propertyLinks)) {
      nodes.push({ layerId: layer.id, propertyPath: propPath, link });
    }
  }

  if (nodes.length === 0) return { order: [], hasCycles: false };

  // Build adjacency: if node B depends on source from node A's output, A -> B
  const keyToNode = new Map<string, DAGNode>();
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const node of nodes) {
    const key = nodeKey(node.layerId, node.propertyPath);
    keyToNode.set(key, node);
    inDegree.set(key, 0);
    adjacency.set(key, []);
  }

  for (const node of nodes) {
    const key = nodeKey(node.layerId, node.propertyPath);
    if (node.link.type === 'simple') {
      const depKey = nodeKey(node.link.sourceLayer, node.link.sourceProperty);
      if (keyToNode.has(depKey)) {
        adjacency.get(depKey)!.push(key);
        inDegree.set(key, (inDegree.get(key) ?? 0) + 1);
      }
    }
  }

  // Kahn's algorithm
  const queue: string[] = [];
  for (const [key, deg] of inDegree) {
    if (deg === 0) queue.push(key);
  }

  const sorted: DAGNode[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    sorted.push(keyToNode.get(current)!);
    for (const neighbor of adjacency.get(current) ?? []) {
      const newDeg = (inDegree.get(neighbor) ?? 1) - 1;
      inDegree.set(neighbor, newDeg);
      if (newDeg === 0) queue.push(neighbor);
    }
  }

  const hasCycles = sorted.length < nodes.length;
  return { order: sorted, hasCycles };
}

// --- Link Evaluation ---------------------------------------------------------

const simpleLinkEvaluator: LinkEvaluator = {
  evaluate(link: PropertyLink, ctx: EvaluationContext): number | number[] {
    const simple = link as SimpleLinkV1;
    const requestedFrame = ctx.currentFrame - simple.delay;
    const clampedFrame = Math.max(0, requestedFrame);
    let value = ctx.getPropertyValue(
      simple.sourceLayer,
      simple.sourceProperty,
      clampedFrame,
    );

    // Apply multiplier + offset
    if (typeof value === 'number') {
      value = value * simple.multiplier + simple.offset;
      value = applyBehavior(value, simple, ctx);
    } else {
      value = value.map((v) => {
        let result = v * simple.multiplier + simple.offset;
        return result;
      });
    }

    return value;
  },
};

function applyBehavior(
  value: number,
  link: SimpleLinkV1,
  ctx: EvaluationContext,
): number {
  if (!link.behavior || link.behavior === 'direct') return value;

  switch (link.behavior) {
    case 'wiggle': {
      // Simple noise-based wiggle using a deterministic seed
      const seed = ctx.currentFrame * 0.1;
      const noise = Math.sin(seed * 12.9898 + seed * 78.233) * 43758.5453;
      const wiggleAmount = (noise - Math.floor(noise)) * 2 - 1; // [-1, 1]
      return value + wiggleAmount * link.multiplier;
    }
    case 'loop-cycle': {
      const duration = ctx.compositionDuration;
      if (duration <= 0) return value;
      const loopedFrame = ctx.currentFrame % duration;
      return value; // The looped frame would need source re-evaluation
    }
    case 'loop-pingpong': {
      const duration = ctx.compositionDuration;
      if (duration <= 0) return value;
      const cycle = Math.floor(ctx.currentFrame / duration);
      return cycle % 2 === 0 ? value : -value + 2 * link.offset;
    }
    default:
      return value;
  }
}

// --- Resolve All Links for a Frame -------------------------------------------

export interface ResolvedValues {
  [layerIdAndProp: string]: number | number[];
}

export function resolveLinks(
  dag: ResolvedDAG,
  composition: Composition,
  frame: number,
): ResolvedValues {
  const resolved: ResolvedValues = {};
  const layerMap = new Map(composition.layers.map((l) => [l.id, l]));

  const ctx: EvaluationContext = {
    currentFrame: frame,
    compositionFps: composition.frameRate,
    compositionDuration: composition.duration,
    getPropertyValue(layerId, propertyPath, atFrame) {
      // Check if there's already a resolved link value
      const key = `${layerId}:${propertyPath}`;
      if (key in resolved) return resolved[key];

      // Otherwise evaluate from keyframes
      const layer = layerMap.get(layerId);
      if (!layer) return 0;
      return evaluatePropertyFromLayer(layer, propertyPath, atFrame);
    },
  };

  for (const node of dag.order) {
    const key = `${node.layerId}:${node.propertyPath}`;
    if (node.link.type === 'simple') {
      resolved[key] = simpleLinkEvaluator.evaluate(node.link, ctx);
    }
  }

  return resolved;
}

function evaluatePropertyFromLayer(
  layer: Layer,
  propertyPath: string,
  frame: number,
): number | number[] {
  switch (propertyPath) {
    case 'transform.position':
      const pos = evaluateVector2(layer.transform.position, frame);
      return [pos.x, pos.y];
    case 'transform.scale':
      const sc = evaluateVector2(layer.transform.scale, frame);
      return [sc.x, sc.y];
    case 'transform.anchorPoint':
      const ap = evaluateVector2(layer.transform.anchorPoint, frame);
      return [ap.x, ap.y];
    case 'transform.rotation':
      return evaluateNumber(layer.transform.rotation, frame);
    case 'transform.opacity':
      return evaluateNumber(layer.transform.opacity, frame);
    default: {
      // Effect parameter: "effects.{effectId}.{paramName}"
      const parts = propertyPath.split('.');
      if (parts[0] === 'effects' && parts.length === 3) {
        const effect = layer.effects.find((e) => e.id === parts[1]);
        if (effect && effect.params[parts[2]]) {
          return evaluateNumber(effect.params[parts[2]], frame);
        }
      }
      return 0;
    }
  }
}
