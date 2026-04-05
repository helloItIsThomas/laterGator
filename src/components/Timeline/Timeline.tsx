// ============================================================================
// LaterGator — Timeline (main container)
// ============================================================================

import React, { useRef, useCallback, useEffect, useState } from 'react';
import { Stage, Layer as KonvaLayer } from 'react-konva';
import { useStore } from '../../store';
import { TimeRuler } from './TimeRuler';
import { LayerHeaders } from './LayerHeaders';
import { LayerTracks } from './LayerTracks';

const RULER_HEIGHT = 28;

export const Timeline: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 280 });

  const activeComp = useStore((s) => s.getActiveComposition());
  const headerWidth = useStore((s) => s.headerWidth);
  const timelineScrollX = useStore((s) => s.timelineScrollX);
  const timelineScrollY = useStore((s) => s.timelineScrollY);
  const timelineZoom = useStore((s) => s.timelineZoom);
  const currentFrame = useStore((s) => s.currentFrame);
  const workAreaIn = useStore((s) => s.workAreaIn);
  const workAreaOut = useStore((s) => s.workAreaOut);
  const setTimelineScroll = useStore((s) => s.setTimelineScroll);
  const setTimelineZoom = useStore((s) => s.setTimelineZoom);
  const setCurrentFrame = useStore((s) => s.setCurrentFrame);
  const setWorkArea = useStore((s) => s.setWorkArea);

  // Resize observer
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const tracksWidth = dimensions.width - headerWidth;
  const tracksHeight = dimensions.height - RULER_HEIGHT;

  // Scroll / zoom callbacks for LayerTracks
  const handleScroll = useCallback(
    (dx: number, dy: number) => {
      setTimelineScroll(
        Math.max(0, timelineScrollX + dx),
        Math.max(0, timelineScrollY + dy),
      );
    },
    [timelineScrollX, timelineScrollY, setTimelineScroll],
  );

  const handleZoom = useCallback(
    (newZoom: number, _pivotFrame: number) => {
      setTimelineZoom(newZoom);
    },
    [setTimelineZoom],
  );

  // Scrub callbacks for TimeRuler
  const handleScrub = useCallback(
    (frame: number) => setCurrentFrame(Math.max(0, frame)),
    [setCurrentFrame],
  );
  const noop = useCallback(() => {}, []);

  if (!activeComp) {
    return (
      <div ref={containerRef} style={styles.container}>
        <div style={styles.empty}>Open a composition to see its timeline</div>
      </div>
    );
  }

  return (
    <div ref={containerRef} style={styles.container}>
      {/* Time ruler row */}
      <div style={{ display: 'flex', height: RULER_HEIGHT }}>
        {/* Corner (above layer headers) */}
        <div
          style={{
            width: headerWidth,
            height: RULER_HEIGHT,
            backgroundColor: '#2D2D2D',
            borderBottom: '1px solid #444',
            borderRight: '1px solid #333',
            display: 'flex',
            alignItems: 'center',
            padding: '0 8px',
            fontSize: 10,
            color: '#666',
            flexShrink: 0,
          }}
        >
          {activeComp.name}
        </div>
        {/* Time ruler (Konva) */}
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          <Stage width={tracksWidth} height={RULER_HEIGHT}>
            <KonvaLayer>
              <TimeRuler
                width={tracksWidth}
                height={RULER_HEIGHT}
                scrollX={timelineScrollX}
                zoom={timelineZoom}
                currentFrame={currentFrame}
                duration={activeComp.duration}
                frameRate={activeComp.frameRate}
                workAreaIn={workAreaIn}
                workAreaOut={workAreaOut}
                onScrub={handleScrub}
                onScrubStart={noop}
                onScrubEnd={noop}
                onWorkAreaInChange={(f) => setWorkArea(f, workAreaOut)}
                onWorkAreaOutChange={(f) => setWorkArea(workAreaIn, f)}
              />
            </KonvaLayer>
          </Stage>
        </div>
      </div>

      {/* Main area: headers + tracks */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Layer headers (HTML) */}
        <div
          style={{
            width: headerWidth,
            overflow: 'hidden',
            flexShrink: 0,
            borderRight: '1px solid #333',
          }}
        >
          <LayerHeaders width={headerWidth} scrollY={timelineScrollY} />
        </div>

        {/* Layer tracks (Konva — renders its own Stage) */}
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          <LayerTracks
            width={tracksWidth}
            height={tracksHeight}
            scrollX={timelineScrollX}
            scrollY={timelineScrollY}
            zoom={timelineZoom}
            onScroll={handleScroll}
            onZoom={handleZoom}
          />
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#1E1E1E',
    overflow: 'hidden',
    userSelect: 'none',
  },
  empty: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: '#666',
    fontSize: 13,
  },
};
