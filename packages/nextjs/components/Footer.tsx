"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClockIcon, HomeIcon } from "@heroicons/react/24/outline";
import { useBleStore } from "~~/services/store/useBLEstore";

export const Footer = () => {
  const pathname = usePathname();
  // Ambil state dan fungsi dari Zustand
  const { deviceId, connectToRVM, disconnectRVM } = useBleStore();

  return (
    // Mengubah pembungkus luar menjadi flex-col agar elemen menumpuk ke bawah
    <div className="fixed bottom-0 w-full z-50 flex flex-col items-center pb-2 px-4 pointer-events-none">
      {/* KOTAK NAVIGASI UTAMA (Ditambah mb-2 agar ada jarak dengan teks bawah) */}
      <div className="bg-white rounded-3xl shadow-[0_10px_40px_rgba(0,0,0,0.15)] border border-gray-100 h-16 w-full max-w-md flex items-center justify-between px-8 pointer-events-auto relative mb-2">
        <Link
          href="/"
          className={`flex flex-col items-center transition-colors ${pathname === "/" ? "text-[#0288D1]" : "text-gray-400 hover:text-gray-600"}`}
        >
          <HomeIcon className="w-6 h-6" />
          <span className="text-[10px] mt-1 font-semibold">Home</span>
        </Link>

        {/* FAB TOMBOL SCANNER */}
        <button
          onClick={deviceId ? disconnectRVM : connectToRVM}
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
            // Icon Scanner jika belum terhubung
            <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5zM18 14.625v4.5m-2.25-2.25h4.5"
              />
            </svg>
          )}
        </button>

        <Link
          href="/riwayat"
          className={`flex flex-col items-center transition-colors ${
            pathname === "/riwayat" ? "text-[#0288D1]" : "text-gray-400 hover:text-gray-600"
          }`}
        >
          <ClockIcon className="w-6 h-6" />
          <span className="text-[10px] mt-1 font-semibold">Riwayat</span>
        </Link>
      </div>

      {/* TAUTAN MIKRO ADMIN (Pintu Rahasia) */}
      <Link
        href="/admin"
        className="text-[9px] text-gray-400 hover:text-[#0288D1] pointer-events-auto transition-colors font-medium tracking-wide"
      >
        Ingin memasang RVM di komunitas Anda? <span className="underline decoration-dashed">Daftar di sini</span>
      </Link>
    </div>
  );
};
