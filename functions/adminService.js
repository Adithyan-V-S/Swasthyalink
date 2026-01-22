const { onRequest } = require("firebase-functions/v2/https");
const admin = require('firebase-admin');

const db = admin.firestore();

// Helper for CORS
const setCors = (res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
};

/**
 * Admin login (Preset credentials for now)
 */
exports.adminLogin = onRequest(async (req, res) => {
    setCors(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { name, password } = req.body;

        if (!name || !password) {
            return res.status(400).json({
                success: false,
                error: 'Name and password are required'
            });
        }

        // Check preset admin credentials (matching server.js logic)
        if (name === 'admin' && password === 'admin123') {
            return res.json({
                success: true,
                admin: {
                    id: 'preset-admin',
                    name: 'admin',
                    email: 'admin@gmail.com',
                    role: 'admin'
                },
                token: 'preset-admin-token'
            });
        }

        return res.status(401).json({
            success: false,
            error: 'Invalid credentials'
        });
    } catch (error) {
        console.error('Admin login error:', error);
        res.status(500).json({ success: false, error: 'Login failed' });
    }
});

/**
 * Update doctor status (Admin only)
 */
exports.updateDoctorStatus = onRequest(async (req, res) => {
    setCors(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { id, status, adminId } = req.body;

        if (!id || !status) {
            return res.status(400).json({ success: false, error: 'ID and status are required' });
        }

        if (!['active', 'suspended'].includes(status)) {
            return res.status(400).json({ success: false, error: 'Invalid status' });
        }

        const doctorRef = db.collection('users').doc(id);
        const doc = await doctorRef.get();

        if (!doc.exists) {
            return res.status(404).json({ success: false, error: 'Doctor not found' });
        }

        await doctorRef.update({
            status,
            updatedBy: adminId || 'preset-admin',
            updatedAt: new Date().toISOString()
        });

        res.json({ success: true, message: `Doctor status updated to ${status}` });
    } catch (error) {
        console.error('Error updating doctor status:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Disable doctor account (Admin only)
 */
exports.disableDoctor = onRequest(async (req, res) => {
    setCors(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { id, adminId } = req.body;
        if (!id) return res.status(400).json({ success: false, error: 'Doctor ID is required' });

        const doctorRef = db.collection('users').doc(id);
        await doctorRef.update({
            status: 'disabled',
            disabledBy: adminId || 'preset-admin',
            disabledAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });

        res.json({ success: true, message: 'Doctor account disabled' });
    } catch (error) {
        console.error('Error disabling doctor:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
