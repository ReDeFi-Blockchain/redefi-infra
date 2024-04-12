import { evmToAddress } from "@polkadot/util-crypto";
import { BigNumber, ethers } from "ethers";
import { readFileSync } from "fs";
import { beforeAll, describe, expect, test } from "vitest";
import * as abigen from "./ABIGEN";
import { loadFixture } from "./fixtures";

describe.skip("Redefi EVM Tests", () => {
  let contract: ethers.Contract;
  let typizedErc20Contract: abigen.ERC20Contract;
  let wallet: ethers.Wallet;
  let ethReceiver: ethers.Wallet;
  let provider: ethers.providers.WebSocketProvider;
  let factory: ethers.ContractFactory;
  const erc20Binary = readFileSync("sol/ETH20/bin/ERC20Contract.bin");
  const erc20Abi = readFileSync("sol/ABI/ERC20Contract.abi");
  const oneToken = 10n ** 18n;
  const halfToken = oneToken / 2n;

  beforeAll(async () => {
    const { sub } = await loadFixture();
    wallet = ethers.Wallet.createRandom().connect(provider);
    ethReceiver = ethers.Wallet.createRandom().connect(provider);

    factory = new ethers.ContractFactory(
      erc20Abi.toString(),
      "0x" + erc20Binary.toString(),
      wallet,
    );

    await sub.balance.transfer(
      {
        to: evmToAddress(wallet.address),
        amount: BigNumber.from(3000).mul(oneToken),
      },
      sub.keyrings.alice,
    );
  });

  // afterAll(async () => {
  //   await polka.disconnect();
  //   await provider.destroy();
  // });

  describe("ERC20", () => {
    test("Should deploy contract", async () => {
      contract = (await factory.deploy(wallet.address)) as abigen.ERC20Contract;
      await contract.deployTransaction.wait();
      const code = await provider.getCode(contract.address);
      typizedErc20Contract = contract as abigen.ERC20Contract;
      expect(code, "the contract code is emtpy").to.be.not.null;
    });

    test("Calls & events", async () => {
      expect(await typizedErc20Contract.decimals()).to.be.equal(18);
      const mintTx = await typizedErc20Contract.mint(wallet.address, oneToken);
      await mintTx.wait();
      expect(
        (await typizedErc20Contract.balanceOf(wallet.address)).toBigInt(),
      ).to.be.equal(oneToken);

      const mintToWalletEventFilter = typizedErc20Contract.filters.Transfer(
        null,
        wallet.address,
      );
      const events = await typizedErc20Contract.queryFilter(
        mintToWalletEventFilter,
      );
      expect(events.length).to.not.equal(0);

      const transferTx = await typizedErc20Contract.transfer(
        ethReceiver.address,
        halfToken,
        { from: wallet.address },
      );

      const transferReceipt = await transferTx.wait();
      expect(transferReceipt.confirmations).to.be.not.equal(0);

      const walletBalanceAfterTransfer = (
        await typizedErc20Contract.balanceOf(wallet.address)
      ).toBigInt();
      expect(walletBalanceAfterTransfer).to.be.equal(halfToken);
      const receiverBalanceAfterTransfer = (
        await typizedErc20Contract.balanceOf(ethReceiver.address)
      ).toBigInt();
      expect(receiverBalanceAfterTransfer).to.be.equal(halfToken);
    });
  });
});
