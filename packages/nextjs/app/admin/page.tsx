"use client";

import { useState } from "react";
import { useAccount, useReadContract, useReadContracts, useWriteContract } from "wagmi";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";

// =========================================================================
// ABI Global untuk Kontrak Komunitas (CommunityRVM)
// =========================================================================
const communityAbi = [
  { inputs: [], name: "lifetimePlastic", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "lifetimeMetal", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "marketToken", outputs: [{ type: "address" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "isOpenCommunity", outputs: [{ type: "bool" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "dailyCapacityLimit", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" },
  {
    inputs: [],
    name: "getCommunityDevices",
    outputs: [{ type: "address[]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ type: "address" }],
    name: "assignDeviceToCommunity",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ type: "address" }, { type: "bool" }],
    name: "registerMember",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ type: "uint256" }],
    name: "updateDailyCapacityLimit",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ type: "uint256" }, { type: "uint256" }],
    name: "updateRewardRates",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

// =========================================================================
// Helper: warna token dari hash simbol
// =========================================================================
function tokenHue(symbol: string): number {
  let hash = 0;
  for (let i = 0; i < symbol.length; i++) {
    hash = symbol.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % 360;
}

export default function AdminDashboard() {
  const { address: userAddress } = useAccount();

  // State Pendaftaran Komunitas & Operasional Lokal
  const [communityName, setCommunityName] = useState("");
  const [plasticRate, setPlasticRate] = useState("");
  const [metalRate, setMetalRate] = useState("");
  const [tokenModel, setTokenModel] = useState<"custom" | "market">("custom");
  const [tokenSymbol, setTokenSymbol] = useState("");
  const [marketTokenAddress, setMarketTokenAddress] = useState("");
  const [isOpenCommunity, setIsOpenCommunity] = useState(true);

  // State Manajemen Komunitas (Satu Pintu)
  const [manageCommunityAddr, setManageCommunityAddr] = useState("");
  const [deviceAddress, setDeviceAddress] = useState("");
  const [memberAddress, setMemberAddress] = useState("");
  const [newCapacity, setNewCapacity] = useState("");
  const [newPlasticRate, setNewPlasticRate] = useState("");
  const [newMetalRate, setNewMetalRate] = useState("");

  // [STATE BARU]: Input Whitelist Perangkat Global ke Sistem Pusat
  const [systemHardwareAddress, setSystemHardwareAddress] = useState("");

  // =========================================================================
  // HOOKS PABRIK (RVMFactory)
  // =========================================================================
  const { writeContractAsync: factoryWrite, isPending: isCreating } = useScaffoldWriteContract({
    contractName: "RVMFactory",
  });

  const { data: superAdminAddress } = useScaffoldReadContract({
    contractName: "RVMFactory",
    functionName: "superAdmin",
  });

  const { data: globalSystemDevices } = useScaffoldReadContract({
    contractName: "RVMFactory",
    functionName: "getSystemDevices",
  });

  const { data: deployedCommunities, isLoading: isReading } = useScaffoldReadContract({
    contractName: "RVMFactory",
    functionName: "getAllCommunityDetails",
  });

  // =========================================================================
  // LOGIKA PRIVASI & OTORITAS
  // =========================================================================
  // Cek apakah user yang login adalah Pemilik Sistem Jaringan (Deployer)
  const isSuperAdmin =
    userAddress && superAdminAddress && userAddress.toLowerCase() === superAdminAddress.toLowerCase();

  // Filter HANYA komunitas milik user yang sedang aktif
  const myCommunities =
    deployedCommunities?.filter((c: any) => userAddress && c.owner.toLowerCase() === userAddress.toLowerCase()) || [];

  const { data: openStatuses } = useReadContracts({
    contracts: myCommunities.map((c: any) => ({
      address: c.contractAddress as `0x${string}`,
      abi: communityAbi,
      functionName: "isOpenCommunity",
    })),
  });

  const selectedIndex = myCommunities.findIndex((c: any) => c.contractAddress === manageCommunityAddr);
  const isSelectedClosed =
    selectedIndex !== undefined && selectedIndex >= 0 ? openStatuses?.[selectedIndex]?.result === false : false;

  const { writeContractAsync: writeCommunityTx, isPending: isCommunityTxPending } = useWriteContract();

  // =========================================================================
  // HANDLERS
  // =========================================================================

  // 1. Whitelist Mesin ke Sistem Pusat (Hanya Super Admin)
  const handleRegisterHardwareToSystem = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!systemHardwareAddress) return;
    try {
      await factoryWrite({
        functionName: "registerHardwareToSystem",
        args: [systemHardwareAddress as `0x${string}`, true],
      });
      setSystemHardwareAddress("");
      alert("🚀 Sukses! Perangkat keras resmi diakui di Jaringan Pusat RVM!");
    } catch (error) {
      console.error(error);
    }
  };

  // 2. Mendirikan Komunitas Baru
  const handleCreateCommunity = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!communityName || (!tokenSymbol && tokenModel === "custom")) return;
    try {
      await factoryWrite({
        functionName: "createCommunity",
        args: [
          communityName,
          tokenModel === "custom" ? tokenSymbol : "USDT",
          BigInt(plasticRate === "" ? "0" : plasticRate),
          BigInt(metalRate === "" ? "0" : metalRate),
          isOpenCommunity,
          tokenModel === "market" && marketTokenAddress !== ""
            ? marketTokenAddress
            : "0x0000000000000000000000000000000000000000",
        ],
      });
      setCommunityName("");
      setTokenSymbol("");
      setMarketTokenAddress("");
      setPlasticRate("");
      setMetalRate("");
    } catch (error) {
      console.error(error);
    }
  };

  // 3. Menautkan perangkat sistem ke dalam komunitas lokal
  const handleAssignDeviceToCommunity = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!manageCommunityAddr || !deviceAddress) return;
    try {
      await writeCommunityTx({
        address: manageCommunityAddr as `0x${string}`,
        abi: communityAbi,
        functionName: "assignDeviceToCommunity",
        args: [deviceAddress as `0x${string}`],
      });
      setDeviceAddress("");
      alert("🔗 Perangkat Berhasil Ditautkan ke Komunitas Anda!");
    } catch (error) {
      console.error(error);
      alert("❌ Gagal! Pastikan perangkat ini sudah disahkan oleh Pusat (Super Admin).");
    }
  };

  // 4. Update Limit, Rate, dan Member
  const handleUpdateCapacity = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!manageCommunityAddr || !newCapacity) return;
    try {
      await writeCommunityTx({
        address: manageCommunityAddr as `0x${string}`,
        abi: communityAbi,
        functionName: "updateDailyCapacityLimit",
        args: [BigInt(newCapacity)],
      });
      setNewCapacity("");
      alert("✅ Kapasitas Harian Mesin Berhasil Diperbarui!");
    } catch (error) {
      console.error(error);
    }
  };

  const handleUpdateRates = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!manageCommunityAddr || !newPlasticRate || !newMetalRate) return;
    try {
      await writeCommunityTx({
        address: manageCommunityAddr as `0x${string}`,
        abi: communityAbi,
        functionName: "updateRewardRates",
        args: [BigInt(newPlasticRate), BigInt(newMetalRate)],
      });
      setNewPlasticRate("");
      setNewMetalRate("");
      alert("✅ Tarif Reward Berhasil Diperbarui!");
    } catch (error) {
      console.error(error);
    }
  };

  const handleRegisterMember = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!manageCommunityAddr || !memberAddress) return;
    try {
      await writeCommunityTx({
        address: manageCommunityAddr as `0x${string}`,
        abi: communityAbi,
        functionName: "registerMember",
        args: [memberAddress as `0x${string}`, true],
      });
      setMemberAddress("");
      alert("✅ Warga berhasil didaftarkan!");
    } catch (error) {
      console.error(error);
    }
  };

  // =========================================================================
  // RENDER UI
  // =========================================================================
  if (!userAddress) {
    return (
      <div className="min-h-screen bg-[#F2F4F7] flex items-center justify-center p-4 rvm-root">
        <div className="bg-white p-8 rounded-3xl shadow-[0_1px_4px_rgba(0,0,0,0.06)] border border-gray-100 text-center max-w-md">
          <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-[#111827] mb-2">Akses Terkunci</h2>
          <p className="text-sm text-[#6b7280]">Harap hubungkan dompet Web3 Anda untuk mengakses Panel Admin.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F2F4F7] text-[#111827] rvm-root pb-20 pt-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* ========================================================================= */}
        {/* 1. PANEL SUPER ADMIN (HANYA MUNCUL JIKA USER = DEPLOYER) */}
        {/* ========================================================================= */}
        {isSuperAdmin && (
          <div className="relative bg-[linear-gradient(135deg,#0f172a_0%,#134e4a_60%,#065f46_100%)] bg-[radial-gradient(circle,rgba(255,255,255,0.08)_1px,transparent_1px)] bg-[length:24px_24px] text-white rounded-3xl p-6 md:p-8 mb-8 shadow-[0_0_30px_rgba(5,150,105,0.2)] border border-emerald-800/30 overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-500/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                  <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-bold tracking-wide">Pusat Jaringan RVM (Global)</h3>
                  <p className="text-xs text-[#9ca3af]">Otoritas Root Sistem DePIN</p>
                </div>
              </div>
              <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider border border-emerald-500/30">
                Super Admin
              </span>
            </div>

            <p className="text-sm text-[#d1d5db] mb-6 max-w-2xl leading-relaxed">
              Daftarkan <span className="rvm-mono text-white">Public Key</span> perangkat keras ESP32 resmi di sini.
              Hanya perangkat yang terdaftar di jaringan pusat ini yang dapat diadopsi oleh cabang komunitas.
            </p>

            <form onSubmit={handleRegisterHardwareToSystem} className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                className="input w-full flex-1 bg-white/5 border border-white/10 rounded-2xl h-11 text-sm rvm-mono text-white placeholder-[#9ca3af] focus:border-info focus:outline-none transition-all"
                placeholder="0x... (Alamat Publik ESP32)"
                value={systemHardwareAddress}
                onChange={e => setSystemHardwareAddress(e.target.value)}
                required
              />
              <button
                type="submit"
                className="btn border-none text-white font-bold rounded-2xl h-11 min-h-0 px-8 bg-[linear-gradient(135deg,#059669,#047857)] shadow-[0_6px_20px_-4px_rgba(5,150,105,0.4)] hover:shadow-[0_6px_20px_-4px_rgba(5,150,105,0.6)] transition-all"
                disabled={isCreating}
              >
                {isCreating ? <span className="loading loading-spinner loading-xs"></span> : "Sahkan Hardware"}
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-white/10">
              <p className="text-xs font-bold text-[#9ca3af] uppercase tracking-wider mb-3">
                Hardware Terverifikasi Global ({globalSystemDevices?.length || 0})
              </p>
              <div className="flex flex-wrap gap-2">
                {globalSystemDevices && globalSystemDevices.length > 0 ? (
                  globalSystemDevices.map((dev: string, i: number) => (
                    <span
                      key={i}
                      className="bg-white/5 text-[#d1d5db] rvm-mono text-[11px] px-3 py-1.5 rounded-lg border border-white/10 flex items-center gap-2"
                    >
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_4px_#10b981]"></span>
                      {dev.slice(0, 6)}...{dev.slice(-4)}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-[#9ca3af] italic">Belum ada perangkat yang didaftarkan.</span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 2. ADD RVM COMMUNITY BOX */}
        {/* ========================================================================= */}
        <div className="bg-white rounded-3xl shadow-[0_1px_4px_rgba(0,0,0,0.06)] border border-gray-100 p-6 md:p-8 mb-8">
          <h3 className="text-xl font-bold text-[#111827] mb-6 flex items-center gap-2">
            <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Dirikan Komunitas Baru
          </h3>
          <form onSubmit={handleCreateCommunity} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="text-xs font-bold text-[#6b7280] uppercase tracking-wide">Nama Komunitas</label>
                <input
                  type="text"
                  className="input w-full mt-1.5 bg-gray-50 border border-gray-200 rounded-2xl h-11 text-sm focus:border-info focus:bg-white transition-all"
                  placeholder="Contoh: Bank Sampah Teknik"
                  value={communityName}
                  onChange={e => setCommunityName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#6b7280] uppercase tracking-wide">Sifat Komunitas</label>
                <div className="flex gap-3 mt-1.5 h-11 items-center">
                  <label
                    className={`flex items-center justify-center gap-2 cursor-pointer border px-4 py-2 rounded-xl flex-1 transition-all ${isOpenCommunity ? "bg-blue-50 border-blue-200 text-blue-700" : "bg-gray-50 border-gray-200 text-[#6b7280] hover:border-gray-300"}`}
                  >
                    <input
                      type="radio"
                      name="access"
                      className="hidden"
                      checked={isOpenCommunity === true}
                      onChange={() => setIsOpenCommunity(true)}
                    />
                    <span className="text-sm font-semibold">Publik</span>
                  </label>
                  <label
                    className={`flex items-center justify-center gap-2 cursor-pointer border px-4 py-2 rounded-xl flex-1 transition-all ${!isOpenCommunity ? "bg-orange-50 border-orange-200 text-orange-700" : "bg-gray-50 border-gray-200 text-[#6b7280] hover:border-gray-300"}`}
                  >
                    <input
                      type="radio"
                      name="access"
                      className="hidden"
                      checked={isOpenCommunity === false}
                      onChange={() => setIsOpenCommunity(false)}
                    />
                    <span className="text-sm font-semibold">Privat</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="text-xs font-bold text-[#6b7280] uppercase tracking-wide">Model Token Reward</label>
                <select
                  className="select select-bordered w-full mt-1.5 bg-gray-50 border border-gray-200 rounded-2xl h-11 min-h-0 text-sm focus:border-info focus:bg-white transition-all"
                  value={tokenModel}
                  onChange={e => setTokenModel(e.target.value as any)}
                >
                  <option value="custom">Cetak Token Sendiri (Custom)</option>
                  <option value="market">Gunakan Token Pasar (USDT)</option>
                </select>
              </div>

              {tokenModel === "custom" ? (
                <div>
                  <label className="text-xs font-bold text-[#6b7280] uppercase tracking-wide">Simbol Token</label>
                  <input
                    type="text"
                    className="input w-full mt-1.5 bg-gray-50 border border-gray-200 rounded-2xl h-11 text-sm focus:border-info focus:bg-white transition-all"
                    placeholder="Contoh: PLAST"
                    value={tokenSymbol}
                    onChange={e => setTokenSymbol(e.target.value)}
                    required
                  />
                </div>
              ) : (
                <div>
                  <label className="text-xs font-bold text-[#6b7280] uppercase tracking-wide">
                    Alamat Smart Contract USDT
                  </label>
                  <input
                    type="text"
                    className="input w-full mt-1.5 bg-gray-50 border border-gray-200 rounded-2xl h-11 text-sm rvm-mono focus:border-info focus:bg-white transition-all"
                    placeholder="0x..."
                    value={marketTokenAddress}
                    onChange={e => setMarketTokenAddress(e.target.value)}
                    required
                  />
                </div>
              )}
            </div>

            <div className="flex gap-5">
              <div className="w-1/2">
                <label className="text-xs font-bold text-[#6b7280] uppercase tracking-wide">Reward Plastik</label>
                <input
                  type="number"
                  className="input w-full mt-1.5 bg-gray-50 border border-gray-200 rounded-2xl h-11 text-sm focus:border-info focus:bg-white transition-all"
                  placeholder="Poin per item"
                  value={plasticRate}
                  onChange={e => setPlasticRate(e.target.value)}
                  required
                />
              </div>
              <div className="w-1/2">
                <label className="text-xs font-bold text-[#6b7280] uppercase tracking-wide">Reward Metal</label>
                <input
                  type="number"
                  className="input w-full mt-1.5 bg-gray-50 border border-gray-200 rounded-2xl h-11 text-sm focus:border-info focus:bg-white transition-all"
                  placeholder="Poin per item"
                  value={metalRate}
                  onChange={e => setMetalRate(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="btn border-none text-white font-bold rounded-2xl h-11 min-h-0 px-8 bg-[linear-gradient(135deg,#059669,#047857)] shadow-[0_6px_20px_-4px_rgba(5,150,105,0.4)] hover:shadow-[0_6px_20px_-4px_rgba(5,150,105,0.6)] transition-all"
                disabled={isCreating}
              >
                {isCreating ? <span className="loading loading-spinner loading-xs"></span> : "Buat Komunitas"}
              </button>
            </div>
          </form>
        </div>

        {/* ========================================================================= */}
        {/* 3. MANAGE COMMUNITY BOX */}
        {/* ========================================================================= */}
        <div className="bg-white rounded-3xl shadow-[0_1px_4px_rgba(0,0,0,0.06)] border border-gray-100 p-6 md:p-8 mb-8">
          <h3 className="text-xl font-bold text-[#111827] mb-6 flex items-center gap-2">
            <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Panel Kendali Komunitas
          </h3>

          <div className="mb-6">
            <select
              className="select select-bordered w-full bg-gray-50 border border-gray-200 rounded-2xl h-12 text-sm font-semibold text-[#111827] focus:border-info focus:outline-none"
              value={manageCommunityAddr}
              onChange={e => setManageCommunityAddr(e.target.value)}
            >
              <option value="" disabled>
                -- Pilih Komunitas Anda --
              </option>
              {myCommunities.length > 0 ? (
                myCommunities.map((community: any, index: number) => {
                  const isClosed = openStatuses?.[index]?.result === false;
                  return (
                    <option key={index} value={community.contractAddress}>
                      {community.name} {isClosed ? "(Privat)" : "(Publik)"}
                    </option>
                  );
                })
              ) : (
                <option disabled>Belum ada komunitas yang Anda buat</option>
              )}
            </select>
          </div>

          {manageCommunityAddr && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-[fadeIn_0.3s_ease-in-out]">
              {/* Card Assign Device */}
              <div className="p-5 bg-gray-50 border border-gray-100 rounded-2xl flex flex-col justify-between hover:border-emerald-200 transition-colors">
                <div>
                  <h4 className="font-bold text-[#111827] mb-1 flex items-center gap-1.5">
                    <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                      />
                    </svg>
                    Tautkan Mesin
                  </h4>
                  <p className="text-[11px] text-[#6b7280] mb-4 leading-relaxed">
                    Masukkan{" "}
                    <span className="rvm-mono bg-white px-1 py-0.5 rounded border border-gray-200">Address</span> ESP32
                    yang telah disahkan Global untuk diadopsi ke cabang ini.
                  </p>
                </div>
                <form onSubmit={handleAssignDeviceToCommunity} className="flex gap-2 mt-auto">
                  <input
                    type="text"
                    className="input w-full bg-white border border-gray-200 rounded-2xl h-10 text-xs rvm-mono focus:border-info focus:outline-none"
                    placeholder="0x..."
                    value={deviceAddress}
                    onChange={e => setDeviceAddress(e.target.value)}
                    required
                  />
                  <button
                    type="submit"
                    className="btn border-none text-white font-bold rounded-2xl h-10 min-h-0 px-4 bg-[linear-gradient(135deg,#059669,#047857)] shadow-[0_6px_20px_-4px_rgba(5,150,105,0.4)] hover:shadow-[0_6px_20px_-4px_rgba(5,150,105,0.6)] transition-all"
                    disabled={isCommunityTxPending}
                  >
                    Tautkan
                  </button>
                </form>
              </div>

              {/* Card Update Limit Harian */}
              <div className="p-5 bg-gray-50 border border-gray-100 rounded-2xl flex flex-col justify-between hover:border-emerald-200 transition-colors">
                <div>
                  <h4 className="font-bold text-[#111827] mb-1">Kapasitas Harian Mesin</h4>
                  <p className="text-[11px] text-[#6b7280] mb-4 leading-relaxed">
                    Ubah batas maksimal botol per hari untuk mencegah eksploitasi di luar kapasitas fisik tong.
                  </p>
                </div>
                <form onSubmit={handleUpdateCapacity} className="flex gap-2 mt-auto">
                  <input
                    type="number"
                    className="input w-full bg-white border border-gray-200 rounded-2xl h-10 text-xs focus:border-info focus:outline-none"
                    placeholder="Contoh: 500"
                    value={newCapacity}
                    onChange={e => setNewCapacity(e.target.value)}
                    required
                  />
                  <button
                    type="submit"
                    className="btn border-none text-white font-bold rounded-2xl h-10 min-h-0 px-4 bg-[linear-gradient(135deg,#059669,#047857)] shadow-[0_6px_20px_-4px_rgba(5,150,105,0.4)] hover:shadow-[0_6px_20px_-4px_rgba(5,150,105,0.6)] transition-all"
                    disabled={isCommunityTxPending}
                  >
                    Update
                  </button>
                </form>
              </div>

              {/* Card Update Tarif Reward */}
              <div className="p-5 bg-gray-50 border border-gray-100 rounded-2xl md:col-span-2 hover:border-emerald-200 transition-colors">
                <div className="mb-4">
                  <h4 className="font-bold text-[#111827] mb-1">Ubah Tarif Reward</h4>
                  <p className="text-[11px] text-[#6b7280]">
                    Sesuaikan nilai insentif per botol secara dinamis tanpa mendeploy ulang kontrak.
                  </p>
                </div>
                <form onSubmit={handleUpdateRates} className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="number"
                    className="input w-full bg-white border border-gray-200 rounded-2xl h-10 text-xs focus:border-info focus:outline-none"
                    placeholder="Tarif Plastik Baru"
                    value={newPlasticRate}
                    onChange={e => setNewPlasticRate(e.target.value)}
                    required
                  />
                  <input
                    type="number"
                    className="input w-full bg-white border border-gray-200 rounded-2xl h-10 text-xs focus:border-info focus:outline-none"
                    placeholder="Tarif Metal Baru"
                    value={newMetalRate}
                    onChange={e => setNewMetalRate(e.target.value)}
                    required
                  />
                  <button
                    type="submit"
                    className="btn border-none text-white font-bold rounded-2xl h-10 min-h-0 px-6 bg-[linear-gradient(135deg,#059669,#047857)] shadow-[0_6px_20px_-4px_rgba(5,150,105,0.4)] hover:shadow-[0_6px_20px_-4px_rgba(5,150,105,0.6)] transition-all"
                    disabled={isCommunityTxPending}
                  >
                    Simpan
                  </button>
                </form>
              </div>

              {/* Card Register Member (HANYA Muncul Jika Komunitas Closed) */}
              {isSelectedClosed && (
                <div className="p-5 bg-orange-50/50 border border-orange-200 rounded-2xl md:col-span-2">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-bold text-orange-900">Registrasi Dompet Warga</h4>
                    <span className="bg-orange-100 text-orange-700 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wide border border-orange-200">
                      Mode Privat
                    </span>
                  </div>
                  <p className="text-[11px] text-orange-800/70 mb-4">
                    Komunitas ini bersifat tertutup. Hanya alamat dompet yang Anda tambahkan di bawah ini yang dapat
                    mengklaim poin.
                  </p>
                  <form onSubmit={handleRegisterMember} className="flex gap-2">
                    <input
                      type="text"
                      className="input w-full bg-white border border-orange-200 rounded-2xl h-10 text-xs rvm-mono focus:border-orange-500 focus:outline-none"
                      placeholder="0x... (Alamat Wallet Warga)"
                      value={memberAddress}
                      onChange={e => setMemberAddress(e.target.value)}
                      required
                    />
                    <button
                      type="submit"
                      className="btn border-none text-white font-bold rounded-2xl h-10 min-h-0 px-6 bg-orange-600 hover:bg-orange-700 shadow-md transition-all"
                      disabled={isCommunityTxPending}
                    >
                      Daftarkan
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* 4. STATISTIK BOX */}
        {/* ========================================================================= */}
        <div className="bg-white rounded-3xl shadow-[0_1px_4px_rgba(0,0,0,0.06)] border border-gray-100 p-6 md:p-8">
          <h3 className="text-xl font-bold text-[#111827] mb-6 flex items-center gap-2">
            <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
            Statistik Komunitas Saya
          </h3>

          {isReading ? (
            <div className="flex justify-center py-10">
              <span className="loading loading-spinner loading-xs text-emerald-600"></span>
            </div>
          ) : myCommunities.length > 0 ? (
            <div className="space-y-5">
              {myCommunities.map((community: any, index: number) => (
                <CommunityCard key={index} community={community} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-300">
              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm border border-gray-100">
                <svg className="w-6 h-6 text-[#9ca3af]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                  />
                </svg>
              </div>
              <p className="text-[#6b7280] text-sm font-medium">Anda belum mengelola komunitas apapun.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// =========================================================================
// KOMPONEN ANAK: KARTU STATISTIK KOMUNITAS
// =========================================================================
function CommunityCard({ community }: { community: any }) {
  const { data: plasticCount } = useReadContract({
    address: community.contractAddress,
    abi: communityAbi,
    functionName: "lifetimePlastic",
  });
  const { data: metalCount } = useReadContract({
    address: community.contractAddress,
    abi: communityAbi,
    functionName: "lifetimeMetal",
  });
  const { data: isOpen } = useReadContract({
    address: community.contractAddress,
    abi: communityAbi,
    functionName: "isOpenCommunity",
  });
  const { data: capacityLimit } = useReadContract({
    address: community.contractAddress,
    abi: communityAbi,
    functionName: "dailyCapacityLimit",
  });

  // PERBAIKAN: Menggunakan fungsi baru getCommunityDevices
  const { data: registeredDevices } = useReadContract({
    address: community.contractAddress,
    abi: communityAbi,
    functionName: "getCommunityDevices",
  });

  const { data: marketTokenAddr } = useReadContract({
    address: community.contractAddress,
    abi: communityAbi,
    functionName: "marketToken",
  });

  const isCustomToken = !marketTokenAddr || marketTokenAddr === "0x0000000000000000000000000000000000000000";

  const { data: poolBalance } = useReadContract({
    address: isCustomToken ? undefined : (marketTokenAddr as `0x${string}`),
    abi: [
      {
        inputs: [{ type: "address" }],
        name: "balanceOf",
        outputs: [{ type: "uint256" }],
        stateMutability: "view",
        type: "function",
      },
    ] as const,
    functionName: "balanceOf",
    args: [community.contractAddress],
  });

  const totalSampah = (Number(plasticCount || 0) + Number(metalCount || 0)).toLocaleString();
  const limitDisplay = capacityLimit ? Number(capacityLimit).toLocaleString() : "...";
  let liquidityDisplay = "...";
  let liquidityLabel = community.symbol;

  if (isCustomToken) {
    liquidityDisplay = "Unlimited";
    liquidityLabel = "Minted";
  } else if (poolBalance !== undefined) {
    liquidityDisplay = (Number(poolBalance) / 1e18).toLocaleString(undefined, { maximumFractionDigits: 2 });
    liquidityLabel = "USDT";
  }

  const devices = (registeredDevices as string[]) || [];

  const hue = tokenHue(community.symbol || "");

  return (
    <div className="bg-white p-5 rounded-2xl border border-gray-100 flex flex-col gap-5 transition-all hover:shadow-[0_1px_8px_rgba(0,0,0,0.08)] hover:border-emerald-200 group">
      <div className="flex justify-between items-start">
        <div className="flex items-start gap-3">
          {/* Token Avatar */}
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0 mt-0.5"
            style={{ backgroundColor: `hsl(${hue},55%,40%)` }}
          >
            {community.symbol ? community.symbol.charAt(0).toUpperCase() : "?"}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-bold text-lg text-[#111827]">RVM - {community.name}</h4>
              {isOpen !== undefined && (
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider border ${
                    isOpen
                      ? "bg-green-50 text-green-600 border-green-200"
                      : "bg-orange-50 text-orange-600 border-orange-200"
                  }`}
                >
                  {isOpen ? "PUBLIK" : "PRIVAT"}
                </span>
              )}
            </div>
            <div className="mt-1">
              <p className="text-[11px] rvm-mono text-[#6b7280] bg-gray-50 px-2 py-1 rounded-md border border-gray-100 inline-block">
                {community.contractAddress}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100/50 group-hover:border-blue-200 transition-colors">
          <p className="text-[10px] font-bold text-blue-500 uppercase tracking-wider mb-1">Brankas Token</p>
          <p className="text-xl font-black text-[#111827]">
            {liquidityDisplay} <span className="text-xs font-bold text-[#6b7280]">{liquidityLabel}</span>
          </p>
        </div>
        <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-100/50 group-hover:border-emerald-200 transition-colors">
          <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider mb-1">Sampah Masuk</p>
          <p className="text-xl font-black text-[#111827]">
            {totalSampah} <span className="text-xs font-bold text-[#6b7280]">Item</span>
          </p>
        </div>
        <div className="bg-purple-50/50 p-4 rounded-xl border border-purple-100/50 group-hover:border-purple-200 transition-colors">
          <p className="text-[10px] font-bold text-purple-500 uppercase tracking-wider mb-1">Kapasitas</p>
          <p className="text-xl font-black text-[#111827]">
            {limitDisplay} <span className="text-xs font-bold text-[#6b7280]">/Hari</span>
          </p>
        </div>
      </div>

      <div className="pt-4 border-t border-gray-100">
        <p className="text-[10px] font-bold text-[#9ca3af] uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5 text-[#9ca3af]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
            />
          </svg>
          Mesin Aktif Ditautkan ({devices.length})
        </p>
        <div className="flex flex-wrap gap-2">
          {devices.length > 0 ? (
            devices.map((device, i) => (
              <span
                key={i}
                className="bg-gray-50 text-[#6b7280] text-[11px] rvm-mono px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm flex items-center gap-2"
              >
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_4px_#10b981]"></span>
                {device.slice(0, 6)}...{device.slice(-4)}
              </span>
            ))
          ) : (
            <span className="text-xs text-[#9ca3af] italic bg-gray-50 px-3 py-2 rounded-lg border border-gray-100">
              Belum ada mesin yang ditautkan ke cabang ini.
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
