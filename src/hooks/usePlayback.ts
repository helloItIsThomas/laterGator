// ============================================================================
// usePlayback — requestAnimationFrame-driven playback loop
// ============================================================================

import { useEffect, useRef } from 'react';
import { useStore } from '../store';

/**
 * Runs a rAF playback loop as a side effect.
 *
 * When `isPlaying` is true, the loop advances `currentFrame` based on
 * elapsed wall-clock time and the active composition's frame rate.
 * When `currentFrame` reaches `workAreaOut`, it wraps back to `workAreaIn`.
 *
 * Also tracks actual rendered FPS and pushes it to the store via `setActualFps`.
 */
export function usePlayback(): void {
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const startFrameRef = useRef<number>(0);
  const fpsFrameCountRef = useRef<number>(0);
  const fpsLastSampleRef = useRef<number>(0);

  const isPlaying = useStore((s) => s.isPlaying);

  useEffect(() => {
    if (!isPlaying) {
      // Not playing — ensure any lingering rAF is cancelled
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }

    // --- Start playback --------------------------------------------------

    const state = useStore.getState();
    const comp = state.getActiveComposition();
    const fps = comp?.frameRate ?? 30;
    const frameDuration = 1000 / fps; // ms per frame

    // Snapshot the starting frame so we can compute offset from wall-clock
    startFrameRef.current = state.currentFrame;
    startTimeRef.current = performance.now();
    fpsFrameCountRef.current = 0;
    fpsLastSampleRef.current = performance.now();

    // Store the playback start frame
    state.setPlaybackStartFrame(state.currentFrame);

    function tick(now: number) {
      const {
        workAreaIn,
        workAreaOut,
        setCurrentFrame,
        setActualFps,
      } = useStore.getState();

      // Calculate target frame from elapsed time
      const elapsed = now - startTimeRef.current;
      const frameOffset = Math.floor(elapsed / frameDuration);
      const workAreaLength = workAreaOut - workAreaIn;

      let targetFrame: number;
      if (workAreaLength <= 0) {
        // Degenerate work area — just stay put
        targetFrame = workAreaIn;
      } else {
        // Wrap within the work area
        const rawFrame = startFrameRef.current + frameOffset;
        const wrapped = workAreaIn + ((rawFrame - workAreaIn) % workAreaLength);
        targetFrame = wrapped;

        // If the computed frame wrapped, reset the time origin so we don't
        // accumulate floating-point drift over long playback sessions.
        if (rawFrame >= workAreaOut) {
          startTimeRef.current = now;
          startFrameRef.current = workAreaIn;
        }
      }

      setCurrentFrame(targetFrame);

      // --- FPS measurement ------------------------------------------------
      fpsFrameCountRef.current += 1;
      const fpsDelta = now - fpsLastSampleRef.current;
      if (fpsDelta >= 500) {
        const measuredFps = (fpsFrameCountRef.current / fpsDelta) * 1000;
        setActualFps(Math.round(measuredFps * 10) / 10);
        fpsFrameCountRef.current = 0;
        fpsLastSampleRef.current = now;
      }

      // Continue loop
      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);

    // --- Cleanup ---------------------------------------------------------

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [isPlaying]);
}

export default usePlayback;
