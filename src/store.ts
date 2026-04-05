// ============================================================================
// LaterGator — Zustand Store with Immer + Zundo (Undo/Redo)
// ============================================================================

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { temporal } from 'zundo';
import { v4 as uuid } from 'uuid';
import type {
  Project,
  Composition,
  Layer,
  Effect,
  Keyframe,
  PropertyLink,
  AnimatableProperty,
  Vector2,
  BlendingMode,
  LayerType,
  Asset,
  SolidShape,
} from './types';
import { createDefaultTransform, createDefaultProjectSettings, LABEL_COLORS } from './types';
import { EFFECT_DEFS } from './engine/effects';

// --- State Shape -------------------------------------------------------------

export interface AppState {
  // Project
  project: Project;

  // Active composition
  activeCompositionId: string | null;
  compositionStack: string[]; // breadcrumb for precomp nav

  // Selection
  selectedLayerIds: string[];
  selectedKeyframeIds: string[]; // "layerId:propPath:kfId"

  // Timeline UI
  currentFrame: number;
  isPlaying: boolean;
  playbackStartFrame: number;
  workAreaIn: number;
  workAreaOut: number;
  actualFps: number;
  timelineScrollX: number;
  timelineScrollY: number;
  timelineZoom: number; // px per frame
  headerWidth: number;
  expandedLayers: Record<string, boolean>;
  expandedGroups: Record<string, boolean>; // "layerId:group"
  soloRevealProperty: string | null;

  // Derived helper
  getActiveComposition: () => Composition | null;
  getLayer: (layerId: string) => Layer | null;

  // --- Actions ---------------------------------------------------------------

  // Project
  setProject: (project: Project) => void;
  updateProjectName: (name: string) => void;
  addAsset: (asset: Asset) => void;

  // Compositions
  addComposition: (comp: Composition) => void;
  setActiveComposition: (id: string) => void;
  updateComposition: (id: string, updates: Partial<Pick<Composition, 'name' | 'width' | 'height' | 'frameRate' | 'duration' | 'backgroundColor'>>) => void;
  enterPrecomp: (compId: string) => void;
  exitPrecomp: () => void;

  // Layers
  addLayer: (layer: Layer) => void;
  removeLayer: (layerId: string) => void;
  updateLayer: (layerId: string, updates: Partial<Pick<Layer, 'name' | 'enabled' | 'solo' | 'locked' | 'shy' | 'blendingMode' | 'color' | 'parentLayer' | 'inPoint' | 'outPoint' | 'startTime' | 'solidColor' | 'solidShape' | 'solidWidth' | 'solidHeight' | 'solidCornerRadius'>>) => void;
  duplicateLayer: (layerId: string) => void;
  reorderLayer: (layerId: string, newIndex: number) => void;
  makePrecompUnique: (layerId: string) => void;

  // Keyframes
  addKeyframe: <T>(layerId: string, propertyPath: string, keyframe: Keyframe<T>) => void;
  removeKeyframe: (layerId: string, propertyPath: string, keyframeId: string) => void;
  updateKeyframe: <T>(layerId: string, propertyPath: string, keyframeId: string, updates: Partial<Keyframe<T>>) => void;
  moveKeyframes: (delta: number) => void;
  toggleStopwatch: (layerId: string, propertyPath: string) => void;

  // Effects
  addEffect: (layerId: string, effectType: string) => void;
  removeEffect: (layerId: string, effectId: string) => void;
  updateEffect: (layerId: string, effectId: string, updates: Partial<Pick<Effect, 'enabled' | 'order'>>) => void;
  updateEffectParam: (layerId: string, effectId: string, paramName: string, value: number) => void;

  // Property Links
  setPropertyLink: (layerId: string, propertyPath: string, link: PropertyLink) => void;
  removePropertyLink: (layerId: string, propertyPath: string) => void;

  // Selection
  selectLayers: (layerIds: string[], mode: 'replace' | 'add' | 'toggle') => void;
  selectKeyframes: (kfIds: string[], mode: 'replace' | 'add' | 'toggle') => void;
  clearSelection: () => void;

  // Playback & Timeline
  setCurrentFrame: (frame: number) => void;
  setIsPlaying: (playing: boolean) => void;
  setPlaybackStartFrame: (frame: number) => void;
  setWorkArea: (inPoint: number, outPoint: number) => void;
  setActualFps: (fps: number) => void;
  setTimelineScroll: (x: number, y: number) => void;
  setTimelineZoom: (zoom: number) => void;
  setHeaderWidth: (width: number) => void;
  toggleLayerExpanded: (layerId: string) => void;
  toggleGroupExpanded: (key: string) => void;
  setSoloRevealProperty: (prop: string | null) => void;

  // Transform editing
  updateTransformProperty: (layerId: string, prop: 'position' | 'scale' | 'anchorPoint', value: Vector2) => void;
  updateTransformScalar: (layerId: string, prop: 'rotation' | 'opacity', value: number) => void;
}

// --- Helper to navigate to property within a layer ---------------------------

function getAnimatableRef(
  layer: Layer,
  propertyPath: string,
): AnimatableProperty<any> | null {
  const parts = propertyPath.split('.');
  if (parts[0] === 'transform') {
    const key = parts[1] as keyof typeof layer.transform;
    if (key in layer.transform) return layer.transform[key] as AnimatableProperty<any>;
  }
  if (parts[0] === 'effects' && parts.length === 3) {
    const effect = layer.effects.find((e) => e.id === parts[1]);
    if (effect && effect.params[parts[2]]) return effect.params[parts[2]];
  }
  return null;
}

// --- Store -------------------------------------------------------------------

export const useStore = create<AppState>()(
  temporal(
    immer((set, get) => ({
      // Initial state
      project: createDefaultProject(),
      activeCompositionId: null,
      compositionStack: [],
      selectedLayerIds: [],
      selectedKeyframeIds: [],
      currentFrame: 0,
      isPlaying: false,
      playbackStartFrame: 0,
      workAreaIn: 0,
      workAreaOut: 150,
      actualFps: 30,
      timelineScrollX: 0,
      timelineScrollY: 0,
      timelineZoom: 6,
      headerWidth: 200,
      expandedLayers: {},
      expandedGroups: {},
      soloRevealProperty: null,

      // Derived
      getActiveComposition: () => {
        const state = get();
        if (!state.activeCompositionId) return null;
        return (
          state.project.compositions.find(
            (c) => c.id === state.activeCompositionId,
          ) ?? null
        );
      },

      getLayer: (layerId: string) => {
        const comp = get().getActiveComposition();
        if (!comp) return null;
        return comp.layers.find((l) => l.id === layerId) ?? null;
      },

      // --- Project -----------------------------------------------------------

      setProject: (project) =>
        set((s) => {
          s.project = project;
          if (project.compositions.length > 0) {
            s.activeCompositionId = project.compositions[0].id;
            s.workAreaOut = project.compositions[0].duration;
          }
        }),

      updateProjectName: (name) =>
        set((s) => {
          s.project.name = name;
        }),

      addAsset: (asset) =>
        set((s) => {
          s.project.assets.push(asset);
        }),

      // --- Compositions ------------------------------------------------------

      addComposition: (comp) =>
        set((s) => {
          s.project.compositions.push(comp);
        }),

      setActiveComposition: (id) =>
        set((s) => {
          s.activeCompositionId = id;
          s.selectedLayerIds = [];
          s.selectedKeyframeIds = [];
          s.currentFrame = 0;
          const comp = s.project.compositions.find((c) => c.id === id);
          if (comp) {
            s.workAreaIn = 0;
            s.workAreaOut = comp.duration;
          }
        }),

      updateComposition: (id, updates) =>
        set((s) => {
          const comp = s.project.compositions.find((c) => c.id === id);
          if (comp) Object.assign(comp, updates);
        }),

      enterPrecomp: (compId) =>
        set((s) => {
          if (s.activeCompositionId) {
            s.compositionStack.push(s.activeCompositionId);
          }
          s.activeCompositionId = compId;
          s.selectedLayerIds = [];
          s.selectedKeyframeIds = [];
          s.currentFrame = 0;
        }),

      exitPrecomp: () =>
        set((s) => {
          const prev = s.compositionStack.pop();
          if (prev) {
            s.activeCompositionId = prev;
            s.selectedLayerIds = [];
            s.selectedKeyframeIds = [];
          }
        }),

      // --- Layers ------------------------------------------------------------

      addLayer: (layer) =>
        set((s) => {
          const comp = s.project.compositions.find(
            (c) => c.id === s.activeCompositionId,
          );
          if (comp) {
            comp.layers.push(layer);
          }
        }),

      removeLayer: (layerId) =>
        set((s) => {
          const comp = s.project.compositions.find(
            (c) => c.id === s.activeCompositionId,
          );
          if (!comp) return;

          // Cascade: remove property links that reference this layer
          for (const layer of comp.layers) {
            for (const [propPath, link] of Object.entries(
              layer.propertyLinks,
            )) {
              if (link.type === 'simple' && link.sourceLayer === layerId) {
                delete layer.propertyLinks[propPath];
              }
            }
            // Remove parent references
            if (layer.parentLayer === layerId) {
              layer.parentLayer = null;
            }
          }

          comp.layers = comp.layers.filter((l) => l.id !== layerId);
          s.selectedLayerIds = s.selectedLayerIds.filter(
            (id) => id !== layerId,
          );
        }),

      updateLayer: (layerId, updates) =>
        set((s) => {
          const comp = s.project.compositions.find(
            (c) => c.id === s.activeCompositionId,
          );
          if (!comp) return;
          const layer = comp.layers.find((l) => l.id === layerId);
          if (layer) Object.assign(layer, updates);
        }),

      duplicateLayer: (layerId) =>
        set((s) => {
          const comp = s.project.compositions.find(
            (c) => c.id === s.activeCompositionId,
          );
          if (!comp) return;
          const layer = comp.layers.find((l) => l.id === layerId);
          if (!layer) return;

          const newLayer: Layer = JSON.parse(JSON.stringify(layer));
          newLayer.id = uuid();
          newLayer.name = `${layer.name} (copy)`;
          // Deep-clone effect IDs
          for (const eff of newLayer.effects) {
            eff.id = uuid();
          }
          // Deep-clone keyframe IDs
          const reIdKeyframes = (prop: AnimatableProperty<any>) => {
            for (const kf of prop.keyframes) {
              kf.id = uuid();
            }
          };
          reIdKeyframes(newLayer.transform.anchorPoint);
          reIdKeyframes(newLayer.transform.position);
          reIdKeyframes(newLayer.transform.scale);
          reIdKeyframes(newLayer.transform.rotation);
          reIdKeyframes(newLayer.transform.opacity);
          for (const eff of newLayer.effects) {
            for (const param of Object.values(eff.params)) {
              reIdKeyframes(param);
            }
          }

          const idx = comp.layers.findIndex((l) => l.id === layerId);
          comp.layers.splice(idx + 1, 0, newLayer);
        }),

      reorderLayer: (layerId, newIndex) =>
        set((s) => {
          const comp = s.project.compositions.find(
            (c) => c.id === s.activeCompositionId,
          );
          if (!comp) return;
          const idx = comp.layers.findIndex((l) => l.id === layerId);
          if (idx === -1) return;
          const [layer] = comp.layers.splice(idx, 1);
          comp.layers.splice(
            Math.max(0, Math.min(newIndex, comp.layers.length)),
            0,
            layer,
          );
        }),

      makePrecompUnique: (layerId) =>
        set((s) => {
          const comp = s.project.compositions.find(
            (c) => c.id === s.activeCompositionId,
          );
          if (!comp) return;
          const layer = comp.layers.find((l) => l.id === layerId);
          if (!layer || layer.type !== 'precomp' || !layer.source) return;

          const sourceComp = s.project.compositions.find(
            (c) => c.id === layer.source,
          );
          if (!sourceComp) return;

          // Deep clone the composition
          const newComp: Composition = JSON.parse(JSON.stringify(sourceComp));
          newComp.id = uuid();
          newComp.name = `${sourceComp.name} (copy)`;
          s.project.compositions.push(newComp);

          // Point the layer to the new comp
          layer.source = newComp.id;
        }),

      // --- Keyframes ---------------------------------------------------------

      addKeyframe: (layerId, propertyPath, keyframe) =>
        set((s) => {
          const comp = s.project.compositions.find(
            (c) => c.id === s.activeCompositionId,
          );
          if (!comp) return;
          const layer = comp.layers.find((l) => l.id === layerId);
          if (!layer) return;
          const prop = getAnimatableRef(layer, propertyPath);
          if (!prop) return;
          // Insert sorted by time
          const idx = prop.keyframes.findIndex(
            (k: Keyframe<any>) => k.time > keyframe.time,
          );
          if (idx === -1) {
            prop.keyframes.push(keyframe);
          } else {
            prop.keyframes.splice(idx, 0, keyframe);
          }
        }),

      removeKeyframe: (layerId, propertyPath, keyframeId) =>
        set((s) => {
          const comp = s.project.compositions.find(
            (c) => c.id === s.activeCompositionId,
          );
          if (!comp) return;
          const layer = comp.layers.find((l) => l.id === layerId);
          if (!layer) return;
          const prop = getAnimatableRef(layer, propertyPath);
          if (!prop) return;
          prop.keyframes = prop.keyframes.filter(
            (k: Keyframe<any>) => k.id !== keyframeId,
          );
        }),

      updateKeyframe: (layerId, propertyPath, keyframeId, updates) =>
        set((s) => {
          const comp = s.project.compositions.find(
            (c) => c.id === s.activeCompositionId,
          );
          if (!comp) return;
          const layer = comp.layers.find((l) => l.id === layerId);
          if (!layer) return;
          const prop = getAnimatableRef(layer, propertyPath);
          if (!prop) return;
          const kf = prop.keyframes.find(
            (k: Keyframe<any>) => k.id === keyframeId,
          );
          if (kf) Object.assign(kf, updates);
        }),

      moveKeyframes: (delta) =>
        set((s) => {
          const comp = s.project.compositions.find(
            (c) => c.id === s.activeCompositionId,
          );
          if (!comp) return;
          for (const kfId of s.selectedKeyframeIds) {
            const [layerId, propPath, keyframeId] = kfId.split(':');
            const layer = comp.layers.find((l) => l.id === layerId);
            if (!layer) continue;
            const prop = getAnimatableRef(layer, propPath);
            if (!prop) continue;
            const kf = prop.keyframes.find(
              (k: Keyframe<any>) => k.id === keyframeId,
            );
            if (kf) kf.time = Math.max(0, kf.time + delta);
          }
        }),

      toggleStopwatch: (layerId, propertyPath) =>
        set((s) => {
          const comp = s.project.compositions.find(
            (c) => c.id === s.activeCompositionId,
          );
          if (!comp) return;
          const layer = comp.layers.find((l) => l.id === layerId);
          if (!layer) return;
          const prop = getAnimatableRef(layer, propertyPath);
          if (!prop) return;
          if (prop.keyframes.length > 0) {
            // Disable: remove all keyframes
            prop.keyframes = [];
          } else {
            // Enable: add a keyframe at the current time
            prop.keyframes.push({
              id: uuid(),
              time: s.currentFrame,
              value: prop.value,
              interpolation: 'linear' as const,
              easing: null,
            });
          }
        }),

      // --- Effects -----------------------------------------------------------

      addEffect: (layerId, effectType) =>
        set((s) => {
          const comp = s.project.compositions.find(
            (c) => c.id === s.activeCompositionId,
          );
          if (!comp) return;
          const layer = comp.layers.find((l) => l.id === layerId);
          if (!layer) return;
          const def = EFFECT_DEFS.find((d) => d.type === effectType);
          if (!def) return;

          const params: Record<string, AnimatableProperty<number>> = {};
          for (const p of def.params) {
            params[p.name] = { value: p.defaultValue, keyframes: [] };
          }

          layer.effects.push({
            id: uuid(),
            type: effectType,
            enabled: true,
            order: layer.effects.length,
            params,
          });
        }),

      removeEffect: (layerId, effectId) =>
        set((s) => {
          const comp = s.project.compositions.find(
            (c) => c.id === s.activeCompositionId,
          );
          if (!comp) return;
          const layer = comp.layers.find((l) => l.id === layerId);
          if (!layer) return;
          layer.effects = layer.effects.filter((e) => e.id !== effectId);
          // Re-order remaining effects
          layer.effects.forEach((e, i) => (e.order = i));
        }),

      updateEffect: (layerId, effectId, updates) =>
        set((s) => {
          const comp = s.project.compositions.find(
            (c) => c.id === s.activeCompositionId,
          );
          if (!comp) return;
          const layer = comp.layers.find((l) => l.id === layerId);
          if (!layer) return;
          const effect = layer.effects.find((e) => e.id === effectId);
          if (effect) Object.assign(effect, updates);
        }),

      updateEffectParam: (layerId, effectId, paramName, value) =>
        set((s) => {
          const comp = s.project.compositions.find(
            (c) => c.id === s.activeCompositionId,
          );
          if (!comp) return;
          const layer = comp.layers.find((l) => l.id === layerId);
          if (!layer) return;
          const effect = layer.effects.find((e) => e.id === effectId);
          if (effect && effect.params[paramName]) {
            effect.params[paramName].value = value;
          }
        }),

      // --- Property Links ----------------------------------------------------

      setPropertyLink: (layerId, propertyPath, link) =>
        set((s) => {
          const comp = s.project.compositions.find(
            (c) => c.id === s.activeCompositionId,
          );
          if (!comp) return;
          const layer = comp.layers.find((l) => l.id === layerId);
          if (layer) layer.propertyLinks[propertyPath] = link;
        }),

      removePropertyLink: (layerId, propertyPath) =>
        set((s) => {
          const comp = s.project.compositions.find(
            (c) => c.id === s.activeCompositionId,
          );
          if (!comp) return;
          const layer = comp.layers.find((l) => l.id === layerId);
          if (layer) delete layer.propertyLinks[propertyPath];
        }),

      // --- Selection ---------------------------------------------------------

      selectLayers: (layerIds, mode) =>
        set((s) => {
          switch (mode) {
            case 'replace':
              s.selectedLayerIds = layerIds;
              break;
            case 'add':
              const toAdd = layerIds.filter(
                (id) => !s.selectedLayerIds.includes(id),
              );
              s.selectedLayerIds.push(...toAdd);
              break;
            case 'toggle':
              for (const id of layerIds) {
                const idx = s.selectedLayerIds.indexOf(id);
                if (idx >= 0) {
                  s.selectedLayerIds.splice(idx, 1);
                } else {
                  s.selectedLayerIds.push(id);
                }
              }
              break;
          }
        }),

      selectKeyframes: (kfIds, mode) =>
        set((s) => {
          switch (mode) {
            case 'replace':
              s.selectedKeyframeIds = kfIds;
              break;
            case 'add':
              const toAdd = kfIds.filter(
                (id) => !s.selectedKeyframeIds.includes(id),
              );
              s.selectedKeyframeIds.push(...toAdd);
              break;
            case 'toggle':
              for (const id of kfIds) {
                const idx = s.selectedKeyframeIds.indexOf(id);
                if (idx >= 0) {
                  s.selectedKeyframeIds.splice(idx, 1);
                } else {
                  s.selectedKeyframeIds.push(id);
                }
              }
              break;
          }
        }),

      clearSelection: () =>
        set((s) => {
          s.selectedLayerIds = [];
          s.selectedKeyframeIds = [];
        }),

      // --- Playback & Timeline -----------------------------------------------

      setCurrentFrame: (frame) =>
        set((s) => {
          s.currentFrame = Math.max(0, frame);
        }),

      setIsPlaying: (playing) =>
        set((s) => {
          s.isPlaying = playing;
        }),

      setPlaybackStartFrame: (frame) =>
        set((s) => {
          s.playbackStartFrame = frame;
        }),

      setWorkArea: (inPoint, outPoint) =>
        set((s) => {
          s.workAreaIn = Math.max(0, inPoint);
          s.workAreaOut = outPoint;
        }),

      setActualFps: (fps) =>
        set((s) => {
          s.actualFps = fps;
        }),

      setTimelineScroll: (x, y) =>
        set((s) => {
          s.timelineScrollX = x;
          s.timelineScrollY = y;
        }),

      setTimelineZoom: (zoom) =>
        set((s) => {
          s.timelineZoom = Math.max(0.5, Math.min(20, zoom));
        }),

      setHeaderWidth: (width) =>
        set((s) => {
          s.headerWidth = Math.max(140, Math.min(320, width));
        }),

      toggleLayerExpanded: (layerId) =>
        set((s) => {
          s.expandedLayers[layerId] = !s.expandedLayers[layerId];
        }),

      toggleGroupExpanded: (key) =>
        set((s) => {
          s.expandedGroups[key] = !s.expandedGroups[key];
        }),

      setSoloRevealProperty: (prop) =>
        set((s) => {
          s.soloRevealProperty = prop;
        }),

      // --- Transform editing -----------------------------------------------

      updateTransformProperty: (layerId, prop, value) =>
        set((s) => {
          const comp = s.project.compositions.find(
            (c) => c.id === s.activeCompositionId,
          );
          if (!comp) return;
          const layer = comp.layers.find((l) => l.id === layerId);
          if (!layer) return;
          const animProp = layer.transform[prop] as AnimatableProperty<Vector2>;
          if (animProp.keyframes.length > 0) {
            // Update or add keyframe at current frame
            const existing = animProp.keyframes.find(
              (k) => k.time === s.currentFrame,
            );
            if (existing) {
              existing.value = value;
            } else {
              animProp.keyframes.push({
                id: uuid(),
                time: s.currentFrame,
                value,
                interpolation: 'linear',
                easing: null,
              });
              animProp.keyframes.sort((a, b) => a.time - b.time);
            }
          } else {
            animProp.value = value;
          }
        }),

      updateTransformScalar: (layerId, prop, value) =>
        set((s) => {
          const comp = s.project.compositions.find(
            (c) => c.id === s.activeCompositionId,
          );
          if (!comp) return;
          const layer = comp.layers.find((l) => l.id === layerId);
          if (!layer) return;
          const animProp = layer.transform[prop] as AnimatableProperty<number>;
          if (animProp.keyframes.length > 0) {
            const existing = animProp.keyframes.find(
              (k) => k.time === s.currentFrame,
            );
            if (existing) {
              existing.value = value;
            } else {
              animProp.keyframes.push({
                id: uuid(),
                time: s.currentFrame,
                value,
                interpolation: 'linear',
                easing: null,
              });
              animProp.keyframes.sort((a, b) => a.time - b.time);
            }
          } else {
            animProp.value = value;
          }
        }),
    })),
    {
      limit: 100,
      equality: (a, b) => false, // always track (Immer patches make this cheap)
    },
  ),
);

// --- Default Project Factory -------------------------------------------------

function createDefaultProject(): Project {
  const compId = uuid();
  const settings = createDefaultProjectSettings();

  const layers: Layer[] = [
    createSolidLayer('Background', '#2D3436', compId, 0, settings.defaultDuration, 960, 540),
    createSolidLayer('Blue Shape', '#0984E3', compId, 0, settings.defaultDuration, 960, 540),
    createSolidLayer('Accent', '#E17055', compId, 15, 120, 960, 540),
  ];

  // Give the blue shape some animation
  layers[1].transform.position = {
    value: { x: 200, y: 200 },
    keyframes: [
      { id: uuid(), time: 0, value: { x: 200, y: 200 }, interpolation: 'bezier', easing: { x1: 0.25, y1: 0.1, x2: 0.25, y2: 1 } },
      { id: uuid(), time: 45, value: { x: 500, y: 300 }, interpolation: 'bezier', easing: { x1: 0.25, y1: 0.1, x2: 0.25, y2: 1 } },
      { id: uuid(), time: 90, value: { x: 300, y: 150 }, interpolation: 'bezier', easing: { x1: 0.25, y1: 0.1, x2: 0.25, y2: 1 } },
      { id: uuid(), time: 140, value: { x: 200, y: 200 }, interpolation: 'linear', easing: null },
    ],
  };
  layers[1].transform.scale = {
    value: { x: 30, y: 30 },
    keyframes: [
      { id: uuid(), time: 0, value: { x: 30, y: 30 }, interpolation: 'bezier', easing: { x1: 0.42, y1: 0, x2: 0.58, y2: 1 } },
      { id: uuid(), time: 60, value: { x: 50, y: 50 }, interpolation: 'bezier', easing: { x1: 0.42, y1: 0, x2: 0.58, y2: 1 } },
      { id: uuid(), time: 120, value: { x: 30, y: 30 }, interpolation: 'linear', easing: null },
    ],
  };
  layers[1].transform.rotation = {
    value: 0,
    keyframes: [
      { id: uuid(), time: 0, value: 0, interpolation: 'linear', easing: null },
      { id: uuid(), time: 150, value: 360, interpolation: 'linear', easing: null },
    ],
  };

  // Accent layer — opacity animation
  layers[2].transform.position.value = { x: 600, y: 350 };
  layers[2].transform.scale.value = { x: 20, y: 20 };
  layers[2].transform.opacity = {
    value: 1,
    keyframes: [
      { id: uuid(), time: 15, value: 0, interpolation: 'bezier', easing: { x1: 0, y1: 0, x2: 0.58, y2: 1 } },
      { id: uuid(), time: 40, value: 1, interpolation: 'bezier', easing: { x1: 0.42, y1: 0, x2: 1, y2: 1 } },
      { id: uuid(), time: 100, value: 1, interpolation: 'bezier', easing: { x1: 0.42, y1: 0, x2: 0.58, y2: 1 } },
      { id: uuid(), time: 120, value: 0, interpolation: 'linear', easing: null },
    ],
  };

  return {
    id: uuid(),
    name: 'LaterGator Demo',
    version: 1,
    settings,
    assets: [],
    compositions: [
      {
        id: compId,
        name: 'Main Comp',
        width: 960,
        height: 540,
        frameRate: 30,
        duration: settings.defaultDuration,
        backgroundColor: '#1E1E1E',
        layers,
      },
    ],
  };
}

function createSolidLayer(
  name: string,
  color: string,
  _compId: string,
  inPoint: number,
  outPoint: number,
  _compWidth: number,
  _compHeight: number,
): Layer {
  return {
    id: uuid(),
    name,
    type: 'solid',
    source: null,
    solidColor: color,
    solidShape: 'rectangle',
    solidWidth: null,
    solidHeight: null,
    solidCornerRadius: 0,
    inPoint,
    outPoint,
    startTime: 0,
    enabled: true,
    solo: false,
    locked: false,
    shy: false,
    blendingMode: 'normal',
    transform: createDefaultTransform(),
    effects: [],
    parentLayer: null,
    propertyLinks: {},
    color: LABEL_COLORS[Math.floor(Math.random() * LABEL_COLORS.length)],
  };
}

// --- Layer Factory Helpers (exported for UI) ----------------------------------

export function createLayer(
  type: LayerType,
  name: string,
  duration: number,
  options?: {
    solidColor?: string;
    solidShape?: SolidShape;
    solidWidth?: number;
    solidHeight?: number;
    solidCornerRadius?: number;
    source?: string;
    inPoint?: number;
    outPoint?: number;
  },
): Layer {
  return {
    id: uuid(),
    name,
    type,
    source: options?.source ?? null,
    solidColor: type === 'solid' ? (options?.solidColor ?? '#FF0000') : null,
    solidShape: options?.solidShape ?? 'rectangle',
    solidWidth: options?.solidWidth ?? null,
    solidHeight: options?.solidHeight ?? null,
    solidCornerRadius: options?.solidCornerRadius ?? 0,
    inPoint: options?.inPoint ?? 0,
    outPoint: options?.outPoint ?? duration,
    startTime: 0,
    enabled: true,
    solo: false,
    locked: false,
    shy: false,
    blendingMode: 'normal',
    transform: createDefaultTransform(),
    effects: [],
    parentLayer: null,
    propertyLinks: {},
    color: LABEL_COLORS[Math.floor(Math.random() * LABEL_COLORS.length)],
  };
}
