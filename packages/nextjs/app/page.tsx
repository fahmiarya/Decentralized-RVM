"use client";

import { useState } from "react";
import { hardhat } from "viem/chains";
// 1. TAMBAHKAN useWriteContract DI SINI
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { FaucetButton, RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";
import { useTargetNetwork } from "~~/hooks/scaffold-eth";
import { useBleStore } from "~~/services/store/useBLEstore";

// --- DATA DUMMY KOMUNITAS ---
// TODO: Ganti "0xALAMAT_KOMUNITAS..." dengan alamat kontrak yang Anda dapat dari halaman Admin
const AVAILABLE_COMMUNITIES = [
  { id: 1, name: "kopken", tokenSymbol: "KK", address: "0xCafac3dD18aC6c6e92c921884f9E4176737C052c" },
  { id: 2, name: "omh", tokenSymbol: "omh", address: "0xB7A5bd0345EF1Cc5E66bf61BdeC17D2461fBd968" },
];

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

export default function Home() {
  const { targetNetwork } = useTargetNetwork();
  const isLocalNetwork = targetNetwork.id === hardhat.id;
  const { address: userAddress } = useAccount();

  const [activeCommunity, setActiveCommunity] = useState(AVAILABLE_COMMUNITIES[0]);

  // 2. PANGGIL latestPayload DAN clearPayload DARI ZUSTAND
  const { status, sensorData, transactions, latestPayload, clearPayload } = useBleStore();

  // 3. DEKLARASI HOOK WAGMI UNTUK MENULIS KE BLOCKCHAIN
  const { writeContractAsync, isPending } = useWriteContract();

  const findVAndConstructSignature = async (
    rAndSHex: string,
    plastic: number,
    metal: number,
    nonce: number,
    espAddress: string,
  ) => {
    const { recoverAddress, sha256, encodePacked } = await import("viem");

    // 1. Bersihkan awalan "0x" jika ada, lalu belah menjadi R dan S
    const cleanRS = rAndSHex.replace("0x", "");
    const r = cleanRS.slice(0, 64);
    let s = cleanRS.slice(64, 128);

    // 2. ATURAN EIP-2: Normalisasi "High S" menjadi "Low S"
    // Ini adalah batas maksimal nilai kurva Ethereum (secp256k1)
    const SECP256K1_N = BigInt("0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141");
    const HALF_N = SECP256K1_N / 2n;

    let sBigInt = BigInt("0x" + s);
    if (sBigInt > HALF_N) {
      console.log("⚠️ Terdeteksi 'High S' dari ESP32! Melakukan perbaikan matematis...");
      // Rumus membalik bayangan: S_baru = N - S_lama
      sBigInt = SECP256K1_N - sBigInt;
      // Kembalikan ke wujud Hex 64 karakter
      s = sBigInt.toString(16).padStart(64, "0");
    }

    // Gabungkan kembali R dan S yang sudah suci
    const normalizedRAndS = `0x${r}${s}`;

    // 3. Hash Data Persis Seperti Smart Contract
    const messageHash = sha256(
      encodePacked(
        ["uint256", "uint256", "uint256", "address"],
        [BigInt(plastic), BigInt(metal), BigInt(nonce), espAddress as `0x${string}`],
      ),
    );

    // 4. Cari nilai V (27 atau 28)
    const sig27 = `${normalizedRAndS}1b` as `0x${string}`;
    const recovered27 = await recoverAddress({ hash: messageHash, signature: sig27 });
    if (recovered27.toLowerCase() === espAddress.toLowerCase()) return sig27;

    return `${normalizedRAndS}1c` as `0x${string}`;
  };

  const { data: balance, refetch: refetchBalance } = useReadContract({
    address: activeCommunity.address as `0x${string}`,
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

    query: {
      enabled: !!userAddress,
    },
  });

  // 4. FUNGSI UNTUK MENGEKSEKUSI SMART CONTRACT
  const handleClaimReward = async () => {
    if (!latestPayload) return;

    try {
      // 1. Suruh Next.js mencari nilai 'v' yang hilang
      const esp32Address = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
      const fullSignature = await findVAndConstructSignature(
        latestPayload.signature,
        latestPayload.plastic,
        latestPayload.metal,
        latestPayload.nonce,
        esp32Address,
      );

      // 2. Tembakkan ke Blockchain!
      await writeContractAsync({
        address: activeCommunity.address as `0x${string}`,
        abi: COMMUNITY_ABI,
        functionName: "batchClaim",
        args: [
          BigInt(latestPayload.plastic),
          BigInt(latestPayload.metal),
          BigInt(latestPayload.nonce),
          esp32Address,
          fullSignature, // <-- Gunakan Full Signature yang sudah dirakit
        ],
      });

      refetchBalance();
      console.log("🎉 Klaim Berhasil!");
      clearPayload();
    } catch (error) {
      console.error("❌ Gagal Klaim:", error);
    }
  };

  const getStatusStyle = () => {
    if (status.includes("Terhubung")) return "bg-[#E8F5E9] text-[#2E7D32] border-[#A5D6A7]";
    if (status.includes("Mencari")) return "bg-[#FFF3E0] text-[#EF6C00] border-[#FFCC80]";
    return "bg-[#FFEBEE] text-[#C62828] border-[#EF9A9A]";
  };

  return (
    <div className="flex flex-col items-center justify-start p-4 min-h-screen bg-base-200 pb-32 pt-8">
      <main className="max-w-md w-full bg-white relative shadow-xl rounded-3xl overflow-hidden border border-gray-100">
        <section className="flex flex-col items-center mt-8">
          <div className="w-28 h-28 rounded-full border-[3px] border-[#0288D1] bg-[#E1F5FE] flex items-center justify-center shadow-sm">
            <svg
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-14 h-14 text-[#0288D1]"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
              />
            </svg>
          </div>

          <div className="mt-5 flex flex-col items-center px-4 gap-3 w-full">
            <div className="flex justify-center w-full z-10">
              <RainbowKitCustomConnectButton />
            </div>
            {isLocalNetwork && (
              <div className="flex justify-center w-full">
                <FaucetButton />
              </div>
            )}
            <div className="mt-1">
              <span
                className={`px-4 py-1.5 rounded-full text-[11px] font-bold inline-block border tracking-wide shadow-sm ${getStatusStyle()}`}
              >
                ● {status.toUpperCase()}
              </span>
            </div>
          </div>
        </section>

        <section className="px-6 mt-6 mb-8">
          <div className="bg-[#F3F4F6] p-4 rounded-2xl mb-6 border border-gray-200 shadow-inner">
            <label className="text-[10px] text-gray-500 font-bold tracking-wider mb-1 block">LOKASI RVM SAAT INI</label>
            <select
              className="select select-bordered select-sm w-full bg-white text-[#01579B] font-bold mb-4"
              value={activeCommunity.id}
              onChange={e => {
                const selected = AVAILABLE_COMMUNITIES.find(c => c.id === Number(e.target.value));
                if (selected) setActiveCommunity(selected);
              }}
            >
              {AVAILABLE_COMMUNITIES.map(comm => (
                <option key={comm.id} value={comm.id}>
                  {comm.name}
                </option>
              ))}
            </select>
            <div className="flex justify-between items-end bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
              <div>
                <p className="text-[10px] text-gray-400 font-bold tracking-wider">SALDO TOKEN</p>
                <p className="text-xl font-black text-[#0288D1]">
                  {Number(balance || 0n)}{" "}
                  <span className="text-sm font-bold text-gray-500">{activeCommunity.tokenSymbol}</span>
                </p>
              </div>
              <div className="bg-[#E1F5FE] text-[#0288D1] p-1.5 rounded-lg">
                <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3"
                  />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-[#E1F5FE] p-5 rounded-2xl mb-6 shadow-sm border border-[#B3E5FC]">
            <p className="text-[#0288D1] font-bold text-xs mb-1 tracking-wider">DATA SENSOR TERKINI</p>
            <p className="text-[#01579B] font-mono text-lg font-bold">{sensorData}</p>
          </div>

          {/* 5. TOMBOL KLAIM AKAN MUNCUL DI SINI JIKA latestPayload ADA ISINYA */}
          {latestPayload && (
            <div className="mb-6 animate-pulse">
              <button
                onClick={handleClaimReward}
                disabled={isPending}
                className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-green-500/30 transition-all active:scale-95"
              >
                {isPending ? "Sedang Memproses..." : "KLAIM REWARD"}
              </button>
            </div>
          )}

          <div className="mb-2 ml-1 flex justify-between items-center">
            <p className="text-gray-400 text-xs font-bold tracking-wide">RIWAYAT SETORAN</p>
          </div>

          {transactions.length === 0 ? (
            <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100 text-center text-sm text-gray-400 italic">
              Belum ada sampah yang masuk...
            </div>
          ) : (
            <div className="space-y-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
              {transactions.map((tx, idx) => (
                <div
                  key={idx}
                  className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center transition-all hover:shadow-md"
                >
                  <div className="overflow-hidden w-[70%]">
                    <p className="text-xs text-gray-400">Payload</p>
                    <p className="text-[#01579B] font-mono font-bold text-xs truncate">{tx}</p>
                  </div>
                  <div className="bg-[#E1F5FE] text-[#0288D1] px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap">
                    + Poin {activeCommunity.tokenSymbol}
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
