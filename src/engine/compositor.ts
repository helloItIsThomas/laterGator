// ============================================================================
// Compositing Pipeline — Per-frame rendering orchestration
// ============================================================================

import * as PIXI from 'pixi.js';
import type {
  Composition,
  Layer,
  BlendingMode,
  Vector2,
  SolidShape,
} from '../types';
import { evaluateNumber, evaluateVector2 } from './keyframe';
import { clampPropertyValue } from './clamp';
import { buildDAG, resolveLinks, type ResolvedValues } from './property-links';
import { createPixiFilter, updatePixiFilter } from './effects';

// --- Blend Mode Mapping ------------------------------------------------------

const BLEND_MODE_MAP: Record<BlendingMode, PIXI.BLEND_MODES> = {
  normal: PIXI.BLEND_MODES.NORMAL,
  multiply: PIXI.BLEND_MODES.MULTIPLY,
  screen: PIXI.BLEND_MODES.SCREEN,
  overlay: PIXI.BLEND_MODES.OVERLAY,
  darken: PIXI.BLEND_MODES.DARKEN,
  lighten: PIXI.BLEND_MODES.LIGHTEN,
  'color-dodge': PIXI.BLEND_MODES.COLOR_DODGE,
  'color-burn': PIXI.BLEND_MODES.COLOR_BURN,
  'hard-light': PIXI.BLEND_MODES.HARD_LIGHT,
  'soft-light': PIXI.BLEND_MODES.SOFT_LIGHT,
  difference: PIXI.BLEND_MODES.DIFFERENCE,
  exclusion: PIXI.BLEND_MODES.EXCLUSION,
};

// --- Scene Management --------------------------------------------------------

interface LayerScene {
  container: PIXI.Container;
  graphic: PIXI.Graphics | PIXI.Sprite;
  filters: Map<string, PIXI.Filter>;
}

export class Compositor {
  private app: PIXI.Application;
  private compositionContainer: PIXI.Container;
  private layerScenes = new Map<string, LayerScene>();
  private precompTextures = new Map<string, PIXI.RenderTexture>();
  private assetTextures = new Map<string, PIXI.Texture>();
  private allCompositions = new Map<string, Composition>();
  private layerTypes = new Map<string, Layer['type']>();

  constructor(app: PIXI.Application) {
    this.app = app;
    this.compositionContainer = new PIXI.Container();
    this.app.stage.addChild(this.compositionContainer);
  }

  setCompositions(compositions: Composition[]): void {
    this.allCompositions.clear();
    for (const comp of compositions) {
      this.allCompositions.set(comp.id, comp);
    }
  }

  /** Render a composition at the given frame. */
  renderFrame(composition: Composition, frame: number): void {
    // 1. Resolve property link DAG
    const dag = buildDAG(composition);
    const linkOverrides = resolveLinks(dag, composition, frame);

    // 2. Determine which layers are visible
    const visibleLayers = getVisibleLayers(composition.layers, frame);

    // 3. Clean up scenes for layers no longer present
    const visibleIds = new Set(visibleLayers.map((l) => l.id));
    for (const [id, scene] of this.layerScenes) {
      if (!visibleIds.has(id)) {
        this.compositionContainer.removeChild(scene.container);
        scene.container.destroy({ children: true });
        this.layerScenes.delete(id);
      }
    }

    // 4. Build parent chain lookup
    const layerMap = new Map(composition.layers.map((l) => [l.id, l]));

    // 5. Render each layer (bottom-to-top = array order)
    for (let i = 0; i < visibleLayers.length; i++) {
      const layer = visibleLayers[i];
      const scene = this.ensureLayerScene(layer, composition);
      this.layerTypes.set(layer.id, layer.type);

      // Evaluate properties
      const pos = getResolvedVector2(
        linkOverrides,
        layer,
        'transform.position',
        frame,
        () => evaluateVector2(layer.transform.position, frame),
      );
      const scale = getResolvedVector2(
        linkOverrides,
        layer,
        'transform.scale',
        frame,
        () => evaluateVector2(layer.transform.scale, frame),
      );
      const anchor = getResolvedVector2(
        linkOverrides,
        layer,
        'transform.anchorPoint',
        frame,
        () => evaluateVector2(layer.transform.anchorPoint, frame),
      );
      const rotation = getResolvedNumber(
        linkOverrides,
        layer,
        'transform.rotation',
        frame,
        () => evaluateNumber(layer.transform.rotation, frame),
      );
      const opacity = clampPropertyValue(
        'transform.opacity',
        getResolvedNumber(
          linkOverrides,
          layer,
          'transform.opacity',
          frame,
          () => evaluateNumber(layer.transform.opacity, frame),
        ),
      );

      // Apply parent transform chain
      let parentOffsetX = 0;
      let parentOffsetY = 0;
      let parentRotation = 0;
      let parentScaleX = 1;
      let parentScaleY = 1;
      if (layer.parentLayer) {
        const result = resolveParentChain(
          layer.parentLayer,
          layerMap,
          frame,
          linkOverrides,
        );
        parentOffsetX = result.x;
        parentOffsetY = result.y;
        parentRotation = result.rotation;
        parentScaleX = result.scaleX;
        parentScaleY = result.scaleY;
      }

      // Set transform on container
      scene.container.position.set(
        pos.x + parentOffsetX,
        pos.y + parentOffsetY,
      );
      scene.container.scale.set(
        (scale.x / 100) * parentScaleX,
        (scale.y / 100) * parentScaleY,
      );
      scene.container.rotation =
        ((rotation + parentRotation) * Math.PI) / 180;
      scene.container.pivot.set(anchor.x, anchor.y);
      scene.container.alpha = opacity;
      // blendMode is on the graphic child, not the container
      if (scene.graphic instanceof PIXI.Graphics || scene.graphic instanceof PIXI.Sprite) {
        scene.graphic.blendMode = BLEND_MODE_MAP[layer.blendingMode] ?? PIXI.BLEND_MODES.NORMAL;
      }

      // Update effects (filters)
      this.updateLayerEffects(layer, scene, frame, linkOverrides);

      // Ensure correct z-order
      this.compositionContainer.setChildIndex(scene.container, i);
    }
  }

  private ensureLayerScene(
    layer: Layer,
    composition: Composition,
  ): LayerScene {
    let scene = this.layerScenes.get(layer.id);
    if (scene) return scene;

    const container = new PIXI.Container();
    let graphic: PIXI.Graphics | PIXI.Sprite;

    switch (layer.type) {
      case 'solid': {
        const g = new PIXI.Graphics();
        drawSolidShape(g, layer, composition);
        graphic = g;
        break;
      }
      case 'precomp': {
        const precompId = layer.source;
        if (precompId && this.allCompositions.has(precompId)) {
          const precomp = this.allCompositions.get(precompId)!;
          let rt = this.precompTextures.get(precompId);
          if (!rt) {
            rt = PIXI.RenderTexture.create({
              width: precomp.width,
              height: precomp.height,
            });
            this.precompTextures.set(precompId, rt);
          }
          graphic = new PIXI.Sprite(rt);
        } else {
          const g = new PIXI.Graphics();
          g.beginFill('#9775FA', 0.3);
          g.drawRect(0, 0, composition.width, composition.height);
          g.endFill();
          graphic = g;
        }
        break;
      }
      case 'adjustment': {
        const g = new PIXI.Graphics();
        g.beginFill(0x000000, 0);
        g.drawRect(0, 0, composition.width, composition.height);
        g.endFill();
        graphic = g;
        break;
      }
      case 'null': {
        const g = new PIXI.Graphics();
        graphic = g;
        break;
      }
      case 'media': {
        const assetUrl = layer.source;
        if (assetUrl && this.assetTextures.has(assetUrl)) {
          graphic = new PIXI.Sprite(this.assetTextures.get(assetUrl)!);
        } else if (assetUrl) {
          // Load the texture async, use placeholder until loaded
          const g = new PIXI.Graphics();
          g.beginFill('#4DABF7', 0.3);
          g.drawRect(0, 0, 200, 200);
          g.endFill();
          graphic = g;
          PIXI.Texture.fromURL(assetUrl).then((tex) => {
            this.assetTextures.set(assetUrl, tex);
            // Replace the placeholder with the actual sprite
            const existingScene = this.layerScenes.get(layer.id);
            if (existingScene) {
              existingScene.container.removeChild(existingScene.graphic);
              const sprite = new PIXI.Sprite(tex);
              existingScene.graphic = sprite;
              existingScene.container.addChildAt(sprite, 0);
            }
          }).catch(() => {
            // Leave the placeholder
          });
        } else {
          const g = new PIXI.Graphics();
          g.beginFill('#4DABF7', 0.3);
          g.drawRect(0, 0, 200, 200);
          g.endFill();
          graphic = g;
        }
        break;
      }
      default: {
        const g = new PIXI.Graphics();
        graphic = g;
        break;
      }
    }

    container.addChild(graphic);
    this.compositionContainer.addChild(container);

    scene = { container, graphic, filters: new Map() };
    this.layerScenes.set(layer.id, scene);
    return scene;
  }

  private updateLayerEffects(
    layer: Layer,
    scene: LayerScene,
    frame: number,
    linkOverrides: ResolvedValues,
  ): void {
    const enabledEffects = layer.effects
      .filter((e) => e.enabled)
      .sort((a, b) => a.order - b.order);

    // Build filter list
    const filters: PIXI.Filter[] = [];
    for (const effect of enabledEffects) {
      // Evaluate all params
      const params: Record<string, number> = {};
      for (const [paramName, animProp] of Object.entries(effect.params)) {
        const propPath = `effects.${effect.id}.${paramName}`;
        params[paramName] = getResolvedNumber(
          linkOverrides,
          layer,
          propPath,
          frame,
          () => evaluateNumber(animProp, frame),
        );
      }

      let filter = scene.filters.get(effect.id);
      if (filter) {
        updatePixiFilter(filter, effect.type, params);
      } else {
        filter = createPixiFilter(effect.type, params) ?? undefined;
        if (filter) scene.filters.set(effect.id, filter);
      }
      if (filter) filters.push(filter);
    }

    // Remove old filters
    for (const [id] of scene.filters) {
      if (!enabledEffects.find((e) => e.id === id)) {
        scene.filters.delete(id);
      }
    }

    scene.container.filters = filters.length > 0 ? filters : null;
  }

  /** Update the scene for a solid layer's color/shape change */
  updateLayerGraphic(layer: Layer, composition: Composition): void {
    const scene = this.layerScenes.get(layer.id);
    if (!scene) return;

    if (layer.type === 'solid' && scene.graphic instanceof PIXI.Graphics) {
      const g = scene.graphic;
      g.clear();
      drawSolidShape(g, layer, composition);
    }
  }

  /** Pre-load an asset texture so media layers can render it */
  loadAssetTexture(assetId: string, url: string): Promise<void> {
    if (this.assetTextures.has(assetId)) return Promise.resolve();
    return PIXI.Texture.fromURL(url).then((tex) => {
      this.assetTextures.set(assetId, tex);
    });
  }

  /** Center the composition in the viewport */
  setViewportSize(viewportWidth: number, viewportHeight: number, comp: Composition): void {
    const scaleX = (viewportWidth * 0.85) / comp.width;
    const scaleY = (viewportHeight * 0.85) / comp.height;
    const scale = Math.min(scaleX, scaleY, 1);

    this.compositionContainer.scale.set(scale);
    this.compositionContainer.position.set(
      (viewportWidth - comp.width * scale) / 2,
      (viewportHeight - comp.height * scale) / 2,
    );
  }

  /** Convert screen coordinates to composition space */
  screenToComp(screenX: number, screenY: number): { x: number; y: number } {
    const s = this.compositionContainer.scale.x;
    const px = this.compositionContainer.position.x;
    const py = this.compositionContainer.position.y;
    return {
      x: (screenX - px) / s,
      y: (screenY - py) / s,
    };
  }

  /** Hit-test: return layer ID at the given screen position (top-most first) */
  hitTestLayers(screenX: number, screenY: number): string | null {
    // Walk scenes top-to-bottom (reverse child order = top-most first)
    const children = this.compositionContainer.children;
    for (let i = children.length - 1; i >= 0; i--) {
      const child = children[i] as PIXI.Container;
      // Find which layerScene owns this container
      for (const [layerId, scene] of this.layerScenes) {
        if (scene.container === child) {
          // Skip non-visual layers (null = empty, adjustment = transparent overlay)
          const layerType = this.layerTypes.get(layerId);
          if (layerType === 'null' || layerType === 'adjustment') break;

          // Skip fully transparent layers
          if (scene.container.alpha <= 0) break;

          const bounds = scene.container.getBounds();
          if (
            bounds.width > 0 &&
            bounds.height > 0 &&
            screenX >= bounds.x &&
            screenX <= bounds.x + bounds.width &&
            screenY >= bounds.y &&
            screenY <= bounds.y + bounds.height
          ) {
            return layerId;
          }
          break;
        }
      }
    }
    return null;
  }

  clear(): void {
    for (const [, scene] of this.layerScenes) {
      scene.container.destroy({ children: true });
    }
    this.layerScenes.clear();
    this.layerTypes.clear();
    for (const [, rt] of this.precompTextures) {
      rt.destroy(true);
    }
    this.precompTextures.clear();
    this.compositionContainer.removeChildren();
  }

  destroy(): void {
    this.clear();
    this.compositionContainer.destroy();
  }
}

// --- Helpers -----------------------------------------------------------------

function getVisibleLayers(layers: Layer[], frame: number): Layer[] {
  const hasSolo = layers.some((l) => l.solo);
  return layers.filter((l) => {
    if (!l.enabled) return false;
    if (hasSolo && !l.solo) return false;
    if (frame < l.inPoint || frame >= l.outPoint) return false;
    return true;
  });
}

function getResolvedNumber(
  overrides: ResolvedValues,
  layer: Layer,
  propPath: string,
  frame: number,
  fallback: () => number,
): number {
  const key = `${layer.id}:${propPath}`;
  if (key in overrides) {
    const v = overrides[key];
    return typeof v === 'number' ? v : v[0];
  }
  return fallback();
}

function getResolvedVector2(
  overrides: ResolvedValues,
  layer: Layer,
  propPath: string,
  _frame: number,
  fallback: () => Vector2,
): Vector2 {
  const key = `${layer.id}:${propPath}`;
  if (key in overrides) {
    const v = overrides[key];
    if (Array.isArray(v) && v.length >= 2) return { x: v[0], y: v[1] };
  }
  return fallback();
}

function resolveParentChain(
  parentId: string,
  layerMap: Map<string, Layer>,
  frame: number,
  overrides: ResolvedValues,
): { x: number; y: number; rotation: number; scaleX: number; scaleY: number } {
  let x = 0,
    y = 0,
    rotation = 0,
    scaleX = 1,
    scaleY = 1;
  const visited = new Set<string>();
  let currentId: string | null = parentId;

  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const parent = layerMap.get(currentId);
    if (!parent) break;

    const pos = getResolvedVector2(
      overrides,
      parent,
      'transform.position',
      frame,
      () => evaluateVector2(parent.transform.position, frame),
    );
    const sc = getResolvedVector2(
      overrides,
      parent,
      'transform.scale',
      frame,
      () => evaluateVector2(parent.transform.scale, frame),
    );
    const rot = getResolvedNumber(
      overrides,
      parent,
      'transform.rotation',
      frame,
      () => evaluateNumber(parent.transform.rotation, frame),
    );

    x += pos.x;
    y += pos.y;
    rotation += rot;
    scaleX *= sc.x / 100;
    scaleY *= sc.y / 100;

    currentId = parent.parentLayer;
  }

  return { x, y, rotation, scaleX, scaleY };
}

// --- Shape Drawing -----------------------------------------------------------

function drawSolidShape(
  g: PIXI.Graphics,
  layer: Layer,
  composition: Composition,
): void {
  const color = layer.solidColor ?? '#FF0000';
  const w = layer.solidWidth ?? composition.width;
  const h = layer.solidHeight ?? composition.height;
  const shape = layer.solidShape ?? 'rectangle';
  const cr = layer.solidCornerRadius ?? 0;

  g.beginFill(color);

  switch (shape) {
    case 'rectangle':
      if (cr > 0) {
        g.drawRoundedRect(0, 0, w, h, cr);
      } else {
        g.drawRect(0, 0, w, h);
      }
      break;
    case 'rounded-rect':
      g.drawRoundedRect(0, 0, w, h, cr || 12);
      break;
    case 'circle': {
      const radius = Math.min(w, h) / 2;
      g.drawCircle(w / 2, h / 2, radius);
      break;
    }
    case 'ellipse':
      g.drawEllipse(w / 2, h / 2, w / 2, h / 2);
      break;
    case 'triangle': {
      g.moveTo(w / 2, 0);
      g.lineTo(w, h);
      g.lineTo(0, h);
      g.closePath();
      break;
    }
    default:
      g.drawRect(0, 0, w, h);
  }

  g.endFill();
}
