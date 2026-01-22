const { onRequest } = require("firebase-functions/v2/https");
const admin = require('firebase-admin');

const db = admin.firestore();

// Helper for CORS
const setCors = (res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
};

const PRESENCE_STATES = {
    ONLINE: 'online',
    AWAY: 'away',
    OFFLINE: 'offline'
};

/**
 * Update user presence
 */
exports.updatePresence = onRequest(async (req, res) => {
    setCors(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { userId, status = PRESENCE_STATES.ONLINE } = req.body;
        if (!userId) return res.status(400).json({ success: false, error: 'User ID is required' });
        if (!Object.values(PRESENCE_STATES).includes(status)) return res.status(400).json({ success: false, error: 'Invalid presence status' });

        await db.collection('users').doc(userId).update({
            'presence.status': status,
            'presence.lastSeen': admin.firestore.FieldValue.serverTimestamp(),
            'presence.updatedAt': admin.firestore.FieldValue.serverTimestamp()
        });

        res.json({ success: true, message: 'Presence updated successfully' });
    } catch (error) {
        console.error('Error updating presence:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Get multiple users' presence
 */
exports.getBatchPresence = onRequest(async (req, res) => {
    setCors(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { userIds } = req.body;
        if (!Array.isArray(userIds) || userIds.length === 0) {
            return res.status(400).json({ success: false, error: 'User IDs array is required' });
        }

        const presenceData = {};
        const batches = [];
        for (let i = 0; i < userIds.length; i += 10) {
            batches.push(userIds.slice(i, i + 10));
        }

        for (const batch of batches) {
            const promises = batch.map(userId => db.collection('users').doc(userId).get());
            const docs = await Promise.all(promises);

            docs.forEach((doc, index) => {
                const userId = batch[index];
                if (doc.exists) {
                    const data = doc.data();
                    const presence = data.presence || { status: PRESENCE_STATES.OFFLINE, lastSeen: null };
                    if (presence.lastSeen && presence.lastSeen.toDate) {
                        presence.lastSeen = presence.lastSeen.toDate().toISOString();
                    }
                    presenceData[userId] = presence;
                } else {
                    presenceData[userId] = { status: PRESENCE_STATES.OFFLINE, lastSeen: null };
                }
            });
        }

        res.json({ success: true, presenceData });
    } catch (error) {
        console.error('Error fetching batch presence:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
