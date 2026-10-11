import React from 'react';

export default function AvatarStack({ users = [] }) {
  const visibleUsers = users.slice(0, 5);
  const overflow = users.length - 5;

  return (
    <div className="avatar-stack" aria-label="Users in room">
      {visibleUsers.map((u) => {
        const initials = (u.name || 'G').trim().slice(0, 2).toUpperCase();
        const tooltip = u.isHost ? `${u.name} (Host)` : u.name;
        return (
          <div
            key={u.id}
            className="avatar-circle"
            style={{ backgroundColor: u.color || '#2563EB' }}
            title={tooltip}
          >
            {initials}
          </div>
        );
      })}
      {overflow > 0 && (
        <div
          className="avatar-circle avatar-overflow"
          title={`${overflow} more users`}
        >
          +{overflow}
        </div>
      )}
    </div>
  );
}
