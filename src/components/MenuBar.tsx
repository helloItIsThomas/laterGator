// ============================================================================
// Menu Bar — Top bar with playback controls and project info
// ============================================================================

import React from 'react';
import { useStore } from '../store';

export const MenuBar: React.FC = () => {
  const project = useStore((s) => s.project);
  const activeComp = useStore((s) => s.getActiveComposition());
  const currentFrame = useStore((s) => s.currentFrame);
  const isPlaying = useStore((s) => s.isPlaying);
  const actualFps = useStore((s) => s.actualFps);
  const workAreaIn = useStore((s) => s.workAreaIn);
  const workAreaOut = useStore((s) => s.workAreaOut);
  const compositionStack = useStore((s) => s.compositionStack);
  const setIsPlaying = useStore((s) => s.setIsPlaying);
  const setPlaybackStartFrame = useStore((s) => s.setPlaybackStartFrame);
  const setCurrentFrame = useStore((s) => s.setCurrentFrame);
  const exitPrecomp = useStore((s) => s.exitPrecomp);

  const fps = activeComp?.frameRate ?? 30;
  const seconds = Math.floor(currentFrame / fps);
  const frames = currentFrame % fps;
  const timecode = `${seconds}:${String(frames).padStart(2, '0')}`;

  const handlePlay = () => {
    if (!isPlaying) {
      setPlaybackStartFrame(currentFrame);
    }
    setIsPlaying(!isPlaying);
  };

  const handleStop = () => {
    setIsPlaying(false);
  };

  const handleStepBack = () => {
    setCurrentFrame(Math.max(0, currentFrame - 1));
  };

  const handleStepForward = () => {
    if (activeComp) {
      setCurrentFrame(Math.min(activeComp.duration - 1, currentFrame + 1));
    }
  };

  const handleGoStart = () => setCurrentFrame(workAreaIn);
  const handleGoEnd = () => setCurrentFrame(workAreaOut - 1);

  const handleUndo = () => {
    useStore.temporal.getState().undo();
  };

  const handleRedo = () => {
    useStore.temporal.getState().redo();
  };

  return (
    <div style={styles.container}>
      {/* Left: project name + breadcrumbs */}
      <div style={styles.left}>
        <span style={styles.logo}>LaterGator</span>
        <span style={styles.divider}>|</span>
        <span style={styles.projectName}>{project.name}</span>
        {compositionStack.length > 0 && (
          <>
            <span style={styles.divider}>›</span>
            <button style={styles.breadcrumb} onClick={exitPrecomp}>
              ← Back
            </button>
          </>
        )}
        {activeComp && (
          <>
            <span style={styles.divider}>›</span>
            <span style={styles.compName}>{activeComp.name}</span>
          </>
        )}
      </div>

      {/* Center: transport controls */}
      <div style={styles.center}>
        <button style={styles.transportBtn} onClick={handleGoStart} title="Go to start (Home)">
          ⏮
        </button>
        <button style={styles.transportBtn} onClick={handleStepBack} title="Step back (←)">
          ◀
        </button>
        <button
          style={{ ...styles.transportBtn, ...styles.playBtn, ...(isPlaying ? styles.playBtnActive : {}) }}
          onClick={handlePlay}
          title="Play/Pause (Space)"
        >
          {isPlaying ? '⏸' : '▶'}
        </button>
        <button style={styles.transportBtn} onClick={handleStepForward} title="Step forward (→)">
          ▶
        </button>
        <button style={styles.transportBtn} onClick={handleGoEnd} title="Go to end (End)">
          ⏭
        </button>
        <button style={styles.transportBtn} onClick={handleStop} title="Stop (Esc)">
          ⏹
        </button>
      </div>

      {/* Right: timecode + fps + undo/redo */}
      <div style={styles.right}>
        <button style={styles.actionBtn} onClick={handleUndo} title="Undo (Cmd+Z)">
          ↩
        </button>
        <button style={styles.actionBtn} onClick={handleRedo} title="Redo (Cmd+Shift+Z)">
          ↪
        </button>
        <span style={styles.divider}>|</span>
        <span style={styles.timecode}>{timecode}</span>
        <span style={styles.frameNum}>f{currentFrame}</span>
        {isPlaying && (
          <span style={{
            ...styles.fpsIndicator,
            color: actualFps < fps * 0.8 ? '#FFD43B' : '#69DB7C',
          }}>
            {Math.round(actualFps)}/{fps} fps
          </span>
        )}
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    height: 38,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 12px',
    backgroundColor: '#252525',
    borderBottom: '1px solid #333',
    flexShrink: 0,
    userSelect: 'none',
  },
  left: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  logo: {
    fontSize: 14,
    fontWeight: 700,
    color: '#4A9EFF',
    letterSpacing: -0.5,
  },
  projectName: {
    fontSize: 12,
    color: '#CCCCCC',
  },
  compName: {
    fontSize: 12,
    color: '#999',
  },
  breadcrumb: {
    background: 'none',
    border: 'none',
    color: '#4A9EFF',
    fontSize: 11,
    cursor: 'pointer',
    padding: 0,
  },
  divider: {
    color: '#444',
    fontSize: 12,
  },
  center: {
    display: 'flex',
    alignItems: 'center',
    gap: 2,
  },
  transportBtn: {
    background: 'none',
    border: '1px solid transparent',
    color: '#CCCCCC',
    fontSize: 14,
    cursor: 'pointer',
    padding: '2px 6px',
    borderRadius: 3,
    lineHeight: 1,
  },
  playBtn: {
    fontSize: 16,
    padding: '2px 10px',
  },
  playBtnActive: {
    color: '#4A9EFF',
    border: '1px solid #4A9EFF33',
    backgroundColor: '#4A9EFF11',
  },
  right: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    justifyContent: 'flex-end',
  },
  actionBtn: {
    background: 'none',
    border: 'none',
    color: '#CCCCCC',
    fontSize: 16,
    cursor: 'pointer',
    padding: '0 2px',
  },
  timecode: {
    fontFamily: 'monospace',
    fontSize: 14,
    color: '#CCCCCC',
    fontWeight: 600,
    minWidth: 50,
    textAlign: 'right' as const,
  },
  frameNum: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: '#666',
  },
  fpsIndicator: {
    fontFamily: 'monospace',
    fontSize: 10,
    padding: '1px 4px',
    borderRadius: 2,
    backgroundColor: '#2A2A2A',
  },
};
