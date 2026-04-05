# LaterGator User Guide

A browser-based motion graphics editor with professional keyframe animation, effects compositing, property linking, and pre-composition nesting.

---

## Getting Started

### Installation

```bash
npm install
npm run dev
```

Open **http://localhost:5173** in a modern browser (Chrome, Firefox, or Edge recommended).

### First Launch

LaterGator opens with a demo project containing a **Main Comp** (960x540, 30fps, 150 frames) with three animated solid layers. Hit **Space** to play it.

### Interface Layout

```
+--------------------------------------------------------------+
|  Menu Bar (transport controls, undo/redo, timecode)           |
+----------+------------------------------+--------------------+
|          |                              |                    |
| Project  |         Viewport             |    Inspector       |
| Panel    |      (PixiJS canvas)         |   (properties,     |
|          |                              |    effects,        |
| comps,   |   renders the active         |    transforms)     |
| assets,  |   composition here           |                    |
| layers   |                              |                    |
+----------+------------------------------+--------------------+
|  Timeline (Konva canvas)                                     |
|  layer headers  |  layer bars, keyframes, playhead           |
+--------------------------------------------------------------+
```

All panel dividers are draggable to resize.

---

## Core Concepts

### Compositions

A composition is a canvas with dimensions, frame rate, duration, and an ordered stack of layers. Every project has at least one composition. Compositions can also be nested inside other compositions as **pre-compositions** (precomps).

### Layers

Layers are stacked bottom-to-top. Each layer has a time span (in-point to out-point), a transform (position, scale, rotation, opacity, anchor point), an effect stack, and optional property links.

**Layer types:**

| Type | Description |
|------|-------------|
| **Solid** | A colored shape. Supports rectangle, rounded rect, circle, ellipse, and triangle. Custom size or full-composition fill. |
| **Media** | An imported image rendered as a layer. Import via the Assets tab in the Project Panel. |
| **Precomp** | A nested composition rendered as a layer. Supports shared instances. |
| **Null** | An invisible layer used purely as a transform parent for other layers. |
| **Adjustment** | Applies its effect stack to all layers below it. |

### Keyframes

Keyframes mark property values at specific frames. The engine interpolates between them. Each keyframe has an interpolation type:

| Type | Behavior |
|------|----------|
| **Linear** | Straight-line interpolation between values |
| **Bezier** | Smooth easing curve defined by cubic bezier control points |
| **Hold** | Snaps to the keyframe's value with no transition until the next keyframe |

### The Render Pipeline

Every frame, LaterGator:
1. Resolves all property links (topological sort of the dependency graph)
2. Evaluates all animated properties at the current frame
3. Applies property value clamping (e.g., opacity clamped to 0-1)
4. Renders each visible layer bottom-to-top: applies transforms, effects, and blending

---

## The Timeline

The timeline is where you compose animation over time.

### Anatomy

- **Time Ruler** (top) — frame/timecode labels, playhead handle, work area brackets
- **Layer Headers** (left) — layer name, visibility/lock/solo toggles, collapse arrow
- **Layer Tracks** (right) — layer bars, keyframe diamonds, playhead line

### Layer Headers

Each layer header row contains:

| Element | Action |
|---------|--------|
| **Color strip** (left edge) | Right-click to change label color |
| **Eye icon** | Toggle layer visibility |
| **Lock icon** | Toggle lock (prevents editing) |
| **S button** | Solo — only soloed layers render in the viewport |
| **Arrow (▶/▼)** | Expand/collapse to show property rows |
| **Layer name** | Double-click to rename |

Right-click a layer header for the context menu: Rename, Duplicate, Delete, Lock/Unlock, and label color options.

### Layer Reordering

Drag a layer header vertically to reorder layers in the stack. A blue drop indicator shows the insertion point. Drop to move the layer to its new position. Locked layers cannot be dragged.

### Layer Bars

Layer bars represent each layer's time span in the track area.

- **Click** a bar to select the layer
- **Drag the body** to slide the layer in time
- **Drag the left/right edge** to trim the in-point or out-point
- Bars snap to frame boundaries, the playhead, and other layer edges

### Keyframe Diamonds

When a layer is expanded, its animatable properties appear as rows with keyframe diamonds:

- **Filled diamond** — Bezier interpolation
- **Outlined diamond** — Linear interpolation
- **Filled square** — Hold interpolation
- **Click** a diamond to select it
- **Drag** a diamond horizontally to move it in time
- **Drag on empty space** to draw a selection box around multiple keyframes

### Scrolling & Zooming

| Input | Action |
|-------|--------|
| Scroll wheel | Scroll layers vertically |
| Shift + scroll | Scroll time axis horizontally |
| Cmd/Ctrl + scroll | Zoom time axis (centered on cursor) |
| **+** / **-** keys | Zoom in / out |
| **;** key | Reset zoom to fit composition |

Zoom range: 0.5 to 20 pixels per frame.

### Work Area

The work area defines the playback loop region, shown as a tinted span on the time ruler.

- Press **I** to set the in-point at the current frame
- Press **O** to set the out-point at the current frame
- Playback loops within the work area

### Playhead

The playhead is the blue vertical line indicating the current frame.

- **Click the time ruler** to jump the playhead
- **Drag the playhead handle** (triangle on the ruler) to scrub
- The playhead position is shown in the menu bar as timecode and frame number

---

## The Inspector

The right panel shows properties for the current selection.

### No Layer Selected — Composition Settings

Edit the active composition's properties:
- **Name**, **Width**, **Height**, **Frame Rate**, **Duration** (in frames), **Background Color**

### Layer Selected — Layer Properties

#### Layer Section
- **Name** — editable text field
- **Type** — read-only (solid, precomp, null, adjustment, media)
- **Color** — color picker (solid layers only)
- **Blend Mode** — dropdown with 12 modes: Normal, Multiply, Screen, Overlay, Darken, Lighten, Color Dodge, Color Burn, Hard Light, Soft Light, Difference, Exclusion
- **Timing** — in-point and out-point as frame numbers

#### Transform Section

Each property shows its evaluated value at the current frame. Double-click a number to edit.

| Property | Type | Notes |
|----------|------|-------|
| Anchor Point | X, Y | Origin point for rotation/scale |
| Position | X, Y | Layer position in composition space |
| Scale | X, Y | Percentage (100 = full size, negative = mirror) |
| Rotation | degrees | Continuous, supports >360 for multi-spin |
| Opacity | 0-100% | Clamped to valid range even with easing overshoot |

The **stopwatch icon** (⏱) next to each property controls animation:
- **Blue** = animated (has keyframes). Click to remove all keyframes (returns to static value).
- **Gray** = static. Click to add a keyframe at the current frame and enable animation.

When a property is animated and you edit its value, the change is applied as a keyframe at the current frame.

#### Effects Section

Use the **+ Add** dropdown to add effects. Each effect shows:
- **Checkbox** — enable/disable the effect
- **× button** — remove the effect
- **Parameter sliders** — adjust each parameter with its defined range

#### Property Links Section

Displays any active property links on this layer (source property, multiplier, offset). Links are created programmatically in the current version.

---

## Effects

LaterGator ships with 10 built-in effects. All effect parameters are animatable with keyframes.

| Effect | Parameters | Description |
|--------|-----------|-------------|
| **Gaussian Blur** | Strength (0-200), Quality (1-10) | Soft blur applied to the layer |
| **Brightness** | Amount (0-5) | Adjust brightness. 1 = unchanged, >1 = brighter |
| **Contrast** | Amount (0-5) | Adjust contrast. 1 = unchanged |
| **Saturate** | Amount (0-5) | Adjust color saturation. 0 = desaturated, 1 = unchanged |
| **Hue Rotation** | Rotation (0-360) | Shift all hues by the given degrees |
| **Invert** | Amount (0-1) | Invert colors |
| **Grayscale** | Amount (0-1) | Convert to grayscale |
| **Sepia** | Amount (0-1) | Apply sepia tone |
| **Noise** | Amount (0-1), Seed (0-100) | Add visual noise/grain |
| **Alpha** | Alpha (0-1) | Reduce layer transparency independent of opacity |

Effects are applied per-layer in the order they appear. Drag-to-reorder is managed through the effect's order property.

---

## Pre-Compositions

Precomps let you nest one composition inside another as a single layer.

### Creating a Precomp

1. Create a second composition in the **Project Panel** (click "+ New Composition")
2. Add layers and animation to it
3. Switch back to your main composition
4. The new composition appears in the project panel — it can be used as a precomp source

### Shared Instances

When you **duplicate** a precomp layer (Cmd/Ctrl+D), the copy is a **shared instance** — edits to the precomp content affect all instances. The layer bar shows a **×N badge** in the UI when multiple instances exist.

### Make Unique

To create an independent copy, use **Make Unique** (available in the store as `makePrecompUnique`). This deep-clones the source composition so the instance is no longer shared.

### Navigating Precomps

- **Double-click** a precomp in the Project Panel to enter it
- The **Menu Bar** shows a breadcrumb trail. Click **← Back** to return to the parent composition
- Nesting is limited to **one level** in V1

---

## Property Links

Property links create declarative relationships between layers. A link says: "this property should follow that property on another layer, with these modifiers."

### Link Parameters

| Parameter | Description |
|-----------|-------------|
| **Source Layer** | The layer to read from |
| **Source Property** | The property to follow (e.g., `transform.position`) |
| **Multiplier** | Scale the source value (1.0 = 1:1 tracking) |
| **Offset** | Add a constant to the result |
| **Delay** | Follow the source N frames behind (holds frame 0 value for frames before the composition start) |
| **Behavior** | `direct` (pass-through), `wiggle` (add noise), `loop-cycle` (loop), `loop-pingpong` (bounce) |

### Dependency Graph

Links are resolved via topological sort before rendering. If Layer B follows Layer A, and Layer C follows Layer B, the engine evaluates them in the correct order. **Circular dependencies are detected** — the DAG builder flags cycles and skips them.

### V2 Extensibility

The link system is designed with a discriminated union type (`SimpleLinkV1 | ExpressionLinkV2`). The expression type exists in the type system but is not implemented. This ensures project files will be forward-compatible when expressions are added.

---

## Playback

### Transport Controls

The **Menu Bar** provides transport buttons, or use keyboard shortcuts:

| Control | Shortcut | Action |
|---------|----------|--------|
| Play / Pause | **Space** | Toggle playback within work area |
| Stop | **Escape** | Stop and return to the frame where playback started |
| Frame forward | **→** | Step forward 1 frame |
| Frame backward | **←** | Step back 1 frame |
| Jump forward | **Shift+→** | Step forward 10 frames |
| Jump backward | **Shift+←** | Step back 10 frames |
| Go to start | **Home** | Jump to frame 0 |
| Go to end | **End** | Jump to last frame |

### Performance

During playback, the actual FPS is shown in the menu bar (e.g., "24/30 fps"). If rendering can't keep real-time, frames are skipped to maintain wall-clock accuracy. The indicator turns yellow when dropping below 80% of target.

---

## Keyboard Shortcuts

### Transport
| Key | Action |
|-----|--------|
| Space | Play / Pause |
| Escape | Stop (return to start frame) |
| ← / → | Step 1 frame |
| Shift+← / Shift+→ | Step 10 frames |
| Home / End | Jump to first / last frame |

### Editing
| Key | Action |
|-----|--------|
| Cmd/Ctrl+Z | Undo |
| Cmd/Ctrl+Shift+Z | Redo |
| Cmd/Ctrl+D | Duplicate selected layers |
| Delete / Backspace | Delete selected layers or keyframes |
| Cmd/Ctrl+A | Select all layers |

### Timeline
| Key | Action |
|-----|--------|
| I | Set work area in-point |
| O | Set work area out-point |
| [ | Trim selected layer in-point to playhead |
| ] | Trim selected layer out-point to playhead |
| + / = | Zoom timeline in |
| - | Zoom timeline out |
| ; | Reset zoom to fit |

---

## Saving & Loading

### Autosave

LaterGator autosaves to **IndexedDB** every 30 seconds. Your work persists across browser sessions automatically.

### Undo / Redo

The undo history stores up to **100 operations** using efficient Immer patches (not full snapshots). Every layer edit, keyframe change, and effect modification is tracked.

- **Cmd/Ctrl+Z** — Undo
- **Cmd/Ctrl+Shift+Z** — Redo

Or use the **↩ / ↪** buttons in the menu bar.

---

## Blending Modes

Each layer can blend with the layers below it using one of 12 modes:

| Mode | Description |
|------|-------------|
| Normal | Standard alpha compositing |
| Multiply | Darkens — multiplies color values |
| Screen | Lightens — inverse multiply |
| Overlay | Combines multiply and screen |
| Darken | Keeps darker pixels |
| Lighten | Keeps lighter pixels |
| Color Dodge | Brightens base to reflect blend |
| Color Burn | Darkens base to reflect blend |
| Hard Light | Like overlay but based on blend layer |
| Soft Light | Subtle overlay effect |
| Difference | Absolute difference of colors |
| Exclusion | Lower-contrast difference |

Set the blend mode in the **Inspector** under the Layer section.

---

## Layer Parenting

Any layer can be parented to another layer. The child inherits the parent's position, rotation, and scale transformations. This is useful for:

- Grouping elements that move together
- Creating orbit/follow effects
- Using **Null layers** as invisible transform controllers

Parent assignment is available through the store's `updateLayer` action with the `parentLayer` property. The parent chain is resolved recursively (with cycle protection) during rendering.

---

## Shape Layers

Solid layers support five shape primitives. Create them from the **Add Shape** buttons in the Project Panel, or change the shape of any existing solid layer in the Inspector.

### Shapes

| Shape | Description |
|-------|-------------|
| **Rectangle** | Standard rectangle. Set corner radius > 0 for rounded corners. |
| **Rounded Rect** | Rectangle with rounded corners. Default corner radius: 16px. |
| **Circle** | Perfect circle sized to the smaller of width/height. |
| **Ellipse** | Oval shape using the full width and height. |
| **Triangle** | Equilateral-style triangle pointing upward. |

### Shape Properties (Inspector)

When a solid layer is selected, the Inspector shows:

- **Color** — the fill color
- **Shape** — dropdown to choose the shape type
- **Size** — width and height in pixels. Set to 0 to use the full composition dimensions.
- **Radius** — corner radius for rounded-rect and rectangle shapes (in pixels)

All shapes are fully animatable — position, scale, rotation, opacity, and effects all work on shapes just like any other layer.

---

## Image Layers

LaterGator supports importing images (PNG, JPG, SVG, WebP, GIF) as media layers.

### Importing Images

1. Open the **Project Panel** (left sidebar)
2. Switch to the **Assets** tab
3. Click **+ Import Image**
4. Select one or more image files

Each imported image is:
- Added to the **Assets** list for reference
- Automatically created as a **Media layer** in the active composition

### Image Layer Behavior

- Images render at their native resolution by default
- Use **Scale** in the transform to resize
- All animation (position, rotation, opacity, effects) works on image layers
- Images are stored as blob URLs in memory for the current session

---

## Tips

- **Scrub the timeline** by clicking anywhere on the time ruler
- **Snap to the playhead** when dragging layer bars or keyframes — a visual indicator appears when snapping engages
- **Box-select keyframes** by dragging on empty track area
- **Double-click numbers** in the Inspector to type exact values
- **Solo a layer** to isolate it in the viewport — multiple layers can be soloed simultaneously
- The **grid behind the viewport** helps judge composition boundaries
- Layer bars show a **lighter tint** when selected and **hatched overlay** when disabled
- **Shift+click** layers to extend selection; **Cmd/Ctrl+click** to toggle individual layers

---

## Architecture Overview

For developers extending LaterGator:

```
src/
  types.ts              Core data model (Project, Composition, Layer, Keyframe, etc.)
  store.ts              Zustand + Immer + Zundo state management
  engine/
    keyframe.ts         Binary-search keyframe evaluation + bezier-easing interpolation
    property-links.ts   DAG construction, topological sort, link evaluation
    compositor.ts       PixiJS scene graph management + per-frame render pipeline
    effects.ts          Effect registry + PixiJS filter factory
    clamp.ts            Per-property value clamping rules
  components/
    Viewport.tsx        PixiJS Application wrapper + composition rendering
    Timeline/
      Timeline.tsx      Main timeline container (scroll/zoom coordination)
      TimeRuler.tsx     Konva time ruler (ticks, playhead, work area)
      LayerHeaders.tsx  HTML layer list (visibility, lock, solo, rename)
      LayerTracks.tsx   Konva track area (bars, keyframes, selection, snapping)
      KeyframeEditor.tsx  Keyframe diamond shapes + drag interaction
    Inspector.tsx       Property editor panel
    ProjectPanel.tsx    Composition/asset browser
    MenuBar.tsx         Transport controls + project info
  hooks/
    useKeyboardShortcuts.ts  tinykeys bindings
    usePlayback.ts           rAF playback loop
  persistence/
    schema.ts           Zod validation + versioned migrations
    storage.ts          IndexedDB save/load + autosave
```

### Tech Stack

| Library | Role |
|---------|------|
| **React 18** | UI framework |
| **PixiJS 7** | WebGL viewport rendering, effects, blending |
| **Konva + react-konva** | Canvas-based timeline UI |
| **Zustand + Immer** | Immutable state management |
| **Zundo** | Undo/redo via Immer patches |
| **bezier-easing** | Cubic bezier curve evaluation |
| **Zod** | Project schema validation |
| **idb** | Promise-based IndexedDB |
| **tinykeys** | Keyboard shortcut binding |

---

## Known Limitations (V1)

- **No export** — no video render, Lottie, or sprite sheet output
- **No 3D** — 2D layers only, no cameras or Z-depth
- **No graph editor** — easing is set by type, not drawn as curves
- **No expressions** — property links use offset/multiplier/delay only
- **No audio** — no waveform display or audio layers
- **No text/shape animation** — deferred to V2
- **No masking** — deferred to V2+
- **Single nesting level** — precomps cannot contain other precomps
- **Video import** — only still images are supported; video files cannot be imported
- **Adjustment layers** — rendered but don't yet apply effects to layers below them
- **Image persistence** — imported images use blob URLs that don't survive across browser sessions
