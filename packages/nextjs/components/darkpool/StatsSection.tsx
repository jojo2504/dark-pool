"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { EncryptedText } from "~~/components/darkpool/EncryptedText";

const STATS = [
  { label: "PROTOCOL", value: "SEALED-BID" },
  { label: "MECHANISM", value: "COMMIT-REVEAL" },
  { label: "SETTLEMENT", value: "ON-CHAIN" },
  { label: "TRUST", value: "ZERO" },
];

export function StatsSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });

  return (
    <section ref={ref} className="border-t border-white bg-black px-6 py-0">
      <div className="max-w-5xl mx-auto grid grid-cols-2 sm:grid-cols-4">
        {STATS.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0 }}
            animate={isInView ? { opacity: 1 } : {}}
            transition={{ delay: i * 0.1 }}
            className={`py-10 ${i < STATS.length - 1 ? "border-r border-white" : ""} px-6`}
          >
            <p className="font-mono text-[10px] tracking-[0.2em] uppercase mb-3" style={{ opacity: 0.4 }}>
              <EncryptedText text={stat.label} revealDelayMs={90} flipDelayMs={60} />
            </p>
            <p className="font-mono text-lg font-bold tracking-[-0.02em] uppercase text-white">
              <EncryptedText text={stat.value} revealDelayMs={110} flipDelayMs={60} />
            </p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
