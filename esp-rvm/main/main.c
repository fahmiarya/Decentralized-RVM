#include <stdio.h>
#include <string.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "driver/gpio.h"
#include "nvs_flash.h"
#include "nvs.h"
#include "esp_log.h"
#include "host/ble_hs.h"
#include "host/util/util.h"
#include "nimble/nimble_port.h"
#include "nimble/nimble_port_freertos.h"
#include "services/gap/ble_svc_gap.h"
#include "services/gatt/ble_svc_gatt.h"
#include "esp_mac.h"
#include "mbedtls/ecdsa.h"
#include "mbedtls/sha256.h"
#include "mbedtls/entropy.h"
#include "mbedtls/ctr_drbg.h"

#define TAG "RVM_SENSOR_SIM"

// Menggunakan tombol BOOT bawaan ESP32-C6 (biasanya GPIO 9)
#define BUTTON_GPIO GPIO_NUM_9

// UUID (Telah diselaraskan persis dengan RVM_SERVICE_UUID di Next.js)
// "4fafc201-1fb5-459e-8fcc-c5c9c331914b" dalam format array dibalik (Little Endian)
static const ble_uuid128_t gatt_svc_rvm_uuid =
    BLE_UUID128_INIT(0x4b, 0x91, 0x31, 0xc3, 0xc9, 0xc5, 0xcc, 0x8f,
                     0x9e, 0x45, 0xb5, 0x1f, 0x01, 0xc2, 0xaf, 0x4f);

// UUID (Telah diselaraskan dengan RVM_CHARACTERISTIC_UUID)
// "beb5483e-36e1-4688-b7f5-ea07361b26a8"
static const ble_uuid128_t gatt_chr_sensor_uuid =
    BLE_UUID128_INIT(0xa8, 0x26, 0x1b, 0x36, 0x07, 0xea, 0xf5, 0xb7,
                     0x88, 0x46, 0xe1, 0x36, 0x3e, 0x48, 0xb5, 0xbe);

uint16_t conn_handle = BLE_HS_CONN_HANDLE_NONE;
uint16_t sensor_val_handle;
static bool notify_state = false;

// Variabel penampung data (buffer) untuk karakteristik
// DIBESARKAN menjadi 256 byte karena Signature Ethereum sangat panjang (130 karakter hex)
uint8_t sensor_data_val[256] = {0};
uint16_t sensor_data_len = 0;

// Variabel State Mesin RVM
uint32_t total_plastic = 0; // Simulasi jumlah botol
uint32_t total_metal = 0;   // Simulasi jumlah kaleng
uint32_t current_nonce = 0; // Nonce untuk Anti-Replay Attack

// Private Key Dummy ESP32 (Hanya untuk testing, JANGAN isi dengan uang asli)
// Di dunia nyata, ini disimpan di partisi NVS yang dienkripsi
const char *ESP32_PRIVATE_KEY = "59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
const char *ESP32_PUBLIC_ADDRESS = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";

void ble_app_advertise(void);

// Fungsi ini akan dipanggil jika HP meminta untuk membaca data secara manual
static int device_access_cb(uint16_t conn_handle, uint16_t attr_handle,

                            struct ble_gatt_access_ctxt *ctxt, void *arg)
{
    // Salin data dari buffer internal kita ke buffer transmisi BLE
    int rc = os_mbuf_append(ctxt->om, &sensor_data_val, sensor_data_len);
    return rc == 0 ? 0 : BLE_ATT_ERR_INSUFFICIENT_RES;
}

// Struktur Layanan dan Karakteristik
static const struct ble_gatt_svc_def gatt_svr_svcs[] = {
    {
        .type = BLE_GATT_SVC_TYPE_PRIMARY,
        .uuid = &gatt_svc_rvm_uuid.u,
        .characteristics = (struct ble_gatt_chr_def[]){
            {
                .uuid = &gatt_chr_sensor_uuid.u,
                .access_cb = device_access_cb,
                .val_handle = &sensor_val_handle,
                // Mengizinkan HP untuk membaca (READ) dan menerima notifikasi (NOTIFY)
                .flags = BLE_GATT_CHR_F_READ | BLE_GATT_CHR_F_NOTIFY,
            },
            {0},
        },
    },
    {0},
};

// Event Handler BLE
static int ble_gap_event(struct ble_gap_event *event, void *arg)
{
    switch (event->type)
    {
    case BLE_GAP_EVENT_CONNECT:
        ESP_LOGI(TAG, "CONNECTED (Handle: %d)", event->connect.conn_handle);
        conn_handle = event->connect.conn_handle;

        // Meminta pertukaran MTU agar bisa mengirim data panjang (> 23 bytes)
        ble_gattc_exchange_mtu(conn_handle, NULL, NULL);
        break;

    case BLE_GAP_EVENT_DISCONNECT:
        ESP_LOGW(TAG, "DISCONNECTED");
        conn_handle = BLE_HS_CONN_HANDLE_NONE;
        notify_state = false;
        ble_app_advertise();
        break;

    case BLE_GAP_EVENT_SUBSCRIBE:
        ESP_LOGI(TAG, "Subscribe Event: Client %s Notifikasi", event->subscribe.cur_notify ? "Mengaktifkan" : "Mematikan");
        notify_state = event->subscribe.cur_notify;
        break;
    }
    return 0;
}

// Pengaturan Iklan (Advertising)
void ble_app_advertise(void)
{
    struct ble_gap_adv_params adv_params;
    struct ble_hs_adv_fields fields;
    struct ble_hs_adv_fields rsp_fields;
    int rc;

    // 1. PAKET IKLAN UTAMA (Maksimal 31 Byte)
    // Kita hanya memasukkan Flags dan UUID di sini agar muat
    memset(&fields, 0, sizeof fields);
    fields.flags = BLE_HS_ADV_F_DISC_GEN | BLE_HS_ADV_F_BREDR_UNSUP;

    fields.uuids128 = (ble_uuid128_t *)&gatt_svc_rvm_uuid;
    fields.num_uuids128 = 1;
    fields.uuids128_is_complete = 1;

    rc = ble_gap_adv_set_fields(&fields);
    if (rc != 0)
    {
        ESP_LOGE(TAG, "Gagal set adv fields: %d", rc);
        return;
    }

    // 2. PAKET SCAN RESPONSE (Paket Tambahan)
    // Kita menaruh Nama Perangkat ("RVM_SENSOR") di sini
    memset(&rsp_fields, 0, sizeof rsp_fields);
    const char *device_name = "RVM_SENSOR";
    rsp_fields.name = (uint8_t *)device_name;
    rsp_fields.name_len = strlen(device_name);
    rsp_fields.name_is_complete = 1;

    rc = ble_gap_adv_rsp_set_fields(&rsp_fields);
    if (rc != 0)
    {
        ESP_LOGE(TAG, "Gagal set scan response: %d", rc);
        return;
    }

    // 3. MULAI MENYIARKAN IKLAN
    memset(&adv_params, 0, sizeof adv_params);
    adv_params.conn_mode = BLE_GAP_CONN_MODE_UND;
    adv_params.disc_mode = BLE_GAP_DISC_MODE_GEN;

    rc = ble_gap_adv_start(BLE_OWN_ADDR_PUBLIC, NULL, BLE_HS_FOREVER, &adv_params, ble_gap_event, NULL);
    if (rc != 0)
    {
        ESP_LOGE(TAG, "Gagal memulai iklan (Start Adv): %d", rc);
    }
    else
    {
        ESP_LOGI(TAG, "Iklan BLE berhasil dipancarkan!");
    }
}

void ble_app_on_sync(void)
{
    int rc = ble_hs_util_ensure_addr(0);
    assert(rc == 0);
    ble_app_advertise();
    ESP_LOGI(TAG, "RVM Siap. Tekan Tombol BOOT untuk kirim data!");
}

void ble_host_task(void *param)
{
    nimble_port_run();
    nimble_port_freertos_deinit();
}

// Fungsi pembantu 1: Ubah 1 huruf menjadi angka mutlak
uint8_t char2int(char c)
{
    if (c >= '0' && c <= '9')
        return c - '0';
    if (c >= 'a' && c <= 'f')
        return c - 'a' + 10;
    if (c >= 'A' && c <= 'F')
        return c - 'A' + 10;
    return 0;
}

// Fungsi pembantu 2: Konversi String Hex ke Byte Array (100% Aman)
void hex2bytes(const char *hex, uint8_t *bytes, size_t len)
{
    for (size_t i = 0; i < len; i++)
    {
        // Menggabungkan 2 karakter hex menjadi 1 byte (contoh: '7' dan '0' -> 0x70)
        bytes[i] = (char2int(hex[i * 2]) << 4) | char2int(hex[i * 2 + 1]);
    }
}

// MESIN KRIPTOGRAFI UTAMA
void generate_signature(uint32_t plastic, uint32_t metal, uint32_t nonce, const char *priv_key_hex, const char *addr_hex, char *sig_out)
{
    // 1. Pengepakan Data (Sesuai format abi.encodePacked di Solidity = 116 bytes)
    uint8_t pack[116] = {0};

    // Ethereum menggunakan Big-Endian. Kita geser byte-nya.
    pack[28] = plastic >> 24;
    pack[29] = plastic >> 16;
    pack[30] = plastic >> 8;
    pack[31] = plastic;
    pack[60] = metal >> 24;
    pack[61] = metal >> 16;
    pack[62] = metal >> 8;
    pack[63] = metal;
    pack[92] = nonce >> 24;
    pack[93] = nonce >> 16;
    pack[94] = nonce >> 8;
    pack[95] = nonce;
    hex2bytes(addr_hex + 2, &pack[96], 20); // Masukkan Address di byte 96-115 (skip "0x")

    // 2. Hashing menggunakan SHA256 bawaan ESP32
    uint8_t hash[32];
    mbedtls_sha256(pack, 116, hash, 0);

    // 3. Inisialisasi Mesin Tanda Tangan (ECDSA)
    mbedtls_ecdsa_context ctx;
    mbedtls_entropy_context entropy;
    mbedtls_ctr_drbg_context ctr_drbg;
    mbedtls_ecdsa_init(&ctx);
    mbedtls_entropy_init(&entropy);
    mbedtls_ctr_drbg_init(&ctr_drbg);

    const char *pers = "rvm_signer";
    mbedtls_ctr_drbg_seed(&ctr_drbg, mbedtls_entropy_func, &entropy, (const unsigned char *)pers, strlen(pers));

    // 4. Muat Kurva Ethereum (secp256k1) dan Private Key
    mbedtls_ecp_group_load(&ctx.MBEDTLS_PRIVATE(grp), MBEDTLS_ECP_DP_SECP256K1);
    mbedtls_mpi_read_string(&ctx.MBEDTLS_PRIVATE(d), 16, priv_key_hex);

    // 5. Eksekusi Tanda Tangan Digital!
    mbedtls_mpi r, s;
    mbedtls_mpi_init(&r);
    mbedtls_mpi_init(&s);
    mbedtls_ecdsa_sign(&ctx.MBEDTLS_PRIVATE(grp), &r, &s, &ctx.MBEDTLS_PRIVATE(d), hash, 32, mbedtls_ctr_drbg_random, &ctr_drbg);

    // 6. Ubah hasil matematis ke Biner, lalu ke String (Hex)
    uint8_t r_buf[32] = {0};
    uint8_t s_buf[32] = {0};

    // Tulis ke dalam buffer biner 32-byte (Otomatis ditambah angka nol di depan jika kurang)
    mbedtls_mpi_write_binary(&r, r_buf, 32);
    mbedtls_mpi_write_binary(&s, s_buf, 32);

    // Konversi buffer biner ke string Hexadecimal yang sempurna
    for (int i = 0; i < 32; i++)
    {
        sprintf(&sig_out[i * 2], "%02x", r_buf[i]);
    }
    for (int i = 0; i < 32; i++)
    {
        sprintf(&sig_out[64 + (i * 2)], "%02x", s_buf[i]);
    }

    // Bersihkan Memori (Sangat penting agar ESP32 tidak Crash)
    mbedtls_mpi_free(&r);
    mbedtls_mpi_free(&s);
    mbedtls_ecdsa_free(&ctx);
    mbedtls_ctr_drbg_free(&ctr_drbg);
    mbedtls_entropy_free(&entropy);
}

// Task untuk memantau tombol
void button_task(void *arg)
{
    gpio_config_t io_conf = {};
    io_conf.pin_bit_mask = (1ULL << BUTTON_GPIO);
    io_conf.mode = GPIO_MODE_INPUT;
    io_conf.pull_up_en = 1;
    io_conf.pull_down_en = 0;
    io_conf.intr_type = GPIO_INTR_DISABLE;
    gpio_config(&io_conf);

    int last_state = 1;

    while (1)
    {
        int current_state = gpio_get_level(BUTTON_GPIO);

        // Deteksi tombol ditekan (Transisi HIGH ke LOW)
        if (last_state == 1 && current_state == 0)
        {
            // 1. LOGIKA RVM: Tambah jumlah sampah & Nonce
            total_plastic += 1;
            current_nonce += 1;

            ESP_LOGI(TAG, "Botol Masuk! Total Plastik: %lu | Nonce: %lu", total_plastic, current_nonce);

            if (conn_handle != BLE_HS_CONN_HANDLE_NONE && notify_state)
            {
                // 2. PROSES KRIPTOGRAFI (Placeholder Tahap 1)
                // Di sini nanti kita akan memanggil fungsi:
                // bytes32 hash = keccak256(abi.encodePacked(userAddress, total_plastic, total_metal, current_nonce));
                // char* signature = ecdsa_sign(hash, ESP32_PRIVATE_KEY);

                // Untuk sekarang, kita gunakan Signature Dummy (panjang 130 karakter hex)
                char rs_hex[130];
                generate_signature(total_plastic, total_metal, current_nonce, ESP32_PRIVATE_KEY, ESP32_PUBLIC_ADDRESS, rs_hex);

                // 3. FORMAT PAYLOAD
                // Format CSV yang sangat ringan untuk BLE: "Plastik,Metal,Nonce,Signature"
                // Contoh: "1,0,1,0x1234..."

                char payload[256];
                // Tambahkan "0x" di depan rs_hex saat dikirim ke BLE
                snprintf(payload, sizeof(payload), "%lu,%lu,%lu,0x%s",
                         total_plastic, total_metal, current_nonce, rs_hex);

                // 4. KIRIM VIA BLE
                memset(sensor_data_val, 0, sizeof(sensor_data_val));
                memcpy(sensor_data_val, payload, strlen(payload));
                sensor_data_len = strlen(payload);

                ble_gatts_chr_updated(sensor_val_handle);

                ESP_LOGI(TAG, "Payload Terkirim (%d bytes): %s", sensor_data_len, payload);
            }
            else
            {
                ESP_LOGW(TAG, "Gagal kirim: HP belum terhubung/Subscribe");
            }
        }

        last_state = current_state;
        vTaskDelay(pdMS_TO_TICKS(100)); // Debouncing
    }
}

void app_main(void)
{

    // uint8_t new_mac[6] = {0xAA, 0xBB, 0xCC, 0xDD, 0xEE, 0x01};
    // esp_base_mac_addr_set(new_mac);

    // PENGAMAN NVS: Sangat krusial untuk ESP-IDF. Jika memori NVS penuh/rusak, BLE tidak bisa nyala.
    esp_err_t ret = nvs_flash_init();
    if (ret == ESP_ERR_NVS_NO_FREE_PAGES || ret == ESP_ERR_NVS_NEW_VERSION_FOUND)
    {
        ESP_ERROR_CHECK(nvs_flash_erase());
        ret = nvs_flash_init();
    }
    ESP_ERROR_CHECK(ret);

    nimble_port_init();
    ble_svc_gap_init();
    ble_svc_gatt_init();

    ble_gatts_count_cfg(gatt_svr_svcs);
    ble_gatts_add_svcs(gatt_svr_svcs);
    ble_svc_gap_device_name_set("RVM_SENSOR");

    ble_hs_cfg.sync_cb = ble_app_on_sync;
    nimble_port_freertos_init(ble_host_task);

    // Jalankan task pembaca tombol
    xTaskCreate(button_task, "btn_task", 8192, NULL, 5, NULL);
}