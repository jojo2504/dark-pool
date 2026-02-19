import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a raw USDCx amount (6 decimals, stored as string/bigint/number)
 * into a human-readable string like "10,000.00 USDCx".
 *
 * Examples:
 *   formatUSDCx("10000000000") → "10,000.00 USDCx"   (raw on-chain, 6 dec)
 *   formatUSDCx(10000)         → "10,000.00 USDCx"   (already human)
 */
export function formatUSDCx(amount: number | string | bigint): string {
  const raw = Number(amount.toString().split(".")[0]);
  // If value looks like it was already divided (< 1 million), treat as human
  const human = raw > 1_000_000 ? raw / 1_000_000 : raw;
  return `${human.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} USDCx`;
}

export function formatAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/**
 * Format a duration in seconds to a human-readable countdown string.
 * @param seconds Remaining seconds (0 or negative = "Ended")
 */
export function formatTimeLeft(seconds: number): string {
  if (seconds <= 0) return "Ended";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
}
