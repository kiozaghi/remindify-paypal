// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

interface IRemindifyAttestations {
    function anchored(bytes32 receiptId) external view returns (bool);
}

/// @title RemindifyEscrow
/// @notice A minimal USDC escrow that releases only against an anchored proof receipt.
/// @dev Reference implementation. Unaudited. Deploy to a testnet first.
///
/// The payer funds an escrow. Release requires the payer to reference a receipt
/// that exists in the RemindifyAttestations registry. The contract never holds
/// keys and never decides whether a proof is valid beyond the registry check.
contract RemindifyEscrow {
    IERC20 public immutable usdc;
    IRemindifyAttestations public immutable attestations;

    struct Escrow {
        address payer;
        address payee;
        uint256 amount;
        bytes32 proofReceiptId;
        bool funded;
        bool released;
    }

    mapping(bytes32 => Escrow) public escrows;

    event EscrowFunded(
        bytes32 indexed escrowId,
        address indexed payer,
        address indexed payee,
        uint256 amount
    );
    event EscrowReleased(
        bytes32 indexed escrowId,
        bytes32 proofReceiptId,
        uint256 amount
    );

    constructor(address _usdc, address _attestations) {
        require(_usdc != address(0), "usdc required");
        require(_attestations != address(0), "attestations required");
        usdc = IERC20(_usdc);
        attestations = IRemindifyAttestations(_attestations);
    }

    function fund(bytes32 escrowId, address payee, uint256 amount) external {
        Escrow storage e = escrows[escrowId];
        require(e.payer == address(0), "escrow exists");
        require(payee != address(0), "payee required");
        require(amount > 0, "amount required");
        require(usdc.transferFrom(msg.sender, address(this), amount), "transfer failed");

        e.payer = msg.sender;
        e.payee = payee;
        e.amount = amount;
        e.funded = true;

        emit EscrowFunded(escrowId, msg.sender, payee, amount);
    }

    function release(bytes32 escrowId, bytes32 proofReceiptId) external {
        Escrow storage e = escrows[escrowId];
        require(e.funded, "not funded");
        require(!e.released, "already released");
        require(msg.sender == e.payer, "only payer");
        require(attestations.anchored(proofReceiptId), "proof not anchored");

        e.released = true;
        e.proofReceiptId = proofReceiptId;

        require(usdc.transfer(e.payee, e.amount), "transfer failed");
        emit EscrowReleased(escrowId, proofReceiptId, e.amount);
    }
}
