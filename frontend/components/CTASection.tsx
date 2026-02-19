"use client";
import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AuroraBackground } from "@/components/ui/aurora-background";

export function CTASection() {
  return (
    <section className="py-32 px-4">
      <div className="max-w-3xl mx-auto">
        <AuroraBackground
          className="rounded-3xl border border-white/[0.06] min-h-0 py-20 px-8 text-center"
          showRadialGradient={false}
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="relative z-10"
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Ready to run a fair auction?
            </h2>
            <p className="text-zinc-400 mb-8 max-w-md mx-auto">
              Set your rules, lock them in forever, and let the market decide.
              No manipulation. No surprises.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/auctions/create"
                className="group inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-cyan-500 text-black font-semibold text-sm hover:bg-cyan-400 transition-all shadow-lg shadow-cyan-500/30"
              >
                Create Your Auction
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                href="/auctions"
                className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl border border-white/10 text-zinc-300 text-sm font-medium hover:bg-white/5 transition-all"
              >
                Browse Live Auctions
              </Link>
            </div>
          </motion.div>
        </AuroraBackground>
      </div>
    </section>
  );
}
