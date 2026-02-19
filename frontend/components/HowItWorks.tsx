"use client";
import { motion } from "framer-motion";
import { Settings, Gavel, Trophy, DollarSign } from "lucide-react";

const STEPS = [
  {
    icon: Settings,
    number: "01",
    title: "Configure Your Auction",
    description:
      "Set every parameter: starting bid, reserve price, minimum increment, duration, anti-sniping rules, and visibility. These are permanently locked once you confirm.",
    detail: "All rules become immutable on-chain",
    color: "#00d4ff",
  },
  {
    icon: Gavel,
    number: "02",
    title: "Bidders Lock USDCx",
    description:
      "Participants submit sealed bids. Their USDCx is locked in escrow for the duration — no withdrawals until the auction resolves. They can top up their bid at any time.",
    detail: "Funds locked until resolution",
    color: "#6366f1",
  },
  {
    icon: Trophy,
    number: "03",
    title: "Auction Closes",
    description:
      "When the deadline hits (extended automatically if anti-sniping triggers), all sealed bids are revealed simultaneously. The highest valid bid wins.",
    detail: "Simultaneous reveal — no front-running",
    color: "#00d4ff",
  },
  {
    icon: DollarSign,
    number: "04",
    title: "Instant Settlement",
    description:
      "The winner's USDCx is transferred to the seller. All losing bids are unlocked immediately. The full audit log is on-chain forever.",
    detail: "Automatic, trustless settlement",
    color: "#6366f1",
  },
];

export function HowItWorks() {
  return (
    <section className="relative py-32 px-4 overflow-hidden">
      {/* Vertical gradient divider */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#080808] to-transparent" />

      <div className="relative z-10 max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-sm font-medium text-cyan-400 uppercase tracking-widest mb-3"
          >
            How It Works
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl sm:text-4xl font-bold text-white"
          >
            Four steps to a{" "}
            <span className="gradient-text">perfect auction</span>
          </motion.h2>
        </div>

        <div className="relative">
          {/* Vertical line connector */}
          <div className="absolute left-8 top-0 bottom-0 w-px bg-gradient-to-b from-cyan-500/0 via-cyan-500/30 to-cyan-500/0 hidden md:block" />

          <div className="space-y-8">
            {STEPS.map((step, i) => (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="relative flex gap-6 md:gap-10 items-start"
              >
                {/* Step icon (sits on the vertical line) */}
                <div
                  className="relative z-10 flex-shrink-0 w-16 h-16 rounded-2xl border flex items-center justify-center"
                  style={{
                    background: `${step.color}10`,
                    borderColor: `${step.color}30`,
                  }}
                >
                  <step.icon className="w-7 h-7" style={{ color: step.color }} />
                  {/* Step number badge */}
                  <span
                    className="absolute -top-2 -right-2 text-xs font-bold font-mono px-1.5 py-0.5 rounded-md"
                    style={{
                      background: step.color,
                      color: "#050505",
                    }}
                  >
                    {step.number}
                  </span>
                </div>

                {/* Content */}
                <div className="pt-2 pb-6 flex-1 border-b border-white/[0.04] last:border-0">
                  <h3 className="text-lg font-semibold text-white mb-2">
                    {step.title}
                  </h3>
                  <p className="text-sm text-zinc-400 leading-relaxed mb-3 max-w-xl">
                    {step.description}
                  </p>
                  <span
                    className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full"
                    style={{
                      background: `${step.color}12`,
                      color: step.color,
                      border: `1px solid ${step.color}25`,
                    }}
                  >
                    {step.detail}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
