const admin = require('firebase-admin');
const serviceAccount = require('c:/Users/vsadi/Downloads/swasthyalink-42535-firebase-adminsdk-fbsvc-b8bffaf18b.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function deleteCollection(collectionPath) {
    const collectionRef = db.collection(collectionPath);
    const snapshot = await collectionRef.get();

    if (snapshot.size === 0) {
        console.log(`No documents found in ${collectionPath}`);
        return;
    }

    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
    });

    await batch.commit();
    console.log(`Deleted ${snapshot.size} documents from ${collectionPath}`);
}

async function resetData() {
    try {
        console.log('Starting data reset...');
        await deleteCollection('patient_doctor_relationships');
        await deleteCollection('patient_doctor_requests');
        // Optional: clear prescriptions too if you want a totally clean slate
        await deleteCollection('prescriptions');
        console.log('Data reset complete.');
    } catch (error) {
        console.error('Error resetting data:', error);
    }
}

resetData();
