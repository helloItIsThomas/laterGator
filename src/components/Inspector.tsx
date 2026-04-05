// ============================================================================
// Inspector Panel — Property editing for selected layer
// ============================================================================

import React, { useState } from 'react';
import { useStore, createLayer } from '../store';
import { evaluateNumber, evaluateVector2 } from '../engine/keyframe';
import { EFFECT_DEFS } from '../engine/effects';
import type { Layer, Effect, BlendingMode, AnimatableProperty, Vector2, SolidShape } from '../types';
import { LABEL_COLORS } from '../types';
import { v4 as uuid } from 'uuid';

const BLEND_MODES: BlendingMode[] = [
  'normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten',
  'color-dodge', 'color-burn', 'hard-light', 'soft-light', 'difference', 'exclusion',
];

export const Inspector: React.FC = () => {
  const selectedLayerIds = useStore((s) => s.selectedLayerIds);
  const activeComp = useStore((s) => s.getActiveComposition());
  const currentFrame = useStore((s) => s.currentFrame);

  if (!activeComp) {
    return (
      <div style={styles.container}>
        <div style={styles.empty}>No composition selected</div>
      </div>
    );
  }

  if (selectedLayerIds.length === 0) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>Inspector</div>
        <CompSettings comp={activeComp} />
      </div>
    );
  }

  if (selectedLayerIds.length > 1) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>Inspector</div>
        <div style={styles.info}>{selectedLayerIds.length} layers selected</div>
      </div>
    );
  }

  const layer = activeComp.layers.find((l) => l.id === selectedLayerIds[0]);
  if (!layer) return null;

  return (
    <div style={styles.container}>
      <div style={styles.header}>Inspector</div>
      <LayerInspector layer={layer} frame={currentFrame} />
    </div>
  );
};

// --- Composition Settings ----------------------------------------------------

const CompSettings: React.FC<{ comp: { id: string; name: string; width: number; height: number; frameRate: number; duration: number; backgroundColor: string } }> = ({ comp }) => {
  const updateComp = useStore((s) => s.updateComposition);

  return (
    <div style={styles.section}>
      <div style={styles.sectionTitle}>Composition</div>
      <FieldRow label="Name">
        <input
          style={styles.input}
          value={comp.name}
          onChange={(e) => updateComp(comp.id, { name: e.target.value })}
        />
      </FieldRow>
      <FieldRow label="Size">
        <NumberInput
          value={comp.width}
          onChange={(v) => updateComp(comp.id, { width: v })}
          style={{ width: 50 }}
        />
        <span style={styles.dimText}> × </span>
        <NumberInput
          value={comp.height}
          onChange={(v) => updateComp(comp.id, { height: v })}
          style={{ width: 50 }}
        />
      </FieldRow>
      <FieldRow label="FPS">
        <NumberInput value={comp.frameRate} onChange={(v) => updateComp(comp.id, { frameRate: v })} />
      </FieldRow>
      <FieldRow label="Duration">
        <NumberInput value={comp.duration} onChange={(v) => updateComp(comp.id, { duration: v })} />
        <span style={styles.dimText}> frames</span>
      </FieldRow>
      <FieldRow label="BG Color">
        <input
          type="color"
          value={comp.backgroundColor}
          onChange={(e) => updateComp(comp.id, { backgroundColor: e.target.value })}
          style={styles.colorInput}
        />
      </FieldRow>
    </div>
  );
};

// --- Layer Inspector ---------------------------------------------------------

const LayerInspector: React.FC<{ layer: Layer; frame: number }> = ({ layer, frame }) => {
  const updateLayer = useStore((s) => s.updateLayer);
  const updateTransformProperty = useStore((s) => s.updateTransformProperty);
  const updateTransformScalar = useStore((s) => s.updateTransformScalar);
  const toggleStopwatch = useStore((s) => s.toggleStopwatch);
  const addKeyframe = useStore((s) => s.addKeyframe);
  const addEffect = useStore((s) => s.addEffect);
  const removeEffect = useStore((s) => s.removeEffect);
  const updateEffect = useStore((s) => s.updateEffect);
  const updateEffectParam = useStore((s) => s.updateEffectParam);

  const pos = evaluateVector2(layer.transform.position, frame);
  const scale = evaluateVector2(layer.transform.scale, frame);
  const anchor = evaluateVector2(layer.transform.anchorPoint, frame);
  const rotation = evaluateNumber(layer.transform.rotation, frame);
  const opacity = evaluateNumber(layer.transform.opacity, frame);

  return (
    <div>
      {/* Layer info */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Layer</div>
        <FieldRow label="Name">
          <input
            style={styles.input}
            value={layer.name}
            onChange={(e) => updateLayer(layer.id, { name: e.target.value })}
          />
        </FieldRow>
        <FieldRow label="Type">
          <span style={styles.dimText}>{layer.type}</span>
        </FieldRow>
        {layer.type === 'solid' && (
          <>
            <FieldRow label="Color">
              <input
                type="color"
                value={layer.solidColor ?? '#FF0000'}
                onChange={(e) => updateLayer(layer.id, { solidColor: e.target.value })}
                style={styles.colorInput}
              />
            </FieldRow>
            <FieldRow label="Shape">
              <select
                style={styles.select}
                value={layer.solidShape ?? 'rectangle'}
                onChange={(e) => updateLayer(layer.id, { solidShape: e.target.value as SolidShape })}
              >
                <option value="rectangle">Rectangle</option>
                <option value="rounded-rect">Rounded Rect</option>
                <option value="circle">Circle</option>
                <option value="ellipse">Ellipse</option>
                <option value="triangle">Triangle</option>
              </select>
            </FieldRow>
            <FieldRow label="Size">
              <NumberInput
                value={layer.solidWidth ?? 0}
                onChange={(v) => updateLayer(layer.id, { solidWidth: v || null })}
                style={{ width: 50 }}
              />
              <span style={styles.dimText}> x </span>
              <NumberInput
                value={layer.solidHeight ?? 0}
                onChange={(v) => updateLayer(layer.id, { solidHeight: v || null })}
                style={{ width: 50 }}
              />
              <span style={{ ...styles.dimText, fontSize: 9 }}> 0=comp</span>
            </FieldRow>
            {(layer.solidShape === 'rounded-rect' || (layer.solidShape === 'rectangle' && (layer.solidCornerRadius ?? 0) > 0)) && (
              <FieldRow label="Radius">
                <NumberInput
                  value={layer.solidCornerRadius ?? 0}
                  onChange={(v) => updateLayer(layer.id, { solidCornerRadius: Math.max(0, v) })}
                  style={{ width: 50 }}
                />
                <span style={styles.dimText}>px</span>
              </FieldRow>
            )}
          </>
        )}
        <FieldRow label="Blend">
          <select
            style={styles.select}
            value={layer.blendingMode}
            onChange={(e) => updateLayer(layer.id, { blendingMode: e.target.value as BlendingMode })}
          >
            {BLEND_MODES.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </FieldRow>
        <FieldRow label="Timing">
          <NumberInput
            value={layer.inPoint}
            onChange={(v) => updateLayer(layer.id, { inPoint: v })}
            style={{ width: 44 }}
          />
          <span style={styles.dimText}> → </span>
          <NumberInput
            value={layer.outPoint}
            onChange={(v) => updateLayer(layer.id, { outPoint: v })}
            style={{ width: 44 }}
          />
        </FieldRow>
      </div>

      {/* Transform */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Transform</div>
        <Vec2Field
          label="Anchor"
          value={anchor}
          hasKeyframes={layer.transform.anchorPoint.keyframes.length > 0}
          onToggleStopwatch={() => toggleStopwatch(layer.id, 'transform.anchorPoint')}
          onChange={(v) => updateTransformProperty(layer.id, 'anchorPoint', v)}
        />
        <Vec2Field
          label="Position"
          value={pos}
          hasKeyframes={layer.transform.position.keyframes.length > 0}
          onToggleStopwatch={() => toggleStopwatch(layer.id, 'transform.position')}
          onChange={(v) => updateTransformProperty(layer.id, 'position', v)}
        />
        <Vec2Field
          label="Scale"
          value={scale}
          hasKeyframes={layer.transform.scale.keyframes.length > 0}
          onToggleStopwatch={() => toggleStopwatch(layer.id, 'transform.scale')}
          onChange={(v) => updateTransformProperty(layer.id, 'scale', v)}
        />
        <ScalarField
          label="Rotation"
          value={rotation}
          hasKeyframes={layer.transform.rotation.keyframes.length > 0}
          onToggleStopwatch={() => toggleStopwatch(layer.id, 'transform.rotation')}
          onChange={(v) => updateTransformScalar(layer.id, 'rotation', v)}
          suffix="°"
        />
        <ScalarField
          label="Opacity"
          value={Math.round(opacity * 100)}
          hasKeyframes={layer.transform.opacity.keyframes.length > 0}
          onToggleStopwatch={() => toggleStopwatch(layer.id, 'transform.opacity')}
          onChange={(v) => updateTransformScalar(layer.id, 'opacity', v / 100)}
          suffix="%"
          min={0}
          max={100}
        />
      </div>

      {/* Effects */}
      <div style={styles.section}>
        <div style={{ ...styles.sectionTitle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Effects</span>
          <EffectAdder layerId={layer.id} />
        </div>
        {layer.effects.map((effect) => (
          <EffectRow
            key={effect.id}
            effect={effect}
            layerId={layer.id}
            frame={frame}
          />
        ))}
        {layer.effects.length === 0 && (
          <div style={{ ...styles.dimText, padding: '4px 0', fontSize: 11 }}>No effects</div>
        )}
      </div>

      {/* Property Links */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Property Links</div>
        {Object.keys(layer.propertyLinks).length === 0 ? (
          <div style={{ ...styles.dimText, padding: '4px 0', fontSize: 11 }}>No links</div>
        ) : (
          Object.entries(layer.propertyLinks).map(([path, link]) => (
            <div key={path} style={styles.linkRow}>
              <span style={{ fontSize: 11, color: '#9775FA' }}>⛓</span>
              <span style={{ fontSize: 11, color: '#999' }}>{path}</span>
              {link.type === 'simple' && (
                <span style={styles.dimText}>
                  → {link.sourceProperty} ({link.multiplier}×, +{link.offset})
                </span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// --- Sub-components ----------------------------------------------------------

const EffectAdder: React.FC<{ layerId: string }> = ({ layerId }) => {
  const addEffect = useStore((s) => s.addEffect);
  return (
    <select
      style={{ ...styles.select, width: 'auto', fontSize: 10 }}
      value=""
      onChange={(e) => {
        if (e.target.value) addEffect(layerId, e.target.value);
      }}
    >
      <option value="">+ Add</option>
      {EFFECT_DEFS.map((d) => (
        <option key={d.type} value={d.type}>{d.name}</option>
      ))}
    </select>
  );
};

const EffectRow: React.FC<{ effect: Effect; layerId: string; frame: number }> = ({ effect, layerId, frame }) => {
  const removeEffect = useStore((s) => s.removeEffect);
  const updateEffect = useStore((s) => s.updateEffect);
  const updateEffectParam = useStore((s) => s.updateEffectParam);
  const def = EFFECT_DEFS.find((d) => d.type === effect.type);

  return (
    <div style={styles.effectRow}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <input
          type="checkbox"
          checked={effect.enabled}
          onChange={(e) => updateEffect(layerId, effect.id, { enabled: e.target.checked })}
        />
        <span style={{ fontSize: 11, color: '#CCCCCC', flex: 1 }}>{def?.name ?? effect.type}</span>
        <button
          style={styles.smallBtn}
          onClick={() => removeEffect(layerId, effect.id)}
          title="Remove effect"
        >
          ×
        </button>
      </div>
      {def?.params.map((p) => {
        const animProp = effect.params[p.name];
        const currentVal = animProp
          ? (animProp.keyframes.length > 0
              ? evaluateNumber(animProp, frame)
              : animProp.value)
          : p.defaultValue;
        return (
          <FieldRow key={p.name} label={p.name}>
            <input
              type="range"
              min={p.min ?? 0}
              max={p.max ?? 100}
              step={0.01}
              value={currentVal}
              onChange={(e) => updateEffectParam(layerId, effect.id, p.name, parseFloat(e.target.value))}
              style={{ width: 80 }}
            />
            <span style={{ ...styles.dimText, width: 36, textAlign: 'right' }}>
              {currentVal.toFixed(1)}
            </span>
          </FieldRow>
        );
      })}
    </div>
  );
};

const Vec2Field: React.FC<{
  label: string;
  value: Vector2;
  hasKeyframes: boolean;
  onToggleStopwatch: () => void;
  onChange: (v: Vector2) => void;
}> = ({ label, value, hasKeyframes, onToggleStopwatch, onChange }) => (
  <FieldRow label={label}>
    <StopwatchIcon active={hasKeyframes} onClick={onToggleStopwatch} />
    <NumberInput
      value={Math.round(value.x * 10) / 10}
      onChange={(v) => onChange({ x: v, y: value.y })}
      style={{ width: 50 }}
    />
    <NumberInput
      value={Math.round(value.y * 10) / 10}
      onChange={(v) => onChange({ x: value.x, y: v })}
      style={{ width: 50 }}
    />
  </FieldRow>
);

const ScalarField: React.FC<{
  label: string;
  value: number;
  hasKeyframes: boolean;
  onToggleStopwatch: () => void;
  onChange: (v: number) => void;
  suffix?: string;
  min?: number;
  max?: number;
}> = ({ label, value, hasKeyframes, onToggleStopwatch, onChange, suffix, min, max }) => (
  <FieldRow label={label}>
    <StopwatchIcon active={hasKeyframes} onClick={onToggleStopwatch} />
    <NumberInput
      value={Math.round(value * 10) / 10}
      onChange={onChange}
      min={min}
      max={max}
      style={{ width: 60 }}
    />
    {suffix && <span style={styles.dimText}>{suffix}</span>}
  </FieldRow>
);

const StopwatchIcon: React.FC<{ active: boolean; onClick: () => void }> = ({ active, onClick }) => (
  <button
    style={{
      ...styles.smallBtn,
      color: active ? '#4A9EFF' : '#666',
      fontSize: 12,
    }}
    onClick={onClick}
    title={active ? 'Remove all keyframes' : 'Add keyframe'}
  >
    ⏱
  </button>
);

const FieldRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div style={styles.fieldRow}>
    <label style={styles.fieldLabel}>{label}</label>
    <div style={styles.fieldValue}>{children}</div>
  </div>
);

const NumberInput: React.FC<{
  value: number;
  onChange: (v: number) => void;
  style?: React.CSSProperties;
  min?: number;
  max?: number;
}> = ({ value, onChange, style: extraStyle, min, max }) => {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');

  if (editing) {
    return (
      <input
        autoFocus
        style={{ ...styles.numberInput, ...extraStyle }}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          const v = parseFloat(text);
          if (!isNaN(v)) {
            let val = v;
            if (min !== undefined) val = Math.max(min, val);
            if (max !== undefined) val = Math.min(max, val);
            onChange(val);
          }
          setEditing(false);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          if (e.key === 'Escape') setEditing(false);
        }}
      />
    );
  }

  return (
    <span
      style={{ ...styles.numberDisplay, ...extraStyle }}
      onDoubleClick={() => {
        setText(String(value));
        setEditing(true);
      }}
    >
      {typeof value === 'number' ? value.toFixed(1) : value}
    </span>
  );
};

// --- Styles ------------------------------------------------------------------

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: '100%',
    height: '100%',
    overflow: 'auto',
    padding: '8px',
    backgroundColor: '#1E1E1E',
    borderLeft: '1px solid #333',
    fontSize: 12,
  },
  header: {
    fontSize: 13,
    fontWeight: 600,
    color: '#CCCCCC',
    padding: '4px 0 8px',
    borderBottom: '1px solid #333',
    marginBottom: 8,
  },
  empty: {
    color: '#666',
    fontSize: 12,
    padding: 20,
    textAlign: 'center',
  },
  info: {
    color: '#999',
    fontSize: 12,
    padding: '8px 0',
  },
  section: {
    marginBottom: 12,
    paddingBottom: 8,
    borderBottom: '1px solid #2A2A2A',
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 600,
    color: '#888',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  fieldRow: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: 4,
    minHeight: 22,
  },
  fieldLabel: {
    width: 60,
    fontSize: 11,
    color: '#999',
    flexShrink: 0,
  },
  fieldValue: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  input: {
    background: '#2A2A2A',
    border: '1px solid #444',
    color: '#CCCCCC',
    fontSize: 11,
    padding: '2px 6px',
    borderRadius: 3,
    width: '100%',
    outline: 'none',
  },
  select: {
    background: '#2A2A2A',
    border: '1px solid #444',
    color: '#CCCCCC',
    fontSize: 11,
    padding: '2px 4px',
    borderRadius: 3,
    width: '100%',
    outline: 'none',
  },
  colorInput: {
    width: 32,
    height: 22,
    border: '1px solid #444',
    borderRadius: 3,
    cursor: 'pointer',
    background: 'none',
    padding: 0,
  },
  numberInput: {
    background: '#2A2A2A',
    border: '1px solid #4A9EFF',
    color: '#CCCCCC',
    fontSize: 11,
    padding: '1px 4px',
    borderRadius: 3,
    width: 50,
    outline: 'none',
    textAlign: 'right' as const,
  },
  numberDisplay: {
    background: '#2A2A2A',
    border: '1px solid #444',
    color: '#CCCCCC',
    fontSize: 11,
    padding: '1px 4px',
    borderRadius: 3,
    width: 50,
    display: 'inline-block',
    textAlign: 'right' as const,
    cursor: 'default',
  },
  dimText: {
    color: '#666',
    fontSize: 11,
  },
  smallBtn: {
    background: 'none',
    border: 'none',
    color: '#999',
    cursor: 'pointer',
    padding: '0 2px',
    fontSize: 14,
    lineHeight: 1,
  },
  effectRow: {
    padding: '4px 0 4px 8px',
    borderLeft: '2px solid #444',
    marginBottom: 4,
  },
  linkRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '2px 0',
  },
};
