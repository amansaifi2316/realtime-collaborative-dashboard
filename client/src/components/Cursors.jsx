import React from 'react';
import { useReactFlow, useViewport } from '@xyflow/react';

export default function Cursors({ cursors }) {
  const { flowToScreenPosition } = useReactFlow();
  // Re-render cursors whenever the canvas zooms or pans so positions track accurately
  useViewport();

  const cursorList = Object.values(cursors || {});

  return (
    <div
      className="cursors-layer"
      style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
      aria-hidden="true"
    >
      {cursorList.map((c) => {
        const screenPos = flowToScreenPosition({ x: c.x, y: c.y });
        return (
          <div
            key={c.id}
            className="user-cursor"
            style={{
              transform: `translate3d(${screenPos.x}px, ${screenPos.y}px, 0)`
            }}
          >
            <svg
              width="16"
              height="20"
              viewBox="0 0 16 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M1 1L6.5 18L9.5 11.5L15 9.5L1 1Z"
                fill={c.color || '#2563EB'}
                stroke="#FFFFFF"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </svg>
            <div
              className="cursor-pill"
              style={{ backgroundColor: c.color || '#2563EB' }}
            >
              {c.name || 'Anonymous'}
            </div>
          </div>
        );
      })}
    </div>
  );
}
