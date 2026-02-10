// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract RVM {
    // 1. Variabel State (Penyimpanan Data di Blockchain)
    // Menyimpan total botol yang pernah dimasukkan ke sistem ini
    uint256 public totalBotol;
    
    // Menyimpan jumlah botol per alamat dompet (User)
    mapping(address => uint256) public saldoUser;

    // 2. Event (Agar bisa dipantau di log)
    // Memberitahu dunia luar bahwa ada botol masuk
    event BotolDiterima(address indexed user, uint256 totalBaru, uint256 waktu);

    // 3. Fungsi Utama (Yang akan dipanggil oleh Laptop/Node.js)
    function tambahBotol() public {
        // Tambah counter global
        totalBotol += 1;
        
        // Tambah saldo si pengirim (Wallet di Node.js)
        saldoUser[msg.sender] += 1;

        // Kabari blockchain bahwa transaksi terjadi
        emit BotolDiterima(msg.sender, totalBotol, block.timestamp);
    }
    
    // Fungsi tambahan untuk cek saldo user tertentu (Opsional)
    function cekSaldo(address _user) public view returns (uint256) {
        return saldoUser[_user];
    }
}