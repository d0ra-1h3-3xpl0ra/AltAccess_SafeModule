<h1 align="center"> Safe Module Take Home Task Documentation </h1> 

<p align="center">
  <img src="img/safe_logo.png" />
</p>

## About
Write a Safe Module that allows you to execute transactions via the Safe contract with an alternative access scheme.

### Objective
The contract written for this challenge should use alternative access functionality to allow accounts that are not related to the Safe, to withdraw a predetermined amount of a specific token.

To better understand this, here is an example:
Alice has set up a Safe which they use to hold all of their Unicorn tokens. They want to hand out unicorn tokens easily without having to trigger a transaction each time. Therefore they enable the module written in this challenge. Now they can generate a signature which allows anyone to withdraw Unicorn tokens from their Safe. With this, Alice generates a signature for a withdrawal of 10 Unicorn tokens and shares it with Bob. Now Bob can use this signature and interact with the module which will then send 10 Unicorn tokens from Alice’s Safe to Bob's address.

## The Task
- [x] The module should be specific to a token address and to a Safe. 

- [x] A method to withdraw tokens via a transaction: => `execAllowanceTransfer()`
  - [x] Amount of tokens to withdraw => `execAllowanceTransfer()` => `(uint96 Amount)`
  - [x] A beneficiary (receiver of the tokens) => `execAllowanceTransfer()` => `(address payable to)`
  - [x] A signature of an owner of the Safe it is attached to. => `execAllowanceTransfer()` =>`(bytes memory signature)`

- [x] (The module is not required to work for multiple token addresses or multiple safe addresses) => `setTargetToken(), setTargetSafe(), `

Optional Features:
- [x] Signatures should expire after a set time. => `setAllowance()` => `resetTime` > 0
- [ ]The module should require the signatures of multiple owners to meet the threshold requirement of the attached Safe. `(WIP)`


## Features

- The module is specific to a token address and to a Safe
    - The module allows transfers only from `targetSafe` and allows the user only to withdraw `targetToken`, which can be set or queried with `getTargetToken` or `getTargetSafe`.
- Tokens can be withdrawn by calling `executeAllowanceTransfer`. For withdrawal, the Safe Owner should add delegates via this Module and set an Allowance (one-time or set an expiration date in minutes).
- Signatures can expire after a set time when `setAllowance()` is configured with:
    - `uint16 resetTimeMin` to be set with a value < 65’535
    - `resetBaseMin` = 0

<aside>
💡 This module does not support recurring transactions with an expiration Date set.

</aside>



## Creating Allowances

1. Call `setTargetToken` with the Token Contract Address and `setTargetSafe` with the Safe Contract Address.
    1. This will lock the Module to only enable AllowanceTransfers on specified Token and Safe.
2. Execute a Safe Transaction calling `addDelegate`. This method will add the speciefed delegate for `msg.sender`.
    1. (`addDelegate` can be called multiple times with the same address for a delegate without failure)
3.  The method `setAllowance` can be called as a Safe Transaction after adding a Delegate, specifying a targetToken and targetSafe and will be used to create an one-time allowance or an allowance with an expiration date specified in minutes.
4. To delete an allowance for a specific token a Safe transaction needs to be executed that calls `deleteAllowance`. Another way is to remove the **delegate** with a Safe transaction that calls `removeDelegate`, but this will remove all allowances for this delegate.

## Transfer authorization

Transfer are authorized by the delegates and must be within their allowance. To authorize a transfer the delegate needs to generate a signature. The allowance module uses the same [signature scheme as the Safe Smart Accounts](https://docs.safe.global/safe-smart-account/signatures), except that the allowance module does not support contract signatures or approved hashes yet. 

The allowance module signatures are EIP-712 based. And uses the following scheme:

- EIP712Domain

```json
{
    "EIP712Domain": [
        { "type": "uint256", "name": "chainId" },
        { "type": "address", "name": "verifyingContract" }
    ]
}
```

- AllowanceTransfer

```json
{
    "AllowanceTransfer": [
        { "type": "address", "name": "safe" },
        { "type": "address", "name": "token" },
        { "type": "address", "name": "to" },
        { "type": "uint96", "name": "amount" },
        { "type": "address", "name": "paymentToken" },
        { "type": "uint96", "name": "payment" },
        { "type": "uint16", "name": "nonce" },
    ]
}
```

## Transfer execution


Anyone can execute the transfer as long as they provide the [transfer authorization](https://file+.vscode-resource.vscode-cdn.net/Users/magicinternetmoney/Documents/34_MSIG/SAFE_modules/allowances/README.md#transfer-authorization) of a valid **delegate**. To execute the transfer, the `executeAllowanceTransfer` method needs to be called, which checks the signature and calls the Safe to perform the transfer.

When calling the Safe, there are two cases that need to be differentiated: an Ether transfer and a token transfer.

- In case of an **Ether transfer,** the module instructs the Safe to transfer the specified amount to the receiver (so no data is provided).
- In case of a **token transfer,** the module instructs the Safe to call the transfer method on the token contract to transfer the specified amount to the receiver (so a value of `0` is provided).


## One-time allowances

If the `resetTimeMin` time of an allowance is `0` then the allowance will not automatically renew. This means when the `delegate` has used up the allowance and should revert on further withdrawal attempts.

To reset previously set allowance we can execute a Safe transaction that calls `resetAllowance`. 

```solidity
// Set a one-time Allowance
function setAllowance(
	address delegate, // Delegate whose allowance should be updated
	address token, // Token Contract address
	uint96 allowanceAmount, // Token Amount available for the Allowance
	uint16 resetTimeMin, //= 0
	uint32 resetBaseMin //= 0
) public {}
```

## Allowances with expiration

If `resetTimeMin` is set to any value greater than `0` the allowance will automatically expire after the specified amount of minutes based on the last reset time. 

After the allowance expires, the `spent` amount of an allowance will be set equal to `amount` and the allowance expired.

```solidity
// Set a Allowance with expiration
function setAllowance(
	address delegate, // Delegate whose allowance should be updated
	address token, // Token Contract address
	uint96 allowanceAmount, // Token Amount available for the Allowance
	uint16 resetTimeMin, //=When should the allowance expire? Time in min < 65'535
	uint32 resetBaseMin //= 0
) public {}
```

## Architecture



The contract has been designed to improve the gas usage when executing a transfer and to make it easy to interact with the contract. Because of this configuration changes (e.g. adding or removing allowance and delegates) are not optimized on gas usage.

All Allowances are stored in a map called allowances and can be accessed with a combination of the Safe, the delegate and the Token.

- `uint96 amount`
    - The maximum amount that can be spent
- `uint96 spent`
    - The amount that has already been spent
- `uint16 restTimeMin`
    - Time in **minutes** when the spent amount was last reset to 0.
- `uint16 nonce`
    - Increasing nonce to protect transfer confirmations (e.g. signatures) against replay attacks.

`delegates` stores all the delegates for a specific Safe in a double-linked list. We also store an entry point to that double-linked list in `delegatesStart`. Each delegate is identified by a `uint48`, the first **6bytes** of the delegate address. This could cause collisions. Therefore, the index points to a struct containing the `address` of the delegate, the `next` index and the `prev` index so that it is possible to verify which address was used to get the index. In case of collisions, we recommend to generate a new delegate.

*`tokens`* is a list that is appended whenever an allowance is set for a token for the first time. The tokens will never be removed from this list.

Using *delegates* and *tokens*, it is possible to query all available allowances for a Safe. This is to avoid that there are any "hidden" allowances.


## Testing

```bash
yarn 
yarn test
```

### Test One-Time Allowance

```bash
yarn testOnetime
```

### Test Signature with Expiration

```bash
yarn testExpiration
```

## Compiling the contracts

```bash
yarn 
yarn build
```

## Threshold requirement
> (WIP), coming soon...
- Errors: (GS026, GS013)

## Notes

This is a Fork of the Allowances Module @Safe-Modules repository. I've modified the contract and extended the Tests.
Next steps: Fix missing feature (check if threshold requirements and fix `checkNSignature` ) Refactor, remove a few unnecessary assertions since a few Features are out of Scope. Improve Gas Efficiency...


## Tools used:

- Hardhat

