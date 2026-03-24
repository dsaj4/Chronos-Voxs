interface ViewStatusCardProps {
  label: string;
  summary: string;
  detail: string;
  isActive: boolean;
  onSelect: () => void;
}

export function ViewStatusCard({ label, summary, detail, isActive, onSelect }: ViewStatusCardProps) {
  return (
    <button
      type="button"
      className={`preview-card ${isActive ? "preview-card--active" : ""}`}
      onClick={onSelect}
    >
      <span className="preview-card__label">{label}</span>
      <strong className="preview-card__summary">{summary}</strong>
      <span className="muted">{detail}</span>
    </button>
  );
}
