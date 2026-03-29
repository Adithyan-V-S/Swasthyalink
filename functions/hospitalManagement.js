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
exports.createHospitalCompany = onRequest({ cors: true }, async (req, res) => {
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
exports.createHospitalBranch = onRequest({ cors: true }, async (req, res) => {
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
                    role: 'admin',
                    branchId: branchId,
                    companyId: companyId,
                    phone: phone || '',
                    createdBy: 'group_admin',
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
exports.assignUserToBranch = onRequest({ cors: true }, async (req, res) => {
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

/**
 * Update Branch Admin Credentials
 */
exports.updateBranchAdmin = onRequest({ cors: true }, async (req, res) => {
    try {
        const { branchId, newEmail, newPhone, newPassword } = req.body;
        if (!branchId) return res.status(400).json({ success: false, error: 'branchId is required' });

        // 1. Find the current admin user for this branch
        const usersRef = db.collection('users');
        const q = await usersRef.where('branchId', '==', branchId).where('role', '==', 'hospital_admin').limit(1).get();
        
        let uid;
        let adminDoc;
        let isNew = false;

        if (q.empty) {
            // If no admin found, we can create one if newEmail and newPassword are provided
            if (!newEmail || !newPassword) {
                return res.status(404).json({ 
                    success: false, 
                    error: 'No admin assigned to this branch yet. To create one, please provide both Email and a Password.' 
                });
            }

            try {
                const userRecord = await admin.auth().createUser({
                    email: newEmail,
                    password: newPassword,
                    displayName: `Admin`
                });
                uid = userRecord.uid;
                isNew = true;
            } catch (authError) {
                if (authError.code === 'auth/email-already-exists') {
                    return res.status(400).json({ success: false, error: 'Email already exists with another account.' });
                }
                throw authError;
            }
        } else {
            adminDoc = q.docs[0];
            uid = adminDoc.id;
        }

        const currentData = !isNew ? adminDoc.data() : {};

        // 2. Update Firebase Auth if existing user and Email/Password changed
        if (!isNew) {
            try {
                const updateParams = {};
                if (newEmail && newEmail !== currentData.email) updateParams.email = newEmail;
                if (newPassword) updateParams.password = newPassword;

                if (Object.keys(updateParams).length > 0) {
                    await admin.auth().updateUser(uid, updateParams);
                    console.log(`Auth record updated for UID: ${uid}`);
                }
            } catch (authError) {
                console.error(`Error updating Auth for UID ${uid}:`, authError.message);
                if (authError.code === 'auth/user-not-found') {
                    return res.status(404).json({ 
                        success: false, 
                        error: `The user account for this admin (ID: ${uid}) is missing. Please create a new admin or contact support.` 
                    });
                }
                throw authError; // Rethrow other errors for the 500 handler
            }
        }

        // 3. Update/Set Firestore User Document
        const userData = {
            email: newEmail || currentData.email,
            phone: newPhone !== undefined ? newPhone : (currentData.phone || ''),
            role: 'admin',
            branchId: branchId,
            updatedAt: new Date().toISOString()
        };

        if (isNew) {
            userData.uid = uid;
            userData.name = 'Branch Admin';
            userData.createdBy = 'group_admin';
            userData.createdAt = new Date().toISOString();
            await db.collection('users').doc(uid).set(userData);
        } else {
            await adminDoc.ref.update(userData);
        }

        // 4. Update branch document email if it changed
        if (newEmail) {
            await db.collection('hospital_branches').doc(branchId).update({
                adminEmail: newEmail
            });
        }

        res.json({ 
            success: true, 
            message: isNew ? 'New Branch Admin created and linked successfully' : 'Branch Admin credentials updated successfully' 
        });
    } catch (error) {
        console.error("Error updating branch admin:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});
