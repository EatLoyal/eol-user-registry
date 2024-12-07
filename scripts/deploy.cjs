// scripts/deploy.js
const { ethers, run, network } = require("hardhat");

async function main() {
    console.log("Deploying EOLUserRegistry...");

    const EOLUserRegistry = await ethers.getContractFactory("EOLUserRegistry");
    const eolRegistry = await EOLUserRegistry.deploy();

    await eolRegistry.waitForDeployment();

    const address = await eolRegistry.getAddress();
    console.log("EOLUserRegistry deployed to:", address);

    // Verify contract on Etherscan if on Sepolia network
    if (network.name === "sepolia" && process.env.ETHERSCAN_API_KEY) {
        console.log("Waiting for block confirmations...");
        await eolRegistry.deploymentTransaction().wait(6); // Wait for 6 block confirmations

        console.log("Verifying contract...");
        try {
            await run("verify:verify", {
                address: address,
                constructorArguments: [],
            });
        } catch (e) {
            if (e.message.toLowerCase().includes("already verified")) {
                console.log("Contract is already verified!");
            } else {
                console.log(e);
            }
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
