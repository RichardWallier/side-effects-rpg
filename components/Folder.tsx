"use client";

export function Folder({
  label,
  sub,
  color,
  badge,
  onOpen,
}: {
  label: string;
  sub: string;
  color: string;
  badge?: number;
  onOpen: () => void;
}) {
  return (
    <button className="folder" onClick={onOpen}>
      {badge != null && badge > 0 && <span className="folder-badge">{badge}</span>}
      <div className="folder-icon" style={{ "--fcolor": color } as React.CSSProperties} />
      <div className="folder-label">{label}</div>
      <div className="folder-sub">{sub}</div>
    </button>
  );
}

export function LockedFolder({ name, onOpen }: { name: string; onOpen: () => void }) {
  return (
    <button className="folder locked-folder" onClick={onOpen}>
      <div
        className="folder-icon locked"
        style={{ "--fcolor": "#4a4438" } as React.CSSProperties}
      />
      <div className="folder-label">{name}</div>
      <div className="folder-sub locked-sub">🔒 restrito</div>
    </button>
  );
}
