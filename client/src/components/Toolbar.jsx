import React from 'react';
import { Square, Circle, Diamond, StickyNote, Undo2, Redo2, Trash2, Maximize2 } from 'lucide-react';

export default function Toolbar({
  onAddNode,
  onUndo,
  onRedo,
  onDeleteSelected,
  onFitView,
  canUndo,
  canRedo,
  isEditingAllowed = true
}) {
  return (
    <aside className="floating-toolbar" aria-label="Canvas Toolbar">
      <button
        type="button"
        className="btn-icon"
        title="Add Rectangle"
        aria-label="Add Rectangle"
        onClick={() => onAddNode('rect')}
        disabled={!isEditingAllowed}
      >
        <Square size={16} />
      </button>

      <button
        type="button"
        className="btn-icon"
        title="Add Circle"
        aria-label="Add Circle"
        onClick={() => onAddNode('circle')}
        disabled={!isEditingAllowed}
      >
        <Circle size={16} />
      </button>

      <button
        type="button"
        className="btn-icon"
        title="Add Diamond (Decision)"
        aria-label="Add Diamond"
        onClick={() => onAddNode('diamond')}
        disabled={!isEditingAllowed}
      >
        <Diamond size={16} />
      </button>

      <button
        type="button"
        className="btn-icon"
        title="Add Sticky Note"
        aria-label="Add Sticky Note"
        onClick={() => onAddNode('sticky')}
        disabled={!isEditingAllowed}
      >
        <StickyNote size={16} />
      </button>

      <div className="toolbar-divider" />

      <button
        type="button"
        className="btn-icon"
        title="Undo (Ctrl+Z)"
        aria-label="Undo"
        onClick={onUndo}
        disabled={!canUndo || !isEditingAllowed}
      >
        <Undo2 size={16} />
      </button>

      <button
        type="button"
        className="btn-icon"
        title="Redo (Ctrl+Shift+Z)"
        aria-label="Redo"
        onClick={onRedo}
        disabled={!canRedo || !isEditingAllowed}
      >
        <Redo2 size={16} />
      </button>

      <button
        type="button"
        className="btn-icon"
        title="Delete Selected (Backspace / Delete)"
        aria-label="Delete Selected"
        onClick={onDeleteSelected}
        disabled={!isEditingAllowed}
      >
        <Trash2 size={16} />
      </button>

      <button
        type="button"
        className="btn-icon"
        title="Fit View"
        aria-label="Fit View"
        onClick={onFitView}
      >
        <Maximize2 size={16} />
      </button>
    </aside>
  );
}
