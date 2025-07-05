import { Connection, PublicKey, clusterApiUrl, LAMPORTS_PER_SOL } from "@solana/web3.js";
const Treasury_Address = new PublicKey("BnyU8BGb6Ut6zvM1iRyzpJk2DtS8qAJsdyMvvZUAs1CZ");
import { getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";
import { LST_MINT_ADDRESS, TREASURY_WALLET_ADDRESS, SOL_TO_LST_RATE } from "./constants.js";
import { loadTreasuryKeypair } from "./utils.js";

const treasuryKeypair = loadTreasuryKeypair();

async function main() {
    console.log("starting the LST minting service...");
    const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
    console.log("Connected to Solana devnet");
    console.log(`📡 Listening for SOL deposits to ${TREASURY_WALLET_ADDRESS.toBase58()}`);
    console.log("------------------------------------------------------------------");

    // Subscribe to logs for our treasury address
    connection.onLogs(
        TREASURY_WALLET_ADDRESS,
        async (logsResult, context) => {
            // Check if the log is from a simple SOL transfer (System Program)
            if (logsResult.logs.some(log => log.includes("11111111111111111111111111111111"))) {
                console.log(`\n✅ Detected a potential SOL deposit. Signature: ${logsResult.signature}`);
                await processDeposit(connection, logsResult.signature);
                console.log("------------------------------------------------------------------");
            }
        },
        "confirmed"
    );
}

// This is our main deposit handling function
async function processDeposit(connection: Connection, signature: string) {
    try {
        // 1. Fetch the full transaction details using the signature
        const transaction = await connection.getParsedTransaction(signature, {
            maxSupportedTransactionVersion: 0,
            commitment: "confirmed"
        });

        if (!transaction) {
            console.log("   ❌ Transaction details not found.");
            return;
        }

        // 2. Find the SOL transfer details
        const { meta } = transaction;
        if (!meta || !meta.preBalances || !meta.postBalances) {
            console.log("   ❌ Transaction meta or balances not found.");
            return;
        }
        const preBalances = meta.preBalances;
        const postBalances = meta.postBalances;
        const accountKeys = transaction.transaction.message.accountKeys;
        const treasuryIndex = accountKeys.findIndex(key => key.pubkey.equals(TREASURY_WALLET_ADDRESS));

        // This is the depositor's address!
        // We assume the first account in the transaction is the sender.
        // This is a simplification; a more robust solution would analyze all instructions.
        const depositorAddress = accountKeys[0].pubkey;

        if (treasuryIndex === -1) {
            console.log("   ❌ Treasury address not found in this transaction.");
            return;
        }

        // 3. Calculate the deposited amount
        const oldBalance = preBalances[treasuryIndex];
        const newBalance = postBalances[treasuryIndex];
        const depositedLamports = newBalance - oldBalance;
        const depositedSol = depositedLamports / LAMPORTS_PER_SOL;

        // Ignore transactions where SOL was spent, not received.
        if (depositedSol <= 0) {
            console.log(`   - Ignoring outgoing transaction or non-SOL transfer. Amount: ${depositedSol} SOL.`);
            return;
        }

        console.log(`   - Depositor: ${depositorAddress.toBase58()}`);
        console.log(`   - Amount: ${depositedSol} SOL`);

        // 4. Calculate the amount of LST to mint
        const lstToMint = depositedSol * SOL_TO_LST_RATE;
        console.log(`   - Minting ${lstToMint} LST...`);

        // 5. Mint the LST to the depositor
        // First, get or create the depositor's associated token account for our LST
        const depositorAta = await getOrCreateAssociatedTokenAccount(
            connection,
            treasuryKeypair,       // Payer for account creation
            LST_MINT_ADDRESS,      // The LST mint
            depositorAddress,      // The owner of the new account (the depositor)
        );

        // Now, mint the tokens
        const mintSignature = await mintTo(
            connection,
            treasuryKeypair,       // Payer of the transaction fee
            LST_MINT_ADDRESS,      // The LST mint
            depositorAta.address,  // The destination account
            treasuryKeypair,       // The mint authority (our treasury)
            lstToMint * (10 ** 9)  // The amount to mint, adjusted for decimals (9 for SPL tokens)
        );

        console.log(`   ✅ Successfully minted ${lstToMint} LST to ${depositorAddress.toBase58()}`);
        console.log(`   Mint Transaction: ${mintSignature}`);

    } catch (err) {
        console.error("   ❌ Error processing deposit:", err);
    }
}


main().catch(err => {
    console.error("Service encountered a fatal error:", err);
    process.exit(1);
});
