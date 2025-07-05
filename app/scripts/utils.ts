import { Keypair } from "@solana/web3.js";
import fs from "fs";

const TREASURY_KEYPAIR_PATH = "C:/SolanaKeys/id.json";

export function loadTreasuryKeypair(): Keypair {
    try {
        const fileContent = fs.readFileSync(TREASURY_KEYPAIR_PATH, 'utf-8');
        const secretKey = Uint8Array.from(JSON.parse(fileContent));
        return Keypair.fromSecretKey(secretKey);
    } catch (err) {
        console.error("Failed to load treasury keypair from file:", err);
        console.error("Please ensure the path in `app/scripts/utils.ts` is correct and the file exists.");
        process.exit(1);
    }
}
