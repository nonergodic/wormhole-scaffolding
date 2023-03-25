import { expect, use as chaiUse } from "chai";
import chaiAsPromised from 'chai-as-promised';
chaiUse(chaiAsPromised);
import {
  Connection,
  TransactionInstruction,
  sendAndConfirmTransaction,
  Transaction,
  Signer,
} from "@solana/web3.js";
import * as mock from "@certusone/wormhole-sdk/lib/cjs/mock";
import {
  NodeWallet,
  postVaaSolana,
  signSendAndConfirmTransaction,
} from "@certusone/wormhole-sdk/lib/cjs/solana";
import { WORMHOLE_ADDRESS, GUARDIAN_PRIVATE_KEY } from "./consts";

export function errorExistsInLog(reason: any, errorMessage: string) {
  if (!reason.logs) {
    throw new Error("logs not found");
  }
  const logs = reason.logs as string[];
  for (const log of logs) {
    if (log.includes(errorMessage)) {
      return true;
    }
  }
  return false;
}

export function boilerPlateReduction(connection: Connection, defaultSigner: Signer) {

  // for signing wormhole messages
  const guardians = new mock.MockGuardians(0, [GUARDIAN_PRIVATE_KEY]);
  const defaultNodeWallet = NodeWallet.fromSecretKey(defaultSigner.secretKey);

  const payerToWallet = (payer?: Signer) =>
    !payer || payer === defaultSigner
    ? defaultNodeWallet
    : NodeWallet.fromSecretKey(payer.secretKey);

  const signSendAndConfirmTx = (tx: Transaction, payer?: Signer) => {
    const wallet = payerToWallet(payer);
    return signSendAndConfirmTransaction(
      connection,
      wallet.key(),
      wallet.signTransaction,
      tx,
    );
  }

  const postMessageAsVaaOnSolana = async (message: Buffer, payer?: Signer) => {
    const signedWormholeMessage = guardians.addSignatures(message, [0]);
    const wallet = payerToWallet(payer);
    await postVaaSolana(
      connection,
      wallet.signTransaction,
      WORMHOLE_ADDRESS,
      wallet.key(),
      signedWormholeMessage
    );
    return signedWormholeMessage;
  }

  const sendAndConfirmIx = (ix: TransactionInstruction, signers?: Signer[]) =>
    sendAndConfirmTransaction(
      connection,
      new Transaction().add(ix),
      signers ?? [defaultSigner]
    );
  
  const expectIxToFailWithError = async (
    ix: TransactionInstruction,
    errorMessage: string,
    signers?: Signer[],
  ) => {
    try {
      await sendAndConfirmIx(ix, signers);
      expect.fail("Expected transaction to fail");
    } catch (reason) {
      expect(errorExistsInLog(reason, errorMessage)).is.true;
    }
  }
  return {
    signSendAndConfirmTx,
    postMessageAsVaaOnSolana,
    sendAndConfirmIx,
    expectIxToFailWithError,
  };
}
  
  