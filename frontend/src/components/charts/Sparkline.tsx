interface SparklineProps { values: readonly number[]; color?: string; height?: number; }

export default function Sparkline({ values, color = "#62e6f5", height = 34 }: SparklineProps) {
  const max = Math.max(...values);
  const min = Math.min(...values);
  const points = values.map((value, index) => `${(index / (values.length - 1)) * 100},${height - ((value - min) / Math.max(max - min, 1)) * (height - 5) - 2}`).join(" ");
  return <svg className="sparkline" viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" aria-hidden="true"><polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}