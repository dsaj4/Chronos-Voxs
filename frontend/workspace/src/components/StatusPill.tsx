interface StatusPillProps {
  label: string;
  value: string;
}

export function StatusPill({ label, value }: StatusPillProps) {
  return (
    <div className="status-pill">
      <span className="status-pill__label">{label}</span>
      <span className="status-pill__value">{value}</span>
    </div>
  );
}
