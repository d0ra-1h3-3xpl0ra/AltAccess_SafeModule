import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers'
import hre from 'hardhat'

import {
  AllowanceModule__factory,
  ISafe__factory,
  TestToken,
  TestToken__factory,
} from '../../typechain-types'

import deploySafeProxy from './deploySafeProxy'
import deploySingletons from './deploySingletons'
import execTransaction from './execSafeTransaction'

export default async function setup() {
  const [owner, alice, bob, joe, zeta, deployer, relayer] = await hre.ethers.getSigners()

  const {
    safeProxyFactoryAddress,
    safeMastercopyAddress,
    allowanceModuleAddress,
  } = await deploySingletons(deployer)
  
  const safeAddress = await deploySafeProxy(
    safeProxyFactoryAddress,
    safeMastercopyAddress,
    owner.address,
    deployer
  )
  
  const token = await deployTestToken(deployer)
  // both the safe and the allowance work by signature
  // connect the contracts to a signer that has funds
  // but isn't safe owner, or allowance spender
  const safe = ISafe__factory.connect(safeAddress, relayer)
  const allowanceModule = AllowanceModule__factory.connect(
    allowanceModuleAddress,
    relayer
  )
  const amountTestToken = 1000


  // fund the safe
  await token.transfer(safeAddress, amountTestToken)

  // enable Allowance as mod
  await execTransaction(
    safe,
    await safe.enableModule.populateTransaction(allowanceModuleAddress),
    owner
  )



    const safeADDR = await safe.getAddress()
    const tokenAddress = await token.getAddress()
    const allowanceAddress = await allowanceModule.getAddress()

    const aliceAddress = await alice.getAddress()
    const bobAddress = await bob.getAddress()
    const joeAddress = await joe.getAddress()
    const zetaAddress = await zeta.getAddress()
    const ownerAddress = await owner.getAddress()
    //tracer nameTags
    
    hre.tracer.nameTags[tokenAddress] = "UNICORN_TOKEN_ADDRESS"
    hre.tracer.nameTags[allowanceAddress] = "ALLOWANCE_MODULE_ADDRESS"
    hre.tracer.nameTags[aliceAddress] = "ALICE_ADDRESS"
    hre.tracer.nameTags[bobAddress] = "BOB_ADDRESS"
    hre.tracer.nameTags[joeAddress] = "JOE_ADDRESS"
    hre.tracer.nameTags[zetaAddress] = "ZETA_ADDRESS"
    hre.tracer.nameTags[ownerAddress] = "OWNER_ADDRESS"
    const safeSetup = [
      [await deployer.getAddress(),"deployer"],
      [await owner.getAddress(),"owner"],
      [await safe.isOwner(owner.getAddress()),"owner is Safe Owner"],

      [await safe.getThreshold(),"Safe_Threshold"],
      [await safe.nonce(),"current Nonce"],
    ]
    console.table(safeSetup)
    console.log("#######################################")
    console.log("############SETUP COMPLETED############")
    console.log("#######################################")
  return {
    // the deployed safe
    safe,
    // singletons
    allowanceModule,
    // test token
    token,
    // some signers
    owner,
    alice,
    bob,
    joe,
    zeta,
  }
}

async function deployTestToken(minter: SignerWithAddress): Promise<TestToken> {
  const factory: TestToken__factory = await hre.ethers.getContractFactory(
    'TestToken',
    minter
  )
  return await factory.connect(minter).deploy()
}
