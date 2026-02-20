import { Wallet } from "zksync-ethers";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import * as ethers from "ethers";

export default async function (hre: HardhatRuntimeEnvironment) {
    console.log("🚀 Deploying to ADI Chain (ZKsync-based)...");

    const wallet = new Wallet(process.env.DEPLOYER_PRIVATE_KEY!);
    const deployer = new Deployer(hre, wallet);

    // Deploy ShadowBidFactory
    const factoryArtifact = await deployer.loadArtifact("ShadowBidFactory");
    const factory = await deployer.deploy(factoryArtifact, []);
    console.log(`✅ ShadowBidFactory deployed: ${await factory.getAddress()}`);

    // Grant BUYER_ROLE to deployer for testing
    const BUYER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("BUYER_ROLE"));
    await factory.grantRole(BUYER_ROLE, wallet.address);
    console.log(`✅ BUYER_ROLE granted to: ${wallet.address}`);

    console.log("\n📋 Update your .env with:");
    console.log(`FACTORY_ADDRESS=${await factory.getAddress()}`);
}
