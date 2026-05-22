"use client";

import { useEffect, useState } from "react";
import { useLocalStorage } from "usehooks-ts";
import { useAccount } from "wagmi";
import { RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";

interface OnboardingGatewayProps {
  onBypass: () => void;
}

export default function OnboardingGateway({ onBypass }: OnboardingGatewayProps) {
  const { isConnected, address } = useAccount();
  const [walletMode, setWalletMode] = useLocalStorage<"real" | "burner" | null>("rvm_wallet_mode", null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Saat wallet terhubung (apapun jenisnya — termasuk burner dari RainbowKit),
  // langsung tandai sebagai "real" dan lanjutkan ke dashboard.
  useEffect(() => {
    if (mounted && isConnected) {
      setWalletMode("real");
    }
  }, [mounted, isConnected]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!mounted) return null;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&family=DM+Mono:wght@400;500&display=swap');
        .ob-root { font-family: 'DM Sans', sans-serif; }
        .ob-mono { font-family: 'DM Mono', monospace; }
        @keyframes ob-rise {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .ob-rise   { animation: ob-rise 0.45s cubic-bezier(.22,1,.36,1) both; }
        .ob-rise-1 { animation: ob-rise 0.45s 0.08s cubic-bezier(.22,1,.36,1) both; }
        .ob-rise-2 { animation: ob-rise 0.45s 0.16s cubic-bezier(.22,1,.36,1) both; }
        .ob-rise-3 { animation: ob-rise 0.45s 0.24s cubic-bezier(.22,1,.36,1) both; }
      `}</style>

      <div className="ob-root min-h-screen bg-[#F2F4F7] flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-[390px] flex flex-col gap-4">
          {/* ── Hero card (dark) ──────────────────────────────────────────── */}
          <div
            className="ob-rise relative rounded-3xl overflow-hidden px-6 pt-10 pb-8"
            style={{
              background: "linear-gradient(135deg, #0f172a 0%, #134e4a 60%, #065f46 100%)",
              boxShadow: "0 20px 60px -12px rgba(6,95,70,0.45)",
            }}
          >
            {/* Dot grid */}
            <div
              className="absolute inset-0 opacity-[0.04]"
              style={{
                backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
                backgroundSize: "24px 24px",
              }}
            />
            {/* Glow */}
            <div
              className="absolute -top-20 -right-20 w-64 h-64 rounded-full opacity-[0.15]"
              style={{ background: "radial-gradient(circle, #34d399, transparent 70%)" }}
            />

            <div className="relative z-10">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mb-6">
                <svg
                  className="w-6 h-6 text-emerald-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
              </div>

              <p className="ob-mono text-emerald-400 text-[10px] tracking-widest uppercase mb-2">
                RVM Protocol · DePIN
              </p>
              <h1 className="text-2xl font-bold text-white leading-tight tracking-tight mb-3">
                Daur Ulang.
                <br />
                Dapat Reward.
              </h1>
              <p className="text-white/50 text-sm leading-relaxed">
                Masukkan botol &amp; kaleng ke mesin RVM, lalu klaim token reward langsung ke dompetmu.
              </p>

              <div className="mt-5 inline-flex items-center gap-1.5 bg-white/10 rounded-full px-3 py-1.5 border border-white/10">
                <span
                  className="w-2 h-2 rounded-full bg-purple-400"
                  style={{ boxShadow: "0 0 6px rgba(192,132,252,0.8)" }}
                />
                <span className="ob-mono text-white/60 text-[10px] tracking-wider">Polygon PoS · Mainnet</span>
              </div>
            </div>
          </div>

          {/* ── Connect card ─────────────────────────────────────────────── */}
          <div className="ob-rise-1 bg-white rounded-3xl p-5 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Pilih Dompet</h2>
                <p className="text-[11px] text-gray-400 mt-0.5">MetaMask · Burner · WalletConnect · dan lainnya</p>
              </div>
              {isConnected ? (
                <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-600 border border-emerald-200 text-[10px] font-semibold px-2.5 py-1 rounded-full ob-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Terhubung
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-400 text-[10px] font-semibold px-2.5 py-1 rounded-full ob-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                  Belum
                </span>
              )}
            </div>

            {/* Connected address display */}
            {isConnected && address && (
              <div className="mb-4 bg-emerald-50 rounded-2xl px-4 py-3 border border-emerald-100">
                <p className="ob-mono text-[10px] text-emerald-500 font-semibold tracking-widest uppercase mb-1">
                  Alamat Aktif
                </p>
                <p className="ob-mono text-xs text-emerald-700 font-medium tracking-wide">
                  {address.slice(0, 10)}...{address.slice(-8)}
                </p>
              </div>
            )}

            {/* RainbowKit button — all wallet options live here */}
            <div onClick={e => e.stopPropagation()}>
              <RainbowKitCustomConnectButton />
            </div>

            {!isConnected && (
              <p className="ob-mono text-[10px] text-gray-300 mt-3 text-center">
                Termasuk Burner Wallet untuk testing cepat
              </p>
            )}
          </div>

          {/* ── Proceed button — muncul setelah terhubung ────────────────── */}
          {isConnected && (
            <div className="ob-rise-2">
              <button
                onClick={onBypass}
                className="w-full h-14 rounded-2xl text-white text-sm font-bold tracking-wide transition-all active:scale-[0.98]"
                style={{
                  background: "linear-gradient(135deg, #059669, #047857)",
                  boxShadow: "0 8px 24px -4px rgba(5,150,105,0.45)",
                }}
              >
                Masuk ke Dashboard →
              </button>
              <p className="ob-mono text-center text-[10px] text-gray-300 mt-3">
                Disconnect akun untuk berganti dompet
              </p>
            </div>
          )}

          {/* ── Footer ───────────────────────────────────────────────────── */}
          <div className="ob-rise-3 text-center pb-2">
            <p className="ob-mono text-[10px] text-gray-300">RVM Protocol v1.0 · Polygon PoS</p>
          </div>
        </div>
      </div>
    </>
  );
}
