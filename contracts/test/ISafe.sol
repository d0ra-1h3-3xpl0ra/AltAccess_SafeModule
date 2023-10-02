// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.8.0 <0.9.0;

interface ISafe {
    function getThreshold() external view returns (uint256);

    function getChainId() external view returns (uint256);

    function isOwner(address owner) external view returns (bool);

    function isModuleEnabled(address module) external view returns (bool);

    function execTransaction(
        address to,
        uint256 value,
        bytes calldata data,
        uint8 operation,
        uint256 safeTxGas,
        uint256 baseGas,
        uint256 gasPrice,
        address gasToken,
        address payable refundReceiver,
        bytes memory signatures
    ) external payable returns (bool success);

    function addOwnerWithThreshold(address owner, uint256 _threshold) external;

    function enableModule(address module) external;

    function nonce() external view returns (uint256);

    function approveHash(bytes32 hashToApprove) external;

    function encodeTransactionData(
        address to,
        uint256 value,
        bytes calldata data,
        uint8 operation,
        uint256 safeTxGas,
        uint256 baseGas,
        uint256 gasPrice,
        address gasToken,
        address payable refundReceiver
    ) external view returns (bytes memory);

    function getTransactionHash(
        address to,
        uint256 value,
        bytes calldata data,
        uint8 operation,
        uint256 safeTxGas,
        uint256 baseGas,
        uint256 gasPrice,
        address gasToken,
        address payable refundReceiver,
        uint256 nonce
    ) external view returns (bytes32);

    function checkSignatures(bytes32 dataHash, bytes memory data, bytes memory signatures) external view;

    function checkNSignatures(bytes32 dataHash, bytes memory data, bytes memory signatures, uint256 requiredSignatures) external view;
}
