async function main() {
  // GANTI dengan alamat kontrak yang baru saja Anda deploy
  const contractAddress = "0xa16E02E87b7454126E5E10d957A927A7F5B5d2be"; 
  const esp32Address = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";

  const rvm = await ethers.getContractAt("CommunityRVM", contractAddress);
  console.log("Mendaftarkan ESP32...");
  const tx = await rvm.setWhitelistedDevice(esp32Address, true);
  await tx.wait();
  console.log("✅ Berhasil Whitelist!");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});