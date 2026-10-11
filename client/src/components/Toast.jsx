import React from 'react';

export default function Toast({ toasts = [] }) {
  if (!toasts.length) return null;

  return (
    <div className="toast-container" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className="toast-item">
          {t.text}
        </div>
      ))}
    </div>
  );
}
