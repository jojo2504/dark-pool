import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

/**
 * Deploys ShadowBidFactory to any EVM network.
 *
 * Usage:
 *   yarn deploy --network adiTestnet
 *   yarn deploy --network adiMainnet
 *   yarn deploy --network localhost
 *
 * After deploy, the ABI + address is auto-exported to
 * packages/nextjs/contracts/deployedContracts.ts
 */
const deployShadowBidFactory: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const result = await deploy("ShadowBidFactory", {
    from: deployer,
    args: [],
    log: true,
    autoMine: true,
  });

  console.log(`\n✅ ShadowBidFactory deployed to: ${result.address}`);

  // Grant BUYER_ROLE to deployer so they can create vaults immediately
  if (result.newlyDeployed) {
    const factory = await hre.ethers.getContractAt("ShadowBidFactory", result.address);
    const BUYER_ROLE = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("BUYER_ROLE"));
    const tx = await factory.grantRole(BUYER_ROLE, deployer);
    await tx.wait();
    console.log(`✅ BUYER_ROLE granted to deployer: ${deployer}`);
  }
};

deployShadowBidFactory.tags = ["ShadowBidFactory"];

export default deployShadowBidFactory;
