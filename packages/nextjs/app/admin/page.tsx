"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";

export default function AdminDashboard() {
  const { address: adminAddress } = useAccount();

  // 1. PERBAIKAN: Ubah initial state menjadi "0" atau biarkan string kosong tapi pastikan penanganan angkanya aman
  const [communityName, setCommunityName] = useState("");
  const [plasticRate, setPlasticRate] = useState("");
  const [metalRate, setMetalRate] = useState("");

  const [tokenModel, setTokenModel] = useState<"custom" | "market">("custom");
  const [tokenSymbol, setTokenSymbol] = useState("");
  const [marketTokenAddress, setMarketTokenAddress] = useState("");
  const [isOpenCommunity, setIsOpenCommunity] = useState(true);

  const { writeContractAsync: createCommunity, isPending } = useScaffoldWriteContract({
    contractName: "RVMFactory",
  });

  const { data: deployedCommunities, isLoading: isReading } = useScaffoldReadContract({
    contractName: "RVMFactory",
    functionName: "getDeployedCommunities",
  });

  const handleCreateCommunity = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validasi ekstra agar aman
    if (!communityName || (!tokenSymbol && tokenModel === "custom")) return;

    try {
      await createCommunity({
        functionName: "createCommunity",
        args: [
          communityName,
          tokenModel === "custom" ? tokenSymbol : "USDT",
          // 2. PERBAIKAN: Pastikan selalu mengirim angka valid ke BigInt
          BigInt(plasticRate === "" ? "0" : plasticRate),
          BigInt(metalRate === "" ? "0" : metalRate),
          isOpenCommunity,
          tokenModel === "market" && marketTokenAddress !== ""
            ? marketTokenAddress
            : "0x0000000000000000000000000000000000000000",
        ],
      });

      // Reset Form
      setCommunityName("");
      setTokenSymbol("");
      setMarketTokenAddress("");
      setPlasticRate("");
      setMetalRate("");
    } catch (error) {
      console.error("Gagal membuat komunitas:", error);
    }
  };

  return (
    <div className="flex flex-col items-center justify-start p-6 min-h-screen bg-base-200 pb-20">
      <div className="max-w-2xl w-full mt-4">
        {/* --- BAGIAN 1: PEMANTAUAN BRANKAS --- */}
        <section className="bg-gradient-to-br from-[#01579B] to-[#0288D1] p-6 rounded-3xl shadow-lg mb-8 text-white relative overflow-hidden">
          <svg className="absolute -right-4 -bottom-4 opacity-10 w-48 h-48" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.31-8.86c-1.77-.45-2.34-.94-2.34-1.67 0-.84.79-1.43 2.1-1.43 1.38 0 1.9.66 1.94 1.64h1.71c-.05-1.34-.87-2.57-2.49-2.97V5H10.9v1.69c-1.51.32-2.72 1.3-2.72 2.81 0 1.79 1.49 2.69 3.66 3.21 1.95.46 2.34 1.15 2.34 1.87 0 .53-.39 1.39-2.1 1.39-1.6 0-2.23-.72-2.32-1.64H8.04c.1 1.7 1.36 2.66 2.86 2.97V19h2.34v-1.67c1.52-.29 2.72-1.16 2.73-2.77-.01-2.2-1.9-2.96-3.66-3.42z" />
          </svg>

          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">Brankas Komunitas Anda (Pool)</h2>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/10 p-4 rounded-2xl border border-white/20 backdrop-blur-sm">
              <p className="text-xs text-blue-100 font-semibold tracking-wider mb-1">TOTAL SALDO</p>
              <p className="text-3xl font-black">
                1,250.00 <span className="text-sm font-normal">USDT</span>
              </p>
            </div>
            <div className="bg-white/10 p-4 rounded-2xl border border-white/20 backdrop-blur-sm">
              <p className="text-xs text-blue-100 font-semibold tracking-wider mb-1">SAMPAH MASUK</p>
              <p className="text-3xl font-black">
                842 <span className="text-sm font-normal">Item</span>
              </p>
            </div>
          </div>
        </section>

        {/* --- BAGIAN 2: FORM INISIALISASI --- */}
        <section className="bg-white p-6 md:p-8 rounded-3xl shadow-xl border border-gray-100">
          <h2 className="text-xl font-bold text-[#0288D1] mb-6 flex items-center gap-2">
            <span>➕</span> Inisialisasi RVM Baru
          </h2>

          <form onSubmit={handleCreateCommunity} className="space-y-6">
            <div>
              <label className="text-sm font-bold text-gray-500">Nama Komunitas</label>
              <input
                type="text"
                className="input input-bordered w-full mt-1 bg-gray-50 focus:bg-white text-gray-800"
                placeholder="Contoh: RVM Alun-alun Kota"
                value={communityName}
                onChange={e => setCommunityName(e.target.value)}
                required
              />
            </div>

            {/* 3. PERBAIKAN: Hapus kelas animasi yang mungkin menyebabkan error re-render (animate-fadeIn) */}
            <div className="bg-gray-50 p-5 rounded-2xl border border-gray-200 space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-gray-700">Komunitas Terbuka</p>
                  <p className="text-xs text-gray-500 mt-0.5">Siapa saja bisa mendapat token.</p>
                </div>
                <input
                  type="checkbox"
                  className="toggle toggle-info"
                  checked={isOpenCommunity}
                  onChange={e => setIsOpenCommunity(e.target.checked)}
                />
              </div>

              <div className="divider my-0"></div>

              <div>
                <p className="text-sm font-bold text-gray-700 mb-3">Model Ekonomi Token</p>
                <div className="flex bg-gray-200 p-1 rounded-xl w-full">
                  <button
                    type="button"
                    className={`flex-1 text-sm font-bold py-2 rounded-lg transition-colors ${tokenModel === "custom" ? "bg-white text-[#0288D1] shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                    onClick={() => setTokenModel("custom")}
                  >
                    Token Komunitas
                  </button>
                  <button
                    type="button"
                    className={`flex-1 text-sm font-bold py-2 rounded-lg transition-colors ${tokenModel === "market" ? "bg-white text-[#0288D1] shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                    onClick={() => setTokenModel("market")}
                  >
                    Token Pasar (USDT)
                  </button>
                </div>
              </div>

              {/* CONDITIONAL RENDER YANG LEBIH AMAN */}
              {tokenModel === "custom" && (
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Simbol Token</label>
                  <input
                    type="text"
                    className="input input-sm input-bordered w-full mt-1 bg-white text-gray-800"
                    placeholder="Contoh: RVM-SMJ"
                    value={tokenSymbol}
                    onChange={e => setTokenSymbol(e.target.value)}
                    required={tokenModel === "custom"}
                  />
                </div>
              )}

              {tokenModel === "market" && (
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Alamat Contract USDT
                  </label>
                  <input
                    type="text"
                    className="input input-sm input-bordered w-full mt-1 bg-white font-mono text-xs text-gray-800"
                    placeholder="0x..."
                    value={marketTokenAddress}
                    onChange={e => setMarketTokenAddress(e.target.value)}
                    required={tokenModel === "market"}
                  />
                  <p className="text-[10px] text-red-400 mt-1 font-semibold">
                    *Pastikan Anda mengisi saldo ke brankas kontrak ini.
                  </p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-bold text-gray-500">Reward Plastik</label>
                <input
                  type="number"
                  min="0"
                  className="input input-bordered w-full mt-1 bg-gray-50 focus:bg-white text-gray-800"
                  placeholder="Poin/Botol"
                  value={plasticRate}
                  onChange={e => setPlasticRate(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="text-sm font-bold text-gray-500">Reward Metal</label>
                <input
                  type="number"
                  min="0"
                  className="input input-bordered w-full mt-1 bg-gray-50 focus:bg-white text-gray-800"
                  placeholder="Poin/Kaleng"
                  value={metalRate}
                  onChange={e => setMetalRate(e.target.value)}
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn w-full mt-2 bg-[#0288D1] hover:bg-[#0277BD] text-white border-none text-base h-12 shadow-md"
              disabled={isPending}
            >
              {isPending ? <span className="loading loading-spinner loading-md"></span> : "Cetak Mesin ke Blockchain"}
            </button>
          </form>

          <div className="divider my-8 text-gray-400 text-xs font-bold tracking-widest">DAFTAR INSTANSI RVM AKTIF</div>

          {/* --- BAGIAN 3: DAFTAR KOMUNITAS --- */}
          {isReading ? (
            <div className="flex justify-center py-6">
              <span className="loading loading-dots loading-lg text-[#0288D1]"></span>
            </div>
          ) : deployedCommunities && deployedCommunities.length > 0 ? (
            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
              {deployedCommunities.map((address, index) => (
                <div
                  key={index}
                  className="bg-[#E1F5FE] p-4 rounded-xl border border-[#B3E5FC] flex flex-col md:flex-row md:items-center justify-between gap-3 hover:shadow-md transition-shadow"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-[#0288D1] uppercase tracking-wider">
                        Instansi #{index + 1}
                      </span>
                      <span className="badge badge-sm badge-success text-white border-none text-[10px] font-bold">
                        LIVE
                      </span>
                    </div>
                    <p className="font-mono text-xs text-[#01579B] break-all">{address}</p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost text-[#0288D1] bg-white hover:bg-gray-50 border border-[#81D4FA]"
                    onClick={() => navigator.clipboard.writeText(address)}
                  >
                    Copy ID
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 bg-gray-50 rounded-xl border border-gray-100">
              <p className="text-gray-400 italic text-sm">Belum ada mesin RVM yang terdaftar.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
