import React, { useState, useEffect, useRef } from 'react';
import { X, Play, Pause, Trash2 } from 'lucide-react';
import { socket, SERVER_WS_URL } from '../socket';

export default function WsInspector({ isOpen, onClose, isConnected, latency, userCount }) {
  const [tab, setTab] = useState('live'); // 'live' | 'diagram'
  const [isPaused, setIsPaused] = useState(false);
  const [hideCursorMove, setHideCursorMove] = useState(true);

  // Inspector metrics state
  const [metrics, setMetrics] = useState({
    sentCount: 0,
    recvCount: 0,
    bytesTransferred: 0,
    msgPerSec: 0,
    logs: []
  });

  const logsRef = useRef([]);
  const sentCountRef = useRef(0);
  const recvCountRef = useRef(0);
  const bytesRef = useRef(0);
  const timestampsRef = useRef([]);
  const isPausedRef = useRef(false);
  const hideCursorMoveRef = useRef(true);

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  useEffect(() => {
    hideCursorMoveRef.current = hideCursorMove;
  }, [hideCursorMove]);

  useEffect(() => {
    // Helper to format payload note
    const formatNote = (event, args) => {
      const data = args[0];
      if (!data) return '-';
      if (event === 'flow-update' || event === 'room-state') {
        return `${data.nodes?.length || 0} nodes, ${data.edges?.length || 0} edges`;
      }
      if (event === 'cursor-move') {
        return `x:${Math.round(data.x ?? 0)} y:${Math.round(data.y ?? 0)}`;
      }
      if (event === 'cursor-leave') {
        return `id:${String(data).slice(0, 6)}`;
      }
      if (event === 'join-room') {
        return `room:${data.roomId || ''}`;
      }
      if (event === 'users-update') {
        return `${data.length || 0} users`;
      }
      if (event === 'latency-check') {
        return 'ping/ack';
      }
      const str = JSON.stringify(data);
      return str.length > 20 ? str.slice(0, 18) + '...' : str;
    };

    const pushLog = (dir, event, args) => {
      const now = new Date();
      const timeStr = `${now.toTimeString().split(' ')[0]}.${String(now.getMilliseconds()).padStart(3, '0')}`;
      const payloadStr = JSON.stringify(args || []);
      const bytes = payloadStr.length;

      // Update counters regardless of filtering
      if (dir === 'sent') {
        sentCountRef.current += 1;
      } else {
        recvCountRef.current += 1;
      }
      bytesRef.current += bytes;
      timestampsRef.current.push(Date.now());

      if (isPausedRef.current) return;
      if (hideCursorMoveRef.current && event === 'cursor-move') return;

      const newEntry = {
        id: Math.random().toString(36).slice(2, 9),
        time: timeStr,
        dir,
        event,
        note: formatNote(event, args),
        bytes: `${bytes}B`
      };

      logsRef.current = [newEntry, ...logsRef.current.slice(0, 49)];
    };

    const handleReceived = (event, ...args) => {
      pushLog('recv', event, args);
    };

    const handleSent = (event, ...args) => {
      pushLog('sent', event, args);
    };

    socket.onAny(handleReceived);
    socket.onAnyOutgoing(handleSent);

    // Periodic flush to state every 250ms for high canvas performance
    const flushInterval = setInterval(() => {
      const now = Date.now();
      // Keep only timestamps from last 5s
      timestampsRef.current = timestampsRef.current.filter((t) => now - t <= 5000);
      const msgRate = (timestampsRef.current.length / 5).toFixed(1);

      setMetrics({
        sentCount: sentCountRef.current,
        recvCount: recvCountRef.current,
        bytesTransferred: bytesRef.current,
        msgPerSec: msgRate,
        logs: [...logsRef.current]
      });
    }, 250);

    return () => {
      socket.offAny(handleReceived);
      socket.offAnyOutgoing(handleSent);
      clearInterval(flushInterval);
    };
  }, []);

  const handleClearLogs = () => {
    logsRef.current = [];
    setMetrics((prev) => ({ ...prev, logs: [] }));
  };

  if (!isOpen) return null;

  const transportName = socket.io?.engine?.transport?.name || (isConnected ? 'websocket' : '-');
  const formatBytes = (b) => {
    if (b < 1024) return `${b} B`;
    return `${(b / 1024).toFixed(1)} KB`;
  };

  return (
    <aside className="ws-inspector-drawer" aria-label="WebSocket Inspector">
      <div className="inspector-header">
        <span className="inspector-title">WebSocket Inspector</span>
        <button
          type="button"
          className="btn-icon"
          onClick={onClose}
          title="Close Inspector"
          aria-label="Close"
        >
          <X size={16} />
        </button>
      </div>

      <div className="inspector-tabs">
        <button
          type="button"
          className={`inspector-tab-btn ${tab === 'live' ? 'active' : ''}`}
          onClick={() => setTab('live')}
        >
          Live
        </button>
        <button
          type="button"
          className={`inspector-tab-btn ${tab === 'diagram' ? 'active' : ''}`}
          onClick={() => setTab('diagram')}
        >
          How it works
        </button>
      </div>

      <div className="inspector-body">
        {tab === 'live' ? (
          <>
            {/* Status card */}
            <div className="inspector-card">
              <div className="status-row">
                <span className="status-label">Status</span>
                <span className="status-value" style={{ color: isConnected ? '#10B981' : '#A8A29E' }}>
                  {isConnected ? 'Connected' : 'Reconnecting'}
                </span>
              </div>
              <div className="status-row">
                <span className="status-label">Transport</span>
                <span className="status-value">{transportName}</span>
              </div>
              <div className="status-row">
                <span className="status-label">Server URL</span>
                <span className="status-value">{SERVER_WS_URL}</span>
              </div>
              <div className="status-row">
                <span className="status-label">Socket ID</span>
                <span className="status-value">{socket.id || '-'}</span>
              </div>
              <div className="status-row">
                <span className="status-label">Round-trip latency</span>
                <span className="status-value">{latency !== null ? `${latency}ms` : '-'}</span>
              </div>
              <div className="status-row">
                <span className="status-label">Users in room</span>
                <span className="status-value">{userCount}</span>
              </div>
            </div>

            {/* Counters */}
            <div className="counters-grid">
              <div className="counter-box">
                <div className="counter-num">{metrics.sentCount}</div>
                <div className="counter-label">Messages sent</div>
              </div>
              <div className="counter-box">
                <div className="counter-num">{metrics.recvCount}</div>
                <div className="counter-label">Messages received</div>
              </div>
              <div className="counter-box">
                <div className="counter-num">{formatBytes(metrics.bytesTransferred)}</div>
                <div className="counter-label">Data transferred</div>
              </div>
              <div className="counter-box">
                <div className="counter-num">{metrics.msgPerSec}/s</div>
                <div className="counter-label">Rate (last 5s)</div>
              </div>
            </div>

            {/* Controls */}
            <div className="log-controls">
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ height: 26, padding: '0 8px', fontSize: 11 }}
                  onClick={() => setIsPaused((p) => !p)}
                >
                  {isPaused ? <Play size={11} /> : <Pause size={11} />}
                  {isPaused ? 'Resume' : 'Pause'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ height: 26, padding: '0 8px', fontSize: 11 }}
                  onClick={handleClearLogs}
                  title="Clear log"
                >
                  <Trash2 size={11} /> Clear
                </button>
              </div>

              <label className="log-checkbox-label">
                <input
                  type="checkbox"
                  checked={hideCursorMove}
                  onChange={(e) => setHideCursorMove(e.target.checked)}
                />
                Hide cursor-move
              </label>
            </div>

            {/* Event log */}
            <div className="inspector-log-list" tabIndex={0} aria-label="Event logs">
              {metrics.logs.length === 0 ? (
                <div style={{ padding: '12px', color: 'var(--muted)', textAlign: 'center', fontSize: 11 }}>
                  No events logged yet
                </div>
              ) : (
                metrics.logs.map((row) => (
                  <div key={row.id} className="log-row">
                    <span className="log-time">{row.time}</span>
                    <span className={`log-arrow ${row.dir === 'sent' ? 'sent' : 'received'}`}>
                      {row.dir === 'sent' ? '↑' : '↓'}
                    </span>
                    <span className="log-event">{row.event}</span>
                    <span className="log-note" title={row.note}>{row.note}</span>
                    <span className="log-size">{row.bytes}</span>
                  </div>
                ))
              )}
            </div>

            <div className="inspector-hint">
              Open browser DevTools &gt; Network &gt; WS &gt; Messages to see the raw frames.
            </div>
          </>
        ) : (
          <>
            {/* How it works tab */}
            <div className="inspector-card">
              <div className="diagram-container">
                <svg className="diagram-svg" viewBox="0 0 320 80" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="5" y="24" width="75" height="32" rx="4" fill="#FFFFFF" stroke="#E7E5E4" strokeWidth="1.5" />
                  <text x="42" y="44" textAnchor="middle" fill="#1C1917" fontSize="11" fontFamily="Inter">Browser A</text>

                  <line x1="80" y1="40" x2="115" y2="40" stroke="#2563EB" strokeWidth="1.5" />
                  <polygon points="115,37 121,40 115,43" fill="#2563EB" />
                  <text x="100" y="32" textAnchor="middle" fill="#2563EB" fontSize="8" fontFamily="Inter">WS</text>

                  <rect x="122" y="24" width="76" height="32" rx="4" fill="#FFFFFF" stroke="#2563EB" strokeWidth="1.5" />
                  <text x="160" y="44" textAnchor="middle" fill="#1C1917" fontSize="11" fontWeight="600" fontFamily="Inter">Server</text>

                  <line x1="198" y1="40" x2="233" y2="40" stroke="#10B981" strokeWidth="1.5" />
                  <polygon points="233,37 239,40 233,43" fill="#10B981" />
                  <text x="218" y="32" textAnchor="middle" fill="#10B981" fontSize="8" fontFamily="Inter">WS</text>

                  <rect x="240" y="24" width="75" height="32" rx="4" fill="#FFFFFF" stroke="#E7E5E4" strokeWidth="1.5" />
                  <text x="277" y="44" textAnchor="middle" fill="#1C1917" fontSize="11" fontFamily="Inter">Browser B</text>
                </svg>
                <div className="diagram-caption">
                  One connection stays open. Either side can send any time.
                </div>
              </div>
            </div>

            <div className="inspector-card">
              <strong style={{ fontSize: 12 }}>3-Step Sync</strong>
              <div className="steps-list">
                <div className="step-item">1. You move a node.</div>
                <div className="step-item">2. The browser sends <code>flow-update</code> over the open WebSocket.</div>
                <div className="step-item">3. The server forwards it to everyone else in the room, instantly.</div>
              </div>
            </div>

            <div className="comparison-table">
              <div className="comparison-col">
                <div className="comparison-col-title">HTTP Polling</div>
                <div className="comparison-col-desc">
                  Client keeps asking "anything new?", delay, wasted requests.
                </div>
              </div>
              <div className="comparison-col">
                <div className="comparison-col-title">WebSocket</div>
                <div className="comparison-col-desc">
                  Server pushes when something changes, instant, one connection.
                </div>
              </div>
            </div>

            <div style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center' }}>
              Built with Socket.IO, running in WebSocket-only mode.
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
