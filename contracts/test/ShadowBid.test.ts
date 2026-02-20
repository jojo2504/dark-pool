import { expect } from "chai";
import { ethers } from "hardhat";
import { time, loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { ShadowBidFactory, ShadowBidVault } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

/**
 * Shared fixture: deploys Factory + a Vault with 3 suppliers + 1 auditor
 */
async function deployFullFixture() {
    const [owner, buyer, supplierA, supplierB, supplierC, auditor, outsider] =
        await ethers.getSigners();

    // Deploy Factory
    const Factory = await ethers.getContractFactory("ShadowBidFactory");
    const factory = await Factory.deploy();
    await factory.waitForDeployment();

    // Grant BUYER_ROLE to buyer
    const BUYER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("BUYER_ROLE"));
    await factory.grantBuyerRole(buyer.address);

    // Create vault params
    const now = await time.latest();
    const closeTime = now + 600; // 10 minutes
    const revealWindow = 3600; // 1 hour
    const depositRequired = ethers.parseEther("0.01");
    const buyerECIESPubKey = "04abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12345678";

    // Create vault
    const tx = await factory.connect(buyer).createVault(
        "Energy Procurement Q1",
        "Annual energy supply tender",
        closeTime,
        revealWindow,
        depositRequired,
        [supplierA.address, supplierB.address, supplierC.address],
        auditor.address,
        buyerECIESPubKey
    );
    const receipt = await tx.wait();

    // Get vault address from events
    const vaultCreatedEvent = receipt!.logs.find((log: any) => {
        try {
            return factory.interface.parseLog({ topics: log.topics as string[], data: log.data })?.name === "VaultCreated";
        } catch { return false; }
    });
    const parsedEvent = factory.interface.parseLog({
        topics: vaultCreatedEvent!.topics as string[],
        data: vaultCreatedEvent!.data
    });
    const vaultAddress = parsedEvent!.args[0];

    const vault = await ethers.getContractAt("ShadowBidVault", vaultAddress) as unknown as ShadowBidVault;

    return {
        factory, vault, vaultAddress,
        owner, buyer, supplierA, supplierB, supplierC, auditor, outsider,
        closeTime, revealWindow, depositRequired, buyerECIESPubKey
    };
}

/**
 * Helper: compute commit hash matching Solidity keccak256(abi.encodePacked(price, salt, supplier))
 */
function computeCommitHash(price: bigint, salt: string, supplierAddress: string): string {
    return ethers.solidityPackedKeccak256(
        ["uint256", "bytes32", "address"],
        [price, salt, supplierAddress]
    );
}

/**
 * Helper: generate random salt
 */
function randomSalt(): string {
    return ethers.hexlify(ethers.randomBytes(32));
}

// ═══════════════════════════════════════════════════════════════════════════
// SCENARIO 1: HAPPY PATH — 3 Suppliers, All Reveal
// ═══════════════════════════════════════════════════════════════════════════
describe("Scenario 1: Happy Path", function () {
    it("1.1 — Buyer creates vault via Factory", async function () {
        const { vault, vaultAddress, buyer } = await loadFixture(deployFullFixture);
        expect(vaultAddress).to.be.properAddress;
        expect(await vault.buyer()).to.equal(buyer.address);
    });

    it("1.2 — Vault initial state is correct", async function () {
        const { vault, closeTime, depositRequired } = await loadFixture(deployFullFixture);
        expect(await vault.phase()).to.equal(0); // OPEN
        expect(await vault.closeTime()).to.equal(closeTime);
        expect(await vault.depositRequired()).to.equal(depositRequired);
        expect(await vault.title()).to.equal("Energy Procurement Q1");
    });

    it("1.3 — Supplier A prepares and gets commitHash", async function () {
        const { supplierA } = await loadFixture(deployFullFixture);
        const price = 100000000n;
        const salt = randomSalt();
        const commitHash = computeCommitHash(price, salt, supplierA.address);
        expect(commitHash).to.not.equal(ethers.ZeroHash);
        expect(commitHash).to.have.lengthOf(66); // 0x + 64 hex chars
    });

    it("1.4 — Supplier A commits on-chain", async function () {
        const { vault, supplierA, depositRequired } = await loadFixture(deployFullFixture);
        const price = 100000000n;
        const salt = randomSalt();
        const commitHash = computeCommitHash(price, salt, supplierA.address);

        await expect(
            vault.connect(supplierA).commitBid(commitHash, "root_hash_A", { value: depositRequired })
        ).to.emit(vault, "BidCommitted")
            .withArgs(supplierA.address, commitHash, "root_hash_A");

        const bid = await vault.bids(supplierA.address);
        expect(bid.commitHash).to.equal(commitHash);
        expect(bid.depositPaid).to.be.true;
    });

    it("1.5-1.6 — All 3 suppliers commit different hashes", async function () {
        const { vault, supplierA, supplierB, supplierC, depositRequired } =
            await loadFixture(deployFullFixture);

        const prices = [100000000n, 95000000n, 98000000n];
        const salts = [randomSalt(), randomSalt(), randomSalt()];
        const suppliers = [supplierA, supplierB, supplierC];

        for (let i = 0; i < 3; i++) {
            const hash = computeCommitHash(prices[i], salts[i], suppliers[i].address);
            await vault.connect(suppliers[i]).commitBid(hash, `root_${i}`, { value: depositRequired });
        }

        // All 3 committed with different hashes
        const bidA = await vault.bids(supplierA.address);
        const bidB = await vault.bids(supplierB.address);
        const bidC = await vault.bids(supplierC.address);
        expect(bidA.commitHash).to.not.equal(bidB.commitHash);
        expect(bidB.commitHash).to.not.equal(bidC.commitHash);
    });

    it("1.7 — Bid count is 3", async function () {
        const { vault, supplierA, supplierB, supplierC, depositRequired } =
            await loadFixture(deployFullFixture);

        const suppliers = [supplierA, supplierB, supplierC];
        for (const s of suppliers) {
            const hash = computeCommitHash(1n, randomSalt(), s.address);
            await vault.connect(s).commitBid(hash, "root", { value: depositRequired });
        }

        expect(await vault.getBidCount()).to.equal(3);
    });

    it("1.8 — Trigger reveal after closeTime", async function () {
        const { vault, closeTime } = await loadFixture(deployFullFixture);
        await time.increaseTo(closeTime);

        await expect(vault.triggerRevealPhase())
            .to.emit(vault, "PhaseChanged")
            .withArgs(1); // REVEAL
        expect(await vault.phase()).to.equal(1);
    });

    it("1.9-1.12 — Full lifecycle: commit, reveal, settle", async function () {
        const { vault, buyer, supplierA, supplierB, supplierC, depositRequired, closeTime, revealWindow } =
            await loadFixture(deployFullFixture);

        // Commit phase
        const prices = [100000000n, 95000000n, 98000000n];
        const salts = [randomSalt(), randomSalt(), randomSalt()];
        const suppliers = [supplierA, supplierB, supplierC];

        for (let i = 0; i < 3; i++) {
            const hash = computeCommitHash(prices[i], salts[i], suppliers[i].address);
            await vault.connect(suppliers[i]).commitBid(hash, `root_${i}`, { value: depositRequired });
        }

        // Transition to REVEAL
        await time.increaseTo(closeTime);
        await vault.triggerRevealPhase();

        // Reveal phase — all 3 reveal
        for (let i = 0; i < 3; i++) {
            await expect(vault.connect(suppliers[i]).revealBid(prices[i], salts[i]))
                .to.emit(vault, "BidRevealed")
                .withArgs(suppliers[i].address, prices[i]);
        }

        // Settlement after reveal deadline
        await time.increaseTo(closeTime + revealWindow + 1);

        await expect(vault.connect(buyer).settle())
            .to.emit(vault, "WinnerSelected")
            .withArgs(supplierB.address, 95000000n, 3);
    });

    it("1.13-1.14 — Winner is lowest bidder, price correct", async function () {
        const { vault, buyer, supplierA, supplierB, supplierC, depositRequired, closeTime, revealWindow } =
            await loadFixture(deployFullFixture);

        const prices = [100000000n, 95000000n, 98000000n];
        const salts = [randomSalt(), randomSalt(), randomSalt()];
        const suppliers = [supplierA, supplierB, supplierC];

        for (let i = 0; i < 3; i++) {
            const hash = computeCommitHash(prices[i], salts[i], suppliers[i].address);
            await vault.connect(suppliers[i]).commitBid(hash, `root_${i}`, { value: depositRequired });
        }

        await time.increaseTo(closeTime);
        await vault.triggerRevealPhase();
        for (let i = 0; i < 3; i++) {
            await vault.connect(suppliers[i]).revealBid(prices[i], salts[i]);
        }
        await time.increaseTo(closeTime + revealWindow + 1);
        await vault.connect(buyer).settle();

        expect(await vault.winner()).to.equal(supplierB.address);
        expect(await vault.winningPrice()).to.equal(95000000n);
        expect(await vault.phase()).to.equal(2); // SETTLED
    });

    it("1.15-1.16 — All deposits refunded after settlement", async function () {
        const { vault, buyer, supplierA, supplierB, supplierC, depositRequired, closeTime, revealWindow } =
            await loadFixture(deployFullFixture);

        const prices = [100000000n, 95000000n, 98000000n];
        const salts = [randomSalt(), randomSalt(), randomSalt()];
        const suppliers = [supplierA, supplierB, supplierC];

        for (let i = 0; i < 3; i++) {
            const hash = computeCommitHash(prices[i], salts[i], suppliers[i].address);
            await vault.connect(suppliers[i]).commitBid(hash, `root_${i}`, { value: depositRequired });
        }

        await time.increaseTo(closeTime);
        await vault.triggerRevealPhase();
        for (let i = 0; i < 3; i++) {
            await vault.connect(suppliers[i]).revealBid(prices[i], salts[i]);
        }
        await time.increaseTo(closeTime + revealWindow + 1);

        // Track balances before settle
        const balBefore = await Promise.all(suppliers.map(s => ethers.provider.getBalance(s.address)));

        const tx = await vault.connect(buyer).settle();
        const receipt = await tx.wait();

        // All 3 should get DepositReturned events
        const events = receipt!.logs.filter((log: any) => {
            try {
                return vault.interface.parseLog({ topics: log.topics as string[], data: log.data })?.name === "DepositReturned";
            } catch { return false; }
        });
        expect(events.length).to.equal(3);
    });

    it("1.17 — Audit data accessible by auditor", async function () {
        const { vault, buyer, supplierA, supplierB, supplierC, auditor, depositRequired, closeTime, revealWindow } =
            await loadFixture(deployFullFixture);

        const prices = [100000000n, 95000000n, 98000000n];
        const salts = [randomSalt(), randomSalt(), randomSalt()];
        const suppliers = [supplierA, supplierB, supplierC];

        for (let i = 0; i < 3; i++) {
            const hash = computeCommitHash(prices[i], salts[i], suppliers[i].address);
            await vault.connect(suppliers[i]).commitBid(hash, `root_${i}`, { value: depositRequired });
        }

        await time.increaseTo(closeTime);
        await vault.triggerRevealPhase();
        for (let i = 0; i < 3; i++) {
            await vault.connect(suppliers[i]).revealBid(prices[i], salts[i]);
        }
        await time.increaseTo(closeTime + revealWindow + 1);
        await vault.connect(buyer).settle();

        const [_suppliers, _hashes, _roots, _prices, _revealed] =
            await vault.connect(auditor).getAuditData();
        expect(_suppliers.length).to.equal(3);
        expect(_revealed[0]).to.be.true;
        expect(_revealed[1]).to.be.true;
        expect(_revealed[2]).to.be.true;
        expect(_prices[1]).to.equal(95000000n); // B's price
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// SCENARIO 2: PENALTY — Non-Reveal Slashing
// ═══════════════════════════════════════════════════════════════════════════
describe("Scenario 2: Penalty — Non-Reveal Slashing", function () {
    it("2.1-2.3 — Only Supplier A reveals, B does not", async function () {
        const { vault, buyer, supplierA, supplierB, depositRequired, closeTime, revealWindow } =
            await loadFixture(deployFullFixture);

        const saltA = randomSalt();
        const saltB = randomSalt();
        const hashA = computeCommitHash(100000000n, saltA, supplierA.address);
        const hashB = computeCommitHash(95000000n, saltB, supplierB.address);

        await vault.connect(supplierA).commitBid(hashA, "rootA", { value: depositRequired });
        await vault.connect(supplierB).commitBid(hashB, "rootB", { value: depositRequired });

        await time.increaseTo(closeTime);
        await vault.triggerRevealPhase();

        // Only A reveals
        await vault.connect(supplierA).revealBid(100000000n, saltA);
        // B does NOT reveal

        const bidB = await vault.bids(supplierB.address);
        expect(bidB.revealed).to.be.false;
    });

    it("2.4-2.5 — Settlement slashes non-revealer, winner is A", async function () {
        const { vault, buyer, supplierA, supplierB, depositRequired, closeTime, revealWindow } =
            await loadFixture(deployFullFixture);

        const saltA = randomSalt();
        const saltB = randomSalt();
        const hashA = computeCommitHash(100000000n, saltA, supplierA.address);
        const hashB = computeCommitHash(95000000n, saltB, supplierB.address);

        await vault.connect(supplierA).commitBid(hashA, "rootA", { value: depositRequired });
        await vault.connect(supplierB).commitBid(hashB, "rootB", { value: depositRequired });

        await time.increaseTo(closeTime);
        await vault.triggerRevealPhase();
        await vault.connect(supplierA).revealBid(100000000n, saltA);

        await time.increaseTo(closeTime + revealWindow + 1);

        const tx = await vault.connect(buyer).settle();
        const receipt = await tx.wait();

        // Check DepositSlashed event for B
        await expect(tx).to.emit(vault, "DepositSlashed")
            .withArgs(supplierB.address, depositRequired, buyer.address);
        await expect(tx).to.emit(vault, "BidDisqualified")
            .withArgs(supplierB.address, "Did not reveal within window");

        // Winner is A
        expect(await vault.winner()).to.equal(supplierA.address);
    });

    it("2.6 — Buyer received slashed deposit", async function () {
        const { vault, buyer, supplierA, supplierB, depositRequired, closeTime, revealWindow } =
            await loadFixture(deployFullFixture);

        const saltA = randomSalt();
        const saltB = randomSalt();

        await vault.connect(supplierA).commitBid(
            computeCommitHash(100000000n, saltA, supplierA.address), "rootA", { value: depositRequired }
        );
        await vault.connect(supplierB).commitBid(
            computeCommitHash(95000000n, saltB, supplierB.address), "rootB", { value: depositRequired }
        );

        await time.increaseTo(closeTime);
        await vault.triggerRevealPhase();
        await vault.connect(supplierA).revealBid(100000000n, saltA);
        await time.increaseTo(closeTime + revealWindow + 1);

        const buyerBalBefore = await ethers.provider.getBalance(buyer.address);
        const tx = await vault.connect(buyer).settle();
        const receipt = await tx.wait();
        const gasCost = receipt!.gasUsed * receipt!.gasPrice;
        const buyerBalAfter = await ethers.provider.getBalance(buyer.address);

        // Buyer gained B's deposit minus gas
        expect(buyerBalAfter + gasCost - buyerBalBefore).to.equal(depositRequired);
    });

    it("2.7 — A's deposit refunded", async function () {
        const { vault, buyer, supplierA, supplierB, depositRequired, closeTime, revealWindow } =
            await loadFixture(deployFullFixture);

        const saltA = randomSalt();
        const saltB = randomSalt();

        await vault.connect(supplierA).commitBid(
            computeCommitHash(100000000n, saltA, supplierA.address), "rootA", { value: depositRequired }
        );
        await vault.connect(supplierB).commitBid(
            computeCommitHash(95000000n, saltB, supplierB.address), "rootB", { value: depositRequired }
        );

        await time.increaseTo(closeTime);
        await vault.triggerRevealPhase();
        await vault.connect(supplierA).revealBid(100000000n, saltA);
        await time.increaseTo(closeTime + revealWindow + 1);

        await expect(vault.connect(buyer).settle())
            .to.emit(vault, "DepositReturned")
            .withArgs(supplierA.address, depositRequired);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// SCENARIO 3: SECURITY — Cheat Attempts
// ═══════════════════════════════════════════════════════════════════════════
describe("Scenario 3: Security — Cheat Attempts", function () {
    it("3.1 — Reveal with wrong salt reverts", async function () {
        const { vault, supplierA, depositRequired, closeTime } = await loadFixture(deployFullFixture);

        const salt = randomSalt();
        const wrongSalt = randomSalt();
        const hash = computeCommitHash(100000000n, salt, supplierA.address);

        await vault.connect(supplierA).commitBid(hash, "root", { value: depositRequired });
        await time.increaseTo(closeTime);
        await vault.triggerRevealPhase();

        await expect(
            vault.connect(supplierA).revealBid(100000000n, wrongSalt)
        ).to.be.revertedWith("Hash mismatch: invalid reveal");
    });

    it("3.2 — Reveal with wrong price reverts", async function () {
        const { vault, supplierA, depositRequired, closeTime } = await loadFixture(deployFullFixture);

        const salt = randomSalt();
        const hash = computeCommitHash(100000000n, salt, supplierA.address);

        await vault.connect(supplierA).commitBid(hash, "root", { value: depositRequired });
        await time.increaseTo(closeTime);
        await vault.triggerRevealPhase();

        await expect(
            vault.connect(supplierA).revealBid(99999999n, salt)
        ).to.be.revertedWith("Hash mismatch: invalid reveal");
    });

    it("3.3 — Reveal before phase change reverts", async function () {
        const { vault, supplierA, depositRequired } = await loadFixture(deployFullFixture);

        const salt = randomSalt();
        const hash = computeCommitHash(100000000n, salt, supplierA.address);

        await vault.connect(supplierA).commitBid(hash, "root", { value: depositRequired });

        await expect(
            vault.connect(supplierA).revealBid(100000000n, salt)
        ).to.be.revertedWith("Not in REVEAL phase");
    });

    it("3.4 — Commit by non-whitelisted address reverts", async function () {
        const { vault, outsider, depositRequired } = await loadFixture(deployFullFixture);

        const hash = computeCommitHash(100000000n, randomSalt(), outsider.address);

        await expect(
            vault.connect(outsider).commitBid(hash, "root", { value: depositRequired })
        ).to.be.reverted; // AccessControl revert
    });

    it("3.5 — Double commit by same supplier reverts", async function () {
        const { vault, supplierA, depositRequired } = await loadFixture(deployFullFixture);

        const salt = randomSalt();
        const hash = computeCommitHash(100000000n, salt, supplierA.address);

        await vault.connect(supplierA).commitBid(hash, "root", { value: depositRequired });

        await expect(
            vault.connect(supplierA).commitBid(hash, "root2", { value: depositRequired })
        ).to.be.revertedWith("Already committed");
    });

    it("3.6 — Settle before reveal deadline reverts", async function () {
        const { vault, buyer, supplierA, depositRequired, closeTime } =
            await loadFixture(deployFullFixture);

        const salt = randomSalt();
        await vault.connect(supplierA).commitBid(
            computeCommitHash(100000000n, salt, supplierA.address), "root", { value: depositRequired }
        );

        await time.increaseTo(closeTime);
        await vault.triggerRevealPhase();
        await vault.connect(supplierA).revealBid(100000000n, salt);

        // Still within reveal window
        await expect(
            vault.connect(buyer).settle()
        ).to.be.revertedWith("Reveal window not closed");
    });

    it("3.7 — Settle by non-buyer reverts", async function () {
        const { vault, supplierA, depositRequired, closeTime, revealWindow } =
            await loadFixture(deployFullFixture);

        const salt = randomSalt();
        await vault.connect(supplierA).commitBid(
            computeCommitHash(100000000n, salt, supplierA.address), "root", { value: depositRequired }
        );
        await time.increaseTo(closeTime);
        await vault.triggerRevealPhase();
        await vault.connect(supplierA).revealBid(100000000n, salt);
        await time.increaseTo(closeTime + revealWindow + 1);

        await expect(
            vault.connect(supplierA).settle()
        ).to.be.revertedWith("Only buyer can settle");
    });

    it("3.8 — Audit by non-auditor reverts", async function () {
        const { vault, outsider } = await loadFixture(deployFullFixture);

        await expect(
            vault.connect(outsider).getAuditData()
        ).to.be.reverted; // AccessControl revert
    });

    it("3.9 — Cancel after OPEN phase reverts", async function () {
        const { vault, buyer, supplierA, depositRequired, closeTime } =
            await loadFixture(deployFullFixture);

        await vault.connect(supplierA).commitBid(
            computeCommitHash(100000000n, randomSalt(), supplierA.address), "root", { value: depositRequired }
        );
        await time.increaseTo(closeTime);
        await vault.triggerRevealPhase();

        await expect(
            vault.connect(buyer).cancel()
        ).to.be.revertedWith("Can only cancel in OPEN phase");
    });

    it("3.10 — Commit with zero hash reverts", async function () {
        const { vault, supplierA, depositRequired } = await loadFixture(deployFullFixture);

        await expect(
            vault.connect(supplierA).commitBid(ethers.ZeroHash, "root", { value: depositRequired })
        ).to.be.revertedWith("Invalid commit hash");
    });

    it("3.11 — Commit without deposit reverts", async function () {
        const { vault, supplierA } = await loadFixture(deployFullFixture);

        const hash = computeCommitHash(100000000n, randomSalt(), supplierA.address);
        await expect(
            vault.connect(supplierA).commitBid(hash, "root", { value: 0 })
        ).to.be.revertedWith("Incorrect deposit amount");
    });

    it("3.12 — Commit with wrong deposit amount reverts", async function () {
        const { vault, supplierA, depositRequired } = await loadFixture(deployFullFixture);

        const hash = computeCommitHash(100000000n, randomSalt(), supplierA.address);
        const wrongDeposit = depositRequired + 1n;
        await expect(
            vault.connect(supplierA).commitBid(hash, "root", { value: wrongDeposit })
        ).to.be.revertedWith("Incorrect deposit amount");
    });

    it("3.13 — Commit after closeTime reverts", async function () {
        const { vault, supplierA, depositRequired, closeTime } = await loadFixture(deployFullFixture);

        await time.increaseTo(closeTime);
        const hash = computeCommitHash(100000000n, randomSalt(), supplierA.address);

        await expect(
            vault.connect(supplierA).commitBid(hash, "root", { value: depositRequired })
        ).to.be.revertedWith("Auction has closed");
    });

    it("3.14 — Double reveal reverts", async function () {
        const { vault, supplierA, depositRequired, closeTime } = await loadFixture(deployFullFixture);

        const salt = randomSalt();
        const hash = computeCommitHash(100000000n, salt, supplierA.address);

        await vault.connect(supplierA).commitBid(hash, "root", { value: depositRequired });
        await time.increaseTo(closeTime);
        await vault.triggerRevealPhase();
        await vault.connect(supplierA).revealBid(100000000n, salt);

        await expect(
            vault.connect(supplierA).revealBid(100000000n, salt)
        ).to.be.revertedWith("Already revealed");
    });

    it("3.15 — Empty storage root reverts", async function () {
        const { vault, supplierA, depositRequired } = await loadFixture(deployFullFixture);

        const hash = computeCommitHash(100000000n, randomSalt(), supplierA.address);
        await expect(
            vault.connect(supplierA).commitBid(hash, "", { value: depositRequired })
        ).to.be.revertedWith("Storage root required");
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// SCENARIO 7: CANCELLATION
// ═══════════════════════════════════════════════════════════════════════════
describe("Scenario 7: Cancellation", function () {
    it("7.1 — Cancel with deposits refunds all", async function () {
        const { vault, buyer, supplierA, supplierB, depositRequired } =
            await loadFixture(deployFullFixture);

        await vault.connect(supplierA).commitBid(
            computeCommitHash(100000000n, randomSalt(), supplierA.address), "rootA", { value: depositRequired }
        );
        await vault.connect(supplierB).commitBid(
            computeCommitHash(95000000n, randomSalt(), supplierB.address), "rootB", { value: depositRequired }
        );

        await expect(vault.connect(buyer).cancel())
            .to.emit(vault, "AuctionCancelled")
            .withArgs(2);
    });

    it("7.2 — Deposits refunded on cancel", async function () {
        const { vault, buyer, supplierA, supplierB, depositRequired } =
            await loadFixture(deployFullFixture);

        await vault.connect(supplierA).commitBid(
            computeCommitHash(100000000n, randomSalt(), supplierA.address), "rootA", { value: depositRequired }
        );
        await vault.connect(supplierB).commitBid(
            computeCommitHash(95000000n, randomSalt(), supplierB.address), "rootB", { value: depositRequired }
        );

        const tx = await vault.connect(buyer).cancel();

        await expect(tx).to.emit(vault, "DepositReturned").withArgs(supplierA.address, depositRequired);
        await expect(tx).to.emit(vault, "DepositReturned").withArgs(supplierB.address, depositRequired);
    });

    it("7.3 — Phase is CANCELLED after cancel", async function () {
        const { vault, buyer } = await loadFixture(deployFullFixture);
        await vault.connect(buyer).cancel();
        expect(await vault.phase()).to.equal(3); // CANCELLED
    });

    it("7.4 — Cancel by non-buyer reverts", async function () {
        const { vault, supplierA } = await loadFixture(deployFullFixture);
        await expect(
            vault.connect(supplierA).cancel()
        ).to.be.revertedWith("Only buyer can cancel");
    });

    it("7.5 — Double cancel reverts", async function () {
        const { vault, buyer } = await loadFixture(deployFullFixture);
        await vault.connect(buyer).cancel();
        await expect(
            vault.connect(buyer).cancel()
        ).to.be.revertedWith("Can only cancel in OPEN phase");
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// SCENARIO 8: FACTORY & ACCESS CONTROL
// ═══════════════════════════════════════════════════════════════════════════
describe("Scenario 8: Factory & Access Control", function () {
    async function deployFactoryOnly() {
        const [owner, buyer, addr1, addr2, auditor] = await ethers.getSigners();
        const Factory = await ethers.getContractFactory("ShadowBidFactory");
        const factory = await Factory.deploy();
        await factory.waitForDeployment();
        return { factory, owner, buyer, addr1, addr2, auditor };
    }

    it("8.1 — Create vault without BUYER_ROLE reverts", async function () {
        const { factory, addr1, auditor } = await loadFixture(deployFactoryOnly);
        const now = await time.latest();

        await expect(
            factory.connect(addr1).createVault(
                "Test", "Desc", now + 600, 3600, ethers.parseEther("0.01"),
                [addr1.address], auditor.address, "pubkey"
            )
        ).to.be.reverted;
    });

    it("8.2 — Grant BUYER_ROLE enables vault creation", async function () {
        const { factory, owner, buyer, addr1, auditor } = await loadFixture(deployFactoryOnly);
        await factory.grantBuyerRole(buyer.address);
        const now = await time.latest();

        await expect(
            factory.connect(buyer).createVault(
                "Test", "Desc", now + 600, 3600, ethers.parseEther("0.01"),
                [addr1.address], auditor.address, "pubkey"
            )
        ).to.emit(factory, "VaultCreated");
    });

    it("8.3 — Revoke BUYER_ROLE blocks vault creation", async function () {
        const { factory, owner, buyer, addr1, auditor } = await loadFixture(deployFactoryOnly);
        await factory.grantBuyerRole(buyer.address);
        await factory.revokeBuyerRole(buyer.address);
        const now = await time.latest();

        await expect(
            factory.connect(buyer).createVault(
                "Test", "Desc", now + 600, 3600, ethers.parseEther("0.01"),
                [addr1.address], auditor.address, "pubkey"
            )
        ).to.be.reverted;
    });

    it("8.4 — getAllVaults returns correct list", async function () {
        const { factory, owner, addr1, auditor } = await loadFixture(deployFactoryOnly);
        const now = await time.latest();

        await factory.connect(owner).createVault(
            "Vault1", "D", now + 600, 3600, ethers.parseEther("0.01"),
            [addr1.address], auditor.address, "pk"
        );
        await factory.connect(owner).createVault(
            "Vault2", "D", now + 601, 3600, ethers.parseEther("0.02"),
            [addr1.address], auditor.address, "pk"
        );

        const vaults = await factory.getAllVaults();
        expect(vaults.length).to.equal(2);
    });

    it("8.5 — getVaultsByBuyer returns only that buyer's vaults", async function () {
        const { factory, owner, buyer, addr1, auditor } = await loadFixture(deployFactoryOnly);
        await factory.grantBuyerRole(buyer.address);
        const now = await time.latest();

        await factory.connect(owner).createVault(
            "Owner Vault", "D", now + 600, 3600, ethers.parseEther("0.01"),
            [addr1.address], auditor.address, "pk"
        );
        await factory.connect(buyer).createVault(
            "Buyer Vault", "D", now + 601, 3600, ethers.parseEther("0.01"),
            [addr1.address], auditor.address, "pk"
        );

        const ownerVaults = await factory.getVaultsByBuyer(owner.address);
        const buyerVaults = await factory.getVaultsByBuyer(buyer.address);
        expect(ownerVaults.length).to.equal(1);
        expect(buyerVaults.length).to.equal(1);
    });

    it("8.6 — closeTime too soon reverts", async function () {
        const { factory, owner, addr1, auditor } = await loadFixture(deployFactoryOnly);
        const now = await time.latest();

        await expect(
            factory.connect(owner).createVault(
                "Test", "D", now + 60, 3600, ethers.parseEther("0.01"),
                [addr1.address], auditor.address, "pk"
            )
        ).to.be.revertedWith("closeTime must be > now + 5min");
    });

    it("8.7 — revealWindow too short reverts", async function () {
        const { factory, owner, addr1, auditor } = await loadFixture(deployFactoryOnly);
        const now = await time.latest();

        await expect(
            factory.connect(owner).createVault(
                "Test", "D", now + 600, 60, ethers.parseEther("0.01"),
                [addr1.address], auditor.address, "pk"
            )
        ).to.be.revertedWith("revealWindow must be >= 1h");
    });

    it("8.8 — No suppliers reverts", async function () {
        const { factory, owner, auditor } = await loadFixture(deployFactoryOnly);
        const now = await time.latest();

        await expect(
            factory.connect(owner).createVault(
                "Test", "D", now + 600, 3600, ethers.parseEther("0.01"),
                [], auditor.address, "pk"
            )
        ).to.be.revertedWith("At least 1 supplier required");
    });
});
