// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title CommunityRVM
 * @dev Kontrak instansi untuk satu komunitas. Mendukung Token Kustom & Token Pasar (USDT).
 */
contract CommunityRVM is ERC20, Ownable {
    using ECDSA for bytes32;

    uint256 public rewardRatePlastic;
    uint256 public rewardRateMetal;
    bool public isOpenCommunity;

    // Variabel Brankas: Jika diisi alamat, kontrak akan memakai Token Pasar (misal USDT)
    // Jika kosong (address 0), kontrak akan mencetak Token Kustom
    IERC20 public marketToken;

    // Mapping untuk mencegah serangan replay (Anti-Replay)
    mapping(address => mapping(uint256 => bool)) public usedNonces;

    // Whitelist public address dari perangkat keras (ESP32)
    mapping(address => bool) public whitelistedDevices;

    event DeviceWhitelisted(address device, bool status);
    event RewardRatesUpdated(uint256 newPlasticRate, uint256 newMetalRate);
    event RewardsClaimed(address indexed user, uint256 amount);

    constructor(
        string memory name,
        string memory symbol,
        address initialOwner,
        uint256 _ratePlastic,
        uint256 _rateMetal,
        bool _isOpenCommunity,
        address _marketTokenAddress
    ) ERC20(name, symbol) Ownable(initialOwner) {
        rewardRatePlastic = _ratePlastic;
        rewardRateMetal = _rateMetal;
        isOpenCommunity = _isOpenCommunity;

        // Deteksi Model Ekonomi Token
        if (_marketTokenAddress != address(0)) {
            marketToken = IERC20(_marketTokenAddress);
        }
    }

    // --- PANEL MANAJEMEN PERANGKAT (ADMIN ONLY) ---
    function setWhitelistedDevice(address device, bool status) external onlyOwner {
        whitelistedDevices[device] = status;
        emit DeviceWhitelisted(device, status);
    }

    // --- PANEL KONTROL EKONOMI (ADMIN ONLY) ---
    function updateRewardRates(uint256 _ratePlastic, uint256 _rateMetal) external onlyOwner {
        rewardRatePlastic = _ratePlastic;
        rewardRateMetal = _rateMetal;
        emit RewardRatesUpdated(_ratePlastic, _rateMetal);
    }

    // --- FUNGSI MOBILE-ASSISTED GATEWAY (BATCH CLAIM) ---
    function batchClaim(
        uint256 totalPlastic,
        uint256 totalMetal,
        uint256 nonce,
        address deviceAddress,
        bytes memory signature
    ) external {
        // 1. Validasi Perangkat (Hardware Root of Trust)
        require(whitelistedDevices[deviceAddress], "RVM: Perangkat tidak terotorisasi");

        // 2. Anti-Replay Protection
        require(!usedNonces[msg.sender][nonce], "RVM: Nonce sudah digunakan");

        // 3. Verifikasi Tanda Tangan Digital ECDSA (Menggunakan format asli Anda yang aman)
        bytes32 messageHash = sha256(abi.encodePacked(totalPlastic, totalMetal, nonce, deviceAddress));

        address signer = ECDSA.recover(messageHash, signature);
        require(signer == deviceAddress, "RVM: Manipulasi data terdeteksi (Signature tidak valid)");

        // 4. Eksekusi Pencetakan/Transfer Token
        usedNonces[msg.sender][nonce] = true;
        uint256 totalReward = (totalPlastic * rewardRatePlastic) + (totalMetal * rewardRateMetal);

        // 5. Penyaluran Dana (Sistem Hibrida)
        if (address(marketToken) != address(0)) {
            // MODE B: Transfer uang asli (USDT) dari brankas ke pengguna
            require(marketToken.balanceOf(address(this)) >= totalReward, "RVM: Brankas Kas Desa Kosong!");
            marketToken.transfer(msg.sender, totalReward);
        } else {
            // MODE A: Cetak Poin Komunitas Kustom dari udara kosong
            _mint(msg.sender, totalReward);
        }

        emit RewardsClaimed(msg.sender, totalReward);
    }
}

/**
 * @title RVMFactory
 * @dev Kontrak utama untuk mencetak (deploy) kontrak komunitas baru (Multi-tenancy).
 */
contract RVMFactory {
    address[] public deployedCommunities;

    event CommunityCreated(address indexed communityAddress, address indexed owner, bool isOpen);

    // --- PANEL INISIALISASI KOMUNITAS ---
    // Menerima 6 parameter dari form Next.js
    function createCommunity(
        string memory name,
        string memory symbol,
        uint256 ratePlastic,
        uint256 rateMetal,
        bool isOpenCommunity,
        address marketTokenAddress
    ) external returns (address) {
        // Msg.sender otomatis menjadi Owner/Admin dari instansi komunitas ini
        CommunityRVM newCommunity = new CommunityRVM(
            name,
            symbol,
            msg.sender,
            ratePlastic,
            rateMetal,
            isOpenCommunity,
            marketTokenAddress
        );

        deployedCommunities.push(address(newCommunity));

        emit CommunityCreated(address(newCommunity), msg.sender, isOpenCommunity);
        return address(newCommunity);
    }

    function getDeployedCommunities() external view returns (address[] memory) {
        return deployedCommunities;
    }
}
