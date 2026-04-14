import { BleClient, dataViewToText } from "@capacitor-community/bluetooth-le";
import { create } from "zustand";

// UUID BLE ESP32 Anda
const RVM_SERVICE_UUID = "4fafc201-1fb5-459e-8fcc-c5c9c331914b";
const RVM_CHARACTERISTIC_UUID = "beb5483e-36e1-4688-b7f5-ea07361b26a8";

interface BleState {
  deviceId: string | null;
  status: string;
  sensorData: string;
  transactions: string[];

  latestPayload: { plastic: number; metal: number; nonce: number; signature: `0x${string}` } | null;
  clearPayload: () => void;

  connectToRVM: () => Promise<void>;
  disconnectRVM: () => Promise<void>;
}

export const useBleStore = create<BleState>((set, get) => ({
  deviceId: null,
  status: "Gateway Offline",
  sensorData: "Belum ada data...",
  transactions: [],

  latestPayload: null,
  clearPayload: () => set({ latestPayload: null }),

  connectToRVM: async () => {
    try {
      await BleClient.initialize({ androidNeverForLocation: true });
      set({ status: "Mencari RVM..." });

      const device = await BleClient.requestDevice({
        services: [RVM_SERVICE_UUID],
      });

      // Update state bahwa kita sedang mencoba terhubung
      set({ status: `Menyambungkan ke ${device.name || "ESP32"}...` });

      await BleClient.connect(device.deviceId);

      // Jika berhasil connect, simpan device ID-nya
      set({ deviceId: device.deviceId, status: `Terhubung: ${device.name}` });

      // --- BAGIAN YANG DISESUAIKAN (DATA PARSER) ---
      // Mulai dengarkan notifikasi (Data dari ESP32)
      await BleClient.startNotifications(device.deviceId, RVM_SERVICE_UUID, RVM_CHARACTERISTIC_UUID, value => {
        // 1. Ubah data biner (DataView) dari Bluetooth menjadi Teks (String)
        const rawData = dataViewToText(value);
        console.log("📥 Data mentah dari ESP32 masuk:", rawData);

        // 2. Pecah data berdasarkan koma (Format: Plastik,Metal,Nonce,Signature)
        const dataParts = rawData.split(",");

        // 3. Validasi apakah format datanya benar (harus ada 4 potongan data)
        if (dataParts.length === 4) {
          const totalPlastic = parseInt(dataParts[0]);
          const totalMetal = parseInt(dataParts[1]);
          const nonce = parseInt(dataParts[2]);
          const signature = dataParts[3];

          console.log(`✅ Data tervalidasi - Plastik: ${totalPlastic}, Metal: ${totalMetal}, Nonce: ${nonce}`);

          // 4. Update state agar UI di halaman Home berubah menjadi lebih rapi
          set(state => ({
            sensorData: `Plastik: ${totalPlastic} | Metal: ${totalMetal}`,
            // Tambahkan data mentah ke riwayat transaksi di posisi paling atas
            transactions: [rawData, ...state.transactions],

            latestPayload: {
              plastic: totalPlastic,
              metal: totalMetal,
              nonce: nonce,
              signature: signature as `0x${string}`,
            },
          }));

          // TODO: Nanti di baris ini kita akan menyisipkan hook dari wagmi
          // untuk memicu Smart Contract batchClaim() ke jaringan Polygon/Hardhat!
        } else {
          console.error("❌ Format data dari ESP32 tidak dikenali/terpotong:", rawData);
        }
      });
      // ----------------------------------------------
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
