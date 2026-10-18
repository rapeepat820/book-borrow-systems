export default function BarChartDecoration() {
  const bars = [26, 42, 34, 58, 40];
  return (
    <svg className="bar-decoration" viewBox="0 0 220 70" width="180" height="60">
      {bars.map((h, i) => (
        <rect key={i} x={i * 40 + 8} y={62 - h} width="24" height={h} rx="6" fill={i === 3 ? 'var(--primary)' : 'var(--primary-100)'} />
      ))}
    </svg>
  );
}
