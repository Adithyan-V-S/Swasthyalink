const admin = require('firebase-admin');
const crypto = require('crypto');

/**
 * Calculates the SHA-256 hash of a block's contents.
 * @param {Object} block The block to hash.
 * @returns {string} The hex-encoded hash.
 */
function calculateHash(block) {
    const { index, previousHash, timestamp, data, nonce } = block;
    const blockString = `${index}${previousHash}${timestamp}${JSON.stringify(data)}${nonce}`;
    return crypto.createHash('sha256').update(blockString).digest('hex');
}

/**
 * Adds a new medical record block to the health ledger.
 * @param {Object} medicalData The data to store (prescription, report summary, etc.)
 * @returns {Promise<Object>} The newly created block.
 */
async function addMedicalBlock(medicalData) {
    const db = admin.firestore();
    const ledgerRef = db.collection('health_ledger');

    // 1. Get the last block to link the chain
    const lastBlockQuery = await ledgerRef.orderBy('index', 'desc').limit(1).get();

    let index = 0;
    let previousHash = '0'; // Genesis block hash

    if (!lastBlockQuery.empty) {
        const lastBlock = lastBlockQuery.docs[0].data();
        index = lastBlock.index + 1;
        previousHash = lastBlock.hash;
    }

    const timestamp = new Date().toISOString();
    const nonce = 0; // Simplified; can implement proof-of-work if needed

    const newBlock = {
        index,
        previousHash,
        timestamp,
        data: medicalData,
        nonce
    };

    newBlock.hash = calculateHash(newBlock);

    // 2. Store the block
    await ledgerRef.doc(index.toString()).set(newBlock);

    return newBlock;
}

/**
 * Verifies the integrity of the entire health ledger.
 * @returns {Promise<Object>} Verification result with status and potential tampered blocks.
 */
async function verifyChain() {
    const db = admin.firestore();
    const snapshot = await db.collection('health_ledger').orderBy('index', 'asc').get();

    const chain = snapshot.docs.map(doc => doc.data());
    const tamperedBlocks = [];

    for (let i = 0; i < chain.length; i++) {
        const currentBlock = chain[i];

        // Check 1: Verify current hash
        const actualHash = calculateHash(currentBlock);
        if (currentBlock.hash !== actualHash) {
            tamperedBlocks.push({ index: currentBlock.index, reason: 'Current hash mismatch' });
            continue;
        }

        // Check 2: Verify link to previous block
        if (i > 0) {
            const previousBlock = chain[i - 1];
            if (currentBlock.previousHash !== previousBlock.hash) {
                tamperedBlocks.push({ index: currentBlock.index, reason: 'Previous hash mismatch (Link broken)' });
            }
        }
    }

    return {
        isValid: tamperedBlocks.length === 0,
        tamperedBlocks,
        totalBlocks: chain.length
    };
}

module.exports = {
    calculateHash,
    addMedicalBlock,
    verifyChain
};
