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

// UUID
// 1. Service UUID: 4fafc201-1fb5-459e-8fcc-c5c9c331914b
static const ble_uuid128_t gatt_svc_rvm_uuid =
    BLE_UUID128_INIT(0x4b, 0x91, 0x31, 0xc3, 0xc9, 0xc5, 0xcc, 0x8f,
                     0x9e, 0x45, 0xb5, 0x1f, 0x01, 0xc2, 0xaf, 0x4f);

// 2. Notify UUID: beb5483e-36e1-4688-b7f5-ea07361b26a8
static const ble_uuid128_t gatt_chr_sensor_uuid =
    BLE_UUID128_INIT(0xa8, 0x26, 0x1b, 0x36, 0x07, 0xea, 0xf5, 0xb7,
                     0x88, 0x46, 0xe1, 0x36, 0x3e, 0x48, 0xb5, 0xbe);

// 3. Write Wallet UUID: cfc6594f-47f2-5799-c806-fb18472c37b9
static const ble_uuid128_t gatt_chr_wallet_uuid =
    BLE_UUID128_INIT(0xb9, 0x37, 0x2c, 0x47, 0x18, 0xfb, 0x06, 0xc8,
                     0x99, 0x57, 0xf2, 0x47, 0x4f, 0x59, 0xc6, 0xcf);

uint16_t wallet_val_handle;
uint16_t conn_handle = BLE_HS_CONN_HANDLE_NONE;
uint16_t sensor_val_handle;
static bool notify_state = false;

char current_user_wallet_hex[41] = {0}; // Menyimpan "0x..." dari HP
bool is_session_active = false;
uint32_t last_activity_time = 0;
const uint32_t TIMEOUT_MS = 60000;

// Buffer data
uint8_t sensor_data_val[256] = {0};
uint16_t sensor_data_len = 0;

// Variabel State Mesin RVM
uint32_t total_plastic = 0;
uint32_t total_metal = 0;
uint32_t current_nonce = 0;

// Private Key Dummy ESP32
const char *ESP32_PRIVATE_KEY = "59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
const char *ESP32_PUBLIC_ADDRESS = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";

void load_nonce_from_nvs()
{
    nvs_handle_t my_handle;
    esp_err_t err = nvs_open("rvm_state", NVS_READWRITE, &my_handle);
    if (err != ESP_OK)
        return;

    // Baca nonce terakhir yang tersimpan
    err = nvs_get_u32(my_handle, "nonce", &current_nonce);
    if (err == ESP_ERR_NVS_NOT_FOUND)
    {
        current_nonce = 0; // Jika baru pertama kali nyala dari pabrik
    }
    nvs_close(my_handle);
    ESP_LOGI(TAG, "=> Nonce Terakhir Dimuat dari NVS: %lu", current_nonce);
}

void save_nonce_to_nvs()
{
    nvs_handle_t my_handle;
    esp_err_t err = nvs_open("rvm_state", NVS_READWRITE, &my_handle);
    if (err == ESP_OK)
    {
        nvs_set_u32(my_handle, "nonce", current_nonce);
        nvs_commit(my_handle);
        nvs_close(my_handle);
        ESP_LOGI(TAG, "=> Nonce %lu berhasil disimpan ke NVS!", current_nonce);
    }
}

void ble_app_advertise(void);

static int device_access_cb(uint16_t conn_handle, uint16_t attr_handle,
                            struct ble_gatt_access_ctxt *ctxt, void *arg)
{
    int rc = os_mbuf_append(ctxt->om, &sensor_data_val, sensor_data_len);
    return rc == 0 ? 0 : BLE_ATT_ERR_INSUFFICIENT_RES;
}

static int wallet_write_cb(uint16_t conn_handle, uint16_t attr_handle,
                           struct ble_gatt_access_ctxt *ctxt, void *arg)
{
    if (ctxt->op == BLE_GATT_ACCESS_OP_WRITE_CHR)
    {
        char buffer[45] = {0}; // Menampung "0x..."
        int len = OS_MBUF_PKTLEN(ctxt->om);

        if (len > 0 && len <= 42)
        {
            os_mbuf_copydata(ctxt->om, 0, len, buffer);

            // Bersihkan prefix "0x" jika ada dari aplikasi HP
            const char *hex_start = buffer;
            if (buffer[0] == '0' && (buffer[1] == 'x' || buffer[1] == 'X'))
            {
                hex_start = buffer + 2;
                len -= 2;
            }

            // Validasi panjang Wallet Address Ethereum/Polygon (40 karakter hex)
            if (len == 40)
            {
                strncpy(current_user_wallet_hex, hex_start, 40);
                current_user_wallet_hex[40] = '\0'; // Null terminator aman

                // MENGUNCI SESI!
                is_session_active = true;
                last_activity_time = xTaskGetTickCount() * portTICK_PERIOD_MS;
                total_plastic = 0; // Reset counter
                total_metal = 0;

                ESP_LOGI(TAG, "🔒 MESIN TERKUNCI UNTUK WALLET: 0x%s", current_user_wallet_hex);
                ESP_LOGI(TAG, "🟢 Silakan masukkan botol Anda sekarang.");
            }
            else
            {
                ESP_LOGE(TAG, "❌ Format Wallet salah! Panjang: %d", len);
            }
        }
    }
    return 0;
}

static const struct ble_gatt_svc_def gatt_svr_svcs[] = {
    {
        .type = BLE_GATT_SVC_TYPE_PRIMARY,
        .uuid = &gatt_svc_rvm_uuid.u,
        .characteristics = (struct ble_gatt_chr_def[]){
            {
                .uuid = &gatt_chr_sensor_uuid.u,
                .access_cb = device_access_cb,
                .val_handle = &sensor_val_handle,
                .flags = BLE_GATT_CHR_F_READ | BLE_GATT_CHR_F_NOTIFY,
            },
            {
                // 2. [TAMBAHAN BARU] Karakteristik Tulis (Terima Wallet dari HP)
                .uuid = &gatt_chr_wallet_uuid.u,
                .access_cb = wallet_write_cb,
                .val_handle = &wallet_val_handle,
                .flags = BLE_GATT_CHR_F_WRITE,
            },
            {0},
        },
    },
    {0},
};

static int ble_gap_event(struct ble_gap_event *event, void *arg)
{
    switch (event->type)
    {
    case BLE_GAP_EVENT_CONNECT:
        ESP_LOGI(TAG, "CONNECTED (Handle: %d)", event->connect.conn_handle);
        conn_handle = event->connect.conn_handle;
        ble_gattc_exchange_mtu(conn_handle, NULL, NULL);

        // ==========================================
        // SESI BARU DIMULAI (HP Terhubung)
        // ==========================================
        total_plastic = 0;
        total_metal = 0;
        current_nonce += 1; // Buat ID Transaksi (Nonce) baru untuk sesi ini

        save_nonce_to_nvs();

        ESP_LOGI(TAG, "--- SESI RVM DIMULAI ---");
        ESP_LOGI(TAG, "Nonce Sesi Ini: %lu", current_nonce);
        break;

    case BLE_GAP_EVENT_DISCONNECT:
        ESP_LOGW(TAG, "DISCONNECTED");
        conn_handle = BLE_HS_CONN_HANDLE_NONE;
        notify_state = false;

        // ==========================================
        // SESI SELESAI (HP Terputus / Pergi)
        // ==========================================
        total_plastic = 0; // Bersihkan sisa memori botol
        total_metal = 0;

        ESP_LOGI(TAG, "--- SESI RVM SELESAI --- (Memori di-reset)");

        ble_app_advertise(); // Nyalakan iklan lagi agar HP lain bisa konek
        break;

    case BLE_GAP_EVENT_SUBSCRIBE:
        ESP_LOGI(TAG, "Subscribe Event: Client %s Notifikasi", event->subscribe.cur_notify ? "Mengaktifkan" : "Mematikan");
        notify_state = event->subscribe.cur_notify;
        break;
    }
    return 0;
}

void ble_app_advertise(void)
{
    struct ble_gap_adv_params adv_params;
    struct ble_hs_adv_fields fields;
    struct ble_hs_adv_fields rsp_fields;
    int rc;

    memset(&fields, 0, sizeof fields);
    fields.flags = BLE_HS_ADV_F_DISC_GEN | BLE_HS_ADV_F_BREDR_UNSUP;
    fields.uuids128 = (ble_uuid128_t *)&gatt_svc_rvm_uuid;
    fields.num_uuids128 = 1;
    fields.uuids128_is_complete = 1;

    rc = ble_gap_adv_set_fields(&fields);
    if (rc != 0)
        return;

    memset(&rsp_fields, 0, sizeof rsp_fields);
    const char *device_name = "RVM_SENSOR";
    rsp_fields.name = (uint8_t *)device_name;
    rsp_fields.name_len = strlen(device_name);
    rsp_fields.name_is_complete = 1;

    rc = ble_gap_adv_rsp_set_fields(&rsp_fields);
    if (rc != 0)
        return;

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

void hex2bytes(const char *hex, uint8_t *bytes, size_t len)
{
    for (size_t i = 0; i < len; i++)
    {
        bytes[i] = (char2int(hex[i * 2]) << 4) | char2int(hex[i * 2 + 1]);
    }
}

bool generate_signature(uint32_t plastic, uint32_t metal, uint32_t nonce, const char *priv_key_hex, const char *addr_hex, const char *user_wallet_hex, char *sig_out)
{
    // [UPDATE]: Ukuran payload sekarang 136 byte (karena ketambahan 20 byte dompet user)
    uint8_t pack[136] = {0};

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

    // Masukkan alamat ESP32 (Device Address)
    hex2bytes(addr_hex + 2, &pack[96], 20);

    // [TAMBAHAN BARU]: Masukkan alamat dompet warga (msg.sender) di belakangnya!
    // current_user_wallet_hex sudah dibersihkan dari "0x" saat diterima via Bluetooth
    hex2bytes(user_wallet_hex, &pack[116], 20);

    uint8_t hash[32];
    mbedtls_sha256(pack, 136, hash, 0); // Pastikan angka 136 di sini

    mbedtls_ecdsa_context ctx;
    mbedtls_entropy_context entropy;
    mbedtls_ctr_drbg_context ctr_drbg;
    mbedtls_ecdsa_init(&ctx);
    mbedtls_entropy_init(&entropy);
    mbedtls_ctr_drbg_init(&ctr_drbg);

    const char *pers = "rvm_signer";
    mbedtls_ctr_drbg_seed(&ctr_drbg, mbedtls_entropy_func, &entropy, (const unsigned char *)pers, strlen(pers));

    mbedtls_ecp_group_load(&ctx.MBEDTLS_PRIVATE(grp), MBEDTLS_ECP_DP_SECP256K1);

    int ret;
    ret = mbedtls_mpi_read_string(&ctx.MBEDTLS_PRIVATE(d), 16, priv_key_hex);
    if (ret != 0)
    {
        ESP_LOGE(TAG, "❌ Gagal membaca Private Key! Error: -0x%04X", -ret);
        goto cleanup;
    }

    mbedtls_mpi r, s;
    mbedtls_mpi_init(&r);
    mbedtls_mpi_init(&s);

    ret = mbedtls_ecdsa_sign(&ctx.MBEDTLS_PRIVATE(grp), &r, &s, &ctx.MBEDTLS_PRIVATE(d), hash, 32, mbedtls_ctr_drbg_random, &ctr_drbg);
    if (ret != 0)
    {
        ESP_LOGE(TAG, "❌ Gagal ECDSA Sign! Error: -0x%04X", -ret);
        mbedtls_mpi_free(&r);
        mbedtls_mpi_free(&s);
        goto cleanup;
    }

    uint8_t r_buf[32] = {0};
    uint8_t s_buf[32] = {0};

    mbedtls_mpi_write_binary(&r, r_buf, 32);
    mbedtls_mpi_write_binary(&s, s_buf, 32);

    for (int i = 0; i < 32; i++)
        sprintf(&sig_out[i * 2], "%02x", r_buf[i]);
    for (int i = 0; i < 32; i++)
        sprintf(&sig_out[64 + (i * 2)], "%02x", s_buf[i]);

    mbedtls_mpi_free(&r);
    mbedtls_mpi_free(&s);

cleanup:
    mbedtls_ecdsa_free(&ctx);
    mbedtls_ctr_drbg_free(&ctr_drbg);
    mbedtls_entropy_free(&entropy);

    return (ret == 0);
}

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

        if (is_session_active)
        {
            uint32_t current_time = xTaskGetTickCount() * portTICK_PERIOD_MS;
            if ((current_time - last_activity_time) > TIMEOUT_MS)
            {
                ESP_LOGW(TAG, "⏱️ Waktu habis (60 detik)! Sesi dibatalkan.");

                // Reset Sesi
                is_session_active = false;
                total_plastic = 0;
                total_metal = 0;
                memset(current_user_wallet_hex, 0, sizeof(current_user_wallet_hex));

                // Putuskan paksa koneksi Bluetooth agar warga tahu waktunya habis
                if (conn_handle != BLE_HS_CONN_HANDLE_NONE)
                {
                    ble_gap_terminate(conn_handle, BLE_ERR_REM_USER_CONN_TERM);
                }
            }
        }

        int current_state = gpio_get_level(BUTTON_GPIO);
        if (last_state == 1 && current_state == 0)
        {
            // CEK: Apakah ada HP yang sedang konek?
            if (conn_handle != BLE_HS_CONN_HANDLE_NONE)
            {
                total_plastic += 1;
                ESP_LOGI(TAG, "Botol Masuk! Total: %lu | Nonce Sesi: %lu", total_plastic, current_nonce);

                if (notify_state)
                {
                    char rs_hex[130];
                    bool is_sign_success = generate_signature(total_plastic, total_metal, current_nonce, ESP32_PRIVATE_KEY, ESP32_PUBLIC_ADDRESS, current_user_wallet_hex, rs_hex);

                    if (is_sign_success)
                    {
                        // Kemas Payload
                        char payload[256];
                        snprintf(payload, sizeof(payload), "%lu,%lu,%lu,0x%s",
                                 total_plastic, total_metal, current_nonce, rs_hex);

                        memset(sensor_data_val, 0, sizeof(sensor_data_val));
                        memcpy(sensor_data_val, payload, strlen(payload));
                        sensor_data_len = strlen(payload);

                        // Tembakkan via Bluetooth
                        ble_gatts_chr_updated(sensor_val_handle);
                        ESP_LOGI(TAG, "=> Payload Terkirim ke HP warga!");
                    }
                    else
                    {
                        // Jangan kirim apa-apa agar HP tidak menerima data sampah
                        ESP_LOGE(TAG, "⛔ Batal mengirim data via BLE karena gagal membuat Digital Signature!");
                    }
                }
            }
            else
            {
                // Jika tidak ada HP yang konek, botol tidak dihitung
                ESP_LOGW(TAG, "Botol ditolak! Tidak ada Aplikasi HP yang terhubung.");
            }
        }

        last_state = current_state;
        vTaskDelay(pdMS_TO_TICKS(100)); // Debouncing
    }
}

void app_main(void)
{
    esp_err_t ret = nvs_flash_init();
    if (ret == ESP_ERR_NVS_NO_FREE_PAGES || ret == ESP_ERR_NVS_NEW_VERSION_FOUND)
    {
        ESP_ERROR_CHECK(nvs_flash_erase());
        ret = nvs_flash_init();
    }
    ESP_ERROR_CHECK(ret);

    load_nonce_from_nvs();

    ble_att_set_preferred_mtu(256);

    nimble_port_init();
    ble_svc_gap_init();
    ble_svc_gatt_init();

    ble_gatts_count_cfg(gatt_svr_svcs);
    ble_gatts_add_svcs(gatt_svr_svcs);
    ble_svc_gap_device_name_set("RVM_SENSOR");

    ble_hs_cfg.sync_cb = ble_app_on_sync;
    nimble_port_freertos_init(ble_host_task);

    xTaskCreate(button_task, "btn_task", 8192, NULL, 5, NULL);
}