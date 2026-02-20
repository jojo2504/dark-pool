"use client";
import { motion } from "framer-motion";
import { Coins, EyeOff, Fingerprint, Lock, ShieldCheck, Timer, TrendingUp, Zap } from "lucide-react";

const FEATURES = [
    {
        icon: EyeOff,
        title: "Sealed Bids",
        description: "No participant can see others' bids until the auction closes. True dark-pool mechanics on-chain.",
        color: "cyan",
    },
    {
        icon: Lock,
        title: "Immutable Rules",
        description:
            "Every auction parameter — reserve price, duration, increments — is locked the moment you create the auction. Zero possibility of post-creation tampering.",
        color: "indigo",
        featured: true,
    },
    {
        icon: Coins,
        title: "USDCx Only",
        description:
            "All bids are denominated in USDCx (Superfluid wrapped USDC). Stable, predictable, no gas token volatility.",
        color: "emerald",
    },
    {
        icon: Timer,
        title: "Anti-Sniping",
        description:
            "Configurable sniping protection: if a bid lands in the final window, the auction extends automatically.",
        color: "cyan",
    },
    {
        icon: TrendingUp,
        title: "Increase Your Bid",
        description:
            "Already locked funds? Add more USDCx to your bid at any time before close if you feel you've undervalued.",
        color: "indigo",
    },
    {
        icon: ShieldCheck,
        title: "Bid Deposits",
        description:
            "A configurable % of each bid is locked as collateral, preventing low-ball spam and ensuring bidder seriousness.",
        color: "emerald",
    },
    {
        icon: Fingerprint,
        title: "Privacy Controls",
        description: "Choose between public or invite-only (dark pool) visibility. Control who participates.",
        color: "cyan",
    },
    {
        icon: Zap,
        title: "Canton Network",
        description:
            "Built on Canton's privacy-preserving smart contracts. Each participant only sees what they need to.",
        color: "indigo",
    },
];

const COLOR_MAP = {
    cyan: {
        icon: "text-cyan-400",
        bg: "bg-cyan-500/10",
        border: "border-cyan-500/20",
        glow: "group-hover:shadow-cyan-500/10",
    },
    indigo: {
        icon: "text-indigo-400",
        bg: "bg-indigo-500/10",
        border: "border-indigo-500/20",
        glow: "group-hover:shadow-indigo-500/10",
    },
    emerald: {
        icon: "text-emerald-400",
        bg: "bg-emerald-500/10",
        border: "border-emerald-500/20",
        glow: "group-hover:shadow-emerald-500/10",
    },
};

const fadeUp = {
    hidden: { opacity: 0, y: 24 },
    visible: (i: number) => ({
        opacity: 1,
        y: 0,
        transition: { delay: i * 0.08, duration: 0.5 },
    }),
};

export function FeaturesSection() {
    return (
        <section className="relative py-32 px-4 overflow-hidden">
            {/* Dot grid background */}
            <div className="absolute inset-0 dot-grid opacity-40" />

            <div className="relative z-10 max-w-6xl mx-auto">
                {/* Header */}
                <div className="text-center mb-16">
                    <motion.p
                        initial={{ opacity: 0 }}
                        whileInView={{ opacity: 1 }}
                        viewport={{ once: true }}
                        className="text-sm font-medium text-cyan-400 uppercase tracking-widest mb-3"
                    >
                        Features
                    </motion.p>
                    <motion.h2
                        initial={{ opacity: 0, y: 16 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="text-3xl sm:text-4xl font-bold text-white"
                    >
                        Everything an auction needs.
                        <br />
                        <span className="gradient-text">Nothing it doesn&apos;t.</span>
                    </motion.h2>
                </div>

                {/* Bento-style grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {FEATURES.map((feature, i) => {
                        const colors = COLOR_MAP[feature.color as keyof typeof COLOR_MAP];
                        return (
                            <motion.div
                                key={feature.title}
                                custom={i}
                                initial="hidden"
                                whileInView="visible"
                                viewport={{ once: true }}
                                variants={fadeUp}
                                className={`group relative rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 hover:bg-white/[0.04] transition-all duration-300 hover:shadow-xl ${colors.glow} ${feature.featured ? "sm:col-span-2 lg:col-span-2" : ""}`}
                            >
                                {/* Top glow line */}
                                <div
                                    className="absolute top-0 left-6 right-6 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                                    style={{
                                        background: `linear-gradient(90deg, transparent, ${feature.color === "cyan"
                                                ? "rgba(0,212,255,0.5)"
                                                : feature.color === "indigo"
                                                    ? "rgba(99,102,241,0.5)"
                                                    : "rgba(52,211,153,0.5)"
                                            }, transparent)`,
                                    }}
                                />

                                <div
                                    className={`inline-flex items-center justify-center w-10 h-10 rounded-xl ${colors.bg} border ${colors.border} mb-4`}
                                >
                                    <feature.icon className={`w-5 h-5 ${colors.icon}`} />
                                </div>
                                <h3 className="text-base font-semibold text-white mb-2">{feature.title}</h3>
                                <p className="text-sm text-zinc-400 leading-relaxed">{feature.description}</p>
                            </motion.div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
