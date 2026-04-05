// ============================================================================
// LaterGator — LayerHeaders (HTML-based, for accessibility)
// ============================================================================

import React, { useCallback, useRef, useState, useEffect, useMemo } from 'react';
import type { Layer, AnimatableProperty } from '../../types';
import { useStore } from '../../store';

// --- Constants ---------------------------------------------------------------

const ROW_HEIGHT = 28;
const PROPERTY_ROW_HEIGHT = 22;
const COLOR_STRIP_WIDTH = 4;

const LABEL_COLORS = [
  '#FF6B6B', '#FFA94D', '#FFD43B', '#69DB7C',
  '#4DABF7', '#9775FA', '#F783AC', '#868E96',
];

// --- Property group definitions -----------------------------------------------

interface PropertyDef {
  name: string;
  path: string;
}

interface PropertyGroup {
  name: string;
  properties: PropertyDef[];
}

function getPropertyGroups(layer: Layer): PropertyGroup[] {
  const groups: PropertyGroup[] = [
    {
      name: 'Transform',
      properties: [
        { name: 'Anchor Point', path: 'transform.anchorPoint' },
        { name: 'Position', path: 'transform.position' },
        { name: 'Scale', path: 'transform.scale' },
        { name: 'Rotation', path: 'transform.rotation' },
        { name: 'Opacity', path: 'transform.opacity' },
      ],
    },
  ];

  if (layer.effects.length > 0) {
    groups.push({
      name: 'Effects',
      properties: layer.effects.flatMap((eff) =>
        Object.keys(eff.params).map((paramName) => ({
          name: `${eff.type} > ${paramName}`,
          path: `effects.${eff.id}.${paramName}`,
        })),
      ),
    });
  }

  return groups;
}

/** Count the number of visible property rows for a layer */
export function getLayerRowCount(
  layer: Layer,
  isExpanded: boolean,
  expandedGroups: Record<string, boolean>,
): number {
  if (!isExpanded) return 1;

  let count = 1; // header row
  const groups = getPropertyGroups(layer);
  for (const group of groups) {
    count += 1; // group header
    const groupKey = `${layer.id}:${group.name}`;
    if (expandedGroups[groupKey]) {
      count += group.properties.length;
    }
  }
  return count;
}

/** Calculate total height of a layer row (in px) */
export function getLayerTotalHeight(
  layer: Layer,
  isExpanded: boolean,
  expandedGroups: Record<string, boolean>,
): number {
  if (!isExpanded) return ROW_HEIGHT;
  const rowCount = getLayerRowCount(layer, isExpanded, expandedGroups);
  return ROW_HEIGHT + (rowCount - 1) * PROPERTY_ROW_HEIGHT;
}

/** Calculate cumulative Y offsets for each layer */
export function getLayerYOffsets(
  layers: Layer[],
  expandedLayers: Record<string, boolean>,
  expandedGroups: Record<string, boolean>,
): Map<string, number> {
  const offsets = new Map<string, number>();
  let y = 0;
  for (const layer of layers) {
    offsets.set(layer.id, y);
    y += getLayerTotalHeight(layer, !!expandedLayers[layer.id], expandedGroups);
  }
  return offsets;
}

/** Get total height of all layers */
export function getTotalLayersHeight(
  layers: Layer[],
  expandedLayers: Record<string, boolean>,
  expandedGroups: Record<string, boolean>,
): number {
  let total = 0;
  for (const layer of layers) {
    total += getLayerTotalHeight(layer, !!expandedLayers[layer.id], expandedGroups);
  }
  return total;
}

// --- Context Menu Component ---------------------------------------------------

interface ContextMenuState {
  x: number;
  y: number;
  layerId: string;
}

const ContextMenu: React.FC<{
  state: ContextMenuState;
  onClose: () => void;
}> = ({ state, onClose }) => {
  const { updateLayer, duplicateLayer, removeLayer } = useStore();
  const layer = useStore((s) => {
    const comp = s.getActiveComposition();
    return comp?.layers.find((l) => l.id === state.layerId) ?? null;
  });
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [onClose]);

  if (!layer) return null;

  const menuItems: { label: string; action: () => void; separator?: boolean }[] = [
    {
      label: 'Rename',
      action: () => {
        const name = prompt('Layer name:', layer.name);
        if (name !== null && name.trim()) {
          updateLayer(state.layerId, { name: name.trim() });
        }
        onClose();
      },
    },
    {
      label: 'Duplicate',
      action: () => {
        duplicateLayer(state.layerId);
        onClose();
      },
    },
    {
      label: 'Delete',
      action: () => {
        removeLayer(state.layerId);
        onClose();
      },
    },
    {
      label: layer.locked ? 'Unlock' : 'Lock',
      separator: true,
      action: () => {
        updateLayer(state.layerId, { locked: !layer.locked });
        onClose();
      },
    },
  ];

  // Label color submenu items
  const colorItems = LABEL_COLORS.map((color) => ({
    label: color,
    isColor: true,
    action: () => {
      updateLayer(state.layerId, { color });
      onClose();
    },
  }));

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        left: state.x,
        top: state.y,
        background: '#333333',
        border: '1px solid #555555',
        borderRadius: 4,
        padding: '4px 0',
        minWidth: 140,
        zIndex: 9999,
        boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
      }}
    >
      {menuItems.map((item, i) => (
        <React.Fragment key={i}>
          {item.separator && (
            <div style={{ height: 1, background: '#555555', margin: '4px 0' }} />
          )}
          <div
            onClick={item.action}
            style={{
              padding: '6px 16px',
              color: '#CCCCCC',
              fontSize: 12,
              cursor: 'pointer',
              userSelect: 'none',
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLDivElement).style.background = '#4A9EFF';
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLDivElement).style.background = 'transparent';
            }}
          >
            {item.label}
          </div>
        </React.Fragment>
      ))}
      <div style={{ height: 1, background: '#555555', margin: '4px 0' }} />
      <div style={{ padding: '4px 16px', fontSize: 11, color: '#888888' }}>
        Label Color
      </div>
      <div style={{ display: 'flex', gap: 3, padding: '4px 16px 6px' }}>
        {colorItems.map((c) => (
          <div
            key={c.label}
            onClick={c.action}
            style={{
              width: 14,
              height: 14,
              borderRadius: 2,
              background: c.label,
              cursor: 'pointer',
              border:
                c.label === (layer?.color ?? '')
                  ? '2px solid white'
                  : '1px solid #555555',
            }}
          />
        ))}
      </div>
    </div>
  );
};

// --- Single Layer Header Row --------------------------------------------------

const LayerHeaderRow: React.FC<{
  layer: Layer;
  index: number;
  isSelected: boolean;
  isExpanded: boolean;
  expandedGroups: Record<string, boolean>;
  onContextMenu: (e: React.MouseEvent, layerId: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
}> = React.memo(({ layer, index, isSelected, isExpanded, expandedGroups, onContextMenu, onReorder }) => {
  const {
    selectLayers,
    updateLayer,
    toggleLayerExpanded,
    toggleGroupExpanded,
  } = useStore();
  const [isDragOver, setIsDragOver] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(layer.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isRenaming]);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      const mode = e.shiftKey || e.metaKey ? 'toggle' : 'replace';
      selectLayers([layer.id], mode);
    },
    [layer.id, selectLayers],
  );

  const handleDoubleClick = useCallback(() => {
    setRenameValue(layer.name);
    setIsRenaming(true);
  }, [layer.name]);

  const commitRename = useCallback(() => {
    if (renameValue.trim()) {
      updateLayer(layer.id, { name: renameValue.trim() });
    }
    setIsRenaming(false);
  }, [layer.id, renameValue, updateLayer]);

  const handleRenameKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') commitRename();
      if (e.key === 'Escape') setIsRenaming(false);
    },
    [commitRename],
  );

  const groups = useMemo(() => getPropertyGroups(layer), [layer]);

  const bgColor = isSelected
    ? '#2A3A4A'
    : 'transparent';

  return (
    <div
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu(e, layer.id);
      }}
      draggable={!layer.locked}
      onDragStart={(e) => {
        e.dataTransfer.setData('application/x-latergator-layer-index', String(index));
        e.dataTransfer.effectAllowed = 'move';
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragOver(false);
        const fromIndex = parseInt(e.dataTransfer.getData('application/x-latergator-layer-index'), 10);
        if (!isNaN(fromIndex) && fromIndex !== index) {
          onReorder(fromIndex, index);
        }
      }}
    >
      {/* Drop indicator */}
      {isDragOver && (
        <div style={{ height: 2, background: '#4A9EFF', marginBottom: -2, position: 'relative', zIndex: 10 }} />
      )}
      {/* Main row */}
      <div
        onClick={handleClick}
        style={{
          display: 'flex',
          alignItems: 'center',
          height: ROW_HEIGHT,
          background: bgColor,
          cursor: layer.locked ? 'default' : 'grab',
          userSelect: 'none',
          borderBottom: '1px solid #2A2A2A',
        }}
      >
        {/* Color strip */}
        <div
          style={{
            width: COLOR_STRIP_WIDTH,
            height: ROW_HEIGHT,
            background: layer.color,
            flexShrink: 0,
          }}
        />

        {/* Expand toggle */}
        <div
          onClick={(e) => {
            e.stopPropagation();
            toggleLayerExpanded(layer.id);
          }}
          style={{
            width: 20,
            height: ROW_HEIGHT,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#888888',
            fontSize: 10,
            flexShrink: 0,
          }}
        >
          {isExpanded ? '\u25BC' : '\u25B6'}
        </div>

        {/* Eye (enabled) toggle */}
        <div
          onClick={(e) => {
            e.stopPropagation();
            updateLayer(layer.id, { enabled: !layer.enabled });
          }}
          title={layer.enabled ? 'Hide layer' : 'Show layer'}
          style={{
            width: 20,
            height: ROW_HEIGHT,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: layer.enabled ? '#CCCCCC' : '#555555',
            fontSize: 12,
            flexShrink: 0,
            cursor: 'pointer',
          }}
        >
          {layer.enabled ? '\u25C9' : '\u25CE'}
        </div>

        {/* Lock toggle */}
        <div
          onClick={(e) => {
            e.stopPropagation();
            updateLayer(layer.id, { locked: !layer.locked });
          }}
          title={layer.locked ? 'Unlock layer' : 'Lock layer'}
          style={{
            width: 18,
            height: ROW_HEIGHT,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: layer.locked ? '#FF6B6B' : '#666666',
            fontSize: 10,
            flexShrink: 0,
            cursor: 'pointer',
          }}
        >
          {layer.locked ? '\u{1F512}' : '\u{1F513}'}
        </div>

        {/* Solo button */}
        <div
          onClick={(e) => {
            e.stopPropagation();
            updateLayer(layer.id, { solo: !layer.solo });
          }}
          title="Solo"
          style={{
            width: 16,
            height: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: layer.solo ? '#FFD43B' : '#666666',
            fontSize: 9,
            fontWeight: 'bold',
            flexShrink: 0,
            cursor: 'pointer',
            border: `1px solid ${layer.solo ? '#FFD43B' : '#555555'}`,
            borderRadius: 2,
            marginRight: 4,
          }}
        >
          S
        </div>

        {/* Layer name */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            paddingRight: 6,
          }}
        >
          {isRenaming ? (
            <input
              ref={inputRef}
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={commitRename}
              onKeyDown={handleRenameKeyDown}
              style={{
                background: '#333333',
                border: '1px solid #4A9EFF',
                color: '#CCCCCC',
                fontSize: 12,
                padding: '1px 4px',
                width: '100%',
                outline: 'none',
                borderRadius: 2,
              }}
            />
          ) : (
            <span
              onDoubleClick={handleDoubleClick}
              style={{
                color: '#CCCCCC',
                fontSize: 12,
                opacity: layer.enabled ? 1 : 0.5,
              }}
            >
              {layer.name}
            </span>
          )}
        </div>
      </div>

      {/* Expanded property rows */}
      {isExpanded &&
        groups.map((group) => {
          const groupKey = `${layer.id}:${group.name}`;
          const groupExpanded = !!expandedGroups[groupKey];

          return (
            <React.Fragment key={group.name}>
              {/* Group header */}
              <div
                onClick={() => toggleGroupExpanded(groupKey)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  height: PROPERTY_ROW_HEIGHT,
                  paddingLeft: COLOR_STRIP_WIDTH + 20,
                  background: bgColor,
                  cursor: 'pointer',
                  userSelect: 'none',
                  borderBottom: '1px solid #2A2A2A',
                }}
              >
                <span
                  style={{
                    color: '#777777',
                    fontSize: 10,
                    marginRight: 4,
                  }}
                >
                  {groupExpanded ? '\u25BC' : '\u25B6'}
                </span>
                <span style={{ color: '#AAAAAA', fontSize: 11, fontWeight: 500 }}>
                  {group.name}
                </span>
              </div>

              {/* Property rows */}
              {groupExpanded &&
                group.properties.map((prop) => (
                  <div
                    key={prop.path}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      height: PROPERTY_ROW_HEIGHT,
                      paddingLeft: COLOR_STRIP_WIDTH + 36,
                      background: bgColor,
                      borderBottom: '1px solid #2A2A2A',
                    }}
                  >
                    <span
                      style={{
                        color: '#999999',
                        fontSize: 11,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {prop.name}
                    </span>
                  </div>
                ))}
            </React.Fragment>
          );
        })}
    </div>
  );
});

LayerHeaderRow.displayName = 'LayerHeaderRow';

// --- Main LayerHeaders Component ---------------------------------------------

export interface LayerHeadersProps {
  width: number;
  scrollY: number;
}

export const LayerHeaders: React.FC<LayerHeadersProps> = React.memo(
  ({ width, scrollY }) => {
    const composition = useStore((s) => s.getActiveComposition());
    const selectedLayerIds = useStore((s) => s.selectedLayerIds);
    const expandedLayers = useStore((s) => s.expandedLayers);
    const expandedGroups = useStore((s) => s.expandedGroups);

    const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(
      null,
    );

    const handleContextMenu = useCallback(
      (e: React.MouseEvent, layerId: string) => {
        setContextMenu({ x: e.clientX, y: e.clientY, layerId });
      },
      [],
    );

    const reorderLayer = useStore((s) => s.reorderLayer);
    const layers = composition?.layers ?? [];

    const handleReorder = useCallback(
      (fromIndex: number, toIndex: number) => {
        const layer = layers[fromIndex];
        if (layer) reorderLayer(layer.id, toIndex);
      },
      [layers, reorderLayer],
    );

    return (
      <div
        style={{
          width,
          height: '100%',
          overflow: 'hidden',
          position: 'relative',
          background: '#1E1E1E',
          borderRight: '1px solid #333333',
        }}
      >
        <div
          style={{
            transform: `translateY(${-scrollY}px)`,
            willChange: 'transform',
          }}
        >
          {layers.map((layer, index) => (
            <LayerHeaderRow
              key={layer.id}
              layer={layer}
              index={index}
              isSelected={selectedLayerIds.includes(layer.id)}
              isExpanded={!!expandedLayers[layer.id]}
              expandedGroups={expandedGroups}
              onContextMenu={handleContextMenu}
              onReorder={handleReorder}
            />
          ))}
        </div>

        {contextMenu && (
          <ContextMenu
            state={contextMenu}
            onClose={() => setContextMenu(null)}
          />
        )}
      </div>
    );
  },
);

LayerHeaders.displayName = 'LayerHeaders';

export { ROW_HEIGHT, PROPERTY_ROW_HEIGHT };
