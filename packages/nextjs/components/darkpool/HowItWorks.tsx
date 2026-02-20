"use client";

import { motion } from "framer-motion";
import { EncryptedText } from "~~/components/darkpool/EncryptedText";

const STEPS = [
  {
    id: "01",
    title: "Create Vault",
    description: "Deploy an immutable ShadowBidVault contract. Set duration, deposit, allowed suppliers.",
  },
  {
    id: "02",
    title: "Commit Bid",
    description: "Suppliers hash their price + salt and submit on-chain with ETH deposit. Bid remains sealed.",
  },
  {
    id: "03",
    title: "Reveal Phase",
    description: "After close, suppliers reveal price and salt. Non-revealers forfeit their deposit.",
  },
  {
    id: "04",
    title: "Settlement",
    description: "Smart contract selects winner deterministically. Deposits returned. Trustless execution.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="border-t border-white bg-black px-6 py-20">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-16">
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 0.4 }}
            viewport={{ once: true }}
            className="font-mono text-[10px] tracking-[0.2em] uppercase mb-4"
          >
            <EncryptedText text="[ PROCESS ]" revealDelayMs={75} flipDelayMs={60} />
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="font-mono text-3xl sm:text-4xl font-bold tracking-[-0.03em] uppercase text-white"
          >
            <EncryptedText text="HOW IT WORKS" revealDelayMs={90} flipDelayMs={60} />
          </motion.h2>
        </div>

        {/* Steps */}
        <div className="border-t border-white">
          {STEPS.map((step, i) => (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, x: -12 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="border-b border-white py-8 flex items-start gap-8 group hover:opacity-60 hover:px-6 transition-all duration-100"
            >
              <span className="font-mono text-3xl sm:text-5xl font-bold tracking-[-0.04em] opacity-100 group-hover:opacity-40 min-w-[60px] sm:min-w-[80px]">
                {step.id}
              </span>
              <div className="flex-1">
                <h3 className="font-mono text-base sm:text-lg font-bold uppercase tracking-[0.05em] mb-2">
                  <EncryptedText text={step.title} revealDelayMs={90} flipDelayMs={60} />
                </h3>
                <p className="font-mono text-xs sm:text-sm leading-relaxed opacity-100 group-hover:opacity-80">
                  {step.description}
                </p>
              </div>
              <span className="font-mono text-xs uppercase tracking-[0.15em] opacity-0 group-hover:opacity-60 transition-opacity hidden sm:block">
                →
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
