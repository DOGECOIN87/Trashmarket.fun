
import { Connection, PublicKey } from '@solana/web3.js';

const RAFFLE_PROGRAM_ID = new PublicKey('EyanJkk7BV9nA5ZzuBQLqC3FWf25dLdgbURhLiV3Hc31');
const RPC_ENDPOINT = 'https://rpc.trashscan.io';

async function main() {
    const connection = new Connection(RPC_ENDPOINT, 'confirmed');

    const [raffleStatePDA] = await PublicKey.findProgramAddress(
        [Buffer.from('raffle_state')],
        RAFFLE_PROGRAM_ID
    );

    console.log('Raffle State PDA:', raffleStatePDA.toString());

    const accountInfo = await connection.getAccountInfo(raffleStatePDA);

    if (!accountInfo) {
        console.log('Raffle State account NOT found! Need to initialize.');
    } else {
        console.log('Raffle State account found.');
        console.log('Owner:', accountInfo.owner.toString());
        console.log('Data length:', accountInfo.data.length);
    }
}

main().catch(console.error);
