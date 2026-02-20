import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { ScorerAgentINFT, MockOracle } from "../typechain-types";

/**
 * Fixture: deploy MockOracle + ScorerAgentINFT
 */
async function deployINFTFixture() {
    const [owner, user1, user2, executor] = await ethers.getSigners();

    const MockOracle = await ethers.getContractFactory("MockOracle");
    const oracle = await MockOracle.deploy();
    await oracle.waitForDeployment();

    const ScorerAgent = await ethers.getContractFactory("ScorerAgentINFT");
    const agent = await ScorerAgent.deploy(await oracle.getAddress());
    await agent.waitForDeployment();

    return { agent, oracle, owner, user1, user2, executor };
}

// ═══════════════════════════════════════════════════════════════════════════
// SCENARIO 6: iNFT ScorerAgent Lifecycle
// ═══════════════════════════════════════════════════════════════════════════
describe("Scenario 6: iNFT ScorerAgent Lifecycle", function () {
    it("6.1 — Mint agent returns token ID and emits event", async function () {
        const { agent, owner } = await loadFixture(deployINFTFixture);

        const metadataHash = ethers.keccak256(ethers.toUtf8Bytes("metadata"));

        await expect(
            agent.mintAgent("energy", "llama-3.3-70b-instruct", "0xprovider", "encryptedURI_1", metadataHash)
        ).to.emit(agent, "AgentMinted")
            .withArgs(1, owner.address, "energy", "encryptedURI_1");

        expect(await agent.ownerOf(1)).to.equal(owner.address);
    });

    it("6.2 — tokenURI returns valid JSON", async function () {
        const { agent } = await loadFixture(deployINFTFixture);

        const metadataHash = ethers.keccak256(ethers.toUtf8Bytes("metadata"));
        await agent.mintAgent("energy", "llama-3.3-70b", "0xprov", "uri", metadataHash);

        const uri = await agent.tokenURI(1);
        const parsed = JSON.parse(uri);

        expect(parsed.name).to.equal("ScorerAgent #1");
        expect(parsed.sector).to.equal("energy");
        expect(parsed.model).to.equal("llama-3.3-70b");
        expect(parsed.dealsAnalyzed).to.equal(0);
        expect(parsed.active).to.be.true;
        expect(parsed.mintedAt).to.be.greaterThan(0);
    });

    it("6.3 — Profile initial state is correct", async function () {
        const { agent } = await loadFixture(deployINFTFixture);

        const metadataHash = ethers.keccak256(ethers.toUtf8Bytes("metadata"));
        await agent.mintAgent("rail", "gemma-3-27b", "0xprov", "uri", metadataHash);

        const profile = await agent.getProfile(1);
        expect(profile.sector).to.equal("rail");
        expect(profile.modelName).to.equal("gemma-3-27b");
        expect(profile.dealsAnalyzed).to.equal(0);
        expect(profile.active).to.be.true;
        expect(profile.historyRoot).to.equal(ethers.ZeroHash);
    });

    it("6.4 — Log scoring emits events", async function () {
        const { agent, owner } = await loadFixture(deployINFTFixture);

        const metadataHash = ethers.keccak256(ethers.toUtf8Bytes("metadata"));
        await agent.mintAgent("energy", "llama", "0xprov", "uri", metadataHash);

        const vault = ethers.Wallet.createRandom().address;
        const supplier = ethers.Wallet.createRandom().address;
        const newRoot = ethers.keccak256(ethers.toUtf8Bytes("history1"));

        const tx = agent.logScoring(1, vault, supplier, 75, newRoot);

        await expect(tx).to.emit(agent, "ScoringLogged").withArgs(1, vault, supplier, 75);
        await expect(tx).to.emit(agent, "HistoryUpdated").withArgs(1, newRoot, 1);
    });

    it("6.5 — Deals counter increments", async function () {
        const { agent } = await loadFixture(deployINFTFixture);

        const metadataHash = ethers.keccak256(ethers.toUtf8Bytes("metadata"));
        await agent.mintAgent("energy", "llama", "0xprov", "uri", metadataHash);

        const vault = ethers.Wallet.createRandom().address;
        const supplier = ethers.Wallet.createRandom().address;

        for (let i = 1; i <= 3; i++) {
            const root = ethers.keccak256(ethers.toUtf8Bytes(`history${i}`));
            await agent.logScoring(1, vault, supplier, 50, root);
        }

        const profile = await agent.getProfile(1);
        expect(profile.dealsAnalyzed).to.equal(3);
    });

    it("6.6 — History root updates each time", async function () {
        const { agent } = await loadFixture(deployINFTFixture);

        const metadataHash = ethers.keccak256(ethers.toUtf8Bytes("metadata"));
        await agent.mintAgent("energy", "llama", "0xprov", "uri", metadataHash);

        const roots: string[] = [];
        for (let i = 1; i <= 3; i++) {
            const root = ethers.keccak256(ethers.toUtf8Bytes(`history${i}`));
            await agent.logScoring(1, ethers.Wallet.createRandom().address, ethers.Wallet.createRandom().address, 50, root);
            const profile = await agent.getProfile(1);
            roots.push(profile.historyRoot);
        }

        // All roots should be different
        expect(roots[0]).to.not.equal(roots[1]);
        expect(roots[1]).to.not.equal(roots[2]);
    });

    it("6.7 — Authorize vault emits event", async function () {
        const { agent } = await loadFixture(deployINFTFixture);

        const metadataHash = ethers.keccak256(ethers.toUtf8Bytes("metadata"));
        await agent.mintAgent("energy", "llama", "0xprov", "uri", metadataHash);

        const vaultAddr = ethers.Wallet.createRandom().address;

        await expect(agent.authorizeVault(1, vaultAddr))
            .to.emit(agent, "VaultAuthorized")
            .withArgs(1, vaultAddr);
    });

    it("6.8 — Owner can get encrypted URI", async function () {
        const { agent, owner } = await loadFixture(deployINFTFixture);

        const metadataHash = ethers.keccak256(ethers.toUtf8Bytes("metadata"));
        await agent.mintAgent("energy", "llama", "0xprov", "secret_uri_data", metadataHash);

        const uri = await agent.getEncryptedURI(1);
        expect(uri).to.equal("secret_uri_data");
    });

    it("6.9 — Non-owner non-authorized cannot get encrypted URI", async function () {
        const { agent, user1 } = await loadFixture(deployINFTFixture);

        const metadataHash = ethers.keccak256(ethers.toUtf8Bytes("metadata"));
        await agent.mintAgent("energy", "llama", "0xprov", "secret_uri", metadataHash);

        await expect(
            agent.connect(user1).getEncryptedURI(1)
        ).to.be.revertedWith("Not authorized");
    });

    it("6.10 — Authorize usage allows access", async function () {
        const { agent, executor } = await loadFixture(deployINFTFixture);

        const metadataHash = ethers.keccak256(ethers.toUtf8Bytes("metadata"));
        await agent.mintAgent("energy", "llama", "0xprov", "uri", metadataHash);

        const authData = ethers.toUtf8Bytes("authorized");
        await expect(agent.authorizeUsage(1, executor.address, authData))
            .to.emit(agent, "UsageAuthorized")
            .withArgs(1, executor.address);

        expect(await agent.isAuthorized(1, executor.address)).to.be.true;
    });

    it("6.11 — Authorized executor can get encrypted URI", async function () {
        const { agent, executor } = await loadFixture(deployINFTFixture);

        const metadataHash = ethers.keccak256(ethers.toUtf8Bytes("metadata"));
        await agent.mintAgent("energy", "llama", "0xprov", "secret_data", metadataHash);

        await agent.authorizeUsage(1, executor.address, ethers.toUtf8Bytes("auth"));

        const uri = await agent.connect(executor).getEncryptedURI(1);
        expect(uri).to.equal("secret_data");
    });

    it("6.12 — Update metadata emits event", async function () {
        const { agent } = await loadFixture(deployINFTFixture);

        const metadataHash = ethers.keccak256(ethers.toUtf8Bytes("metadata"));
        await agent.mintAgent("energy", "llama", "0xprov", "uri_old", metadataHash);

        const newHash = ethers.keccak256(ethers.toUtf8Bytes("new_metadata"));
        await expect(agent.updateMetadata(1, "uri_new", newHash))
            .to.emit(agent, "MetadataUpdated")
            .withArgs(1, newHash);

        expect(await agent.getMetadataHash(1)).to.equal(newHash);
    });

    it("6.13 — Log scoring by non-owner reverts", async function () {
        const { agent, user1 } = await loadFixture(deployINFTFixture);

        const metadataHash = ethers.keccak256(ethers.toUtf8Bytes("metadata"));
        await agent.mintAgent("energy", "llama", "0xprov", "uri", metadataHash);

        await expect(
            agent.connect(user1).logScoring(1, ethers.ZeroAddress, ethers.ZeroAddress, 50, ethers.ZeroHash)
        ).to.be.revertedWith("Not agent owner");
    });

    it("6.14 — Score > 100 reverts", async function () {
        const { agent } = await loadFixture(deployINFTFixture);

        const metadataHash = ethers.keccak256(ethers.toUtf8Bytes("metadata"));
        await agent.mintAgent("energy", "llama", "0xprov", "uri", metadataHash);

        await expect(
            agent.logScoring(1, ethers.ZeroAddress, ethers.ZeroAddress, 101, ethers.ZeroHash)
        ).to.be.revertedWith("Score must be 0-100");
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// MockOracle Tests
// ═══════════════════════════════════════════════════════════════════════════
describe("MockOracle", function () {
    it("verifyProof always returns true", async function () {
        const { oracle } = await loadFixture(deployINFTFixture);
        const result = await oracle.verifyProof("0x1234");
        expect(result).to.be.true;
    });

    it("verifyProof with empty bytes returns true", async function () {
        const { oracle } = await loadFixture(deployINFTFixture);
        const result = await oracle.verifyProof("0x");
        expect(result).to.be.true;
    });
});
