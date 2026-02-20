import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

/**
 * Deploys ShadowBidFactory to any EVM network.
 *
 * After deploy:
 * - Deployer automatically has ADMIN_ROLE + BUYER_ROLE
 * - The factory manages global KYB state (verified, isAccredited, affiliatedWith)
 * - All vault creation goes through factory.createVault() with compliance params
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

  // Deployer already has all roles from constructor, but verify and log
  if (result.newlyDeployed) {
    const factory = await hre.ethers.getContractAt("ShadowBidFactory", result.address);

    // Self-verify the deployer as KYB'd for testing
    const verifyTx = await factory.verifyInstitution(deployer, true, "0x");
    await verifyTx.wait();
    console.log(`✅ Deployer auto-verified for KYB testing: ${deployer}`);

    console.log("\n📋 Factory Roles Summary:");
    console.log(`   ADMIN_ROLE:  ${deployer}`);
    console.log(`   BUYER_ROLE:  ${deployer}`);
    console.log(`   KYB verified: ${deployer}`);
    console.log("\n📝 Next Steps:");
    console.log("   1. Set NEXT_PUBLIC_FACTORY_ADDRESS in packages/nextjs/.env.local");
    console.log("   2. Use factory.verifyInstitution() to KYB users before they bid");
    console.log("   3. Use factory.grantBuyerRole() to allow auction creation");
  }
};

deployShadowBidFactory.tags = ["ShadowBidFactory"];

export default deployShadowBidFactory;
