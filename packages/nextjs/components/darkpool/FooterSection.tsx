"use client";
import Link from "next/link";
import { Github, Twitter, Lock, Zap } from "lucide-react";

const navLinks = [
    { label: "Auctions", href: "/auctions" },
    { label: "Create", href: "/auctions/create" },
    { label: "Docs", href: "#" },
];

export function FooterSection() {
    return (
        <footer className="border-t border-white/[0.06] bg-[#050505] px-4 py-14">
            <div className="max-w-6xl mx-auto">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-10 mb-10">
                    {/* Brand */}
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-7 h-7 rounded-lg bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center">
                                <Lock className="w-3.5 h-3.5 text-cyan-400" />
                            </div>
                            <span className="text-white font-semibold text-sm tracking-wide">Dark Pool</span>
                        </div>
                        <p className="text-zinc-500 text-xs leading-relaxed max-w-[220px]">
                            Sealed-bid auctions with cryptographic fairness. Immutable rules, trustless settlement.
                        </p>
                    </div>

                    {/* Links */}
                    <div>
                        <p className="text-zinc-400 text-xs font-semibold uppercase tracking-widest mb-4">Navigate</p>
                        <ul className="space-y-2">
                            {navLinks.map(l => (
                                <li key={l.label}>
                                    <Link href={l.href} className="text-zinc-500 text-sm hover:text-zinc-200 transition-colors">
                                        {l.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Built on */}
                    <div>
                        <p className="text-zinc-400 text-xs font-semibold uppercase tracking-widest mb-4">Powered By</p>
                        <div className="space-y-2">
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06] text-xs text-zinc-400">
                                <Zap className="w-3 h-3 text-cyan-400" />
                                Canton Network
                            </div>
                            <br />
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06] text-xs text-zinc-400">
                                <span className="w-3 h-3 rounded-full bg-gradient-to-br from-indigo-400 to-pink-400" />
                                USDCx · Superfluid
                            </div>
                        </div>
                    </div>
                </div>

                <div className="pt-8 border-t border-white/[0.04] flex flex-col sm:flex-row items-center justify-between gap-4">
                    <p className="text-zinc-600 text-xs">© {new Date().getFullYear()} Dark Pool. All rights reserved.</p>
                    <div className="flex items-center gap-4">
                        <a
                            href="https://github.com"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-zinc-600 hover:text-zinc-300 transition-colors"
                            aria-label="GitHub"
                        >
                            <Github className="w-4 h-4" />
                        </a>
                        <a
                            href="https://twitter.com"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-zinc-600 hover:text-zinc-300 transition-colors"
                            aria-label="Twitter"
                        >
                            <Twitter className="w-4 h-4" />
                        </a>
                    </div>
                </div>
            </div>
        </footer>
    );
}
