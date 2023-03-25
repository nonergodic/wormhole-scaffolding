import { expect, use as chaiUse } from "chai";
import chaiAsPromised from 'chai-as-promised';
chaiUse(chaiAsPromised);
import {
  Connection,
  sendAndConfirmTransaction,
  Transaction,
  Keypair,
  PublicKey,
  Ed25519Program,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  deriveAddress,
  getPostMessageCpiAccounts,
  NodeWallet,
  postVaaSolana,
} from "@certusone/wormhole-sdk/lib/cjs/solana";
import { parseVaa } from "@certusone/wormhole-sdk";
import * as wormhole from "@certusone/wormhole-sdk/lib/cjs/solana/wormhole";
import * as mock from "@certusone/wormhole-sdk/lib/cjs/mock";
import {
  createHelloWorldProgramInterface,
  createInitializeInstruction,
  createReceiveMessageInstruction,
  createRegisterForeignEmitterInstruction,
  createSendMessageInstruction,
  deriveConfigKey,
  deriveForeignEmitterKey,
  deriveWormholeMessageKey,
  getConfigData,
  getForeignEmitterData,
  getReceivedData,
} from "../sdk/01_hello_world";
import {
  FUZZ_TEST_ITERATIONS,
  GUARDIAN_PRIVATE_KEY,
  HELLO_WORLD_ADDRESS,
  LOCALHOST,
  PAYER_KEYPAIR,
  WORMHOLE_ADDRESS,
  errorExistsInLog,
  boilerPlateReduction,
} from "./helpers";


describe(" 1: Hello World", function() {
  const connection = new Connection(LOCALHOST, "processed");
  const wallet = NodeWallet.fromSecretKey(PAYER_KEYPAIR.secretKey);

  const { sendAndConfirmIx, expectIxToFailWithError } =
    boilerPlateReduction(connection, wallet.signer());

  // foreign emitter info
  const foreignEmitterChain = 2;
  const foreignEmitterAddress = Buffer.alloc(32, "deadbeef", "hex");

  // Create real pdas and array of invalid ones (generated from other bumps).
  // This is a bit hardcore, but should show the effectiveness of using Anchor
  const wormholeCpi = wormhole.getWormholeDerivedAccounts(
    HELLO_WORLD_ADDRESS,
    WORMHOLE_ADDRESS
  );

  const realConfig = deriveConfigKey(HELLO_WORLD_ADDRESS);
  const realForeignEmitter = deriveForeignEmitterKey(
    HELLO_WORLD_ADDRESS,
    foreignEmitterChain
  );

  describe("Initialize Program", function() {
    describe("Fuzz Test Invalid Accounts for Instruction: initialize", function() {
      // program interface
      const program = createHelloWorldProgramInterface(
        connection,
        HELLO_WORLD_ADDRESS
      );

      const wormholeCpi = getPostMessageCpiAccounts(
        HELLO_WORLD_ADDRESS,
        WORMHOLE_ADDRESS,
        wallet.key(),
        deriveAddress([Buffer.from("alive")], HELLO_WORLD_ADDRESS)
      );

      it("Invalid Account PDA: config", async function() {
        const possibleConfigs: PublicKey[] = [];
        for (let i = 255; i >= 0; --i) {
          const bumpBytes = Buffer.alloc(1);
          bumpBytes.writeUint8(i);
          try {
            possibleConfigs.push(
              PublicKey.createProgramAddressSync(
                [Buffer.from("config"), bumpBytes],
                HELLO_WORLD_ADDRESS
              )
            );
          } catch (reason) {
            // do nothing
          }
        }
        expect(possibleConfigs.shift()!.equals(realConfig)).is.true;

        for (const config of possibleConfigs) {
          const initializeTx = await program.methods
            .initialize()
            .accounts({
              owner: wallet.key(),
              config,
              wormholeProgram: WORMHOLE_ADDRESS,
              wormholeBridge: wormholeCpi.wormholeBridge,
              wormholeFeeCollector: wormholeCpi.wormholeFeeCollector,
              wormholeEmitter: wormholeCpi.wormholeEmitter,
              wormholeSequence: wormholeCpi.wormholeSequence,
              wormholeMessage: wormholeCpi.wormholeMessage,
              clock: wormholeCpi.clock,
              rent: wormholeCpi.rent,
            })
            .instruction();
          await expectIxToFailWithError(
            initializeTx,
            "Cross-program invocation with unauthorized signer or writable account",
          );
        }
      });

      it("Invalid Account PDA: wormhole_program", async function() {
        const wormholeProgram = Ed25519Program.programId;

        const initializeTx = await program.methods
          .initialize()
          .accounts({
            owner: wallet.key(),
            config: realConfig,
            wormholeProgram,
            wormholeBridge: wormholeCpi.wormholeBridge,
            wormholeFeeCollector: wormholeCpi.wormholeFeeCollector,
            wormholeEmitter: wormholeCpi.wormholeEmitter,
            wormholeSequence: wormholeCpi.wormholeSequence,
            wormholeMessage: wormholeCpi.wormholeMessage,
            clock: wormholeCpi.clock,
            rent: wormholeCpi.rent,
          })
          .instruction();
        await expectIxToFailWithError(initializeTx, "InvalidProgramId");
      });

      it("Invalid Account PDA: wormhole_bridge", async function() {
        const possibleWormholeBridges: PublicKey[] = [];
        for (let i = 255; i >= 0; --i) {
          const bumpBytes = Buffer.alloc(1);
          bumpBytes.writeUint8(i);
          try {
            possibleWormholeBridges.push(
              PublicKey.createProgramAddressSync(
                [Buffer.from("Bridge"), bumpBytes],
                WORMHOLE_ADDRESS
              )
            );
          } catch (reason) {
            // do nothing
          }
        }
        expect(
          possibleWormholeBridges.shift()!.equals(wormholeCpi.wormholeBridge)
        ).is.true;

        for (const wormholeBridge of possibleWormholeBridges) {
          const initializeTx = await program.methods
            .initialize()
            .accounts({
              owner: wallet.key(),
              config: realConfig,
              wormholeProgram: WORMHOLE_ADDRESS,
              wormholeBridge,
              wormholeFeeCollector: wormholeCpi.wormholeFeeCollector,
              wormholeEmitter: wormholeCpi.wormholeEmitter,
              wormholeSequence: wormholeCpi.wormholeSequence,
              wormholeMessage: wormholeCpi.wormholeMessage,
              clock: wormholeCpi.clock,
              rent: wormholeCpi.rent,
            })
            .instruction();
          await expectIxToFailWithError(initializeTx, "AccountNotInitialized");
        }
      });

      it("Invalid Account PDA: wormhole_fee_collector", async function() {
        const possibleWormholeFeeCollectors: PublicKey[] = [];
        for (let i = 255; i >= 0; --i) {
          const bumpBytes = Buffer.alloc(1);
          bumpBytes.writeUint8(i);
          try {
            possibleWormholeFeeCollectors.push(
              PublicKey.createProgramAddressSync(
                [Buffer.from("fee_collector"), bumpBytes],
                WORMHOLE_ADDRESS
              )
            );
          } catch (reason) {
            // do nothing
          }
        }
        expect(
          possibleWormholeFeeCollectors
            .shift()!
            .equals(wormholeCpi.wormholeFeeCollector)
        ).is.true;

        for (const wormholeFeeCollector of possibleWormholeFeeCollectors) {
          const initializeTx = await program.methods
            .initialize()
            .accounts({
              owner: wallet.key(),
              config: realConfig,
              wormholeProgram: WORMHOLE_ADDRESS,
              wormholeBridge: wormholeCpi.wormholeBridge,
              wormholeFeeCollector,
              wormholeEmitter: wormholeCpi.wormholeEmitter,
              wormholeSequence: wormholeCpi.wormholeSequence,
              wormholeMessage: wormholeCpi.wormholeMessage,
              clock: wormholeCpi.clock,
              rent: wormholeCpi.rent,
            })
            .instruction()
            .then((ix) =>
              sendAndConfirmTransaction(
                connection,
                new Transaction().add(ix),
                [wallet.signer()]
              )
            )
            .catch((reason) => {
              expect(errorExistsInLog(reason, "AccountNotInitialized")).is.true;
              return null;
            });
          expect(initializeTx).is.null;
        }
      });

      it("Invalid Account PDA: wormhole_emitter", async function() {
        const possibleWormholeEmitters: PublicKey[] = [];
        for (let i = 255; i >= 0; --i) {
          const bumpBytes = Buffer.alloc(1);
          bumpBytes.writeUint8(i);
          try {
            possibleWormholeEmitters.push(
              PublicKey.createProgramAddressSync(
                [Buffer.from("emitter"), bumpBytes],
                HELLO_WORLD_ADDRESS
              )
            );
          } catch (reason) {
            // do nothing
          }
        }
        expect(
          possibleWormholeEmitters.shift()!.equals(wormholeCpi.wormholeEmitter)
        ).is.true;

        for (const wormholeEmitter of possibleWormholeEmitters) {
          const initializeTx = await program.methods
            .initialize()
            .accounts({
              owner: wallet.key(),
              config: realConfig,
              wormholeProgram: WORMHOLE_ADDRESS,
              wormholeBridge: wormholeCpi.wormholeBridge,
              wormholeFeeCollector: wormholeCpi.wormholeFeeCollector,
              wormholeEmitter,
              wormholeSequence: wormholeCpi.wormholeSequence,
              wormholeMessage: wormholeCpi.wormholeMessage,
              clock: wormholeCpi.clock,
              rent: wormholeCpi.rent,
            })
            .instruction()
            .then((ix) =>
              sendAndConfirmTransaction(
                connection,
                new Transaction().add(ix),
                [wallet.signer()]
              )
            )
            .catch((reason) => {
              expect(
                errorExistsInLog(
                  reason,
                  "Cross-program invocation with unauthorized signer or writable account"
                )
              ).is.true;
              return null;
            });
          expect(initializeTx).is.null;
        }
      });

      it("Invalid Account PDA: wormhole_sequence", async function() {
        const possibleWormholeSequences: PublicKey[] = [];
        for (let i = 255; i >= 0; --i) {
          const bumpBytes = Buffer.alloc(1);
          bumpBytes.writeUint8(i);
          try {
            possibleWormholeSequences.push(
              PublicKey.createProgramAddressSync(
                [
                  Buffer.from("Sequence"),
                  wormholeCpi.wormholeEmitter.toBuffer(),
                  bumpBytes,
                ],
                WORMHOLE_ADDRESS
              )
            );
          } catch (reason) {
            // do nothing
          }
        }
        expect(
          possibleWormholeSequences
            .shift()!
            .equals(wormholeCpi.wormholeSequence)
        ).is.true;

        for (const wormholeSequence of possibleWormholeSequences) {
          const initializeTx = await program.methods
            .initialize()
            .accounts({
              owner: wallet.key(),
              config: realConfig,
              wormholeProgram: WORMHOLE_ADDRESS,
              wormholeBridge: wormholeCpi.wormholeBridge,
              wormholeFeeCollector: wormholeCpi.wormholeFeeCollector,
              wormholeEmitter: wormholeCpi.wormholeSequence,
              wormholeSequence,
              wormholeMessage: wormholeCpi.wormholeMessage,
              clock: wormholeCpi.clock,
              rent: wormholeCpi.rent,
            })
            .instruction()
            .then((ix) =>
              sendAndConfirmTransaction(
                connection,
                new Transaction().add(ix),
                [wallet.signer()]
              )
            )
            .catch((reason) => {
              expect(
                errorExistsInLog(
                  reason,
                  "Cross-program invocation with unauthorized signer or writable account"
                )
              ).is.true;
              return null;
            });
          expect(initializeTx).is.null;
        }
      });
    });

    describe("Finally Set Up Program", function() {
      it("Instruction: initialize", async function() {
        const initializeTx = await createInitializeInstruction(
          connection,
          HELLO_WORLD_ADDRESS,
          wallet.key(),
          WORMHOLE_ADDRESS
        )
          .then((ix) =>
            sendAndConfirmTransaction(
              connection,
              new Transaction().add(ix),
              [wallet.signer()]
            )
          )
          .catch((reason) => {
            // should not happen
            console.log(reason);
            return null;
          });
        expect(initializeTx).is.not.null;

        // verify account data
        const configData = await getConfigData(connection, HELLO_WORLD_ADDRESS);
        expect(configData.owner.equals(wallet.key())).is.true;

        const wormholeCpi = wormhole.getWormholeDerivedAccounts(
          HELLO_WORLD_ADDRESS,
          WORMHOLE_ADDRESS
        );
        expect(configData.wormhole.bridge.equals(wormholeCpi.wormholeBridge)).to
          .be.true;
        expect(
          configData.wormhole.feeCollector.equals(
            wormholeCpi.wormholeFeeCollector
          )
        ).is.true;
      });

      it("Cannot Call Instruction Again: initialize", async function() {
        const initializeTx = await createInitializeInstruction(
          connection,
          HELLO_WORLD_ADDRESS,
          wallet.key(),
          WORMHOLE_ADDRESS
        )
          .then((ix) =>
            sendAndConfirmTransaction(
              connection,
              new Transaction().add(ix),
              [wallet.signer()]
            )
          )
          .catch((reason) => {
            expect(errorExistsInLog(reason, "already in use")).is.true;
            return null;
          });
        expect(initializeTx).is.null;
      });
    });
  });

  describe("Register Foreign Emitter", function() {
    describe("Fuzz Test Invalid Accounts for Instruction: register_emitter", function() {
      // program interface
      const program = createHelloWorldProgramInterface(
        connection,
        HELLO_WORLD_ADDRESS
      );

      const emitterChain = foreignEmitterChain;
      const emitterAddress = foreignEmitterAddress;

      it("Invalid Account PDA: owner", async function() {
        const nonOwners = [];

        for (let i = 0; i < FUZZ_TEST_ITERATIONS; ++i) {
          nonOwners.push(Keypair.generate());
        }

        // Airdrop funds for these a-holes
        await Promise.all(
          nonOwners.map(async (nonOwner) => {
            await connection
              .requestAirdrop(nonOwner.publicKey, 69 * LAMPORTS_PER_SOL)
              .then((tx) => connection.confirmTransaction(tx));
          })
        );

        for (let i = 0; i < FUZZ_TEST_ITERATIONS; ++i) {
          const nonOwner = nonOwners[i];

          const registerForeignEmitterTx = await program.methods
            .registerEmitter(emitterChain, [...emitterAddress])
            .accounts({
              owner: nonOwner.publicKey,
              config: realConfig,
              foreignEmitter: realForeignEmitter,
            })
            .instruction()
            .then((ix) =>
              sendAndConfirmTransaction(
                connection,
                new Transaction().add(ix),
                [nonOwner]
              )
            )
            .catch((reason) => {
              expect(errorExistsInLog(reason, "OwnerOnly")).is.true;
              return null;
            });
          expect(registerForeignEmitterTx).is.null;
        }
      });

      it("Invalid Account PDA: config", async function() {
        const possibleConfigs: PublicKey[] = [];
        for (let i = 255; i >= 0; --i) {
          const bumpBytes = Buffer.alloc(1);
          bumpBytes.writeUint8(i);
          try {
            possibleConfigs.push(
              PublicKey.createProgramAddressSync(
                [Buffer.from("config"), bumpBytes],
                HELLO_WORLD_ADDRESS
              )
            );
          } catch (reason) {
            // do nothing
          }
        }
        expect(possibleConfigs.shift()!.equals(realConfig)).is.true;

        for (const config of possibleConfigs) {
          const registerForeignEmitterTx = await program.methods
            .registerEmitter(emitterChain, [...emitterAddress])
            .accounts({
              owner: wallet.key(),
              config,
              foreignEmitter: realForeignEmitter,
            })
            .instruction()
            .then((ix) =>
              sendAndConfirmTransaction(
                connection,
                new Transaction().add(ix),
                [wallet.signer()]
              )
            )
            .catch((reason) => {
              expect(
                errorExistsInLog(
                  reason,
                  "The program expected this account to be already initialized"
                )
              ).is.true;
              return null;
            });
          expect(registerForeignEmitterTx).is.null;
        }
      });

      it("Invalid Account PDA: foreign_emitter", async function() {
        const possibleForeignEmitters: PublicKey[] = [];
        for (let i = 255; i >= 0; --i) {
          const bumpBytes = Buffer.alloc(1);
          bumpBytes.writeUint8(i);
          try {
            possibleForeignEmitters.push(
              PublicKey.createProgramAddressSync(
                [
                  Buffer.from("foreign_emitter"),
                  (function() {
                    const buf = Buffer.alloc(2);
                    buf.writeUInt16LE(foreignEmitterChain);
                    return buf;
                  })(),
                  bumpBytes,
                ],
                HELLO_WORLD_ADDRESS
              )
            );
          } catch (reason) {
            // do nothing
          }
        }
        expect(possibleForeignEmitters.shift()!.equals(realForeignEmitter)).is
          .true;

        // First pass completely bogus PDAs
        for (const foreignEmitter of possibleForeignEmitters) {
          const registerForeignEmitterTx = await program.methods
            .registerEmitter(emitterChain, [...emitterAddress])
            .accounts({
              owner: wallet.key(),
              config: realConfig,
              foreignEmitter,
            })
            .instruction()
            .then((ix) =>
              sendAndConfirmTransaction(
                connection,
                new Transaction().add(ix),
                [wallet.signer()]
              )
            )
            .catch((reason) => {
              expect(
                errorExistsInLog(
                  reason,
                  "Cross-program invocation with unauthorized signer or writable account"
                )
              ).is.true;
              return null;
            });
          expect(registerForeignEmitterTx).is.null;
        }
      });
    });

    describe("Expect Failure", function() {
      const emitterChain = foreignEmitterChain;
      const emitterAddress = foreignEmitterAddress;

      it("Cannot Register Emitter With Conflicting Chain ID", async function() {
        // program interface
        const program = createHelloWorldProgramInterface(
          connection,
          HELLO_WORLD_ADDRESS
        );

        const bogusEmitterChain = emitterChain + 1;

        const registerForeignEmitterTx = await program.methods
          .registerEmitter(bogusEmitterChain, [...emitterAddress])
          .accounts({
            owner: wallet.key(),
            config: realConfig,
            foreignEmitter: realForeignEmitter,
          })
          .instruction()
          .then((ix) =>
            sendAndConfirmTransaction(
              connection,
              new Transaction().add(ix),
              [wallet.signer()]
            )
          )
          .catch((reason) => {
            expect(
              errorExistsInLog(
                reason,
                "Cross-program invocation with unauthorized signer or writable account"
              )
            ).is.true;
            return null;
          });
        expect(registerForeignEmitterTx).is.null;
      });

      it("Cannot Register Chain ID == 0", async function() {
        const registerForeignEmitterTx =
          await createRegisterForeignEmitterInstruction(
            connection,
            HELLO_WORLD_ADDRESS,
            wallet.key(),
            0, // emitterChain
            emitterAddress
          )
            .then((ix) =>
              sendAndConfirmTransaction(
                connection,
                new Transaction().add(ix),
                [wallet.signer()]
              )
            )
            .catch((reason) => {
              expect(errorExistsInLog(reason, "InvalidForeignEmitter")).is.true;
              return null;
            });
        expect(registerForeignEmitterTx).is.null;
      });

      it("Cannot Register Chain ID == 1", async function() {
        const registerForeignEmitterTx =
          await createRegisterForeignEmitterInstruction(
            connection,
            HELLO_WORLD_ADDRESS,
            wallet.key(),
            1, // emitterChain
            emitterAddress
          )
            .then((ix) =>
              sendAndConfirmTransaction(
                connection,
                new Transaction().add(ix),
                [wallet.signer()]
              )
            )
            .catch((reason) => {
              expect(errorExistsInLog(reason, "InvalidForeignEmitter")).is.true;
              return null;
            });
        expect(registerForeignEmitterTx).is.null;
      });

      it("Cannot Register Zero Address", async function() {
        const registerForeignEmitterTx =
          await createRegisterForeignEmitterInstruction(
            connection,
            HELLO_WORLD_ADDRESS,
            wallet.key(),
            emitterChain,
            Buffer.alloc(32) // emitterAddress
          )
            .then((ix) =>
              sendAndConfirmTransaction(
                connection,
                new Transaction().add(ix),
                [wallet.signer()]
              )
            )
            .catch((reason) => {
              expect(errorExistsInLog(reason, "InvalidForeignEmitter")).is.true;
              return null;
            });
        expect(registerForeignEmitterTx).is.null;
      });

      it("Cannot Register Emitter Address Length != 32", async function() {
        const bogusEmitterAddress = Buffer.alloc(20, "deadbeef", "hex");
        const registerForeignEmitterTx =
          await createRegisterForeignEmitterInstruction(
            connection,
            HELLO_WORLD_ADDRESS,
            wallet.key(),
            emitterChain,
            bogusEmitterAddress
          )
            .then((ix) =>
              sendAndConfirmTransaction(
                connection,
                new Transaction().add(ix),
                [wallet.signer()]
              )
            )
            .catch((reason) => {
              expect(
                errorExistsInLog(
                  reason,
                  "The program could not deserialize the given instruction"
                )
              ).is.true;
              return null;
            });
        expect(registerForeignEmitterTx).is.null;
      });
    });

    describe("Finally Register Foreign Emitter", function() {
      it("Instruction: register_emitter", async function() {
        const emitterChain = foreignEmitterChain;
        const emitterAddress = Buffer.alloc(32, "fbadc0de", "hex");

        const registerForeignEmitterTx =
          await createRegisterForeignEmitterInstruction(
            connection,
            HELLO_WORLD_ADDRESS,
            wallet.key(),
            emitterChain,
            emitterAddress
          )
            .then((ix) =>
              sendAndConfirmTransaction(
                connection,
                new Transaction().add(ix),
                [wallet.signer()]
              )
            )
            .catch((reason) => {
              // should not happen
              console.log(reason);
              return null;
            });
        expect(registerForeignEmitterTx).is.not.null;

        // verify account data
        const foreignEmitterData = await getForeignEmitterData(
          connection,
          HELLO_WORLD_ADDRESS,
          emitterChain
        );
        expect(foreignEmitterData.chain).to.equal(emitterChain);
        expect(
          Buffer.compare(emitterAddress, foreignEmitterData.address)
        ).to.equal(0);
      });

      it("Call Instruction Again With Different Emitter Address", async function() {
        const emitterChain = foreignEmitterChain;
        const emitterAddress = foreignEmitterAddress;

        const registerForeignEmitterTx =
          await createRegisterForeignEmitterInstruction(
            connection,
            HELLO_WORLD_ADDRESS,
            wallet.key(),
            emitterChain,
            emitterAddress
          )
            .then((ix) =>
              sendAndConfirmTransaction(
                connection,
                new Transaction().add(ix),
                [wallet.signer()]
              )
            )
            .catch((reason) => {
              // should not happen
              console.log(reason);
              return null;
            });
        expect(registerForeignEmitterTx).is.not.null;

        // verify account data
        const foreignEmitterData = await getForeignEmitterData(
          connection,
          HELLO_WORLD_ADDRESS,
          emitterChain
        );
        expect(foreignEmitterData.chain).to.equal(emitterChain);
        expect(
          Buffer.compare(emitterAddress, foreignEmitterData.address)
        ).to.equal(0);
      });
    });
  });

  describe("Send Message", function() {
    describe("Expect Failure", function() {
      it("Cannot Send Message With Length > 512", async function() {
        const helloMessage = Buffer.alloc(
          513,
          "All your base are belong to us"
        );

        const sendMessageTx = await createSendMessageInstruction(
          connection,
          HELLO_WORLD_ADDRESS,
          wallet.key(),
          WORMHOLE_ADDRESS,
          helloMessage
        )
          .then((ix) =>
            sendAndConfirmTransaction(
              connection,
              new Transaction().add(ix),
              [wallet.signer()]
            )
          )
          .catch((reason) => {
            expect(
              errorExistsInLog(reason, "IO Error: message exceeds 512 bytes")
            ).is.true;
            return null;
          });
        expect(sendMessageTx).is.null;
      });
    });

    describe("Finally Send Message", function() {
      const helloMessage = Buffer.from("All your base are belong to us");

      it("Instruction: send_message", async function() {
        // save message count to grab posted message later
        const sequence = await wormhole
          .getProgramSequenceTracker(
            connection,
            HELLO_WORLD_ADDRESS,
            WORMHOLE_ADDRESS
          )
          .then((sequenceTracker) => sequenceTracker.value() + 1n);

        const sendMessageTx = await createSendMessageInstruction(
          connection,
          HELLO_WORLD_ADDRESS,
          wallet.key(),
          WORMHOLE_ADDRESS,
          helloMessage
        )
          .then((ix) =>
            sendAndConfirmTransaction(
              connection,
              new Transaction().add(ix),
              [wallet.signer()]
            )
          )
          .catch((reason) => {
            // should not happen
            console.log(reason);
            return null;
          });
        expect(sendMessageTx).is.not.null;

        // verify account data
        const payload = await wormhole
          .getPostedMessage(
            connection,
            deriveWormholeMessageKey(HELLO_WORLD_ADDRESS, sequence)
          )
          .then((posted) => posted.message.payload);

        expect(payload.readUint8(0)).to.equal(1); // payload ID
        expect(payload.readUint16BE(1)).to.equal(helloMessage.length);
        expect(Buffer.compare(payload.subarray(3), helloMessage)).to.equal(0);
      });
    });
  });

  describe("Receive Message", function() {
    const emitter = new mock.MockEmitter(
      foreignEmitterAddress.toString("hex"),
      foreignEmitterChain
    );
    const guardians = new mock.MockGuardians(0, [GUARDIAN_PRIVATE_KEY]);

    const finality = 1;
    const batchId = 0;

    describe("Expect Failure", function() {
      it("Cannot Receive Message With Unregistered Emitter", async function() {
        const bogusEmitter = new mock.MockEmitter(
          Buffer.alloc(32, "deafbeef").toString("hex"),
          foreignEmitterChain
        );

        const message = Buffer.from("Somebody set up us the bomb");
        const wormholePayload = (function() {
          const buf = Buffer.alloc(3 + message.length);
          buf.writeUint8(1, 0);
          buf.writeUint16BE(message.length, 1);
          buf.write(message.toString(), 3);
          return buf;
        })();

        const published = bogusEmitter.publishMessage(
          batchId,
          wormholePayload,
          finality
        );

        const signedWormholeMessage = guardians.addSignatures(published, [0]);

        const receiveMessageTx = await postVaaSolana(
          connection,
          wallet.signTransaction,
          WORMHOLE_ADDRESS,
          wallet.key(),
          signedWormholeMessage
        )
          .then((_) =>
            createReceiveMessageInstruction(
              connection,
              HELLO_WORLD_ADDRESS,
              wallet.key(),
              WORMHOLE_ADDRESS,
              signedWormholeMessage
            )
          )
          .then((ix) =>
            sendAndConfirmTransaction(
              connection,
              new Transaction().add(ix),
              [wallet.signer()]
            )
          )
          .catch((reason) => {
            expect(errorExistsInLog(reason, "InvalidForeignEmitter")).is.true;
            return null;
          });
        expect(receiveMessageTx).is.null;
      });

      it("Cannot Receive Message With Invalid Payload ID", async function() {
        const message = Buffer.from("Somebody set up us the bomb");
        const wormholePayload = (function() {
          const buf = Buffer.alloc(3 + message.length);
          buf.writeUint8(
            2, // payload ID
            0
          );
          buf.writeUint16BE(message.length, 1);
          buf.write(message.toString(), 3);
          return buf;
        })();

        const published = emitter.publishMessage(
          batchId,
          wormholePayload,
          finality
        );

        const signedWormholeMessage = guardians.addSignatures(published, [0]);

        const receiveMessageTx = await postVaaSolana(
          connection,
          wallet.signTransaction,
          WORMHOLE_ADDRESS,
          wallet.key(),
          signedWormholeMessage
        )
          .then((_) =>
            createReceiveMessageInstruction(
              connection,
              HELLO_WORLD_ADDRESS,
              wallet.key(),
              WORMHOLE_ADDRESS,
              signedWormholeMessage
            )
          )
          .then((ix) =>
            sendAndConfirmTransaction(
              connection,
              new Transaction().add(ix),
              [wallet.signer()]
            )
          )
          .catch((reason) => {
            expect(errorExistsInLog(reason, "IO Error: invalid payload ID")).is
              .true;
            return null;
          });
        expect(receiveMessageTx).is.null;
      });

      it("Cannot Receive Message With Payload ID == 0 (Alive)", async function() {
        const wormholePayload = (function() {
          const buf = Buffer.alloc(33);
          buf.writeUint8(
            0, // payload ID
            0
          );
          buf.write(HELLO_WORLD_ADDRESS.toBuffer().toString("hex"), 1, "hex");
          return buf;
        })();

        const published = emitter.publishMessage(
          batchId,
          wormholePayload,
          finality
        );

        const signedWormholeMessage = guardians.addSignatures(published, [0]);

        const receiveMessageTx = await postVaaSolana(
          connection,
          wallet.signTransaction,
          WORMHOLE_ADDRESS,
          wallet.key(),
          signedWormholeMessage
        )
          .then((_) =>
            createReceiveMessageInstruction(
              connection,
              HELLO_WORLD_ADDRESS,
              wallet.key(),
              WORMHOLE_ADDRESS,
              signedWormholeMessage
            )
          )
          .then((ix) =>
            sendAndConfirmTransaction(
              connection,
              new Transaction().add(ix),
              [wallet.signer()]
            )
          )
          .catch((reason) => {
            expect(errorExistsInLog(reason, "InvalidMessage")).is.true;
            return null;
          });
        expect(receiveMessageTx).is.null;
      });

      it("Cannot Receive Message With Length > 512", async function() {
        const message = Buffer.alloc(513, "Somebody set up us the bomb");
        const wormholePayload = (function() {
          const buf = Buffer.alloc(3 + message.length);
          buf.writeUint8(1, 0);
          buf.writeUint16BE(message.length, 1);
          buf.write(message.toString(), 3);
          return buf;
        })();

        const published = emitter.publishMessage(
          batchId,
          wormholePayload,
          finality
        );

        const signedWormholeMessage = guardians.addSignatures(published, [0]);

        const receiveMessageTx = await postVaaSolana(
          connection,
          wallet.signTransaction,
          WORMHOLE_ADDRESS,
          wallet.key(),
          signedWormholeMessage
        )
          .then((_) =>
            createReceiveMessageInstruction(
              connection,
              HELLO_WORLD_ADDRESS,
              wallet.key(),
              WORMHOLE_ADDRESS,
              signedWormholeMessage
            )
          )
          .then((ix) =>
            sendAndConfirmTransaction(
              connection,
              new Transaction().add(ix),
              [wallet.signer()]
            )
          )
          .catch((reason) => {
            expect(
              errorExistsInLog(reason, "IO Error: message exceeds 512 bytes")
            ).is.true;
            return null;
          });
        expect(receiveMessageTx).is.null;
      });
    });

    describe("Finally Receive Message", function() {
      const message = Buffer.from("Somebody set up us the bomb");
      const wormholePayload = (function() {
        const buf = Buffer.alloc(3 + message.length);
        buf.writeUint8(1, 0);
        buf.writeUint16BE(message.length, 1);
        buf.write(message.toString(), 3);
        return buf;
      })();

      const published = emitter.publishMessage(
        batchId,
        wormholePayload,
        finality
      );

      const signedWormholeMessage = guardians.addSignatures(published, [0]);

      it("Post Wormhole Message", async function() {
        const response = await postVaaSolana(
          connection,
          wallet.signTransaction,
          WORMHOLE_ADDRESS,
          wallet.key(),
          signedWormholeMessage
        ).catch((reason) => null);
        expect(response).is.not.null;
      });

      it("Instruction: receive_message", async function() {
        const receiveMessageTx = await createReceiveMessageInstruction(
          connection,
          HELLO_WORLD_ADDRESS,
          wallet.key(),
          WORMHOLE_ADDRESS,
          signedWormholeMessage
        )
          .then((ix) =>
            sendAndConfirmTransaction(
              connection,
              new Transaction().add(ix),
              [wallet.signer()]
            )
          )
          .catch((reason) => {
            // should not happen
            console.log(reason);
            return null;
          });
        expect(receiveMessageTx).is.not.null;

        const parsed = parseVaa(signedWormholeMessage);
        const received = await getReceivedData(
          connection,
          HELLO_WORLD_ADDRESS,
          parsed.emitterChain,
          parsed.sequence
        );
        expect(received.batchId).to.equal(batchId);
        expect(Buffer.compare(received.message, message)).to.equal(0);
      });

      it("Cannot Call Instruction Again With Same Wormhole Message: receive_message", async function() {
        const receiveMessageTx = await createReceiveMessageInstruction(
          connection,
          HELLO_WORLD_ADDRESS,
          wallet.key(),
          WORMHOLE_ADDRESS,
          signedWormholeMessage
        )
          .then((ix) =>
            sendAndConfirmTransaction(
              connection,
              new Transaction().add(ix),
              [wallet.signer()]
            )
          )
          .catch((reason) => {
            expect(errorExistsInLog(reason, "already in use")).is.true;
            return null;
          });
        expect(receiveMessageTx).is.null;
      });
    });
  });
});
