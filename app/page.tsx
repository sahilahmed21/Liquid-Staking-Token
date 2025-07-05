// File: app/page.tsx
"use client";

import { useState, useEffect } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { createTransferInstruction, getAssociatedTokenAddressSync } from '@solana/spl-token';
import { LST_MINT_ADDRESS, TREASURY_WALLET_ADDRESS } from './scripts/constants'; // Import our constants

export default function HomePage() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();

  const [solBalance, setSolBalance] = useState(0);
  const [lstBalance, setLstBalance] = useState(0);
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');

  // Function to fetch balances
  const fetchBalances = async () => {
    if (!publicKey) return;

    // Fetch SOL balance
    const sol = await connection.getBalance(publicKey);
    setSolBalance(sol / LAMPORTS_PER_SOL);

    // Fetch LST balance
    try {
      const userAta = getAssociatedTokenAddressSync(LST_MINT_ADDRESS, publicKey);
      const lst = await connection.getTokenAccountBalance(userAta);
      setLstBalance(lst.value.uiAmount || 0);
    } catch (e) {
      // If the ATA doesn't exist, balance is 0
      setLstBalance(0);
    }
  };

  // Fetch balances when wallet is connected or balances change
  useEffect(() => {
    if (publicKey) {
      fetchBalances();
    }
  }, [publicKey, connection]);

  // Handler for depositing SOL
  const handleDeposit = async () => {
    if (!publicKey || !depositAmount) return;

    const lamports = parseFloat(depositAmount) * LAMPORTS_PER_SOL;
    if (isNaN(lamports) || lamports <= 0) {
      alert("Invalid amount");
      return;
    }

    try {
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: TREASURY_WALLET_ADDRESS,
          lamports: lamports,
        })
      );

      const signature = await sendTransaction(transaction, connection);
      console.log('Deposit tx signature:', signature);
      alert(`Deposit successful! TX: ${signature}`);
      // The backend listener will now mint LST automatically.
      // We can add a delay and then refresh balances.
      setTimeout(fetchBalances, 5000); // Refresh after 5s
    } catch (error) {
      console.error('Deposit failed', error);
      alert(`Deposit failed: ${error}`);
    }
  };

  // Handler for withdrawing LST
  const handleWithdraw = async () => {
    if (!publicKey || !withdrawAmount) return;

    const amount = parseFloat(withdrawAmount) * (10 ** 9); // Adjust for 9 decimals
    if (isNaN(amount) || amount <= 0) {
      alert("Invalid amount");
      return;
    }

    try {
      // Get the user's and treasury's token accounts
      const userAta = getAssociatedTokenAddressSync(LST_MINT_ADDRESS, publicKey);
      const treasuryAta = getAssociatedTokenAddressSync(LST_MINT_ADDRESS, TREASURY_WALLET_ADDRESS);

      const transaction = new Transaction().add(
        createTransferInstruction(
          userAta,                // from
          treasuryAta,            // to
          publicKey,              // owner
          amount
        )
      );

      const signature = await sendTransaction(transaction, connection);
      console.log('Withdraw tx signature:', signature);
      alert(`Withdrawal successful! TX: ${signature}`);
      // The backend listener will now return SOL automatically.
      setTimeout(fetchBalances, 5000); // Refresh after 5s
    } catch (error) {
      console.error('Withdrawal failed', error);
      alert(`Withdrawal failed: ${error}`);
    }
  };

  return (
    <main style={{ padding: '2rem', maxWidth: '600px', margin: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>My LST Staking</h1>
        <WalletMultiButton />
      </div>

      {publicKey ? (
        <div>
          <h3>Your Balances</h3>
          <p>SOL: {solBalance.toFixed(4)}</p>
          <p>LST: {lstBalance.toFixed(4)}</p>
          <hr style={{ margin: '2rem 0' }} />

          <h3>Deposit SOL, Get LST</h3>
          <input
            type="number"
            value={depositAmount}
            onChange={(e) => setDepositAmount(e.target.value)}
            placeholder="Amount of SOL"
            style={{ padding: '0.5rem', marginRight: '1rem' }}
          />
          <button onClick={handleDeposit} style={{ padding: '0.5rem 1rem' }}>Deposit</button>

          <h3 style={{ marginTop: '2rem' }}>Withdraw LST, Get SOL</h3>
          <input
            type="number"
            value={withdrawAmount}
            onChange={(e) => setWithdrawAmount(e.target.value)}
            placeholder="Amount of LST"
            style={{ padding: '0.5rem', marginRight: '1rem' }}
          />
          <button onClick={handleWithdraw} style={{ padding: '0.5rem 1rem' }}>Withdraw</button>
        </div>
      ) : (
        <p>Please connect your wallet to continue.</p>
      )}
    </main>
  );
}