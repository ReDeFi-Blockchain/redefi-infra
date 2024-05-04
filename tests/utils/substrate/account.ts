import { ApiPromise } from "@polkadot/api";
import { IKeyringPair } from "@polkadot/types/types";
import { evmToAddress, addressToEvm } from "@polkadot/util-crypto";
import { SubBase } from "./base";
import { SubUtils } from "./utils";
import { SignerOptions } from "@polkadot/api/types";

export class SubAccount extends SubBase {
  private utils: SubUtils;

  constructor(api: ApiPromise, utils: SubUtils) {
    super(api);
    this.utils = utils;
  }

  async getBalance(address: string) {
    if (address.startsWith("0x")) address = evmToAddress(address);
    const balance = await this.api.query.system.account(address);
    const { data } = balance.toJSON() as { data: { free: string } };

    return BigInt(data.free);
  }

  async transferAsset(
    params: { to: string; value: bigint; erc20: `0x${string}` },
    signer: IKeyringPair,
    options?: Partial<SignerOptions>,
  ) {
    return this.utils.signAndSend(
      signer,
      this.makeTransferAssetTx({ ...params, from: signer.address }),
      options,
    );
  }

  async transferNative(
    params: { to: string; value: bigint },
    signer: IKeyringPair,
    options?: Partial<SignerOptions>,
  ) {
    return this.utils.signAndSend(
      signer,
      this.makeTransferNativeTx(params),
      options,
    );
  }

  async batchTransferAsset(
    params: { to: string; value: bigint; erc20: `0x${string}` }[],
    signer: IKeyringPair,
  ) {
    const txs = [];
    for (const p of params)
      txs.push(this.makeTransferAssetTx({ ...p, from: signer.address }));

    await this.utils.batch(signer, txs);
  }

  async batchTransferNative(
    params: { to: string; value: bigint }[],
    signer: IKeyringPair,
  ) {
    const txs = [];
    for (const p of params) txs.push(this.makeTransferNativeTx(p));

    await this.utils.batch(signer, txs);
  }

  async getNonce(address: string): Promise<number> {
    const account = await this.api.query.system.account(address);
    const { nonce } = account.toJSON() as { nonce: number };
    return nonce;
  }

  private makeTransferNativeTx(params: { to: string; value: bigint }) {
    if (params.to.startsWith("0x")) params.to = evmToAddress(params.to);
    return this.api.tx.balances.transferKeepAlive(params.to, params.value);
  }

  private makeTransferAssetTx(params: {
    erc20: `0x${string}`;
    from: string;
    to: string;
    value: bigint;
  }) {
    const transferSignature = "0xa9059cbb"; // Signature for "transfer(address,uint256)"
    const encodedTo = params.to.substring(2).padStart(64, "0"); // hex recipient padded with zeros
    const encodedAmount = params.value.toString(16).padStart(64, "0"); // hex amount padded with zeros
    const payload = transferSignature + encodedTo + encodedAmount;

    return this.api.tx.evm.call(
      addressToEvm(params.from),
      params.erc20,
      payload,
      0,
      1000000n,
      1000000000000000,
      null,
      null,
      null,
    );
  }
}
