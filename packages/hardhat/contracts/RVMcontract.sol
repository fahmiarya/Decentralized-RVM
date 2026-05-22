// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract CommunityRVM is
    Initializable,
    ERC20Upgradeable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable,
    PausableUpgradeable,
    UUPSUpgradeable
{
    using ECDSA for bytes32;
    using SafeERC20 for IERC20;

    uint256 public rewardRatePlastic;
    uint256 public rewardRateMetal;
    uint256 public lifetimePlastic;
    uint256 public lifetimeMetal;

    IERC20 public marketToken;
    bool public isOpenCommunity;

    mapping(address => bool) public isMember;
    uint256 public dailyCapacityLimit;

    mapping(address => mapping(uint256 => bool)) public usedNonces;
    mapping(address => bool) public whitelistedDevices;
    address[] public registeredDevices;

    mapping(address => mapping(uint256 => uint256)) public dailyDeviceClaims;

    event DeviceWhitelisted(address indexed device, bool status);
    event RewardRatesUpdated(uint256 newPlasticRate, uint256 newMetalRate);
    event RewardsClaimed(address indexed user, uint256 amount);
    event DailyCapacityUpdated(uint256 newCapacityLimit);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers(); // Mengunci konstruktor mentah agar tidak bisa disabotase
    }

    function initialize(
        string memory name,
        string memory symbol,
        address initialOwner,
        uint256 _ratePlastic,
        uint256 _rateMetal,
        bool _isOpenCommunity,
        address _marketTokenAddress
    ) public initializer {
        __ERC20_init(name, symbol);
        __Ownable_init(initialOwner);
        __ReentrancyGuard_init();
        __Pausable_init();
        __UUPSUpgradeable_init();

        rewardRatePlastic = _ratePlastic;
        rewardRateMetal = _rateMetal;
        isOpenCommunity = _isOpenCommunity;
        dailyCapacityLimit = 500;

        if (_marketTokenAddress != address(0)) {
            marketToken = IERC20(_marketTokenAddress);
        }
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    // --- PANEL ADMIN ---
    function pause() external onlyOwner {
        _pause();
    }
    function unpause() external onlyOwner {
        _unpause();
    }

    function setWhitelistedDevice(address device, bool status) external onlyOwner {
        if (status == true && whitelistedDevices[device] == false) {
            registeredDevices.push(device);
        }
        whitelistedDevices[device] = status;
        emit DeviceWhitelisted(device, status);
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

    function updateDailyCapacityLimit(uint256 _newLimit) external onlyOwner {
        require(_newLimit > 0, "RVM: Kapasitas harian tidak boleh nol!");
        dailyCapacityLimit = _newLimit;
        emit DailyCapacityUpdated(_newLimit);
    }

    function emergencyWithdrawToken(uint256 amount) external onlyOwner {
        require(address(marketToken) != address(0), "Bukan mode market token");
        marketToken.safeTransfer(owner(), amount);
    }

    // --- LOGIKA UTAMA ---
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

        bytes32 messageHash = sha256(abi.encodePacked(totalPlastic, totalMetal, nonce, deviceAddress, msg.sender));
        address signer = ECDSA.recover(messageHash, signature);
        require(signer == deviceAddress, "RVM: Manipulasi data terdeteksi (Signature tidak valid)");

        uint256 today = block.timestamp / 1 days;
        uint256 totalItems = totalPlastic + totalMetal;
        require(
            dailyDeviceClaims[deviceAddress][today] + totalItems <= dailyCapacityLimit,
            "RVM: Melebihi kapasitas harian tong sampah fisik!"
        );

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

    function claimMultiple(
        uint256[] calldata totalPlastics,
        uint256[] calldata totalMetals,
        uint256[] calldata nonces,
        address deviceAddress,
        bytes[] calldata signatures
    ) external nonReentrant whenNotPaused {
        uint256 length = totalPlastics.length;
        require(length > 0, "RVM: Tidak ada data untuk diklaim");
        require(length <= 50, "RVM: Maksimal klaim 50 struk per transaksi!");
        require(
            totalMetals.length == length && nonces.length == length && signatures.length == length,
            "RVM: Data array tidak sinkron!"
        );

        for (uint256 i = 0; i < length; ) {
            _processClaim(totalPlastics[i], totalMetals[i], nonces[i], deviceAddress, signatures[i]);
            unchecked {
                ++i;
            }
        }
    }
}

// FACTORY UNTUK PROXY CLONE UNTUK TIAP KOMUNITAS
contract RVMFactory {
    struct CommunityInfo {
        address contractAddress;
        string name;
        string symbol;
        address owner;
    }

    CommunityInfo[] public allCommunityDetails;
    address public immutable implementationAddress;

    event CommunityCreated(address indexed communityAddress, address indexed owner, bool isOpen);

    constructor(address _implementationAddress) {
        implementationAddress = _implementationAddress;
    }

    function createCommunity(
        string calldata name,
        string calldata symbol,
        uint256 ratePlastic,
        uint256 rateMetal,
        bool isOpenCommunity,
        address marketTokenAddress
    ) external returns (address) {
        address clone;
        bytes20 implementationBytes = bytes20(implementationAddress);

        assembly {
            let clone := mload(0x40)
            mstore(clone, 0x3d602d80600a3d3981f3363d3d373d3d3d363d73000000000000000000000000)
            mstore(add(clone, 0x14), implementationBytes)
            mstore(add(clone, 0x28), 0x5af43d82803e903d91602b57fd5bf30000000000000000000000000000000000)
            clone := create(0, clone, 0x37)
        }

        CommunityRVM(clone).initialize(
            name,
            symbol,
            msg.sender,
            ratePlastic,
            rateMetal,
            isOpenCommunity,
            marketTokenAddress
        );

        allCommunityDetails.push(
            CommunityInfo({ contractAddress: clone, name: name, symbol: symbol, owner: msg.sender })
        );

        emit CommunityCreated(clone, msg.sender, isOpenCommunity);
        return clone;
    }

    function getAllCommunityDetails() external view returns (CommunityInfo[] memory) {
        return allCommunityDetails;
    }
}
