"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import {
  Lock,
  AlertTriangle,
  ChevronRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Info,
} from "lucide-react";
import toast from "react-hot-toast";
import { CreateAuctionFormData } from "@/lib/types";

/* ─── Zod schema ─────────────────────────────────────────── */
const schema = z.object({
  title: z.string().min(5, "At least 5 characters").max(80),
  description: z.string().min(20, "At least 20 characters").max(500),
  category: z.string().min(1, "Required"),
  startingBid: z.coerce.number().positive("Must be > 0"),
  reservePrice: z.coerce.number().optional(),
  showReservePrice: z.boolean().optional(),
  minBidIncrement: z.coerce.number().positive("Must be > 0"),
  buyNowPrice: z.coerce.number().optional(),
  durationHours: z.coerce
    .number()
    .min(1, "Min 1h")
    .max(720, "Max 720h (30 days)"),
  antiSnipingWindowMinutes: z.coerce.number().min(0).max(60),
  antiSnipingExtensionMinutes: z.coerce.number().min(1).max(30),
  visibility: z.enum(["public", "private"]),
  auctionType: z.enum(["sealed", "dutch", "vickrey"]),
  maxBidders: z.coerce.number().min(1).max(500),
  bidDepositPercent: z.coerce.number().min(0).max(100),
});
type FormData = z.infer<typeof schema>;

const CATEGORIES = [
  "Software",
  "Cloud",
  "Hardware",
  "Security",
  "Services",
  "Consulting",
  "Other",
];

/* ─── Field helpers ──────────────────────────────────────── */
function Label({
  children,
  hint,
}: {
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="flex items-center gap-1.5 mb-1.5">
      <label className="text-zinc-300 text-sm font-medium">{children}</label>
      {hint && (
        <span className="group relative">
          <Info className="w-3 h-3 text-zinc-600 cursor-help" />
          <span className="absolute left-4 -top-1 hidden group-hover:block z-50 w-48 bg-[#1a1a1a] border border-white/10 rounded-lg p-2 text-[11px] text-zinc-400 shadow-xl">
            {hint}
          </span>
        </span>
      )}
    </div>
  );
}

function Input({
  error,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { error?: string }) {
  return (
    <div>
      <input
        {...props}
        className={`w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:bg-white/[0.06] transition-all ${
          error
            ? "border-red-500/50 focus:border-red-500"
            : "border-white/[0.08] focus:border-cyan-500/50"
        }`}
      />
      {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
    </div>
  );
}

function Textarea({
  error,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: string }) {
  return (
    <div>
      <textarea
        {...props}
        className={`w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:bg-white/[0.06] transition-all resize-none ${
          error
            ? "border-red-500/50 focus:border-red-500"
            : "border-white/[0.08] focus:border-cyan-500/50"
        }`}
      />
      {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
    </div>
  );
}

/* ─── Section wrapper ────────────────────────────────────── */
function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 mb-4">
      <h3 className="text-white font-semibold text-sm uppercase tracking-wider mb-5 pb-3 border-b border-white/[0.06]">
        {title}
      </h3>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

/* ─── Confirmation modal ─────────────────────────────────── */
function ConfirmModal({
  data,
  onConfirm,
  onCancel,
}: {
  data: FormData;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full rounded-2xl border border-red-500/30 bg-[#0d0d0d] p-6"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center">
            <Lock className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h3 className="text-white font-semibold">Confirm & Lock Rules</h3>
            <p className="text-zinc-500 text-xs">This action is irreversible</p>
          </div>
        </div>

        <div className="bg-red-500/[0.08] border border-red-500/20 rounded-xl p-4 mb-5">
          <div className="flex gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-red-300 leading-relaxed">
              <strong>These auction rules CANNOT be changed</strong> after
              creation. Starting bid, reserve price, duration, visibility, and
              all other parameters will be permanently locked on-chain.
            </div>
          </div>
        </div>

        <div className="bg-white/[0.03] rounded-xl p-4 mb-5 text-xs text-zinc-400 space-y-1.5">
          <div className="flex justify-between">
            <span>Title</span>
            <span className="text-zinc-200 font-medium truncate ml-4 max-w-[200px]">
              {data.title}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Starting Bid</span>
            <span className="text-zinc-200 font-mono">
              {data.startingBid.toLocaleString()} USDCx
            </span>
          </div>
          <div className="flex justify-between">
            <span>Duration</span>
            <span className="text-zinc-200">{data.durationHours}h</span>
          </div>
          <div className="flex justify-between">
            <span>Type</span>
            <span className="text-zinc-200 capitalize">{data.auctionType}</span>
          </div>
          <div className="flex justify-between">
            <span>Visibility</span>
            <span className="text-zinc-200 capitalize">{data.visibility}</span>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-white/10 text-zinc-400 text-sm hover:bg-white/5 transition-all"
          >
            Go back
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-400 transition-all"
          >
            Lock Forever
          </button>
        </div>
      </motion.div>
    </div>
  );
}

/* ─── Main page ──────────────────────────────────────────── */
export default function CreateAuctionPage() {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [pendingData, setPendingData] = useState<FormData | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      visibility: "public",
      auctionType: "sealed",
      maxBidders: 50,
      bidDepositPercent: 10,
      durationHours: 48,
      antiSnipingWindowMinutes: 10,
      antiSnipingExtensionMinutes: 5,
      minBidIncrement: 100,
      showReservePrice: false,
    },
  });

  const onSubmit = (data: FormData) => {
    setPendingData(data);
    setShowModal(true);
  };

  const handleConfirm = () => {
    setShowModal(false);
    setSubmitted(true);
    toast.success("Auction created & rules locked on-chain!", {
      duration: 5000,
      icon: "🔒",
    });
    setTimeout(() => router.push("/auctions"), 1800);
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-emerald-400" />
          </div>
          <h2 className="text-white text-xl font-semibold mb-2">
            Auction Created!
          </h2>
          <p className="text-zinc-500 text-sm">
            Rules locked forever. Redirecting…
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <>
      <AnimatePresence>
        {showModal && pendingData && (
          <ConfirmModal
            data={pendingData}
            onConfirm={handleConfirm}
            onCancel={() => setShowModal(false)}
          />
        )}
      </AnimatePresence>

      <div className="min-h-screen bg-[#050505] pt-28 pb-24 px-4">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium mb-4">
              <Lock className="w-3 h-3" />
              All parameters are immutable after creation
            </div>
            <h1 className="text-3xl font-bold text-white">Create Auction</h1>
            <p className="text-zinc-500 text-sm mt-2">
              Set your rules carefully — they will be locked on-chain forever.
              Currency: <span className="text-cyan-400">USDCx only</span>.
            </p>
          </motion.div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Item Info */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
            >
              <Section title="📋 Item Information">
                <div>
                  <Label>Title</Label>
                  <Input
                    {...register("title")}
                    placeholder="e.g. Enterprise Software License Q4"
                    error={errors.title?.message}
                  />
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea
                    {...register("description")}
                    rows={3}
                    placeholder="Describe what is being auctioned, requirements, deliverables…"
                    error={errors.description?.message}
                  />
                </div>
                <div>
                  <Label>Category</Label>
                  <select
                    {...register("category")}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-cyan-500/50 transition-all cursor-pointer"
                  >
                    <option value="" className="bg-[#141414]">
                      Select…
                    </option>
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c} className="bg-[#141414]">
                        {c}
                      </option>
                    ))}
                  </select>
                  {errors.category && (
                    <p className="text-red-400 text-xs mt-1">
                      {errors.category.message}
                    </p>
                  )}
                </div>
              </Section>
            </motion.div>

            {/* Pricing */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Section title="💰 Pricing (USDCx)">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label hint="Minimum opening bid amount in USDCx">
                      Starting Bid
                    </Label>
                    <Input
                      {...register("startingBid")}
                      type="number"
                      min={0}
                      step={1}
                      placeholder="1000"
                      error={errors.startingBid?.message}
                    />
                  </div>
                  <div>
                    <Label hint="Minimum raise each time someone bids">
                      Min Increment
                    </Label>
                    <Input
                      {...register("minBidIncrement")}
                      type="number"
                      min={0}
                      step={1}
                      placeholder="100"
                      error={errors.minBidIncrement?.message}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label hint="Hidden minimum price. Auction only settles if exceeded.">
                      Reserve Price{" "}
                      <span className="text-zinc-600 font-normal">(opt.)</span>
                    </Label>
                    <Input
                      {...register("reservePrice")}
                      type="number"
                      min={0}
                      step={1}
                      placeholder="5000"
                      error={errors.reservePrice?.message}
                    />
                  </div>
                  <div>
                    <Label hint="Instant-win price. First bidder to reach this wins immediately.">
                      Buy Now Price{" "}
                      <span className="text-zinc-600 font-normal">(opt.)</span>
                    </Label>
                    <Input
                      {...register("buyNowPrice")}
                      type="number"
                      min={0}
                      step={1}
                      placeholder="10000"
                      error={errors.buyNowPrice?.message}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    {...register("showReservePrice")}
                    id="showReserve"
                    type="checkbox"
                    className="w-4 h-4 rounded border-white/20 bg-white/[0.04] accent-cyan-500"
                  />
                  <label htmlFor="showReserve" className="text-zinc-400 text-sm cursor-pointer flex items-center gap-1.5">
                    {watch("showReservePrice") ? (
                      <Eye className="w-3.5 h-3.5" />
                    ) : (
                      <EyeOff className="w-3.5 h-3.5" />
                    )}
                    Show reserve price to bidders
                  </label>
                </div>
              </Section>
            </motion.div>

            {/* Timing */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              <Section title="⏱ Timing">
                <div>
                  <Label hint="How long the auction runs before closing for bid reveals">
                    Duration (hours)
                  </Label>
                  <Input
                    {...register("durationHours")}
                    type="number"
                    min={1}
                    max={720}
                    placeholder="48"
                    error={errors.durationHours?.message}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label hint="If a bid arrives within this window before end, the timer extends">
                      Anti-sniping Window (min)
                    </Label>
                    <Input
                      {...register("antiSnipingWindowMinutes")}
                      type="number"
                      min={0}
                      max={60}
                      placeholder="10"
                      error={errors.antiSnipingWindowMinutes?.message}
                    />
                  </div>
                  <div>
                    <Label hint="How many minutes to add when anti-snipe triggers">
                      Extension (min)
                    </Label>
                    <Input
                      {...register("antiSnipingExtensionMinutes")}
                      type="number"
                      min={1}
                      max={30}
                      placeholder="5"
                      error={errors.antiSnipingExtensionMinutes?.message}
                    />
                  </div>
                </div>
              </Section>
            </motion.div>

            {/* Access */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Section title="🔐 Access & Rules">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Visibility</Label>
                    <select
                      {...register("visibility")}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-cyan-500/50 transition-all cursor-pointer"
                    >
                      <option value="public" className="bg-[#141414]">
                        Public
                      </option>
                      <option value="private" className="bg-[#141414]">
                        Private (invite only)
                      </option>
                    </select>
                  </div>
                  <div>
                    <Label hint="Sealed: bids hidden until reveal. Dutch: price drops. Vickrey: winner pays 2nd price.">
                      Auction Type
                    </Label>
                    <select
                      {...register("auctionType")}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-cyan-500/50 transition-all cursor-pointer"
                    >
                      <option value="sealed" className="bg-[#141414]">
                        Sealed Bid
                      </option>
                      <option value="dutch" className="bg-[#141414]">
                        Dutch
                      </option>
                      <option value="vickrey" className="bg-[#141414]">
                        Vickrey
                      </option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label hint="Maximum number of participants allowed">
                      Max Bidders
                    </Label>
                    <Input
                      {...register("maxBidders")}
                      type="number"
                      min={1}
                      max={500}
                      placeholder="50"
                      error={errors.maxBidders?.message}
                    />
                  </div>
                  <div>
                    <Label hint="% of bid amount locked as deposit to participate">
                      Bid Deposit (%)
                    </Label>
                    <Input
                      {...register("bidDepositPercent")}
                      type="number"
                      min={0}
                      max={100}
                      placeholder="10"
                      error={errors.bidDepositPercent?.message}
                    />
                  </div>
                </div>
              </Section>
            </motion.div>

            {/* Submit */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
            >
              <button
                type="submit"
                className="w-full py-4 rounded-2xl bg-cyan-500 text-black font-bold text-sm hover:bg-cyan-400 transition-all shadow-lg shadow-cyan-500/30 flex items-center justify-center gap-2 group"
              >
                <Lock className="w-4 h-4" />
                Review & Lock Rules
                <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </button>
              <p className="text-zinc-600 text-xs text-center mt-3">
                You will see a confirmation screen before anything is sent
                on-chain.
              </p>
            </motion.div>
          </form>
        </div>
      </div>
    </>
  );
}
