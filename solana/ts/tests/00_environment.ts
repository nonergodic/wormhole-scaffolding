import { expect, use as chaiUse } from "chai";
import chaiAsPromised from 'chai-as-promised';
chaiUse(chaiAsPromised);
import fastCartesian from "fast-cartesian";
import { ethers } from "ethers";
import { Connection, PublicKey, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
  createMint,
  getAccount,
  getAssociatedTokenAddressSync,
  getMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";
import {
  createWrappedOnSolana,
  redeemOnSolana,
  transferNativeSol,
  tryNativeToHexString,
  CHAINS,
} from "@certusone/wormhole-sdk";
import * as wormhole from "@certusone/wormhole-sdk/lib/cjs/solana/wormhole";
import * as tokenBridge from "@certusone/wormhole-sdk/lib/cjs/solana/tokenBridge";
import * as mock from "@certusone/wormhole-sdk/lib/cjs/mock";
import {
  ETHEREUM_TOKEN_BRIDGE_ADDRESS,
  GOVERNANCE_EMITTER_ADDRESS,
  GUARDIAN_PRIVATE_KEY,
  LOCALHOST,
  MINT_WITH_DECIMALS_8,
  MINT_WITH_DECIMALS_9,
  MINT_8_PRIVATE_KEY,
  MINT_9_PRIVATE_KEY,
  PAYER_KEYPAIR,
  TOKEN_BRIDGE_ADDRESS,
  WORMHOLE_ADDRESS,
  createMaliciousRegisterChainInstruction,
  RELAYER_KEYPAIR,
  WETH_ADDRESS,
  boilerPlateReduction,
} from "./helpers";

describe(" 0: Wormhole", () => {
  const connection = new Connection(LOCALHOST, "processed");
  const payer = PAYER_KEYPAIR;
  const relayer = RELAYER_KEYPAIR;

  const {
    signSendAndConfirmTx,
    postMessageAsVaaOnSolana,
    sendAndConfirmIx,
  } = boilerPlateReduction(connection, payer);

  // for governance actions to modify programs
  const governance = new mock.GovernanceEmitter(
    GOVERNANCE_EMITTER_ADDRESS.toBuffer().toString("hex"),
    20
  );

  before("Airdrop", async function() {
    await Promise.all(
      [payer, relayer].map(async (wallet) =>
        connection.confirmTransaction(
          await connection.requestAirdrop(wallet.publicKey, 1000 * LAMPORTS_PER_SOL)
        )
      )
    );
  });

  describe("Environment", function() {
    it("Variables", function() {
      expect(process.env.TESTING_HELLO_WORLD_ADDRESS).is.not.undefined;
      expect(process.env.TESTING_HELLO_TOKEN_ADDRESS).is.not.undefined;
    });
  });

  describe("Verify Local Validator", function() {
    it("Balance", async function() {
      const balance = await connection.getBalance(payer.publicKey);
      expect(balance).to.equal(1000 * LAMPORTS_PER_SOL);
    });

    it("Create SPL Tokens", async function() {
      const createAndCheckMint = async (
        mintDecimals: number,
        privateKey: Uint8Array,
        expectedAddress: PublicKey
      ) => {
        const mint = await createMint(
          connection,
          payer,
          payer.publicKey,
          null, // freezeAuthority
          mintDecimals,
          Keypair.fromSecretKey(privateKey)
        );
        expect(mint).to.equal(expectedAddress);

        const {decimals} = await getMint(connection, mint);
        expect(decimals).to.equal(mintDecimals);
      }
      await createAndCheckMint(9, MINT_9_PRIVATE_KEY, MINT_WITH_DECIMALS_9);
      await createAndCheckMint(8, MINT_8_PRIVATE_KEY, MINT_WITH_DECIMALS_8);
    });

    it("Create ATAs", async function() {
      await Promise.all(
        //fastCartesian([["a", "b"], ["1", "2]]) = [["a", "1"], ["a", "2"], ["b", "1"], ["b", "2"]]
        fastCartesian([[MINT_WITH_DECIMALS_8, MINT_WITH_DECIMALS_9], [payer, relayer]])
          .map(([mint, wallet]) =>
            expect(
              getOrCreateAssociatedTokenAccount(connection, wallet, mint, wallet.publicKey)
            ).to.be.fulfilled
          )
      );
    });

    it("Mint to Wallet's ATAs", async function() {
      for (const mint of [MINT_WITH_DECIMALS_8, MINT_WITH_DECIMALS_9]) {
        const mintAmount = 69420000n * 1000000000n;
        const destination = getAssociatedTokenAddressSync(mint, payer.publicKey);
        await expect(
          mintTo(
            connection,
            payer,
            mint,
            destination,
            payer,
            mintAmount
          )
        ).to.be.fulfilled;

        const {amount} = await getAccount(connection, destination);
        expect(amount).equals(mintAmount);
      }
    });
  });

  describe("Verify Wormhole Program", function() {
    it("Initialize", async function() {
      const guardianSetExpirationTime = 86400;
      const fee = 100n;
      const devnetGuardian =
        Buffer.from(new ethers.Wallet(GUARDIAN_PRIVATE_KEY).address.substring(2), "hex");
      const initialGuardians = [devnetGuardian];
      const initializeIx = wormhole.createInitializeInstruction(
        WORMHOLE_ADDRESS,
        payer.publicKey,
        guardianSetExpirationTime,
        fee,
        initialGuardians
      );
      await expect(sendAndConfirmIx(initializeIx)).to.be.fulfilled;

      const accounts = await connection.getProgramAccounts(WORMHOLE_ADDRESS);
      expect(accounts).has.length(2);

      const info = await wormhole.getWormholeBridgeData(connection, WORMHOLE_ADDRESS);
      expect(info.guardianSetIndex).to.equal(0);
      expect(info.config.guardianSetExpirationTime).to.equal(guardianSetExpirationTime);
      expect(info.config.fee).to.equal(fee);

      const guardianSet =
        await wormhole.getGuardianSet(connection, WORMHOLE_ADDRESS, info.guardianSetIndex);
      expect(guardianSet.index).to.equal(0);
      expect(guardianSet.keys).has.length(1);
      expect(Buffer.compare(guardianSet.keys[0], devnetGuardian)).to.equal(0);
    });
  });

  describe("Verify Token Bridge Program", function() {
    // foreign token bridge
    const ethereumTokenBridge = new mock.MockEthereumTokenBridge(ETHEREUM_TOKEN_BRIDGE_ADDRESS);
    const tokenBridgeWethMint = tokenBridge.deriveWrappedMintKey(
      TOKEN_BRIDGE_ADDRESS,
      CHAINS.ethereum,
      WETH_ADDRESS,
    );

    it("Initialize", async function() {
      const initializeIx = tokenBridge.createInitializeInstruction(
        TOKEN_BRIDGE_ADDRESS,
        payer.publicKey,
        WORMHOLE_ADDRESS,
      );
      await expect(sendAndConfirmIx(initializeIx)).to.be.fulfilled;

      const accounts = await connection.getProgramAccounts(TOKEN_BRIDGE_ADDRESS);
      expect(accounts).has.length(1);
    });

    //TODO the point of these test cases still eludes me
    const registerForeignEndpoint = async (
      message: Buffer,
      isMalicious: boolean,
      expectedAccountLength: number,
    ) => {
      const signedWormholeMessage =
        await expect(postMessageAsVaaOnSolana(message)).to.be.fulfilled;

      const createIxFunc = isMalicious
        ? createMaliciousRegisterChainInstruction
        : tokenBridge.createRegisterChainInstruction;

      const registerChainIx = createIxFunc(
        TOKEN_BRIDGE_ADDRESS,
        WORMHOLE_ADDRESS,
        payer.publicKey,
        signedWormholeMessage,
      );
      await expect(sendAndConfirmIx(registerChainIx)).to.be.fulfilled;

      const accounts = await connection.getProgramAccounts(TOKEN_BRIDGE_ADDRESS);
      expect(accounts).has.length(expectedAccountLength);
    }

    it("Register Foreign Endpoint (Ethereum)", async function() {
      const message = governance.publishTokenBridgeRegisterChain(
        0, //timestamp
        CHAINS.ethereum,
        ETHEREUM_TOKEN_BRIDGE_ADDRESS,
      );
      await registerForeignEndpoint(message, false, 3);
    });

    // This shouldn't be allowed, but we're doing it just to prove the safety
    // of the scaffold programs.
    it("Register Bogus Foreign Endpoint (Chain ID == 0)", async function() {
      const message = governance.publishTokenBridgeRegisterChain(
        0, // timestamp
        CHAINS.solana,
        PublicKey.default.toString()
      );
      message.writeUInt16BE(0, 86);
      await registerForeignEndpoint(message, true, 5);
    });

    // This shouldn't be allowed, but we're doing it just to prove the safety
    // of the scaffold programs.
    it("Register Bogus Foreign Endpoint (Chain ID == 1)", async function() {
      const message = governance.publishTokenBridgeRegisterChain(
        0, // timestamp
        CHAINS.solana,
        PublicKey.default.toString()
      );
      await registerForeignEndpoint(message, true, 7);
    });

    it("Outbound Transfer Native", async function() {
      const amount = BigInt(1 * LAMPORTS_PER_SOL); // explicitly sending 1 SOL
      const targetAddress = Buffer.alloc(32, "deadbeef", "hex");
      await expect(
        signSendAndConfirmTx(
          await transferNativeSol(
            connection,
            WORMHOLE_ADDRESS,
            TOKEN_BRIDGE_ADDRESS,
            payer.publicKey,
            amount,
            targetAddress,
            "ethereum"
          )
        )
      ).to.be.fulfilled;

      const {sequence} = await wormhole.getProgramSequenceTracker(
        connection,
        TOKEN_BRIDGE_ADDRESS,
        WORMHOLE_ADDRESS
      );
      expect(sequence).to.equal(1n);
    });

    it("Attest WETH from Ethereum", async function() {
      const signedWormholeMessage = await expect(postMessageAsVaaOnSolana(
        ethereumTokenBridge.publishAttestMeta(WETH_ADDRESS, 18, "WETH", "Wrapped Ether")
      )).to.be.fulfilled;

      await expect(
        signSendAndConfirmTx(
          await createWrappedOnSolana(
            connection,
            WORMHOLE_ADDRESS,
            TOKEN_BRIDGE_ADDRESS,
            payer.publicKey,
            signedWormholeMessage
          )
        )
      ).to.be.fulfilled;
    });

    it("Create WETH ATAs", async function() {
      await Promise.all(
        [payer, relayer].map((wallet) =>
          expect(
            getOrCreateAssociatedTokenAccount(
              connection,
              wallet,
              tokenBridgeWethMint,
              wallet.publicKey
            )
          ).to.be.fulfilled
        )
      );
    });

    it("Mint WETH to Wallet ATA", async function() {
      const rawAmount = ethers.utils.parseEther("110000");
      const mintAmount = BigInt(rawAmount.toString()) / 10n ** (18n - 8n);

      const destination = getAssociatedTokenAddressSync(
        tokenBridgeWethMint,
        payer.publicKey
      );

      const signedWormholeMessage = await expect(postMessageAsVaaOnSolana(
        ethereumTokenBridge.publishTransferTokens(
          tryNativeToHexString(WETH_ADDRESS, "ethereum"),
          CHAINS.ethereum, // tokenChain
          mintAmount,
          CHAINS.solana, // recipientChain
          destination.toBuffer().toString("hex"),
          0n
        )
      )).to.be.fulfilled;

      await expect(
        signSendAndConfirmTx(
          await redeemOnSolana(
            connection,
            WORMHOLE_ADDRESS,
            TOKEN_BRIDGE_ADDRESS,
            payer.publicKey,
            signedWormholeMessage
          )
        )
      ).to.be.fulfilled;

      const {amount} = await getAccount(connection, destination);
      expect(amount).equals(mintAmount);
    });
  });

  describe("Check wormhole-sdk", function() {
    it("tryNativeToHexString", async function() {
      expect(tryNativeToHexString(payer.publicKey.toString(), "solana")).to.equal(
        "c291b257b963a479bbc5a56aa6525494a6d708e628ff2ad61c8679c99d2afca5"
      );
    });
  });
});
