// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title RemindifyAttestations
/// @notice Anchors EIP-712 proof receipts filed by Remindify owners and agents.
/// @dev Reference implementation. Unaudited. Deploy to a testnet first.
///
/// The server signs nothing. It prepares EIP-712 typed data, the owner's wallet
/// signs it, and this contract verifies that signature before recording the
/// receipt hash. Raw proof material never touches the chain.
contract RemindifyAttestations {
    bytes32 private constant _RECEIPT_TYPEHASH = keccak256(
        "ProofReceipt(string obligationId,bytes32 proofHash,bytes32 evidenceHash,string agentId,uint64 issuedAt,bytes32 nonce)"
    );
    bytes32 private constant _DOMAIN_TYPEHASH = keccak256(
        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
    );

    bytes32 private immutable _DOMAIN_SEPARATOR;
    mapping(bytes32 => bool) public anchored;

    event ReceiptAnchored(
        bytes32 indexed receiptId,
        address indexed signer,
        bytes32 proofHash,
        bytes32 evidenceHash,
        uint64 issuedAt
    );

    constructor() {
        _DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                _DOMAIN_TYPEHASH,
                keccak256("Remindify Trust"),
                keccak256("1"),
                block.chainid,
                address(this)
            )
        );
    }

    function domainSeparator() external view returns (bytes32) {
        return _DOMAIN_SEPARATOR;
    }

    /// @notice Anchor a signed proof receipt.
    /// @param obligationId The offchain obligation identifier.
    /// @param proofHash Hash of the proof label and nonce.
    /// @param evidenceHash Hash of the obligation evidence envelope.
    /// @param agentId The agent or owner identifier.
    /// @param issuedAt Unix timestamp in the signed payload.
    /// @param nonce Unique receipt nonce.
    /// @param signature 65-byte EIP-712 signature from the owner or agent wallet.
    function anchor(
        string calldata obligationId,
        bytes32 proofHash,
        bytes32 evidenceHash,
        string calldata agentId,
        uint64 issuedAt,
        bytes32 nonce,
        bytes calldata signature
    ) external {
        bytes32 receiptId = keccak256(
            abi.encode(obligationId, proofHash, evidenceHash, agentId, issuedAt, nonce)
        );
        require(!anchored[receiptId], "already anchored");

        bytes32 structHash = keccak256(
            abi.encode(
                _RECEIPT_TYPEHASH,
                keccak256(bytes(obligationId)),
                proofHash,
                evidenceHash,
                keccak256(bytes(agentId)),
                issuedAt,
                nonce
            )
        );
        bytes32 digest = keccak256(
            abi.encodePacked("\x19\x01", _DOMAIN_SEPARATOR, structHash)
        );
        address signer = _recover(digest, signature);
        require(signer != address(0), "bad signature");

        anchored[receiptId] = true;
        emit ReceiptAnchored(receiptId, signer, proofHash, evidenceHash, issuedAt);
    }

    function _recover(bytes32 digest, bytes calldata signature) private pure returns (address) {
        require(signature.length == 65, "bad signature length");
        bytes32 r = bytes32(signature[0:32]);
        bytes32 s = bytes32(signature[32:64]);
        uint8 v = uint8(signature[64]);
        if (v < 27) v += 27;
        require(v == 27 || v == 28, "bad v");
        require(
            uint256(s) <= 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0,
            "bad s"
        );
        return ecrecover(digest, v, r, s);
    }
}
