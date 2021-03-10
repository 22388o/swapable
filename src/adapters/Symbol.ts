/**
 * This file is part of Swapable shared under AGPL-3.0
 * Copyright (C) 2021 Using Blockchain Ltd, Reg No.: 12658136, United Kingdom
 *
 * @package     Swapable
 * @author      Grégory Saive for Using Blockchain Ltd <greg@ubc.digital>
 * @license     AGPL-3.0
 */

import {
  Account,
  RepositoryFactoryHttp,
  RepositoryFactoryConfig,
  NetworkType,
  MosaicId,
} from 'symbol-sdk'
import { ExtendedKey, Network, Wallet } from 'symbol-hd-wallets'

// internal dependencies
import { KeyProvider } from '../contracts/KeyProvider'
import { Reader as BaseReader } from '../contracts/Reader'

/**
 * @class Reader implements BaseReader
 * @package Swapable
 * @subpackage Adapters
 * @since v1.0.0
 * @description Class that describes the blockchain network adapter
 *              for Symbol from NEM compatible network nodes.
 * @link https://symbolplatform.com
 */
export class Reader implements BaseReader {

  /**
   * @description Repository factory (symbol-sdk)
   */
  public factoryHttp: RepositoryFactoryHttp

  /**
   * Construct a network configuration object
   *
   * @param {string}      gatewayUrl
   * @param {NetworkType} networkType
   * @param {string}      generationHash
   * @param {number}      epochAdjustment
   * @param {MosaicId}    feeMosaicId
   */
  public constructor(
    /**
     * @description The REST endpoint URL
     */
    public gatewayUrl: string,

    /**
     * @description The network type
     */
    public networkType: NetworkType,

    /**
     * @description The network generation hash
     */
    public generationHash: string,

    /**
     * @description The network epoch adjustment
     */
    public epochAdjustment: number,

    /**
     * @description The network fee mosaic id
     */
    public feeMosaicId: MosaicId,

    /**
     * @description (Optional) The node public key
     */
    public nodePublicKey?: string
  ) {
    this.factoryHttp = new RepositoryFactoryHttp(gatewayUrl, {
      networkType,
      generationHash,
      epochAdjustment,
      nodePublicKey,
    } as RepositoryFactoryConfig)
  }
};

/**
 * @class Signer
 * @package Swapable
 * @subpackage Adapters
 * @since v1.0.0
 * @description Class that describes the blockchain adapter for
 *              Symbol from NEM  compatible digital signatures.
 * @link https://symbolplatform.com
 */
export class Signer implements KeyProvider {

  public keyChain: Network = Network.CATAPULT

  /// region implements Adapter
  /**
   * Creates a key provider for the current blockchain network.
   *
   * @see symbol-hd-wallets
   * @param   {Buffer}    seed    The password encrypted mnemonic seed (bip39).
   * @return  {Wallet}    Returns a key provider.
   */
  public getKeyProvider(
    seed: Buffer,
  ): Wallet {
    // - Create a wallet based on a "extended private key"
    return new Wallet(ExtendedKey.createFromSeed(
      seed.toString('hex'),
      this.keyChain,
    ))
  }

  /**
   * Unlock a key tree for signing. This method returns
   * a private key.
   *
   * :warning: It is important to never reveal the data
   *           returned by this method, to anyone.
   *
   * @param {string}    derivationPath
   * @return {Buffer}
   */
  public getPrivateKey(
    seed: Buffer,
    derivationPath: string,
  ): Buffer {
    // - Derive a child account based on a mnemonic seed
    const privateKey = this.getKeyProvider(seed).getChildAccountPrivateKey(
      derivationPath,
    )

    // - Return binary representation
    return Buffer.from(privateKey, 'hex')
  }
  /// end-region implements Adapter
};

export class Accountable {
  /**
   * 
   *
   * @param {string}    derivationPath
   * @return {Buffer}
   */
  public static derive(
    seed: Buffer,
    derivationPath: string,
    networkType: NetworkType = NetworkType.TEST_NET,
    provider: Signer = new Signer(),
  ): Account {
    const pkey = provider.getPrivateKey(
      seed,
      derivationPath,
    ).toString('hex')
    return Account.createFromPrivateKey(pkey, networkType)
  }
}
