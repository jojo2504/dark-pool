"use client";
import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export function GlowCard({
  children,
  className,
  glowColor = "rgba(0,212,255,0.15)",
}: {
  children: React.ReactNode;
  className?: string;
  glowColor?: string;
}) {
  return (
    <motion.div
      whileHover={{ scale: 1.01 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "relative rounded-2xl border border-white/[0.06] bg-white/[0.03] p-6 overflow-hidden",
        className
      )}
    >
      {/* Glow top edge */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-px"
        style={{
          background: `linear-gradient(90deg, transparent, ${glowColor}, transparent)`,
        }}
      />
      {children}
    </motion.div>
  );
}

export function GlowBorder({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("relative group", className)}>
      {/* Animated glow border */}
      <div
        className="absolute -inset-[1px] rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{
          background:
            "linear-gradient(135deg, rgba(0,212,255,0.4), rgba(99,102,241,0.4), rgba(0,212,255,0.4))",
          backgroundSize: "200% 200%",
          animation: "gradient-shift 4s ease infinite",
        }}
      />
      <div className="relative rounded-2xl bg-[#0d0d0d] border border-white/[0.06]">
        {children}
      </div>
    </div>
  );
}
