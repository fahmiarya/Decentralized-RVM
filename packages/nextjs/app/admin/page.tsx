"use client";

import { useState } from "react";
import { useReadContract, useWriteContract } from "wagmi";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";

export default function AdminDashboard() {
  // State untuk Create Community
  const [communityName, setCommunityName] = useState("");
  const [plasticRate, setPlasticRate] = useState("");
  const [metalRate, setMetalRate] = useState("");
  const [tokenModel, setTokenModel] = useState<"custom" | "market">("custom");
  const [tokenSymbol, setTokenSymbol] = useState("");
  const [marketTokenAddress, setMarketTokenAddress] = useState("");
  const [isOpenCommunity, setIsOpenCommunity] = useState(true);

  // State untuk Whitelist Device
  const [targetCommunity, setTargetCommunity] = useState("");
  const [deviceAddress, setDeviceAddress] = useState("");

  // Hooks
  const { writeContractAsync: createCommunity, isPending: isCreating } = useScaffoldWriteContract({
    contractName: "RVMFactory",
  });

  const { data: deployedCommunities, isLoading: isReading } = useScaffoldReadContract({
    contractName: "RVMFactory",
    functionName: "getAllCommunityDetails",
  });

  const { writeContractAsync: whitelistDevice, isPending: isWhitelisting } = useWriteContract();

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
    if (!targetCommunity || !deviceAddress) return;

    try {
      await whitelistDevice({
        address: targetCommunity as `0x${string}`,
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

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-20 pt-8">
      <div className="max-w-3xl mx-auto px-4">
        {/* --- ADD RVM COMMUNITY BOX --- */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 mb-8 shadow-sm">
          <h3 className="text-xl font-bold text-blue-900 mb-6">Add RVM Community</h3>

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
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
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

        {/* --- REGISTER DEVICE BOX --- */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 mb-8 shadow-sm">
          <h3 className="text-xl font-bold text-blue-900 mb-6">Register Device to Community</h3>
          <form onSubmit={handleWhitelistDevice} className="flex flex-col md:flex-row gap-4">
            <select
              className="select select-bordered w-full md:w-1/3 bg-slate-50 border-slate-200 rounded-xl h-12 text-sm font-semibold text-slate-700 focus:border-blue-500 focus:outline-none"
              value={targetCommunity}
              onChange={e => setTargetCommunity(e.target.value)}
              required
            >
              <option value="" disabled>
                Select Community
              </option>
              {deployedCommunities?.map((community: any, index: number) => (
                <option key={index} value={community.contractAddress}>
                  {community.name}
                </option>
              ))}
            </select>

            <input
              type="text"
              className="input input-bordered w-full md:w-full bg-slate-50 border-slate-200 rounded-xl h-12 text-sm font-mono text-slate-700 focus:border-blue-500 focus:outline-none"
              placeholder="Insert Device Address (0x...)"
              value={deviceAddress}
              onChange={e => setDeviceAddress(e.target.value)}
              required
            />

            <button
              type="submit"
              className="btn bg-blue-600 hover:bg-blue-700 text-white px-8 rounded-xl border-none h-12 shadow-sm"
              disabled={isWhitelisting}
            >
              {isWhitelisting ? <span className="loading loading-spinner loading-sm"></span> : "Send"}
            </button>
          </form>
        </div>

        {/* --- DEVICE LIST BOX --- */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-sm">
          <h3 className="text-xl font-bold text-blue-900 mb-6">Device Dashboard</h3>

          {isReading ? (
            <div className="flex justify-center py-6">
              <span className="loading loading-dots loading-md text-blue-600"></span>
            </div>
          ) : deployedCommunities && deployedCommunities.length > 0 ? (
            <div className="space-y-4">
              {deployedCommunities.map((community: any, index: number) => (
                <CommunityCard key={index} community={community} />
              ))}
            </div>
          ) : (
            <div className="text-center py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
              <p className="text-slate-500 text-sm font-medium">No communities registered yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// =========================================================================
// KOMPONEN ANAK: Merender setiap kartu komunitas dan mengambil datanya
// =========================================================================
function CommunityCard({ community }: { community: any }) {
  // 1. ABI Spesifik untuk membaca data dari CommunityRVM
  const communityAbi = [
    { inputs: [], name: "lifetimePlastic", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" },
    { inputs: [], name: "lifetimeMetal", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" },
    { inputs: [], name: "marketToken", outputs: [{ type: "address" }], stateMutability: "view", type: "function" },
  ] as const;

  // 2. Baca Jumlah Plastik Seumur Hidup
  const { data: plasticCount } = useReadContract({
    address: community.contractAddress,
    abi: communityAbi,
    functionName: "lifetimePlastic",
  });

  // 3. Baca Jumlah Metal Seumur Hidup
  const { data: metalCount } = useReadContract({
    address: community.contractAddress,
    abi: communityAbi,
    functionName: "lifetimeMetal",
  });

  // 4. Cek Tipe Token yang Dipakai (0x000... = Custom, Selain itu = Market)
  const { data: marketTokenAddr } = useReadContract({
    address: community.contractAddress,
    abi: communityAbi,
    functionName: "marketToken",
  });

  // Tentukan apakah dia Custom Token (Unlimited Mint)
  const isCustomToken = !marketTokenAddr || marketTokenAddr === "0x0000000000000000000000000000000000000000";

  // 5. Jika Market Token, Baca Sisa Saldo (BalanceOf) di Brankas Komunitas Ini
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

  // Kalkulasi & Formatting
  const totalSampah = (Number(plasticCount || 0) + Number(metalCount || 0)).toLocaleString();

  let liquidityDisplay = "...";
  let liquidityLabel = community.symbol;

  if (isCustomToken) {
    liquidityDisplay = "Unlimited";
    liquidityLabel = "Minted"; // Karena tidak bisa habis
  } else if (poolBalance !== undefined) {
    // Dibagi 1e18 karena standar desimal ERC20
    const formattedBalance = (Number(poolBalance) / 1e18).toLocaleString(undefined, { maximumFractionDigits: 2 });
    liquidityDisplay = formattedBalance;
    liquidityLabel = "USDT"; // Asumsi Market Token = USDT
  }

  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200 flex flex-col gap-4 transition-all hover:shadow-md hover:border-blue-200">
      {/* Bagian Atas: Info Dasar */}
      <div className="flex justify-between items-start">
        <div>
          <h4 className="font-bold text-lg text-slate-800">RVM - {community.name}</h4>
          <p className="text-xs font-mono text-slate-500 mt-1 bg-slate-50 inline-block px-2 py-1 rounded border border-slate-100">
            {community.contractAddress}
          </p>
        </div>
        <button
          onClick={() => navigator.clipboard.writeText(community.contractAddress)}
          className="btn btn-xs bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg h-8 px-4"
        >
          Copy ID
        </button>
      </div>

      {/* Bagian Bawah: Statistik Dinamis */}
      <div className="grid grid-cols-2 gap-3 mt-2">
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
    </div>
  );
}
