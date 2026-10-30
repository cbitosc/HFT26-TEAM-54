"use client";
// Small shared building blocks: cards, badges, formatting helpers.
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
    <section
      className={`rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900 ${className}`}
    >
      {title && (
        <header className="flex items-center justify-between gap-3 border-b border-zinc-200 px-4 py-2.5 dark:border-zinc-800">
          <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
          {right}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

const TONES = {
  green: "bg-emerald-100 text-emerald-800 ring-emerald-600/20 dark:bg-emerald-500/15 dark:text-emerald-300",
  red: "bg-red-100 text-red-800 ring-red-600/20 dark:bg-red-500/15 dark:text-red-300",
  amber: "bg-amber-100 text-amber-800 ring-amber-600/20 dark:bg-amber-500/15 dark:text-amber-300",
  blue: "bg-blue-100 text-blue-800 ring-blue-600/20 dark:bg-blue-500/15 dark:text-blue-300",
  violet: "bg-violet-100 text-violet-800 ring-violet-600/20 dark:bg-violet-500/15 dark:text-violet-300",
  gray: "bg-zinc-100 text-zinc-700 ring-zinc-500/20 dark:bg-zinc-800 dark:text-zinc-300",
};

export function Badge({ tone = "gray", children, title }) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${TONES[tone]}`}
    >
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
      className="font-medium text-blue-700 underline decoration-blue-700/30 underline-offset-2 hover:decoration-blue-700 dark:text-blue-400 dark:decoration-blue-400/30"
    >
      {children}
    </a>
  );
}

export function Empty({ children }) {
  return <p className="text-sm text-zinc-500 dark:text-zinc-400">{children}</p>;
}
