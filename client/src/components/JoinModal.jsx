import React, { useState } from 'react';

export default function JoinModal({ isOpen, onJoin }) {
  const [name, setName] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    const finalName = name.trim() || 'Guest';
    onJoin(finalName);
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-card">
        <div>
          <h2 className="modal-title">Join room</h2>
          <p className="modal-desc">Enter your name to start editing the flowchart.</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            type="text"
            className="input"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            maxLength={24}
          />

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%' }}
          >
            Join room
          </button>
        </form>
      </div>
    </div>
  );
}
