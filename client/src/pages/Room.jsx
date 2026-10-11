import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  MarkerType,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  useReactFlow
} from '@xyflow/react';
import { Copy, MessageSquare, Download } from 'lucide-react';
import { socket } from '../socket';
import { nodeTypes, ShapeNodeContext } from '../components/ShapeNodes';
import LabeledEdge, { EdgeContext } from '../components/LabeledEdge';
import ChatPanel from '../components/ChatPanel';
import Toolbar from '../components/Toolbar';
import Cursors from '../components/Cursors';
import AvatarStack from '../components/AvatarStack';
import JoinModal from '../components/JoinModal';
import Toast from '../components/Toast';
import WsInspector from '../components/WsInspector';
import { exportRoomPdf } from '../utils/exportPdf';

const edgeTypes = {
  labeled: LabeledEdge
};

const SAMPLE_NODES = [
  { id: '1', type: 'circle', position: { x: 120, y: 220 }, data: { label: 'Start', color: 'white' } },
  { id: '2', type: 'rect', position: { x: 280, y: 228 }, data: { label: 'Process', color: 'white' } },
  { id: '3', type: 'diamond', position: { x: 500, y: 212 }, data: { label: 'Decision', color: 'white' } },
  { id: '4', type: 'circle', position: { x: 720, y: 220 }, data: { label: 'End', color: 'white' } }
];

const SAMPLE_EDGES = [
  {
    id: 'e1-2',
    source: '1',
    target: '2',
    type: 'labeled',
    markerEnd: { type: MarkerType.ArrowClosed },
    data: { label: '' }
  },
  {
    id: 'e2-3',
    source: '2',
    target: '3',
    type: 'labeled',
    markerEnd: { type: MarkerType.ArrowClosed },
    data: { label: '' }
  },
  {
    id: 'e3-4',
    source: '3',
    target: '4',
    type: 'labeled',
    markerEnd: { type: MarkerType.ArrowClosed },
    data: { label: '' }
  }
];

function getHostKey(roomId) {
  const storageKey = `flowroom-host-${roomId}`;
  let key = localStorage.getItem(storageKey);
  if (!key) {
    key = crypto.randomUUID();
    localStorage.setItem(storageKey, key);
  }
  return key;
}

function RoomCanvas({ roomId, userName }) {
  const { screenToFlowPosition, fitView } = useReactFlow();

  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [users, setUsers] = useState([]);
  const [cursors, setCursors] = useState({});
  const [isHost, setIsHost] = useState(false);
  const [viewOnly, setViewOnly] = useState(false);
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [latency, setLatency] = useState(null);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [toasts, setToasts] = useState([]);

  // Undo/Redo snapshot history
  const undoStack = useRef([]);
  const redoStack = useRef([]);
  const isRemote = useRef(false);
  const flowThrottleTimer = useRef(null);
  const lastCursorEmit = useRef(0);
  const prevUsersRef = useRef([]);

  const isEditingAllowed = isHost || !viewOnly;

  // Helper to add toast notifications
  const addToast = useCallback((text) => {
    const id = Math.random().toString(36).slice(2, 9);
    setToasts((prev) => [...prev, { id, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2500);
  }, []);

  // Broadcast flowchart update to room
  const emitFlowUpdate = useCallback((newNodes, newEdges) => {
    socket.emit('flow-update', { nodes: newNodes, edges: newEdges });
  }, []);

  // Push state to undo stack before changes
  const saveSnapshot = useCallback((currentNodes, currentEdges) => {
    undoStack.current.push({
      nodes: JSON.parse(JSON.stringify(currentNodes)),
      edges: JSON.parse(JSON.stringify(currentEdges))
    });
    if (undoStack.current.length > 50) {
      undoStack.current.shift();
    }
    // New local changes clear the redo stack
    redoStack.current = [];
  }, []);

  // Throttled emitter for node dragging / position changes
  const queueFlowUpdate = useCallback((newNodes, newEdges) => {
    if (flowThrottleTimer.current) return;
    flowThrottleTimer.current = setTimeout(() => {
      emitFlowUpdate(newNodes, newEdges);
      flowThrottleTimer.current = null;
    }, 50);
  }, [emitFlowUpdate]);

  // Connect and join room
  useEffect(() => {
    if (!userName) return;

    if (!socket.connected) {
      socket.connect();
    }

    const onConnect = () => {
      setIsConnected(true);
      const hostKey = getHostKey(roomId);
      socket.emit('join-room', { roomId, name: userName, hostKey });
    };

    const onDisconnect = () => {
      setIsConnected(false);
    };

    const onRoomState = (state) => {
      isRemote.current = true;
      if (typeof state.viewOnly === 'boolean') {
        setViewOnly(state.viewOnly);
      }
      if (Array.isArray(state.chat)) {
        setMessages(state.chat);
      }
      if (state.nodes && state.nodes.length > 0) {
        setNodes(state.nodes);
        setEdges(state.edges || []);
      } else {
        // First user (host) initializes canvas with sample flowchart
        setNodes(SAMPLE_NODES);
        setEdges(SAMPLE_EDGES);
        emitFlowUpdate(SAMPLE_NODES, SAMPLE_EDGES);
      }

      const roomUsers = state.users || [];
      setUsers(roomUsers);
      prevUsersRef.current = roomUsers;

      const me = roomUsers.find((u) => u.id === socket.id);
      if (me) {
        setIsHost(Boolean(me.isHost));
      }

      setTimeout(() => {
        isRemote.current = false;
      }, 50);
    };

    const onUsersUpdate = (newUsers) => {
      const me = newUsers.find((u) => u.id === socket.id);
      if (me) {
        setIsHost(Boolean(me.isHost));
      }

      // Toast notifications for join / leave
      const prev = prevUsersRef.current;
      if (prev.length > 0) {
        newUsers.forEach((u) => {
          if (!prev.find((p) => p.id === u.id) && u.id !== socket.id) {
            addToast(`${u.name} joined`);
          }
        });
        prev.forEach((p) => {
          if (!newUsers.find((u) => u.id === p.id) && p.id !== socket.id) {
            addToast(`${p.name} left`);
          }
        });
      }
      prevUsersRef.current = newUsers;
      setUsers(newUsers);
    };

    const onSetViewOnly = (data) => {
      const val = typeof data === 'object' && data !== null && 'value' in data ? Boolean(data.value) : Boolean(data);
      setViewOnly(val);
      addToast(val ? 'Editing turned off by host' : 'Editing turned on');
    };

    const onChatMessage = (msg) => {
      setMessages((prev) => [...prev, msg]);
      setIsChatOpen((open) => {
        if (!open) {
          setUnreadCount((c) => c + 1);
        }
        return open;
      });
    };

    const onFlowUpdate = ({ nodes: remoteNodes, edges: remoteEdges }) => {
      isRemote.current = true;
      setNodes(remoteNodes || []);
      setEdges(remoteEdges || []);
      setTimeout(() => {
        isRemote.current = false;
      }, 50);
    };

    const onCursorMove = (cursor) => {
      setCursors((prev) => ({ ...prev, [cursor.id]: cursor }));
    };

    const onCursorLeave = (socketId) => {
      setCursors((prev) => {
        const next = { ...prev };
        delete next[socketId];
        return next;
      });
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('room-state', onRoomState);
    socket.on('users-update', onUsersUpdate);
    socket.on('view-only', onSetViewOnly);
    socket.on('chat-message', onChatMessage);
    socket.on('flow-update', onFlowUpdate);
    socket.on('cursor-move', onCursorMove);
    socket.on('cursor-leave', onCursorLeave);

    // If socket is already connected when component mounts
    if (socket.connected) {
      onConnect();
    }

    // Measure round-trip latency every 2 seconds
    const latencyInterval = setInterval(() => {
      if (socket.connected) {
        const start = performance.now();
        socket.emit('latency-check', () => {
          setLatency(Math.round(performance.now() - start));
        });
      }
    }, 2000);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('room-state', onRoomState);
      socket.off('users-update', onUsersUpdate);
      socket.off('view-only', onSetViewOnly);
      socket.off('chat-message', onChatMessage);
      socket.off('flow-update', onFlowUpdate);
      socket.off('cursor-move', onCursorMove);
      socket.off('cursor-leave', onCursorLeave);
      clearInterval(latencyInterval);
      if (flowThrottleTimer.current) clearTimeout(flowThrottleTimer.current);
    };
  }, [roomId, userName, emitFlowUpdate, addToast]);

  // Handle node changes from React Flow
  const onNodesChange = useCallback(
    (changes) => {
      if (!isEditingAllowed) return;
      setNodes((nds) => {
        const next = applyNodeChanges(changes, nds);
        if (!isRemote.current) {
          queueFlowUpdate(next, edges);
        }
        return next;
      });
    },
    [isEditingAllowed, edges, queueFlowUpdate]
  );

  // Handle edge changes from React Flow
  const onEdgesChange = useCallback(
    (changes) => {
      if (!isEditingAllowed) return;
      setEdges((eds) => {
        const next = applyEdgeChanges(changes, eds);
        if (!isRemote.current) {
          queueFlowUpdate(nodes, next);
        }
        return next;
      });
    },
    [isEditingAllowed, nodes, queueFlowUpdate]
  );

  // Handle edge connection
  const onConnect = useCallback(
    (params) => {
      if (!isEditingAllowed) return;
      saveSnapshot(nodes, edges);
      setEdges((eds) => {
        const next = addEdge(
          {
            ...params,
            type: 'labeled',
            markerEnd: { type: MarkerType.ArrowClosed },
            data: { label: '' }
          },
          eds
        );
        emitFlowUpdate(nodes, next);
        return next;
      });
    },
    [isEditingAllowed, nodes, edges, saveSnapshot, emitFlowUpdate]
  );

  // Change color of selected nodes
  const handleColorChange = useCallback(
    (color, targetNodeId) => {
      if (!isEditingAllowed) return;
      saveSnapshot(nodes, edges);
      const hasSelected = nodes.some((n) => n.selected);
      const nextNodes = nodes.map((node) => {
        if ((hasSelected && node.selected) || (!hasSelected && node.id === targetNodeId) || node.id === targetNodeId) {
          return {
            ...node,
            data: {
              ...node.data,
              color
            }
          };
        }
        return node;
      });
      setNodes(nextNodes);
      emitFlowUpdate(nextNodes, edges);
    },
    [isEditingAllowed, nodes, edges, saveSnapshot, emitFlowUpdate]
  );

  // Change label of a standard node
  const handleLabelChange = useCallback(
    (id, newLabel) => {
      if (!isEditingAllowed) return;
      saveSnapshot(nodes, edges);
      const nextNodes = nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, label: newLabel } } : n
      );
      setNodes(nextNodes);
      emitFlowUpdate(nextNodes, edges);
    },
    [isEditingAllowed, nodes, edges, saveSnapshot, emitFlowUpdate]
  );

  // Sticky note typing sync (debounced, without undo snapshot)
  const handleStickyTextChange = useCallback(
    (id, newText) => {
      if (!isEditingAllowed) return;
      const nextNodes = nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, text: newText } } : n
      );
      setNodes(nextNodes);
      emitFlowUpdate(nextNodes, edges);
    },
    [isEditingAllowed, nodes, edges, emitFlowUpdate]
  );

  // Sticky note blur (saves snapshot to undo stack)
  const handleStickyTextBlur = useCallback(
    (id, newText) => {
      if (!isEditingAllowed) return;
      saveSnapshot(nodes, edges);
      const nextNodes = nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, text: newText, isNew: false } } : n
      );
      setNodes(nextNodes);
      emitFlowUpdate(nextNodes, edges);
    },
    [isEditingAllowed, nodes, edges, saveSnapshot, emitFlowUpdate]
  );

  // Change label of an edge
  const handleEdgeLabelChange = useCallback(
    (edgeId, newLabel) => {
      if (!isEditingAllowed) return;
      saveSnapshot(nodes, edges);
      const nextEdges = edges.map((e) =>
        e.id === edgeId
          ? {
              ...e,
              data: {
                ...e.data,
                label: newLabel || ''
              }
            }
          : e
      );
      setEdges(nextEdges);
      emitFlowUpdate(nodes, nextEdges);
    },
    [isEditingAllowed, nodes, edges, saveSnapshot, emitFlowUpdate]
  );

  // Send room chat message
  const handleSendMessage = useCallback((text) => {
    socket.emit('chat-message', { text });
  }, []);

  // Live cursor broadcasting throttled to 30ms
  const handlePointerMove = (e) => {
    const now = performance.now();
    if (now - lastCursorEmit.current < 30) return;
    lastCursorEmit.current = now;
    const flowPos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    socket.emit('cursor-move', flowPos);
  };

  // Add node at viewport center
  const handleAddNode = (type) => {
    if (!isEditingAllowed) return;
    saveSnapshot(nodes, edges);
    const center = screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2
    });
    const defaultLabels = {
      rect: 'Process',
      circle: 'Step',
      diamond: 'Decision'
    };

    let newNode;
    if (type === 'sticky') {
      newNode = {
        id: Math.random().toString(36).slice(2, 9),
        type: 'sticky',
        position: { x: center.x - 90, y: center.y - 70 },
        style: { width: 180, height: 140 },
        data: { text: '', color: 'amber', isNew: true }
      };
    } else {
      newNode = {
        id: Math.random().toString(36).slice(2, 9),
        type,
        position: { x: center.x - 50, y: center.y - 25 },
        data: { label: defaultLabels[type] || 'Node', color: 'white' }
      };
    }

    const nextNodes = [...nodes, newNode];
    setNodes(nextNodes);
    emitFlowUpdate(nextNodes, edges);
  };

  // Delete selected nodes and edges
  const handleDeleteSelected = () => {
    if (!isEditingAllowed) return;
    const selectedNodes = nodes.filter((n) => n.selected);
    const selectedEdges = edges.filter((e) => e.selected);
    if (selectedNodes.length === 0 && selectedEdges.length === 0) return;

    saveSnapshot(nodes, edges);
    const selectedNodeIds = new Set(selectedNodes.map((n) => n.id));
    const nextNodes = nodes.filter((n) => !n.selected);
    const nextEdges = edges.filter(
      (e) => !e.selected && !selectedNodeIds.has(e.source) && !selectedNodeIds.has(e.target)
    );
    setNodes(nextNodes);
    setEdges(nextEdges);
    emitFlowUpdate(nextNodes, nextEdges);
  };

  // Undo
  const handleUndo = () => {
    if (!isEditingAllowed || undoStack.current.length === 0) return;
    const prevSnapshot = undoStack.current.pop();
    redoStack.current.push({
      nodes: JSON.parse(JSON.stringify(nodes)),
      edges: JSON.parse(JSON.stringify(edges))
    });
    setNodes(prevSnapshot.nodes);
    setEdges(prevSnapshot.edges);
    emitFlowUpdate(prevSnapshot.nodes, prevSnapshot.edges);
  };

  // Redo
  const handleRedo = () => {
    if (!isEditingAllowed || redoStack.current.length === 0) return;
    const nextSnapshot = redoStack.current.pop();
    undoStack.current.push({
      nodes: JSON.parse(JSON.stringify(nodes)),
      edges: JSON.parse(JSON.stringify(edges))
    });
    setNodes(nextSnapshot.nodes);
    setEdges(nextSnapshot.edges);
    emitFlowUpdate(nextSnapshot.nodes, nextSnapshot.edges);
  };

  // Keyboard shortcuts (Ctrl+Z, Ctrl+Shift+Z, Delete/Backspace)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore if user is editing inside an input or textarea
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
      if (!isEditingAllowed) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        handleDeleteSelected();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEditingAllowed, handleUndo, handleRedo, handleDeleteSelected]);

  const handleCopyInviteLink = () => {
    navigator.clipboard.writeText(window.location.href);
    addToast('Link copied');
  };

  const handleDownloadPdf = async () => {
    if (!nodes || nodes.length === 0) {
      addToast('Nothing to export yet');
      return;
    }
    try {
      const success = await exportRoomPdf({
        roomId,
        nodes,
        users,
        chat: messages
      });
      if (success) {
        addToast('PDF downloaded');
      } else {
        addToast('Nothing to export yet');
      }
    } catch (err) {
      console.error('PDF export failed:', err);
      addToast('Failed to export PDF');
    }
  };

  const handleToggleInspector = () => {
    setIsInspectorOpen((prev) => {
      const next = !prev;
      if (next) {
        setIsChatOpen(false);
      }
      return next;
    });
  };

  const handleToggleChat = () => {
    setIsChatOpen((prev) => {
      const next = !prev;
      if (next) {
        setIsInspectorOpen(false);
        setUnreadCount(0);
      }
      return next;
    });
  };

  return (
    <div className="room-page">
      {/* Top bar */}
      <header className="room-topbar">
        <div className="room-topbar-left">
          <Link to="/" className="brand-wordmark">Flowroom</Link>
          <span className="room-code-chip" title="Room Code">{roomId}</span>
        </div>

        <div className="room-topbar-right">
          {isHost && (
            <div className="editing-control-group" title="Toggle editing permissions">
              <span className="editing-control-label">Editing</span>
              <button
                type="button"
                className={`editing-switch-btn ${viewOnly ? 'view-only' : 'on'}`}
                onClick={() => socket.emit('set-view-only', { value: !viewOnly })}
                aria-label="Toggle editing mode"
              >
                <span className="switch-thumb" />
                <span className="switch-text">{viewOnly ? 'View only' : 'On'}</span>
              </button>
            </div>
          )}

          <button
            type="button"
            className="ws-status-chip"
            onClick={handleToggleInspector}
            title="Open WebSocket Inspector"
          >
            <span className={`dot-indicator ${isConnected ? 'green' : 'grey'}`} />
            <span>WebSocket · {latency !== null ? `${latency}ms` : '...'}</span>
          </button>

          <button
            type="button"
            className={`btn-icon chat-btn ${isChatOpen ? 'active' : ''}`}
            onClick={handleToggleChat}
            title="Room Chat"
            aria-label="Room Chat"
          >
            <MessageSquare size={16} />
            {unreadCount > 0 && !isChatOpen && (
              <span className="chat-unread-badge">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          <AvatarStack users={users} />

          <button
            type="button"
            className="btn btn-secondary pdf-export-btn"
            onClick={handleDownloadPdf}
            title="Download PDF"
            aria-label="Download PDF"
            style={{ height: 32, padding: '0 10px', fontSize: 13 }}
          >
            <Download size={13} />
            <span className="btn-label-responsive">Download PDF</span>
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleCopyInviteLink}
            style={{ height: 32, padding: '0 10px', fontSize: 13 }}
          >
            <Copy size={13} />
            <span>Copy invite link</span>
          </button>

          <span
            className={`connection-dot ${isConnected ? 'connected' : 'reconnecting'}`}
            title={isConnected ? 'Connected' : 'Reconnecting'}
          />
        </div>
      </header>

      {/* Slim banner when students are in view-only mode */}
      {!isHost && viewOnly && (
        <div className="view-only-banner" role="status">
          <span>View only. The host has turned off editing.</span>
        </div>
      )}

      {/* React Flow Canvas */}
      <div className="canvas-wrapper" onPointerMove={handlePointerMove}>
        <ShapeNodeContext.Provider
          value={{
            isEditingAllowed,
            onColorChange: handleColorChange,
            onLabelChange: handleLabelChange,
            onStickyTextChange: handleStickyTextChange,
            onStickyTextBlur: handleStickyTextBlur,
            onResizeStart: () => saveSnapshot(nodes, edges)
          }}
        >
          <EdgeContext.Provider
            value={{
              isEditingAllowed,
              onEdgeLabelChange: handleEdgeLabelChange
            }}
          >
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={isEditingAllowed ? onNodesChange : undefined}
              onEdgesChange={isEditingAllowed ? onEdgesChange : undefined}
              onConnect={isEditingAllowed ? onConnect : undefined}
              nodesDraggable={isEditingAllowed}
              nodesConnectable={isEditingAllowed}
              elementsSelectable={isEditingAllowed}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              connectionMode="loose"
              defaultEdgeOptions={{
                type: 'labeled',
                markerEnd: { type: MarkerType.ArrowClosed }
              }}
              onNodeDragStart={isEditingAllowed ? () => saveSnapshot(nodes, edges) : undefined}
              fitView
            >
              <Background variant="dots" gap={16} size={1} color="#D6D3D1" />
              <Controls showInteractive={false} />
              <MiniMap position="bottom-right" style={{ height: 100, width: 140 }} />
              <Cursors cursors={cursors} />
            </ReactFlow>
          </EdgeContext.Provider>
        </ShapeNodeContext.Provider>

        <Toolbar
          onAddNode={handleAddNode}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onDeleteSelected={handleDeleteSelected}
          onFitView={() => fitView({ padding: 0.2 })}
          canUndo={undoStack.current.length > 0}
          canRedo={redoStack.current.length > 0}
          isEditingAllowed={isEditingAllowed}
        />
      </div>

      <WsInspector
        isOpen={isInspectorOpen}
        onClose={() => setIsInspectorOpen(false)}
        isConnected={isConnected}
        latency={latency}
        userCount={users.length}
      />

      <ChatPanel
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        messages={messages}
        onSendMessage={handleSendMessage}
      />

      <Toast toasts={toasts} />
    </div>
  );
}

export default function Room() {
  const { roomId } = useParams();
  const [userName, setUserName] = useState(() => localStorage.getItem('flowroom_username') || '');
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(!userName);

  const handleJoin = (name) => {
    localStorage.setItem('flowroom_username', name);
    setUserName(name);
    setIsJoinModalOpen(false);
  };

  return (
    <ReactFlowProvider>
      <JoinModal isOpen={isJoinModalOpen} onJoin={handleJoin} />
      {userName ? (
        <RoomCanvas roomId={roomId} userName={userName} />
      ) : (
        <div style={{ height: '100%', backgroundColor: 'var(--bg)' }} />
      )}
    </ReactFlowProvider>
  );
}
