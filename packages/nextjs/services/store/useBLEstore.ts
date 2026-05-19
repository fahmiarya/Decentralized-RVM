import { BleClient, dataViewToText, textToDataView } from "@capacitor-community/bluetooth-le"; // [UPDATE]: Tambah textToDataView
import { create } from "zustand";

// UUID BLE ESP32 Anda
const RVM_SERVICE_UUID = "4fafc201-1fb5-459e-8fcc-c5c9c331914b";
const RVM_NOTIFY_UUID = "beb5483e-36e1-4688-b7f5-ea07361b26a8";
const RVM_WRITE_WALLET_UUID = "cfc6594f-47f2-5799-c806-fb18472c37b9"; // [TAMBAHAN]: Lubang Kunci untuk Wallet

interface BleState {
  deviceId: string | null;
  status: string;
  sensorData: string;
  transactions: string[];

  latestPayload: { plastic: number; metal: number; nonce: number; signature: `0x${string}` } | null;
  clearPayload: () => void;

  checkAndEnableBluetooth: () => Promise<boolean>;

  connectToRVM: (walletAddress: string) => Promise<void>;
  disconnectRVM: () => Promise<void>;
}

export const useBleStore = create<BleState>((set, get) => ({
  deviceId: null,
  status: "Gateway Offline",
  sensorData: "Belum ada data...",
  transactions: [],

  latestPayload: null,
  clearPayload: () => set({ latestPayload: null }),


  checkAndEnableBluetooth: async () => {
    try {
      await BleClient.initialize({ androidNeverForLocation: true });
      let isEnabled = await BleClient.isEnabled();

      if (!isEnabled) {
        try {
          // Memunculkan Pop-Up Bawaan Android untuk menyalakan Bluetooth
          await BleClient.requestEnable();
          isEnabled = true;
        } catch (err) {
          // Jika pengguna menolak (klik Cancel) pada Pop-Up
          alert("Aplikasi membutuhkan Bluetooth. Harap nyalakan Bluetooth Anda secara manual.");
          return false;
        }
      }
      return isEnabled;
    } catch (error) {
      console.error("Gagal mengecek Bluetooth:", error);
      alert("Pastikan aplikasi memiliki Izin Perangkat Terdekat (Nearby Devices).");
      return false;
    }
  },

  connectToRVM: async (walletAddress: string) => {
    try {
      // 1. Inisialisasi dan cari perangkat
      await BleClient.initialize({ androidNeverForLocation: true });
      set({ status: "Mencari RVM..." });

      const device = await BleClient.requestDevice({
        services: [RVM_SERVICE_UUID],
      });

      set({ status: `Menyambungkan ke ${device.name || "ESP32"}...` });

      // 2. Lakukan Koneksi
      await BleClient.connect(device.deviceId);

      // 3. Mulai dengarkan notifikasi (Menerima Struk dari ESP32)
      await BleClient.startNotifications(device.deviceId, RVM_SERVICE_UUID, RVM_NOTIFY_UUID, value => {
        const rawData = dataViewToText(value);
        console.log("📥 Data mentah dari ESP32 masuk:", rawData);

        const dataParts = rawData.split(",");

        if (dataParts.length === 4) {
          const totalPlastic = parseInt(dataParts[0]);
          const totalMetal = parseInt(dataParts[1]);
          const nonce = parseInt(dataParts[2]);
          const signature = dataParts[3];

          console.log(`✅ Data tervalidasi - Plastik: ${totalPlastic}, Metal: ${totalMetal}, Nonce: ${nonce}`);

          set(state => ({
            sensorData: `Plastik: ${totalPlastic} | Metal: ${totalMetal}`,
            transactions: [rawData, ...state.transactions],
            latestPayload: {
              plastic: totalPlastic,
              metal: totalMetal,
              nonce: nonce,
              signature: signature as `0x${string}`,
            },
          }));
        } else {
          console.error("❌ Format data dari ESP32 tidak dikenali/terpotong:", rawData);
        }
      });

      // =========================================================================
      // 4. [SIHIR 2-ARAH]: KIRIM WALLET ADDRESS KE ESP32 UNTUK MENGUNCI MESIN
      // =========================================================================
      set({ status: "Mengirim Kunci Identitas..." });

      // Ubah string "0xABCD..." menjadi format biner (DataView)
      const walletDataView = textToDataView(walletAddress);

      // Tembakkan ke Karakteristik WRITE di ESP32
      await BleClient.write(device.deviceId, RVM_SERVICE_UUID, RVM_WRITE_WALLET_UUID, walletDataView);

      console.log("✅ Wallet Address berhasil dikirim ke RVM!");

      // Update UI untuk memberitahu warga bahwa mesin sudah siap menerima botol
      set({ deviceId: device.deviceId, status: "Terhubung (Mesin Terkunci untuk Anda)" });

    } catch (error) {
      console.error("Error BLE:", error);
      set({ status: "Gagal Terhubung / Dibatalkan" });
    }
  },

  disconnectRVM: async () => {
    const { deviceId } = get();
    if (deviceId) {
      await BleClient.disconnect(deviceId);
      set({ deviceId: null, status: "Gateway Offline" });
    }
  },
}));