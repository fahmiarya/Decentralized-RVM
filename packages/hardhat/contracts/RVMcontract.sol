// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol"; // <--- TAMBAHAN UNTUK MAINNET
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol"; // <--- TAMBAHAN UNTUK MAINNET
import "@openzeppelin/contracts/utils/Pausable.sol"; // <--- TAMBAHAN UNTUK MAINNET
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract CommunityRVM is ERC20, Ownable, ReentrancyGuard, Pausable {
    using ECDSA for bytes32;
    using SafeERC20 for IERC20; // Mengaktifkan transfer aman

    uint256 public rewardRatePlastic;
    uint256 public rewardRateMetal;
    bool public isOpenCommunity;
    mapping(address => bool) public isMember;

    uint256 public lifetimePlastic;
    uint256 public lifetimeMetal;

    IERC20 public marketToken;

    // [TAMBAHAN BARU] Batas maksimal item (plastik+metal) harian per mesin untuk menjaga Cost-to-Attack Ratio
    uint256 public dailyCapacityLimit;

    mapping(address => mapping(uint256 => bool)) public usedNonces;
    mapping(address => bool) public whitelistedDevices;
    address[] public registeredDevices;

    // [TAMBAHAN BARU] Mapping: Alamat Mesin -> Hari Ke-Berapa (timestamp / 1 days) -> Total item yang sudah diklaim
    mapping(address => mapping(uint256 => uint256)) public dailyDeviceClaims;

    event DeviceWhitelisted(address device, bool status);
    event RewardRatesUpdated(uint256 newPlasticRate, uint256 newMetalRate);
    event RewardsClaimed(address indexed user, uint256 amount);
    // [TAMBAHAN BARU] Event khusus jika kapasitas harian diubah
    event DailyCapacityUpdated(uint256 newCapacityLimit);

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

        // [TAMBAHAN BARU] Inisialisasi kapasitas harian default (Misal: 500 item per hari)
        dailyCapacityLimit = 500;

        if (_marketTokenAddress != address(0)) {
            marketToken = IERC20(_marketTokenAddress);
        }
    }

    // --- PANEL ADMIN (Bisa di-Pause saat keadaan darurat) ---
    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function setWhitelistedDevice(address device, bool status) external onlyOwner {
        // Jika sebelumnya belum terdaftar dan sekarang didaftarkan (true)
        if (status == true && whitelistedDevices[device] == false) {
            registeredDevices.push(device);
        }

        whitelistedDevices[device] = status;
    }

    function registerMember(address _user, bool _status) external onlyOwner {
        isMember[_user] = _status;
    }

    function getRegisteredDevices() external view returns (address[] memory) {
        return registeredDevices;
    }

    function updateRewardRates(uint256 _ratePlastic, uint256 _rateMetal) external onlyOwner {
        rewardRatePlastic = _ratePlastic;
        rewardRateMetal = _rateMetal;
        emit RewardRatesUpdated(_ratePlastic, _rateMetal);
    }

    // [TAMBAHAN BARU] Fungsi Admin untuk mengubah batas maksimal harian (Jika mesin fisik di-upgrade ukurannya)
    function updateDailyCapacityLimit(uint256 _newLimit) external onlyOwner {
        dailyCapacityLimit = _newLimit;
        emit DailyCapacityUpdated(_newLimit);
    }

    function emergencyWithdrawToken(uint256 amount) external onlyOwner {
        require(address(marketToken) != address(0), "Bukan mode market token");
        marketToken.safeTransfer(owner(), amount); // Gunakan safeTransfer
    }

    // ------------------------------------------------------------------------
    // 1. FUNGSI INTERNAL (Logic Utama - Validasi, Limit Harian, & Minting)
    // ------------------------------------------------------------------------
    function _processClaim(
        uint256 totalPlastic,
        uint256 totalMetal,
        uint256 nonce,
        address deviceAddress,
        bytes memory signature
    ) internal {
        require(whitelistedDevices[deviceAddress], "RVM: Perangkat tidak terotorisasi");
        require(!usedNonces[msg.sender][nonce], "RVM: Nonce sudah digunakan");
        require(isOpenCommunity || isMember[msg.sender], "RVM: Anda bukan anggota komunitas privat ini!");

        bytes32 messageHash = sha256(abi.encodePacked(totalPlastic, totalMetal, nonce, deviceAddress));
        address signer = ECDSA.recover(messageHash, signature);
        require(signer == deviceAddress, "RVM: Manipulasi data terdeteksi (Signature tidak valid)");

        // ON-CHAIN RATE LIMITING (Membatasi V_asset harian per perangkat)
        uint256 today = block.timestamp / 1 days;
        uint256 totalItems = totalPlastic + totalMetal;
        require(
            dailyDeviceClaims[deviceAddress][today] + totalItems <= dailyCapacityLimit,
            "RVM: Melebihi kapasitas harian tong sampah fisik!"
        );

        // Update buku besar harian dan kunci Nonce
        dailyDeviceClaims[deviceAddress][today] += totalItems;
        usedNonces[msg.sender][nonce] = true;

        uint256 totalReward = ((totalPlastic * rewardRatePlastic) + (totalMetal * rewardRateMetal)) * 10 ** 18;

        if (address(marketToken) != address(0)) {
            require(marketToken.balanceOf(address(this)) >= totalReward, "RVM: Brankas Kas Kosong!");
            marketToken.safeTransfer(msg.sender, totalReward);
        } else {
            _mint(msg.sender, totalReward);
        }

        lifetimePlastic += totalPlastic;
        lifetimeMetal += totalMetal;

        emit RewardsClaimed(msg.sender, totalReward);
    }

    // ------------------------------------------------------------------------
    // 2. FUNGSI EKSTERNAL (Menerima Array dari HP untuk 1x Bayar Gas Fee)
    // ------------------------------------------------------------------------
    function claimMultiple(
        uint256[] calldata totalPlastics,
        uint256[] calldata totalMetals,
        uint256[] calldata nonces,
        address deviceAddress,
        bytes[] calldata signatures
    ) external nonReentrant whenNotPaused {
        require(totalPlastics.length == signatures.length, "RVM: Data array tidak sinkron");
        require(totalPlastics.length > 0, "RVM: Tidak ada data untuk diklaim");

        // Melakukan looping untuk mengeksekusi semua struk yang dikirim dari HP
        for (uint256 i = 0; i < totalPlastics.length; i++) {
            _processClaim(totalPlastics[i], totalMetals[i], nonces[i], deviceAddress, signatures[i]);
        }
    }
}

contract RVMFactory {
    struct CommunityInfo {
        address contractAddress;
        string name;
        string symbol;
        address owner;
    }

    CommunityInfo[] public allCommunityDetails;
    event CommunityCreated(address indexed communityAddress, address indexed owner, bool isOpen);

    function createCommunity(
        string memory name,
        string memory symbol,
        uint256 ratePlastic,
        uint256 rateMetal,
        bool isOpenCommunity,
        address marketTokenAddress
    ) external returns (address) {
        CommunityRVM newCommunity = new CommunityRVM(
            name,
            symbol,
            msg.sender, // Pembuat otomatis jadi owner
            ratePlastic,
            rateMetal,
            isOpenCommunity,
            marketTokenAddress
        );

        allCommunityDetails.push(
            CommunityInfo({ contractAddress: address(newCommunity), name: name, symbol: symbol, owner: msg.sender })
        );

        emit CommunityCreated(address(newCommunity), msg.sender, isOpenCommunity);
        return address(newCommunity);
    }

    function getAllCommunityDetails() external view returns (CommunityInfo[] memory) {
        return allCommunityDetails;
    }
}
