// ============================================================================
// Project Panel — Asset & composition browser
// ============================================================================

import React, { useRef, useState } from 'react';
import { useStore, createLayer } from '../store';
import type { Composition, Asset, SolidShape } from '../types';
import { v4 as uuid } from 'uuid';
import { createDefaultTransform } from '../types';

export const ProjectPanel: React.FC = () => {
  const project = useStore((s) => s.project);
  const activeCompositionId = useStore((s) => s.activeCompositionId);
  const setActiveComposition = useStore((s) => s.setActiveComposition);
  const addComposition = useStore((s) => s.addComposition);
  const enterPrecomp = useStore((s) => s.enterPrecomp);
  const addLayer = useStore((s) => s.addLayer);
  const addAsset = useStore((s) => s.addAsset);
  const activeComp = useStore((s) => s.getActiveComposition());
  const [tab, setTab] = useState<'comps' | 'assets'>('comps');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleNewComp = () => {
    const comp: Composition = {
      id: uuid(),
      name: `Comp ${project.compositions.length + 1}`,
      width: 960,
      height: 540,
      frameRate: project.settings.fps,
      duration: project.settings.defaultDuration,
      backgroundColor: '#1E1E1E',
      layers: [],
    };
    addComposition(comp);
  };

  const handleAddLayer = (type: 'solid' | 'null' | 'adjustment') => {
    if (!activeComp) return;
    const names = { solid: 'Solid', null: 'Null', adjustment: 'Adjustment' };
    const layer = createLayer(type, names[type], activeComp.duration, {
      solidColor: type === 'solid' ? '#FF4444' : undefined,
    });
    addLayer(layer);
  };

  const handleAddShape = (shape: SolidShape) => {
    if (!activeComp) return;
    const shapeNames: Record<SolidShape, string> = {
      rectangle: 'Rectangle',
      'rounded-rect': 'Rounded Rect',
      circle: 'Circle',
      ellipse: 'Ellipse',
      triangle: 'Triangle',
    };
    const layer = createLayer('solid', shapeNames[shape], activeComp.duration, {
      solidColor: '#4A9EFF',
      solidShape: shape,
      solidWidth: shape === 'circle' ? 200 : 200,
      solidHeight: shape === 'circle' ? 200 : 150,
      solidCornerRadius: shape === 'rounded-rect' ? 16 : 0,
    });
    addLayer(layer);
  };

  const handleDragCompStart = (e: React.DragEvent, comp: Composition) => {
    e.dataTransfer.setData('application/x-latergator-comp', comp.id);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleImageImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !activeComp) return;

    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue;

      const url = URL.createObjectURL(file);
      const img = new Image();
      await new Promise<void>((resolve) => {
        img.onload = () => resolve();
        img.onerror = () => resolve();
        img.src = url;
      });

      if (!img.naturalWidth) continue;

      const assetId = uuid();
      const asset: Asset = {
        id: assetId,
        name: file.name,
        type: 'image',
        url,
        width: img.naturalWidth,
        height: img.naturalHeight,
      };
      addAsset(asset);

      // Also create a media layer in the active composition
      const layer = createLayer('media', file.name.replace(/\.[^.]+$/, ''), activeComp.duration, {
        source: url,
      });
      addLayer(layer);
    }

    // Reset input so same file can be re-imported
    e.target.value = '';
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.title}>Project</span>
      </div>

      {/* Tabs */}
      <div style={styles.tabs}>
        <button
          style={{ ...styles.tab, ...(tab === 'comps' ? styles.activeTab : {}) }}
          onClick={() => setTab('comps')}
        >
          Compositions
        </button>
        <button
          style={{ ...styles.tab, ...(tab === 'assets' ? styles.activeTab : {}) }}
          onClick={() => setTab('assets')}
        >
          Assets
        </button>
      </div>

      {tab === 'comps' ? (
        <div style={styles.list}>
          {project.compositions.map((comp) => (
            <div
              key={comp.id}
              style={{
                ...styles.listItem,
                ...(comp.id === activeCompositionId ? styles.activeItem : {}),
              }}
              onClick={() => setActiveComposition(comp.id)}
              onDoubleClick={() => {
                if (comp.id !== activeCompositionId) {
                  enterPrecomp(comp.id);
                }
              }}
              draggable
              onDragStart={(e) => handleDragCompStart(e, comp)}
            >
              <span style={styles.compIcon}>◻</span>
              <div style={styles.itemInfo}>
                <div style={styles.itemName}>{comp.name}</div>
                <div style={styles.itemMeta}>
                  {comp.width}×{comp.height} · {comp.frameRate}fps · {comp.layers.length} layers
                </div>
              </div>
            </div>
          ))}
          <button style={styles.addBtn} onClick={handleNewComp}>
            + New Composition
          </button>
        </div>
      ) : (
        <div style={styles.list}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: 'none' }}
            onChange={handleImageImport}
          />
          <button
            style={styles.addBtn}
            onClick={() => fileInputRef.current?.click()}
          >
            + Import Image
          </button>
          {project.assets.length === 0 && (
            <div style={styles.emptyText}>No assets imported yet</div>
          )}
          {project.assets.map((asset) => (
            <div key={asset.id} style={styles.listItem}>
              <span style={styles.compIcon}>🖼</span>
              <div style={styles.itemInfo}>
                <div style={styles.itemName}>{asset.name}</div>
                <div style={styles.itemMeta}>
                  {asset.width}×{asset.height} · {asset.type}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quick-add layer buttons */}
      <div style={styles.footer}>
        <div style={styles.footerLabel}>Add Layer</div>
        <div style={styles.footerBtns}>
          <button style={styles.layerBtn} onClick={() => handleAddLayer('solid')} title="Add Solid">
            ■
          </button>
          <button style={styles.layerBtn} onClick={() => handleAddLayer('null')} title="Add Null">
            ✛
          </button>
          <button style={styles.layerBtn} onClick={() => handleAddLayer('adjustment')} title="Add Adjustment">
            ◑
          </button>
        </div>
        <div style={{ ...styles.footerLabel, marginTop: 6 }}>Add Shape</div>
        <div style={styles.footerBtns}>
          <button style={styles.layerBtn} onClick={() => handleAddShape('rectangle')} title="Rectangle">
            ▬
          </button>
          <button style={styles.layerBtn} onClick={() => handleAddShape('rounded-rect')} title="Rounded Rect">
            ▢
          </button>
          <button style={styles.layerBtn} onClick={() => handleAddShape('circle')} title="Circle">
            ●
          </button>
          <button style={styles.layerBtn} onClick={() => handleAddShape('ellipse')} title="Ellipse">
            ⬮
          </button>
          <button style={styles.layerBtn} onClick={() => handleAddShape('triangle')} title="Triangle">
            ▲
          </button>
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
    borderRight: '1px solid #333',
    fontSize: 12,
  },
  header: {
    padding: '8px 10px',
    borderBottom: '1px solid #333',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 13,
    fontWeight: 600,
    color: '#CCCCCC',
  },
  tabs: {
    display: 'flex',
    borderBottom: '1px solid #333',
  },
  tab: {
    flex: 1,
    padding: '6px 0',
    background: 'none',
    border: 'none',
    color: '#888',
    fontSize: 11,
    cursor: 'pointer',
    borderBottom: '2px solid transparent',
  },
  activeTab: {
    color: '#CCCCCC',
    borderBottomColor: '#4A9EFF',
  },
  list: {
    flex: 1,
    overflow: 'auto',
    padding: '4px 0',
  },
  listItem: {
    display: 'flex',
    alignItems: 'center',
    padding: '6px 10px',
    cursor: 'pointer',
    gap: 8,
    borderBottom: '1px solid #2A2A2A',
  },
  activeItem: {
    backgroundColor: '#2A3A4A',
  },
  compIcon: {
    fontSize: 16,
    color: '#9775FA',
    width: 20,
    textAlign: 'center' as const,
  },
  itemInfo: {
    flex: 1,
    minWidth: 0,
  },
  itemName: {
    color: '#CCCCCC',
    fontSize: 12,
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  itemMeta: {
    color: '#666',
    fontSize: 10,
    marginTop: 1,
  },
  addBtn: {
    width: '100%',
    padding: '8px',
    background: 'none',
    border: '1px dashed #444',
    color: '#888',
    fontSize: 11,
    cursor: 'pointer',
    borderRadius: 3,
    margin: '4px 0',
  },
  emptyText: {
    color: '#666',
    fontSize: 11,
    padding: 16,
    textAlign: 'center' as const,
  },
  footer: {
    padding: '8px 10px',
    borderTop: '1px solid #333',
  },
  footerLabel: {
    fontSize: 10,
    color: '#666',
    marginBottom: 4,
  },
  footerBtns: {
    display: 'flex',
    gap: 4,
  },
  layerBtn: {
    flex: 1,
    padding: '4px 0',
    background: '#2A2A2A',
    border: '1px solid #444',
    color: '#CCCCCC',
    fontSize: 14,
    cursor: 'pointer',
    borderRadius: 3,
  },
};
