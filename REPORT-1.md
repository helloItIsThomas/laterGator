# LaterGator — Risk Answers & Open Decision Report

**Date:** 2026-03-31
**Follows:** REPORT-0.md

---

## 1. Decisions Recorded

These were decided directly by the user and need no further analysis.

| Decision | Answer |
|---|---|
| Product name | **LaterGator** |
| Audio | **Removed from V1 scope entirely.** No waveform, no audio layers, no audio reference tracks. |
| Collaboration | **Not a future goal.** No need to design for CRDT migration. Zustand/Immer architecture can optimize purely for single-user. |
| Easing overshoot | **Clamp by default.** See section 3 for per-property policy. |
| Deleted link targets | **Cascade deletion.** See section 4 for the visual system. |

---

## 2. Precomp Shared Instance UX

**Problem:** When a user duplicates a precomp layer, do they get a shared instance (edits affect all copies) or an independent copy? After Effects users expect shared by default, but this surprises users who wanted an independent copy.

### 2.1 Decision: Shared by Default, Explicit "Make Unique"

**Duplicate layer** (Cmd+D on a precomp layer) creates a new layer referencing the same composition. This is a shared instance. Editing the precomp content affects all instances.

**"Make Unique"** (right-click > Make Unique, or Cmd+Alt+D) duplicates the underlying composition itself, giving the selected layer its own independent copy.

This matches the After Effects model, which the target user base already understands.

### 2.2 Visual Indicators

#### Instance Badge

Every precomp layer bar shows an **instance count badge** when the referenced composition is used more than once:

```
┌─────────────────────────────────┐
│ 📁 Intro Animation         ×3  │  <- badge showing 3 instances exist
└─────────────────────────────────┘
```

- Badge: small rounded rectangle, right side of the layer bar.
- Format: `×N` where N = total number of layers referencing this composition.
- Color: muted purple background (precomp color family).
- When N = 1: badge is hidden (no point showing "×1").

#### Cross-Highlighting

When the user **selects** a shared precomp layer, all other layers that reference the same composition get a subtle pulsing outline (1px, precomp purple, 50% opacity). This passively communicates "these are connected."

#### Edit Warning

When the user **enters a shared precomp** for editing (double-click to open), a non-modal banner appears at the top of the timeline:

```
┌──────────────────────────────────────────────────────────────┐
│ ⚠ Editing shared composition — changes affect 3 instances.  │
│                                    [Make Unique] [Dismiss]   │
└──────────────────────────────────────────────────────────────┘
```

- Appears once per edit session (dismissing persists until next time the precomp is entered).
- "Make Unique" converts the instance you entered from into an independent copy, then continues editing the now-independent copy.

#### Breadcrumb Trail

When inside a precomp, the timeline shows a breadcrumb:

```
Main Comp > Intro Animation (×3)
```

The instance count in the breadcrumb reinforces the shared state. Clicking "Main Comp" navigates back.

#### Make Unique Confirmation

No confirmation dialog needed — "Make Unique" is non-destructive (it only adds a new composition, it doesn't delete anything). After making unique, the badge updates on all affected layers. A brief toast confirms:

```
"Intro Animation" duplicated as "Intro Animation (copy)". This instance is now independent.
```

---

## 3. Easing Overshoot Clamping Policy

**Rule:** Clamp by default, per property type. The clamping happens after interpolation, before the value is applied.

| Property | Clamp range | Rationale |
|---|---|---|
| Opacity | [0, 1] | Values outside this range are meaningless to the renderer. |
| Scale X/Y | No clamp | Negative scale = mirror/flip (intentional). >100% = zoom. Both are valid creative choices. |
| Position X/Y | No clamp | Position can be anywhere, including off-canvas. |
| Rotation | No clamp | Overshoot past 360 or below 0 is valid (spin effects). Renderer normalizes internally. |
| Anchor Point X/Y | No clamp | Same reasoning as position. |
| Effect parameters | Per-parameter min/max defined in effect registration | Each effect declares its own valid ranges. E.g., blur radius: [0, 200], hue rotation: [0, 360]. |

### Implementation

```typescript
interface PropertyClampRule {
  min?: number;  // undefined = no lower clamp
  max?: number;  // undefined = no upper clamp
}

const TRANSFORM_CLAMP_RULES: Record<string, PropertyClampRule> = {
  opacity: { min: 0, max: 1 },
  // all others: no entry = no clamping
};

function clampPropertyValue(
  propertyPath: string,
  value: number,
  clampRule?: PropertyClampRule
): number {
  if (!clampRule) return value;
  if (clampRule.min !== undefined) value = Math.max(clampRule.min, value);
  if (clampRule.max !== undefined) value = Math.min(clampRule.max, value);
  return value;
}
```

Clamping is applied as the last step before the value is consumed — after interpolation, after property link evaluation. This means the animation curves themselves can overshoot freely (which looks correct in a future graph editor), and only the final applied value is clamped.

---

## 4. Property Link Deletion — Cascade with Visual Feedback

**Decision:** When a layer is deleted, all property links that reference it as a source are also deleted. This is fully reversible via undo.

### 4.1 Pre-Deletion Flow

```
User presses Delete on "Layer A"
         │
         ▼
   Does any other layer have a
   property link sourcing from Layer A?
         │
    No ──┤── Yes
         │      │
         ▼      ▼
   Delete    Show deletion preview
   immediately
```

### 4.2 Deletion Preview

When links would be broken, a brief visual preview shows what will be affected before confirming:

**Timeline indicators:**
- The layer being deleted flashes red.
- All layers that have links pointing to the deleted layer get a small chain-break icon (broken link) overlaid on their layer bar, with a red tint on the linked properties.
- A thin red dashed line appears connecting the doomed layer to each dependent layer.

**Confirmation dialog:**

```
┌─────────────────────────────────────────────────────┐
│  Delete "Layer A"?                                   │
│                                                      │
│  This will also remove 3 property links:             │
│    • Layer B → Position (linked to Layer A)          │
│    • Layer C → Opacity (linked to Layer A)           │
│    • Layer C → Rotation (linked to Layer A)          │
│                                                      │
│  Linked properties will revert to their keyframed    │
│  or static values.                                   │
│                                                      │
│              [Cancel]  [Delete]                       │
└─────────────────────────────────────────────────────┘
```

### 4.3 Post-Deletion

- Properties that had links revert to their underlying keyframed or static values (the links were overrides, so the base values still exist).
- Toast notification: `"Deleted Layer A and 3 property links. Ctrl+Z to undo."`
- Undo restores everything — the layer, all links, and the link evaluation order.

### 4.4 Visual Indicators for Active Links (always visible)

To support the deletion flow and general link awareness, property links have persistent visual indicators in the timeline:

- Properties that are link-controlled show a small **chain icon** next to their name in the twirl-down.
- Hovering a linked property shows a tooltip: `"Linked to: Layer A > Position (×1.0, +0, delay: 5f)"`
- When a layer is selected, all its outgoing links (properties it sources for other layers) are shown as subtle directional lines in the layer tracks area.

---

## 5. Property Link Extensibility — V2 Expression Architecture

### 5.1 Goal

The V1 property link system (offset/multiplier/delay + built-in behaviors) should be replaceable with a richer expression system in V2 without restructuring the core engine. The key: **abstract the evaluation step**.

### 5.2 V1 Architecture (build this now)

```typescript
// The link definition is a discriminated union from day one.
type PropertyLink =
  | SimpleLinkV1
  | ExpressionLinkV2;  // Exists in the type system but not implemented.

interface SimpleLinkV1 {
  type: 'simple';
  sourceLayer: string;        // layer ID
  sourceProperty: string;     // property path
  offset: number;
  multiplier: number;
  delay: number;              // frames
  behavior: 'direct' | 'wiggle' | 'loop-cycle' | 'loop-pingpong' | null;
}

// V2 placeholder — defined now so serialization format accounts for it.
interface ExpressionLinkV2 {
  type: 'expression';
  expression: string;         // future: code string
  dependencies: string[];     // future: auto-detected from expression
}
```

### 5.3 Evaluation Abstraction

The compositing pipeline currently calls something like `resolvePropertyLinks()`. Structure this as:

```typescript
interface LinkEvaluator {
  evaluate(
    link: PropertyLink,
    context: EvaluationContext
  ): number | number[];
}

interface EvaluationContext {
  currentFrame: number;
  getPropertyValue(layerId: string, propertyPath: string, frame: number): number | number[];
  compositionFps: number;
  compositionDuration: number;
}

class SimpleLinkEvaluator implements LinkEvaluator {
  evaluate(link: SimpleLinkV1, ctx: EvaluationContext) {
    const sourceFrame = Math.max(0, ctx.currentFrame - link.delay);
    let value = ctx.getPropertyValue(link.sourceLayer, link.sourceProperty, sourceFrame);
    // Apply multiplier + offset
    // Apply behavior (wiggle, loop)
    return value;
  }
}

// V2: drop in a new evaluator
// class ExpressionLinkEvaluator implements LinkEvaluator { ... }
```

### 5.4 DAG System: Already V2-Ready

The DAG (topological sort, cycle detection) works on declared dependencies. V1 simple links have exactly one dependency (source layer + property). V2 expressions can declare multiple dependencies — the DAG system handles this identically. No changes needed.

Key rule: the DAG must be recomputed when links change, not per-frame. V1 simple links have static dependencies. V2 expressions will need dependency analysis (parsing the expression to find referenced properties), but the DAG recomputation trigger is the same: link added/removed/modified.

### 5.5 Serialization Forward-Compatibility

The `type` discriminator in `PropertyLink` means old project files with `"type": "simple"` will load correctly in V2. V2 files with `"type": "expression"` will fail gracefully in V1 (Zod validation rejects unknown type, UI shows "unsupported link type" on affected properties).

### 5.6 What NOT to Build Now

- No expression parser or evaluator.
- No expression editor UI.
- No multi-dependency link types.
- No sandboxed JS runtime research.

The only V2 preparation is structural: the discriminated union type, the evaluator interface, and the DAG accepting multiple dependencies per link. Total cost: ~20 lines of type definitions and one interface extraction.

---

## 6. Delayed Link Boundary Behavior

**Question:** A property link says "follow Layer A's position with a 5-frame delay." At frame 2, this needs Layer A's value at frame -3. Frame -3 doesn't exist.

### 6.1 Decision: Hold First Value

When a delayed link requests a frame before the composition start (frame < 0), return the source property's value at **frame 0**.

```
Frame:     0    1    2    3    4    5    6    7    8
Source A:  100  110  120  130  140  150  160  170  180
Link (5f): 100  100  100  100  100  100  110  120  130
                ^^^  ^^^  ^^^  ^^^  ^^^
                holding frame 0 value
```

### 6.2 Rationale

- **No discontinuity.** The linked property starts at a real value and smoothly transitions into following the source once enough frames of history exist. There's no jump from zero or from an arbitrary default.
- **Matches the user's mental model.** "Follow A but 5 frames behind" — before you have 5 frames of history, you're just waiting at the starting position. This feels like a natural "not yet started" state.
- **Consistent with how other tools handle this.** After Effects' `valueAtTime()` clamps to composition bounds.

### 6.3 Implementation

```typescript
function getDelayedSourceValue(
  link: SimpleLinkV1,
  currentFrame: number,
  ctx: EvaluationContext
): number | number[] {
  const requestedFrame = currentFrame - link.delay;
  const clampedFrame = Math.max(0, requestedFrame);
  return ctx.getPropertyValue(link.sourceLayer, link.sourceProperty, clampedFrame);
}
```

One line: `Math.max(0, requestedFrame)`. That's it.

### 6.4 Edge Case: Delay Longer Than Composition

If a link has a 300-frame delay in a 120-frame composition, the linked property holds frame 0's value for the entire duration. This is technically correct but useless. No special handling — the user set a nonsensical delay, the result is predictably boring.

---

## 7. Updated Risk Register

Incorporating all decisions above, here's the revised status of risks from REPORT-0:

| # | Risk | Status |
|---|---|---|
| 1 | Timeline UI effort | **Mitigated.** Full spec written (TIMELINE-SPEC.md). Scope is defined and bounded. Remains the largest work item. |
| 2 | Cross-browser PixiJS filter behavior | **Open.** No change. Needs early testing. |
| 3 | Property link design ceiling | **Accepted.** V1 ships with simple links. Architecture supports V2 expression drop-in (section 5). Communicated as a known limitation. |
| 4 | One nesting level insufficient | **Accepted.** V1 limitation. Revisit in V2. |
| 5 | Precomp shared instance confusion | **Resolved.** UX system designed (section 2): instance badge, cross-highlighting, edit warning banner, Make Unique action. |
| 6 | Spring/elastic overshoot | **Resolved.** Per-property clamping policy defined (section 3). |
| 7 | Property link deletion cascades | **Resolved.** Cascade deletion with visual preview and confirmation (section 4). |
| 8 | Memory during long sessions | **Open.** Needs undo cap and texture eviction strategy during implementation. |
| 9 | Delayed links at composition start | **Resolved.** Hold first value policy (section 6). |
| 10 | No audio reference | **Eliminated.** Removed from scope by decision. |
| 11 | Accessibility | **Open.** Timeline spec includes ARIA considerations but needs detailed implementation plan. |
| 12 | Browser keyboard conflicts | **Open.** Addressed by library choice (tinykeys/hotkeys-js) but needs per-browser testing. |

---

## 8. Updated Open Decisions

| # | Decision | Status |
|---|---|---|
| 1 | Property link extensibility | **Resolved.** Discriminated union + evaluator interface. V2-ready with ~20 lines of prep. (Section 5) |
| 2 | Easing overshoot policy | **Resolved.** Clamp by default, per-property rules. (Section 3) |
| 3 | Shared precomp UX | **Resolved.** Shared by default, Make Unique for independent copies, visual indicators. (Section 2) |
| 4 | Deleted link targets | **Resolved.** Cascade deletion with preview and undo. (Section 4) |
| 5 | Delayed link boundary | **Resolved.** Hold frame 0 value. (Section 6) |
| 6 | Audio | **Resolved.** Removed from V1. |
| 7 | Collaboration | **Resolved.** Not a goal. No CRDT prep needed. |
| 8 | Product name | **Resolved.** LaterGator. |
