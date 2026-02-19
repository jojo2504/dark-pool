"use client";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Fingerprint,
  X,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Loader2,
  LogOut,
  Copy,
  ExternalLink,
  KeyRound,
  Eye,
  EyeOff,
} from "lucide-react";
import { useCanton } from "@/lib/canton-context";
import {
  getCantonWallets,
  formatPartyId,
  CantonWalletId,
  CantonWallet,
} from "@/lib/canton";

// ─── Wallet icon (SVG inline fallback) ───────────────────────────────────────

const WALLET_ICONS: Record<CantonWalletId, React.ReactNode> = {
  nightly: (
    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-xs font-black">
      N
    </div>
  ),
  "digital-asset": (
    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white text-xs font-black">
      DA
    </div>
  ),
  splice: (
    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-xs font-black">
      SP
    </div>
  ),
  "jwt-manual": (
    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
      <KeyRound className="w-3.5 h-3.5 text-white" />
    </div>
  ),
};

// ─── Wallet selection modal ───────────────────────────────────────────────────

function WalletModal({ onClose }: { onClose: () => void }) {
  const { connect, status, error } = useCanton();
  const [wallets] = useState<CantonWallet[]>(getCantonWallets);
  const [selected, setSelected] = useState<CantonWalletId | null>(null);
  const [jwt, setJwt] = useState("");
  const [showJwt, setShowJwt] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const isConnecting = status === "connecting";

  async function handleConnect(walletId: CantonWalletId) {
    setSelected(walletId);
    if (walletId === "jwt-manual") return; // handled by form
    await connect(walletId);
  }

  async function handleJwtSubmit() {
    if (!jwt.trim()) return;
    await connect("jwt-manual", jwt.trim());
  }

  useEffect(() => {
    if (status === "connected") onClose();
  }, [status, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 10 }}
        transition={{ duration: 0.15 }}
        className="w-full max-w-sm bg-[#0d0d0d] border border-white/[0.08] rounded-2xl overflow-hidden shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
              <Fingerprint className="w-3.5 h-3.5 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-white text-sm font-semibold">
                Connect Identity
              </h2>
              <p className="text-zinc-600 text-[11px]">Canton Network</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-zinc-200 hover:bg-white/5 transition-all"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="p-4 space-y-2">
          {/* Error banner */}
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/[0.08] border border-red-500/20 text-xs text-red-300">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          {/* Wallet list */}
          {wallets.map((w) => {
            const isJwt = w.id === "jwt-manual";
            const busy = isConnecting && selected === w.id;

            return (
              <div key={w.id}>
                <button
                  onClick={() => handleConnect(w.id)}
                  disabled={isConnecting}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left group ${
                    selected === w.id && !isJwt
                      ? "border-cyan-500/40 bg-cyan-500/[0.06]"
                      : "border-white/[0.06] hover:border-white/[0.12] hover:bg-white/[0.03]"
                  } disabled:opacity-50`}
                >
                  {WALLET_ICONS[w.id]}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-200 text-sm font-medium">
                        {w.name}
                      </span>
                      {w.institutional && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-medium">
                          PRO
                        </span>
                      )}
                      {!w.available && !isJwt && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-white/5 text-zinc-500 border border-white/[0.06]">
                          Not installed
                        </span>
                      )}
                    </div>
                    <p className="text-zinc-600 text-[11px] truncate">
                      {w.description}
                    </p>
                  </div>
                  {busy ? (
                    <Loader2 className="w-4 h-4 text-cyan-400 animate-spin flex-shrink-0" />
                  ) : !w.available && !isJwt ? (
                    <a
                      href={w.installUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-zinc-500 hover:text-zinc-300 flex-shrink-0"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-zinc-600 group-hover:text-zinc-300 flex-shrink-0 transition-colors" />
                  )}
                </button>

                {/* JWT input — shown when jwt-manual selected */}
                <AnimatePresence>
                  {isJwt && selected === "jwt-manual" && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="pt-2 space-y-2">
                        <div className="relative">
                          <textarea
                            ref={inputRef}
                            value={jwt}
                            onChange={(e) => setJwt(e.target.value)}
                            placeholder="eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
                            rows={3}
                            className={`w-full px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-zinc-300 text-xs font-mono placeholder:text-zinc-700 focus:outline-none focus:border-cyan-500/50 transition-all resize-none ${
                              showJwt ? "" : "blur-[2px] select-none"
                            }`}
                          />
                          <button
                            type="button"
                            onClick={() => setShowJwt((p) => !p)}
                            className="absolute top-2 right-2 text-zinc-600 hover:text-zinc-300"
                          >
                            {showJwt ? (
                              <EyeOff className="w-3 h-3" />
                            ) : (
                              <Eye className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                        <button
                          onClick={handleJwtSubmit}
                          disabled={!jwt.trim() || isConnecting}
                          className="w-full py-2 rounded-xl bg-cyan-500 text-black text-xs font-semibold hover:bg-cyan-400 disabled:opacity-40 transition-all flex items-center justify-center gap-1.5"
                        >
                          {isConnecting ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <KeyRound className="w-3.5 h-3.5" />
                          )}
                          Authenticate
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-white/[0.04] bg-white/[0.01]">
          <p className="text-zinc-600 text-[11px]">
            Your identity stays on Canton Network. No ETH, no EVM.
          </p>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Connected dropdown ───────────────────────────────────────────────────────

function ConnectedDropdown({ onClose }: { onClose: () => void }) {
  const { identity, disconnect } = useCanton();
  const [copied, setCopied] = useState(false);

  if (!identity) return null;

  function copy() {
    navigator.clipboard.writeText(identity!.party);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.97 }}
      transition={{ duration: 0.12 }}
      className="absolute right-0 top-full mt-2 w-64 bg-[#0d0d0d] border border-white/[0.08] rounded-2xl shadow-2xl z-50 overflow-hidden"
    >
      <div className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 text-sm font-bold">
            {identity.displayName.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">
              {identity.displayName}
            </p>
            <p className="text-zinc-500 text-[11px]">Canton Network</p>
          </div>
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
        </div>

        <div
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06] cursor-pointer hover:bg-white/[0.05] transition-all group"
          onClick={copy}
        >
          <p className="text-zinc-400 font-mono text-[10px] flex-1 truncate">
            {formatPartyId(identity.party)}
          </p>
          {copied ? (
            <CheckCircle2 className="w-3 h-3 text-emerald-400 flex-shrink-0" />
          ) : (
            <Copy className="w-3 h-3 text-zinc-600 group-hover:text-zinc-300 flex-shrink-0 transition-colors" />
          )}
        </div>
      </div>

      <div className="px-4 pb-3">
        <button
          onClick={() => {
            disconnect();
            onClose();
          }}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-red-400 hover:bg-red-500/10 transition-all"
        >
          <LogOut className="w-3.5 h-3.5" />
          Disconnect
        </button>
      </div>
    </motion.div>
  );
}

// ─── Main wallet button ───────────────────────────────────────────────────────

export function WalletButton() {
  const { status, identity } = useCanton();
  const [showModal, setShowModal] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [mounted, setMounted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (!mounted) {
    return <div className="w-32 h-8 rounded-lg bg-white/5 animate-pulse" />;
  }

  const isConnected = status === "connected" && !!identity;

  return (
    <>
      {/* Wallet selection modal */}
      <AnimatePresence>
        {showModal && (
          <WalletModal onClose={() => setShowModal(false)} />
        )}
      </AnimatePresence>

      {/* Button / connected state */}
      <div ref={ref} className="relative">
        {isConnected ? (
          <button
            onClick={() => setShowDropdown((p) => !p)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-cyan-500/20 bg-cyan-500/[0.06] text-cyan-300 text-sm hover:bg-cyan-500/10 transition-all"
          >
            <div className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="font-medium">{identity.displayName}</span>
            <span className="text-zinc-500 text-xs hidden sm:block">
              Canton
            </span>
          </button>
        ) : (
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 hover:border-cyan-500/50 transition-all"
          >
            <Fingerprint className="w-3.5 h-3.5" />
            Connect Identity
          </button>
        )}

        {/* Connected dropdown */}
        <AnimatePresence>
          {showDropdown && (
            <ConnectedDropdown onClose={() => setShowDropdown(false)} />
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
