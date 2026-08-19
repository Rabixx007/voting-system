import hre from "hardhat";
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  console.log("Deploying Voting System...");
  
  const VotingFactory = await hre.ethers.getContractFactory("VotingFactory");
  const factory = await VotingFactory.deploy();
  await factory.waitForDeployment();
  
  const factoryAddress = await factory.getAddress();
  console.log(`VotingFactory deployed to: ${factoryAddress}`);
  
  // Save contract addresses
  const addresses = {
    votingFactory: factoryAddress,
    network: hre.network.name,
    chainId: hre.network.config.chainId
  };
  
  // Save to backend
  fs.writeFileSync(
    "contracts.json",
    JSON.stringify(addresses, null, 2)
  );
  
  // Save to frontend (create directory if needed)
  const frontendPath = path.join(__dirname, "../../frontend/src/contracts");
  if (!fs.existsSync(frontendPath)) {
    fs.mkdirSync(frontendPath, { recursive: true });
  }
  fs.writeFileSync(
    path.join(frontendPath, "contracts.json"),
    JSON.stringify(addresses, null, 2)
  );
  
  console.log("✅ Contract addresses saved!");
  console.log("📝 Addresses:", addresses);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
