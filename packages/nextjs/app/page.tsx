"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocalStorage } from "usehooks-ts";
import { hardhat } from "viem/chains";
import { useAccount, useDisconnect, useReadContract, useReadContracts } from "wagmi";
import LandingPage from "~~/components/LandingPage";
import { BlockieAvatar, FaucetButton, RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";
import deployedContracts from "~~/contracts/deployedContracts";
import { useTargetNetwork } from "~~/hooks/scaffold-eth";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";
import { useBleStore } from "~~/services/store/useBLEstore";

// const communityAbi = [
//   { inputs: [], name: "isOpenCommunity", outputs: [{ type: "bool" }], stateMutability: "view", type: "function" },
//   {
//     inputs: [{ name: "account", type: "address" }],
//     name: "isMember",
//     outputs: [{ type: "bool" }],
//     stateMutability: "view",
//     type: "function",
//   },
// ] as const;

// ─── Utility ─────────────────────────────────────────────────────────────────
function shortenAddress(addr: string) {
  return addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "";
}

// ─── Skeleton ────────────────────────────────────────────────────────────────
function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-100 rounded-xl ${className}`} />;
}

// ─── BLE Status pill ─────────────────────────────────────────────────────────
function BleStatusPill({ status }: { status: string }) {
  const connected = status.includes("Terhubung");
  const searching = status.includes("Mencari");
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[10px] font-semibold tracking-wide px-3 py-1 rounded-full border
        ${
          connected
            ? "bg-emerald-50 text-emerald-600 border-emerald-200"
            : searching
              ? "bg-amber-50 text-amber-600 border-amber-200"
              : "bg-gray-100 text-gray-400 border-gray-200"
        }`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full
          ${connected ? "bg-emerald-500 animate-pulse" : searching ? "bg-amber-400 animate-pulse" : "bg-gray-300"}`}
      />
      {status}
    </span>
  );
}

// ─── Community chip row ───────────────────────────────────────────────────────
function CommunitySelector({
  communities,
  active,
  onChange,
  isLoading,
}: {
  communities: any[];
  active: any;
  onChange: (c: any) => void;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="flex gap-2 overflow-x-auto pb-1">
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-8 w-24 flex-shrink-0" />
        ))}
      </div>
    );
  }
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
      {communities.map((c: any) => (
        <button
          key={c.contractAddress}
          onClick={() => onChange(c)}
          className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all duration-150
            ${
              active?.contractAddress === c.contractAddress
                ? "bg-gray-900 text-white border-gray-900 shadow-sm"
                : "bg-white text-gray-500 border-gray-200 hover:border-gray-400 hover:text-gray-700"
            }`}
        >
          {c.symbol}
        </button>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Home() {
  const { targetNetwork } = useTargetNetwork();
  const isLocalNetwork = targetNetwork.id === hardhat.id;
  const { address: userAddress, isConnected, chain } = useAccount();
  const { disconnect } = useDisconnect();

  const chainId = chain?.id ?? targetNetwork.id ?? 31337;
  const contracts = deployedContracts as Record<number, any>;
  const communityAbi = contracts[chainId]?.CommunityRVM?.abi;

  const [activeCommunity, setActiveCommunity] = useState<any>(null);
  const [tokenBalances, setTokenBalances] = useState<Record<string, number>>({});
  const { status, latestPayload, clearPayload } = useBleStore();

  const [mounted, setMounted] = useState(false);
  const [walletMode, setWalletMode] = useLocalStorage<"real" | "burner" | null>("rvm_wallet_mode", null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // =========================================================
  // LOGIKA "SANGAT SENSITIF" UNTUK ONBOARDING & KONEKSI
  // =========================================================

  // EFEK 2: Jika dompet terputus dan modenya 'real' -> Otomatis lempar ke LandingPage
  useEffect(() => {
    if (mounted && walletMode === "real" && !isConnected) {
      setWalletMode(null);
    }
  }, [mounted, walletMode, isConnected, setWalletMode]);

  const handleBypass = () => {
    setWalletMode("real");
  };

  const { data: dynamicCommunities, isLoading } = useScaffoldReadContract({
    contractName: "RVMFactory",
    functionName: "getAllCommunityDetails",
  });

  const { data: openStatuses } = useReadContracts({
    contracts: (dynamicCommunities || []).map((c: any) => ({
      address: c.contractAddress as `0x${string}`,
      abi: communityAbi,
      functionName: "isOpenCommunity",
    })),
    query: { enabled: !!communityAbi && dynamicCommunities?.length > 0 },
  });

  const { data: memberStatuses } = useReadContracts({
    contracts: (dynamicCommunities || []).map((c: any) => ({
      address: c.contractAddress as `0x${string}`,
      abi: communityAbi,
      functionName: "isMember",
      args: [(userAddress as `0x${string}`) || "0x0000000000000000000000000000000000000000"],
    })),
    query: { enabled: !!communityAbi && dynamicCommunities?.length > 0 },
  });

  const allowedCommunities = useMemo(() => {
    return (
      dynamicCommunities?.filter((comm: any, idx: number) => {
        const isOpen = openStatuses?.[idx]?.result !== false;
        const isUserMember = memberStatuses?.[idx]?.result === true;
        return isOpen || isUserMember;
      }) || []
    );
  }, [dynamicCommunities, openStatuses, memberStatuses]);

  useEffect(() => {
    if (allowedCommunities.length > 0 && !activeCommunity) {
      setActiveCommunity(allowedCommunities[0]);
    }
  }, [allowedCommunities, activeCommunity]);

  const handleUpdateBalance = (contractAddress: string, balance: number) => {
    setTokenBalances(prev => {
      if (prev[contractAddress] === balance) return prev;
      return { ...prev, [contractAddress]: balance };
    });
  };

  const activeBalance = activeCommunity ? tokenBalances[activeCommunity.contractAddress] || 0 : 0;

  const handleSaveReceipt = () => {
    if (!latestPayload || !activeCommunity) return;
    const existingReceipts = JSON.parse(localStorage.getItem("rvm_receipts") || "[]");
    const existingSessionIndex = existingReceipts.findIndex(
      (r: any) =>
        r.community.contractAddress === activeCommunity.contractAddress &&
        r.payload.nonce === latestPayload.nonce &&
        r.status === "pending",
    );
    const currentDate = new Date().toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
    if (existingSessionIndex >= 0) {
      existingReceipts[existingSessionIndex].payload = latestPayload;
      existingReceipts[existingSessionIndex].date = currentDate;
    } else {
      existingReceipts.unshift({
        id: Date.now(),
        payload: latestPayload,
        community: activeCommunity,
        date: currentDate,
        status: "pending",
      });
    }
    localStorage.setItem("rvm_receipts", JSON.stringify(existingReceipts));
    alert("Struk berhasil disimpan!");
    clearPayload();
  };

  if (!mounted) return null;

  // JIKA WALLET MODE KOSONG -> MUTLAK MUNCULKAN LANDING PAGE
  if (walletMode === null) {
    return <LandingPage onBypass={handleBypass} />;
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="rvm-root min-h-screen bg-[#F2F4F7] flex items-start justify-center pt-6 pb-24 px-4">
        <div className="w-full max-w-[390px] anim-slide-up">
          {/* ── Top bar ──────────────────────────────────────────────────── */}
          <div className="flex items-center justify-between mb-4 px-1">
            <div>
              <p className="rvm-mono text-[10px] text-gray-400 tracking-widest uppercase">RVM Protocol</p>
              <p className="text-[13px] font-semibold text-gray-700">
                {userAddress ? shortenAddress(userAddress) : "Dompet Sementara"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <BleStatusPill status={status} />
              {isLocalNetwork && <FaucetButton />}
            </div>
          </div>

          {/* ── Balance card ─────────────────────────────────────────────── */}
          <div
            className="relative rounded-3xl overflow-hidden mb-4"
            style={{
              background: "linear-gradient(135deg, #0f172a 0%, #134e4a 60%, #065f46 100%)",
              boxShadow: "0 20px 60px -12px rgba(6,95,70,0.45)",
            }}
          >
            {/* Subtle texture overlay */}
            <div
              className="absolute inset-0 opacity-[0.04]"
              style={{
                backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
                backgroundSize: "24px 24px",
              }}
            />
            {/* Glow top-right */}
            <div
              className="absolute -top-16 -right-16 w-56 h-56 rounded-full opacity-20"
              style={{ background: "radial-gradient(circle, #34d399, transparent 70%)" }}
            />

            <div className="relative z-10 p-6 pb-5">
              {/* Avatar + wallet connect */}
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl ring-2 ring-white/20 overflow-hidden bg-white/10 flex items-center justify-center">
                    {userAddress ? (
                      <BlockieAvatar address={userAddress} size={40} />
                    ) : (
                      <span className="text-white/50 text-lg">👤</span>
                    )}
                  </div>
                  <div>
                    <p className="text-white/50 text-[10px] rvm-mono tracking-widest uppercase">Dompet</p>
                    <p className="text-white text-xs font-semibold rvm-mono">
                      {userAddress ? shortenAddress(userAddress) : "Burner"}
                    </p>
                  </div>
                </div>

                {/* [PERBAIKAN ISSUE 3]: Logika Tombol Dinamis */}
                <div className="flex justify-end origin-right">
                  {!isConnected ? (
                    <div className="scale-[0.8] origin-right">
                      <RainbowKitCustomConnectButton />
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setWalletMode(null);
                        disconnect();
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-red-500/80 text-white/70 hover:text-white rounded-xl text-xs font-semibold transition-all border border-white/10 hover:border-red-500"
                    >
                      <svg
                        className="w-3.5 h-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2.5}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                        />
                      </svg>
                      Keluar
                    </button>
                  )}
                </div>
              </div>

              {/* Balance */}
              <div className="mb-5">
                <p className="text-white/40 text-[11px] font-medium tracking-widest uppercase mb-1">
                  Saldo {activeCommunity?.symbol || "Token"}
                </p>
                <div className="flex items-end gap-2">
                  <span className="text-5xl font-bold text-white leading-none tracking-tight">
                    {activeBalance.toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span className="text-emerald-400 text-base font-semibold mb-1">
                    {activeCommunity?.symbol || "RVM"}
                  </span>
                </div>
              </div>

              {/* Network pill */}
              <div className="inline-flex items-center gap-1.5 bg-white/10 backdrop-blur-sm rounded-full px-3 py-1.5 border border-white/10">
                <span className="w-2 h-2 rounded-full bg-purple-400 shadow-[0_0_6px_rgba(192,132,252,0.8)]" />
                <span className="text-white/70 text-[10px] rvm-mono tracking-wider">Polygon PoS · MATIC</span>
              </div>
            </div>
          </div>

          {/* ── Community selector ───────────────────────────────────────── */}
          <div className="bg-white rounded-2xl p-4 mb-3 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
            <p className="text-[10px] font-semibold text-gray-400 tracking-widest uppercase mb-3">Komunitas RVM</p>
            <CommunitySelector
              communities={allowedCommunities}
              active={activeCommunity}
              onChange={setActiveCommunity}
              isLoading={isLoading || !dynamicCommunities}
            />
          </div>

          {/* ── Asset list ───────────────────────────────────────────────── */}
          <div className="bg-white rounded-2xl shadow-[0_1px_4px_rgba(0,0,0,0.06)] overflow-hidden">
            <div className="px-4 pt-4 pb-3 flex items-center justify-between border-b border-gray-50">
              <p className="text-[10px] font-semibold text-gray-400 tracking-widest uppercase">Aset Reward</p>
              <span className="rvm-mono text-[10px] text-gray-300">{dynamicCommunities?.length ?? 0} token</span>
            </div>

            {isLoading || !dynamicCommunities ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="w-10 h-10 rounded-2xl flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-3 w-20" />
                      <Skeleton className="h-2.5 w-32" />
                    </div>
                    <Skeleton className="h-4 w-16" />
                  </div>
                ))}
              </div>
            ) : dynamicCommunities.length === 0 ? (
              <div className="py-12 text-center">
                <div className="text-3xl mb-3">🗑️</div>
                <p className="text-sm font-medium text-gray-500">Belum ada token terdaftar</p>
                <p className="text-xs text-gray-300 mt-1">Hubungi admin komunitas</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {dynamicCommunities.map((comm: any, idx: number) => {
                  const isOpen = openStatuses?.[idx]?.result !== false;
                  const isMember = memberStatuses?.[idx]?.result === true;
                  return (
                    <TokenRow
                      key={idx}
                      community={comm}
                      isOpen={isOpen}
                      isMember={isMember}
                      userAddress={userAddress}
                      onUpdateBalance={handleUpdateBalance}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Receipt bottom sheet ──────────────────────────────────────────── */}
      {latestPayload && (
        <div className="fixed inset-0 z-[9999] anim-fade" style={{ background: "rgba(15,23,42,0.5)" }}>
          {/* Backdrop */}
          <div className="absolute inset-0" onClick={clearPayload} />

          {/* Sheet */}
          <div
            className="absolute bottom-0 left-0 right-0 rounded-t-[28px] bg-white anim-slide-up"
            style={{ boxShadow: "0 -8px 40px rgba(0,0,0,0.15)" }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-gray-200" />
            </div>

            <div className="px-6 pt-2 pb-10">
              {/* Header */}
              <div className="flex items-start justify-between mb-6 mt-2">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 tracking-tight">Setoran Diterima</h2>
                  <p className="text-sm text-gray-400 mt-0.5">Pilih komunitas, lalu simpan struk</p>
                </div>
                <button
                  onClick={clearPayload}
                  className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 hover:bg-gray-200 transition-colors flex-shrink-0 mt-0.5"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="bg-blue-50 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">♻️</span>
                    <span className="text-[10px] font-bold text-blue-400 tracking-widest uppercase">Plastik</span>
                  </div>
                  <p className="text-3xl font-bold text-blue-700">{latestPayload.plastic}</p>
                  <p className="text-xs text-blue-400 mt-0.5">botol</p>
                </div>
                <div className="bg-slate-50 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">🥤</span>
                    <span className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">Metal</span>
                  </div>
                  <p className="text-3xl font-bold text-slate-700">{latestPayload.metal}</p>
                  <p className="text-xs text-slate-400 mt-0.5">kaleng</p>
                </div>
              </div>

              {/* Community select */}
              <div className="mb-5">
                <p className="text-[10px] font-semibold text-gray-400 tracking-widest uppercase mb-2">Komunitas</p>
                <select
                  className="w-full h-12 px-4 rounded-2xl border border-gray-200 bg-gray-50 text-sm font-semibold text-gray-800 appearance-none focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                  value={activeCommunity?.contractAddress || ""}
                  onChange={e => {
                    const selected = allowedCommunities?.find((c: any) => c.contractAddress === e.target.value);
                    if (selected) setActiveCommunity(selected);
                  }}
                >
                  {allowedCommunities?.map((comm: any, idx: number) => (
                    <option key={idx} value={comm.contractAddress}>
                      {comm.name} ({comm.symbol})
                    </option>
                  ))}
                </select>
              </div>

              {/* Action */}
              <button
                onClick={handleSaveReceipt}
                disabled={!activeCommunity}
                className="w-full h-14 rounded-2xl text-sm font-bold text-white tracking-wide transition-all
                  disabled:opacity-40 disabled:cursor-not-allowed
                  active:scale-[0.98]"
                style={{
                  background: "linear-gradient(135deg, #059669, #047857)",
                  boxShadow: "0 8px 24px -4px rgba(5,150,105,0.45)",
                }}
              >
                Simpan Struk — Gratis
              </button>

              <p className="text-center text-[11px] text-gray-300 mt-3 rvm-mono">
                Klaim reward kapan saja dari menu Riwayat
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── TokenRow ─────────────────────────────────────────────────────────────────
function TokenRow({
  community,
  isOpen,
  isMember,
  userAddress,
  onUpdateBalance,
}: {
  community: any;
  isOpen: boolean;
  isMember: boolean;
  userAddress: string | undefined;
  onUpdateBalance: (addr: string, bal: number) => void;
}) {
  const { data: marketTokenAddress } = useReadContract({
    address: community.contractAddress,
    abi: [
      { inputs: [], name: "marketToken", outputs: [{ type: "address" }], stateMutability: "view", type: "function" },
    ],
    functionName: "marketToken",
  });

  const balanceTarget =
    !marketTokenAddress || marketTokenAddress === "0x0000000000000000000000000000000000000000"
      ? community.contractAddress
      : marketTokenAddress;

  const { data: balance } = useReadContract({
    address: balanceTarget as `0x${string}`,
    abi: [
      {
        inputs: [{ name: "account", type: "address" }],
        name: "balanceOf",
        outputs: [{ name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function",
      },
    ],
    functionName: "balanceOf",
    args: [userAddress as `0x${string}`],
    query: { enabled: !!userAddress },
  });

  const formattedBalance = balance ? Number(balance) / 1e18 : 0;

  useEffect(() => {
    onUpdateBalance(community.contractAddress, formattedBalance);
  }, [formattedBalance, community.contractAddress]); // eslint-disable-line react-hooks/exhaustive-deps

  // Privacy: hide closed communities the user doesn't belong to (with zero balance)
  if (!isOpen && !isMember && formattedBalance === 0) return null;

  // Generate a consistent hue from symbol string
  const hue = community.symbol
    ? community.symbol.split("").reduce((acc: number, c: string) => acc + c.charCodeAt(0), 0) % 360
    : 160;

  const initial = community.symbol?.charAt(0).toUpperCase() ?? "T";

  return (
    <div className="flex items-center gap-4 px-4 py-3.5 hover:bg-gray-50/80 transition-colors cursor-default">
      {/* Token avatar */}
      <div
        className="w-10 h-10 rounded-2xl flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
        style={{
          background: `hsl(${hue}, 55%, 40%)`,
          boxShadow: `0 2px 8px hsla(${hue}, 55%, 40%, 0.3)`,
        }}
      >
        {initial}
      </div>

      {/* Name */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold text-gray-900 truncate">{community.symbol}</span>
          {!isOpen && (
            <span className="inline-flex items-center text-[9px] font-bold tracking-widest uppercase bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded-md">
              🔒 Privat
            </span>
          )}
        </div>
        <p className="text-[11px] text-gray-400 truncate mt-0.5">{community.name}</p>
      </div>

      {/* Balance */}
      <div className="text-right flex-shrink-0">
        <p className="text-sm font-bold text-gray-900 rvm-mono">
          {formattedBalance.toLocaleString("id-ID", { maximumFractionDigits: 4 })}
        </p>
        <p className="text-[10px] text-gray-400 rvm-mono">
          ${formattedBalance.toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
      </div>
    </div>
  );
}
