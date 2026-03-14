const admin = require('firebase-admin');
const { v4: uuidv4 } = require('uuid');

async function setupKottayamBranch() {
    const db = admin.firestore();

    const companyId = 'swasthyalink-group-001';
    const companyName = 'Swasthyalink';

    // 1. Ensure Swasthyalink Group exists
    await db.collection('hospital_companies').doc(companyId).set({
        id: companyId,
        name: companyName,
        branding: { color: '#3b82f6' },
        createdAt: new Date().toISOString()
    }, { merge: true });

    // 2. Ensure Kottayam Branch exists
    const branchId = 'kottayam-001';
    await db.collection('hospital_branches').doc(branchId).set({
        id: branchId,
        companyId: companyId,
        name: 'Swasthyalink Kottayam',
        address: 'Kottayam, Kerala',
        phone: '+91 9876543210',
        createdAt: new Date().toISOString()
    }, { merge: true });

    // 3. Assign existing hospitaladmin to Kottayam branch
    const adminEmail = 'hospitaladmin@gmail.com';
    const usersSnapshot = await db.collection('users').where('email', '==', adminEmail).get();

    if (!usersSnapshot.empty) {
        const adminDoc = usersSnapshot.docs[0];
        await adminDoc.ref.update({
            branchId: branchId,
            companyId: companyId,
            role: 'hospital_admin',
            updatedAt: new Date().toISOString()
        });
        console.log(`✅ Assigned ${adminEmail} to Kottayam branch`);
    } else {
        console.log(`⚠️ User ${adminEmail} not found in Firestore`);
    }
}

module.exports = setupKottayamBranch;
