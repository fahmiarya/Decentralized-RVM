"use client";

// @refresh reset
import { AddressInfoDropdown } from "./AddressInfoDropdown";
import { AddressQRCodeModal } from "./AddressQRCodeModal";
import { RevealBurnerPKModal } from "./RevealBurnerPKModal";
import { WrongNetworkDropdown } from "./WrongNetworkDropdown";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Balance } from "@scaffold-ui/components";
import { Address } from "viem";
import { useNetworkColor } from "~~/hooks/scaffold-eth";
import { useTargetNetwork } from "~~/hooks/scaffold-eth/useTargetNetwork";
import { getBlockExplorerAddressLink } from "~~/utils/scaffold-eth";

/**
 * Custom Wagmi Connect Button (watch balance + custom design for Mobile UI)
 */
export const RainbowKitCustomConnectButton = () => {
  const networkColor = useNetworkColor();
  const { targetNetwork } = useTargetNetwork();

  return (
    <ConnectButton.Custom>
      {({ account, chain, openConnectModal, mounted }) => {
        const connected = mounted && account && chain;
        const blockExplorerAddressLink = account
          ? getBlockExplorerAddressLink(targetNetwork, account.address)
          : undefined;

        return (
          <>
            {(() => {
              // 1. STATE: BELUM TERHUBUNG
              if (!connected) {
                return (
                  <button
                    className="bg-[#0288D1] hover:bg-[#0277BD] text-white px-8 py-2.5 rounded-full font-semibold shadow-md transition-transform active:scale-95 flex items-center gap-2"
                    onClick={openConnectModal}
                    type="button"
                  >
                    <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3"
                      />
                    </svg>
                    Hubungkan Dompet
                  </button>
                );
              }

              // 2. STATE: SALAH JARINGAN
              if (chain.unsupported || chain.id !== targetNetwork.id) {
                return <WrongNetworkDropdown />;
              }

              // 3. STATE: TERHUBUNG
              return (
                <div className="flex flex-col items-center gap-3 w-full">
                  {/* Dropdown Alamat Wallet */}
                  <div className="z-10">
                    <AddressInfoDropdown
                      address={account.address as Address}
                      displayName={account.displayName}
                      ensAvatar={account.ensAvatar}
                      blockExplorerAddressLink={blockExplorerAddressLink}
                    />
                  </div>

                  {/* Informasi Saldo & Jaringan (Tampil dalam Card/Pill kecil) */}
                  <div className="flex items-center justify-center gap-4 bg-gray-50 px-5 py-2 rounded-2xl border border-gray-100 shadow-sm w-full max-w-[220px]">
                    <div className="flex flex-col items-center">
                      <span className="text-[10px] text-gray-400 font-bold tracking-wider mb-0.5">SALDO</span>
                      <Balance
                        address={account.address as Address}
                        style={{
                          minHeight: "0",
                          height: "auto",
                          fontSize: "0.875rem", // text-sm
                          fontWeight: "bold",
                          color: "#01579B",
                        }}
                      />
                    </div>

                    {/* Garis Pemisah */}
                    <div className="h-6 w-px bg-gray-200"></div>

                    <div className="flex flex-col items-center">
                      <span className="text-[10px] text-gray-400 font-bold tracking-wider mb-0.5">JARINGAN</span>
                      <span className="text-sm font-bold truncate max-w-[80px]" style={{ color: networkColor }}>
                        {chain.name}
                      </span>
                    </div>
                  </div>

                  <AddressQRCodeModal address={account.address as Address} modalId="qrcode-modal" />
                  <RevealBurnerPKModal />
                </div>
              );
            })()}
          </>
        );
      }}
    </ConnectButton.Custom>
  );
};
