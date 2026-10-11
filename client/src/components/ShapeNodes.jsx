import React, { useState, useRef, useEffect, useContext, createContext } from 'react';
import { Handle, Position, NodeToolbar, NodeResizer, useReactFlow } from '@xyflow/react';

export const COLOR_SWATCHES = [
  { id: 'white', fill: '#FFFFFF', border: '#E7E5E4', label: 'White' },
  { id: 'red', fill: '#FEE2E2', border: '#FCA5A5', label: 'Red' },
  { id: 'amber', fill: '#FEF3C7', border: '#FCD34D', label: 'Amber' },
  { id: 'green', fill: '#D1FAE5', border: '#6EE7B7', label: 'Green' },
  { id: 'blue', fill: '#DBEAFE', border: '#93C5FD', label: 'Blue' },
  { id: 'grey', fill: '#F3F4F6', border: '#D1D5DB', label: 'Grey' }
];

export function getNodeColors(color) {
  if (!color) return { fill: '#FFFFFF', border: '#E7E5E4' };
  const found = COLOR_SWATCHES.find(
    (c) => c.id === color || c.fill.toLowerCase() === String(color).toLowerCase()
  );
  if (found) return { fill: found.fill, border: found.border };
  return { fill: color, border: '#E7E5E4' };
}

export const ShapeNodeContext = createContext({
  isEditingAllowed: true,
  onColorChange: () => {},
  onLabelChange: () => {},
  onStickyTextChange: () => {},
  onStickyTextBlur: () => {},
  onResizeStart: () => {}
});

function ColorSwatchesToolbar({ selected, currentColor, nodeId }) {
  const { isEditingAllowed, onColorChange } = useContext(ShapeNodeContext);

  if (!isEditingAllowed) return null;

  return (
    <NodeToolbar isVisible={Boolean(selected)} position={Position.Top} className="node-color-toolbar">
      {COLOR_SWATCHES.map((swatch) => {
        const isCurrent = (currentColor || 'white') === swatch.id || currentColor === swatch.fill;
        return (
          <button
            key={swatch.id}
            type="button"
            className={`color-swatch-btn ${isCurrent ? 'active' : ''}`}
            style={{
              backgroundColor: swatch.fill,
              borderColor: swatch.border
            }}
            title={swatch.label}
            aria-label={`Color ${swatch.label}`}
            onClick={(e) => {
              e.stopPropagation();
              onColorChange(swatch.id, nodeId);
            }}
          />
        );
      })}
    </NodeToolbar>
  );
}

function EditableLabel({ id, label }) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(label || '');
  const inputRef = useRef(null);
  const { isEditingAllowed, onLabelChange } = useContext(ShapeNodeContext);
  const { setNodes } = useReactFlow();

  useEffect(() => {
    setValue(label || '');
  }, [label]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const save = () => {
    setIsEditing(false);
    const trimmed = value.trim() || label || 'Node';
    setValue(trimmed);
    if (onLabelChange) {
      onLabelChange(id, trimmed);
    } else {
      setNodes((nds) =>
        nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, label: trimmed } } : n))
      );
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      save();
    } else if (e.key === 'Escape') {
      setValue(label || '');
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        className="node-label-input"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={handleKeyDown}
      />
    );
  }

  return (
    <div
      className="node-label-text"
      onDoubleClick={() => {
        if (!isEditingAllowed) return;
        setIsEditing(true);
      }}
    >
      {label || 'Node'}
    </div>
  );
}

export function RectNode({ id, data, selected }) {
  const colors = getNodeColors(data?.color);

  return (
    <div
      className={`flow-node flow-node-rect ${selected ? 'selected' : ''}`}
      style={{ backgroundColor: colors.fill, borderColor: colors.border }}
    >
      <ColorSwatchesToolbar selected={selected} currentColor={data?.color} nodeId={id} />
      <Handle type="source" position={Position.Top} className="flow-handle" id="top" />
      <Handle type="source" position={Position.Right} className="flow-handle" id="right" />
      <Handle type="source" position={Position.Bottom} className="flow-handle" id="bottom" />
      <Handle type="source" position={Position.Left} className="flow-handle" id="left" />
      <EditableLabel id={id} label={data?.label} />
    </div>
  );
}

export function CircleNode({ id, data, selected }) {
  const colors = getNodeColors(data?.color);

  return (
    <div
      className={`flow-node flow-node-circle ${selected ? 'selected' : ''}`}
      style={{ backgroundColor: colors.fill, borderColor: colors.border }}
    >
      <ColorSwatchesToolbar selected={selected} currentColor={data?.color} nodeId={id} />
      <Handle type="source" position={Position.Top} className="flow-handle" id="top" />
      <Handle type="source" position={Position.Right} className="flow-handle" id="right" />
      <Handle type="source" position={Position.Bottom} className="flow-handle" id="bottom" />
      <Handle type="source" position={Position.Left} className="flow-handle" id="left" />
      <EditableLabel id={id} label={data?.label} />
    </div>
  );
}

export function DiamondNode({ id, data, selected }) {
  const colors = getNodeColors(data?.color);

  return (
    <div
      style={{
        width: 88,
        height: 88,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <ColorSwatchesToolbar selected={selected} currentColor={data?.color} nodeId={id} />
      <Handle type="source" position={Position.Top} className="flow-handle" id="top" />
      <Handle type="source" position={Position.Right} className="flow-handle" id="right" />
      <Handle type="source" position={Position.Bottom} className="flow-handle" id="bottom" />
      <Handle type="source" position={Position.Left} className="flow-handle" id="left" />
      <div
        className={`flow-node flow-node-diamond ${selected ? 'selected' : ''}`}
        style={{
          width: 62,
          height: 62,
          backgroundColor: colors.fill,
          borderColor: colors.border
        }}
      >
        <div className="diamond-content-inner">
          <EditableLabel id={id} label={data?.label} />
        </div>
      </div>
    </div>
  );
}

export function StickyNode({ id, data, selected }) {
  const colors = getNodeColors(data?.color || 'amber');
  const { isEditingAllowed, onStickyTextChange, onStickyTextBlur, onResizeStart } = useContext(ShapeNodeContext);
  const [text, setText] = useState(data?.text || '');
  const debounceTimer = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    setText(data?.text || '');
  }, [data?.text]);

  const handleChange = (e) => {
    const val = e.target.value;
    setText(val);
    if (!isEditingAllowed) return;

    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      if (onStickyTextChange) {
        onStickyTextChange(id, val);
      }
    }, 150);
  };

  const handleBlur = (e) => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    if (onStickyTextBlur) {
      onStickyTextBlur(id, e.target.value);
    }
  };

  return (
    <div
      className={`flow-node flow-node-sticky ${selected ? 'selected' : ''}`}
      style={{
        backgroundColor: colors.fill,
        borderColor: colors.border
      }}
    >
      <NodeResizer
        isVisible={Boolean(selected && isEditingAllowed)}
        minWidth={120}
        minHeight={90}
        onResizeStart={onResizeStart}
      />
      <ColorSwatchesToolbar selected={selected} currentColor={data?.color || 'amber'} nodeId={id} />
      <textarea
        ref={textareaRef}
        className="sticky-textarea nodrag nowheel"
        placeholder="Write a note..."
        value={text}
        onChange={handleChange}
        onBlur={handleBlur}
        readOnly={!isEditingAllowed}
        autoFocus={Boolean(data?.isNew && isEditingAllowed)}
        onKeyDown={(e) => {
          e.stopPropagation();
        }}
      />
    </div>
  );
}

export const nodeTypes = {
  rect: RectNode,
  circle: CircleNode,
  diamond: DiamondNode,
  sticky: StickyNode
};
