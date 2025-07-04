// // generate-keypair.js
// const { Keypair } = require("@solana/web3.js");
// const bs58 = require("bs58");
// require("dotenv").config();

// // Generate a new keypair
// const keypair = Keypair.generate();

// // Get the public key (wallet address)
// const publicKey = keypair.publicKey.toBase58();

// // Get the private key and encode it in base58
// const privateKey = bs58.encode(keypair.secretKey);

// console.log("✅ Generated new Keypair!");
// console.log("====================================================================");
// console.log(`🔑 Public Key (Address): ${publicKey}`);
// console.log("====================================================================");
// console.log(`🤫 Private Key (Base58): ${privateKey}`);
// console.log("====================================================================");
// console.log("ACTION REQUIRED: Copy the private key and add it to a new .env file:");
// console.log(`PRIVATE_KEY="${privateKey}"`);