"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClockIcon, HomeIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { useBleStore } from "~~/services/store/useBLEstore";
import { useAccount } from "wagmi"; // Tambahan: Ambil wallet address user
import { Scanner } from "@yudiel/react-qr-scanner"; // Library Kamera QR

export const Footer = () => {
  const pathname = usePathname();
  const { address: userAddress } = useAccount(); // Tarik wallet address
  const { deviceId, connectToRVM, disconnectRVM, checkAndEnableBluetooth } = useBleStore();

  // State untuk mengontrol buka/tutup kamera
  const [isScanning, setIsScanning] = useState(false);

  const handleScanClick = async () => {
    if (deviceId) {
      // Jika sedang terkoneksi, tombol berfungsi sebagai Disconnect
      disconnectRVM();
    } else {
      // Jika belum terkoneksi, cek wallet lalu buka kamera
      if (!userAddress) {
        alert("Harap hubungkan dompet (Wallet) Anda terlebih dahulu!");
        return;
      }
      
      const isBluetoothReady = await checkAndEnableBluetooth();

      // Jika pengguna menolak menyalakan Bluetooth, BATALKAN buka kamera
      if (!isBluetoothReady) return;

      setIsScanning(true);
    }
  };

  const handleScanSuccess = (result: any[]) => {
    if (result && result.length > 0) {
      const qrText = result[0].rawValue;
      console.log("✅ QR Terdeteksi:", qrText);

      // Matikan kamera
      setIsScanning(false);

      if (userAddress) {
        connectToRVM(userAddress);
      } else {
        alert("Sesi dompet terputus. Harap koneksikan ulang dompet Anda.");
      }
    }
  };

  return (
    <>
      {/* ========================================================= */}
      {/* MODAL KAMERA SCANNER QR */}
      {/* ========================================================= */}
      {isScanning && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex flex-col items-center justify-center p-4 animate-[fadeIn_0.2s_ease-out]">
          <div className="w-full max-w-sm bg-white rounded-3xl overflow-hidden shadow-2xl relative flex flex-col">
            {/* Header Modal */}
            <div className="p-4 bg-slate-900 flex justify-between items-center text-white z-10 shadow-md">
              <h3 className="font-bold tracking-wide">Scan QR Mesin RVM</h3>
              <button
                onClick={() => setIsScanning(false)}
                className="p-1.5 bg-slate-800 rounded-full hover:bg-red-500 transition-colors"
              >
                <XMarkIcon className="w-5 h-5 text-white" />
              </button>
            </div>

            {/* Area Kamera */}
            <div className="relative aspect-square w-full bg-black flex items-center justify-center overflow-hidden">
              <Scanner
                onScan={handleScanSuccess}
                onError={(error:Error) => console.error(error?.message)}
                components={{ tracker: false }} // Kita buat tracker UI manual di bawah
                options={{ delayBetweenScanAttempts: 1000 }}
              />

              {/* UI Kotak Pembidik (Scanner Overlay) */}
              <div className="absolute inset-0 pointer-events-none border-[50px] border-black/50">
                <div className="w-full h-full border-2 border-[#0288D1] rounded-lg relative">
                  {/* Animasi Garis Scan */}
                  <div className="absolute top-0 left-0 w-full h-0.5 bg-[#0288D1] shadow-[0_0_8px_#0288D1] animate-[scanLine_2s_linear_infinite]"></div>
                </div>
              </div>
            </div>

            {/* Footer Modal */}
            <div className="p-6 text-center bg-white z-10 relative">
              <p className="text-sm font-bold text-slate-800">Arahkan kamera ke QR Code mesin</p>
              <p className="text-xs text-slate-500 mt-2 font-medium">
                Pastikan Bluetooth Anda menyala sebelum memindai.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* FOOTER BAWAH (NAVIGASI) */}
      {/* ========================================================= */}
      <div className="fixed bottom-0 w-full z-50 flex flex-col items-center pb-2 px-4 pointer-events-none">
        <div className="bg-white rounded-3xl shadow-[0_10px_40px_rgba(0,0,0,0.15)] border border-gray-100 h-16 w-full max-w-md flex items-center justify-between px-8 pointer-events-auto relative mb-2">

          {/* Tombol Home */}
          <Link href="/" className={`flex flex-col items-center transition-colors ${pathname === "/" ? "text-[#0288D1]" : "text-gray-400 hover:text-gray-600"}`}>
            <HomeIcon className="w-6 h-6" />
            <span className="text-[10px] mt-1 font-semibold">Home</span>
          </Link>

          {/* Tombol Tengah (Scanner FAB) */}
          <button
            onClick={handleScanClick}
            className={`absolute left-1/2 -translate-x-1/2 -top-6 text-white p-4 rounded-2xl shadow-lg transition-transform active:scale-95 flex items-center justify-center
              ${deviceId ? "bg-red-500 hover:bg-red-600 shadow-red-500/40" : "bg-[#0288D1] hover:bg-[#0277BD] shadow-blue-500/40"}
            `}
          >
            {deviceId ? (
              // Icon X (Stop) jika sudah terhubung
              <svg fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-8 h-8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              // Icon QR Scanner jika belum terhubung
              <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5zM18 14.625v4.5m-2.25-2.25h4.5" />
              </svg>
            )}
          </button>

          {/* Tombol Riwayat */}
          <Link href="/riwayat" className={`flex flex-col items-center transition-colors ${pathname === "/riwayat" ? "text-[#0288D1]" : "text-gray-400 hover:text-gray-600"}`}>
            <ClockIcon className="w-6 h-6" />
            <span className="text-[10px] mt-1 font-semibold">Riwayat</span>
          </Link>
        </div>

        <Link href="/admin" className="text-[9px] text-gray-400 hover:text-[#0288D1] pointer-events-auto transition-colors font-medium tracking-wide">
          Ingin memasang RVM di komunitas Anda? <span className="underline decoration-dashed">Daftar di sini</span>
        </Link>
      </div>
    </>
  );
};