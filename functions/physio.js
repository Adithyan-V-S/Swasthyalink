const { onRequest } = require("firebase-functions/v2/https");
const admin = require('firebase-admin');

const db = admin.firestore();

// Helper for CORS (Matches familyManagement.js which is working)
const setCors = (res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
};

exports.logPhysioSession = onRequest(async (req, res) => {
    setCors(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');
    try {
        const { userId, exerciseType, reps, duration, accuracy } = req.body;

        await db.collection('physio_sessions').add({
            userId: userId || 'anonymous',
            exerciseType,
            reps,
            duration,
            accuracy,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log(`[Physio Logs] User ${userId || 'anonymous'} completed ${reps} reps of ${exerciseType}.`);
        res.json({ success: true, message: 'Session logged successfully' });
    } catch (error) {
        console.error('Physio log error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

exports.logInjuryRisk = onRequest(async (req, res) => {
    setCors(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');
    try {
        const { userId, riskLevel, message, exerciseType } = req.body;

        await db.collection('physio_injury_risks').add({
            userId: userId || 'anonymous',
            riskLevel,
            message,
            exerciseType,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log(`⚠️ INJURY RISK DETECTED [${riskLevel}]: ${message} for User: ${userId || 'anonymous'}`);
        res.json({ success: true, message: 'Risk logged successfully' });
    } catch (error) {
        console.error('Risk log error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
