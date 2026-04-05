// ============================================================================
// LaterGator — LayerTracks (Konva Stage for track area)
// ============================================================================

import React, { useCallback, useRef, useMemo, useState } from 'react';
import { Stage, Layer as KonvaLayer, Rect, Line, Group, Text } from 'react-konva';
import type Konva from 'konva';
import type { Layer, AnimatableProperty, Keyframe as KFType } from '../../types';
import { useStore } from '../../store';
import { KeyframeEditor } from './KeyframeEditor';
import {
  ROW_HEIGHT,
  PROPERTY_ROW_HEIGHT,
  getLayerTotalHeight,
  getLayerYOffsets,
  getTotalLayersHeight,
} from './LayerHeaders';

// --- Constants ---------------------------------------------------------------

const BAR_VERTICAL_PADDING = 4;
const BAR_CORNER_RADIUS = 4;
const TRIM_HANDLE_WIDTH = 6;
const SNAP_THRESHOLD_PX = 6;

// --- Property group layout (must match LayerHeaders) -------------------------

interface PropertyRow {
  layerId: string;
  layerColor: string;
  propertyPath: string;
  propertyName: string;
  animProp: AnimatableProperty<any>;
  y: number; // absolute y offset
}

function collectPropertyRows(
  layers: Layer[],
  expandedLayers: Record<string, boolean>,
  expandedGroups: Record<string, boolean>,
): PropertyRow[] {
  const rows: PropertyRow[] = [];
  const offsets = getLayerYOffsets(layers, expandedLayers, expandedGroups);

  for (const layer of layers) {
    if (!expandedLayers[layer.id]) continue;

    const baseY = offsets.get(layer.id)!;
    let rowY = baseY + ROW_HEIGHT; // skip header row

    // Transform group
    const transformGroupKey = `${layer.id}:Transform`;
    rowY += PROPERTY_ROW_HEIGHT; // group header
    if (expandedGroups[transformGroupKey]) {
      const props: { name: string; path: string; prop: AnimatableProperty<any> }[] = [
        { name: 'Anchor Point', path: 'transform.anchorPoint', prop: layer.transform.anchorPoint },
        { name: 'Position', path: 'transform.position', prop: layer.transform.position },
        { name: 'Scale', path: 'transform.scale', prop: layer.transform.scale },
        { name: 'Rotation', path: 'transform.rotation', prop: layer.transform.rotation },
        { name: 'Opacity', path: 'transform.opacity', prop: layer.transform.opacity },
      ];
      for (const p of props) {
        rows.push({
          layerId: layer.id,
          layerColor: layer.color,
          propertyPath: p.path,
          propertyName: p.name,
          animProp: p.prop,
          y: rowY,
        });
        rowY += PROPERTY_ROW_HEIGHT;
      }
    }

    // Effects group
    if (layer.effects.length > 0) {
      const effectsGroupKey = `${layer.id}:Effects`;
      rowY += PROPERTY_ROW_HEIGHT; // group header
      if (expandedGroups[effectsGroupKey]) {
        for (const eff of layer.effects) {
          for (const [paramName, param] of Object.entries(eff.params)) {
            rows.push({
              layerId: layer.id,
              layerColor: layer.color,
              propertyPath: `effects.${eff.id}.${paramName}`,
              propertyName: `${eff.type} > ${paramName}`,
              animProp: param,
              y: rowY,
            });
            rowY += PROPERTY_ROW_HEIGHT;
          }
        }
      }
    }
  }

  return rows;
}

// --- Selection box state -----------------------------------------------------

interface SelectionBox {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

// --- Drag state for bars -----------------------------------------------------

type DragMode = 'slide' | 'trim-in' | 'trim-out' | null;

interface BarDragState {
  layerId: string;
  mode: DragMode;
  startMouseX: number;
  originalIn: number;
  originalOut: number;
}

// --- Component ---------------------------------------------------------------

export interface LayerTracksProps {
  width: number;
  height: number;
  scrollX: number;
  scrollY: number;
  zoom: number;
  onScroll: (dx: number, dy: number) => void;
  onZoom: (newZoom: number, pivotFrame: number) => void;
}

export const LayerTracks: React.FC<LayerTracksProps> = React.memo(
  ({ width, height, scrollX, scrollY, zoom, onScroll, onZoom }) => {
    const composition = useStore((s) => s.getActiveComposition());
    const currentFrame = useStore((s) => s.currentFrame);
    const selectedLayerIds = useStore((s) => s.selectedLayerIds);
    const selectedKeyframeIds = useStore((s) => s.selectedKeyframeIds);
    const expandedLayers = useStore((s) => s.expandedLayers);
    const expandedGroups = useStore((s) => s.expandedGroups);
    const {
      selectLayers,
      selectKeyframes,
      clearSelection,
      updateLayer,
      setCurrentFrame,
      moveKeyframes,
    } = useStore();

    const stageRef = useRef<Konva.Stage>(null);
    const [selectionBox, setSelectionBox] = useState<SelectionBox | null>(null);
    const [barDrag, setBarDrag] = useState<BarDragState | null>(null);
    const [snapGuideX, setSnapGuideX] = useState<number | null>(null);

    const layers = composition?.layers ?? [];
    const duration = composition?.duration ?? 150;

    // Compute layout
    const layerOffsets = useMemo(
      () => getLayerYOffsets(layers, expandedLayers, expandedGroups),
      [layers, expandedLayers, expandedGroups],
    );

    const totalHeight = useMemo(
      () => getTotalLayersHeight(layers, expandedLayers, expandedGroups),
      [layers, expandedLayers, expandedGroups],
    );

    const propertyRows = useMemo(
      () => collectPropertyRows(layers, expandedLayers, expandedGroups),
      [layers, expandedLayers, expandedGroups],
    );

    // --- Wheel handler (zoom + scroll) ---
    const handleWheel = useCallback(
      (e: Konva.KonvaEventObject<WheelEvent>) => {
        e.evt.preventDefault();
        const evt = e.evt;

        if (evt.metaKey || evt.ctrlKey) {
          // Zoom
          const pointer = stageRef.current?.getPointerPosition();
          const pivotX = (pointer?.x ?? 0) + scrollX;
          const pivotFrame = pivotX / zoom;
          const zoomFactor = evt.deltaY < 0 ? 1.15 : 1 / 1.15;
          const newZoom = Math.max(0.5, Math.min(20, zoom * zoomFactor));
          onZoom(newZoom, pivotFrame);
        } else if (evt.shiftKey) {
          // Horizontal scroll
          onScroll(evt.deltaY, 0);
        } else {
          // Vertical scroll
          onScroll(evt.deltaX, evt.deltaY);
        }
      },
      [zoom, scrollX, onScroll, onZoom],
    );

    // --- Background stripes ---
    const backgroundStripes = useMemo(() => {
      const stripes: React.ReactNode[] = [];
      layers.forEach((layer, index) => {
        const y = (layerOffsets.get(layer.id) ?? 0) - scrollY;
        const h = getLayerTotalHeight(layer, !!expandedLayers[layer.id], expandedGroups);
        if (y + h < 0 || y > height) return; // cull
        stripes.push(
          <Rect
            key={`stripe-${layer.id}`}
            x={0}
            y={y}
            width={width}
            height={h}
            fill={index % 2 === 0 ? '#1E1E1E' : '#222222'}
            listening={false}
          />,
        );
      });
      return stripes;
    }, [layers, layerOffsets, scrollY, height, width, expandedLayers, expandedGroups]);

    // --- Grid lines ---
    const gridLines = useMemo(() => {
      const lines: React.ReactNode[] = [];
      // Vertical grid lines (adaptive based on zoom)
      let frameStep = 1;
      if (zoom < 2) frameStep = 30;
      else if (zoom < 4) frameStep = 10;
      else if (zoom < 8) frameStep = 5;
      else if (zoom < 15) frameStep = 2;

      const startFrame = Math.max(0, Math.floor(scrollX / zoom / frameStep) * frameStep);
      const endFrame = Math.min(duration, Math.ceil((scrollX + width) / zoom / frameStep) * frameStep + frameStep);

      for (let f = startFrame; f <= endFrame; f += frameStep) {
        const x = f * zoom - scrollX;
        if (x < 0 || x > width) continue;
        lines.push(
          <Line
            key={`vgrid-${f}`}
            points={[x, 0, x, Math.max(height, totalHeight - scrollY)]}
            stroke="#333333"
            strokeWidth={0.5}
            listening={false}
          />,
        );
      }

      // Horizontal grid lines at row boundaries
      layers.forEach((layer) => {
        const y = (layerOffsets.get(layer.id) ?? 0) - scrollY;
        const h = getLayerTotalHeight(layer, !!expandedLayers[layer.id], expandedGroups);
        if (y + h < 0 || y > height) return;
        lines.push(
          <Line
            key={`hgrid-${layer.id}`}
            points={[0, y + h, width, y + h]}
            stroke="#2A2A2A"
            strokeWidth={0.5}
            listening={false}
          />,
        );
      });

      return lines;
    }, [zoom, scrollX, width, height, duration, layers, layerOffsets, scrollY, totalHeight, expandedLayers, expandedGroups]);

    // --- Snap computation ---
    const computeSnap = useCallback(
      (frame: number, excludeLayerId?: string): number | null => {
        const snapFrames: number[] = [0, duration, currentFrame];
        for (const layer of layers) {
          if (layer.id === excludeLayerId) continue;
          snapFrames.push(layer.inPoint, layer.outPoint);
        }
        for (const target of snapFrames) {
          if (Math.abs((frame - target) * zoom) < SNAP_THRESHOLD_PX) {
            return target;
          }
        }
        return null;
      },
      [layers, duration, currentFrame, zoom],
    );

    // --- Bar interactions ---
    const handleBarMouseDown = useCallback(
      (e: Konva.KonvaEventObject<MouseEvent>, layer: Layer) => {
        if (layer.locked) return;
        e.cancelBubble = true;

        const stage = e.target.getStage();
        if (!stage) return;
        const pos = stage.getPointerPosition();
        if (!pos) return;

        // Determine drag mode
        const barLeft = layer.inPoint * zoom - scrollX;
        const barRight = layer.outPoint * zoom - scrollX;
        const relX = pos.x;

        let mode: DragMode = 'slide';
        if (relX < barLeft + TRIM_HANDLE_WIDTH) {
          mode = 'trim-in';
        } else if (relX > barRight - TRIM_HANDLE_WIDTH) {
          mode = 'trim-out';
        }

        // Select layer
        const selectMode = e.evt.shiftKey || e.evt.metaKey ? 'toggle' : 'replace';
        selectLayers([layer.id], selectMode);

        setBarDrag({
          layerId: layer.id,
          mode,
          startMouseX: pos.x + scrollX,
          originalIn: layer.inPoint,
          originalOut: layer.outPoint,
        });
      },
      [zoom, scrollX, selectLayers],
    );

    const handleStageMouseMove = useCallback(
      (e: Konva.KonvaEventObject<MouseEvent>) => {
        const pos = e.target.getStage()?.getPointerPosition();
        if (!pos) return;

        // Bar drag
        if (barDrag) {
          const dx = (pos.x + scrollX) - barDrag.startMouseX;
          const deltaFrames = Math.round(dx / zoom);

          if (barDrag.mode === 'slide') {
            let newIn = barDrag.originalIn + deltaFrames;
            let newOut = barDrag.originalOut + deltaFrames;
            // Clamp
            if (newIn < 0) {
              newOut -= newIn;
              newIn = 0;
            }
            // Snap in-point
            const snapIn = computeSnap(newIn, barDrag.layerId);
            if (snapIn !== null) {
              const shift = snapIn - newIn;
              newIn = snapIn;
              newOut += shift;
              setSnapGuideX(snapIn * zoom - scrollX);
            } else {
              // Snap out-point
              const snapOut = computeSnap(newOut, barDrag.layerId);
              if (snapOut !== null) {
                const shift = snapOut - newOut;
                newOut = snapOut;
                newIn += shift;
                setSnapGuideX(snapOut * zoom - scrollX);
              } else {
                setSnapGuideX(null);
              }
            }
            updateLayer(barDrag.layerId, { inPoint: newIn, outPoint: newOut });
          } else if (barDrag.mode === 'trim-in') {
            let newIn = barDrag.originalIn + deltaFrames;
            newIn = Math.max(0, Math.min(barDrag.originalOut - 1, newIn));
            const snapIn = computeSnap(newIn, barDrag.layerId);
            if (snapIn !== null && snapIn < barDrag.originalOut) {
              newIn = snapIn;
              setSnapGuideX(snapIn * zoom - scrollX);
            } else {
              setSnapGuideX(null);
            }
            updateLayer(barDrag.layerId, { inPoint: newIn });
          } else if (barDrag.mode === 'trim-out') {
            let newOut = barDrag.originalOut + deltaFrames;
            newOut = Math.max(barDrag.originalIn + 1, newOut);
            const snapOut = computeSnap(newOut, barDrag.layerId);
            if (snapOut !== null && snapOut > barDrag.originalIn) {
              newOut = snapOut;
              setSnapGuideX(snapOut * zoom - scrollX);
            } else {
              setSnapGuideX(null);
            }
            updateLayer(barDrag.layerId, { outPoint: newOut });
          }
          return;
        }

        // Selection box
        if (selectionBox) {
          setSelectionBox((prev) =>
            prev
              ? { ...prev, currentX: pos.x + scrollX, currentY: pos.y + scrollY }
              : null,
          );
        }
      },
      [barDrag, selectionBox, scrollX, scrollY, zoom, computeSnap, updateLayer],
    );

    const handleStageMouseUp = useCallback(() => {
      // End bar drag
      if (barDrag) {
        setBarDrag(null);
        setSnapGuideX(null);
        return;
      }

      // End selection box
      if (selectionBox) {
        const box = {
          left: Math.min(selectionBox.startX, selectionBox.currentX),
          right: Math.max(selectionBox.startX, selectionBox.currentX),
          top: Math.min(selectionBox.startY, selectionBox.currentY),
          bottom: Math.max(selectionBox.startY, selectionBox.currentY),
        };

        // Find keyframes within box
        const hitIds: string[] = [];
        for (const row of propertyRows) {
          const rowCenterY = row.y + PROPERTY_ROW_HEIGHT / 2;
          if (rowCenterY < box.top || rowCenterY > box.bottom) continue;

          for (const kf of row.animProp.keyframes) {
            const kfX = kf.time * zoom;
            if (kfX >= box.left && kfX <= box.right) {
              hitIds.push(`${row.layerId}:${row.propertyPath}:${kf.id}`);
            }
          }
        }

        if (hitIds.length > 0) {
          selectKeyframes(hitIds, 'replace');
        }

        setSelectionBox(null);
      }
    }, [barDrag, selectionBox, propertyRows, zoom, selectKeyframes]);

    const handleStageMouseDown = useCallback(
      (e: Konva.KonvaEventObject<MouseEvent>) => {
        // Only start selection box on empty area (the Stage background)
        if (e.target !== e.target.getStage()) return;

        const pos = e.target.getStage()?.getPointerPosition();
        if (!pos) return;

        const absX = pos.x + scrollX;
        const absY = pos.y + scrollY;

        clearSelection();
        setSelectionBox({
          startX: absX,
          startY: absY,
          currentX: absX,
          currentY: absY,
        });
      },
      [scrollX, scrollY, clearSelection],
    );

    // --- Keyframe handlers ---
    const handleKeyframeSelect = useCallback(
      (kfId: string, additive: boolean) => {
        selectKeyframes([kfId], additive ? 'toggle' : 'replace');
      },
      [selectKeyframes],
    );

    const handleKeyframeDragStart = useCallback((_kfId: string) => {
      // Could store initial positions for multi-select drag
    }, []);

    const handleKeyframeDragMove = useCallback(
      (_kfId: string, _newFrame: number) => {
        // Real-time visual feedback handled by Konva's drag
      },
      [],
    );

    const handleKeyframeDragEnd = useCallback(
      (kfId: string) => {
        // Parse the composite ID to get the actual new position
        // For now, the keyframe editor handles position via its own drag
      },
      [],
    );

    // --- Render layer bars ---
    const layerBars = useMemo(() => {
      const bars: React.ReactNode[] = [];

      layers.forEach((layer) => {
        const y = (layerOffsets.get(layer.id) ?? 0) - scrollY;
        if (y + ROW_HEIGHT < 0 || y > height) return; // cull

        const barX = layer.inPoint * zoom - scrollX;
        const barWidth = (layer.outPoint - layer.inPoint) * zoom;
        const isSelected = selectedLayerIds.includes(layer.id);
        const opacity = isSelected ? 0.8 : 0.6;

        bars.push(
          <Group key={`bar-${layer.id}`}>
            {/* Main bar body */}
            <Rect
              x={barX}
              y={y + BAR_VERTICAL_PADDING}
              width={Math.max(barWidth, 2)}
              height={ROW_HEIGHT - BAR_VERTICAL_PADDING * 2}
              fill={layer.color}
              opacity={opacity}
              cornerRadius={BAR_CORNER_RADIUS}
              stroke={isSelected ? '#4A9EFF' : undefined}
              strokeWidth={isSelected ? 1.5 : 0}
              onMouseDown={(e) => handleBarMouseDown(e, layer)}
              onMouseEnter={(e) => {
                const stage = e.target.getStage();
                if (stage) stage.container().style.cursor = 'pointer';
              }}
              onMouseLeave={(e) => {
                if (!barDrag) {
                  const stage = e.target.getStage();
                  if (stage) stage.container().style.cursor = 'default';
                }
              }}
            />

            {/* Trim handle left */}
            <Rect
              x={barX}
              y={y + BAR_VERTICAL_PADDING}
              width={TRIM_HANDLE_WIDTH}
              height={ROW_HEIGHT - BAR_VERTICAL_PADDING * 2}
              fill="transparent"
              cornerRadius={[BAR_CORNER_RADIUS, 0, 0, BAR_CORNER_RADIUS]}
              onMouseEnter={(e) => {
                const stage = e.target.getStage();
                if (stage) stage.container().style.cursor = 'ew-resize';
              }}
              onMouseLeave={(e) => {
                if (!barDrag) {
                  const stage = e.target.getStage();
                  if (stage) stage.container().style.cursor = 'default';
                }
              }}
            />

            {/* Trim handle right */}
            <Rect
              x={barX + barWidth - TRIM_HANDLE_WIDTH}
              y={y + BAR_VERTICAL_PADDING}
              width={TRIM_HANDLE_WIDTH}
              height={ROW_HEIGHT - BAR_VERTICAL_PADDING * 2}
              fill="transparent"
              cornerRadius={[0, BAR_CORNER_RADIUS, BAR_CORNER_RADIUS, 0]}
              onMouseEnter={(e) => {
                const stage = e.target.getStage();
                if (stage) stage.container().style.cursor = 'ew-resize';
              }}
              onMouseLeave={(e) => {
                if (!barDrag) {
                  const stage = e.target.getStage();
                  if (stage) stage.container().style.cursor = 'default';
                }
              }}
            />

            {/* Layer name label on bar (if wide enough) */}
            {barWidth > 60 && (
              <Text
                x={barX + 8}
                y={y + BAR_VERTICAL_PADDING + 3}
                text={layer.name}
                fontSize={10}
                fill="#FFFFFF"
                opacity={0.8}
                width={barWidth - 16}
                ellipsis
                wrap="none"
                listening={false}
              />
            )}
          </Group>,
        );
      });

      return bars;
    }, [layers, layerOffsets, scrollY, scrollX, zoom, height, selectedLayerIds, handleBarMouseDown, barDrag]);

    // --- Render keyframes ---
    const keyframeElements = useMemo(() => {
      const elements: React.ReactNode[] = [];

      for (const row of propertyRows) {
        const rowCenterY = row.y - scrollY + PROPERTY_ROW_HEIGHT / 2;
        if (rowCenterY < -10 || rowCenterY > height + 10) continue; // cull

        // Connecting line between keyframes
        if (row.animProp.keyframes.length > 1) {
          const points: number[] = [];
          for (const kf of row.animProp.keyframes) {
            const x = kf.time * zoom - scrollX;
            points.push(x, rowCenterY);
          }
          elements.push(
            <Line
              key={`kf-line-${row.layerId}-${row.propertyPath}`}
              points={points}
              stroke={row.layerColor}
              strokeWidth={1}
              opacity={0.4}
              listening={false}
            />,
          );
        }

        // Keyframe diamonds
        for (const kf of row.animProp.keyframes) {
          const x = kf.time * zoom - scrollX;
          if (x < -20 || x > width + 20) continue; // cull
          const compositeId = `${row.layerId}:${row.propertyPath}:${kf.id}`;
          const isSelected = selectedKeyframeIds.includes(compositeId);

          elements.push(
            <KeyframeEditor
              key={compositeId}
              keyframe={kf}
              layerId={row.layerId}
              propertyPath={row.propertyPath}
              x={x}
              y={rowCenterY}
              color={row.layerColor}
              selected={isSelected}
              zoom={zoom}
              onSelect={handleKeyframeSelect}
              onDragStart={handleKeyframeDragStart}
              onDragMove={handleKeyframeDragMove}
              onDragEnd={handleKeyframeDragEnd}
            />,
          );
        }
      }

      return elements;
    }, [
      propertyRows,
      scrollX,
      scrollY,
      zoom,
      width,
      height,
      selectedKeyframeIds,
      handleKeyframeSelect,
      handleKeyframeDragStart,
      handleKeyframeDragMove,
      handleKeyframeDragEnd,
    ]);

    // --- Playhead line ---
    const playheadX = currentFrame * zoom - scrollX;

    // --- Selection box rendering ---
    const selectionBoxRect = useMemo(() => {
      if (!selectionBox) return null;
      return {
        x: Math.min(selectionBox.startX, selectionBox.currentX) - scrollX,
        y: Math.min(selectionBox.startY, selectionBox.currentY) - scrollY,
        width: Math.abs(selectionBox.currentX - selectionBox.startX),
        height: Math.abs(selectionBox.currentY - selectionBox.startY),
      };
    }, [selectionBox, scrollX, scrollY]);

    return (
      <Stage
        ref={stageRef}
        width={width}
        height={height}
        onWheel={handleWheel}
        onMouseDown={handleStageMouseDown}
        onMouseMove={handleStageMouseMove}
        onMouseUp={handleStageMouseUp}
        onMouseLeave={handleStageMouseUp}
      >
        {/* Background layer: stripes + grid */}
        <KonvaLayer listening={false}>
          {backgroundStripes}
          {gridLines}
        </KonvaLayer>

        {/* Bars layer: layer bars */}
        <KonvaLayer>
          {layerBars}
        </KonvaLayer>

        {/* Keyframes layer */}
        <KonvaLayer>
          {keyframeElements}
        </KonvaLayer>

        {/* Overlay layer: playhead, selection box, snap guides */}
        <KonvaLayer listening={false}>
          {/* Playhead */}
          {playheadX >= 0 && playheadX <= width && (
            <Line
              points={[playheadX, 0, playheadX, Math.max(height, totalHeight - scrollY)]}
              stroke="#4A9EFF"
              strokeWidth={1}
              listening={false}
            />
          )}

          {/* Snap guide */}
          {snapGuideX !== null && (
            <Line
              points={[snapGuideX, 0, snapGuideX, height]}
              stroke="#FF6B00"
              strokeWidth={1}
              dash={[4, 4]}
              listening={false}
            />
          )}

          {/* Selection box */}
          {selectionBoxRect && (
            <Rect
              x={selectionBoxRect.x}
              y={selectionBoxRect.y}
              width={selectionBoxRect.width}
              height={selectionBoxRect.height}
              fill="rgba(74,158,255,0.15)"
              stroke="#4A9EFF"
              strokeWidth={1}
              listening={false}
            />
          )}
        </KonvaLayer>
      </Stage>
    );
  },
);

LayerTracks.displayName = 'LayerTracks';
