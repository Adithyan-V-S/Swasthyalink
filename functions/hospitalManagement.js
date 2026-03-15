const { onRequest } = require("firebase-functions/v2/https");
const admin = require('firebase-admin');
const { v4: uuidv4 } = require('uuid');
const { addMedicalBlock } = require('./blockchainService');

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

        // Anchor company creation on blockchain
        await addMedicalBlock({
            type: 'COMPANY_CREATED',
            companyId: companyId,
            name: name,
            timestamp: company.createdAt
        });

        res.json({ success: true, company });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Create a new Hospital Branch (with optional admin user)
 */
exports.createHospitalBranch = onRequest(async (req, res) => {
    setCors(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');
    try {
        const { companyId, name, address, phone, adminEmail, adminPassword } = req.body;
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

        let adminCreated = false;
        if (adminEmail && adminPassword) {
            try {
                const userRecord = await admin.auth().createUser({
                    email: adminEmail,
                    password: adminPassword,
                    displayName: `${name} Admin`
                });

                await db.collection('users').doc(userRecord.uid).set({
                    uid: userRecord.uid,
                    email: adminEmail,
                    name: `${name} Admin`,
                    role: 'hospital_admin',
                    branchId: branchId,
                    companyId: companyId,
                    createdAt: new Date().toISOString()
                });
                adminCreated = true;
            } catch (authError) {
                console.error("Error creating branch admin:", authError);
                if (authError.code === 'auth/email-already-exists') {
                    return res.status(400).json({ success: false, error: 'Admin email already exists' });
                }
                throw authError;
            }
        }

        await db.collection('hospital_branches').doc(branchId).set(branch);

        // Anchor branch creation on blockchain
        await addMedicalBlock({
            type: 'BRANCH_CREATED',
            branchId: branchId,
            companyId: companyId,
            name: name,
            timestamp: branch.createdAt,
            adminEmail: adminEmail || 'N/A'
        });

        res.json({ success: true, branch, adminCreated, adminEmail });
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
