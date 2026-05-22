import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const deployRVMSystem: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  console.log("🚀 Memulai deployment sistem RVM oleh:", deployer);

  // 1. Deploy Master Implementasi Logika RVM (Untuk UUPS Proxy)
  const communityLogic = await deploy("CommunityRVM", {
    from: deployer,
    args: [], // Konstruktor dikosongkan untuk pola initializer UUPS
    log: true,
    autoMine: true,
  });

  // 2. Deploy Induk Pabrik RVMFactory dengan Pola Proxy
  await deploy("RVMFactory", {
    from: deployer,
    args: [communityLogic.address], // Mengunci alamat cetakan ke dalam pabrik
    log: true,
    autoMine: true,
  });

  console.log("✅ Pembaruan Arsitektur UUPS Proxy & Factory Selesai Tersusun!");
};

export default deployRVMSystem;
deployRVMSystem.tags = ["RVMFactory"];
