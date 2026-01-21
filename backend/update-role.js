const admin = require('firebase-admin');
const path = require('path');
require('dotenv').config();

// Initialize Firebase Admin (using your existing setup)
const serviceAccount = require('./credentials.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();
const email = "vsadithyan215@gmail.com";

async function makeUserDoctor() {
    console.log(`🔍 Looking for user: ${email}...`);

    try {
        // 1. Find the user by Email
        const user = await admin.auth().getUserByEmail(email);
        console.log(`✅ Found Auth User: ${user.uid}`);

        // 2. Update Firestore
        const userRef = db.collection('users').doc(user.uid);

        // Check current data
        const doc = await userRef.get();
        if (doc.exists) {
            console.log("Current Role:", doc.data().role);
        }

        // UPDATE to Doctor
        await userRef.set({
            role: 'doctor',
            email: email,
            name: user.displayName || 'Adithyan V S',
            specialization: 'General Medicine', // Required for dashboard
            license: 'MED-2026-TEST',        // Required for dashboard
            phone: '9876543210',              // Required for dashboard
            status: 'active',
            updatedAt: new Date().toISOString()
        }, { merge: true });

        console.log("🎉 SUCCESS! User updated to DOCTOR.");
        console.log("👉 Now Log Out and Log In again to see the Doctor Dashboard.");

    } catch (error) {
        if (error.code === 'auth/user-not-found') {
            console.error("❌ Error: User not found in Authentication list. Did you log in at least once?");
        } else {
            console.error("❌ Error:", error);
        }
    }
}

makeUserDoctor();
