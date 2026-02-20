"use client";

import React, { useEffect, useRef, useState } from "react";
import { cn } from "~~/lib/utils";

interface ShootingStar {
  id: number;
  x: number;
  y: number;
  angle: number;
  scale: number;
  speed: number;
  distance: number;
}

export function ShootingStars({
  minSpeed = 8,
  maxSpeed = 18,
  minDelay = 900,
  maxDelay = 3600,
  starColor = "#00d4ff",
  trailColor = "#6366f1",
  starWidth = 8,
  starHeight = 1,
  className,
}: {
  minSpeed?: number;
  maxSpeed?: number;
  minDelay?: number;
  maxDelay?: number;
  starColor?: string;
  trailColor?: string;
  starWidth?: number;
  starHeight?: number;
  className?: string;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const starsRef = useRef<ShootingStar[]>([]);
  const frameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const nextStarTimeRef = useRef<number>(0);

  const getStarProps = (width: number, height: number) => {
    const x = Math.random() * width;
    const y = Math.random() * height * 0.5;
    return {
      id: Date.now() + Math.random(),
      x,
      y,
      angle: 215,
      scale: 1,
      speed: Math.random() * (maxSpeed - minSpeed) + minSpeed,
      distance: 0,
    };
  };

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const animate = (time: number) => {
      const { width, height } = svg.getBoundingClientRect();
      const delta = time - lastTimeRef.current;
      lastTimeRef.current = time;

      if (time >= nextStarTimeRef.current) {
        starsRef.current = [...starsRef.current, getStarProps(width, height)];
        nextStarTimeRef.current = time + Math.random() * (maxDelay - minDelay) + minDelay;
      }

      starsRef.current = starsRef.current.filter(star => {
        const angleRad = (star.angle * Math.PI) / 180;
        star.x += Math.cos(angleRad) * star.speed * (delta / 16);
        star.y += Math.sin(angleRad) * star.speed * (delta / 16);
        star.distance += star.speed * (delta / 16);
        return star.x < width + 100 && star.y < height + 100;
      });

      const existingStars = svg.querySelectorAll(".shooting-star-el");
      existingStars.forEach(el => el.remove());
      starsRef.current.forEach(star => {
        const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
        g.setAttribute("class", "shooting-star-el");
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", String(star.x));
        line.setAttribute("y1", String(star.y));
        line.setAttribute("x2", String(star.x + starWidth));
        line.setAttribute("y2", String(star.y));
        line.setAttribute("stroke", `url(#gradient-${Math.floor(star.id)})`);
        line.setAttribute("stroke-width", String(starHeight));
        line.setAttribute("stroke-linecap", "round");
        line.setAttribute("transform", `rotate(${star.angle}, ${star.x}, ${star.y})`);
        const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
        const grad = document.createElementNS("http://www.w3.org/2000/svg", "linearGradient");
        grad.setAttribute("id", `gradient-${Math.floor(star.id)}`);
        grad.setAttribute("x1", "0%");
        grad.setAttribute("x2", "100%");
        const stop1 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
        stop1.setAttribute("offset", "0%");
        stop1.setAttribute("stop-color", trailColor);
        stop1.setAttribute("stop-opacity", "0");
        const stop2 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
        stop2.setAttribute("offset", "100%");
        stop2.setAttribute("stop-color", starColor);
        stop2.setAttribute("stop-opacity", "1");
        grad.appendChild(stop1);
        grad.appendChild(stop2);
        defs.appendChild(grad);
        g.appendChild(defs);
        g.appendChild(line);
        svg.appendChild(g);
      });

      frameRef.current = requestAnimationFrame(animate);
    };

    frameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameRef.current);
  }, [maxDelay, maxSpeed, minDelay, minSpeed, starColor, starHeight, starWidth, trailColor]);

  return <svg ref={svgRef} className={cn("absolute inset-0 w-full h-full pointer-events-none", className)} />;
}

export function StarsBackground({ className }: { className?: string }) {
  const [stars, setStars] = useState<React.CSSProperties[]>([]);

  useEffect(() => {
    setStars(
      Array.from({ length: 80 }, () => ({
        width: Math.random() * 2 + 0.5 + "px",
        height: Math.random() * 2 + 0.5 + "px",
        top: Math.random() * 100 + "%",
        left: Math.random() * 100 + "%",
        opacity: Math.random() * 0.5 + 0.1,
        animation: `pulse2 ${Math.random() * 4 + 2}s ease-in-out infinite`,
        animationDelay: Math.random() * 4 + "s",
      })),
    );
  }, []);

  return (
    <div className={cn("absolute inset-0 overflow-hidden pointer-events-none", className)}>
      {stars.map((style, i) => (
        <div key={i} className="absolute rounded-full bg-white" style={style} />
      ))}
    </div>
  );
}
