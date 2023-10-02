import { Contract, Wallet, BigNumber, BigNumberish, Signer, PopulatedTransaction, BytesLike } from 'ethers'
import { TypedDataSigner } from "@ethersproject/abstract-signer";
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers'
import "@nomicfoundation/hardhat-ethers";
import { AddressZero } from "@ethersproject/constants";
import { ISafe } from "../typechain-types";
import { ethers } from 'hardhat';
import { Address } from 'hardhat-deploy/types';

export const EIP_DOMAIN = {
    EIP712Domain: [
        { type: "uint256", name: "chainId" },
        { type: "address", name: "verifyingContract" }
    ]
}
//##################################
//##################################
// THIS TEST IS NOT WORKING AND WIP
//##################################
//##################################
export const EIP712_SAFE_TX_TYPE = {
    // "SafeTx(address to,uint256 value,bytes data,uint8 operation,uint256 safeTxGas,uint256 baseGas,uint256 gasPrice,address gasToken,address refundReceiver,uint256 nonce)"
    SafeTx: [
        { type: "address", name: "to" },
        { type: "uint256", name: "value" },
        { type: "bytes", name: "data" },
        { type: "uint8", name: "operation" },
        { type: "uint256", name: "safeTxGas" },
        { type: "uint256", name: "baseGas" },
        { type: "uint256", name: "gasPrice" },
        { type: "address", name: "gasToken" },
        { type: "address", name: "refundReceiver" },
        { type: "uint256", name: "nonce" },
    ]
}

export const EIP712_SAFE_MESSAGE_TYPE = {
    // "SafeMessage(bytes message)"
    SafeMessage: [
        { type: "bytes", name: "message" },
    ]
}

export interface MetaTransaction {
    to: string,
    value: string | number | BigNumber,
    data: string,
    operation: number,
}

export interface SafeTransaction extends MetaTransaction {
    safeTxGas: string | number,
    baseGas: string | number,
    gasPrice: string | number,
    gasToken: string,
    refundReceiver: string,
    nonce: string | number | BigNumber
}

export interface SafeSignature {
    signer: string,
    data: string
}

export const calculateSafeDomainSeparator = (safe: Address, chainId: BigNumberish): string => {
    return ethers.TypedDataEncoder.hashDomain({ verifyingContract: safe, chainId })
}

export const preimageSafeTransactionHash = (safe: Address, safeTx: SafeTransaction, chainId: BigNumberish): string => {
    return ethers.TypedDataEncoder.encode({ verifyingContract: safe, chainId }, EIP712_SAFE_TX_TYPE, safeTx)
}

export async function preimageSafeTransactionHash2(safe: ISafe, safeTx: SafeTransaction, chainId: BigNumberish): Promise<string>{
    const safeAddr = await safe.getAddress() 
    const txHashData = ethers.TypedDataEncoder.encode({ verifyingContract: safeAddr, chainId }, EIP712_SAFE_TX_TYPE, safeTx)
    return txHashData
}

export const calculateSafeTransactionHash = (safe: ISafe, safeTx: SafeTransaction, chainId: BigNumberish): string => {
    return ethers.TypedDataEncoder.hash({ verifyingContract: safe, chainId }, EIP712_SAFE_TX_TYPE, safeTx)
}
//! Testing 
export async function calculateSafeTransactionHash2(safe: ISafe, safeTx: SafeTransaction, chainId: BigNumberish): Promise<string>{
    const safeAddr = await safe.getAddress()
    const tx = ethers.TypedDataEncoder.hash({ verifyingContract: safeAddr, chainId }, EIP712_SAFE_TX_TYPE, safeTx)
    return tx
}

export const calculateSafeMessageHash = (safe: Address, message: string, chainId: BigNumberish): string => {
    return ethers.TypedDataEncoder.hash({ verifyingContract: safe, chainId }, EIP712_SAFE_MESSAGE_TYPE, { message })
}

export const safeApproveHash = async (signer: Signer, safe: ISafe, safeTx: SafeTransaction, skipOnChainApproval?: boolean): Promise<SafeSignature> => {
    if (!skipOnChainApproval) {
        if (!signer.provider) throw Error("Provider required for on-chain approval")
        const chainId = (await signer.provider.getNetwork()).chainId
        const typedDataHash = ethers.getBytes(calculateSafeTransactionHash(safe, safeTx, chainId))
        const signerSafe = safe.connect(signer)
        await signerSafe.approveHash(typedDataHash)
    }
    const signerAddress = await signer.getAddress()
    return {
        signer: signerAddress,
        data: "0x000000000000000000000000" + signerAddress.slice(2) + "0000000000000000000000000000000000000000000000000000000000000000" + "01"
    }
}
//! testing
export async function safeApproveHash2(signer: Signer, safe: ISafe, safeTx: SafeTransaction, skipOnChainApproval?: boolean): Promise<SafeSignature>{
    if (!skipOnChainApproval) {
        if (!signer.provider) throw Error("Provider required for on-chain approval")
        const chainId = (await signer.provider.getNetwork()).chainId
        const typedDataHash = ethers.getBytes(await calculateSafeTransactionHash2(safe, safeTx, chainId))
        const signerSafe = safe.connect(signer)
        await signerSafe.approveHash(typedDataHash)
    }
    const signerAddress = await signer.getAddress()
    return {
        signer: signerAddress,
        data: "0x000000000000000000000000" + signerAddress.slice(2) + "0000000000000000000000000000000000000000000000000000000000000000" + "01"
    }
}

export const safeSignTypedData = async (signer: Signer & TypedDataSigner, safe: ISafe, safeTx: SafeTransaction, chainId?: BigNumberish): Promise<SafeSignature> => {
    if (!chainId && !signer.provider) throw Error("Provider required to retrieve chainId")
    const cid = chainId || (await signer.provider!!.getNetwork()).chainId
    const signerAddress = await signer.getAddress()
    return {
        signer: signerAddress,
        data: await signer._signTypedData({ verifyingContract: safe.address, chainId: cid }, EIP712_SAFE_TX_TYPE, safeTx)
    }
}

//! testing
export async function safeSignTypedData2(signer: Signer, safe: ISafe, safeTx: SafeTransaction, chainId?: BigNumberish): Promise<SafeSignature>{
    if (!chainId && !signer.provider) throw Error("Provider required to retrieve chainId")
    const cid = chainId || (await signer.provider!!.getNetwork()).chainId
    const signerAddress = await signer.getAddress()
    const safeAddr = await safe.getAddress() 
    return {
        signer: signerAddress,
        data: await signer.signTypedData({ verifyingContract: safeAddr, chainId: cid }, EIP712_SAFE_TX_TYPE, safeTx)
    }
}

export const signHash = async (signer: Signer, hash: string): Promise<SafeSignature> => {
    const typedDataHash = utils.arrayify(hash)
    const signerAddress = await signer.getAddress()
    return {
        signer: signerAddress,
        data: (await signer.signMessage(typedDataHash)).replace(/1b$/, "1f").replace(/1c$/, "20")
    }
}

export const safeSignMessage = async (signer: Signer, safe: Contract, safeTx: SafeTransaction, chainId?: BigNumberish): Promise<SafeSignature> => {
    const cid = chainId || (await signer.provider!!.getNetwork()).chainId
    return signHash(signer, calculateSafeTransactionHash(safe, safeTx, cid))
}

export const buildSignatureBytes = (signatures: SafeSignature[]): string => {
    signatures.sort((left, right) => left.signer.toLowerCase().localeCompare(right.signer.toLowerCase()))
    let signatureBytes = "0x"
    for (const sig of signatures) {
        signatureBytes += sig.data.slice(2)
    }
    return signatureBytes
}
//! testing
export function buildSignatureBytes2(signatures: SafeSignature[]): string{
    signatures.sort((left, right) => left.signer.toLowerCase().localeCompare(right.signer.toLowerCase()))
    let signatureBytes = "0x"
    for (const sig of signatures) {
        signatureBytes += sig.data.slice(2)
    }
    return signatureBytes
}


//!testing
export function checkNSignatures2(dataHash: BytesLike, txHashData: string, signatures: string, requiredSignatures:number, safe: ISafe){
    
    console.log("checkNSignatures")
    console.log(dataHash)
    console.log(txHashData)
    console.log(signatures)
    
    // convert dataHash string to bytes
    const dataHashBytes = ethers.decodeBytes32String(dataHash)

    return safe.checkNSignatures(
        dataHashBytes,
        txHashData,
        signatures,
        requiredSignatures
    )


}



export const logGas = async (message: string, tx: Promise<any>, skip?: boolean): Promise<any> => {
    return tx.then(async (result) => {
        const receipt = await result.wait()
        if (!skip) console.log("           Used", receipt.gasUsed.toNumber(), `gas for >${message}<`)
        return result
    })
}

export const executeTx = async (safe: Contract, safeTx: SafeTransaction, signatures: SafeSignature[], overrides?: any): Promise<any> => {
    const signatureBytes = buildSignatureBytes(signatures)
    return safe.execTransaction(safeTx.to, safeTx.value, safeTx.data, safeTx.operation, safeTx.safeTxGas, safeTx.baseGas, safeTx.gasPrice, safeTx.gasToken, safeTx.refundReceiver, signatureBytes, overrides || {})
}

export const populateExecuteTx = async (safe: Contract, safeTx: SafeTransaction, signatures: SafeSignature[], overrides?: any): Promise<PopulatedTransaction> => {
    const signatureBytes = buildSignatureBytes(signatures)
    return safe.populateTransaction.execSafeTransaction(
        safeTx.to, safeTx.value, safeTx.data, safeTx.operation, safeTx.safeTxGas, safeTx.baseGas, safeTx.gasPrice, safeTx.gasToken, safeTx.refundReceiver,
        signatureBytes,
        overrides || {}
    )
}

export const buildContractCall = (contract: Contract, method: string, params: any[], nonce: number, delegateCall?: boolean, overrides?: Partial<SafeTransaction>): SafeTransaction => {
    const data = contract.interface.encodeFunctionData(method, params)
    return buildSafeTransaction(Object.assign({
        to: contract.address,
        data,
        operation: delegateCall ? 1 : 0,
        nonce
    }, overrides))
}

export const executeTxWithSigners = async (safe: Contract, tx: SafeTransaction, signers: Wallet[], overrides?: any) => {
    const sigs = await Promise.all(signers.map((signer) => safeSignTypedData(signer, safe, tx)))
    return executeTx(safe, tx, sigs, overrides)
}

export const executeContractCallWithSigners = async (safe: Contract, contract: Contract, method: string, params: any[], signers: Wallet[], delegateCall?: boolean, overrides?: Partial<SafeTransaction>) => {
    const tx = buildContractCall(contract, method, params, await safe.nonce(), delegateCall, overrides)
    return executeTxWithSigners(safe, tx, signers)
}

export const buildSafeTransaction = (template: {
    to: string, value?: BigNumber | number | string, data?: string, operation?: number, safeTxGas?: number | string,
    baseGas?: number | string, gasPrice?: number | string, gasToken?: string, refundReceiver?: string, nonce: bigint | number
}): SafeTransaction => {
    return {
        to: template.to,
        value: template.value || 0,
        data: template.data || "0x",
        operation: template.operation || 0,
        safeTxGas: template.safeTxGas || 0,
        baseGas: template.baseGas || 0,
        gasPrice: template.gasPrice || 0,
        gasToken: template.gasToken || AddressZero,
        refundReceiver: template.refundReceiver || AddressZero,
        nonce: template.nonce
    }
}

