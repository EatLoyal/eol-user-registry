// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract EOLUserRegistry is ReentrancyGuard, Ownable {
    // Events
    event UserRegistered(address indexed user, bytes32 nullifier);
    event UserLoggedOut(address indexed user);
    event UserReLoggedIn(address indexed user, bytes32 oldNullifier, bytes32 newNullifier);
    event TokensMinted(address indexed user, uint256 amount);
    event TokensTransferred(address indexed from, address indexed to, uint256 amount);
    event LostNullifierRecovered(address indexed user, bytes32 newNullifier);

    // State variables
    mapping(address => bytes32) private userNullifiers; // Maps user address to their nullifier
    mapping(bytes32 => address) private nullifierToUser; // Maps nullifier to user address
    mapping(address => uint256) private eolBalances; // Maps user address to EOL token balance

    uint256 private constant MAX_MINT_AMOUNT = 1000 ether; // Maximum mint amount per transaction
    uint256 private constant MAX_SUPPLY = 1_000_000 ether; // Maximum total supply
    uint256 private totalSupply; // Tracks total minted tokens
    bool private paused; // Pausing state

    // Modifiers
    modifier onlyRegistered() {
        require(userNullifiers[msg.sender] != bytes32(0), "User is not registered");
        _;
    }

    modifier whenNotPaused() {
        require(!paused, "Contract is paused");
        _;
    }

    // Constructor
    constructor(address initialOwner) Ownable(initialOwner) {
        paused = false; // Contract starts in an unpaused state
    }

    // Access control: Pausing and unpausing the contract
    function pause() external onlyOwner {
        paused = true;
    }

    function unpause() external onlyOwner {
        paused = false;
    }

    // Register a new user with a nullifier (requires wallet signature)
    function registerUser(bytes32 nullifier, bytes memory signature) external whenNotPaused {
        require(userNullifiers[msg.sender] == bytes32(0), "User already registered");
        require(nullifierToUser[nullifier] == address(0), "Nullifier already used");
        require(verifySignature(msg.sender, nullifier, signature), "Invalid signature");

        userNullifiers[msg.sender] = nullifier;
        nullifierToUser[nullifier] = msg.sender;

        emit UserRegistered(msg.sender, nullifier);
    }

    // Logout functionality to invalidate the user's nullifier
    function logout() external onlyRegistered whenNotPaused {
        bytes32 currentNullifier = userNullifiers[msg.sender];
        delete userNullifiers[msg.sender];
        delete nullifierToUser[currentNullifier];

        emit UserLoggedOut(msg.sender);
    }

    // Re-login functionality to replace the nullifier (requires wallet signature)
    function reLogin(bytes32 newNullifier, bytes memory signature) external onlyRegistered whenNotPaused {
        require(nullifierToUser[newNullifier] == address(0), "Nullifier already used");
        require(verifySignature(msg.sender, newNullifier, signature), "Invalid signature");

        bytes32 oldNullifier = userNullifiers[msg.sender];
        delete nullifierToUser[oldNullifier];
        userNullifiers[msg.sender] = newNullifier;
        nullifierToUser[newNullifier] = msg.sender;

        emit UserReLoggedIn(msg.sender, oldNullifier, newNullifier);
    }

    // Mint EOL tokens for a registered user
    function mintTokens(uint256 amount) external onlyRegistered whenNotPaused {
        require(amount > 0, "Amount must be greater than zero");
        require(amount <= MAX_MINT_AMOUNT, "Exceeds maximum mint amount");
        require(totalSupply + amount <= MAX_SUPPLY, "Exceeds maximum supply");

        eolBalances[msg.sender] += amount;
        totalSupply += amount;

        emit TokensMinted(msg.sender, amount);
    }

    // Transfer EOL tokens to another user
    function transferTokens(address to, uint256 amount) external onlyRegistered whenNotPaused nonReentrant {
        require(userNullifiers[to] != bytes32(0), "Recipient is not registered");
        require(eolBalances[msg.sender] >= amount, "Insufficient balance");

        eolBalances[msg.sender] -= amount;
        eolBalances[to] += amount;

        emit TokensTransferred(msg.sender, to, amount);
    }

    // Recover lost nullifier by generating a new one (only callable by owner for recovery support)
    function recoverLostNullifier(address user, bytes32 newNullifier) external onlyOwner whenNotPaused {
        require(userNullifiers[user] != bytes32(0), "User is not registered");
        require(nullifierToUser[newNullifier] == address(0), "Nullifier already used");

        bytes32 oldNullifier = userNullifiers[user];
        delete nullifierToUser[oldNullifier];
        userNullifiers[user] = newNullifier;
        nullifierToUser[newNullifier] = user;

        emit LostNullifierRecovered(user, newNullifier);
    }

    // Get the EOL token balance of the caller
    function getBalance() external view onlyRegistered returns (uint256) {
        return eolBalances[msg.sender];
    }

    // Get the nullifier of the caller
    function getNullifier() external view onlyRegistered returns (bytes32) {
        return userNullifiers[msg.sender];
    }

    // Verify the signature for registration or re-login
    function verifySignature(
        address user,
        bytes32 nullifier,
        bytes memory signature
    ) internal pure returns (bool) {
        bytes32 messageHash = keccak256(abi.encodePacked(user, nullifier));
        bytes32 ethSignedMessageHash = getEthSignedMessageHash(messageHash);

        return recoverSigner(ethSignedMessageHash, signature) == user;
    }

    // Generate Ethereum signed message hash
    function getEthSignedMessageHash(bytes32 messageHash) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash));
    }

    // Recover signer address from signature
    function recoverSigner(bytes32 ethSignedMessageHash, bytes memory signature) internal pure returns (address) {
        (bytes32 r, bytes32 s, uint8 v) = splitSignature(signature);
        return ecrecover(ethSignedMessageHash, v, r, s);
    }

    // Split signature into r, s, and v
    function splitSignature(bytes memory sig) internal pure returns (bytes32 r, bytes32 s, uint8 v) {
        require(sig.length == 65, "Invalid signature length");

        assembly {
            r := mload(add(sig, 32))
            s := mload(add(sig, 64))
            v := byte(0, mload(add(sig, 96)))
        }
    }
}
