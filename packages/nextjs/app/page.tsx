"use client";

import { useEffect, useState, useMemo } from "react";
import { hardhat } from "viem/chains";
import { useAccount, useReadContract, useReadContracts } from "wagmi";
import { BlockieAvatar, FaucetButton, RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";
import { useTargetNetwork } from "~~/hooks/scaffold-eth";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";
import { useBleStore } from "~~/services/store/useBLEstore";
import { useLocalStorage } from "usehooks-ts";
import LandingPage from "~~/components/LandingPage";

// [UPDATE] ABI: Tambahkan fungsi isMember agar bisa dibaca massal
const communityAbi = [
  { inputs: [], name: "isOpenCommunity", outputs: [{ type: "bool" }], stateMutability: "view", type: "function" },
  {
    inputs: [{ name: "account", type: "address" }],
    name: "isMember",
    outputs: [{ type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

export default function Home() {
  const { targetNetwork } = useTargetNetwork();
  const isLocalNetwork = targetNetwork.id === hardhat.id;
  const { address: userAddress, isConnected } = useAccount();

  const [activeCommunity, setActiveCommunity] = useState<any>(null);
  const [tokenBalances, setTokenBalances] = useState<Record<string, number>>({});
  const { status, latestPayload, clearPayload } = useBleStore();

  // [LOGIKA PENJAGA PINTU (ONBOARDING GATEWAY)]
  const [walletMode, setWalletMode] = useLocalStorage<"real" | "burner" | null>("rvm_wallet_mode", null);
  const [showOnboarding, setShowOnboarding] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isConnected && walletMode === "real") {
      setShowOnboarding(false);
    }
  }, [isConnected, walletMode]);



  // 1. Fetch Daftar Komunitas dari Factory
  const { data: dynamicCommunities, isLoading } = useScaffoldReadContract({
    contractName: "RVMFactory",
    functionName: "getAllCommunityDetails",
  });

  // 2a. Fetch Status Open/Closed untuk SEMUA Komunitas sekaligus (Batch Read)
  const { data: openStatuses } = useReadContracts({
    contracts: (dynamicCommunities || []).map((c: any) => ({
      address: c.contractAddress as `0x${string}`,
      abi: communityAbi,
      functionName: "isOpenCommunity",
    })),
  });

  // 2b. [TAMBAHAN] Fetch Status isMember untuk SEMUA Komunitas sekaligus
  const { data: memberStatuses } = useReadContracts({
    contracts: (dynamicCommunities || []).map((c: any) => ({
      address: c.contractAddress as `0x${string}`,
      abi: communityAbi,
      functionName: "isMember",
      args: [(userAddress as `0x${string}`) || "0x0000000000000000000000000000000000000000"],
    })),
  });

  // 3. [UPDATE] Filter Komunitas yang BISA DIPILIH (Open ATAU user terdaftar di whitelist)
  const allowedCommunities = useMemo(() => {
    return dynamicCommunities?.filter((comm: any, idx: number) => {
      const isOpen = openStatuses?.[idx]?.result !== false; // Default true jika loading
      const isUserMember = memberStatuses?.[idx]?.result === true;
      return isOpen || isUserMember;
    }) || [];
  }, [dynamicCommunities, openStatuses, memberStatuses]);

  // Set Default Dropdown ke Komunitas Pertama yang Diizinkan
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

  const totalBalance = Object.values(tokenBalances).reduce((acc, val) => acc + val, 0);

  const handleSaveReceipt = () => {
    if (!latestPayload || !activeCommunity) return;

    const newReceipt = {
      id: Date.now(),
      payload: latestPayload,
      community: activeCommunity,
      date: new Date().toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }),
      status: "pending",
    };

    const existingReceipts = JSON.parse(localStorage.getItem("rvm_receipts") || "[]");
    localStorage.setItem("rvm_receipts", JSON.stringify([newReceipt, ...existingReceipts]));

    console.log("📝 Struk Berhasil Disimpan ke HP!");
    alert("Struk berhasil disimpan! Silakan buka halaman Riwayat untuk mengklaim token Anda.");
    clearPayload();
  };

  const getStatusStyle = () => {
    if (status.includes("Terhubung")) return "bg-green-500/20 text-green-400 border-green-500/30";
    if (status.includes("Mencari")) return "bg-orange-500/20 text-orange-400 border-orange-500/30";
    return "bg-red-500/20 text-red-400 border-red-500/30";
  };

  if (!mounted) return null;

  if (showOnboarding && walletMode === null && !isConnected) {
    return <LandingPage onBypass={() => setShowOnboarding(false)} />;
  }

  return (
    <div className="flex flex-col items-center justify-start p-4 min-h-screen bg-base-200 pb-32 pt-8 font-sans">
      <main className="max-w-md w-full bg-white relative shadow-2xl rounded-[2rem] overflow-hidden border border-gray-200 min-h-[80vh]">
        {/* --- BAGIAN 1: HEADER GELAP --- */}
        <section className="bg-slate-900 pt-10 pb-8 px-6 flex flex-col items-center relative z-10 rounded-b-3xl shadow-md">
          <div className="w-24 h-24 rounded-full border-4 border-slate-700 bg-slate-800 flex items-center justify-center shadow-lg overflow-hidden mb-4">
            {userAddress ? (
              <BlockieAvatar address={userAddress} size={96} />
            ) : (
              <svg
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-12 h-12 text-slate-500"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
                />
              </svg>
            )}
          </div>

          <div className="text-center w-full">
            <p className="text-[10px] text-slate-400 font-bold tracking-widest mb-1">TOTAL SALDO (ESTIMASI)</p>
            <h1 className="text-4xl font-black text-white tracking-tight">
              ${totalBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h1>
          </div>

          <div className="mt-6 flex flex-col items-center w-full gap-3">
            <RainbowKitCustomConnectButton />
            {isLocalNetwork && <FaucetButton />}
            <span
              className={`px-4 py-1.5 rounded-full text-[10px] font-bold border tracking-widest flex items-center gap-2 mt-2 ${getStatusStyle()}`}
            >
              <span
                className={`w-2 h-2 rounded-full animate-pulse ${status.includes("Terhubung") ? "bg-green-400" : "bg-gray-400"}`}
              ></span>
              {status.toUpperCase()}
            </span>
          </div>
        </section>

        {/* --- BAGIAN 2: KONTEN UTAMA (WALLET) --- */}
        <section className="px-6 pt-8 pb-8">
          {/* LOKASI RVM (HANYA MENAMPILKAN KOMUNITAS YANG DIIZINKAN) */}
          <div className="bg-[#F8FAFC] p-4 rounded-2xl mb-8 border border-gray-100">
            <label className="text-[10px] text-gray-500 font-bold tracking-wider mb-2 block">
              KONEKSI KOMUNITAS RVM
            </label>
            {isLoading || !dynamicCommunities ? (
              <div className="w-full h-10 bg-gray-200 animate-pulse rounded-xl"></div>
            ) : (
              <select
                className="select select-bordered w-full bg-white text-slate-800 font-bold h-10 min-h-0 rounded-xl focus:outline-none focus:border-blue-500 shadow-sm"
                value={activeCommunity?.contractAddress || ""}
                onChange={e => {
                  const selected = allowedCommunities.find((c: any) => c.contractAddress === e.target.value);
                  if (selected) setActiveCommunity(selected);
                }}
              >
                {allowedCommunities.map((comm: any, idx: number) => (
                  <option key={idx} value={comm.contractAddress}>
                    {comm.name} ({comm.symbol})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* DAFTAR ASET TOKEN */}
          <div className="mb-3 ml-1 flex justify-between items-center">
            <p className="text-gray-400 text-[11px] font-bold tracking-wider">ASET REWARD SAYA</p>
          </div>
          <div className="space-y-2 mb-4 custom-scrollbar">
            {isLoading || !dynamicCommunities ? (
              <div className="text-center text-xs text-gray-400 py-6 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                Memuat aset...
              </div>
            ) : dynamicCommunities.length === 0 ? (
              <div className="text-center text-xs text-gray-400 py-6 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                Belum ada token RVM terdaftar.
              </div>
            ) : (
              // Melempar properti isMember ke komponen TokenRow
              dynamicCommunities.map((comm: any, idx: number) => {
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
              })
            )}
          </div>
        </section>
      </main>

      {/* ================================================================= */}
      {/* POP-UP MENYIMPAN STRUK */}
      {/* ================================================================= */}
      {latestPayload && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 transition-all">
          <div className="bg-white w-full max-w-md rounded-t-[2rem] sm:rounded-3xl p-6 pb-10 shadow-2xl animate-[slideUp_0.3s_ease-out] relative">
            {/* TOMBOL CLOSE (X) */}
            <button
              onClick={clearPayload}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-6 sm:hidden"></div>

            <div className="text-center mb-6 mt-2">
              <div className="w-16 h-16 bg-[#E1F5FE] text-[#0288D1] rounded-full mx-auto flex items-center justify-center mb-3">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                  />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-slate-900">Setoran Diterima!</h2>
              <p className="text-sm text-slate-500 mt-1">Mesin telah menghitung sampah Anda.</p>
            </div>

            <div className="flex gap-3 mb-6">
              <div className="bg-blue-50 px-4 py-3 rounded-xl border border-blue-100 flex-1 text-center">
                <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-1">Plastik</p>
                <p className="text-blue-700 font-black text-xl">
                  {latestPayload.plastic} <span className="text-sm font-normal">Botol</span>
                </p>
              </div>
              <div className="bg-slate-50 px-4 py-3 rounded-xl border border-slate-200 flex-1 text-center">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Metal</p>
                <p className="text-slate-700 font-black text-xl">
                  {latestPayload.metal} <span className="text-sm font-normal">Kaleng</span>
                </p>
              </div>
            </div>

            <div className="mb-6">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide ml-1 mb-2 block">
                Pilih Komunitas
              </label>
              <select
                className="select select-bordered w-full bg-white text-slate-800 font-bold h-12 focus:outline-none focus:border-[#0288D1]"
                value={activeCommunity?.contractAddress || ""}
                onChange={e => {
                  const selected = allowedCommunities?.find((c: any) => c.contractAddress === e.target.value);
                  if (selected) setActiveCommunity(selected);
                }}
              >
                {/* [UPDATE] HANYA MUNCULKAN KOMUNITAS YANG DIIZINKAN DI POP-UP */}
                {allowedCommunities?.map((comm: any, idx: number) => (
                  <option key={idx} value={comm.contractAddress}>
                    {comm.name} ({comm.symbol})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleSaveReceipt}
                disabled={!activeCommunity}
                className="btn w-full bg-[#0288D1] hover:bg-[#01579B] text-white border-none rounded-xl shadow-lg shadow-blue-500/30"
              >
                Simpan Struk (Gratis)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// =========================================================================
// KOMPONEN ANAK: TokenRow (Logika Hiding Privasi Ada di Sini)
// =========================================================================
function TokenRow({
  community,
  isOpen,
  isMember, // <--- Property baru
  userAddress,
  onUpdateBalance,
}: {
  community: any;
  isOpen: boolean;
  isMember: boolean; // <--- Property baru
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

  // =======================================================================
  // [UPDATE] LOGIKA PRIVASI (ACCESS CONTROL SEJATI):
  // Sembunyikan JIKA: Komunitas Closed DAN User Bukan Member DAN Saldo Nol.
  // =======================================================================
  if (!isOpen && !isMember && formattedBalance === 0) {
    return null;
  }

  const initial = community.symbol ? community.symbol.charAt(0).toUpperCase() : "T";

  return (
    <div className="flex items-center justify-between bg-white p-3 rounded-2xl border border-gray-100 shadow-sm transition-all hover:bg-slate-50">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-[#0F172A] flex items-center justify-center text-white font-bold text-sm shadow-sm">
          {initial}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-slate-800 text-sm">{community.symbol}</h3>
            {!isOpen && (
              <span className="text-[8px] bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded font-bold tracking-wider">
                PRIVATE
              </span>
            )}
          </div>
          <p className="text-[10px] text-slate-500">{community.name}</p>
        </div>
      </div>
      <div className="text-right">
        <p className="font-black text-slate-800 text-sm">
          {formattedBalance.toLocaleString(undefined, { maximumFractionDigits: 4 })}
        </p>
        <p className="text-[10px] text-slate-400 font-bold">
          ${formattedBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
      </div>
    </div>
  );
}
