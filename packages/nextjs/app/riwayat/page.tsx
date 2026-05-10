"use client";

import { useEffect, useState } from "react";
import Link from "next/dist/client/link";
import { useAccount, useWriteContract } from "wagmi";

// 1. [UPDATE ABI]: ABI sekarang menggunakan tipe data array ([]) untuk claimMultiple
const COMMUNITY_ABI = [
  {
    inputs: [
      { internalType: "uint256[]", name: "totalPlastics", type: "uint256[]" },
      { internalType: "uint256[]", name: "totalMetals", type: "uint256[]" },
      { internalType: "uint256[]", name: "nonces", type: "uint256[]" },
      { internalType: "address", name: "deviceAddress", type: "address" },
      { internalType: "bytes[]", name: "signatures", type: "bytes[]" },
    ],
    name: "claimMultiple",
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
  // 2. [UPDATE STATE]: State tidak lagi pakai ID tunggal, melainkan Alamat Komunitas
  const [claimingCommunity, setClaimingCommunity] = useState<string | null>(null);

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

  // 3. [UPDATE FUNGSI KLAIM]: Menerima Array dari kelompok struk
  const handleClaimBatch = async (contractAddress: string, groupReceipts: any[]) => {
    if (!userAddress) {
      alert("Harap hubungkan dompet (Wallet) Anda terlebih dahulu!");
      return;
    }

    setClaimingCommunity(contractAddress);

    try {
      // Pastikan Address ESP32 ini sesuai dengan milik Anda
      const esp32Address = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";

      // Siapkan Array kosong untuk diisi data dari semua struk
      const plastics: bigint[] = [];
      const metals: bigint[] = [];
      const nonces: bigint[] = [];
      const signatures: `0x${string}`[] = [];

      // Proses semua signature secara sekuensial agar tidak terjadi race condition
      for (const receipt of groupReceipts) {
        const fullSig = await findVAndConstructSignature(
          receipt.payload.signature,
          receipt.payload.plastic,
          receipt.payload.metal,
          receipt.payload.nonce,
          esp32Address,
        );

        plastics.push(BigInt(receipt.payload.plastic));
        metals.push(BigInt(receipt.payload.metal));
        nonces.push(BigInt(receipt.payload.nonce));
        signatures.push(fullSig);
      }

      // Eksekusi ke Blockchain (1x transaksi untuk semua item di dalam array)
      await writeContractAsync({
        address: contractAddress as `0x${string}`,
        abi: COMMUNITY_ABI,
        functionName: "claimMultiple",
        args: [plastics, metals, nonces, esp32Address, signatures],
      });

      // Update status semua struk yang berhasil diklaim menjadi 'claimed'
      const claimedIds = groupReceipts.map(r => r.id);
      const updatedReceipts = receipts.map(r => (claimedIds.includes(r.id) ? { ...r, status: "claimed" } : r));

      setReceipts(updatedReceipts);
      localStorage.setItem("rvm_receipts", JSON.stringify(updatedReceipts));

      alert(`🎉 Klaim ${groupReceipts.length} Struk Berhasil! Biaya gas Anda jadi sangat hemat.`);
    } catch (error) {
      console.error("Gagal Klaim Batch:", error);
      alert("Klaim massal gagal. Pastikan saldo Gas Fee (MATIC/ETH) Anda cukup.");
    } finally {
      setClaimingCommunity(null);
    }
  };

  const filteredReceipts = receipts.filter(r => r.status === activeTab);

  // 4. [LOGIKA PENGELOMPOKAN]: Satukan struk pending berdasarkan Komunitas yang sama
  const groupedPendingReceipts = filteredReceipts.reduce(
    (acc, receipt) => {
      if (activeTab === "pending") {
        const addr = receipt.community.contractAddress;
        if (!acc[addr]) {
          acc[addr] = { community: receipt.community, items: [] };
        }
        acc[addr].items.push(receipt);
      }
      return acc;
    },
    {} as Record<string, { community: any; items: any[] }>,
  );

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
            <div className="space-y-6">
              {/* === JIKA TAB PENDING: TAMPILKAN BERDASARKAN KELOMPOK === */}
              {activeTab === "pending"
                ? Object.values(groupedPendingReceipts).map((group: any, idx: number) => {
                    // Hitung total kumulatif dari kelompok ini untuk ditampilkan di UI
                    const totalPlastik = group.items.reduce((sum: number, item: any) => sum + item.payload.plastic, 0);
                    const totalMetal = group.items.reduce((sum: number, item: any) => sum + item.payload.metal, 0);

                    return (
                      <div key={idx} className="bg-white p-5 rounded-2xl shadow-sm border border-[#0288D1]/30">
                        <div className="flex justify-between items-center mb-3">
                          <h3 className="font-bold text-slate-800 text-sm">📍 {group.community.name}</h3>
                          <span className="px-2 py-1 bg-blue-100 text-[#0288D1] rounded text-[10px] font-bold">
                            {group.items.length} Struk
                          </span>
                        </div>

                        <div className="text-xs text-gray-500 mb-4 border-b border-gray-100 pb-3">
                          <p className="mb-1">Total akumulasi yang akan diklaim:</p>
                          <div className="flex gap-2">
                            <span className="font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded">
                              {totalPlastik} Plastik
                            </span>
                            <span className="font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded">
                              {totalMetal} Metal
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={() => handleClaimBatch(group.community.contractAddress, group.items)}
                          disabled={claimingCommunity === group.community.contractAddress}
                          className="w-full btn btn-sm h-10 bg-[#0288D1] hover:bg-[#01579B] text-white border-none rounded-xl shadow-sm"
                        >
                          {claimingCommunity === group.community.contractAddress ? (
                            <span className="loading loading-spinner loading-xs"></span>
                          ) : (
                            `Klaim Semua (${group.items.length}) - 1x Bayar Gas`
                          )}
                        </button>
                      </div>
                    );
                  })
                : /* === JIKA TAB CLAIMED: TAMPILKAN LIST BIASA === */
                  filteredReceipts.map(receipt => (
                    <div
                      key={receipt.id}
                      className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 opacity-70"
                    >
                      <div className="flex justify-between items-center mb-2">
                        <p className="text-[10px] font-bold text-gray-400">{receipt.date}</p>
                        <span className="px-2 py-1 rounded text-[10px] font-bold bg-green-100 text-green-600">
                          SUKSES
                        </span>
                      </div>
                      <h3 className="font-bold text-slate-800 text-sm mb-3">📍 {receipt.community.name}</h3>
                      <div className="flex gap-2 text-xs font-bold text-gray-600 bg-gray-50 p-2 rounded-lg">
                        <span>{receipt.payload.plastic} Plastik</span> • <span>{receipt.payload.metal} Metal</span>
                      </div>
                    </div>
                  ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
