"use client";

interface Props {
  data: number[];
  width?: number;
  height?: number;
  positive?: boolean;
}

export function Sparkline({ data, width = 80, height = 28, positive }: Props) {
  if (!data.length) return null;

  const min = Math.min(...data, 0);
  const max = Math.max(...data, 0);
  const range = max - min || 1;

  const pts = data.map((v, i) => {
    const x = (i / Math.max(data.length - 1, 1)) * width;
    const y = height - ((v - min) / range) * height;
    return `${x},${y}`;
  });

  const color = positive === false ? "#ef4444" : positive === true ? "#22c55e" : (data[data.length - 1] ?? 0) >= 0 ? "#22c55e" : "#ef4444";
  const zeroY = height - ((0 - min) / range) * height;

  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity={0.9}
      />
      <line x1={0} y1={zeroY} x2={width} y2={zeroY} stroke="#2a2a32" strokeWidth="1" strokeDasharray="2 2" />
    </svg>
  );
}
