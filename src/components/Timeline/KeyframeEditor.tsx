// ============================================================================
// LaterGator — KeyframeEditor (Konva keyframe diamond shapes)
// ============================================================================

import React, { useCallback, useRef } from 'react';
import { Group, RegularPolygon, Rect } from 'react-konva';
import type Konva from 'konva';
import type { Keyframe } from '../../types';

export interface KeyframeEditorProps {
  keyframe: Keyframe<any>;
  layerId: string;
  propertyPath: string;
  x: number;
  y: number;
  color: string;
  selected: boolean;
  zoom: number;
  onSelect: (kfId: string, additive: boolean) => void;
  onDragStart: (kfId: string) => void;
  onDragMove: (kfId: string, newFrame: number) => void;
  onDragEnd: (kfId: string) => void;
}

const KF_SIZE = 8;
const KF_HALF = KF_SIZE / 2;

export const KeyframeEditor: React.FC<KeyframeEditorProps> = React.memo(
  ({
    keyframe,
    layerId,
    propertyPath,
    x,
    y,
    color,
    selected,
    zoom,
    onSelect,
    onDragStart,
    onDragMove,
    onDragEnd,
  }) => {
    const compositeId = `${layerId}:${propertyPath}:${keyframe.id}`;
    const dragStartX = useRef(0);

    const fillColor = selected ? '#4A9EFF' : color;
    const strokeColor = selected ? '#FFFFFF' : undefined;
    const strokeWidth = selected ? 1 : 0;

    const handleClick = useCallback(
      (e: Konva.KonvaEventObject<MouseEvent>) => {
        e.cancelBubble = true;
        onSelect(compositeId, e.evt.shiftKey || e.evt.metaKey);
      },
      [compositeId, onSelect],
    );

    const handleDragStart = useCallback(
      (e: Konva.KonvaEventObject<DragEvent>) => {
        dragStartX.current = e.target.x();
        onDragStart(compositeId);
      },
      [compositeId, onDragStart],
    );

    const handleDragMove = useCallback(
      (e: Konva.KonvaEventObject<DragEvent>) => {
        const node = e.target;
        // Constrain to horizontal movement only
        node.y(y);
        const newFrame = Math.max(0, Math.round(node.x() / zoom));
        onDragMove(compositeId, newFrame);
      },
      [compositeId, y, zoom, onDragMove],
    );

    const handleDragEnd = useCallback(
      (e: Konva.KonvaEventObject<DragEvent>) => {
        const node = e.target;
        // Snap to frame
        const snappedFrame = Math.max(0, Math.round(node.x() / zoom));
        node.x(snappedFrame * zoom);
        onDragEnd(compositeId);
      },
      [compositeId, zoom, onDragEnd],
    );

    // Hold interpolation: filled square
    if (keyframe.interpolation === 'hold') {
      return (
        <Rect
          x={x - KF_HALF}
          y={y - KF_HALF}
          width={KF_SIZE}
          height={KF_SIZE}
          fill={fillColor}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          draggable
          onClick={handleClick}
          onTap={handleClick}
          onDragStart={handleDragStart}
          onDragMove={handleDragMove}
          onDragEnd={handleDragEnd}
          hitStrokeWidth={4}
        />
      );
    }

    // Linear interpolation: outlined diamond
    if (keyframe.interpolation === 'linear') {
      return (
        <RegularPolygon
          x={x}
          y={y}
          sides={4}
          radius={KF_HALF + 1}
          rotation={45}
          fill="transparent"
          stroke={fillColor}
          strokeWidth={1.5}
          draggable
          onClick={handleClick}
          onTap={handleClick}
          onDragStart={handleDragStart}
          onDragMove={handleDragMove}
          onDragEnd={handleDragEnd}
          hitStrokeWidth={4}
        />
      );
    }

    // Bezier interpolation: filled diamond
    return (
      <RegularPolygon
        x={x}
        y={y}
        sides={4}
        radius={KF_HALF + 1}
        rotation={45}
        fill={fillColor}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        draggable
        onClick={handleClick}
        onTap={handleClick}
        onDragStart={handleDragStart}
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
        hitStrokeWidth={4}
      />
    );
  },
);

KeyframeEditor.displayName = 'KeyframeEditor';
