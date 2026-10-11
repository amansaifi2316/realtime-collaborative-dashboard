import React, { useState, useEffect, useRef } from 'react';
import { X, Send } from 'lucide-react';

function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

export default function ChatPanel({ isOpen, onClose, messages = [], onSendMessage }) {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  useEffect(() => {
    if (isOpen && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed) return;
    onSendMessage(trimmed);
    setInputText('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <aside className="ws-inspector-drawer chat-drawer" aria-label="Room Chat">
      <div className="inspector-header">
        <span className="inspector-title">Room Chat</span>
        <button
          type="button"
          className="btn-icon"
          onClick={onClose}
          title="Close Chat"
          aria-label="Close"
        >
          <X size={16} />
        </button>
      </div>

      <div className="chat-messages-container">
        {messages.length === 0 ? (
          <div className="chat-empty">No messages yet.</div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className="chat-message-item">
              <div className="chat-message-header">
                <span className="chat-message-author" style={{ color: msg.color || 'var(--text)' }}>
                  {msg.name}
                </span>
                <span className="chat-message-time">{formatTime(msg.ts)}</span>
              </div>
              <div className="chat-message-body">{msg.text}</div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <form className="chat-input-area" onSubmit={handleSubmit}>
        <textarea
          ref={textareaRef}
          className="chat-textarea"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message... (Enter to send, Shift+Enter for new line)"
          rows={2}
          maxLength={500}
        />
        <button
          type="submit"
          className="btn btn-primary chat-send-btn"
          disabled={!inputText.trim()}
          title="Send message"
          aria-label="Send message"
        >
          <Send size={14} />
        </button>
      </form>
    </aside>
  );
}
