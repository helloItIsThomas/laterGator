# LaterGator — Timeline UI Specification

**Date:** 2026-03-31
**Scope:** Complete specification for the Konva-based timeline panel. Covers layout, interactions, rendering, keyboard model, and edge cases.

---

## 1. Layout Structure

```
┌──────────────────────────────────────────────────────────────────────┐
│  Time Ruler (frame numbers / timecode)            [Work Area]        │
│  0f        30f        60f        90f       120f       150f           │
│  ──────────┼──────────┼──────────┼──────────┼──────────┼──────      │
│            ▼ playhead                                                │
├──────────────┬───────────────────────────────────────────────────────┤
│ Layer Header │ Layer Tracks                                          │
├──────────────┼───────────────────────────────────────────────────────┤
│ 👁 🔒 ▶ BG  │ ████████████████████████████████████████████          │
│ 👁 🔒 ▶ Logo│      ████████●━━━━━━●━━━━━━━●████████                │
│ 👁 🔒 ▼ Text│ ████████████████████████████████                      │
│    Position  │         ◆━━━━━━━━━◆━━━━━━◆                           │
│    Opacity   │ ◆━━━━━━━━━━━━━━━━━━━━━━━━━━◆                        │
│ 👁 🔒 ▶ Adj │   ██████████████████████████████████████              │
│              │                                                       │
│              │                                               ▼ scroll│
└──────────────┴───────────────────────────────────────────────────────┘
```

### 1.1 Panels

| Panel | Width/Height | Content |
|---|---|---|
| **Time Ruler** | Full width, 28px tall | Frame/timecode labels, playhead handle, work area bracket |
| **Layer Headers** | 200px wide (resizable, min 140px, max 320px), full height | Visibility, lock, solo icons; collapse toggle; layer name; label color swatch |
| **Layer Tracks** | Remaining width, full height | Layer bars, keyframe diamonds, playhead line |

The header/track split is a single resizable divider. Drag it horizontally.

### 1.2 Coordinate Systems

Two independent scroll axes:

- **Horizontal (time):** Shared between time ruler and layer tracks. Measured in frames. Zoom changes the pixels-per-frame ratio.
- **Vertical (layers):** Shared between layer headers and layer tracks. Measured in pixels. Each collapsed layer row = 28px. Each expanded property row = 22px.

The time ruler scrolls horizontally but not vertically. Layer headers scroll vertically but not horizontally. Layer tracks scroll both.

---

## 2. Time Ruler

### 2.1 Tick Marks

Adaptive density based on zoom level:

| Zoom level (px/frame) | Major ticks | Minor ticks | Labels |
|---|---|---|---|
| < 2 px/frame | Every 1s (at comp fps) | Every 0.5s | Seconds only ("1s", "2s") |
| 2–6 px/frame | Every 1s | Every 10 frames | Seconds + frames ("1s", "1:10") |
| 6–15 px/frame | Every 0.5s | Every frame | Frames ("30f", "31f") |
| > 15 px/frame | Every 10 frames | Every frame | Frames with sub-labels |

Labels are right-aligned to their tick mark. Cull labels that would overlap — skip every other one until they fit.

### 2.2 Playhead Handle

- Inverted triangle (12px wide, 10px tall) sitting on the time ruler baseline.
- Filled with accent color (default: `#4A9EFF`).
- Dragging the handle scrubs the playhead. Snaps to frame boundaries.
- The playhead line extends vertically through the entire layer tracks area as a 1px accent-colored line.

### 2.3 Work Area

- Two bracket markers (in-point `[`, out-point `]`) on the time ruler.
- Draggable independently. Region between them is tinted with a subtle overlay (`rgba(74, 158, 255, 0.08)`).
- Playback loops within the work area when set.
- Default: full composition duration.
- Double-click the work area bar to reset to full duration.

---

## 3. Layer Headers

Each layer header row contains (left to right):

```
[Color] [👁] [🔒] [S] [▶/▼] Layer Name
 4px    20px 20px 20px 16px   remaining
```

| Element | Behavior |
|---|---|
| **Label color** | 4px vertical strip on the left edge. Click to cycle through 8 preset colors. |
| **Visibility (eye)** | Toggle layer enabled/disabled. Alt+click to solo (hide all others). |
| **Lock** | Toggle locked. Locked layers: no selection, no keyframe edits, no dragging. Dimmed in tracks. |
| **Solo (S)** | When active, only soloed layers render in viewport. Multiple layers can be soloed. |
| **Collapse toggle (▶/▼)** | ▶ = collapsed (show only layer bar). ▼ = expanded (show property rows beneath). |
| **Layer name** | Double-click to rename inline. Shows layer type icon prefix (solid, media, precomp, adjustment, null). |

### 3.1 Layer Type Icons

| Type | Icon | Default color |
|---|---|---|
| Solid | Filled square | Layer's solid color |
| Media | Image icon | Blue |
| Precomp | Folder/nested icon | Purple |
| Adjustment | Half-filled circle | Orange |
| Null | Crosshair/empty | Gray |

### 3.2 Property Twirl-Down Hierarchy

When a layer is expanded, its properties appear as indented rows:

```
▼ Logo Layer
  ▼ Transform
      Anchor Point      ◆━━━━━━◆
      Position           ◆━━━━━━━━━━━━◆
      Scale
      Rotation           ◆━━━◆
      Opacity
  ▼ Effects
    ▼ Gaussian Blur
        Radius           ◆━━━━━━◆
        Quality
  ▶ Property Links
```

Rules:
- Groups (Transform, Effects, individual effect) have their own collapse toggles.
- Only show properties that have keyframes by default when using the `U` shortcut (reveal animated).
- Properties without keyframes show their static value in the header area (right-aligned, truncated).
- The **stopwatch icon** appears left of each animatable property name. Filled = animated (has keyframes). Click to toggle: enabling adds a keyframe at current time, disabling removes all keyframes (with confirmation).

---

## 4. Layer Bars

### 4.1 Rendering

- Rounded rectangle, height = row height minus 4px padding (24px in a 28px row).
- Filled with the layer's label color at 60% opacity, 1px border at 80% opacity.
- Selected layer bar: brighter fill (80% opacity), 2px border with accent color.
- Disabled layer: 20% opacity, hatched pattern overlay.
- Locked layer: diagonal stripe pattern overlay at 10% opacity.

### 4.2 Trimming

- Hover within 6px of left or right edge: cursor changes to `col-resize`.
- Drag edge to trim in-point or out-point. Snaps to frame boundaries.
- Minimum duration: 1 frame.
- Trim handles render as slightly lighter vertical bars (3px wide) on hover.

### 4.3 Sliding

- Drag from body (not edges): move layer in time. Snaps to frame boundaries.
- Shows ghost outline at original position during drag.
- Cursor: `grab` on hover, `grabbing` during drag.

### 4.4 Slip Editing

- Alt+drag layer bar body: slips the source content within the in/out window without moving the bar itself. Only relevant for media layers with source longer than the trimmed duration.

---

## 5. Keyframe Rendering

### 5.1 Diamond Shapes

Keyframes render as diamonds (rotated squares) on their property row, centered at the keyframe's frame position.

| Interpolation | Shape | Size |
|---|---|---|
| Bezier | Diamond (◆) | 8x8px |
| Linear | Diamond (◇) with line through center | 8x8px |
| Hold | Square (■) | 7x7px |

### 5.2 States

| State | Appearance |
|---|---|
| Default | Filled with layer's label color |
| Selected | Filled with accent color (`#4A9EFF`), 1px white outline |
| Hovered | 1px accent outline |
| On collapsed layer | Shown as small ticks (3px) on the layer bar's top edge |

### 5.3 Interpolation Segments

Between two keyframes on the same property, draw a thin line (1px) connecting them:

- Bezier: slight S-curve hint (cosmetic, not accurate to actual easing)
- Linear: straight line
- Hold: horizontal line from first keyframe, then vertical drop at second keyframe

---

## 6. Selection Model

### 6.1 Layer Selection

| Action | Result |
|---|---|
| Click layer header or bar | Select layer, deselect all others |
| Shift+click | Extend selection (range from last selected to clicked) |
| Cmd+click | Toggle clicked layer in/out of selection |
| Click empty area | Deselect all |

Selected layers are highlighted in both the header and tracks areas. Selection syncs with the viewport — selecting a layer in the timeline selects it in the viewport and vice versa.

### 6.2 Keyframe Selection

| Action | Result |
|---|---|
| Click keyframe diamond | Select keyframe, deselect all other keyframes |
| Shift+click keyframe | Add/remove from keyframe selection |
| Box select (drag on empty track area) | Select all keyframes within the rectangle |
| Cmd+A (with layer selected) | Select all keyframes on selected layers |

Keyframe selection is independent of layer selection. Selecting a keyframe does not change which layer is selected.

### 6.3 Box Select

- Start: mousedown on empty area in layer tracks (not on a layer bar or keyframe).
- Drag: draw a translucent rectangle (`rgba(74, 158, 255, 0.15)` fill, 1px accent border).
- End: mouseup selects all keyframes whose centers are within the rectangle.
- Shift+box select: adds to existing keyframe selection.

---

## 7. Drag Operations

### 7.1 Keyframe Dragging

- Drag selected keyframe(s) horizontally to move in time.
- All selected keyframes move together, maintaining relative spacing.
- Snaps to frame boundaries (always).
- Snaps to playhead when within 4px (visual snap indicator: playhead line pulses briefly).
- Cannot drag past frame 0.
- Alt+drag to duplicate keyframes (drag copies, originals stay).

### 7.2 Layer Reordering

- Drag layer header vertically to reorder in the layer stack.
- Drop indicator: horizontal line between layers showing insertion point.
- Changes z-order (render order) in the composition.
- Cannot reorder while layer is locked.

### 7.3 Drag-to-Timeline (from Project Panel)

- Drag asset or composition from the project panel into the layer tracks area.
- Drop position determines both the layer's z-order (vertical) and start time (horizontal).
- Ghost preview of the layer bar during drag.

---

## 8. Scrolling & Zooming

### 8.1 Scrolling

| Input | Axis | Behavior |
|---|---|---|
| Scroll wheel (no modifier) | Vertical | Scroll layer list up/down |
| Shift + scroll wheel | Horizontal | Scroll time axis left/right |
| Middle mouse drag | Both | Pan freely |
| Scrollbar drag | Respective axis | Standard scrollbar |

### 8.2 Zooming

| Input | Behavior |
|---|---|
| Cmd + scroll wheel | Zoom time axis, centered on cursor position |
| Pinch gesture (trackpad) | Zoom time axis, centered on gesture center |
| `+` / `-` keys | Zoom in/out, centered on playhead |
| `;` key | Zoom to fit entire composition in view |
| Alt + `;` | Zoom to fit work area in view |

Zoom range: 0.5 px/frame (zoomed out, seeing full 60s+ compositions) to 20 px/frame (zoomed in, sub-frame precision).

Zoom is always horizontal only. Vertical row heights are fixed.

---

## 9. Snapping System

### 9.1 Snap Targets

When dragging layer bars, layer edges, or keyframes, snap to:

| Target | Priority | Visual indicator |
|---|---|---|
| Frame boundaries | Always (implicit, everything snaps to frames) | None needed |
| Playhead | High | Playhead line color pulses |
| Work area in/out | High | Bracket marker highlights |
| Other layer in-points | Medium | Thin vertical line through tracks |
| Other layer out-points | Medium | Thin vertical line through tracks |
| Keyframes on other layers | Low | Small tick at snap point |

### 9.2 Snap Threshold

- 6px screen distance. If multiple snap targets fall within threshold, choose the nearest one.

### 9.3 Disabling Snap

- Hold **Cmd** while dragging to disable all snapping except frame boundaries.

---

## 10. Playback Controls

Playback state is displayed in the menu bar (above the timeline), but keyboard shortcuts work when timeline is focused.

### 10.1 Transport

| Control | Shortcut | Behavior |
|---|---|---|
| Play / Pause | Space | Toggle playback. Plays from current frame within work area. Loops at work area out-point. |
| Stop | Esc (during playback) | Stop and return playhead to the frame where playback started. |
| Frame forward | Right arrow | Advance 1 frame |
| Frame backward | Left arrow | Retreat 1 frame |
| Jump forward | Shift + Right | Advance 10 frames |
| Jump backward | Shift + Left | Retreat 10 frames |
| Go to start | Home | Move playhead to frame 0 |
| Go to end | End | Move playhead to last frame |
| Go to work area in | Shift + Home | Move playhead to work area in-point |
| Go to work area out | Shift + End | Move playhead to work area out-point |

### 10.2 Playback Rendering

During playback, the compositing pipeline renders each frame and the playhead advances. If rendering can't keep up with real-time:

- **Skip frames** to maintain audio-sync cadence (even though we have no audio, this keeps wall-clock time accurate).
- Display a frame rate indicator in the time ruler area showing actual vs target FPS (e.g., "18/30 fps") when dropping below target.
- Playback is always forward, at 1x speed. No reverse or variable-speed in V1.

---

## 11. Keyboard Shortcuts

### 11.1 Property Shortcuts

These shortcuts solo-reveal a specific property group on selected layers:

| Key | Property | Behavior |
|---|---|---|
| P | Position | Show only Position property |
| S | Scale | Show only Scale property |
| R | Rotation | Show only Rotation property |
| T | Opacity (Transparency) | Show only Opacity property |
| A | Anchor Point | Show only Anchor Point property |
| U | All animated | Show all properties that have keyframes |
| UU | All modified | Show all properties that differ from defaults |
| E | Effects | Show all effects and their properties |

Shift + property key adds to the current view instead of replacing it (e.g., Shift+P shows Position in addition to whatever's already shown).

### 11.2 Editing Shortcuts

| Key | Action |
|---|---|
| Cmd+D | Duplicate selected layers |
| Delete / Backspace | Delete selected layers or keyframes |
| Cmd+C / Cmd+V | Copy/paste layers or keyframes |
| Cmd+Z | Undo |
| Cmd+Shift+Z | Redo |
| Cmd+A | Select all (layers or keyframes depending on context) |
| `[` | Set selected layer's in-point to playhead |
| `]` | Set selected layer's out-point to playhead |
| Alt+`[` | Trim selected layer's in-point to playhead (removes trimmed content) |
| Alt+`]` | Trim selected layer's out-point to playhead |
| I | Set work area in-point to playhead |
| O | Set work area out-point to playhead |
| J | Go to previous keyframe on selected property |
| K | Go to next keyframe on selected property |

### 11.3 Keyframe Shortcuts

| Key | Action |
|---|---|
| Alt+Shift+P | Add position keyframe at current time |
| Alt+Shift+S | Add scale keyframe at current time |
| Alt+Shift+R | Add rotation keyframe at current time |
| Alt+Shift+T | Add opacity keyframe at current time |
| F9 | Convert selected keyframes to bezier (ease-ease) |
| Ctrl+click keyframe | Cycle interpolation: bezier -> linear -> hold -> bezier |

---

## 12. Context Menus

### 12.1 Layer Header Right-Click

```
Rename                    Enter
Duplicate                 Cmd+D
Delete                    Delete
─────────────────────────
Pre-compose...            Cmd+Shift+C
─────────────────────────
Parent to ▸              [submenu: layer list]
Remove Parent
─────────────────────────
Label Color ▸            [submenu: 8 colors]
─────────────────────────
Lock Layer               Cmd+L
Hide Layer (Shy)
```

### 12.2 Keyframe Right-Click

```
Delete Keyframes          Delete
─────────────────────────
Interpolation ▸
  Bezier                  F9
  Linear
  Hold
─────────────────────────
Copy Keyframes            Cmd+C
Paste Keyframes           Cmd+V
```

### 12.3 Empty Track Area Right-Click

```
Paste Keyframes           Cmd+V
Paste Layers              Cmd+V
─────────────────────────
Add Layer ▸
  Solid...
  Null
  Adjustment Layer
─────────────────────────
Select All Layers         Cmd+A
```

---

## 13. Konva Implementation Notes

### 13.1 Layer Architecture (Konva Layers, not composition layers)

Use separate Konva layers for rendering tiers. Konva layers have independent canvases, so redrawing one doesn't repaint others.

| Konva Layer | Content | Redraw frequency |
|---|---|---|
| **Background** | Row alternating stripes, grid lines | On scroll/zoom only |
| **Bars** | Layer bars, property rows | On data change, scroll, zoom |
| **Keyframes** | Diamond shapes, interpolation lines | On data change, scroll, zoom |
| **Overlay** | Playhead line, selection box, snap guides, drop indicators | On playhead move, during drag |
| **Header** | Layer headers (separate Konva stage or HTML overlay) | On data change, vertical scroll |

### 13.2 Virtualization

Only render rows and keyframes that are within the visible viewport plus a 100px buffer zone. For a composition with 200 layers, most are off-screen at any time. Recompute visible set on scroll.

For keyframes: binary search on sorted keyframe arrays to find the visible time range, then render only those.

### 13.3 Hit Testing

Konva provides built-in hit testing. Configure hit regions:

- Layer bars: Konva `Rect` with `draggable: true`
- Trim handles: Invisible Konva `Rect` (6px wide) at bar edges, higher z-index
- Keyframes: Konva `RegularPolygon` (4 sides, rotated 45deg) or custom `Shape`
- Empty space: Captured by the background layer's stage event handler

### 13.4 Performance Targets

| Metric | Target |
|---|---|
| Scroll/zoom repaint | < 8ms (120fps capable) |
| Keyframe drag update | < 4ms |
| Layer reorder | < 16ms |
| Initial render (50 layers, 500 keyframes) | < 50ms |
| Maximum comfortable scale | 200 layers, 5000 keyframes visible |

If performance degrades beyond these targets, progressively simplify: hide interpolation lines first, then reduce keyframe detail to simple dots, then collapse all property rows.

---

## 14. Responsive Behavior

### 14.1 Minimum Dimensions

- Timeline panel minimum height: 120px (shows ~3 collapsed layers + time ruler).
- Timeline panel minimum width: 400px (header + reasonable track area).

### 14.2 Resize Handle

The timeline panel is separated from the viewport/inspector by a horizontal resize divider. Drag to allocate vertical space. Double-click divider to toggle between collapsed (showing only time ruler + 2 layers) and default height (40% of window).

---

## 15. Empty & Error States

| State | Display |
|---|---|
| No composition open | Centered text: "Open a composition to see its timeline" |
| Composition with no layers | Time ruler visible. Centered text in tracks: "Drag assets here or right-click to add a layer" |
| No keyframes on expanded property | Dashed line at the property's static value position |
| Playback frame drop | Yellow FPS indicator in time ruler |
| Layer references missing asset | Layer bar rendered with red hatching, "Missing" label |

---

## 16. Accessibility Considerations

The canvas-based timeline is not natively accessible. Provide:

- **ARIA live region** announcing playhead position, selected layer name, and transport state changes.
- **Tabbing order** through layer headers (HTML overlay, not Konva) for screen reader navigation.
- **Keyboard-only operation** for all core functions (selection, playhead movement, keyframe navigation) — no mouse-only interactions.
- **High contrast mode** detection: increase border widths, use solid fills instead of transparency.

---

## 17. Visual Style Reference

```
Colors (dark theme):
  Panel background:     #1E1E1E
  Row even:             #1E1E1E
  Row odd:              #222222
  Row selected:         #2A3A4A
  Row hover:            #252525
  Grid line:            #333333
  Time ruler bg:        #2D2D2D
  Time ruler text:      #999999
  Playhead:             #4A9EFF
  Work area tint:       rgba(74, 158, 255, 0.08)
  Snap guide:           #FF6B00
  Selection box fill:   rgba(74, 158, 255, 0.15)
  Selection box border: #4A9EFF

Typography:
  Layer names:          12px, system font, #CCCCCC
  Property names:       11px, system font, #999999
  Time ruler labels:    10px, monospace, #999999
  Static values:        10px, monospace, #666666
```
