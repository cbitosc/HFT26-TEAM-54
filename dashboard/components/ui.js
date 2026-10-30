"use client";
// Small shared building blocks (neumorphic): cards, badges, buttons, formatting helpers.
import { useEffect, useState } from "react";

export const METRIC_NAMES = ["tests_passed", "edge_cases", "lint", "simplicity"];
export const WEIGHTS = [50, 20, 15, 15]; // PLAN.md 3.1, same as inside the circuit

// Fetch a JSON API route now and then every `ms` milliseconds (live dashboard).
export function usePoll(url, ms = 3000) {
  const [state, setState] = useState({ data: null, error: null });
  useEffect(() => {
    if (!url) return;
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch(url, { cache: "no-store" });
        const data = await res.json();
        if (alive) setState({ data, error: res.ok ? null : data.error || res.statusText });
      } catch (e) {
        if (alive) setState((s) => ({ data: s.data, error: e.message }));
      }
    };
    load();
    const t = setInterval(load, ms);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [url, ms]);
  return state;
}

export function Card({ title, right, children, className = "" }) {
  return (
    <section className={`neu-card ${className}`}>
      {title && (
        <header className="flex items-center justify-between gap-3 px-6 pt-5 pb-1">
          <h2 className="text-sm font-semibold tracking-tight text-gray-800 dark:text-gray-100">{title}</h2>
          {right}
        </header>
      )}
      <div className="p-6 pt-4">{children}</div>
    </section>
  );
}

// Accent colour per tone (the dot); the text stays in readable ink.
export const TONE_COLOR = {
  green: "var(--accent-teal)",
  red: "var(--accent-red)",
  amber: "var(--accent-yellow)",
  blue: "var(--accent)",
  violet: "var(--accent)",
  gray: "var(--neu-dark)",
};

export function Badge({ tone = "gray", children, title }) {
  return (
    <span
      title={title}
      className="neu-inset inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium text-gray-700 dark:text-gray-200"
    >
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: TONE_COLOR[tone] }} />
      {children}
    </span>
  );
}

export const STATUS_TONE = {
  improved: "green",
  failed_no_improvement: "red",
  too_easy: "amber",
  running: "blue",
  error: "red",
  empty: "gray",
};

export function StatusBadge({ status }) {
  const label = { failed_no_improvement: "no improvement", too_easy: "too easy" }[status] || status;
  return <Badge tone={STATUS_TONE[status] || "gray"}>{label}</Badge>;
}

// A neumorphic toggle button: raised normally, pressed when active.
export function NeuButton({ active, className = "", children, ...props }) {
  return (
    <button
      {...props}
      className={`rounded-xl px-3 py-1.5 text-sm font-medium transition-all duration-200 ${
        active ? "neu-inset text-[var(--ink-violet)]" : "neu-btn text-gray-700 dark:text-gray-200"
      } ${className}`}
    >
      {children}
    </button>
  );
}

export function short(s, head = 6, tail = 4) {
  if (s == null) return "";
  s = String(s);
  return s.length > head + tail + 1 ? `${s.slice(0, head)}…${s.slice(-tail)}` : s;
}

export function scoreLine(scores) {
  return (scores || []).filter((s) => s != null).join(" → ");
}

export function timeAgo(ms) {
  if (!ms) return "";
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

export function weiToEth(wei) {
  if (wei == null) return "";
  return `${Number(BigInt(wei)) / 1e18} ETH`;
}

export function ExtLink({ href, children }) {
  if (!href) return <span>{children}</span>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-[var(--ink-violet)] underline decoration-[var(--accent)]/30 underline-offset-2 hover:decoration-[var(--accent)]"
    >
      {children}
    </a>
  );
}

export function Spinner({ className = "h-3 w-3" }) {
  return (
    <svg viewBox="0 0 24 24" aria-label="working" className={`shrink-0 animate-spin ${className}`}>
      <circle cx="12" cy="12" r="9" fill="none" stroke="var(--neu-dark)" strokeWidth="3" />
      <path d="M12 3a9 9 0 0 1 9 9" fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Empty({ children }) {
  return <p className="text-sm text-gray-500 dark:text-gray-400">{children}</p>;
}

// A recessed panel (for logs, tables, code).
export function Well({ className = "", children, ...props }) {
  return (
    <div {...props} className={`neu-inset rounded-xl p-3 ${className}`}>
      {children}
    </div>
  );
}
