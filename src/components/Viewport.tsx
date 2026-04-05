// ============================================================================
// Viewport — PixiJS-based composition renderer
// ============================================================================

import { useEffect, useRef } from 'react';
import * as PIXI from 'pixi.js';
import { useStore } from '../store';
import { Compositor } from '../engine/compositor';
import { evaluateVector2 } from '../engine/keyframe';

// --- Background Grid ---------------------------------------------------------

function createGridTexture(app: PIXI.Application): PIXI.Texture {
  const size = 20;
  const g = new PIXI.Graphics();

  // Dark background
  g.beginFill(0x1e1e1e);
  g.drawRect(0, 0, size, size);
  g.endFill();

  // Lighter grid lines
  g.lineStyle(1, 0x2a2a2a, 0.6);
  g.moveTo(size, 0);
  g.lineTo(size, size);
  g.moveTo(0, size);
  g.lineTo(size, size);

  const texture = app.renderer.generateTexture(g, {
    region: new PIXI.Rectangle(0, 0, size, size),
  });
  g.destroy();
  return texture;
}

// --- Component ---------------------------------------------------------------

export function Viewport() {
  const containerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Read initial values for the overlay (React-driven, only for display)
  const compName = useStore(
    (s) => s.getActiveComposition()?.name ?? 'No Composition',
  );
  const compDuration = useStore(
    (s) => s.getActiveComposition()?.duration ?? 0,
  );
  const currentFrame = useStore((s) => s.currentFrame);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // ---- PixiJS Application --------------------------------------------------

    const app = new PIXI.Application({
      resizeTo: container,
      backgroundColor: 0x181818,
      antialias: true,
      autoDensity: true,
      resolution: window.devicePixelRatio || 1,
    });
    container.appendChild(app.view as HTMLCanvasElement);

    // ---- Background Grid ----------------------------------------------------

    const gridTexture = createGridTexture(app);
    const gridSprite = new PIXI.TilingSprite(
      gridTexture,
      app.screen.width,
      app.screen.height,
    );
    gridSprite.zIndex = -1;
    app.stage.sortableChildren = true;
    app.stage.addChild(gridSprite);

    // ---- Compositor ---------------------------------------------------------

    const compositor = new Compositor(app);

    // ---- Drag-to-Move State --------------------------------------------------

    let dragLayerId: string | null = null;
    let dragStartCompX = 0;
    let dragStartCompY = 0;
    let dragStartPosX = 0;
    let dragStartPosY = 0;

    function handlePointerDown(e: PointerEvent) {
      // PixiJS with autoDensity works in CSS pixels — do NOT multiply by resolution
      const rect = (app.view as HTMLCanvasElement).getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;

      const layerId = compositor.hitTestLayers(screenX, screenY);
      if (!layerId) {
        useStore.getState().clearSelection();
        return;
      }

      // Check if layer is locked
      const layer = useStore.getState().getLayer(layerId);
      if (!layer || layer.locked) return;

      // Select the layer
      const mode = e.shiftKey ? 'toggle' : 'replace';
      useStore.getState().selectLayers([layerId], mode);

      // Start drag
      dragLayerId = layerId;
      const compPt = compositor.screenToComp(screenX, screenY);
      dragStartCompX = compPt.x;
      dragStartCompY = compPt.y;

      const pos = layer.transform.position;
      const frame = useStore.getState().currentFrame;
      const val = pos.keyframes.length > 0
        ? evaluateVector2(pos, frame)
        : pos.value as { x: number; y: number };
      dragStartPosX = val.x;
      dragStartPosY = val.y;

      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }

    function handlePointerMove(e: PointerEvent) {
      const rect = (app.view as HTMLCanvasElement).getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;

      if (!dragLayerId) {
        // Update cursor based on hover
        const hoverId = compositor.hitTestLayers(screenX, screenY);
        canvas.style.cursor = hoverId ? 'move' : 'default';
        return;
      }

      canvas.style.cursor = 'grabbing';
      const compPt = compositor.screenToComp(screenX, screenY);

      const dx = compPt.x - dragStartCompX;
      const dy = compPt.y - dragStartCompY;

      useStore.getState().updateTransformProperty(dragLayerId, 'position', {
        x: Math.round(dragStartPosX + dx),
        y: Math.round(dragStartPosY + dy),
      });
    }

    function handlePointerUp() {
      dragLayerId = null;
      canvas.style.cursor = 'default';
    }

    const canvas = app.view as HTMLCanvasElement;
    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerup', handlePointerUp);

    // ---- Render Helper ------------------------------------------------------

    function renderCurrentState() {
      const state = useStore.getState();
      const comp = state.getActiveComposition();
      if (!comp) {
        compositor.clear();
        return;
      }

      // Keep the compositor aware of all compositions (needed for precomps)
      compositor.setCompositions(state.project.compositions);
      compositor.renderFrame(comp, state.currentFrame);

      // Update overlay text outside React render cycle for performance
      if (overlayRef.current) {
        overlayRef.current.textContent =
          `${comp.name}  |  Frame ${state.currentFrame} / ${comp.duration}  |  ${comp.width}x${comp.height} @ ${comp.frameRate}fps`;
      }
    }

    // Initial render
    renderCurrentState();

    // ---- Store Subscription (outside React render) --------------------------

    // Track the values we care about so we can skip spurious re-renders
    let prevFrame = useStore.getState().currentFrame;
    let prevCompId = useStore.getState().activeCompositionId;
    let prevCompositions = useStore.getState().project.compositions;

    const unsubscribe = useStore.subscribe((state) => {
      const changed =
        state.currentFrame !== prevFrame ||
        state.activeCompositionId !== prevCompId ||
        state.project.compositions !== prevCompositions;

      if (!changed) return;

      prevFrame = state.currentFrame;
      prevCompId = state.activeCompositionId;
      prevCompositions = state.project.compositions;

      renderCurrentState();
    });

    // ---- Resize Handling ----------------------------------------------------

    function handleResize() {
      const { clientWidth, clientHeight } = container!;
      app.renderer.resize(clientWidth, clientHeight);

      // Resize the grid tiling sprite
      gridSprite.width = clientWidth;
      gridSprite.height = clientHeight;

      // Recenter the composition
      const comp = useStore.getState().getActiveComposition();
      if (comp) {
        compositor.setViewportSize(clientWidth, clientHeight, comp);
      }
    }

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    resizeObserver.observe(container);

    // Fire once to set initial sizes
    handleResize();

    // ---- Cleanup ------------------------------------------------------------

    return () => {
      canvas.removeEventListener('pointerdown', handlePointerDown);
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('pointerup', handlePointerUp);
      unsubscribe();
      resizeObserver.disconnect();
      compositor.destroy();
      gridSprite.destroy();
      gridTexture.destroy(true);
      app.destroy(true, { children: true });
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        background: '#181818',
        overflow: 'hidden',
      }}
    >
      {/* Info overlay */}
      <div
        ref={overlayRef}
        style={{
          position: 'absolute',
          top: 8,
          left: 8,
          padding: '4px 10px',
          background: 'rgba(0, 0, 0, 0.55)',
          borderRadius: 4,
          color: '#aaa',
          fontSize: 11,
          fontFamily: 'monospace',
          pointerEvents: 'none',
          zIndex: 10,
          whiteSpace: 'nowrap',
        }}
      >
        {compName} | Frame {currentFrame} / {compDuration}
      </div>
    </div>
  );
}

export default Viewport;
