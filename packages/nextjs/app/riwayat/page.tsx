"use client";

import { useEffect, useState } from "react";
import Link from "next/dist/client/link";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import deployedContracts from "~~/contracts/deployedContracts";

// const COMMUNITY_ABI = [
//   {
//     inputs: [
//       { internalType: "uint256[]", name: "totalPlastics", type: "uint256[]" },
//       { internalType: "uint256[]", name: "totalMetals", type: "uint256[]" },
//       { internalType: "uint256[]", name: "nonces", type: "uint256[]" },
//       { internalType: "address", name: "deviceAddress", type: "address" },
//       { internalType: "bytes[]", name: "signatures", type: "bytes[]" },
//     ],
//     name: "claimMultiple",
//     outputs: [],
//     stateMutability: "nonpayable",
//     type: "function",
//   },
// ] as const;

export default function RiwayatPage() {
  const { address: userAddress, chain } = useAccount();
  const { writeContractAsync } = useWriteContract();

  const publicClient = usePublicClient();

  const [receipts, setReceipts] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"pending" | "claimed">("pending");
  const [claimingCommunity, setClaimingCommunity] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("rvm_receipts");
    if (saved) setReceipts(JSON.parse(saved));
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

  const handleClaimBatch = async (contractAddress: string, groupReceipts: any[]) => {
    if (!userAddress) {
      alert("Harap hubungkan dompet terlebih dahulu!");
      return;
    }
    setClaimingCommunity(contractAddress);
    try {
      const esp32Address = groupReceipts[0].payload.deviceAddress || "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
      const MAX_BATCH_SIZE = 30;
      const receiptsToProcess = groupReceipts.slice(0, MAX_BATCH_SIZE);

      const plastics: bigint[] = [];
      const metals: bigint[] = [];
      const nonces: bigint[] = [];
      const signatures: `0x${string}`[] = [];

      for (const receipt of receiptsToProcess) {
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

      const chainId = chain?.id ?? 31337;
      const contracts = deployedContracts as Record<number, any>;
      const communityAbi = contracts[chainId].CommunityRVM.abi;

      const txHash = await writeContractAsync({
        address: contractAddress as `0x${string}`,
        abi: communityAbi, // Gunakan ABI otomatis
        functionName: "claimMultiple",
        args: [plastics, metals, nonces, esp32Address, signatures],
      });

      if (!publicClient) {
        alert("Koneksi ke jaringan belum siap. Coba lagi sebentar.");
        return;
      }

      alert("Transaksi terkirim! Menunggu konfirmasi dari jaringan...");
      const receiptTx = await publicClient.waitForTransactionReceipt({ hash: txHash });

      if (receiptTx.status === "success") {
        // 5. BARU DI SINI KITA UPDATE LOCAL STORAGE KARENA SUDAH PASTI BERHASIL
        const claimedIds = receiptsToProcess.map(r => r.id);
        const updatedReceipts = receipts.map(r => (claimedIds.includes(r.id) ? { ...r, status: "claimed" } : r));

        setReceipts(updatedReceipts);
        localStorage.setItem("rvm_receipts", JSON.stringify(updatedReceipts));

        alert(`🎉 Klaim ${receiptsToProcess.length} Struk Berhasil dan telah tercatat di Blockchain!`);
      } else {
        throw new Error("Transaksi revert/gagal di blockchain.");
      }
    } catch (err) {
      console.error("Gagal Klaim Batch:", err);
      alert("Klaim massal gagal. Pastikan saldo gas fee cukup atau struk belum pernah diklaim.");
    } finally {
      setClaimingCommunity(null);
    }
  };

  const filteredReceipts = receipts.filter(r => r.status === activeTab);

  const groupedPendingReceipts = filteredReceipts.reduce(
    (acc, receipt) => {
      if (activeTab === "pending") {
        const addr = receipt.community.contractAddress;
        if (!acc[addr]) acc[addr] = { community: receipt.community, items: [] };
        acc[addr].items.push(receipt);
      }
      return acc;
    },
    {} as Record<string, { community: any; items: any[] }>,
  );

  const pendingCount = receipts.filter(r => r.status === "pending").length;
  const claimedCount = receipts.filter(r => r.status === "claimed").length;

  const tokenHue = (symbol: string) => (symbol ? symbol.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 360 : 160);

  return (
    <div className="rvm-root min-h-screen pb-32 pt-6 px-4" style={{ background: "#F2F4F7" }}>
      <div className="max-w-md mx-auto space-y-3">
        {/* ── Card 1: Hero header ──────────────────────────────────────── */}
        <div
          className="relative rounded-3xl overflow-hidden px-5 pt-8 pb-6 anim-slide-up"
          style={{
            background: "linear-gradient(135deg, #0f172a 0%, #134e4a 60%, #065f46 100%)",
            boxShadow: "0 20px 60px -12px rgba(6,95,70,0.35)",
          }}
        >
          {/* dot grid */}
          <div
            className="absolute inset-0 opacity-[0.04] pointer-events-none"
            style={{
              backgroundImage: "radial-gradient(circle at 1px 1px,white 1px,transparent 0)",
              backgroundSize: "24px 24px",
            }}
          />
          {/* glow */}
          <div
            className="absolute -top-10 -right-10 w-44 h-44 rounded-full opacity-[0.12] pointer-events-none"
            style={{ background: "radial-gradient(circle,#34d399,transparent 70%)" }}
          />

          {/* top row */}
          <div className="relative z-10 flex items-center justify-between mb-5">
            <Link
              href="/"
              className="w-9 h-9 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div className="text-center">
              <p className="rvm-mono text-emerald-400 text-[10px] tracking-widest uppercase">Transaksi</p>
              <h1 className="text-white text-base font-bold tracking-tight">Riwayat Setoran</h1>
            </div>
            <div className="w-9" />
          </div>

          {/* stats row */}
          <div className="relative z-10 flex gap-3">
            <div className="flex-1 bg-white/10 border border-white/10 rounded-2xl px-4 py-3">
              <p className="rvm-mono text-white/40 text-[10px] tracking-widest uppercase mb-1">Menunggu</p>
              <p className="text-white text-2xl font-bold leading-none">{pendingCount}</p>
              <p className="text-white/50 text-[11px] mt-0.5">struk</p>
            </div>
            <div className="flex-1 bg-white/10 border border-white/10 rounded-2xl px-4 py-3">
              <p className="rvm-mono text-white/40 text-[10px] tracking-widest uppercase mb-1">Selesai</p>
              <p className="text-emerald-400 text-2xl font-bold leading-none">{claimedCount}</p>
              <p className="text-white/50 text-[11px] mt-0.5">diklaim</p>
            </div>
          </div>
        </div>

        {/* ── Card 2: Tab switcher ─────────────────────────────────────── */}
        <div className="bg-white rounded-3xl shadow-[0_1px_4px_rgba(0,0,0,0.06)] p-2 flex gap-1">
          {(["pending", "claimed"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl text-sm font-semibold transition-all"
              style={
                activeTab === tab
                  ? {
                      background: tab === "pending" ? "#111827" : "#059669",
                      color: "#ffffff",
                      boxShadow: tab === "pending" ? "0 2px 8px rgba(17,24,39,0.25)" : "0 2px 8px rgba(5,150,105,0.35)",
                    }
                  : {
                      background: "transparent",
                      color: "#9ca3af",
                    }
              }
            >
              {tab === "pending" ? "Menunggu" : "Selesai"}
              {tab === "pending" && pendingCount > 0 && (
                <span
                  className="rvm-mono text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                  style={
                    activeTab === "pending"
                      ? { background: "rgba(255,255,255,0.2)", color: "#fff" }
                      : { background: "#f3f4f6", color: "#6b7280" }
                  }
                >
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Card 3: Content ──────────────────────────────────────────── */}
        <div
          className="bg-white rounded-3xl shadow-[0_1px_4px_rgba(0,0,0,0.06)] overflow-hidden"
          style={{ minHeight: 320 }}
        >
          {filteredReceipts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                style={{ background: "#F2F4F7", border: "1px solid #e5e7eb" }}
              >
                <svg
                  className="w-7 h-7"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  style={{ color: "#d1d5db" }}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z"
                  />
                </svg>
              </div>
              <p className="font-semibold text-sm" style={{ color: "#6b7280" }}>
                Tidak ada struk di sini
              </p>
              <p className="rvm-mono text-[11px] mt-1" style={{ color: "#d1d5db" }}>
                {activeTab === "pending" ? "Scan mesin RVM untuk mulai setor" : "Struk yang diklaim muncul di sini"}
              </p>
            </div>
          ) : (
            <div className="p-4 space-y-3">
              {/* === PENDING === */}
              {activeTab === "pending"
                ? Object.values(groupedPendingReceipts).map((group: any, idx: number) => {
                    const totalPlastik = group.items.reduce((s: number, i: any) => s + i.payload.plastic, 0);
                    const totalMetal = group.items.reduce((s: number, i: any) => s + i.payload.metal, 0);
                    const isClaiming = claimingCommunity === group.community.contractAddress;
                    const hue = tokenHue(group.community.symbol ?? "");

                    return (
                      <div
                        key={idx}
                        className="rounded-2xl overflow-hidden"
                        style={{ border: "1px solid #f3f4f6", background: "#fafafa" }}
                      >
                        {/* community row */}
                        <div
                          className="flex items-center gap-3 px-4 pt-4 pb-3"
                          style={{ borderBottom: "1px solid #f3f4f6" }}
                        >
                          <div
                            className="w-10 h-10 rounded-2xl flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                            style={{
                              background: `hsl(${hue},55%,40%)`,
                              boxShadow: `0 2px 8px hsla(${hue},55%,40%,0.3)`,
                            }}
                          >
                            {group.community.symbol?.charAt(0).toUpperCase() ?? "R"}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm truncate" style={{ color: "#111827" }}>
                              {group.community.name}
                            </p>
                            <p className="rvm-mono text-[10px] truncate" style={{ color: "#9ca3af" }}>
                              {group.community.contractAddress.slice(0, 10)}...
                              {group.community.contractAddress.slice(-6)}
                            </p>
                          </div>
                          <span
                            className="rvm-mono text-[10px] font-bold px-2 py-1 rounded-lg flex-shrink-0"
                            style={{ background: "#f3f4f6", color: "#6b7280" }}
                          >
                            {group.items.length} struk
                          </span>
                        </div>

                        {/* stat boxes */}
                        <div className="grid grid-cols-2 px-4 py-3 gap-3">
                          <div className="rounded-xl px-3 py-2.5" style={{ background: "#eff6ff" }}>
                            <p
                              className="rvm-mono text-[10px] tracking-widest uppercase mb-1"
                              style={{ color: "#93c5fd" }}
                            >
                              Plastik
                            </p>
                            <p className="text-2xl font-bold leading-none" style={{ color: "#1d4ed8" }}>
                              {totalPlastik}
                            </p>
                            <p className="text-[11px] mt-0.5" style={{ color: "#93c5fd" }}>
                              botol
                            </p>
                          </div>
                          <div className="rounded-xl px-3 py-2.5" style={{ background: "#f9fafb" }}>
                            <p
                              className="rvm-mono text-[10px] tracking-widest uppercase mb-1"
                              style={{ color: "#9ca3af" }}
                            >
                              Metal
                            </p>
                            <p className="text-2xl font-bold leading-none" style={{ color: "#374151" }}>
                              {totalMetal}
                            </p>
                            <p className="text-[11px] mt-0.5" style={{ color: "#9ca3af" }}>
                              kaleng
                            </p>
                          </div>
                        </div>

                        {/* claim button */}
                        <div className="px-4 pb-4">
                          <button
                            onClick={() => handleClaimBatch(group.community.contractAddress, group.items)}
                            disabled={isClaiming}
                            className="w-full h-12 rounded-2xl text-white text-sm font-bold tracking-wide transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                            style={{
                              background: isClaiming ? "#9ca3af" : "linear-gradient(135deg,#059669,#047857)",
                              boxShadow: isClaiming ? "none" : "0 6px 20px -4px rgba(5,150,105,0.4)",
                            }}
                          >
                            {isClaiming ? (
                              <>
                                <span className="loading loading-spinner loading-xs" />
                                Memproses...
                              </>
                            ) : (
                              <>Klaim {group.items.length} Struk — 1× Gas Fee</>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })
                : /* === CLAIMED === */
                  filteredReceipts.map(receipt => {
                    const hue = tokenHue(receipt.community.symbol ?? "");
                    return (
                      <div
                        key={receipt.id}
                        className="rounded-2xl flex items-center gap-4 p-4"
                        style={{ background: "#fafafa", border: "1px solid #f3f4f6", opacity: 0.85 }}
                      >
                        <div
                          className="w-10 h-10 rounded-2xl flex-shrink-0 flex items-center justify-center text-white text-sm font-bold"
                          style={{ background: `hsl(${hue},45%,45%)` }}
                        >
                          {receipt.community.symbol?.charAt(0).toUpperCase() ?? "R"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm truncate" style={{ color: "#111827" }}>
                            {receipt.community.name}
                          </p>
                          <p className="rvm-mono text-[10px] mt-0.5" style={{ color: "#9ca3af" }}>
                            {receipt.payload.plastic} plastik · {receipt.payload.metal} metal
                          </p>
                          <p className="rvm-mono text-[10px] mt-0.5" style={{ color: "#d1d5db" }}>
                            {receipt.date}
                          </p>
                        </div>
                        <span
                          className="flex-shrink-0 inline-flex items-center gap-1 rvm-mono text-[10px] font-semibold px-2 py-1 rounded-full"
                          style={{ background: "#ecfdf5", color: "#059669", border: "1px solid #a7f3d0" }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#059669" }} />
                          Sukses
                        </span>
                      </div>
                    );
                  })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
