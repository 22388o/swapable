/**
 * This file is part of Swapable shared under AGPL-3.0
 * Copyright (C) 2021 Using Blockchain Ltd, Reg No.: 12658136, United Kingdom
 *
 * @package     Swapable
 * @author      Grégory Saive for Using Blockchain Ltd <greg@ubc.digital>
 * @license     AGPL-3.0
 */
import { of } from 'rxjs'
import { catchError } from 'rxjs/operators'
import { TransactionURI } from 'symbol-uri-scheme'
import { MnemonicPassPhrase } from 'symbol-hd-wallets'
import {
  AccountInfo,
  PublicAccount,
  MosaicInfo,
  Transaction,
} from 'symbol-sdk'

// internal dependencies
import { PoolCommands as CommandsImpl } from './commands/index'
import { Executable } from './commands/Executable'
import {
  AllowanceResult,
  AssetAmount,
  AssetIdentifier,
  AssetSource,
  Command,
  CommandOption,
  Context,
  FailureInvalidCommand,
  Market,
  TransactionParameters,
} from '../index'
import {
  Accountable,
  Reader as ReaderImpl,
  Signer as SignerImpl,
} from './adapters/Symbol'

/**
 * @type Swapable.CommandFn
 * @package Swapable
 * @subpackage Standard
 * @since v1.0.0
 * @description Type that describes automated pool command functions.
 */
type CommandFn = (c: Context, i: AssetIdentifier) => Command

/**
 * @type Swapable.CommandsList
 * @package Swapable
 * @subpackage Standard
 * @since v1.0.0
 * @internal
 * @description Type that describes automated pool command lists.
 */
type CommandsList = {
  [id: string]: CommandFn
}

/**
 * @var Swapable.AssetCommands
 * @package Swapable
 * @subpackage Standard
 * @since v1.0.0
 * @description Object that describes a list of available automated pool commands.
 */
export const AssetCommands: CommandsList = {
  'CreatePool': (c, i): Command => new CommandsImpl.CreatePool(c, i),
  'AddLiquidity': (c, i): Command => new CommandsImpl.AddLiquidity(c, i),
  'RemoveLiquidity': (c, i): Command => new CommandsImpl.RemoveLiquidity(c, i),
  'Swap': (c, i): Command => new CommandsImpl.Swap(c, i),
}

/**
 * @var Swapable.PoolTargetDerivationPath
 * @package Swapable
 * @subpackage Standard
 * @since v1.0.0
 * @description Contains text that describes the derivation path for the
 *              target account of automated pools.
 */
export const PoolTargetDerivationPath: string = 'm/4343\'/0\'/0\'/0\''

/**
 * @var Swapable.Revision
 * @package Swapable
 * @subpackage Standard
 * @since v1.0.0
 * @description Object that describes the count of revisions for Swapable digital assets.
 */
export const Revision: number = 1

/**
 * @class Swapable.AssetProtocol<__Adapter>
 * @package standards
 * @since v1.0.0
 * @description Generic class to describe Swapable digital assets.
 *
 * Swapable assets consist in combining two cryptocurrencies in
 * a liquidity pool to define an invariant `k` using a constant
 * product formula of: `x * y = k`  where `x` and `y` represent
 * the cryptocurrencies that are paired in said liquidity pool.
 *
 * A swapable asset may be paired with any other cryptocurrency
 * provided that they reside on the same blockchain network.
 *
 * Liquidity providers add liquidity into pools and Traders can
 * swap currencies. A fee is added to each trade at the rate of
 * 0.30% which are then added to token reserves.  Providers can
 * withdraw their shares of the total reserve at any time.
 *
 * When liquidity is added by a provider, they will be assigned
 * some **Pool Shares**. Those shares can then be burned at any
 * time by providers in order to take back their part of pooled
 * assets.
 */
export class AutomatedPool implements Market {

  /**
   * @description The deterministic public account which owns an
   *              automated liquidity pool. This account is used
   *              to issue the *automated pool shares* mosaic.
   */
  public target: PublicAccount

  /**
   * @description The source blockchain network of assets paired
   *              in an automated liquidity pool.
   */
  public source: AssetSource

  /**
   * @description Mosaic information for the network-wide created
   *              automated pool shares of an automated liquidity
   *              pool.
   */
  public mosaicInfo: MosaicInfo | undefined

  /**
   * @access public
   * @description Account information for the network-wide target
   *              public account. This variable holds balances of
   *              reserves under the `mosaics` field.
   */
  public reserveInfo: AccountInfo | undefined

  /**
   * @description Last automated pool command execution result.
   */
  public result?: TransactionURI<Transaction>

  /**
   * Constructs an automated liquidity pool instance around a
   * name of \a name, a network reader \a reader and a signer
   * implementation of \a signer. Also \a bip39 mnemonic pass
   * phrases are used to derive deterministic child accounts.
   *
   * @access public
   * @param   {string}              name        The name of the automated liquidity pool (e.g.: "XYM:BTC").
   * @param   {TReader}             reader      The blockchain network reader configuration.
   * @param   {SignerImpl}          signer      The digital signature implementation ("key provider").
   * @param   {MnemonicPassPhrase}  bip39       The mnemonic pass phrase ("24-words"). Caution here.
   */
  public constructor(
    /**
     * @readonly
     * @access public
     * @description The name of the automated pool.
     *
     * This name is usually best described using the two paired
     * cryptocurrencies, e.g.: In a pair with Symbol (XYM) and
     * Bitcoin (BTC), the name would be `XYM:BTC`.
     */
    public readonly name: string,

    /**
     * @readonly
     * @access public
     * @description The blockchain network reader configuration.
     *
     * Our first implementation uses a Symbol blockchain network
     * adapter as ReaderImpl and SignerImpl. It is possible that
     * other network adapters are implemented in the future.
     */
    public readonly reader: ReaderImpl,

    /**
     * @readonly
     * @access protected
     * @description The digital signature implementation ("key provider").
     *
     * Our first implementation uses a Symbol blockchain network
     * adapter as ReaderImpl and SignerImpl. It is possible that
     * other network adapters are implemented in the future.
     */
    protected readonly signer: SignerImpl,

    /**
     * @readonly
     * @access protected
     * @description The mnemonic pass phrase ("24-words"). Caution here.
     * 
     * :warning: This information is highly sensitive. In case you
     * you are willing to host/deploy an automated pool, please do
     * take caution when handling the aforementioned mnemonic pass
     * phrase.
     */
    protected readonly bip39: MnemonicPassPhrase,
  ) {
    // - Derive child account in local scope
    const account = Accountable.derive(
      bip39.toSeed(/* XXX password */),
      PoolTargetDerivationPath,
      this.reader.networkType,
      signer,
    )

    // - Only store the public account in instance
    this.target = account.publicAccount

    // - Set asset source network configuration
    this.source = new AssetSource(this.reader.generationHash)
  }

  /**
   * Getter for the deterministic asset identifier related to
   * the automated pool shares mosaic that will be created on
   * the network.  At any time, there is always one automated
   * pool shares mosaic identifier per automated pool.
   *
   * @access public
   * @return {AssetIdentifier}
   */
  public get identifier(): AssetIdentifier {
    // - Creates the deterministic asset identifier
    return AssetIdentifier.createForSource(
      this.name,
      this.target,
      this.source,
    )
  }

  /**
   * Synchronize the command execution with the network. This
   * method shall be used to fetch data required for / before
   * the execution of an automated pool command.
   *
   * @async
   * @override {Market.synchronize()}
   * @access public
   * @return {Promise<boolean>}
   */
  public async synchronize(): Promise<boolean> {
    // - Prepares synchronization (context and endpoints)
    const context = this.getContext(this.target, new TransactionParameters())
    const mosaicHttp = (context.reader as ReaderImpl).factoryHttp.createMosaicRepository()
    const accountHttp = (context.reader as ReaderImpl).factoryHttp.createAccountRepository()

    try {
      // - Reads the information about the automated pool shares mosaic of this automated pool
      this.mosaicInfo = await mosaicHttp.getMosaic(this.identifier.toMosaicId()).pipe(
        catchError(e => { console.error(e); return of(undefined) })
      ).toPromise()
    }
    catch (e) {}

    try {
      // - Reads the information about the available reserves of this automated pool
      this.reserveInfo = await accountHttp.getAccountInfo(this.target.address).pipe(
        catchError(e => { console.error(e); return of(undefined) })
      ).toPromise()
    }
    catch (e) {}

    // - Done synchronizing network information
    return true
  }

  /**
   * Creates a new Automated Liquidity Pool given \a provider
   * a funded public account, \a x left-side input amount and
   * \a y right-side input amount. The transaction parameters
   * argument is optional and should be used to override data
   * about network configuration.
   *
   * This method returns the asset identifier that represents
   * the automated pool shares, all automated liquidity pools
   * will be assigned **one** such asset identifier.
   *
   * @access public
   * @param   {PublicAccount}           provider    The public account of the liquidity provider.
   * @param   {AssetAmount}             x           The cryptocurrency amount for `x` in the constant product formula.
   * @param   {AssetAmount}             y           The cryptocurrency amount for `y` in the constant product formula.
   * @param   {TransactionParameters}   parameters  (Optional) The additional transaction parameters (network specific).
   * @return  {AssetIdentifier}         The automated pool shares asset identifier.
   **/
  public create(
    provider: PublicAccount,
    x: AssetAmount,
    y: AssetAmount,
    parameters: TransactionParameters = new TransactionParameters(),
  ): AssetIdentifier {
    // - Generates a deterministic LP Shares asset identifier
    const sharesAssetId = this.identifier

    // - Execute digital automated pool command `CreatePool` (synchronize() not needed)
    this.result = this.executeOffline(this.target, sharesAssetId, 'CreatePool', parameters, [
      new CommandOption('provider', provider),
      new CommandOption('input_x', x),
      new CommandOption('input_y', y),
    ])

    // - Returns the LP Shares asset identifier
    return sharesAssetId
  }

  /**
   * Verifies the autorization for \a actor to execute a pool
   * command \a command given \a sharesAssetId automated pool
   * shares asset identifier.
   *
   * @access public
   * @param   {PublicAccount}         actor           The actor is whom executes the command.
   * @param   {AssetIdentifier}       sharesAssetId   The automated pool shares asset identifier.
   * @param   {string}                command         The automated pool command.
   * @param   {Array<CommandOption>}  argv            The command options (arguments).
   * @return  {AllowanceResult}       Returns whether an actor is authorized to execute said command.
   **/
  public canExecute(
    actor: PublicAccount,
    sharesAssetId: AssetIdentifier,
    command: string,
    argv: CommandOption[]
  ): AllowanceResult {
    // - Instanciates the command and context
    const params = new TransactionParameters()
    const context = this.getContext(actor, params, argv)
    const cmdFn = this.getCommand(sharesAssetId, command, context) as Executable

    // - Populate the synchronized data
    cmdFn.mosaicInfo = this.mosaicInfo
    cmdFn.reserveInfo = this.reserveInfo

    // - Uses `canExecute` from underlying \a command
    return cmdFn.canExecute(actor, argv)
  }

  /**
   * Executes \a command given \a sharesAssetId automated pool
   * shares asset identifier, \a actor public account, \a argv
   * command execution options and \a parameters to broadcast.
   *
   * @access public
   * @param   {PublicAccount}             actor           The actor is whom executes the command.
   * @param   {AssetIdentifier}           sharesAssetId   The automated pool shares asset identifier.
   * @param   {string}                    command         The automated pool command descriptor (e.g. "CreatePool").
   * @param   {TransactionParameters}     parameters      The transaction parameters (network specific).
   * @param   {Array<CommandOption>}      argv            The command execution options (arguments).
   * @return  {Promise<TransactionURI>}   A digital contract that must be signed by the actor and possibly by the target account.
   **/
  public async execute(
    actor: PublicAccount,
    sharesAssetId: AssetIdentifier,
    command: string,
    parameters: TransactionParameters,
    argv: CommandOption[],
  ): Promise<TransactionURI<Transaction>> {
    // - Reads network information from blockchain "reader"
    await this.synchronize()

    try {
      // - Instanciates a command in a context
      const context = this.getContext(actor, parameters, argv)
      const cmdFn = this.getCommand(sharesAssetId, command, context) as Executable

      // - Populates the synchronized data
      cmdFn.mosaicInfo = this.mosaicInfo
      cmdFn.reserveInfo = this.reserveInfo

      // - Executes the automated pool command
      return cmdFn.execute(actor, argv)
    }
    catch (f) {
      // XXX error notifications / events
      throw f
    }
  }

  /**
   * Executes \a command given \a sharesAssetId automated pool
   * shares asset identifier, \a actor public account, \a argv
   * command execution options and \a parameters to broadcast.
   *
   * This method does **not** call the `synchronize()` method.
   *
   * @access public
   * @param   {PublicAccount}             actor           The actor is whom executes the command.
   * @param   {AssetIdentifier}           sharesAssetId   The automated pool shares asset identifier.
   * @param   {string}                    command         The automated pool command descriptor (e.g. "CreatePool").
   * @param   {TransactionParameters}     parameters      The transaction parameters (network specific).
   * @param   {Array<CommandOption>}      argv            The command execution options (arguments).
   * @return  {Promise<TransactionURI>}   A digital contract that must be signed by the actor and possibly by the target account.
   **/
  public executeOffline(
    actor: PublicAccount,
    sharesAssetId: AssetIdentifier,
    command: string,
    parameters: TransactionParameters,
    argv: CommandOption[],
  ): TransactionURI<Transaction> {
    // does-not-call-synchronize()

    try {
      // - Instanciates a command in a context
      const context = this.getContext(actor, parameters, argv)
      const cmdFn = this.getCommand(sharesAssetId, command, context) as Executable

      // - Populates the synchronized data
      cmdFn.mosaicInfo = this.mosaicInfo
      cmdFn.reserveInfo = this.reserveInfo

      // - Executes the automated pool command
      return cmdFn.execute(actor, argv)
    }
    catch (f) {
      // XXX error notifications / events
      throw f
    }
  }

  /// region protected methods
  /**
   * Returns an execution context around an \a actor, \a argv
   * command options and \a parameters transaction parameters.
   *
   * @access protected
   * @param   {PublicAccount}           actor       The actor in said execution context.
   * @param   {TransactionParameters}   parameters  The transaction parameters.
   * @param   {CommandOption[]}         argv        The execution options.
   * @return  {Context}                 The pre-configured *execution context*.
   */
  protected getContext(
    actor: PublicAccount,
    parameters: TransactionParameters,
    argv?: CommandOption[],
  ): Context {
    return new Context(
      Revision,
      actor,
      this.reader,
      this.signer,
      parameters,
      argv
    )
  }

  /**
   * Returns a command instance for \a command given \a context
   * and \a sharesAssetId.
   *
   * @see {Swapable.AssetCommands}
   * @access protected
   * @param   {AssetIdentifier} sharesAssetId     The automated pool shares asset identifier.
   * @param   {string}         command            The automated pool command name (which command).
   * @param   {Context}        context            The command execution context (arguments).
   * @return  {Command}        The command instance pre-configured with the execution context.
   * @throws  {FailureInvalidCommand}   On invalid automated pool command.
   */
  protected getCommand(
    sharesAssetId: AssetIdentifier,
    command: string,
    context: Context,
  ): Command {
    // validate digital automated pool command
    if (!AssetCommands || !AssetCommands[command]) {
      throw new FailureInvalidCommand('Invalid automated pool command.')
    }

    return AssetCommands[command](context, sharesAssetId)
  }
  /// end-region protected methods
}

/**
 * @class Swapable.DigitalMarket
 * @package standards
 * @since v1.0.0
 * @description Class that describes markets for swapable digital assets.
 */
export class DigitalMarket extends AutomatedPool {}
