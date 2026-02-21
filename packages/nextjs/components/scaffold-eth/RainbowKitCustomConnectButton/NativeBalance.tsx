"use client";

import { CSSProperties, useMemo, useState } from "react";
import { useWatchBalance } from "@scaffold-ui/hooks";
import { formatUnits } from "viem";
import { Address } from "viem";
import { useBalance } from "wagmi";
import { useTargetNetwork } from "~~/hooks/scaffold-eth/useTargetNetwork";
import { ADI_TOKEN_ADDRESS, DDSC_TOKEN_ADDRESS } from "~~/lib/darkpool-config";

type NativeBalanceProps = {
  address: Address;
  style?: CSSProperties;
};

/**
 * Multi-token balance cycler.
 *
 * Click to cycle through: native (ADI) -> ADI ERC-20 -> DDSC.
 * ERC-20 slots only appear when their NEXT_PUBLIC_*_ADDRESS env var is set.
 * All wagmi hooks are called unconditionally (rules of hooks), but each ERC-20
 * query is disabled when no address is configured.
 */
export const NativeBalance = ({ address, style }: NativeBalanceProps) => {
  const { targetNetwork } = useTargetNetwork();
  const [idx, setIdx] = useState(0);

  // 1. Native token (always enabled)
  const { data: nativeBal, isLoading: nativeLoading } = useWatchBalance({
    address,
    chain: targetNetwork,
  });

  // 2. ADI ERC-20
  const { data: adiBal, isLoading: adiLoading } = useBalance({
    address,
    token: ADI_TOKEN_ADDRESS as `0x${string}` | undefined,
    chainId: targetNetwork.id,
    query: { enabled: Boolean(address) && Boolean(ADI_TOKEN_ADDRESS) },
  });

  // 3. DDSC (AED stablecoin — settlement currency)
  const { data: ddscBal, isLoading: ddscLoading } = useBalance({
    address,
    token: DDSC_TOKEN_ADDRESS as `0x${string}` | undefined,
    chainId: targetNetwork.id,
    query: { enabled: Boolean(address) && Boolean(DDSC_TOKEN_ADDRESS) },
  });

  // Build ordered list — only include ERC-20 slots when configured
  const slots = useMemo(
    () =>
      [
        {
          key: "native",
          symbol: targetNetwork.nativeCurrency.symbol,
          value: nativeBal ? Number(formatUnits(nativeBal.value, nativeBal.decimals)) : null,
          isLoading: nativeLoading,
          show: true,
        },
        {
          key: "adi",
          symbol: adiBal?.symbol ?? "ADI",
          value: adiBal ? Number(formatUnits(adiBal.value, adiBal.decimals)) : null,
          isLoading: adiLoading,
          show: Boolean(ADI_TOKEN_ADDRESS),
        },
        {
          key: "ddsc",
          symbol: ddscBal?.symbol ?? "DDSC",
          value: ddscBal ? Number(formatUnits(ddscBal.value, ddscBal.decimals)) : null,
          isLoading: ddscLoading,
          show: Boolean(DDSC_TOKEN_ADDRESS),
        },
      ].filter(s => s.show),

    [targetNetwork.nativeCurrency.symbol, nativeBal, nativeLoading, adiBal, adiLoading, ddscBal, ddscLoading],
  );

  const current = slots[idx % slots.length];
  const canCycle = slots.length > 1;

  if (current.isLoading) {
    return (
      <div className="flex items-center animate-pulse" style={style}>
        <div className="h-3 w-16 bg-gray-700 rounded" />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => canCycle && setIdx(i => (i + 1) % slots.length)}
      title={canCycle ? "Click to cycle token" : undefined}
      className={`flex items-center font-normal bg-transparent focus:outline-none${canCycle ? " cursor-pointer" : " cursor-default"}`}
      style={style}
    >
      <span>{current.value !== null ? current.value.toFixed(4) : "—"}</span>
      <span className="text-xs font-bold ml-1">{current.symbol}</span>
      {canCycle && <span className="text-[9px] ml-0.5 opacity-40">▸</span>}
    </button>
  );
};
