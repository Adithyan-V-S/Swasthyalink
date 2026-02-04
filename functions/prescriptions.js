const { onRequest } = require("firebase-functions/v2/https");
const admin = require('firebase-admin');
const { v4: uuidv4 } = require('uuid');
const { validateToken } = require('./utils/auth');

// Helper for CORS
const setCors = (res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
};

/**
 * Create a new prescription
 */
exports.createPrescription = onRequest(async (req, res) => {
    setCors(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const decodedToken = await validateToken(req);
        const { doctorId, patientId, medications, diagnosis, instructions, notes, priority, validUntil } = req.body;

        if (decodedToken.uid !== doctorId) {
            return res.status(403).json({ success: false, error: 'Unauthorized: Doctor ID mismatch' });
        }

        if (!doctorId || !patientId || !medications || !Array.isArray(medications)) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }

        const db = admin.firestore();

        // Fetch doctor and patient details for denormalization
        const [doctorSnap, patientSnap] = await Promise.all([
            db.collection('users').doc(doctorId).get(),
            db.collection('users').doc(patientId).get()
        ]);

        const doctorData = doctorSnap.data() || {};
        const patientData = patientSnap.data() || {};

        const prescriptionId = uuidv4();
        const prescription = {
            id: prescriptionId,
            doctorId,
            patientId,
            doctorName: doctorData.name || 'Unknown Doctor',
            doctorSpecialization: doctorData.specialization || 'General',
            patientName: patientData.name || 'Unknown Patient',
            medications,
            diagnosis: diagnosis || '',
            instructions: instructions || '',
            notes: notes || '',
            status: 'pending',
            priority: priority || 'normal',
            validUntil: validUntil || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        await db.collection('prescriptions').doc(prescriptionId).set(prescription);

        // Send notification to patient
        await db.collection('notifications').add({
            recipientId: patientId,
            senderId: doctorId,
            type: 'prescription',
            title: 'New Prescription',
            message: `Dr. ${doctorData.name || 'Unknown'} has prescribed medication for you`,
            data: { prescriptionId },
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            read: false
        });

        res.json({ success: true, prescriptionId, prescription });
    } catch (error) {
        console.error('createPrescription error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Get prescriptions for a doctor
 */
exports.getDoctorPrescriptions = onRequest(async (req, res) => {
    setCors(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const decodedToken = await validateToken(req);
        const { doctorId } = req.query;

        if (decodedToken.uid !== doctorId) {
            return res.status(403).json({ success: false, error: 'Unauthorized' });
        }

        if (!doctorId) return res.status(400).json({ success: false, error: 'DoctorId required' });

        const db = admin.firestore();
        const snap = await db.collection('prescriptions')
            .where('doctorId', '==', doctorId)
            .orderBy('createdAt', 'desc')
            .limit(100)
            .get();

        const prescriptions = [];
        // Since we are denormalizing, we might not need to fetch users if data is populated
        // But for backward compatibility, we check.

        for (const doc of snap.docs) {
            const data = doc.data();
            let patientName = data.patientName;

            if (!patientName) {
                // Fallback for old records
                try {
                    const patientSnap = await db.collection('users').doc(data.patientId).get();
                    patientName = patientSnap.exists ? patientSnap.data().name : 'Unknown Patient';
                } catch (e) {
                    patientName = 'Unknown Patient';
                }
            }

            prescriptions.push({
                ...data,
                patientName
            });
        }

        res.json({ success: true, prescriptions });
    } catch (error) {
        console.error('getDoctorPrescriptions error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Get prescriptions for a patient
 */
exports.getPatientPrescriptions = onRequest(async (req, res) => {
    setCors(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const decodedToken = await validateToken(req);
        const { patientId } = req.query;

        // Allow patient or their doctor? For now strictly patient.
        if (decodedToken.uid !== patientId) {
            return res.status(403).json({ success: false, error: 'Unauthorized' });
        }

        if (!patientId) return res.status(400).json({ success: false, error: 'PatientId required' });

        const db = admin.firestore();
        const snap = await db.collection('prescriptions')
            .where('patientId', '==', patientId)
            .orderBy('createdAt', 'desc')
            .limit(50)
            .get();

        const prescriptions = [];
        for (const doc of snap.docs) {
            const data = doc.data();
            let doctorName = data.doctorName;
            let doctorSpecialization = data.doctorSpecialization;

            if (!doctorName) {
                try {
                    const doctorSnap = await db.collection('users').doc(data.doctorId).get();
                    const drData = doctorSnap.exists ? doctorSnap.data() : {};
                    doctorName = drData.name || 'Unknown Doctor';
                    doctorSpecialization = drData.specialization || '';
                } catch (e) {
                    doctorName = 'Unknown Doctor';
                }
            }

            prescriptions.push({
                ...data,
                doctorName,
                doctorSpecialization
            });
        }

        res.json({ success: true, prescriptions });
    } catch (error) {
        console.error('getPatientPrescriptions error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Send prescription to patient
 */
exports.sendPrescription = onRequest(async (req, res) => {
    setCors(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const decodedToken = await validateToken(req);
        const { prescriptionId, doctorId } = req.body;

        if (decodedToken.uid !== doctorId) {
            return res.status(403).json({ success: false, error: 'Unauthorized' });
        }

        if (!prescriptionId || !doctorId) return res.status(400).json({ success: false, error: 'Missing fields' });

        const db = admin.firestore();
        const ref = db.collection('prescriptions').doc(prescriptionId);
        const snap = await ref.get();

        if (!snap.exists) return res.status(404).json({ success: false, error: 'Prescription not found' });
        const data = snap.data();
        if (data.doctorId !== doctorId) return res.status(403).json({ success: false, error: 'Unauthorized' });

        await ref.update({
            status: 'sent',
            sentAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });

        // This seems redundant if createPrescription already notifies. 
        // But maybe 'sending' is a separate step from 'creating'.
        // I'll keep it but ensure createPrescription sets status to 'pending' as it currently does.

        res.json({ success: true, message: 'Prescription sent' });
    } catch (error) {
        console.error('sendPrescription error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Update prescription status
 */
exports.updatePrescriptionStatus = onRequest(async (req, res) => {
    setCors(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const decodedToken = await validateToken(req);
        const { prescriptionId, status, userId } = req.body;

        if (decodedToken.uid !== userId) {
            return res.status(403).json({ success: false, error: 'Unauthorized' });
        }

        if (!prescriptionId || !status || !userId) return res.status(400).json({ success: false, error: 'Missing fields' });

        const db = admin.firestore();
        // Check ownership
        const docRef = db.collection('prescriptions').doc(prescriptionId);
        const docSnap = await docRef.get();
        if (docSnap.exists) {
            const data = docSnap.data();
            if (data.doctorId !== userId && data.patientId !== userId) {
                return res.status(403).json({ success: false, error: 'Unauthorized' });
            }
        }

        await docRef.update({
            status,
            updatedAt: new Date().toISOString()
        });

        res.json({ success: true, message: 'Status updated' });
    } catch (error) {
        console.error('updatePrescriptionStatus error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Get prescription details
 */
exports.getPrescriptionDetails = onRequest(async (req, res) => {
    setCors(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const decodedToken = await validateToken(req);
        const { prescriptionId } = req.query;
        if (!prescriptionId) return res.status(400).json({ success: false, error: 'PrescriptionId required' });

        const db = admin.firestore();
        const snap = await db.collection('prescriptions').doc(prescriptionId).get();

        if (!snap.exists) return res.status(404).json({ success: false, error: 'Prescription not found' });

        const data = snap.data();

        if (data.patientId !== decodedToken.uid && data.doctorId !== decodedToken.uid) {
            return res.status(403).json({ success: false, error: 'Unauthorized' });
        }

        // Fetch names if not present (backward compatibility)
        let doctorName = data.doctorName;
        let patientName = data.patientName;

        if (!doctorName || !patientName) {
            const [doctorSnap, patientSnap] = await Promise.all([
                !doctorName ? db.collection('users').doc(data.doctorId).get() : null,
                !patientName ? db.collection('users').doc(data.patientId).get() : null
            ]);

            if (doctorSnap && doctorSnap.exists) doctorName = doctorSnap.data().name;
            if (patientSnap && patientSnap.exists) patientName = patientSnap.data().name;
        }

        res.json({
            success: true,
            prescription: {
                ...data,
                doctorName: doctorName || 'Unknown Doctor',
                patientName: patientName || 'Unknown Patient'
            }
        });
    } catch (error) {
        console.error('getPrescriptionDetails error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Cancel prescription
 */
exports.cancelPrescription = onRequest(async (req, res) => {
    setCors(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const decodedToken = await validateToken(req);
        const { prescriptionId, userId, reason } = req.body;

        if (decodedToken.uid !== userId) {
            return res.status(403).json({ success: false, error: 'Unauthorized' });
        }

        if (!prescriptionId || !userId) return res.status(400).json({ success: false, error: 'Missing fields' });

        const db = admin.firestore();
        const ref = db.collection('prescriptions').doc(prescriptionId);
        const snap = await ref.get();
        if (snap.exists) {
            const data = snap.data();
            if (data.doctorId !== userId) {
                return res.status(403).json({ success: false, error: 'Unauthorized: Only doctor can cancel' });
            }
        }

        await ref.update({
            status: 'cancelled',
            cancellationReason: reason,
            cancelledBy: userId,
            cancelledAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });

        res.json({ success: true, message: 'Prescription cancelled' });
    } catch (error) {
        console.error('cancelPrescription error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
/**
 * Get common prescription templates
 */
exports.getPrescriptionTemplates = onRequest(async (req, res) => {
    setCors(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        // Publicly available or auth required? Auth required to be safe.
        // await validateToken(req); 
        // Actually templates can be public for now or loose auth.

        const templates = [
            {
                id: 'common-cold',
                name: 'Common Cold',
                medications: [
                    { name: 'Paracetamol', dosage: '500mg', frequency: 'Every 6 hours', duration: '3-5 days', instructions: 'Take with food' },
                    { name: 'Cetirizine', dosage: '10mg', frequency: 'Once daily', duration: '5 days', instructions: 'Take at bedtime' }
                ],
                diagnosis: 'Common Cold',
                instructions: 'Rest, drink plenty of fluids, avoid cold foods'
            },
            {
                id: 'hypertension',
                name: 'Hypertension Management',
                medications: [
                    { name: 'Amlodipine', dosage: '5mg', frequency: 'Once daily', duration: 'Ongoing', instructions: 'Take in the morning' }
                ],
                diagnosis: 'Hypertension',
                instructions: 'Monitor blood pressure regularly, maintain low sodium diet'
            },
            {
                id: 'diabetes',
                name: 'Diabetes Management',
                medications: [
                    { name: 'Metformin', dosage: '500mg', frequency: 'Twice daily', duration: 'Ongoing', instructions: 'Take with meals' }
                ],
                diagnosis: 'Type 2 Diabetes',
                instructions: 'Monitor blood sugar levels, maintain healthy diet and exercise'
            }
        ];

        res.json({ success: true, templates });
    } catch (error) {
        console.error('getPrescriptionTemplates error:', error);
        res.status(500).json({ success: false, error: 'Failed' });
    }
});

/**
 * Search drug database
 */
exports.searchDrugs = onRequest(async (req, res) => {
    setCors(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { query } = req.query;
        if (!query || query.length < 2) {
            return res.status(400).json({ success: false, error: 'Query too short' });
        }

        const mockDrugs = [
            { name: 'Paracetamol', category: 'Analgesic', commonDosages: ['500mg', '650mg'] },
            { name: 'Ibuprofen', category: 'NSAID', commonDosages: ['200mg', '400mg'] },
            { name: 'Amoxicillin', category: 'Antibiotic', commonDosages: ['250mg', '500mg'] },
            { name: 'Metformin', category: 'Antidiabetic', commonDosages: ['500mg', '850mg'] },
            { name: 'Amlodipine', category: 'Antihypertensive', commonDosages: ['2.5mg', '5mg', '10mg'] },
            { name: 'Cetirizine', category: 'Antihistamine', commonDosages: ['5mg', '10mg'] },
            { name: 'Omeprazole', category: 'PPI', commonDosages: ['20mg', '40mg'] },
            { name: 'Atorvastatin', category: 'Statin', commonDosages: ['10mg', '20mg', '40mg'] }
        ];

        const filteredDrugs = mockDrugs.filter(drug =>
            drug.name.toLowerCase().includes(query.toLowerCase())
        );

        res.json({ success: true, drugs: filteredDrugs });
    } catch (error) {
        console.error('searchDrugs error:', error);
        res.status(500).json({ success: false, error: 'Failed' });
    }
});
