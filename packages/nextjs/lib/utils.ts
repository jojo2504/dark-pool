import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { formatEther, parseEther } from "viem";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

/**
 * Format a native token amount (wei, bigint) into a human-readable string.
 */
export function formatWei(amount: bigint | string | number, symbol = "ETH", decimals = 4): string {
    const wei = BigInt(amount.toString().split(".")[0]);
    const human = Number(formatEther(wei));
    return `${human.toLocaleString("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    })} ${symbol}`;
}

/**
 * Safe parseEther — returns 0n on invalid input.
 */
export function safeParseEther(value: string): bigint {
    try {
        return parseEther(value);
    } catch {
        return 0n;
    }
}

export function formatAddress(address: string): string {
    if (address.length < 10) return address;
    return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/**
 * Format a duration in seconds to a human-readable countdown string.
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

/**
 * Format unix timestamp (seconds) to locale string.
 */
export function formatTimestamp(ts: bigint | number): string {
    return new Date(Number(ts) * 1000).toLocaleString();
}
