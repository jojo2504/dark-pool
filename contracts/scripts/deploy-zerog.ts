import { ethers } from "hardhat";

async function main() {
    console.log("🚀 Deploying to 0G Chain...");
    const [deployer] = await ethers.getSigners();
    console.log("Deployer:", deployer.address);

    // Deploy MockOracle (testnet)
    const MockOracle = await ethers.getContractFactory("MockOracle");
    const oracle = await MockOracle.deploy();
    await oracle.waitForDeployment();
    console.log(`✅ MockOracle deployed: ${await oracle.getAddress()}`);

    // Deploy ScorerAgentINFT
    const ScorerAgent = await ethers.getContractFactory("ScorerAgentINFT");
    const agent = await ScorerAgent.deploy(await oracle.getAddress());
    await agent.waitForDeployment();
    console.log(`✅ ScorerAgentINFT deployed: ${await agent.getAddress()}`);

    console.log("\n📋 Update your .env with:");
    console.log(`SCORER_AGENT_ADDRESS=${await agent.getAddress()}`);
}

main().catch(console.error);
