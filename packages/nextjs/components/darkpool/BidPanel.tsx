"use client";

import { useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { encodeAbiParameters, keccak256, parseAbiParameters, parseEther, toHex } from "viem";
import {
  useAccount,
  useChainId,
  useReadContract,
  useSignTypedData,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { CompetitivenessWidget } from "~~/components/ai/CompetitivenessWidget";
import { useMarketHistoricalData } from "~~/hooks/useMarketHistoricalData";
import { FACTORY_ABI, VAULT_ABI } from "~~/lib/contracts";
import { FACTORY_ADDRESS } from "~~/lib/darkpool-config";
import { VaultPhase } from "~~/lib/types";
import { formatTimeLeft, formatWei } from "~~/lib/utils";

interface BidPanelProps {
  vaultAddress: `0x${string}`;
  phase: VaultPhase;
  closeTime: bigint;
  revealDeadline: bigint;
  depositRequired: bigint;
  bidCount: bigint;
  eciesKey: string;
  requiresAccreditation: boolean;
}

const CONFLICT_STATEMENT =
  "I hereby attest that I have no undisclosed conflict of interest with the seller, asset issuer, or any counterparty to this auction, and that I am submitting a bona fide arm's-length bid.";

function randomBytes32(): `0x${string}` {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return toHex(arr) as `0x${string}`;
}

export function BidPanel({
  vaultAddress,
  phase,
  closeTime,
  revealDeadline,
  depositRequired,
  bidCount,
  requiresAccreditation,
}: BidPanelProps) {
  const { address: userAddress, isConnected } = useAccount();
  const chainId = useChainId();

  // ─── Contract reads ──────────────────────────────────────────────────────────
  const ZERO = "0x0000000000000000000000000000000000000000" as `0x${string}`;

  const { data: isVerified } = useReadContract({
    address: FACTORY_ADDRESS,
    abi: FACTORY_ABI,
    functionName: "verified",
    args: [userAddress ?? ZERO],
    query: { enabled: !!userAddress },
  });

  const { data: isAccredited } = useReadContract({
    address: FACTORY_ADDRESS,
    abi: FACTORY_ABI,
    functionName: "isAccredited",
    args: [userAddress ?? ZERO],
    query: { enabled: !!userAddress && requiresAccreditation },
  });

  const { data: hasAttestation, refetch: refetchAttestation } = useReadContract({
    address: vaultAddress,
    abi: VAULT_ABI,
    functionName: "conflictAttestationSubmitted",
    args: [userAddress ?? ZERO],
    query: { enabled: !!userAddress },
  });

  const { data: userBid } = useReadContract({
    address: vaultAddress,
    abi: VAULT_ABI,
    functionName: "bids",
    args: [userAddress ?? ZERO],
    query: { enabled: !!userAddress },
  });

  // ─── Local state ─────────────────────────────────────────────────────────────
  const [priceEth, setPriceEth] = useState("");
  const [storageRoot, setStorageRoot] = useState("");
  const [salt, setSalt] = useState<`0x${string}`>(() => randomBytes32());
  const [revealPrice, setRevealPrice] = useState("");
  const [revealSalt, setRevealSalt] = useState("");
  const [showAttestModal, setShowAttestModal] = useState(false);

  // Market data for AI competitiveness analysis
  const { marketData, isLoading: loadingMarket } = useMarketHistoricalData();

  // ─── Derived ─────────────────────────────────────────────────────────────────
  const nowSec = Math.floor(Date.now() / 1000);
  const secsToClose = Math.max(0, Number(closeTime) - nowSec);
  const secsToRevealEnd = Math.max(0, Number(revealDeadline) - nowSec);
  const isOpen = phase === VaultPhase.OPEN && secsToClose > 0;
  const isReveal = phase === VaultPhase.REVEAL && secsToRevealEnd > 0;

  const userHasCommitted =
    userBid && userBid[0] !== "0x0000000000000000000000000000000000000000000000000000000000000000";
  const userHasRevealed = userBid && userBid[3] === true;

  // Compliance gates
  const kybBlocked = isConnected && !isVerified;
  const accreditBlocked = isConnected && requiresAccreditation && !isAccredited;
  const attestBlocked = isConnected && !!isVerified && !kybBlocked && !hasAttestation && (isOpen || isReveal);
  const canBid = isConnected && !!isVerified && !accreditBlocked && !!hasAttestation;

  // ─── Wagmi hooks ─────────────────────────────────────────────────────────────
  const { signTypedDataAsync, isPending: isSignPending } = useSignTypedData();
  const { writeContractAsync: doAttest, isPending: isAttestPending } = useWriteContract();
  const [attestTxHash, setAttestTxHash] = useState<`0x${string}` | undefined>();
  const { isSuccess: isAttestSuccess } = useWaitForTransactionReceipt({ hash: attestTxHash });
  if (isAttestSuccess) void refetchAttestation();

  const { writeContractAsync: doCommit, isPending: isCommitPending } = useWriteContract();
  const [commitTxHash, setCommitTxHash] = useState<`0x${string}` | undefined>();
  const { isSuccess: isCommitSuccess } = useWaitForTransactionReceipt({ hash: commitTxHash });

  const { writeContractAsync: doReveal, isPending: isRevealPending } = useWriteContract();
  const [revealTxHash, setRevealTxHash] = useState<`0x${string}` | undefined>();
  const { isSuccess: isRevealSuccess } = useWaitForTransactionReceipt({ hash: revealTxHash });

  // ─── Handlers ────────────────────────────────────────────────────────────────
  async function handleSignAndAttest() {
    if (!userAddress) return;
    const timestamp = BigInt(Math.floor(Date.now() / 1000));
    try {
      const sig = await signTypedDataAsync({
        domain: {
          name: "ShadowBidVault",
          version: "1",
          chainId,
          verifyingContract: vaultAddress,
        },
        types: {
          ConflictAttestation: [
            { name: "bidder", type: "address" },
            { name: "vault", type: "address" },
            { name: "statement", type: "string" },
            { name: "timestamp", type: "uint256" },
          ],
        },
        primaryType: "ConflictAttestation",
        message: {
          bidder: userAddress,
          vault: vaultAddress,
          statement: CONFLICT_STATEMENT,
          timestamp,
        },
      });
      const txHash = await doAttest({
        address: vaultAddress,
        abi: VAULT_ABI,
        functionName: "submitConflictAttestation",
        args: [timestamp, sig as `0x${string}`],
      });
      setAttestTxHash(txHash);
      setShowAttestModal(false);
      toast.success("Attestation submitted on-chain.");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message.slice(0, 80) : "Sign failed");
    }
  }

  function computeCommitHash(price: bigint, s: `0x${string}`, sender: `0x${string}`): `0x${string}` {
    return keccak256(
      encodeAbiParameters(parseAbiParameters("uint256 price, bytes32 salt, address sender"), [price, s, sender]),
    );
  }

  async function handleCommit() {
    if (!isConnected || !userAddress) return toast.error("Connect wallet");
    const priceWei = parseEther(priceEth || "0");
    if (priceWei <= 0n) return toast.error("Enter valid price");
    if (!storageRoot) return toast.error("Enter storage root hash");
    const hash = computeCommitHash(priceWei, salt, userAddress as `0x${string}`);
    try {
      const txHash = await doCommit({
        address: vaultAddress,
        abi: VAULT_ABI,
        functionName: "commitBid",
        args: [hash, storageRoot as `0x${string}`],
        value: depositRequired,
      });
      setCommitTxHash(txHash);
      toast.success("Bid committed. Save your salt.");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message.slice(0, 80) : "Failed");
    }
  }

  async function handleReveal() {
    if (!isConnected || !userAddress) return toast.error("Connect wallet");
    const priceWei = parseEther(revealPrice || "0");
    if (priceWei <= 0n) return toast.error("Enter committed price");
    if (!revealSalt || revealSalt.length !== 66) return toast.error("Enter 32-byte salt (0x...)");
    try {
      const txHash = await doReveal({
        address: vaultAddress,
        abi: VAULT_ABI,
        functionName: "revealBid",
        args: [priceWei, revealSalt as `0x${string}`],
      });
      setRevealTxHash(txHash);
      toast.success("Bid revealed.");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message.slice(0, 80) : "Failed");
    }
  }

  // ─── Styles ──────────────────────────────────────────────────────────────────
  const inputClass =
    "w-full px-4 py-3 bg-black border border-white font-mono text-xs text-white placeholder:text-white/20 focus:outline-none focus:bg-white focus:text-black transition-all duration-100";

  return (
    <>
      {/* ── Conflict Attestation Modal ────────────────────────────────────── */}
      {showAttestModal && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-6">
          <div className="border border-white max-w-lg w-full bg-black">
            <div className="border-b border-white px-6 py-4 flex items-center justify-between">
              <span className="font-mono text-xs font-bold tracking-[0.1em] uppercase">CONFLICT ATTESTATION</span>
              <button
                onClick={() => setShowAttestModal(false)}
                className="font-mono text-[10px] uppercase opacity-30 hover:opacity-100"
              >
                [CLOSE]
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="font-mono text-[10px] uppercase opacity-50 leading-relaxed">
                REGULATORY REQUIREMENT — YOU MUST ATTEST NO CONFLICT OF INTEREST BEFORE BIDDING
              </p>
              <div className="border border-white/20 p-4 bg-white/5">
                <p className="font-mono text-[11px] leading-relaxed text-white/80 italic">
                  &ldquo;{CONFLICT_STATEMENT}&rdquo;
                </p>
              </div>
              <p className="font-mono text-[10px] uppercase opacity-40">
                SIGNING THIS CREATES A CRYPTOGRAPHIC RECORD ON-CHAIN. THIS ATTESTATION IS LEGALLY BINDING.
              </p>
              <button
                onClick={handleSignAndAttest}
                disabled={isSignPending || isAttestPending}
                className="w-full py-3 border border-white bg-white text-black font-mono text-xs tracking-[0.15em] uppercase font-bold hover:opacity-80 disabled:opacity-20"
              >
                {isSignPending ? "SIGNING..." : isAttestPending ? "SUBMITTING..." : "SIGN & SUBMIT ATTESTATION"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Main Panel ────────────────────────────────────────────────────── */}
      <div className="border border-white">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white">
          <span className="font-mono text-xs font-bold tracking-[0.1em] uppercase">
            {isOpen ? "SUBMIT BID" : isReveal ? "REVEAL BID" : "CLOSED"}
          </span>
          <span className="font-mono text-[10px] tracking-[0.1em] uppercase opacity-40">
            {isOpen ? formatTimeLeft(secsToClose) : isReveal ? formatTimeLeft(secsToRevealEnd) : "—"}
          </span>
        </div>

        <div className="p-6 space-y-4">
          {/* Stats */}
          <div className="flex border border-white">
            <div className="flex-1 p-4 border-r border-white">
              <p className="font-mono text-[9px] tracking-[0.2em] uppercase opacity-30 mb-1">DEPOSIT</p>
              <p className="font-mono text-sm font-bold">{formatWei(depositRequired)}</p>
            </div>
            <div className="flex-1 p-4">
              <p className="font-mono text-[9px] tracking-[0.2em] uppercase opacity-30 mb-1">BIDS</p>
              <p className="font-mono text-sm font-bold">{Number(bidCount)}</p>
            </div>
          </div>

          {/* Not connected */}
          {!isConnected && (isOpen || isReveal) && (
            <p className="font-mono text-[11px] uppercase text-center opacity-30 py-4">CONNECT WALLET TO PARTICIPATE</p>
          )}

          {/* KYB Gate */}
          {isConnected && kybBlocked && (isOpen || isReveal) && (
            <div className="border border-yellow-400/50 p-4 space-y-3">
              <span className="font-mono text-[9px] uppercase text-yellow-400 border border-yellow-400 px-1.5 py-0.5">
                KYB REQUIRED
              </span>
              <p className="font-mono text-[10px] uppercase opacity-60 leading-relaxed mt-2">
                THIS AUCTION REQUIRES INSTITUTIONAL KYB VERIFICATION BEFORE BIDDING.
              </p>
              <Link
                href="/kyb"
                className="block text-center py-3 border border-yellow-400 text-yellow-400 font-mono text-xs tracking-[0.15em] uppercase hover:bg-yellow-400 hover:text-black transition-all duration-100"
              >
                COMPLETE KYB VERIFICATION →
              </Link>
            </div>
          )}

          {/* Accreditation Gate */}
          {isConnected && !kybBlocked && accreditBlocked && (isOpen || isReveal) && (
            <div className="border border-orange-400/50 p-4 space-y-2">
              <span className="font-mono text-[9px] uppercase text-orange-400 border border-orange-400 px-1.5 py-0.5">
                ACCREDITED INVESTOR ONLY
              </span>
              <p className="font-mono text-[10px] uppercase opacity-60 leading-relaxed mt-2">
                THIS VAULT REQUIRES VERIFIED ACCREDITATION STATUS. CONTACT YOUR COMPLIANCE OFFICER.
              </p>
            </div>
          )}

          {/* Conflict Attestation Gate */}
          {isConnected && attestBlocked && !accreditBlocked && (
            <div className="border border-white/30 p-4 space-y-3">
              <span className="font-mono text-[9px] uppercase opacity-60 border border-white/40 px-1.5 py-0.5">
                STEP REQUIRED
              </span>
              <p className="font-mono text-[10px] uppercase opacity-60 leading-relaxed mt-2">
                A SIGNED CONFLICT-OF-INTEREST ATTESTATION IS REQUIRED BEFORE BIDDING.
              </p>
              <button
                onClick={() => setShowAttestModal(true)}
                className="w-full py-3 border border-white font-mono text-xs tracking-[0.15em] uppercase hover:bg-white hover:text-black transition-all duration-100"
              >
                SIGN CONFLICT ATTESTATION
              </button>
            </div>
          )}

          {/* KYB verified badge */}
          {isConnected && !!isVerified && (
            <div className="flex items-center gap-2 px-1">
              <span className="font-mono text-[9px] uppercase text-green-400">● KYB VERIFIED</span>
              {!!isAccredited && <span className="font-mono text-[9px] uppercase text-green-400/60">· ACCREDITED</span>}
            </div>
          )}

          {/* COMMIT */}
          {isOpen && !userHasCommitted && !isCommitSuccess && canBid && (
            <div className="space-y-3">
              <div>
                <label className="font-mono text-[10px] tracking-[0.15em] uppercase opacity-50 block mb-2">
                  BID PRICE (ETH)
                </label>
                <input
                  type="number"
                  step="0.0001"
                  value={priceEth}
                  onChange={e => setPriceEth(e.target.value)}
                  placeholder="0.5"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="font-mono text-[10px] tracking-[0.15em] uppercase opacity-50 block mb-2">
                  STORAGE ROOT
                </label>
                <input
                  type="text"
                  value={storageRoot}
                  onChange={e => setStorageRoot(e.target.value)}
                  placeholder="0x..."
                  className={inputClass}
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="font-mono text-[10px] tracking-[0.15em] uppercase opacity-50">SALT</label>
                  <button
                    onClick={() => setSalt(randomBytes32())}
                    className="font-mono text-[10px] uppercase opacity-30 hover:opacity-100 transition-opacity"
                  >
                    [REGEN]
                  </button>
                </div>
                <div
                  className="border border-white px-4 py-3 font-mono text-[10px] opacity-40 truncate cursor-pointer hover:opacity-100 transition-all duration-100"
                  onClick={() => {
                    navigator.clipboard.writeText(salt);
                    toast.success("Salt copied");
                  }}
                >
                  {salt}
                </div>
                <p className="font-mono text-[10px] uppercase opacity-30 mt-1">
                  ⚠ SAVE THIS SALT — YOU NEED IT TO REVEAL
                </p>
              </div>

              {/* AI Competitiveness Widget */}
              {marketData && (
                <CompetitivenessWidget
                  providerPrice={parseFloat(priceEth) || 0}
                  providerConditions={storageRoot}
                  auctionCategory="RWA"
                />
              )}
              {!marketData && loadingMarket && (
                <div className="border border-white/10 p-3">
                  <p className="font-mono text-[9px] uppercase opacity-30 animate-pulse">
                    LOADING MARKET DATA FOR AI ANALYSIS...
                  </p>
                </div>
              )}

              <button
                onClick={handleCommit}
                disabled={isCommitPending}
                className="w-full py-4 border border-white bg-white text-black font-mono text-xs tracking-[0.15em] uppercase font-bold hover:opacity-80 disabled:opacity-20 transition-all duration-100"
              >
                {isCommitPending ? "COMMITTING..." : `COMMIT BID · ${formatWei(depositRequired)}`}
              </button>
            </div>
          )}

          {/* COMMITTED — waiting for reveal phase */}
          {(isCommitSuccess || (isOpen && userHasCommitted)) && !isReveal && (
            <div className="border border-white p-6 text-center">
              <p className="font-mono text-xs font-bold uppercase tracking-[0.1em] mb-1">BID COMMITTED</p>
              <p className="font-mono text-[10px] uppercase opacity-40">REVEAL AFTER AUCTION CLOSES</p>
            </div>
          )}

          {/* REVEAL */}
          {isReveal && userHasCommitted && !userHasRevealed && !isRevealSuccess && canBid && (
            <div className="space-y-3">
              <div className="border border-white p-4">
                <p className="font-mono text-[10px] uppercase opacity-60">
                  REVEAL PHASE OPEN — ENTER EXACT PRICE AND SALT
                </p>
              </div>
              <div>
                <label className="font-mono text-[10px] tracking-[0.15em] uppercase opacity-50 block mb-2">
                  COMMITTED PRICE (ETH)
                </label>
                <input
                  type="number"
                  step="0.0001"
                  value={revealPrice}
                  onChange={e => setRevealPrice(e.target.value)}
                  placeholder="0.5"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="font-mono text-[10px] tracking-[0.15em] uppercase opacity-50 block mb-2">
                  SALT (BYTES32)
                </label>
                <input
                  type="text"
                  value={revealSalt}
                  onChange={e => setRevealSalt(e.target.value as `0x${string}`)}
                  placeholder="0x..."
                  className={inputClass}
                />
              </div>
              <button
                onClick={handleReveal}
                disabled={isRevealPending}
                className="w-full py-4 border border-white bg-white text-black font-mono text-xs tracking-[0.15em] uppercase font-bold hover:opacity-80 disabled:opacity-20 transition-all duration-100"
              >
                {isRevealPending ? "REVEALING..." : "REVEAL BID"}
              </button>
            </div>
          )}

          {/* REVEALED */}
          {(isRevealSuccess || (isReveal && userHasRevealed)) && (
            <div className="border border-white p-6 text-center">
              <p className="font-mono text-xs font-bold uppercase tracking-[0.1em] mb-1">BID REVEALED</p>
              <p className="font-mono text-[10px] uppercase opacity-40">AWAITING SETTLEMENT</p>
            </div>
          )}

          {/* Closed / Settled / Cancelled */}
          {!isOpen && !isReveal && (
            <div className="py-4 text-center font-mono text-[11px] uppercase opacity-30">
              {phase === VaultPhase.SETTLED
                ? "AUCTION SETTLED — WINNER SELECTED"
                : phase === VaultPhase.CANCELLED
                  ? "AUCTION CANCELLED"
                  : "AUCTION CLOSED"}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
