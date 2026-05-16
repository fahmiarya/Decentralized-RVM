"use client";

import { useState } from "react";
import { useAccount, useReadContract, useReadContracts, useWriteContract } from "wagmi";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";

// ABI dipindah ke atas agar bisa dipakai bersama
const communityAbi = [
  { inputs: [], name: "lifetimePlastic", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "lifetimeMetal", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "marketToken", outputs: [{ type: "address" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "isOpenCommunity", outputs: [{ type: "bool" }], stateMutability: "view", type: "function" },
  {
    inputs: [],
    name: "getRegisteredDevices",
    outputs: [{ type: "address[]" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

export default function AdminDashboard() {
  // [TAMBAHAN]: Tarik address dompet yang sedang terhubung
  const { address: userAddress } = useAccount();

  // State untuk Create Community
  const [communityName, setCommunityName] = useState("");
  const [plasticRate, setPlasticRate] = useState("");
  const [metalRate, setMetalRate] = useState("");
  const [tokenModel, setTokenModel] = useState<"custom" | "market">("custom");
  const [tokenSymbol, setTokenSymbol] = useState("");
  const [marketTokenAddress, setMarketTokenAddress] = useState("");
  const [isOpenCommunity, setIsOpenCommunity] = useState(true);

  // State Gabungan untuk Management (Satu Pintu)
  const [manageCommunityAddr, setManageCommunityAddr] = useState("");
  const [deviceAddress, setDeviceAddress] = useState("");
  const [memberAddress, setMemberAddress] = useState("");

  // Hooks
  const { writeContractAsync: createCommunity, isPending: isCreating } = useScaffoldWriteContract({
    contractName: "RVMFactory",
  });

  const { data: deployedCommunities, isLoading: isReading } = useScaffoldReadContract({
    contractName: "RVMFactory",
    functionName: "getAllCommunityDetails",
  });

  // =========================================================================
  // [LOGIKA PRIVASI ADMIN]: Filter HANYA komunitas milik user yang sedang aktif
  // =========================================================================
  const myCommunities =
    deployedCommunities?.filter((c: any) => userAddress && c.owner.toLowerCase() === userAddress.toLowerCase()) || [];

  // Baca status Open/Closed HANYA untuk komunitas milik Admin ini
  const { data: openStatuses } = useReadContracts({
    contracts: myCommunities.map((c: any) => ({
      address: c.contractAddress as `0x${string}`,
      abi: communityAbi,
      functionName: "isOpenCommunity",
    })),
  });

  // Cek apakah komunitas yang DIPILIH di dropdown adalah Closed
  const selectedIndex = myCommunities.findIndex((c: any) => c.contractAddress === manageCommunityAddr);
  const isSelectedClosed =
    selectedIndex !== undefined && selectedIndex >= 0 ? openStatuses?.[selectedIndex]?.result === false : false;

  const { writeContractAsync: whitelistDevice, isPending: isWhitelisting } = useWriteContract();
  const { writeContractAsync: registerMember, isPending: isRegisteringMember } = useWriteContract();

  // Handlers
  const handleCreateCommunity = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!communityName || (!tokenSymbol && tokenModel === "custom")) return;

    try {
      await createCommunity({
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
      console.error("Gagal membuat komunitas RVM:", error);
    }
  };

  const handleWhitelistDevice = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!manageCommunityAddr || !deviceAddress) return;

    try {
      await whitelistDevice({
        address: manageCommunityAddr as `0x${string}`,
        abi: [
          {
            inputs: [
              { internalType: "address", name: "deviceAddress", type: "address" },
              { internalType: "bool", name: "status", type: "bool" },
            ],
            name: "setWhitelistedDevice",
            outputs: [],
            stateMutability: "nonpayable",
            type: "function",
          },
        ],
        functionName: "setWhitelistedDevice",
        args: [deviceAddress as `0x${string}`, true],
      });
      setDeviceAddress("");
      alert("Perangkat berhasil didaftarkan ke Komunitas!");
    } catch (error) {
      console.error("Gagal otorisasi perangkat:", error);
    }
  };

  const handleRegisterMember = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!manageCommunityAddr || !memberAddress) return;

    try {
      await registerMember({
        address: manageCommunityAddr as `0x${string}`,
        abi: [
          {
            inputs: [
              { internalType: "address", name: "_user", type: "address" },
              { internalType: "bool", name: "_status", type: "bool" },
            ],
            name: "registerMember",
            outputs: [],
            stateMutability: "nonpayable",
            type: "function",
          },
        ],
        functionName: "registerMember",
        args: [memberAddress as `0x${string}`, true],
      });
      setMemberAddress("");
      alert("🎉 Warga berhasil didaftarkan ke Komunitas!");
    } catch (error) {
      console.error("Gagal mendaftarkan warga:", error);
    }
  };

  // Tampilan jika dompet belum terhubung
  if (!userAddress) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200 text-center max-w-md">
          <h2 className="text-xl font-bold text-blue-900 mb-2">Akses Ditolak</h2>
          <p className="text-slate-500 text-sm">
            Harap hubungkan dompet (Wallet) Anda terlebih dahulu untuk mengakses Panel Admin.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-20 pt-8">
      <div className="max-w-3xl mx-auto px-4">
        {/* --- 1. ADD RVM COMMUNITY BOX --- */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 mb-8 shadow-sm">
          <h3 className="text-xl font-bold text-blue-900 mb-6">Create New Community</h3>
          <form onSubmit={handleCreateCommunity} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Community Name</label>
                <input
                  type="text"
                  className="input input-bordered w-full mt-1.5 bg-slate-50 border-slate-200 rounded-xl h-11 text-sm focus:border-blue-500 focus:outline-none"
                  placeholder="e.g., Sukamaju"
                  value={communityName}
                  onChange={e => setCommunityName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Community Access</label>
                <div className="flex gap-4 mt-1.5 h-11 items-center">
                  <label className="flex items-center gap-2 cursor-pointer bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl flex-1 hover:border-blue-300 transition-colors">
                    <input
                      type="radio"
                      name="access"
                      className="radio radio-info radio-sm"
                      checked={isOpenCommunity === true}
                      onChange={() => setIsOpenCommunity(true)}
                    />
                    <span className="text-sm font-semibold text-slate-700">Open</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl flex-1 hover:border-blue-300 transition-colors">
                    <input
                      type="radio"
                      name="access"
                      className="radio radio-info radio-sm"
                      checked={isOpenCommunity === false}
                      onChange={() => setIsOpenCommunity(false)}
                    />
                    <span className="text-sm font-semibold text-slate-700">Closed</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Token Model</label>
                <select
                  className="select select-bordered w-full mt-1.5 bg-slate-50 border-slate-200 rounded-xl h-11 min-h-0 text-sm focus:border-blue-500 focus:outline-none"
                  value={tokenModel}
                  onChange={e => setTokenModel(e.target.value as any)}
                >
                  <option value="custom">Custom Token</option>
                  <option value="market">Market Token (USDT)</option>
                </select>
              </div>

              {tokenModel === "custom" ? (
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Token Symbol</label>
                  <input
                    type="text"
                    className="input input-bordered w-full mt-1.5 bg-slate-50 border-slate-200 rounded-xl h-11 text-sm focus:border-blue-500 focus:outline-none"
                    placeholder="e.g., SMJ"
                    value={tokenSymbol}
                    onChange={e => setTokenSymbol(e.target.value)}
                    required
                  />
                </div>
              ) : (
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">USDT Address</label>
                  <input
                    type="text"
                    className="input input-bordered w-full mt-1.5 bg-slate-50 border-slate-200 rounded-xl h-11 text-sm font-mono focus:border-blue-500 focus:outline-none"
                    placeholder="0x..."
                    value={marketTokenAddress}
                    onChange={e => setMarketTokenAddress(e.target.value)}
                    required
                  />
                </div>
              )}
            </div>

            <div className="flex gap-4">
              <div className="w-1/2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Plastic Rate</label>
                <input
                  type="number"
                  className="input input-bordered w-full mt-1.5 bg-slate-50 border-slate-200 rounded-xl h-11 text-sm focus:border-blue-500 focus:outline-none"
                  placeholder="Pts"
                  value={plasticRate}
                  onChange={e => setPlasticRate(e.target.value)}
                  required
                />
              </div>
              <div className="w-1/2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Metal Rate</label>
                <input
                  type="number"
                  className="input input-bordered w-full mt-1.5 bg-slate-50 border-slate-200 rounded-xl h-11 text-sm focus:border-blue-500 focus:outline-none"
                  placeholder="Pts"
                  value={metalRate}
                  onChange={e => setMetalRate(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <button
                type="submit"
                className="btn bg-blue-600 hover:bg-blue-700 text-white px-8 rounded-xl border-none h-11 min-h-0 shadow-sm"
                disabled={isCreating}
              >
                {isCreating ? <span className="loading loading-spinner loading-sm"></span> : "Save Community"}
              </button>
            </div>
          </form>
        </div>

        {/* --- 2. MANAGE COMMUNITY BOX --- */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 mb-8 shadow-sm">
          <h3 className="text-xl font-bold text-blue-900 mb-6">Manage Community Access</h3>

          {/* Pilih Komunitas Dulu */}
          <div className="mb-6">
            <select
              className="select select-bordered w-full bg-slate-50 border-slate-200 rounded-xl h-12 text-sm font-semibold text-slate-700 focus:border-blue-500 focus:outline-none"
              value={manageCommunityAddr}
              onChange={e => setManageCommunityAddr(e.target.value)}
            >
              <option value="" disabled>
                -- Select Community to Manage --
              </option>
              {myCommunities.length > 0 ? (
                myCommunities.map((community: any, index: number) => {
                  const isClosed = openStatuses?.[index]?.result === false;
                  return (
                    <option key={index} value={community.contractAddress}>
                      {community.name} {isClosed ? "(Closed)" : "(Open)"}
                    </option>
                  );
                })
              ) : (
                <option disabled>Belum ada komunitas yang Anda buat</option>
              )}
            </select>
          </div>

          {/* Form Muncul Dinamis SETELAH Komunitas Dipilih */}
          {manageCommunityAddr && (
            <div className="space-y-4 animate-[fadeIn_0.3s_ease-in-out]">
              {/* Card Register Device (Selalu Muncul) */}
              <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl">
                <h4 className="font-bold text-slate-800 mb-2">Register Machine (ESP32)</h4>
                <form onSubmit={handleWhitelistDevice} className="flex flex-col md:flex-row gap-3">
                  <input
                    type="text"
                    className="input input-bordered w-full bg-white border-slate-200 rounded-xl h-11 text-sm font-mono text-slate-700 focus:border-blue-500 focus:outline-none"
                    placeholder="Insert Device Address (0x...)"
                    value={deviceAddress}
                    onChange={e => setDeviceAddress(e.target.value)}
                    required
                  />
                  <button
                    type="submit"
                    className="btn bg-blue-600 hover:bg-blue-700 text-white px-8 rounded-xl border-none h-11 shadow-sm"
                    disabled={isWhitelisting}
                  >
                    {isWhitelisting ? <span className="loading loading-spinner loading-sm"></span> : "Send"}
                  </button>
                </form>
              </div>

              {/* Card Register Member (HANYA Muncul Jika Komunitas Closed) */}
              {isSelectedClosed && (
                <div className="p-5 bg-orange-50 border border-orange-200 rounded-2xl">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="font-bold text-orange-900">Register Citizen Wallet</h4>
                    <span className="bg-orange-200 text-orange-800 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wide">
                      Closed Community
                    </span>
                  </div>
                  <form onSubmit={handleRegisterMember} className="flex flex-col md:flex-row gap-3">
                    <input
                      type="text"
                      className="input input-bordered w-full bg-white border-orange-200 rounded-xl h-11 text-sm font-mono text-slate-700 focus:border-orange-500 focus:outline-none"
                      placeholder="Insert Wallet Address (0x...)"
                      value={memberAddress}
                      onChange={e => setMemberAddress(e.target.value)}
                      required
                    />
                    <button
                      type="submit"
                      className="btn bg-orange-600 hover:bg-orange-700 text-white px-8 rounded-xl border-none h-11 shadow-sm"
                      disabled={isRegisteringMember}
                    >
                      {isRegisteringMember ? <span className="loading loading-spinner loading-sm"></span> : "Add"}
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}
        </div>

        {/* --- 3. DEVICE LIST BOX --- */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-sm">
          <h3 className="text-xl font-bold text-blue-900 mb-6">Device Dashboard</h3>

          {isReading ? (
            <div className="flex justify-center py-6">
              <span className="loading loading-dots loading-md text-blue-600"></span>
            </div>
          ) : myCommunities.length > 0 ? (
            <div className="space-y-4">
              {/* [UPDATE]: Map myCommunities instead of deployedCommunities */}
              {myCommunities.map((community: any, index: number) => (
                <CommunityCard key={index} community={community} />
              ))}
            </div>
          ) : (
            <div className="text-center py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
              <p className="text-slate-500 text-sm font-medium">Anda belum mengelola komunitas apapun.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// =========================================================================
// KOMPONEN ANAK: Merender setiap kartu komunitas dan mengambil datanya
// (Kode bagian ini tidak ada perubahan fungsional, tetap sama)
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

  const { data: registeredDevices } = useReadContract({
    address: community.contractAddress,
    abi: communityAbi,
    functionName: "getRegisteredDevices",
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
  let liquidityDisplay = "...";
  let liquidityLabel = community.symbol;

  if (isCustomToken) {
    liquidityDisplay = "Unlimited";
    liquidityLabel = "Minted";
  } else if (poolBalance !== undefined) {
    const formattedBalance = (Number(poolBalance) / 1e18).toLocaleString(undefined, { maximumFractionDigits: 2 });
    liquidityDisplay = formattedBalance;
    liquidityLabel = "USDT";
  }

  const devices = (registeredDevices as string[]) || [];

  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200 flex flex-col gap-4 transition-all hover:shadow-md hover:border-blue-200">
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="font-bold text-lg text-slate-800">RVM - {community.name}</h4>
            {isOpen !== undefined && (
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider ${isOpen ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}
              >
                {isOpen ? "OPEN" : "CLOSED"}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-xs font-mono text-slate-500 bg-slate-50 px-2 py-1 rounded border border-slate-100">
              {community.contractAddress}
            </p>
            <button
              onClick={() => navigator.clipboard.writeText(community.contractAddress)}
              className="text-slate-400 hover:text-blue-500 transition-colors"
              title="Copy Address"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-1">
        <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-100">
          <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-1">Liquidity Pool</p>
          <p className="text-xl font-black text-slate-800">
            {liquidityDisplay} <span className="text-xs font-bold text-slate-500">{liquidityLabel}</span>
          </p>
        </div>
        <div className="bg-emerald-50/50 p-3 rounded-xl border border-emerald-100">
          <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-1">Sampah Masuk</p>
          <p className="text-xl font-black text-slate-800">
            {totalSampah} <span className="text-xs font-bold text-slate-500">Item</span>
          </p>
        </div>
      </div>

      <div className="mt-1 pt-4 border-t border-slate-100">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
            />
          </svg>
          Connected Devices ({devices.length})
        </p>
        <div className="flex flex-wrap gap-2">
          {devices.length > 0 ? (
            devices.map((device, i) => (
              <span
                key={i}
                className="bg-slate-100 text-slate-600 text-[10px] font-mono px-2.5 py-1.5 rounded-lg border border-slate-200 shadow-sm flex items-center gap-1.5"
              >
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                {device.slice(0, 6)}...{device.slice(-4)}
              </span>
            ))
          ) : (
            <span className="text-xs text-slate-400 italic bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
              Belum ada mesin yang didaftarkan.
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
