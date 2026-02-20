"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { encodeAbiParameters, keccak256, parseAbiParameters, parseEther, toHex } from "viem";
import { useAccount, useReadContract, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { VAULT_ABI } from "~~/lib/contracts";
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
}

function randomBytes32(): `0x${string}` {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return toHex(arr) as `0x${string}`;
}

export function BidPanel({ vaultAddress, phase, closeTime, revealDeadline, depositRequired, bidCount }: BidPanelProps) {
  const { address: userAddress, isConnected } = useAccount();

  const [priceEth, setPriceEth] = useState("");
  const [storageRoot, setStorageRoot] = useState("");
  const [salt, setSalt] = useState<`0x${string}`>(() => randomBytes32());
  const [, setCommitHash] = useState<`0x${string}` | null>(null);

  const [revealPrice, setRevealPrice] = useState("");
  const [revealSalt, setRevealSalt] = useState("");

  const nowSec = Math.floor(Date.now() / 1000);
  const secsToClose = Math.max(0, Number(closeTime) - nowSec);
  const secsToRevealEnd = Math.max(0, Number(revealDeadline) - nowSec);

  const { data: userBid } = useReadContract({
    address: vaultAddress,
    abi: VAULT_ABI,
    functionName: "bids",
    args: [userAddress ?? ("0x0000000000000000000000000000000000000000" as `0x${string}`)],
    query: { enabled: !!userAddress },
  });

  const userHasCommitted =
    userBid && userBid[0] !== "0x0000000000000000000000000000000000000000000000000000000000000000";
  const userHasRevealed = userBid && userBid[3] === true;

  const { writeContractAsync: doCommit, isPending: isCommitPending } = useWriteContract();
  const [commitTxHash, setCommitTxHash] = useState<`0x${string}` | undefined>();
  const { isSuccess: isCommitSuccess } = useWaitForTransactionReceipt({ hash: commitTxHash });

  const { writeContractAsync: doReveal, isPending: isRevealPending } = useWriteContract();
  const [revealTxHash, setRevealTxHash] = useState<`0x${string}` | undefined>();
  const { isSuccess: isRevealSuccess } = useWaitForTransactionReceipt({ hash: revealTxHash });

  function computeCommitHash(price: bigint, s: `0x${string}`, sender: `0x${string}`): `0x${string}` {
    return keccak256(
      encodeAbiParameters(parseAbiParameters("uint256 price, bytes32 salt, address sender"), [price, s, sender]),
    );
  }

  async function handleCommit() {
    if (!isConnected || !userAddress) {
      toast.error("Connect wallet");
      return;
    }
    const priceWei = parseEther(priceEth || "0");
    if (priceWei <= 0n) {
      toast.error("Enter valid price");
      return;
    }
    if (!storageRoot) {
      toast.error("Enter storage root hash");
      return;
    }
    const hash = computeCommitHash(priceWei, salt, userAddress as `0x${string}`);
    setCommitHash(hash);
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
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  async function handleReveal() {
    if (!isConnected || !userAddress) {
      toast.error("Connect wallet");
      return;
    }
    const priceWei = parseEther(revealPrice || "0");
    if (priceWei <= 0n) {
      toast.error("Enter committed price");
      return;
    }
    if (!revealSalt || revealSalt.length !== 66) {
      toast.error("Enter 32-byte salt");
      return;
    }
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
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  const isOpen = phase === VaultPhase.OPEN && secsToClose > 0;
  const isReveal = phase === VaultPhase.REVEAL && secsToRevealEnd > 0;

  const inputClass =
    "w-full px-4 py-3 bg-black border border-white font-mono text-xs text-white placeholder:text-white/20 focus:outline-none focus:bg-white focus:text-black transition-all duration-100";

  return (
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

        {/* COMMIT */}
        {isOpen && !userHasCommitted && !isCommitSuccess && (
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
                className="border border-white px-4 py-3 font-mono text-[10px] opacity-40 truncate cursor-pointer hover:opacity-60 hover:opacity-100 transition-all duration-100"
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
            <button
              onClick={handleCommit}
              disabled={isCommitPending || !isConnected}
              className="w-full py-4 border border-white bg-white text-black font-mono text-xs tracking-[0.15em] uppercase font-bold hover:opacity-80 disabled:opacity-20 transition-all duration-100"
            >
              {isCommitPending ? "COMMITTING..." : `COMMIT BID · ${formatWei(depositRequired)}`}
            </button>
          </div>
        )}

        {/* COMMITTED */}
        {(isCommitSuccess || (isOpen && userHasCommitted)) && !isReveal && (
          <div className="border border-white p-6 text-center">
            <p className="font-mono text-xs font-bold uppercase tracking-[0.1em] mb-1">BID COMMITTED</p>
            <p className="font-mono text-[10px] uppercase opacity-40">REVEAL AFTER AUCTION CLOSES</p>
          </div>
        )}

        {/* REVEAL */}
        {isReveal && userHasCommitted && !userHasRevealed && !isRevealSuccess && (
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
              disabled={isRevealPending || !isConnected}
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

        {!isConnected && (isOpen || isReveal) && (
          <p className="font-mono text-[11px] uppercase text-center opacity-30 py-4">CONNECT WALLET TO PARTICIPATE</p>
        )}

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
  );
}
