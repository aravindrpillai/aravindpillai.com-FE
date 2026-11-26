export function Skeleton({
  height = 16,
  width = "100%",
  count = 1,
}: {
  height?: number;
  width?: string | number;
  count?: number;
}) {
  return (
    <div aria-hidden="true" className="stack" data-testid="skeleton">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="skeleton" style={{ height, width }} />
      ))}
    </div>
  );
}
