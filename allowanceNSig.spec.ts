// hre.tracer.nameTags[safeAddress] = "XXXXXXXXXXXXXYGZGJADGJASAAJGGJJSDGGGLSALSAALJJJJJJJJGGG";

import { loadFixture } from '@nomicfoundation/hardhat-network-helpers'
import { expect } from 'chai'
import { parseUnits, ZeroAddress } from 'ethers'
import hre, { ethers } from 'hardhat'
import "@nomicfoundation/hardhat-ethers";

import { buildSafeTransaction, calculateSafeTransactionHash, preimageSafeTransactionHash } from './execution'
import execAllowanceTransfer from '../test/test-helpers/execAllowanceTransfer'
import execSafeTransaction from '../test/test-helpers/execSafeTransaction'
import setup from '../test/test-helpers/setup'
import exp from 'constants'

import { calculateSafeTransactionHash2, preimageSafeTransactionHash2, buildSignatureBytes2, safeApproveHash2, safeSignTypedData2, checkNSignatures2} from './execution';

//##################################
//##################################
// THIS TEST IS NOT WORKING AND WIP
//##################################
//##################################
const OneEther = parseUnits('1', 'ether')

describe('AllowanceModule multiSig', () => {
  it('Add new Owner and update threshold', async () => {
    const { safe, allowanceModule, token, owner, alice, bob, joe, zeta } =
      await loadFixture(setup)

    const safeAddress = await safe.getAddress()
    const tokenAddress = await token.getAddress()
    const allowanceAddress = await allowanceModule.getAddress()

    // set target safe and token
    await execSafeTransaction(
      safe,
      await allowanceModule.setTargetSafe.populateTransaction(safeAddress),
      owner
    )
    await execSafeTransaction(
      safe,
      await allowanceModule.setTargetToken.populateTransaction(tokenAddress),
      owner
    )
    expect(await safe.isModuleEnabled(allowanceAddress)).to.equal(true)
    expect(await allowanceModule.getTargetSafe()).to.equal(safeAddress)
    expect(await allowanceModule.getTargetToken()).to.equal(tokenAddress)

    expect(0).to.equal(await token.balanceOf(alice.address))

    // add alice as delegate
    await execSafeTransaction(
      safe,
      await allowanceModule.addDelegate.populateTransaction(alice.address),
      owner
    )

    // create an allowance for alice
    await execSafeTransaction(
      safe,
      await allowanceModule.setAllowance.populateTransaction(
        alice.address,
        tokenAddress,
        100,
        0,
        0
      ),
      owner
    )

    // ensure delegates are well configured
    const { results } = await allowanceModule.getDelegates(safeAddress, 0, 10)
    expect(results).to.deep.equal([alice.address])

    // get more data about the Safe

    console.log(await safe.getThreshold())
    // Check current Safe Setup
    expect( await safe.isOwner(owner)).to.equal(true)
    expect( await safe.isOwner(joe)).to.equal(false)
    expect(await safe.getThreshold()).to.equal(1)
    // Add Joe as new owner but keep threshold to 1
    await execSafeTransaction(
      safe,
      await safe.addOwnerWithThreshold.populateTransaction(
        joe,
        1
      ),
      owner
    )
    // Add Zeta as new owner and update threshold to 3
    
    await execSafeTransaction(
      safe,
      await safe.addOwnerWithThreshold.populateTransaction(
        zeta,
        1
      ),
      owner
    )
    // Check new Safe Setup
    

    expect(await safe.isOwner(joe)).to.equal(true)
    expect(await safe.isOwner(zeta)).to.equal(true)
    expect(await safe.getThreshold()).to.equal(1)
    console.log("check for if signature is correct")
    

    //buildSafetransaction
    const tx = buildSafeTransaction({ to: zeta.address, nonce: await safe.nonce() })
    console.log("log building safetransaction")
    console.log(typeof tx) 


    // get txhashData
    
    const txHashData = await preimageSafeTransactionHash2(safe, tx, await safe.getChainId())
    console.log(txHashData)
    
    // calculateSafeTansactionhash
    const txHash = await calculateSafeTransactionHash2(safe, tx, await safe.getChainId())
    
    // buildSignatureBytes
    //! Testing
    console.log("testing")
    const signatures = buildSignatureBytes2([
      
      await safeSignTypedData2(zeta, safe, tx),
      await safeSignTypedData2(alice, safe, tx),
      await safeSignTypedData2(joe, safe, tx)
    ])

    let thresh = await safe.getThreshold()
    console.log(thresh)
    // await safe.checkNSignatures(
      await safe.checkNSignatures(
        txHash,
        txHashData,
        signatures,
        1,
      );
    console.log("kinda worked")
    expect(
      await execSafeTransaction(
        safe,
        await allowanceModule.setAllowance.populateTransaction(
          bob.address,
          tokenAddress,
          10,
          0,
          0
        ),
        owner
      )).to.be.revertedWith(
        'GS020'
      )
    let [amount, spent, minReset, lastReset, nonce] =
      await allowanceModule.getTokenAllowance(
        safeAddress,
        bob.address,
        tokenAddress
      )
    expect(10).to.equal(amount)
    expect(0).to.equal(spent)
    expect(0).to.equal(minReset)
    expect(0).to.not.equal(lastReset) // this should be set to init time
    expect(1).to.equal(nonce)
    

  })
})
