"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Scanner } from "@yudiel/react-qr-scanner";
import { useLocalStorage } from "usehooks-ts";
import { useAccount } from "wagmi";
import { useBleStore } from "~~/services/store/useBLEstore";

export const Footer = () => {
  const pathname = usePathname();
  const { address: userAddress } = useAccount();
  const { deviceId, connectToRVM, disconnectRVM, checkAndEnableBluetooth } = useBleStore();
  const [isScanning, setIsScanning] = useState(false);
  const [walletMode] = useLocalStorage<"real" | "burner" | null>("rvm_wallet_mode", null);

  if (walletMode === null) return null;

  const handleScanClick = async () => {
    if (deviceId) {
      disconnectRVM();
    } else {
      if (!userAddress) {
        alert("Harap hubungkan dompet (Wallet) Anda terlebih dahulu!");
        return;
      }
      const isBluetoothReady = await checkAndEnableBluetooth();
      if (!isBluetoothReady) return;
      setIsScanning(true);
    }
  };

  const handleScanSuccess = (result: any[]) => {
    if (result && result.length > 0) {
      const qrText = result[0].rawValue;
      console.log("✅ QR Terdeteksi:", qrText);
      setIsScanning(false);
      if (userAddress) {
        connectToRVM(userAddress);
      } else {
        alert("Sesi dompet terputus. Harap koneksikan ulang dompet Anda.");
      }
    }
  };

  const isHome = pathname === "/";
  const isRiwayat = pathname === "/riwayat";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
        .ft-root { font-family: 'DM Sans', sans-serif; }
        .ft-mono { font-family: 'DM Mono', monospace; }

        @keyframes ft-fadein {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes ft-slideup {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes scanline {
          0%   { top: 0%; }
          100% { top: 100%; }
        }
        .ft-modal-bg  { animation: ft-fadein  0.2s ease both; }
        .ft-modal-box { animation: ft-slideup 0.3s cubic-bezier(.22,1,.36,1) both; }
        .scanline-bar {
          position: absolute;
          left: 0; right: 0;
          height: 2px;
          background: linear-gradient(90deg, transparent, #34d399, transparent);
          box-shadow: 0 0 8px #34d399;
          animation: scanline 2s linear infinite;
        }
      `}</style>

      {/* ── QR Scanner Modal ──────────────────────────────────────────────── */}
      {isScanning && (
        <div className="ft-root fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-4 ft-modal-bg">
          <div
            className="w-full max-w-[340px] rounded-3xl overflow-hidden shadow-2xl ft-modal-box"
            style={{ background: "#0f172a", border: "1px solid #1e293b" }}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
              <div>
                <p className="ft-mono text-[10px] text-emerald-400 tracking-widest uppercase mb-0.5">Bluetooth · BLE</p>
                <h3 className="text-white text-sm font-semibold">Pindai QR Mesin RVM</h3>
              </div>
              <button
                onClick={() => setIsScanning(false)}
                className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors border border-white/10"
              >
                {/* X icon */}
                <svg
                  className="w-4 h-4 text-white/60"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Camera area */}
            <div className="relative aspect-square w-full bg-black overflow-hidden">
              <Scanner
                onScan={handleScanSuccess}
                onError={(error: Error) => console.error(error?.message)}
                components={{ tracker: false }}
                options={{ delayBetweenScanAttempts: 1000 }}
              />
              {/* Dark vignette corners */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{ boxShadow: "inset 0 0 60px 30px rgba(0,0,0,0.6)" }}
              />
              {/* Finder frame */}
              <div className="absolute inset-8 pointer-events-none">
                <div className="relative w-full h-full">
                  {/* Corner brackets */}
                  {[
                    "top-0 left-0 border-t-2 border-l-2 rounded-tl-lg",
                    "top-0 right-0 border-t-2 border-r-2 rounded-tr-lg",
                    "bottom-0 left-0 border-b-2 border-l-2 rounded-bl-lg",
                    "bottom-0 right-0 border-b-2 border-r-2 rounded-br-lg",
                  ].map((cls, i) => (
                    <div key={i} className={`absolute w-6 h-6 border-emerald-400 ${cls}`} />
                  ))}
                  {/* Scan line */}
                  <div className="absolute inset-x-0 overflow-hidden" style={{ top: 0, bottom: 0 }}>
                    <div className="scanline-bar" />
                  </div>
                </div>
              </div>
            </div>

            {/* Modal footer */}
            <div className="px-5 py-4 text-center">
              <p className="text-white/80 text-sm font-medium">Arahkan ke QR Code mesin</p>
              <p className="ft-mono text-white/30 text-[10px] mt-1 tracking-wide">Pastikan Bluetooth menyala</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Bottom Nav ───────────────────────────────────────────────────── */}
      <div className="ft-root fixed bottom-0 w-full z-50 flex flex-col items-center pb-3 px-4 pointer-events-none">
        <div
          className="w-full max-w-[390px] h-[64px] flex items-center justify-between px-8 pointer-events-auto relative"
          style={{
            background: "rgba(255,255,255,0.92)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            borderRadius: "24px",
            border: "1px solid rgba(0,0,0,0.06)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.10), 0 1px 0 rgba(255,255,255,0.8) inset",
          }}
        >
          {/* Home */}
          <Link href="/" className="flex flex-col items-center gap-0.5 group">
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all
              ${isHome ? "bg-gray-900" : "bg-transparent group-hover:bg-gray-100"}`}
            >
              {/* Home icon */}
              <svg
                className={`w-4 h-4 transition-colors ${isHome ? "text-white" : "text-gray-400 group-hover:text-gray-600"}`}
                fill={isHome ? "currentColor" : "none"}
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={isHome ? 0 : 2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"
                />
              </svg>
            </div>
            <span
              className={`text-[10px] font-semibold tracking-wide transition-colors
              ${isHome ? "text-gray-900" : "text-gray-400"}`}
            >
              Home
            </span>
          </Link>

          {/* FAB — center scan button */}
          <button
            onClick={handleScanClick}
            className="absolute left-1/2 -translate-x-1/2 -top-7 w-[56px] h-[56px] rounded-2xl flex items-center justify-center transition-all active:scale-95"
            style={
              deviceId
                ? {
                    background: "linear-gradient(135deg, #ef4444, #dc2626)",
                    boxShadow: "0 8px 24px -4px rgba(239,68,68,0.5)",
                  }
                : {
                    background: "linear-gradient(135deg, #059669, #047857)",
                    boxShadow: "0 8px 24px -4px rgba(5,150,105,0.5)",
                  }
            }
          >
            {deviceId ? (
              /* Disconnect — bluetooth slash */
              <svg
                className="w-6 h-6 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              /* Connect — QR scan icon */
              <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" viewBox="0 0 24 24">
                <path fill="currentColor" d="M21 16v5H3v-5h2v3h14v-3zM3 11h18v2H3zm18-3h-2V5H5v3H3V3h18z"></path>
              </svg>
            )}
          </button>

          {/* Riwayat */}
          <Link href="/riwayat" className="flex flex-col items-center gap-0.5 group">
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all
              ${isRiwayat ? "bg-gray-900" : "bg-transparent group-hover:bg-gray-100"}`}
            >
              {/* Receipt / history icon */}
              <svg
                className={`w-4 h-4 transition-colors ${isRiwayat ? "text-white" : "text-gray-400 group-hover:text-gray-600"}`}
                fill={isRiwayat ? "currentColor" : "none"}
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={isRiwayat ? 0 : 2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z"
                />
              </svg>
            </div>
            <span
              className={`text-[10px] font-semibold tracking-wide transition-colors
              ${isRiwayat ? "text-gray-900" : "text-gray-400"}`}
            >
              Riwayat
            </span>
          </Link>
        </div>

        {/* Admin link */}
        <Link
          href="/admin"
          className="pointer-events-auto mt-2 ft-mono text-[10px] text-gray-400 hover:text-gray-600 transition-colors tracking-wide"
        >
          Pasang RVM di komunitasmu?{" "}
          <span className="underline decoration-dashed underline-offset-2">Daftar di sini</span>
        </Link>
      </div>
    </>
  );
};
