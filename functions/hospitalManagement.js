const { onRequest } = require("firebase-functions/v2/https");
const admin = require('firebase-admin');
const { v4: uuidv4 } = require('uuid');

const db = admin.firestore();

// Helper for CORS
const setCors = (res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
};

/**
 * Create a new Hospital Company
 */
exports.createHospitalCompany = onRequest(async (req, res) => {
    setCors(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');
    try {
        const { name, branding } = req.body;
        if (!name) return res.status(400).json({ success: false, error: 'Name is required' });

        const companyId = uuidv4();
        const company = {
            id: companyId,
            name,
            branding: branding || {},
            createdAt: new Date().toISOString()
        };

        await db.collection('hospital_companies').doc(companyId).set(company);
        res.json({ success: true, company });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Create a new Hospital Branch
 */
exports.createHospitalBranch = onRequest(async (req, res) => {
    setCors(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');
    try {
        const { companyId, name, address, phone } = req.body;
        if (!companyId || !name) return res.status(400).json({ success: false, error: 'CompanyId and Name are required' });

        const branchId = uuidv4();
        const branch = {
            id: branchId,
            companyId,
            name,
            address: address || '',
            phone: phone || '',
            createdAt: new Date().toISOString()
        };

        await db.collection('hospital_branches').doc(branchId).set(branch);
        res.json({ success: true, branch });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Associate a user (Doctor/Nurse/Admin) with a branch
 */
exports.assignUserToBranch = onRequest(async (req, res) => {
    setCors(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');
    try {
        const { uid, branchId, companyId } = req.body;
        if (!uid || !branchId) return res.status(400).json({ success: false, error: 'UID and branchId are required' });

        await db.collection('users').doc(uid).update({
            branchId,
            companyId: companyId || null,
            updatedAt: new Date().toISOString()
        });

        res.json({ success: true, message: 'User assigned to branch successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
