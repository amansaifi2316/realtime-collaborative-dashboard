import React, { useState, useRef, useEffect, useContext, createContext } from 'react';
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath } from '@xyflow/react';

export const EdgeContext = createContext({
  isEditingAllowed: true,
  onEdgeLabelChange: () => {}
});

export default function LabeledEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
  selected
}) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition
  });

  const { isEditingAllowed, onEdgeLabelChange } = useContext(EdgeContext);
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(data?.label || '');
  const inputRef = useRef(null);

  useEffect(() => {
    setValue(data?.label || '');
  }, [data?.label]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = (valToSave) => {
    const finalVal = (typeof valToSave === 'string' ? valToSave : value).trim();
    setIsEditing(false);
    setValue(finalVal);
    if (onEdgeLabelChange) {
      onEdgeLabelChange(id, finalVal);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setValue(data?.label || '');
      setIsEditing(false);
    }
  };

  const handleDoubleClick = (e) => {
    e.stopPropagation();
    if (!isEditingAllowed) return;
    setIsEditing(true);
  };

  const label = data?.label;

  return (
    <>
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke: selected ? 'var(--accent)' : style.stroke || '#78716C',
          strokeWidth: selected ? 2 : style.strokeWidth || 1.5
        }}
      />
      {/* Invisible interaction path to capture double clicks anywhere along edge */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        className="react-flow__edge-interaction"
        onDoubleClick={handleDoubleClick}
        style={{ cursor: isEditingAllowed ? 'pointer' : 'default' }}
      />
      <EdgeLabelRenderer>
        {isEditing ? (
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
              zIndex: 100
            }}
            className="nodrag nopan"
            onDoubleClick={(e) => e.stopPropagation()}
          >
            <div className="edge-label-editor">
              <input
                ref={inputRef}
                type="text"
                className="edge-label-input"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={() => handleSave()}
                placeholder="Label"
              />
              <div className="edge-quick-chips">
                <button
                  type="button"
                  className="edge-chip-btn"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleSave('Yes')}
                >
                  Yes
                </button>
                <button
                  type="button"
                  className="edge-chip-btn"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleSave('No')}
                >
                  No
                </button>
              </div>
            </div>
          </div>
        ) : label ? (
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
              zIndex: 10
            }}
            className="nodrag nopan"
          >
            <div
              className={`edge-label-pill ${selected ? 'selected' : ''}`}
              onDoubleClick={handleDoubleClick}
              title={isEditingAllowed ? 'Double-click to edit' : undefined}
            >
              {label}
            </div>
          </div>
        ) : null}
      </EdgeLabelRenderer>
    </>
  );
}
