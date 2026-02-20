"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { EncryptedText } from "~~/components/darkpool/EncryptedText";

export function CTASection() {
  return (
    <section className="border-t border-white bg-black px-6 py-24">
      <div className="max-w-5xl mx-auto text-center">
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 0.4 }}
          viewport={{ once: true }}
          className="font-mono text-[10px] tracking-[0.2em] uppercase mb-6"
        >
          <EncryptedText text="[ READY ]" revealDelayMs={90} flipDelayMs={60} />
        </motion.p>

        <motion.h2
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="font-mono text-3xl sm:text-5xl font-bold tracking-[-0.04em] uppercase text-white mb-4"
        >
          <EncryptedText text="START NOW." revealDelayMs={110} flipDelayMs={60} />
        </motion.h2>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="font-mono text-sm text-white opacity-50 mb-12 max-w-md mx-auto"
        >
          <EncryptedText
            text="Deploy a vault. Submit a sealed bid. Trustless from start to finish."
            revealDelayMs={60}
            flipDelayMs={55}
          />
        </motion.p>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="flex flex-col items-center gap-4"
        >
          <div className="inline-flex">
            <Link
              href="/auctions/create"
              className="border border-white bg-white text-black px-10 py-4 font-mono text-xs tracking-[0.15em] uppercase font-bold hover:opacity-80 transition-all duration-100"
            >
              CREATE VAULT
            </Link>
            <Link
              href="/auctions"
              className="border border-white border-l-0 px-10 py-4 font-mono text-xs tracking-[0.15em] uppercase text-white hover:opacity-60 transition-all duration-100"
            >
              BROWSE →
            </Link>
          </div>
          <Link
            href="/kyb"
            className="font-mono text-[10px] uppercase opacity-30 hover:opacity-80 transition-all tracking-[0.15em] underline underline-offset-4"
          >
            INSTITUTIONAL? COMPLETE KYB VERIFICATION FIRST
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
