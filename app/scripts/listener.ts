// File: app/scripts/listener.ts

import { Connection, PublicKey, clusterApiUrl, LAMPORTS_PER_SOL, SystemProgram, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import { getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";
import { LST_MINT_ADDRESS, TREASURY_WALLET_ADDRESS, SOL_TO_LST_RATE, TOKEN_PROGRAM_ID } from "./constants.js";
import { loadTreasuryKeypair } from "./utils.js";

const treasuryKeypair = loadTreasuryKeypair();

async function main() {
    console.log("🚀 Starting the LST Staking service...");
    const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

    console.log(`📡 Monitoring wallet: ${TREASURY_WALLET_ADDRESS.toBase58()}`);
    console.log("------------------------------------------------------------------");

    connection.onLogs(
        TREASURY_WALLET_ADDRESS,
        async (logsResult, context) => {
            const { signature, logs } = logsResult;

            if (logs.some(log => log.includes("Program 11111111111111111111111111111111 invoke"))) {
                console.log(`\n✅ Detected a potential SOL deposit. Signature: ${signature}`);
                await processDeposit(connection, signature);
                console.log("------------------------------------------------------------------");

            } else if (logs.some(log => log.includes(`Program ${TOKEN_PROGRAM_ID.toBase58()} invoke`))) {
                console.log(`\n✅ Detected a potential LST withdrawal. Signature: ${signature}`);
                await processWithdrawal(connection, signature);
                console.log("------------------------------------------------------------------");
            }
        },
        "confirmed"
    );
}

// Function to handle SOL deposits (unchanged)
async function processDeposit(connection: Connection, signature: string) {
    // ... (This function remains the same as in Step 4)
    try {
        const transaction = await connection.getParsedTransaction(signature, { maxSupportedTransactionVersion: 0 });
        if (!transaction) { console.log("   ❌ Transaction details not found."); return; }
        const { preBalances, postBalances } = transaction.meta!;
        const accountKeys = transaction.transaction.message.accountKeys;
        const treasuryIndex = accountKeys.findIndex(key => key.pubkey.equals(TREASURY_WALLET_ADDRESS));
        const depositorAddress = accountKeys[0].pubkey;
        if (treasuryIndex === -1) { console.log("   ❌ Treasury address not found."); return; }
        const depositedLamports = postBalances[treasuryIndex] - preBalances[treasuryIndex];
        const depositedSol = depositedLamports / LAMPORTS_PER_SOL;
        if (depositedSol <= 0) { console.log(`   - Ignoring outgoing/internal transaction. Amount: ${depositedSol} SOL.`); return; }
        console.log(`   - Depositor: ${depositorAddress.toBase58()}`);
        console.log(`   - Amount: ${depositedSol} SOL`);
        const lstToMint = depositedSol * SOL_TO_LST_RATE;
        console.log(`   - Minting ${lstToMint} LST...`);
        const depositorAta = await getOrCreateAssociatedTokenAccount(connection, treasuryKeypair, LST_MINT_ADDRESS, depositorAddress);
        const mintSignature = await mintTo(connection, treasuryKeypair, LST_MINT_ADDRESS, depositorAta.address, treasuryKeypair, lstToMint * (10 ** 9));
        console.log(`   ✅ Successfully minted ${lstToMint} LST to ${depositorAddress.toBase58()}`);
        console.log(`   Mint Transaction: ${mintSignature}`);
    } catch (err) { console.error("   ❌ Error processing deposit:", err); }
}

// NEW function to handle LST withdrawals
async function processWithdrawal(connection: Connection, signature: string) {
    try {
        // 1. Fetch the transaction details
        const transaction = await connection.getParsedTransaction(signature, {
            maxSupportedTransactionVersion: 0,
            commitment: "confirmed"
        });

        if (!transaction || !transaction.meta) {
            console.log("   ❌ Transaction details not found for withdrawal.");
            return;
        }

        // 2. Find the token transfer instruction
        const tokenTransferInstruction = transaction.meta.innerInstructions
            ?.flatMap(i => i.instructions)
            .find(ix => "parsed" in ix && ix.parsed.type === "transfer" && ix.program === "spl-token");

        if (!tokenTransferInstruction || !("parsed" in tokenTransferInstruction)) {
            console.log("   ❌ No valid SPL token transfer instruction found.");
            return;
        }

        const { info } = tokenTransferInstruction.parsed;
        const lstReceived = parseInt(info.amount, 10) / (10 ** 9); // Amount in full tokens
        const destination = new PublicKey(info.destination);
        const sourceOwner = new PublicKey(info.source); // This is the user who sent us the LST

        // 3. Security Check: Ensure the LST was sent TO our treasury
        const treasuryAtaAccounts = await connection.getParsedTokenAccountsByOwner(
            TREASURY_WALLET_ADDRESS,
            { mint: LST_MINT_ADDRESS }
        );
        if (treasuryAtaAccounts.value.length === 0) {
            console.log("   - Treasury ATA not found.");
            return;
        }
        const treasuryAtaPubkey = treasuryAtaAccounts.value[0].pubkey;
        if (!destination.equals(treasuryAtaPubkey)) {
            console.log("   - Ignoring transfer not sent to our treasury ATA.");
            return;
        }

        console.log(`   - Withdrawer: ${sourceOwner.toBase58()}`);
        console.log(`   - Amount: ${lstReceived} LST`);

        // 4. Calculate the amount of SOL to return
        const solToReturn = lstReceived / SOL_TO_LST_RATE;
        console.log(`   - Returning ${solToReturn} SOL...`);

        // 5. Build and send the SOL transfer transaction
        const transferTx = new Transaction().add(
            SystemProgram.transfer({
                fromPubkey: treasuryKeypair.publicKey,
                toPubkey: sourceOwner,
                lamports: solToReturn * LAMPORTS_PER_SOL,
            })
        );

        const returnSignature = await sendAndConfirmTransaction(connection, transferTx, [treasuryKeypair]);

        console.log(`   ✅ Successfully returned ${solToReturn} SOL to ${sourceOwner.toBase58()}`);
        console.log(`   Return Transaction: ${returnSignature}`);

    } catch (err) {
        console.error("   ❌ Error processing withdrawal:", err);
    }
}

main().catch(err => {
    console.error("Service encountered a fatal error:", err);
    process.exit(1);
});