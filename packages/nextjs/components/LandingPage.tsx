"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";
import { useLocalStorage } from "usehooks-ts";

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

    if (!mounted) return null;

    const handleSelectBurner = () => {
        setWalletMode("burner");
        onBypass();
    };

    const handleSelectRealWallet = () => {
        setWalletMode("real");
    };

    return (
        <div className="flex flex-col items-center justify-center p-4 min-h-screen bg-slate-100 font-sans">
            <main className="max-w-md w-full bg-white shadow-2xl rounded-[2.5rem] overflow-hidden border border-gray-100 min-h-[85vh] flex flex-col justify-between p-6 relative">

                {/* TOP ACCENT DECORATION */}
                <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-blue-500/10 to-transparent pointer-events-none" />

                {/* LOGO & HERO SECTION */}
                <div className="text-center mt-8 z-10">
                    <div className="w-20 h-20 bg-gradient-to-tr from-[#0288D1] to-emerald-400 rounded-3xl mx-auto flex items-center justify-center shadow-lg shadow-blue-500/20 mb-4 animate-pulse">
                        <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H10a1 1 0 01-1-1v-4z" />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight">Selamat Datang di RVM DePIN</h1>
                    <p className="text-xs text-slate-500 mt-2 max-w-xs mx-auto font-medium">
                        Pilih metode sinkronisasi akun Anda untuk mengamankan cetakan tanda tangan digital dari mesin sampah fisik.
                    </p>
                </div>

                {/* SELECTION CARDS CONTAINER */}
                <div className="space-y-4 my-auto z-10 pt-6">

                    {/* OPTION 1: REAL WEB3 WALLET (METAMASK / WALLETCONNECT) */}
                    <div
                        onClick={handleSelectRealWallet}
                        className={`p-5 rounded-2xl border-2 transition-all cursor-pointer relative group ${walletMode === "real" || isConnected
                                ? "border-[#0288D1] bg-blue-50/50 shadow-md shadow-blue-500/5"
                                : "border-slate-200 bg-white hover:border-blue-300 hover:shadow-sm"
                            }`}
                    >
                        <div className="flex items-start gap-4">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${isConnected ? "bg-[#0288D1] text-white" : "bg-slate-100 text-slate-600 group-hover:bg-blue-100 group-hover:text-[#0288D1]"
                                }`}>
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                            </div>
                            <div className="flex-1">
                                <div className="flex items-center justify-between">
                                    <h3 className="font-bold text-slate-800 text-sm">Dompet Web3 Utama (Rekomendasi)</h3>
                                    {isConnected && (
                                        <span className="bg-green-100 text-green-700 text-[9px] font-bold px-2 py-0.5 rounded-full animate-bounce">
                                            CONNECTED
                                        </span>
                                    )}
                                </div>
                                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                                    Hubungkan MetaMask atau Trust Wallet Anda. Saldo POL/MATIC asli & token reward tersinkronisasi aman secara on-chain sejati.
                                </p>

                                {/* BUTTON TRIGGER RAINBOWKIT INSIDE THE CARD AREA */}
                                <div className="mt-4 pointer-events-auto flex" onClick={(e) => e.stopPropagation()}>
                                    <RainbowKitCustomConnectButton />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* OPTION 2: GUEST MODE / BURNER WALLET */}
                    <div
                        onClick={handleSelectBurner}
                        className={`p-5 rounded-2xl border-2 transition-all cursor-pointer group ${walletMode === "burner" && !isConnected
                                ? "border-orange-500 bg-orange-50/40 shadow-md shadow-orange-500/5"
                                : "border-slate-200 bg-white hover:border-orange-300 hover:shadow-sm"
                            }`}
                    >
                        <div className="flex items-start gap-4">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${walletMode === "burner" && !isConnected ? "bg-orange-500 text-white" : "bg-slate-100 text-slate-600 group-hover:bg-orange-100 group-hover:text-orange-500"
                                }`}>
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                            </div>
                            <div className="flex-1">
                                <h3 className="font-bold text-slate-800 text-sm">Mode Tamu / Burner Wallet (Lokal)</h3>
                                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                                    Gunakan kunci otomatis sementara bawaan aplikasi Scaffold-ETH. Cocok untuk uji coba cepat tanpa ekstensi dompet tambahan.
                                </p>
                                {walletMode === "burner" && !isConnected && (
                                    <p className="text-[10px] text-orange-600 font-bold mt-2 flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-ping"></span>
                                        Aktif sebagai dompet lokal sementara Anda.
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                </div>

                {/* BOTTOM REDIRECT TO MAIN DASHBOARD */}
                <div className="w-full mt-6 z-10">
                    <button
                        onClick={onBypass}
                        disabled={walletMode === null && !isConnected}
                        className={`w-full btn h-12 rounded-xl border-none shadow-lg text-white font-bold transition-all text-sm ${isConnected || walletMode !== null
                                ? "bg-gradient-to-r from-[#0288D1] to-blue-600 hover:from-[#01579B] hover:to-blue-700 shadow-blue-500/20 active:scale-[0.98]"
                                : "bg-slate-300 text-slate-500 cursor-not-allowed"
                            }`}
                    >
                        Masuk ke Dashboard Utama →
                    </button>

                    <p className="text-center text-[10px] text-slate-400 mt-3 font-semibold tracking-wide">
                        Anda dapat mengubah pilihan ini kapan saja dengan melakukan Disconnect akun.
                    </p>
                </div>

            </main>
        </div>
    );
}
