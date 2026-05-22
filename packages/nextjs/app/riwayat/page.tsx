"use client";

import { useEffect, useState } from "react";
import Link from "next/dist/client/link";
import { useAccount, useWriteContract } from "wagmi";

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
  const [claimingCommunity, setClaimingCommunity] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("rvm_receipts");
    if (saved) setReceipts(JSON.parse(saved));
  }, []);

  /* ── signature recovery (unchanged) ─────────────────────────────────── */
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

  /* ── claim batch (unchanged) ─────────────────────────────────────────── */
  const handleClaimBatch = async (contractAddress: string, groupReceipts: any[]) => {
    if (!userAddress) {
      alert("Harap hubungkan dompet terlebih dahulu!");
      return;
    }
    setClaimingCommunity(contractAddress);
    try {
      const esp32Address = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
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

      await writeContractAsync({
        address: contractAddress as `0x${string}`,
        abi: COMMUNITY_ABI,
        functionName: "claimMultiple",
        args: [plastics, metals, nonces, esp32Address, signatures],
      });

      const claimedIds = receiptsToProcess.map(r => r.id);
      const updatedReceipts = receipts.map(r => (claimedIds.includes(r.id) ? { ...r, status: "claimed" } : r));
      setReceipts(updatedReceipts);
      localStorage.setItem("rvm_receipts", JSON.stringify(updatedReceipts));

      if (groupReceipts.length > MAX_BATCH_SIZE) {
        alert(`🎉 Klaim ${MAX_BATCH_SIZE} struk pertama berhasil! Klik lagi untuk sisanya.`);
      } else {
        alert(`🎉 Klaim ${receiptsToProcess.length} Struk Berhasil! Gas sangat hemat.`);
      }
    } catch (err) {
      console.error("Gagal Klaim Batch:", err);
      alert("Klaim massal gagal. Pastikan saldo Gas Fee (MATIC) cukup.");
    } finally {
      setClaimingCommunity(null);
    }
  };

  /* ── derived state (unchanged) ───────────────────────────────────────── */
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

  /* ── helpers ─────────────────────────────────────────────────────────── */
  const tokenHue = (symbol: string) => (symbol ? symbol.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 360 : 160);

  /* ── render ──────────────────────────────────────────────────────────── */
  return (
    <div className="flex flex-col items-center justify-start p-4 min-h-screen bg-base-200 pb-32 pt-8 font-sans">
      <main className="max-w-md w-full bg-white relative shadow-2xl rounded-[2rem] overflow-hidden border border-gray-200 min-h-[80vh]">
        {/* ── Header (dark card, same system style) ────────────────────── */}
        <section
          className="relative pt-10 pb-6 px-6 rounded-b-3xl shadow-md overflow-hidden"
          style={{ background: "linear-gradient(135deg, #0f172a 0%, #134e4a 60%, #065f46 100%)" }}
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
            className="absolute -top-12 -right-12 w-44 h-44 rounded-full opacity-[0.12] pointer-events-none"
            style={{ background: "radial-gradient(circle,#34d399,transparent 70%)" }}
          />

          {/* top row */}
          <div className="relative z-10 flex items-center justify-between mb-6">
            <Link
              href="/"
              className="w-9 h-9 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div className="text-center">
              <p className="text-[10px] text-emerald-400 font-mono tracking-widest uppercase">Transaksi</p>
              <h1 className="text-white text-base font-bold tracking-tight">Riwayat Setoran</h1>
            </div>
            <div className="w-9" />
          </div>

          {/* summary stats */}
          <div className="relative z-10 flex gap-3">
            <div className="flex-1 bg-white/10 border border-white/10 rounded-2xl px-4 py-3">
              <p className="font-mono text-white/40 text-[10px] tracking-widest uppercase mb-1">Menunggu</p>
              <p className="text-white text-2xl font-bold leading-none">{pendingCount}</p>
              <p className="text-white/50 text-[11px] mt-0.5">struk</p>
            </div>
            <div className="flex-1 bg-white/10 border border-white/10 rounded-2xl px-4 py-3">
              <p className="font-mono text-white/40 text-[10px] tracking-widest uppercase mb-1">Selesai</p>
              <p className="text-emerald-400 text-2xl font-bold leading-none">{claimedCount}</p>
              <p className="text-white/50 text-[11px] mt-0.5">diklaim</p>
            </div>
          </div>
        </section>

        {/* ── Tabs (DaisyUI tabs-boxed) ─────────────────────────────────── */}
        <div className="px-5 pt-4 pb-2">
          <div role="tablist" className="tabs tabs-boxed bg-base-100 p-1">
            <button
              role="tab"
              className={`tab flex-1 font-semibold text-sm transition-all ${activeTab === "pending" ? "tab-active !bg-neutral !text-neutral-content rounded-xl" : "text-base-content/40"}`}
              onClick={() => setActiveTab("pending")}
            >
              Menunggu
              {pendingCount > 0 && (
                <span
                  className={`ml-1.5 badge badge-sm font-mono ${activeTab === "pending" ? "badge-ghost bg-white/20 text-white border-0" : "badge-neutral"}`}
                >
                  {pendingCount}
                </span>
              )}
            </button>
            <button
              role="tab"
              className={`tab flex-1 font-semibold text-sm transition-all ${activeTab === "claimed" ? "tab-active !bg-success !text-success-content rounded-xl" : "text-base-content/40"}`}
              onClick={() => setActiveTab("claimed")}
            >
              Selesai
            </button>
          </div>
        </div>

        {/* ── Content ───────────────────────────────────────────────────── */}
        <section className="p-5 bg-base-200 min-h-[50vh]">
          {filteredReceipts.length === 0 ? (
            /* Empty state */
            <div className="flex flex-col items-center justify-center pt-16 text-center">
              <div className="w-16 h-16 bg-base-100 rounded-2xl flex items-center justify-center mb-4 border border-base-300">
                <svg
                  className="w-7 h-7 text-base-content/20"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z"
                  />
                </svg>
              </div>
              <p className="font-semibold text-sm text-base-content/50">Tidak ada struk di sini</p>
              <p className="font-mono text-[11px] text-base-content/30 mt-1">
                {activeTab === "pending" ? "Scan mesin RVM untuk mulai setor" : "Struk yang diklaim muncul di sini"}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* === PENDING: grouped by community === */}
              {activeTab === "pending"
                ? Object.values(groupedPendingReceipts).map((group: any, idx: number) => {
                    const totalPlastik = group.items.reduce((s: number, i: any) => s + i.payload.plastic, 0);
                    const totalMetal = group.items.reduce((s: number, i: any) => s + i.payload.metal, 0);
                    const isClaiming = claimingCommunity === group.community.contractAddress;
                    const hue = tokenHue(group.community.symbol ?? "");

                    return (
                      <div key={idx} className="card bg-base-100 shadow-sm border border-base-200">
                        <div className="card-body p-5 gap-4">
                          {/* Community identity */}
                          <div className="flex items-center gap-3">
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
                              <p className="font-bold text-sm text-base-content truncate">{group.community.name}</p>
                              <p className="font-mono text-[10px] text-base-content/40 truncate">
                                {group.community.contractAddress.slice(0, 10)}...
                                {group.community.contractAddress.slice(-6)}
                              </p>
                            </div>
                            <div className="badge badge-outline font-mono text-[10px]">{group.items.length} struk</div>
                          </div>

                          <div className="divider my-0" />

                          {/* Stats (DaisyUI stats) */}
                          <div className="stats stats-horizontal w-full bg-base-200 rounded-2xl">
                            <div className="stat place-items-center py-3">
                              <div className="stat-title text-[10px] font-mono tracking-widest">PLASTIK</div>
                              <div className="stat-value text-2xl text-info">{totalPlastik}</div>
                              <div className="stat-desc text-[10px]">botol</div>
                            </div>
                            <div className="stat place-items-center py-3">
                              <div className="stat-title text-[10px] font-mono tracking-widest">METAL</div>
                              <div className="stat-value text-2xl">{totalMetal}</div>
                              <div className="stat-desc text-[10px]">kaleng</div>
                            </div>
                          </div>

                          {/* Claim button */}
                          <button
                            className="btn btn-success btn-block rounded-2xl font-bold text-sm"
                            onClick={() => handleClaimBatch(group.community.contractAddress, group.items)}
                            disabled={isClaiming}
                          >
                            {isClaiming ? (
                              <>
                                <span className="loading loading-spinner loading-xs" /> Memproses...
                              </>
                            ) : (
                              <>Klaim {group.items.length} Struk — 1× Gas Fee</>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })
                : /* === CLAIMED: simple list === */
                  filteredReceipts.map(receipt => {
                    const hue = tokenHue(receipt.community.symbol ?? "");
                    return (
                      <div key={receipt.id} className="card bg-base-100 border border-base-200 opacity-80">
                        <div className="card-body p-4 flex-row items-center gap-4">
                          <div
                            className="w-10 h-10 rounded-2xl flex-shrink-0 flex items-center justify-center text-white text-sm font-bold"
                            style={{ background: `hsl(${hue},45%,45%)` }}
                          >
                            {receipt.community.symbol?.charAt(0).toUpperCase() ?? "R"}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm text-base-content truncate">{receipt.community.name}</p>
                            <p className="font-mono text-[10px] text-base-content/50 mt-0.5">
                              {receipt.payload.plastic} plastik · {receipt.payload.metal} metal
                            </p>
                            <p className="font-mono text-[10px] text-base-content/30 mt-0.5">{receipt.date}</p>
                          </div>
                          <div className="badge badge-success badge-outline font-mono text-[10px] flex-shrink-0">
                            Sukses
                          </div>
                        </div>
                      </div>
                    );
                  })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
