import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { Contract } from "ethers";

/**
 * Script untuk mende-deploy RVMFactory dan membuat instansi komunitas pertama.
 */
const deployRVMSystem: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  console.log("\n🚀 Memulai deployment sistem RVM oleh:", deployer);

  // 1. Deploy Kontrak Utama (RVMFactory)
  // RVMFactory tidak membutuhkan argumen constructor
  await deploy("RVMFactory", {
    from: deployer,
    args: [],
    log: true,
    autoMine: true,
  });

  // 2. Dapatkan instansi RVMFactory yang baru saja di-deploy
  const rvmFactory = await hre.ethers.getContract<Contract>("RVMFactory", deployer);
  const factoryAddress = await rvmFactory.getAddress();
  console.log("✅ RVMFactory berhasil di-deploy pada alamat:", factoryAddress);

  // 3. (Opsional tapi sangat disarankan)
  // Langsung cetak 1 Komunitas pertama agar mudah di-debug di web Scaffold-ETH
  console.log("\n⚙️ Mencetak Komunitas RVM pertama (Node A)...");

  // --- BAGIAN YANG DIPERBARUI ---
  // Parameter: Nama Token, Simbol Token, Rate Plastik, Rate Metal, isOpenCommunity, marketTokenAddress
  // Kita set default: Terbuka (true) dan Menggunakan Token Kustom (address 0x0...)
  const tx = await rvmFactory.createCommunity(
    "Komunitas RVM Pusat",
    "RVM",
    1,
    5,
    true, // Status: Open Community
    "0x0000000000000000000000000000000000000000", // Address 0: Mode Token Kustom
  );

  await tx.wait(); // Tunggu transaksi selesai masuk ke blockchain

  // 4. Ambil alamat komunitas yang baru dibuat dari fungsi getDeployedCommunities
  const deployedCommunities = await rvmFactory.getDeployedCommunities();
  const firstCommunityAddress = deployedCommunities[0];

  console.log("🎉 Komunitas pertama berhasil dicetak!");
  console.log("📍 Alamat Kontrak Komunitas:", firstCommunityAddress);
  console.log("👑 Owner Komunitas (Admin):", deployer);
  console.log("----------------------------------------------------\n");
};

export default deployRVMSystem;

// Tag agar bisa dijalankan spesifik dengan `yarn deploy --tags RVMFactory`
deployRVMSystem.tags = ["RVMFactory"];
