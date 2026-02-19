"use client";
import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export function MovingBorder({
  children,
  duration = 2000,
  className,
  containerClassName,
  borderClassName,
  as: Component = "button",
  ...props
}: {
  children: React.ReactNode;
  duration?: number;
  className?: string;
  containerClassName?: string;
  borderClassName?: string;
  as?: React.ElementType;
  [key: string]: unknown;
}) {
  return (
    <Component
      className={cn(
        "relative overflow-hidden rounded-full p-[1px] bg-transparent",
        containerClassName
      )}
      {...props}
    >
      {/* Spinning gradient border */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background:
            "conic-gradient(from 0deg, transparent 0deg, #00d4ff 60deg, #6366f1 120deg, transparent 180deg)",
          animation: `border-spin ${duration}ms linear infinite`,
        }}
      />
      <div
        className={cn(
          "relative z-10 rounded-full bg-[#0d0d0d] px-6 py-2.5 text-sm font-medium text-white",
          className
        )}
      >
        {children}
      </div>
    </Component>
  );
}
