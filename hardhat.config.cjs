require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
    solidity: {
        version: "0.8.19",
    },
    networks: {
        hardhat: {
            chainId: 31337,
        },
        localhost: {
            url: "http://127.0.0.1:8545",
        },
        sepolia: {
            url: process.env.SEPOLIA_RPC_URL || "",
            accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
            chainId: 11155111,
        },
    },
    // gasReporter: {
    //     enabled: true,
    //     currency: "USD",
    //     coinmarketcap: process.env.COINMARKETCAP_API_KEY,
    //     token: "ETH",
    //     gasPriceApi:
    //         "https://api.etherscan.io/api?module=proxy&action=eth_gasPrice",
    // },
    etherscan: {
        apiKey: process.env.ETHERSCAN_API_KEY,
    },
};
