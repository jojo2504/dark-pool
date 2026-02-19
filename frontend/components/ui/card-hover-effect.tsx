"use client";
import React, { useRef, useState } from "react";
import { cn } from "@/lib/utils";

export function CardHoverEffect({
  items,
  className,
}: {
  items: { title: string; description: string; icon?: React.ReactNode }[];
  className?: string;
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  return (
    <div className={cn("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4", className)}>
      {items.map((item, idx) => (
        <div
          key={idx}
          className="relative group block p-2 h-full w-full"
          onMouseEnter={() => setHoveredIndex(idx)}
          onMouseLeave={() => setHoveredIndex(null)}
        >
          {/* Glow overlay */}
          <div
            className={cn(
              "absolute inset-0 rounded-2xl transition-opacity duration-300",
              hoveredIndex === idx ? "opacity-100" : "opacity-0"
            )}
            style={{
              background:
                "radial-gradient(circle at 50% 50%, rgba(0,212,255,0.08), transparent 70%)",
            }}
          />
          <Card>
            <CardTitle>{item.icon && <span className="mb-2 block">{item.icon}</span>}{item.title}</CardTitle>
            <CardDescription>{item.description}</CardDescription>
          </Card>
        </div>
      ))}
    </div>
  );
}

export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl h-full w-full p-4 overflow-hidden border border-white/[0.06] bg-white/[0.03] relative z-20 group-hover:border-cyan-500/30 transition-colors duration-300",
        className
      )}
    >
      <div className="relative z-50 p-4">{children}</div>
    </div>
  );
}

export function CardTitle({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <h4 className={cn("text-zinc-100 font-bold tracking-wide flex items-center gap-2", className)}>
      {children}
    </h4>
  );
}

export function CardDescription({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <p className={cn("mt-3 text-zinc-400 tracking-wide leading-relaxed text-sm", className)}>
      {children}
    </p>
  );
}
