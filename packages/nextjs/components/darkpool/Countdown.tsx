"use client";

import { useEffect, useState } from "react";
import { formatTimeLeft } from "~~/lib/utils";

const TWELVE_HOURS = 12 * 3600;

interface CountdownProps {
  /** Unix timestamp (seconds) when the auction closes */
  closeTimestamp: number;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Live countdown that ticks every second.
 * Turns red when less than 12 hours remain.
 */
export function Countdown({ closeTimestamp, className = "" }: CountdownProps) {
  const calcSecsLeft = () => Math.max(0, closeTimestamp - Math.floor(Date.now() / 1000));

  const [secsLeft, setSecsLeft] = useState(calcSecsLeft);

  useEffect(() => {
    setSecsLeft(calcSecsLeft());
    const id = setInterval(() => {
      const left = calcSecsLeft();
      setSecsLeft(left);
      if (left <= 0) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closeTimestamp]);

  const isUrgent = secsLeft > 0 && secsLeft < TWELVE_HOURS;

  return <span className={`${isUrgent ? "text-red-500" : ""} ${className}`}>{formatTimeLeft(secsLeft)}</span>;
}
