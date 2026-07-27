interface LoadingIndicatorProps {
  label?: string;
}

export function LoadingIndicator({ label = "Memuat..." }: LoadingIndicatorProps) {
  return (
    <div className="loading-indicator">
      <span className="spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
