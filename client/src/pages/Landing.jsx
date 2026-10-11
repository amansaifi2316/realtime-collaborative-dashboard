import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export default function Landing() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const savedName = localStorage.getItem('flowroom_username') || '';
    if (savedName) {
      setName(savedName);
    }
  }, []);

  const handleCreateRoom = (e) => {
    e.preventDefault();
    const finalName = name.trim() || 'Host';
    localStorage.setItem('flowroom_username', finalName);
    const code = generateRoomCode();
    const hostKey = crypto.randomUUID();
    localStorage.setItem(`flowroom-host-${code}`, hostKey);
    navigate(`/room/${code}`);
  };

  const handleJoinRoom = (e) => {
    e.preventDefault();
    const raw = joinCode.trim();
    let extracted = '';
    if (raw.includes('/room/')) {
      extracted = raw.slice(raw.indexOf('/room/') + '/room/'.length);
      extracted = extracted.split('?')[0].split('#')[0].replace(/\/+$/, '').trim();
    } else {
      extracted = raw;
    }

    const code = extracted.toUpperCase();
    if (!code) {
      setError('Enter a valid room code or link');
      return;
    }

    setError('');
    const finalName = name.trim() || 'Guest';
    localStorage.setItem('flowroom_username', finalName);
    navigate(`/room/${code}`);
  };

  return (
    <div className="landing-page">
      <header className="landing-header">
        <span className="brand-wordmark">Flowroom</span>
      </header>

      <main className="landing-content">
        <div className="landing-hero">
          <h1>Draw flowcharts together, live.</h1>
          <p>
            Create a room, share the link, and everyone edits the same canvas in real time. No sign-up.
          </p>
        </div>

        <div className="landing-card">
          <div className="card-field">
            <label htmlFor="user-name" className="card-label">Your Name</label>
            <input
              id="user-name"
              className="input"
              type="text"
              placeholder="e.g. Alex"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={24}
            />
          </div>

          <button
            type="button"
            className="btn btn-primary"
            onClick={handleCreateRoom}
          >
            Create room
          </button>

          <div className="card-divider">
            <span>or join with a code</span>
          </div>

          <form onSubmit={handleJoinRoom} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div className="form-row">
              <input
                id="join-code"
                className="input"
                type="text"
                placeholder="ROOM CODE"
                value={joinCode}
                onChange={(e) => {
                  setJoinCode(e.target.value);
                  if (error) setError('');
                }}
              />
              <button
                type="submit"
                className="btn btn-secondary"
              >
                Join
              </button>
            </div>
            {error && (
              <span style={{ color: '#EF4444', fontSize: '12px' }}>
                {error}
              </span>
            )}
          </form>
        </div>

        <div className="landing-preview-container">
          <svg className="static-flowchart-svg" viewBox="0 0 520 140" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 1 L 8 5 L 0 9 z" fill="#78716C" />
              </marker>
            </defs>
            {/* Start Node (circle) */}
            <circle cx="60" cy="70" r="26" fill="#FFFFFF" stroke="#E7E5E4" strokeWidth="1.5" />
            <text x="60" y="74" textAnchor="middle" fill="#1C1917" fontSize="11" fontWeight="500" fontFamily="Inter, sans-serif">Start</text>

            {/* Edge 1 */}
            <line x1="86" y1="70" x2="148" y2="70" stroke="#78716C" strokeWidth="1.5" markerEnd="url(#arrow)" />

            {/* Process Node (rectangle) */}
            <rect x="150" y="48" width="96" height="44" rx="6" fill="#FFFFFF" stroke="#E7E5E4" strokeWidth="1.5" />
            <text x="198" y="74" textAnchor="middle" fill="#1C1917" fontSize="11" fontWeight="500" fontFamily="Inter, sans-serif">Process</text>

            {/* Edge 2 */}
            <line x1="246" y1="70" x2="308" y2="70" stroke="#78716C" strokeWidth="1.5" markerEnd="url(#arrow)" />

            {/* Decision Node (diamond) */}
            <polygon points="350,42 384,70 350,98 316,70" fill="#FFFFFF" stroke="#E7E5E4" strokeWidth="1.5" />
            <text x="350" y="74" textAnchor="middle" fill="#1C1917" fontSize="10" fontWeight="500" fontFamily="Inter, sans-serif">Decision</text>

            {/* Edge 3 */}
            <line x1="384" y1="70" x2="438" y2="70" stroke="#78716C" strokeWidth="1.5" markerEnd="url(#arrow)" />

            {/* End Node (circle) */}
            <circle cx="466" cy="70" r="26" fill="#FFFFFF" stroke="#E7E5E4" strokeWidth="1.5" />
            <text x="466" y="74" textAnchor="middle" fill="#1C1917" fontSize="11" fontWeight="500" fontFamily="Inter, sans-serif">End</text>
          </svg>

          <div className="feature-bullets">
            <div className="feature-bullet-item">
              <span className="feature-dot"></span>
              <span>Live cursors</span>
            </div>
            <div className="feature-bullet-item">
              <span className="feature-dot"></span>
              <span>Instant sync</span>
            </div>
            <div className="feature-bullet-item">
              <span className="feature-dot"></span>
              <span>No sign-up</span>
            </div>
          </div>
        </div>
      </main>

      <footer className="landing-footer">
        Built as a college mini project
      </footer>
    </div>
  );
}
