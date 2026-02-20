"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { EncryptedText } from "~~/components/darkpool/EncryptedText";

export function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center bg-black pt-14">
      {/* Grid lines background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
          backgroundSize: "80px 80px",
        }}
      />

      <div className="relative z-10 w-full max-w-5xl mx-auto px-6">
        {/* Status line */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="font-mono text-[11px] tracking-[0.2em] uppercase mb-12"
          style={{ color: "#ffffff", opacity: 0.4 }}
        >
          <EncryptedText text="[ SEALED-BID PROTOCOL ] — LIVE" revealDelayMs={75} flipDelayMs={60} />
        </motion.div>

        {/* Main headline */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="font-mono text-[clamp(2.5rem,8vw,6rem)] font-bold leading-[0.9] tracking-[-0.04em] uppercase text-white mb-8"
        >
          <EncryptedText text="DARK" revealDelayMs={150} flipDelayMs={60} />
          <br />
          <EncryptedText text="POOL" revealDelayMs={150} flipDelayMs={60} />
        </motion.h1>

        {/* Divider */}
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 0.5, duration: 0.4 }}
          className="w-full h-px bg-white mb-8 origin-left"
        />

        {/* Description */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="font-mono text-sm leading-relaxed max-w-lg text-white mb-12 space-y-1"
        >
          <p>
            <EncryptedText text="Commit-reveal sealed-bid auctions on-chain." revealDelayMs={60} flipDelayMs={55} />
          </p>
          <p>
            <EncryptedText text="Cryptographic fairness. Immutable rules." revealDelayMs={60} flipDelayMs={55} />
          </p>
          <p>
            <EncryptedText text="No front-running. No information leakage." revealDelayMs={60} flipDelayMs={55} />
          </p>
        </motion.div>

        {/* CTA buttons */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="flex flex-wrap gap-0"
        >
          <Link
            href="/auctions"
            className="border border-white px-8 py-4 font-mono text-xs tracking-[0.15em] uppercase text-white hover:opacity-60 transition-all duration-100"
          >
            BROWSE AUCTIONS →
          </Link>
          <Link
            href="/auctions/create"
            className="border border-white border-l-0 px-8 py-4 font-mono text-xs tracking-[0.15em] uppercase bg-white text-black hover:opacity-80 transition-all duration-100"
          >
            CREATE VAULT
          </Link>
        </motion.div>

        {/* Bottom status */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="absolute bottom-8 left-6 right-6 flex justify-between font-mono text-[10px] tracking-[0.15em] uppercase"
          style={{ color: "#ffffff", opacity: 0.25 }}
        >
          <span>
            <EncryptedText text="V1.0.0" revealDelayMs={110} flipDelayMs={60} />
          </span>
          <span>
            <EncryptedText text="EVM COMPATIBLE" revealDelayMs={90} flipDelayMs={60} />
          </span>
          <span>
            <EncryptedText text="COMMIT → REVEAL → SETTLE" revealDelayMs={75} flipDelayMs={60} />
          </span>
        </motion.div>
      </div>
    </section>
  );
}
