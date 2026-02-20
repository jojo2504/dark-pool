"use client";
import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

function Counter({ target, suffix = "" }: { target: number; suffix?: string }) {
    const [count, setCount] = useState(0);
    const ref = useRef<HTMLSpanElement>(null);
    const started = useRef(false);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting && !started.current) {
                    started.current = true;
                    const duration = 1800;
                    const step = target / (duration / 16);
                    let current = 0;
                    const timer = setInterval(() => {
                        current = Math.min(current + step, target);
                        setCount(Math.floor(current));
                        if (current >= target) clearInterval(timer);
                    }, 16);
                }
            },
            { threshold: 0.5 },
        );
        if (ref.current) observer.observe(ref.current);
        return () => observer.disconnect();
    }, [target]);

    return (
        <span ref={ref}>
            {count.toLocaleString()}
            {suffix}
        </span>
    );
}

const STATS = [
    { value: 2400000, suffix: "+", label: "Total Volume (USDCx)", prefix: "$" },
    { value: 847, suffix: "", label: "Auctions Completed", prefix: "" },
    { value: 3200, suffix: "+", label: "Unique Bidders", prefix: "" },
    { value: 100, suffix: "%", label: "Settlement Rate", prefix: "" },
];

export function StatsSection() {
    return (
        <section className="py-20 px-4 border-y border-white/[0.04]">
            <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
                {STATS.map((stat, i) => (
                    <motion.div
                        key={stat.label}
                        initial={{ opacity: 0, y: 16 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: i * 0.1 }}
                        className="text-center"
                    >
                        <p className="text-3xl sm:text-4xl font-bold text-white">
                            {stat.prefix}
                            <Counter target={stat.value} suffix={stat.suffix} />
                        </p>
                        <p className="mt-1.5 text-sm text-zinc-500">{stat.label}</p>
                    </motion.div>
                ))}
            </div>
        </section>
    );
}
