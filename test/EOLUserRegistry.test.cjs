const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("EOLUserRegistry", function () {
    let eolRegistry;
    let owner;
    let user1;
    let user2;
    const MAX_MINT_AMOUNT = ethers.parseEther("1000");
    const MAX_SUPPLY = ethers.parseEther("1000000");

    beforeEach(async function () {
        [owner, user1, user2] = await ethers.getSigners();

        const EOLUserRegistry = await ethers.getContractFactory(
            "EOLUserRegistry"
        );
        eolRegistry = await EOLUserRegistry.deploy();
        await eolRegistry.waitForDeployment();
    });

    async function generateSignature(signer, nullifier) {
        const message = ethers.solidityPackedKeccak256(
            ["address", "bytes32"],
            [signer.address, nullifier]
        );

        return signer.signMessage(ethers.getBytes(message));
    }

    describe("Access Control", function () {
        it("should allow owner to pause and unpause", async function () {
            await eolRegistry.connect(owner).pause();

            const nullifier = ethers.randomBytes(32);
            const signature = await generateSignature(user1, nullifier);

            await expect(
                eolRegistry.connect(user1).registerUser(nullifier, signature)
            ).to.be.revertedWith("Contract is paused");

            await eolRegistry.connect(owner).unpause();

            await expect(
                eolRegistry.connect(user1).registerUser(nullifier, signature)
            ).to.not.be.reverted;
        });

        it("should not allow non-owner to pause", async function () {
            await expect(eolRegistry.connect(user1).pause()).to.be.revertedWith(
                "Ownable: caller is not the owner"
            );
        });
    });

    describe("User Registration", function () {
        it("should allow a user to register with valid signature", async function () {
            const nullifier = ethers.randomBytes(32);
            const signature = await generateSignature(user1, nullifier);

            await expect(
                eolRegistry.connect(user1).registerUser(nullifier, signature)
            )
                .to.emit(eolRegistry, "UserRegistered")
                .withArgs(user1.address, nullifier);

            expect(await eolRegistry.connect(user1).getNullifier()).to.equal(
                nullifier
            );
        });

        it("should not allow double registration", async function () {
            const nullifier = ethers.randomBytes(32);
            const signature = await generateSignature(user1, nullifier);

            await eolRegistry.connect(user1).registerUser(nullifier, signature);

            await expect(
                eolRegistry.connect(user1).registerUser(nullifier, signature)
            ).to.be.revertedWith("User already registered");
        });
    });

    describe("Token Operations", function () {
        let nullifier;
        let signature;

        beforeEach(async function () {
            nullifier = ethers.randomBytes(32);
            signature = await generateSignature(user1, nullifier);
            await eolRegistry.connect(user1).registerUser(nullifier, signature);
        });

        it("should allow minting tokens within limits", async function () {
            const mintAmount = ethers.parseEther("100");

            await expect(eolRegistry.connect(user1).mintTokens(mintAmount))
                .to.emit(eolRegistry, "TokensMinted")
                .withArgs(user1.address, mintAmount);

            expect(await eolRegistry.connect(user1).getBalance()).to.equal(
                mintAmount
            );
        });

        it("should not allow minting above MAX_MINT_AMOUNT", async function () {
            const tooMuch = MAX_MINT_AMOUNT + 1n;

            await expect(
                eolRegistry.connect(user1).mintTokens(tooMuch)
            ).to.be.revertedWith("Exceeds maximum mint amount");
        });

        it("should not allow minting above MAX_SUPPLY", async function () {
            // Try to mint more than MAX_SUPPLY
            await expect(
                eolRegistry.connect(user1).mintTokens(MAX_SUPPLY + 1n)
            ).to.be.revertedWith("Exceeds maximum mint amount");
        });

        it("should enforce total supply limit across multiple mints", async function () {
            const mintAmount = ethers.parseEther("500000");
            await eolRegistry.connect(user1).mintTokens(mintAmount);

            // Try to mint remaining amount plus one
            await expect(
                eolRegistry.connect(user1).mintTokens(mintAmount + 1n)
            ).to.be.revertedWith("Exceeds maximum supply");
        });
    });

    describe("Nullifier Recovery", function () {
        let userNullifier;

        beforeEach(async function () {
            userNullifier = ethers.randomBytes(32);
            const signature = await generateSignature(user1, userNullifier);
            await eolRegistry
                .connect(user1)
                .registerUser(userNullifier, signature);
        });

        it("should allow owner to recover lost nullifier", async function () {
            const newNullifier = ethers.randomBytes(32);

            await expect(
                eolRegistry
                    .connect(owner)
                    .recoverLostNullifier(user1.address, newNullifier)
            )
                .to.emit(eolRegistry, "LostNullifierRecovered")
                .withArgs(user1.address, newNullifier);

            expect(await eolRegistry.connect(user1).getNullifier()).to.equal(
                newNullifier
            );
        });

        it("should not allow non-owner to recover nullifier", async function () {
            const newNullifier = ethers.randomBytes(32);

            await expect(
                eolRegistry
                    .connect(user2)
                    .recoverLostNullifier(user1.address, newNullifier)
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("should not recover nullifier for unregistered user", async function () {
            const newNullifier = ethers.randomBytes(32);

            await expect(
                eolRegistry
                    .connect(owner)
                    .recoverLostNullifier(user2.address, newNullifier)
            ).to.be.revertedWith("User is not registered");
        });
    });

    describe("Logout and ReLogin", function () {
        let nullifier;

        beforeEach(async function () {
            nullifier = ethers.randomBytes(32);
            const signature = await generateSignature(user1, nullifier);
            await eolRegistry.connect(user1).registerUser(nullifier, signature);
        });

        it("should not allow operations when paused", async function () {
            await eolRegistry.connect(owner).pause();

            await expect(
                eolRegistry.connect(user1).logout()
            ).to.be.revertedWith("Contract is paused");

            const newNullifier = ethers.randomBytes(32);
            const signature = await generateSignature(user1, newNullifier);

            await expect(
                eolRegistry.connect(user1).reLogin(newNullifier, signature)
            ).to.be.revertedWith("Contract is paused");
        });

        it("should allow user to logout", async function () {
            await expect(eolRegistry.connect(user1).logout())
                .to.emit(eolRegistry, "UserLoggedOut")
                .withArgs(user1.address);

            await expect(
                eolRegistry.connect(user1).getNullifier()
            ).to.be.revertedWith("User is not registered");
        });

        it("should allow user to re-login with new nullifier", async function () {
            const newNullifier = ethers.randomBytes(32);
            const signature = await generateSignature(user1, newNullifier);

            await expect(
                eolRegistry.connect(user1).reLogin(newNullifier, signature)
            )
                .to.emit(eolRegistry, "UserReLoggedIn")
                .withArgs(user1.address, nullifier, newNullifier);

            expect(await eolRegistry.connect(user1).getNullifier()).to.equal(
                newNullifier
            );
        });
    });
});
