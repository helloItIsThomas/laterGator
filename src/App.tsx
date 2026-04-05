// ============================================================================
// LaterGator — App Shell
// ============================================================================

import React, { useEffect, useCallback, useRef, useState } from 'react';
import { useStore } from './store';
import { MenuBar } from './components/MenuBar';
import { ProjectPanel } from './components/ProjectPanel';
import { Viewport } from './components/Viewport';
import { Inspector } from './components/Inspector';
import { Timeline } from './components/Timeline/Timeline';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { usePlayback } from './hooks/usePlayback';
import { startAutosave, stopAutosave } from './persistence/storage';
import './App.css';

export const App: React.FC = () => {
  const project = useStore((s) => s.project);
  const activeCompositionId = useStore((s) => s.activeCompositionId);
  const setActiveComposition = useStore((s) => s.setActiveComposition);

  // Panel resize state
  const [leftWidth, setLeftWidth] = useState(200);
  const [rightWidth, setRightWidth] = useState(240);
  const [bottomHeight, setBottomHeight] = useState(280);

  // Initialize
  useEffect(() => {
    if (!activeCompositionId && project.compositions.length > 0) {
      setActiveComposition(project.compositions[0].id);
    }
  }, []);

  // Autosave
  useEffect(() => {
    startAutosave(() => useStore.getState().project, 30000);
    return () => stopAutosave();
  }, []);

  // Keyboard shortcuts + playback loop
  useKeyboardShortcuts();
  usePlayback();

  return (
    <div className="app">
      <MenuBar />
      <div className="app-body">
        {/* Left panel — Project */}
        <div className="panel-left" style={{ width: leftWidth }}>
          <ProjectPanel />
        </div>
        <PanelResizer
          direction="horizontal"
          onResize={(delta) => setLeftWidth((w) => Math.max(140, Math.min(360, w + delta)))}
        />

        {/* Center + Right */}
        <div className="panel-center-wrap">
          {/* Top area: Viewport + Inspector */}
          <div className="panel-top">
            <div className="viewport-area">
              <Viewport />
            </div>
            <PanelResizer
              direction="horizontal"
              onResize={(delta) => setRightWidth((w) => Math.max(180, Math.min(400, w - delta)))}
            />
            <div className="panel-right" style={{ width: rightWidth }}>
              <Inspector />
            </div>
          </div>

          {/* Horizontal resize between viewport and timeline */}
          <PanelResizer
            direction="vertical"
            onResize={(delta) => setBottomHeight((h) => Math.max(120, Math.min(600, h - delta)))}
          />

          {/* Bottom area: Timeline */}
          <div className="panel-bottom" style={{ height: bottomHeight }}>
            <Timeline />
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Resizable divider -------------------------------------------------------

const PanelResizer: React.FC<{
  direction: 'horizontal' | 'vertical';
  onResize: (delta: number) => void;
}> = ({ direction, onResize }) => {
  const dragging = useRef(false);
  const lastPos = useRef(0);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragging.current = true;
      lastPos.current = direction === 'horizontal' ? e.clientX : e.clientY;

      const handleMouseMove = (ev: MouseEvent) => {
        if (!dragging.current) return;
        const pos = direction === 'horizontal' ? ev.clientX : ev.clientY;
        const delta = pos - lastPos.current;
        lastPos.current = pos;
        onResize(delta);
      };

      const handleMouseUp = () => {
        dragging.current = false;
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };

      document.body.style.cursor =
        direction === 'horizontal' ? 'col-resize' : 'row-resize';
      document.body.style.userSelect = 'none';
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    },
    [direction, onResize],
  );

  return (
    <div
      className={`panel-resizer panel-resizer-${direction}`}
      onMouseDown={handleMouseDown}
    />
  );
};
