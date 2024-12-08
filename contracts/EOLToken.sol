// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

contract EOLToken is ERC20, Ownable, Pausable {
    uint256 private constant INITIAL_SUPPLY = 0; // Initial token supply
    uint256 private constant MAX_SUPPLY = 1_000_000 ether; // Maximum token supply

    mapping(address => bool) private minters; // Addresses allowed to mint tokens

    // Constructor
    constructor(address initialOwner) ERC20("EOL Token", "EOL") Ownable(initialOwner) {
        _mint(msg.sender, INITIAL_SUPPLY); // Mint initial supply to deployer
    }

    // Modifier to restrict access to approved minters
    modifier onlyMinter() {
        require(minters[msg.sender], "Caller is not an authorized minter");
        _;
    }

    // Add an authorized minter
    function addMinter(address minter) external onlyOwner {
        minters[minter] = true;
    }

    // Remove an authorized minter
    function removeMinter(address minter) external onlyOwner {
        minters[minter] = false;
    }

    // Mint tokens (only callable by authorized minters)
    function mint(address to, uint256 amount) external onlyMinter whenNotPaused {
        require(totalSupply() + amount <= MAX_SUPPLY, "Exceeds maximum supply");
        _mint(to, amount);
    }

    // Burn tokens (only callable by owner)
    function burn(address from, uint256 amount) external onlyOwner whenNotPaused {
        _burn(from, amount);
    }

    // Pause the contract (only callable by owner)
    function pause() external onlyOwner {
        _pause();
    }

    // Unpause the contract (only callable by owner)
    function unpause() external onlyOwner {
        _unpause();
    }
}
