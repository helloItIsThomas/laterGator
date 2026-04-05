// ============================================================================
// Keyboard Shortcuts — tinykeys integration
// ============================================================================

import { useEffect } from 'react';
import { useStore } from '../store';

type Handler = (e: KeyboardEvent) => void;

export function useKeyboardShortcuts(): void {
  useEffect(() => {
    let cleanup: (() => void) | undefined;

    // @ts-ignore — tinykeys types don't resolve via package.json exports
    import('tinykeys').then((mod: any) => {
      const tinykeys = mod.default ?? mod.tinykeys ?? mod;
      const handlers: Record<string, Handler> = {
        // --- Transport -------------------------------------------------------
        Space: (e) => {
          e.preventDefault();
          const { isPlaying, currentFrame, setIsPlaying, setPlaybackStartFrame } = useStore.getState();
          if (!isPlaying) setPlaybackStartFrame(currentFrame);
          setIsPlaying(!isPlaying);
        },
        Escape: (e) => {
          const { isPlaying, playbackStartFrame, setIsPlaying, setCurrentFrame } = useStore.getState();
          if (isPlaying) {
            e.preventDefault();
            setIsPlaying(false);
            setCurrentFrame(playbackStartFrame);
          }
        },
        ArrowRight: (e) => {
          e.preventDefault();
          const { currentFrame, setCurrentFrame, getActiveComposition } = useStore.getState();
          const comp = getActiveComposition();
          if (comp) setCurrentFrame(Math.min(comp.duration - 1, currentFrame + 1));
        },
        ArrowLeft: (e) => {
          e.preventDefault();
          const { currentFrame, setCurrentFrame } = useStore.getState();
          setCurrentFrame(Math.max(0, currentFrame - 1));
        },
        'Shift+ArrowRight': (e) => {
          e.preventDefault();
          const { currentFrame, setCurrentFrame, getActiveComposition } = useStore.getState();
          const comp = getActiveComposition();
          if (comp) setCurrentFrame(Math.min(comp.duration - 1, currentFrame + 10));
        },
        'Shift+ArrowLeft': (e) => {
          e.preventDefault();
          const { currentFrame, setCurrentFrame } = useStore.getState();
          setCurrentFrame(Math.max(0, currentFrame - 10));
        },
        Home: (e) => {
          e.preventDefault();
          useStore.getState().setCurrentFrame(0);
        },
        End: (e) => {
          e.preventDefault();
          const comp = useStore.getState().getActiveComposition();
          if (comp) useStore.getState().setCurrentFrame(comp.duration - 1);
        },

        // --- Editing ---------------------------------------------------------
        '$mod+KeyZ': (e) => {
          e.preventDefault();
          useStore.temporal.getState().undo();
        },
        '$mod+Shift+KeyZ': (e) => {
          e.preventDefault();
          useStore.temporal.getState().redo();
        },
        '$mod+KeyD': (e) => {
          e.preventDefault();
          const { selectedLayerIds, duplicateLayer } = useStore.getState();
          for (const id of selectedLayerIds) {
            duplicateLayer(id);
          }
        },
        Delete: () => {
          handleDelete();
        },
        Backspace: () => {
          handleDelete();
        },
        '$mod+KeyA': (e) => {
          e.preventDefault();
          const { getActiveComposition, selectLayers } = useStore.getState();
          const comp = getActiveComposition();
          if (comp) selectLayers(comp.layers.map((l) => l.id), 'replace');
        },

        // --- Work area -------------------------------------------------------
        KeyI: () => {
          const { currentFrame, workAreaOut, setWorkArea } = useStore.getState();
          setWorkArea(currentFrame, workAreaOut);
        },
        KeyO: () => {
          const { currentFrame, workAreaIn, setWorkArea } = useStore.getState();
          setWorkArea(workAreaIn, currentFrame);
        },

        // --- Layer trim ------------------------------------------------------
        BracketLeft: () => {
          const { selectedLayerIds, currentFrame, updateLayer } = useStore.getState();
          for (const id of selectedLayerIds) updateLayer(id, { inPoint: currentFrame });
        },
        BracketRight: () => {
          const { selectedLayerIds, currentFrame, updateLayer } = useStore.getState();
          for (const id of selectedLayerIds) updateLayer(id, { outPoint: currentFrame });
        },

        // --- Zoom ------------------------------------------------------------
        Equal: (e) => {
          e.preventDefault();
          const { timelineZoom, setTimelineZoom } = useStore.getState();
          setTimelineZoom(timelineZoom * 1.2);
        },
        Minus: (e) => {
          e.preventDefault();
          const { timelineZoom, setTimelineZoom } = useStore.getState();
          setTimelineZoom(timelineZoom / 1.2);
        },
        Semicolon: (e) => {
          e.preventDefault();
          useStore.getState().setTimelineZoom(3);
          useStore.getState().setTimelineScroll(0, 0);
        },
      };

      cleanup = tinykeys(window, handlers);
    });

    return () => { cleanup?.(); };
  }, []);
}

function handleDelete(): void {
  const { selectedLayerIds, selectedKeyframeIds, removeLayer, removeKeyframe } = useStore.getState();
  if (selectedKeyframeIds.length > 0) {
    for (const kfId of selectedKeyframeIds) {
      const [layerId, propPath, keyframeId] = kfId.split(':');
      removeKeyframe(layerId, propPath, keyframeId);
    }
  } else if (selectedLayerIds.length > 0) {
    for (const id of [...selectedLayerIds]) {
      removeLayer(id);
    }
  }
}
