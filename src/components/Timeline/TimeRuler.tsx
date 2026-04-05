// ============================================================================
// LaterGator — TimeRuler (Konva Group for the time ruler area)
// ============================================================================

import React, { useCallback, useMemo, useRef } from 'react';
import { Group, Rect, Line, Text, RegularPolygon } from 'react-konva';
import type Konva from 'konva';

export interface TimeRulerProps {
  width: number;
  height: number;
  scrollX: number;
  zoom: number;
  currentFrame: number;
  duration: number;
  frameRate: number;
  workAreaIn: number;
  workAreaOut: number;
  onScrub: (frame: number) => void;
  onScrubStart: () => void;
  onScrubEnd: () => void;
  onWorkAreaInChange: (frame: number) => void;
  onWorkAreaOutChange: (frame: number) => void;
}

const RULER_HEIGHT = 28;
const PLAYHEAD_WIDTH = 12;
const PLAYHEAD_HEIGHT = 10;
const WORK_AREA_HANDLE_WIDTH = 6;

/** Format frame number as timecode HH:MM:SS:FF */
function formatTimecode(frame: number, fps: number): string {
  const totalSeconds = frame / fps;
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  const f = Math.floor(frame % fps);
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}:${String(f).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}:${String(f).padStart(2, '0')}`;
}

/** Compute adaptive tick interval based on zoom level */
function getTickInterval(zoom: number, fps: number): { major: number; minor: number } {
  // Target roughly 80-120px between major ticks
  const targetPxPerMajor = 100;
  const framesPerMajor = targetPxPerMajor / zoom;

  // Snap to nice frame intervals
  const candidates = [
    1, 2, 5, 10, fps / 2, fps, fps * 2, fps * 5, fps * 10,
    fps * 30, fps * 60,
  ];

  let major = fps;
  for (const c of candidates) {
    if (c * zoom >= 60) {
      major = c;
      break;
    }
  }

  // Minor ticks: subdivide
  let minor = 1;
  if (major >= fps * 10) minor = fps;
  else if (major >= fps * 2) minor = fps / 2;
  else if (major >= fps) minor = Math.max(1, Math.round(fps / 6));
  else if (major >= 10) minor = Math.max(1, Math.round(major / 5));
  else minor = 1;

  return { major, minor };
}

export const TimeRuler: React.FC<TimeRulerProps> = React.memo(
  ({
    width,
    height,
    scrollX,
    zoom,
    currentFrame,
    duration,
    frameRate,
    workAreaIn,
    workAreaOut,
    onScrub,
    onScrubStart,
    onScrubEnd,
    onWorkAreaInChange,
    onWorkAreaOutChange,
  }) => {
    const isScrubbing = useRef(false);

    // Compute visible range in frames
    const visibleStartFrame = Math.floor(scrollX / zoom);
    const visibleEndFrame = Math.ceil((scrollX + width) / zoom);

    const { major: majorInterval, minor: minorInterval } = useMemo(
      () => getTickInterval(zoom, frameRate),
      [zoom, frameRate],
    );

    // Build tick marks
    const ticks = useMemo(() => {
      const items: { frame: number; isMajor: boolean }[] = [];
      const start = Math.max(0, Math.floor(visibleStartFrame / minorInterval) * minorInterval);
      const end = Math.min(duration, visibleEndFrame + minorInterval);

      for (let f = start; f <= end; f += minorInterval) {
        const isMajor = f % majorInterval === 0 || f === 0;
        items.push({ frame: f, isMajor });
      }
      return items;
    }, [visibleStartFrame, visibleEndFrame, minorInterval, majorInterval, duration]);

    // Build labels (only for major ticks, cull overlapping)
    const labels = useMemo(() => {
      const items: { frame: number; text: string; x: number }[] = [];
      const minSpacing = 60; // min px between labels
      let lastLabelX = -Infinity;

      for (const tick of ticks) {
        if (!tick.isMajor) continue;
        const x = tick.frame * zoom - scrollX;
        if (x - lastLabelX < minSpacing && lastLabelX > -Infinity) continue;
        items.push({
          frame: tick.frame,
          text: formatTimecode(tick.frame, frameRate),
          x,
        });
        lastLabelX = x;
      }
      return items;
    }, [ticks, zoom, scrollX, frameRate]);

    // Scrub handlers
    const frameFromX = useCallback(
      (clientX: number) => {
        const frame = Math.round((clientX + scrollX) / zoom);
        return Math.max(0, Math.min(duration, frame));
      },
      [scrollX, zoom, duration],
    );

    const handleRulerMouseDown = useCallback(
      (e: Konva.KonvaEventObject<MouseEvent>) => {
        // Only handle clicks on the ruler background, not on handles
        const pos = e.target.getStage()?.getPointerPosition();
        if (!pos) return;
        isScrubbing.current = true;
        onScrubStart();
        const frame = frameFromX(pos.x);
        onScrub(frame);
      },
      [frameFromX, onScrub, onScrubStart],
    );

    const handleRulerMouseMove = useCallback(
      (e: Konva.KonvaEventObject<MouseEvent>) => {
        if (!isScrubbing.current) return;
        const pos = e.target.getStage()?.getPointerPosition();
        if (!pos) return;
        const frame = frameFromX(pos.x);
        onScrub(frame);
      },
      [frameFromX, onScrub],
    );

    const handleRulerMouseUp = useCallback(() => {
      if (isScrubbing.current) {
        isScrubbing.current = false;
        onScrubEnd();
      }
    }, [onScrubEnd]);

    // Work area positions
    const workInX = workAreaIn * zoom - scrollX;
    const workOutX = workAreaOut * zoom - scrollX;
    const playheadX = currentFrame * zoom - scrollX;

    return (
      <Group>
        {/* Background */}
        <Rect
          x={0}
          y={0}
          width={width}
          height={RULER_HEIGHT}
          fill="#2D2D2D"
          onMouseDown={handleRulerMouseDown}
          onMouseMove={handleRulerMouseMove}
          onMouseUp={handleRulerMouseUp}
          onMouseLeave={handleRulerMouseUp}
        />

        {/* Work area highlight */}
        <Rect
          x={Math.max(0, workInX)}
          y={RULER_HEIGHT - 4}
          width={Math.max(0, workOutX - Math.max(0, workInX))}
          height={4}
          fill="rgba(74,158,255,0.3)"
          listening={false}
        />

        {/* Tick marks */}
        {ticks.map((tick) => {
          const x = tick.frame * zoom - scrollX;
          if (x < -10 || x > width + 10) return null;
          return (
            <Line
              key={`tick-${tick.frame}`}
              points={[
                x,
                tick.isMajor ? RULER_HEIGHT - 14 : RULER_HEIGHT - 8,
                x,
                RULER_HEIGHT,
              ]}
              stroke={tick.isMajor ? '#666666' : '#444444'}
              strokeWidth={1}
              listening={false}
            />
          );
        })}

        {/* Frame/timecode labels */}
        {labels.map((label) => (
          <Text
            key={`label-${label.frame}`}
            x={label.x + 3}
            y={2}
            text={label.text}
            fontSize={10}
            fontFamily="monospace"
            fill="#999999"
            listening={false}
          />
        ))}

        {/* Work area in handle */}
        <Rect
          x={workInX - WORK_AREA_HANDLE_WIDTH / 2}
          y={0}
          width={WORK_AREA_HANDLE_WIDTH}
          height={RULER_HEIGHT}
          fill="#4A9EFF"
          opacity={0.7}
          cornerRadius={1}
          draggable
          dragBoundFunc={(pos) => ({
            x: Math.max(
              -WORK_AREA_HANDLE_WIDTH / 2,
              Math.min(workOutX - WORK_AREA_HANDLE_WIDTH, pos.x),
            ),
            y: 0,
          })}
          onDragMove={(e) => {
            const x = e.target.x() + WORK_AREA_HANDLE_WIDTH / 2;
            const frame = Math.max(0, Math.round((x + scrollX) / zoom));
            onWorkAreaInChange(frame);
          }}
          onMouseEnter={(e) => {
            const stage = e.target.getStage();
            if (stage) stage.container().style.cursor = 'ew-resize';
          }}
          onMouseLeave={(e) => {
            const stage = e.target.getStage();
            if (stage) stage.container().style.cursor = 'default';
          }}
        />

        {/* Work area out handle */}
        <Rect
          x={workOutX - WORK_AREA_HANDLE_WIDTH / 2}
          y={0}
          width={WORK_AREA_HANDLE_WIDTH}
          height={RULER_HEIGHT}
          fill="#4A9EFF"
          opacity={0.7}
          cornerRadius={1}
          draggable
          dragBoundFunc={(pos) => ({
            x: Math.max(
              workInX,
              Math.min(duration * zoom - scrollX, pos.x),
            ),
            y: 0,
          })}
          onDragMove={(e) => {
            const x = e.target.x() + WORK_AREA_HANDLE_WIDTH / 2;
            const frame = Math.min(
              duration,
              Math.max(workAreaIn + 1, Math.round((x + scrollX) / zoom)),
            );
            onWorkAreaOutChange(frame);
          }}
          onMouseEnter={(e) => {
            const stage = e.target.getStage();
            if (stage) stage.container().style.cursor = 'ew-resize';
          }}
          onMouseLeave={(e) => {
            const stage = e.target.getStage();
            if (stage) stage.container().style.cursor = 'default';
          }}
        />

        {/* Playhead triangle */}
        <RegularPolygon
          x={playheadX}
          y={4}
          sides={3}
          radius={PLAYHEAD_HEIGHT / 2}
          rotation={180}
          fill="#4A9EFF"
          listening={false}
        />

        {/* Playhead vertical line extending from triangle down to ruler bottom */}
        <Line
          points={[playheadX, 4, playheadX, RULER_HEIGHT]}
          stroke="#4A9EFF"
          strokeWidth={1}
          listening={false}
        />
      </Group>
    );
  },
);

TimeRuler.displayName = 'TimeRuler';

export { RULER_HEIGHT };
