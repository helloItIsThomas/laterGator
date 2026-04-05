# Motion Graphics Editor — Research & Decision Report

**Date:** 2026-03-31
**Status:** Pre-implementation. Architecture and scope finalized through iterative risk analysis.

---

## 1. What We're Building

A browser-based motion graphics editor. The core value proposition: professional keyframe animation, effects compositing, property linking, and pre-composition nesting — tightly integrated in a single unified timeline. Not a toy. Not After Effects. A focused tool that does fewer things and does them reliably.

### 1.1 Target Users

- Motion designers who want a lighter, web-native alternative to After Effects
- Developers and creative coders who want timeline-based animation without a desktop app
- Teams that need collaborative motion design with no install barrier

---

## 2. V1 Scope — What's In, What's Out

### In Scope

- **Timeline + layer system** — 2D only, ordered layer stack, parenting, adjustment layers, null layers
- **Keyframe animation engine** — per-property keyframes, interpolation via library (popmotion or bezier-easing), no custom easing preset system
- **Effects + compositing stack** — curated fixed effect set (via PixiJS filters), blending modes, adjustment layers
- **Property link system** — declarative links (A follows B with offset/multiplier/delay), static dependency graph, wiggle/loop as built-in behaviors
- **Pre-compositions** — one level of nesting, self-contained (no cross-boundary links), shared instances

### Explicitly Removed

- **3D** — no 3D layers, no cameras, no Z-depth ordering. Entire 3D subsystem cut.
- **Graph editor** — no bezier curve manipulation UI. Interpolation handled by libraries, not user-drawn curves.
- **Easing presets** — no custom preset system. Easing math delegated to open-source libraries.
- **Export pipeline** — no video render, no Lottie, no sprite sheets. Removed entirely from V1.
- **Expressions** — no arbitrary code execution. Replaced by declarative property links.
- **Text/shape animation** — deferred to V2.
- **Masking/rotoscoping** — deferred to V2+.
- **Advanced playhead features** — stripped to essentials: play/pause, scrub, frame-step, work area in/out.

---

## 3. Architecture

### 3.1 High-Level Stack

```
┌─────────────────────────────────────────────────┐
│                   UI Shell                       │
│  (Timeline via Konva, Inspector, Viewport)       │
├─────────────────────────────────────────────────┤
│              Composition Engine                   │
│  (Scene graph, layer tree, precomp resolution)   │
├─────────────────────────────────────────────────┤
│            Animation Runtime                      │
│  (Keyframe eval, interpolation via popmotion,    │
│   property link DAG resolution)                  │
├─────────────────────────────────────────────────┤
│           Rendering Pipeline                      │
│  (PixiJS — compositing, effects, blending)       │
├─────────────────────────────────────────────────┤
│            State + Persistence                    │
│  (Zustand + Immer for state/undo,                │
│   idb + Zod for storage/serialization)           │
└─────────────────────────────────────────────────┘
```

### 3.2 Rendering Strategy

- **Viewport:** PixiJS (WebGL 2) handles all GPU rendering — layer compositing, blending modes, filter/effects pipeline, texture management, context loss recovery, high-DPI scaling.
- **Precomp rendering:** Each precomp renders to a PixiJS RenderTexture. One level of nesting means max framebuffer depth is 2 (parent + precomp level).
- **Effects:** Implemented as PixiJS filters. Curated set, not user-extensible in V1.

### 3.3 Compositing Pipeline (per frame)

```
1. Resolve property link DAG (topological sort, computed once when links change)
2. Evaluate all animated properties at current frame:
   a. Binary-search for surrounding keyframes
   b. Normalize t between them
   c. Interpolate via library (popmotion/bezier-easing)
   d. Apply property link overrides in DAG order
3. For each layer (bottom to top):
   a. If precomp: render nested composition to RenderTexture
   b. Apply layer transform (position, scale, rotation, anchor — 2D affine)
   c. Apply effect stack (PixiJS filters, sequentially)
   d. If adjustment layer: apply effects to composite-below buffer
   e. Else: blend onto accumulator using layer's blending mode + opacity
```

No arbitrary expressions means no cross-layer dependencies that violate stack order. The property link DAG is fully resolved before compositing starts. Every property has its final value. No one-frame-off bugs.

### 3.4 Data Model (core types)

```
Project
├── settings: { fps, defaultDuration, colorDepth }
├── assets: Asset[]
└── compositions: Composition[]

Composition
├── id, name, width, height, frameRate, duration, backgroundColor
└── layers: Layer[] (ordered bottom-to-top)

Layer
├── id, name, type ('solid' | 'media' | 'precomp' | 'adjustment' | 'null')
├── source: Asset | Composition | null
├── inPoint, outPoint, startTime (frames)
├── enabled, solo, locked, shy
├── blendingMode: BlendingMode
├── transform: Transform
├── effects: Effect[]
├── parentLayer: Layer | null
└── propertyLinks: Map<propertyPath, PropertyLink>

Transform
├── anchorPoint: AnimatableProperty<Vector2>
├── position: AnimatableProperty<Vector2>
├── scale: AnimatableProperty<Vector2>
├── rotation: AnimatableProperty<number>
└── opacity: AnimatableProperty<number>

AnimatableProperty<T>
├── value: T (static value when no keyframes)
└── keyframes: Keyframe<T>[]

Keyframe<T>
├── time: number (frame)
├── value: T
├── interpolation: 'linear' | 'hold' | 'bezier'
└── easing: BezierControlPoints | SpringParams | null

PropertyLink
├── sourceLayer: layerId
├── sourceProperty: propertyPath
├── offset: number
├── multiplier: number
├── delay: number (frames)
└── behavior: 'direct' | 'wiggle' | 'loop-cycle' | 'loop-pingpong' | null

Effect
├── id, type (registered filter name), enabled, order
└── params: Map<string, AnimatableProperty<any>>
```

---

## 4. Technology Decisions

| Concern | Library | Why this one |
|---|---|---|
| GPU rendering, compositing, blending, effects | **PixiJS** | Handles WebGL context loss, high-DPI, cross-browser GPU differences, blending modes, filter system. Eliminates the entire GPU risk category. |
| Timeline UI canvas layer | **Konva** (+ react-konva) | Built-in hit-testing, drag-and-drop, event bubbling, layered rendering. Cuts custom timeline interaction code roughly in half. |
| Keyframe interpolation & easing | **popmotion** (or **bezier-easing**) | Stateless interpolation functions — spring physics, standard easings, range mapping. Called per-frame, no rendering opinions. |
| State management | **Zustand** + **Immer** | Lightweight store with immutable updates. Immer patches enable memory-efficient undo/redo (store diffs, not snapshots). |
| Undo/redo | **zundo** (Zustand middleware) | Adds undo/redo to Zustand via Immer patches. Transaction grouping for multi-property operations. |
| Browser storage | **idb** | Promise-based IndexedDB wrapper. Atomic transactions prevent autosave corruption. |
| Schema validation & versioning | **Zod** | Project file schema validation with typed migrations between versions. Prevents format evolution from breaking old files. |
| Keyboard shortcuts | **tinykeys** or **hotkeys-js** | Handles browser shortcut conflicts (Cmd+S, Cmd+Z). Small surface area. |
| UI framework | **React** | Component model for panels (inspector, project, viewport). Timeline rendered via react-konva. |

### What libraries don't cover (custom code required)

- **Compositing pipeline orchestration** — the render loop that walks layers, resolves precomps, applies transforms. This is the core engine.
- **Property link system** — DAG construction, topological sort, evaluation, cycle detection, link CRUD.
- **Timeline behavior** — snapping rules, selection semantics, zoom/scroll logic, playhead control. Konva handles rendering; the rules are ours.
- **Inspector panel** — property editing UI, effect parameter controls, link configuration.

---

## 5. Risk Analysis

### 5.1 Risks Eliminated by Scope Decisions

| Decision | Risks eliminated |
|---|---|
| Remove 3D | Camera systems, Z-depth sorting, 3D/2D layer interaction, quaternion math |
| Remove graph editor | Cubic bezier inversion (root-finding), monotonicity clamping, graph UI rendering |
| Remove easing presets | Custom easing overshoot handling, preset naming/discoverability, "ceiling" frustration |
| Remove export | Lottie lossy conversion, color space mismatch, FFmpeg infrastructure, WebCodecs compat, progress feedback |
| Remove expressions | Dynamic dependency graphs, sandboxed JS runtime, circular reference detection, one-frame-off bugs, expression compilation perf |
| Cap nesting at 1 level | Recursive rendering, unbounded framebuffer allocation, cross-boundary references |

### 5.2 Risks Eliminated by Library Choices

| Library | Risks eliminated |
|---|---|
| PixiJS | WebGL context loss recovery, shader precision cross-GPU, blending mode implementation, high-DPI handling, GPU memory management, anti-aliasing inconsistency, shader compilation management |
| Konva | Canvas hit-testing precision, drag-and-drop interaction, event coordinate mapping through scroll/zoom transforms, touch/trackpad gesture handling |
| Immer + zundo | Undo memory pressure (patches not snapshots), transaction boundary grouping |
| idb | IndexedDB race conditions, autosave corruption, concurrent access |
| Zod | Project format versioning, migration between schema versions |

### 5.3 Remaining Risks (not eliminated)

**High priority:**

1. **Timeline UI engineering effort.** Even with Konva, the timeline is the single largest implementation surface. Layer bars, keyframe rendering, scrolling/zooming, selection, snapping, property twirl-downs — each is a meaningful feature. Estimated at 30-40% of total V1 effort. This is a schedule risk, not a technical risk.

2. **Cross-browser PixiJS filter behavior.** PixiJS abstracts WebGL, but its filters can still produce subtly different visual results across GPUs. Fractal noise is non-deterministic across hardware. Gaussian blur edge handling may vary. Mitigation: test on integrated Intel/AMD GPUs, Apple Silicon, and discrete NVIDIA/AMD early and continuously.

3. **Property link system design ceiling.** The offset/multiplier/delay model is simple but limited. Users will quickly want `A = B * C` or `A = sin(B)`. No escape hatch exists without reintroducing expressions. Decision point: accept this as a V1 limitation and communicate it clearly, or design the link system with extensibility hooks for V2 expressions.

4. **One nesting level may be insufficient.** Common motion design patterns use 2+ levels (elements → group → section → main). Users will hit this wall. Same decision: accept and communicate, or plan for depth increase in V2.

5. **Precomp shared instance confusion.** Edit one shared precomp, all instances update. Users who duplicated a precomp layer expecting an independent copy will be surprised. Needs clear UX: visual indicator for shared instances, explicit "make unique" action.

**Medium priority:**

6. **Spring/elastic easing overshoot.** A spring-eased opacity can exceed 100 or go below 0. Clamping creates visual discontinuity. Not clamping passes invalid values to the renderer. Needs a per-property-type clamping policy decided upfront.

7. **Property link deletion cascades.** Deleting a layer that other layers link to — cascade delete links? Leave dangling errors? Block deletion? Needs a UX decision.

8. **Memory during long sessions.** Undo history, cached textures, imported assets accumulate. Need an undo cap and texture eviction strategy.

9. **Delayed property links at composition start.** "Follow A with 5-frame delay" at frame 2 requires frame -3 data. Needs a defined behavior (hold first value, return zero, etc.).

10. **No audio reference.** Motion designers sync to music/voiceover constantly. No waveform display is a real workflow gap, even for V1. Worth reconsidering.

11. **Accessibility.** Canvas-based timeline is invisible to screen readers. Needs an ARIA layer or alternative navigation path.

12. **Browser keyboard shortcut conflicts.** Cmd+S, Cmd+T, Cmd+W intercepted by the browser before your app sees them. tinykeys/hotkeys-js help but don't fully solve this in all browsers.

**Low priority (but noted):**

13. Safari-specific WebGL2 regressions after OS updates.
14. Content Security Policy in enterprise environments blocking PixiJS shader compilation.
15. Users on iPad expecting it to work — touch interaction model entirely different.
16. Very large media imports (100MB+) overwhelming browser memory on drag-and-drop.
17. Browser storage quotas on Safari (~1GB) limiting large projects with embedded assets.
18. Tab backgrounding throttling rAF and timers — stalls playback in background tabs.

---

## 6. UI Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Menu Bar  │  Project Name  │  Playback Controls            │
├────────┬───┴───────────────────────────────────┬────────────┤
│        │                                       │            │
│Project │           Viewport                    │ Inspector  │
│Panel   │        (PixiJS canvas)                │ (selected  │
│        │                                       │  layer     │
│Assets  │   ┌───────────────────────────┐       │  props,    │
│Comps   │   │  composition renders      │       │  effects,  │
│        │   │  here with guides,        │       │  links,    │
│        │   │  motion paths, handles    │       │  transform)│
│        │   └───────────────────────────┘       │            │
├────────┴───────────────────────────────────────┴────────────┤
│  Timeline (Konva canvas)                                    │
│  ┌──────────┬──────────────────────────────────────────┐    │
│  │ Layer    │ ▶ ━━━━━━━●━━━━━━━●━━━━━━━━━━            │    │
│  │ names +  │ ▶ ━━━━●━━━━━━━━━━━━━━━                  │    │
│  │ twirl-   │ ▶ ━━━━━━━━━━━━━━━━●━━━━━━━●━━           │    │
│  │ downs    │   0s    5s    10s    15s    20s          │    │
│  └──────────┴──────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

Panels resizable. Inspector context-switches on selection. Keyboard-driven: spacebar play/pause, arrow keys frame-step, I/O for work area, U to reveal keyframed properties.

---

## 7. Suggested Build Order

| Phase | What | Depends on |
|---|---|---|
| **M1 — Data model + single-layer render** | Core types (Project, Composition, Layer, AnimatableProperty, Keyframe). PixiJS viewport rendering a single solid layer with animated transform. Playhead scrubbing. | Nothing |
| **M2 — Multi-layer compositing** | Layer stacking, blending modes, opacity. Adjustment layers. Null layers. Layer parenting (transform inheritance). | M1 |
| **M3 — Timeline UI** | Konva-based timeline: layer bars, keyframe diamonds, property twirl-downs, drag-to-reorder, playhead, zoom/scroll, box selection, snapping. | M1 |
| **M4 — Keyframe engine** | Keyframe CRUD, interpolation (popmotion/bezier-easing), per-property animation, stopwatch toggle, keyframe copy/paste/move. | M1, M3 |
| **M5 — Effects** | PixiJS filter integration, effect stack per layer, drag-to-reorder, parameter animation. Ship 10-15 curated effects. | M2, M4 |
| **M6 — Property links** | DAG construction, topological sort, cycle detection, link CRUD UI, built-in behaviors (wiggle, loop). | M4 |
| **M7 — Precomps** | One-level nesting, RenderTexture pipeline, breadcrumb nav, shared instances, "make unique" action, time remapping. | M2 |
| **M8 — State + persistence** | Zustand/Immer store, undo/redo (zundo), project save/load (idb + Zod), autosave, schema versioning. | All above |

M1-M3 can partially overlap (M3 only needs M1's data model, not its rendering). M5, M6, M7 are independent of each other after M4.

---

## 8. Open Decisions

These need answers before or during implementation:

1. **Property link extensibility** — Is the offset/multiplier/delay model the final design, or should the architecture allow richer link types in V2 (toward expressions)?
2. **Easing overshoot policy** — Clamp per-property-type (opacity: 0-100, position: no clamp)? Or let all values overshoot and handle at the render level?
3. **Shared precomp UX** — Duplicate = shared instance or independent copy? How is this communicated visually?
4. **Deleted link targets** — Cascade delete, dangle with error, or block layer deletion?
5. **Delayed link boundary** — What value does a 5-frame-delayed link return at frame 2?
6. **Audio** — Is a basic audio waveform reference track in scope? Common workflow need.
7. **Collaboration** — Is real-time multi-user editing a future goal? If yes, the Zustand/Immer architecture should be designed with CRDT migration in mind (Immer patches map well to Y.js operations).
8. **Product name** — Working title needed for project setup, domain, branding.
