// File: app/scripts/constants.ts
import { PublicKey } from "@solana/web3.js";

// The address of your treasury wallet
export const TREASURY_WALLET_ADDRESS = new PublicKey("BnyU8BGb6Ut6zvM1iRyzpJk2DtS8qAJsdyMvvZUAs1CZ");

// The address of your custom LST mint
export const LST_MINT_ADDRESS = new PublicKey("NUD3nTfiXAX7NzfPSZdQoZxDr9ckGpgN7vawdedDXNq");

// The "mathematical formula" for our exchange rate.
export const SOL_TO_LST_RATE = 100;

// The official address of the SPL Token Program
export const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");