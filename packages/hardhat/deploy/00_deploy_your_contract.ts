import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";

const deployRVMSystem: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  console.log("🚀 Memulai deployment sistem RVM oleh:", deployer);

  // 1. Deploy Factory
  await deploy("RVMFactory", {
    from: deployer,
    args: [],
    log: true,
    autoMine: true,
  });

  const rvmFactory = await ethers.getContract("RVMFactory", deployer);

  console.log("⚙️ Mencetak Komunitas RVM pertama...");

  // 2. Buat Komunitas Pertama
  const tx1 = await rvmFactory.createCommunity(
    "Bank Sampah Maju", // Nama
    "BSM", // Simbol
    10, // rate plastik
    15, // rate metal
    true, // is open
    ethers.ZeroAddress, // market token (0x00.. untuk pakai token kustom)
  );
  await tx1.wait();

  // [PERUBAHAN ADA DI SINI]
  // 3. Mengambil daftar komunitas menggunakan fungsi yang baru
  const communities = await rvmFactory.getAllCommunityDetails();

  // Karena sekarang mengembalikan Struct, kita harus ambil properti contractAddress-nya
  const firstCommunityAddress = communities[0].contractAddress;

  console.log("✅ Komunitas berhasil dibuat di alamat:", firstCommunityAddress);

  // 4. Whitelist ESP32 Anda secara otomatis
  console.log("🔒 Membuka akses untuk ESP32...");

  // [PERBAIKAN DI SINI]: Ambil signer agar bisa mengirim transaksi
  const signer = await ethers.getSigner(deployer);

  // Hubungkan signer ke kontrak komunitas
  const communityContract = await ethers.getContractAt(
    "CommunityRVM",
    firstCommunityAddress,
    signer, // <--- WAJIB sertakan signer di sini
  );

  const esp32Address = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";

  // Sekarang transaksi pasti bisa terkirim
  const txWhitelist = await communityContract.setWhitelistedDevice(esp32Address, true);
  await txWhitelist.wait();

  console.log(`✅ ESP32 (${esp32Address}) berhasil di-whitelist!`);
};

export default deployRVMSystem;
deployRVMSystem.tags = ["RVMFactory"];
