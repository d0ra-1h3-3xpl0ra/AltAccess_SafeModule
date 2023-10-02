import {
  loadFixture,
  mine,
  reset,
} from '@nomicfoundation/hardhat-network-helpers'
import { expect } from 'chai'

import execAllowanceTransfer from './test-helpers/execAllowanceTransfer'
import execSafeTransaction from './test-helpers/execSafeTransaction'
import setup from './test-helpers/setup'

describe('AllowanceModule allowanceExpiration', () => {
  function nowInMinutes() {
    return Math.floor(Date.now() / (1000 * 60))
  }

  function calculateResetLast(
    base: number,
    period: number,
    now: number = nowInMinutes()
  ) {
    return now - ((now - base) % period)
  }

  it('Execute allowance before and after expiration', async () => {
    const { safe, allowanceModule, token, owner, alice, bob, joe } =
      await loadFixture(setup)
    const safeAddress = await safe.getAddress()
    const tokenAddress = await token.getAddress()

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
    // add alice as delegate
    await execSafeTransaction(
      safe,
      await allowanceModule.addDelegate.populateTransaction(alice.address),
      owner
    )
    // create an allowance for alice
    const configResetPeriod = 60 * 24
    const configResetBase = nowInMinutes() - 30
    // the very first resetLast produced by the contract
    // i.e., before the first period is elapsed, and
    // the contract updates/resets allowance
    const firstResetLast = calculateResetLast(
      configResetBase,
      configResetPeriod
    )
    const secondResetLast = calculateResetLast(
      configResetBase,
      configResetPeriod
    )

    await execSafeTransaction(
      safe,
      await allowanceModule.setAllowance.populateTransaction(
        alice.address,
        tokenAddress,
        200,
        configResetPeriod,
        configResetBase
      ),
      owner
    )
    // load an existing allowance
    let [amount, spent, resetPeriod, resetLast, nonce] =
      await allowanceModule.getTokenAllowance(
        safeAddress,
        alice.address,
        tokenAddress
      )
    expect(200).to.equal(amount)
    expect(0).to.equal(spent)
    expect(configResetPeriod).to.equal(resetPeriod)
    expect(firstResetLast).to.equal(resetLast) // this should be set to inti time
    expect(1).to.equal(nonce)
    expect(1000).to.equal(await token.balanceOf(safeAddress))
    expect(0).to.equal(await token.balanceOf(bob.address))
    // transfer 60 bucks to bob
    await execAllowanceTransfer(allowanceModule, {
      safe: await safe.getAddress(),
      token: tokenAddress,
      to: bob.address,
      amount: 160,
      spender: alice,
    })

    expect(840).to.equal(await token.balanceOf(safeAddress))
    expect(160).to.equal(await token.balanceOf(bob.address))

    // load alice's allowance
    ;[amount, spent, resetPeriod, resetLast, nonce] =
      await allowanceModule.getTokenAllowance(
        safeAddress,
        alice.address,
        tokenAddress
      )
    expect(200).to.equal(amount)
    expect(160).to.equal(spent)
    expect(configResetPeriod).to.equal(resetPeriod)
    expect(firstResetLast).to.equal(resetLast)
    expect(2).to.equal(nonce)
    // jumo forward 48h and check if allowance is still valid
    await mine(49, { interval: 60 * 60 })

    // try to transfer 10 bucks to bob again, but should fail since allowance is expired
    await expect(
      execAllowanceTransfer(allowanceModule, {
        safe: await safe.getAddress(),
        token: tokenAddress,
        to: bob.address,
        amount: 10,
        spender: alice,
      })
    ).to.be.revertedWith(
      'newSpent > allowance.spent && newSpent <= allowance.amount, allowance expired or all has been spent'
    )

    await execSafeTransaction(
      safe,
      await allowanceModule.deleteAllowance(
				alice.address, 
				tokenAddress),
      owner
    )
		// load alice's allowance state
    ;[amount, spent, resetPeriod, resetLast, nonce] =
      await allowanceModule.getTokenAllowance(
        safeAddress,
        alice.address,
        tokenAddress
      )
		expect(0).to.equal(amount)
		expect(0).to.equal(spent)
		expect(0).to.equal(resetPeriod)
		expect(0).to.equal(resetLast)
		expect(2).to.equal(nonce)

    // add new allowance for alice
    await execSafeTransaction(
      safe,
      await allowanceModule.setAllowance.populateTransaction(
        alice.address,
        tokenAddress,
        500,
        configResetPeriod,
        configResetBase
      ),
      owner
    )

    // load alice's second allowance
    ;[amount, spent, resetPeriod, resetLast, nonce] =
      await allowanceModule.getTokenAllowance(
        safeAddress,
        alice.address,
        tokenAddress
      )
    console.log(
      'amount',
      amount,
      'spent',
      spent,
      'resetPeriod',
      resetPeriod,
      'resetLast',
      resetLast,
      'nonce',
      nonce
    )
    expect(500).to.equal(amount)
    expect(0).to.equal(spent)
    expect(configResetPeriod).to.equal(resetPeriod)
    expect(2).to.equal(nonce)
    expect(840).to.equal(await token.balanceOf(safeAddress))
    expect(160).to.equal(await token.balanceOf(bob.address))

    // transfer 400 bucks to joe
    await execAllowanceTransfer(allowanceModule, {
      safe: await safe.getAddress(),
      token: tokenAddress,
      to: joe.address,
      amount: 400,
      spender: alice,
    })

    // load alice's second allowance
    ;[amount, spent, resetPeriod, resetLast, nonce] =
      await allowanceModule.getTokenAllowance(
        safeAddress,
        alice.address,
        tokenAddress
      )
    expect(500).to.equal(amount)
    expect(400).to.equal(spent)
    expect(configResetPeriod).to.equal(resetPeriod)
    expect(3).to.equal(nonce)
    expect(440).to.equal(await token.balanceOf(safeAddress))
    expect(400).to.equal(await token.balanceOf(joe.address))

		// jump forward 48h and check if allowance is still valid
		await mine(49, { interval: 60 * 60 })
		await expect(
      execAllowanceTransfer(allowanceModule, {
        safe: await safe.getAddress(),
        token: tokenAddress,
        to: bob.address,
        amount: 10,
        spender: alice,
      })
    ).to.be.revertedWith(
      'newSpent > allowance.spent && newSpent <= allowance.amount, allowance expired or all has been spent'
    )

  })
})
