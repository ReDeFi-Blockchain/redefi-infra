import {
  ContractTransactionResponse,
  HDNodeWallet,
  JsonRpcProvider,
  ethers,
} from "ethers";
import { ERC20, ERC20__factory } from "../../typechain-types";
import { NETWORK_CONSTANTS } from "../constants";
import { getFilenameWallet } from "../filename-wallet";
import { AccountAssetType, NetworkConstants } from "../types";
import { EthAccount } from "./accounts";

export default class EtherHelper {
  // NOTE: Use JsonRpcProvider instead of WebSocketProvider.
  // Ethers contains a bug where the nonce may not increment on time on fast nodes.
  readonly provider: JsonRpcProvider;
  readonly accounts: EthAccount;
  readonly assets: Record<AccountAssetType, ERC20>;
  readonly donor: HDNodeWallet;
  readonly CONSTANTS: NetworkConstants;

  private constructor(
    filenameOrWallet: HDNodeWallet | string,
    provider: JsonRpcProvider,
    constants: NetworkConstants,
  ) {
    this.provider = provider;
    this.CONSTANTS = constants;
    this.assets = {
      NATIVE: ERC20__factory.connect(constants.NATIVE.ADDRESS, this.provider),
      SIBLING: ERC20__factory.connect(constants.SIBLING.ADDRESS, this.provider),
      GBP: ERC20__factory.connect(constants.GBP.ADDRESS, this.provider),
    };

    if (typeof filenameOrWallet === "string") {
      this.donor = getFilenameWallet(filenameOrWallet).connect(this.provider);
    } else {
      this.donor = filenameOrWallet.connect(this.provider);
    }

    this.accounts = new EthAccount(this.provider, this.assets, this.donor);
  }

  static async init(
    filenameOrWallet: HDNodeWallet | string,
    rpcEndpoint: string,
  ) {
    const provider = new ethers.JsonRpcProvider(rpcEndpoint);
    const { chainId } = await provider.getNetwork();

    let constants: NetworkConstants;

    if (chainId === NETWORK_CONSTANTS.L1.CHAIN_ID)
      constants = NETWORK_CONSTANTS.L1;
    else if (chainId === NETWORK_CONSTANTS.L2.CHAIN_ID)
      constants = NETWORK_CONSTANTS.L2;
    else throw Error("Unknown Chain Id");

    return new EtherHelper(filenameOrWallet, provider, constants);
  }

  async waitForResult(tx: Promise<ContractTransactionResponse>) {
    const transaction = await tx;
    const receipt = await transaction.wait();
    if (!receipt) throw Error("Cannot get receipt");

    return { receipt, fee: receipt.fee };
  }
}