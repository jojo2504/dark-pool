"use client";
import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight, Lock, Shield, Zap } from "lucide-react";
import { AuroraBackground } from "@/components/ui/aurora-background";
import { Spotlight } from "@/components/ui/spotlight";
import { FlipWords } from "@/components/ui/flip-words";
import { ShootingStars, StarsBackground } from "@/components/ui/shooting-stars";

const FLIP_WORDS = ["privacy", "fairness", "immutability", "trustless"];

export function Hero() {
  return (
    <AuroraBackground className="min-h-screen w-full pt-24 pb-12 overflow-hidden">
      <StarsBackground />
      <ShootingStars minDelay={1200} maxDelay={4000} />
      <Spotlight className="-top-40 left-0 md:left-60 md:-top-20" fill="#00d4ff" />

      <div className="relative z-10 flex flex-col items-center text-center px-4 max-w-5xl mx-auto">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-6 inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/5 text-xs font-medium text-cyan-400"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
          Powered by Canton Network · USDCx only
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.7 }}
          className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.08] mb-4"
        >
          Auctions built on
          <br />
          <FlipWords words={FLIP_WORDS} className="text-5xl sm:text-6xl lg:text-7xl font-bold" />
        </motion.h1>

        {/* Sub-headline */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.7 }}
          className="mt-4 max-w-2xl text-lg text-zinc-400 leading-relaxed"
        >
          Sealed-bid auctions where every parameter is{" "}
          <span className="text-zinc-100 font-medium">cryptographically immutable</span> the moment
          you create them. Bids are locked in{" "}
          <span className="text-cyan-400 font-medium">USDCx</span> until the auction resolves —
          no surprises, no manipulation.
        </motion.p>

        {/* CTA buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-10 flex flex-col sm:flex-row items-center gap-4"
        >
          <Link
            href="/auctions/create"
            className="group flex items-center gap-2 px-7 py-3.5 rounded-xl bg-cyan-500 text-black font-semibold text-sm hover:bg-cyan-400 transition-all duration-200 shadow-lg shadow-cyan-500/25"
          >
            Create an Auction
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
          <Link
            href="/auctions"
            className="flex items-center gap-2 px-7 py-3.5 rounded-xl border border-white/10 text-zinc-300 text-sm font-medium hover:bg-white/5 hover:border-white/20 transition-all duration-200"
          >
            Browse Auctions
          </Link>
        </motion.div>

        {/* Trust indicators */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="mt-16 flex flex-wrap items-center justify-center gap-8 text-xs text-zinc-500"
        >
          {[
            { icon: Lock, label: "Sealed bids — no front-running" },
            { icon: Shield, label: "Immutable auction rules" },
            { icon: Zap, label: "Instant USDCx settlement" },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-1.5">
              <Icon className="w-3.5 h-3.5 text-cyan-500/70" />
              {label}
            </div>
          ))}
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="mt-20 flex flex-col items-center gap-2"
        >
          <div className="w-px h-12 bg-gradient-to-b from-transparent via-zinc-600 to-transparent" />
          <span className="text-xs text-zinc-600">scroll to explore</span>
        </motion.div>
      </div>
    </AuroraBackground>
  );
}
