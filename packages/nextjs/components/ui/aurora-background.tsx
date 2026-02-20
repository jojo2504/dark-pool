"use client";

import React, { ReactNode } from "react";
import { cn } from "~~/lib/utils";

interface AuroraBackgroundProps extends React.HTMLProps<HTMLDivElement> {
  children: ReactNode;
  showRadialGradient?: boolean;
}

export const AuroraBackground = ({
  className,
  children,
  showRadialGradient = true,
  ...props
}: AuroraBackgroundProps) => {
  return (
    <div
      className={cn("relative flex flex-col items-center justify-center bg-[#050505] text-white", className)}
      {...props}
    >
      <div className="absolute inset-0 overflow-hidden">
        <div
          className={cn(
            `
            [--aurora:repeating-linear-gradient(100deg,#00d4ff_10%,#6366f1_20%,#00d4ff44_30%,#818cf8_40%,#00d4ff_50%)]
            [background-image:var(--aurora)]
            [background-size:300%_300%]
            [background-position:50%_50%]
            animate-aurora
            filter blur-[120px] opacity-25
            pointer-events-none
            absolute -inset-[10px] will-change-transform`,
            showRadialGradient && "[mask-image:radial-gradient(ellipse_at_50%_0%,black_30%,transparent_70%)]",
          )}
        />
      </div>
      {children}
    </div>
  );
};
