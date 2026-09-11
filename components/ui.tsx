import React from "react";

export function ScoreRing({
  value,
  max = 1000,
  size = 168,
  stroke = 13,
  color = "var(--clay)",
  label,
  sublabel,
}: {
  value: number;
  max?: number;
  size?: number;
  stroke?: number;
  color?: string;
  label?: string;
  sublabel?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const frac = Math.max(0, Math.min(1, value / max));
  const dash = c * frac;
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
          style={{ transition: "stroke-dasharray 0.7s cubic-bezier(0.2,0.8,0.2,1)" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="font-display text-3xl font-bold tabular-nums">
          {Math.round(value)}
        </span>
        {label && <span className="text-[0.7rem] uppercase tracking-wider text-[var(--ink-faint)]">{label}</span>}
        {sublabel && <span className="mt-0.5 text-[0.72rem] text-[var(--ink-soft)]">{sublabel}</span>}
      </div>
    </div>
  );
}

export function Bar({
  value,
  max = 100,
  color = "var(--clay)",
  height = 9,
}: {
  value: number;
  max?: number;
  color?: string;
  height?: number;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="track" style={{ height }}>
      <span style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "clay" | "green" | "amber" | "red" | "blue" | "purple";
}) {
  const map: Record<string, string> = {
    neutral: "var(--ink-soft)",
    clay: "var(--clay-deep)",
    green: "var(--green)",
    amber: "var(--amber)",
    red: "var(--red)",
    blue: "var(--blue)",
    purple: "var(--purple)",
  };
  const col = map[tone];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[0.72rem] font-semibold"
      style={{ color: col, borderColor: col, background: "color-mix(in srgb, " + col + " 8%, transparent)" }}
    >
      {children}
    </span>
  );
}

export function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="card-flat px-4 py-3">
      <div className="text-[0.7rem] uppercase tracking-wider text-[var(--ink-faint)]">{label}</div>
      <div className="font-display mt-0.5 text-2xl font-bold tabular-nums">
        {value}
      </div>
      {sub && <div className="mt-0.5 text-[0.78rem] text-[var(--ink-soft)]">{sub}</div>}
    </div>
  );
}

export function PageHeader({
  kicker,
  title,
  intro,
  right,
}: {
  kicker?: string;
  title: string;
  intro?: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        {kicker && (
          <div className="mb-1 text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-[var(--clay)]">
            {kicker}
          </div>
        )}
        <h1 className="text-[2rem] leading-tight">{title}</h1>
        {intro && <p className="mt-2 text-[0.95rem] leading-relaxed text-[var(--ink-soft)]">{intro}</p>}
      </div>
      {right}
    </div>
  );
}
