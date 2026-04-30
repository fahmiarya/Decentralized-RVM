"use client";

import { useEffect, useState } from "react";
import Link from "next/dist/client/link";
import { useAccount, useWriteContract } from "wagmi";

const COMMUNITY_ABI = [
  {
    inputs: [
      { internalType: "uint256", name: "totalPlastic", type: "uint256" },
      { internalType: "uint256", name: "totalMetal", type: "uint256" },
      { internalType: "uint256", name: "nonce", type: "uint256" },
      { internalType: "address", name: "deviceAddress", type: "address" },
      { internalType: "bytes", name: "signature", type: "bytes" },
    ],
    name: "batchClaim",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

export default function RiwayatPage() {
  const { address: userAddress } = useAccount();
  const { writeContractAsync } = useWriteContract();

  const [receipts, setReceipts] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"pending" | "claimed">("pending");
  const [claimingId, setClaimingId] = useState<number | null>(null);

  // Ambil data struk dari LocalStorage saat halaman dimuat
  useEffect(() => {
    const saved = localStorage.getItem("rvm_receipts");
    if (saved) {
      setReceipts(JSON.parse(saved));
    }
  }, []);

  const findVAndConstructSignature = async (
    rAndSHex: string,
    plastic: number,
    metal: number,
    nonce: number,
    espAddress: string,
  ) => {
    const { recoverAddress, sha256, encodePacked } = await import("viem");
    const cleanRS = rAndSHex.replace("0x", "");
    const r = cleanRS.slice(0, 64);
    let s = cleanRS.slice(64, 128);

    const SECP256K1_N = BigInt("0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141");
    const HALF_N = SECP256K1_N / 2n;

    let sBigInt = BigInt("0x" + s);
    if (sBigInt > HALF_N) {
      sBigInt = SECP256K1_N - sBigInt;
      s = sBigInt.toString(16).padStart(64, "0");
    }

    const normalizedRAndS = `0x${r}${s}`;
    const messageHash = sha256(
      encodePacked(
        ["uint256", "uint256", "uint256", "address"],
        [BigInt(plastic), BigInt(metal), BigInt(nonce), espAddress as `0x${string}`],
      ),
    );

    const sig27 = `${normalizedRAndS}1b` as `0x${string}`;
    const recovered27 = await recoverAddress({ hash: messageHash, signature: sig27 });
    if (recovered27.toLowerCase() === espAddress.toLowerCase()) return sig27;

    return `${normalizedRAndS}1c` as `0x${string}`;
  };

  const handleClaim = async (receipt: any) => {
    if (!userAddress) {
      alert("Harap hubungkan dompet (Wallet) Anda terlebih dahulu!");
      return;
    }

    setClaimingId(receipt.id);

    try {
      const esp32Address = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"; // Sesuai Public Key Mesin Anda
      const fullSignature = await findVAndConstructSignature(
        receipt.payload.signature,
        receipt.payload.plastic,
        receipt.payload.metal,
        receipt.payload.nonce,
        esp32Address,
      );

      // Eksekusi ke Blockchain
      await writeContractAsync({
        address: receipt.community.contractAddress as `0x${string}`,
        abi: COMMUNITY_ABI,
        functionName: "batchClaim",
        args: [
          BigInt(receipt.payload.plastic),
          BigInt(receipt.payload.metal),
          BigInt(receipt.payload.nonce),
          esp32Address,
          fullSignature,
        ],
      });

      // Jika sukses, ubah status struk menjadi 'claimed' di LocalStorage
      const updatedReceipts = receipts.map(r => (r.id === receipt.id ? { ...r, status: "claimed" } : r));
      setReceipts(updatedReceipts);
      localStorage.setItem("rvm_receipts", JSON.stringify(updatedReceipts));

      alert("🎉 Klaim Berhasil! Token telah masuk ke dompet Anda.");
    } catch (error) {
      console.error("Gagal Klaim:", error);
      alert("Klaim gagal. Pastikan Anda memiliki saldo Gas Fee yang cukup.");
    } finally {
      setClaimingId(null);
    }
  };

  const filteredReceipts = receipts.filter(r => r.status === activeTab);

  return (
    <div className="flex flex-col items-center justify-start p-4 min-h-screen bg-base-200 pb-32 pt-8 font-sans">
      <main className="max-w-md w-full bg-white relative shadow-2xl rounded-[2rem] overflow-hidden border border-gray-200 min-h-[80vh]">
        {/* HEADER */}
        <section className="bg-slate-900 pt-8 pb-6 px-6 flex items-center justify-between relative z-10 shadow-md">
          <Link
            href="/"
            className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-xl font-bold text-white tracking-wide">Riwayat Setoran</h1>
          <div className="w-10"></div> {/* Spacer */}
        </section>

        {/* TABS */}
        <div className="flex border-b border-gray-100 bg-white">
          <button
            className={`flex-1 py-4 text-sm font-bold transition-all ${activeTab === "pending" ? "text-[#0288D1] border-b-2 border-[#0288D1] bg-blue-50/30" : "text-gray-400 hover:text-gray-600"}`}
            onClick={() => setActiveTab("pending")}
          >
            Menunggu Klaim
          </button>
          <button
            className={`flex-1 py-4 text-sm font-bold transition-all ${activeTab === "claimed" ? "text-green-600 border-b-2 border-green-600 bg-green-50/30" : "text-gray-400 hover:text-gray-600"}`}
            onClick={() => setActiveTab("claimed")}
          >
            Selesai
          </button>
        </div>

        {/* DAFTAR STRUK */}
        <section className="p-6 bg-slate-50 min-h-[60vh]">
          {filteredReceipts.length === 0 ? (
            <div className="flex flex-col items-center justify-center pt-16 text-center">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <svg className="w-10 h-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <p className="text-gray-400 font-medium text-sm">Tidak ada struk di kategori ini.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredReceipts.map(receipt => (
                <div key={receipt.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                  <div className="flex justify-between items-start mb-4 border-b border-gray-100 pb-3">
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 mb-0.5">{receipt.date}</p>
                      <h3 className="font-bold text-slate-800 text-sm">📍 {receipt.community.name}</h3>
                    </div>
                    <span
                      className={`px-2 py-1 rounded text-[10px] font-bold ${receipt.status === "claimed" ? "bg-green-100 text-green-600" : "bg-orange-100 text-orange-600"}`}
                    >
                      {receipt.status === "claimed" ? "SUKSES" : "PENDING"}
                    </span>
                  </div>

                  <div className="flex gap-4 mb-4">
                    <div className="flex-1 bg-blue-50/50 p-2.5 rounded-xl border border-blue-50 text-center">
                      <p className="text-[10px] font-bold text-blue-400 uppercase">Plastik</p>
                      <p className="font-black text-blue-700">
                        {receipt.payload.plastic} <span className="font-normal text-xs">Botol</span>
                      </p>
                    </div>
                    <div className="flex-1 bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-center">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Metal</p>
                      <p className="font-black text-slate-700">
                        {receipt.payload.metal} <span className="font-normal text-xs">Kaleng</span>
                      </p>
                    </div>
                  </div>

                  {receipt.status === "pending" && (
                    <button
                      onClick={() => handleClaim(receipt)}
                      disabled={claimingId === receipt.id}
                      className="w-full btn btn-sm h-10 bg-[#0288D1] hover:bg-[#01579B] text-white border-none rounded-xl shadow-sm"
                    >
                      {claimingId === receipt.id ? (
                        <span className="loading loading-spinner loading-xs"></span>
                      ) : (
                        "Klaim ke Blockchain Sekarang"
                      )}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
