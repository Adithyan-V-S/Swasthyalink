const { onRequest } = require("firebase-functions/v2/https");
const admin = require('firebase-admin');
const { v4: uuidv4 } = require('uuid');

// Helper for CORS
const setCors = (res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
};

/**
 * Send a connection request from doctor to patient
 */
exports.sendConnectionRequest = onRequest(async (req, res) => {
    setCors(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { doctorId, patientId, patientEmail, patientPhone, connectionMethod, message } = req.body;

        if (!doctorId || (!patientId && !patientEmail && !patientPhone) || !connectionMethod) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }

        const db = admin.firestore();

        // Check if connection already exists
        if (patientId) {
            const existingConn = await db.collection('patient_doctor_relationships')
                .where('patientId', '==', patientId)
                .where('doctorId', '==', doctorId)
                .where('status', '==', 'active')
                .limit(1)
                .get();

            if (!existingConn.empty) {
                return res.status(409).json({ success: false, error: 'Connection already exists' });
            }
        }

        // Generate OTP if needed
        const otp = connectionMethod === 'direct' ? null : Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpiry = connectionMethod === 'direct' ? null : new Date(Date.now() + 10 * 60 * 1000).toISOString();

        // Get doctor and patient data for normalized storage
        const doctorSnap = await db.collection('users').doc(doctorId).get();
        const doctorData = doctorSnap.exists ? doctorSnap.data() : { name: 'Doctor' };

        let finalPatientId = patientId;
        let finalPatientData = { name: 'Patient' };

        if (patientId) {
            const patientSnap = await db.collection('users').doc(patientId).get();
            if (patientSnap.exists) finalPatientData = patientSnap.data();
        } else if (patientEmail) {
            const patientQuery = await db.collection('users')
                .where('email', '==', patientEmail)
                .where('role', '==', 'patient')
                .limit(1)
                .get();
            if (!patientQuery.empty) {
                finalPatientId = patientQuery.docs[0].id;
                finalPatientData = patientQuery.docs[0].data();
            } else {
                finalPatientData = { email: patientEmail, name: patientEmail.split('@')[0] };
            }
        }

        const requestId = uuidv4();
        const requestData = {
            id: requestId,
            doctorId,
            patientId: finalPatientId || null,
            patientEmail: patientEmail || finalPatientData.email || null,
            patientPhone: patientPhone || finalPatientData.phone || null,
            doctor: {
                id: doctorId,
                name: doctorData.name || doctorData.displayName || 'Doctor',
                email: doctorData.email || null,
                specialization: doctorData.specialization || 'General'
            },
            patient: {
                id: finalPatientId || null,
                name: finalPatientData.name || finalPatientData.displayName || 'Patient',
                email: finalPatientData.email || patientEmail || null,
                phone: finalPatientData.phone || patientPhone || null
            },
            connectionMethod,
            message,
            otp,
            otpExpiry,
            status: 'pending',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        await db.collection('patient_doctor_requests').doc(requestId).set(requestData);

        // Create notification
        if (finalPatientId) {
            await db.collection('notifications').add({
                recipientId: finalPatientId,
                senderId: doctorId,
                type: 'doctor_connection_request',
                title: 'New Doctor Connection Request',
                message: `Dr. ${doctorData.name || 'Unknown'} wants to connect with you`,
                data: { requestId },
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                read: false
            });
        }

        res.json({ success: true, requestId, message: 'Connection request sent successfully' });
    } catch (error) {
        console.error('sendConnectionRequest error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Get pending requests for a patient
 */
exports.getPendingRequests = onRequest(async (req, res) => {
    setCors(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { patientId, patientEmail } = req.query;
        if (!patientId && !patientEmail) {
            return res.status(400).json({ success: false, error: 'Patient identifier required' });
        }

        const db = admin.firestore();
        let query = db.collection('patient_doctor_requests').where('status', '==', 'pending');

        const requests = [];

        // Firestore doesn't support OR queries easily across fields without complex indexing
        // We'll fetch by patientId and then by email if needed, or just fetch all and filter
        if (patientId) {
            const snap = await query.where('patientId', '==', patientId).get();
            snap.forEach(doc => requests.push(doc.data()));
        }

        if (patientEmail) {
            const snap = await query.where('patientEmail', '==', patientEmail).get();
            snap.forEach(doc => {
                if (!requests.find(r => r.id === doc.id)) requests.push(doc.data());
            });
        }

        res.json({ success: true, requests });
    } catch (error) {
        console.error('getPendingRequests error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Accept connection request
 */
exports.acceptRequest = onRequest(async (req, res) => {
    setCors(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { requestId, patientId, otp } = req.body;
        if (!requestId || !patientId) return res.status(400).json({ success: false, error: 'Missing fields' });

        const db = admin.firestore();
        const requestRef = db.collection('patient_doctor_requests').doc(requestId);
        const requestSnap = await requestRef.get();

        if (!requestSnap.exists) return res.status(404).json({ success: false, error: 'Request not found' });

        const requestData = requestSnap.data();
        if (requestData.status !== 'pending') return res.status(400).json({ success: false, error: 'Request not pending' });

        // OTP verification if not direct
        if (requestData.connectionMethod !== 'direct') {
            if (!otp || requestData.otp !== otp) {
                return res.status(400).json({ success: false, error: 'Invalid OTP' });
            }
            if (requestData.otpExpiry && new Date() > new Date(requestData.otpExpiry)) {
                return res.status(400).json({ success: false, error: 'OTP expired' });
            }
        }

        const relationshipId = uuidv4();
        const relationshipData = {
            id: relationshipId,
            patientId: patientId,
            doctorId: requestData.doctorId,
            patient: requestData.patient,
            doctor: requestData.doctor,
            status: 'active',
            permissions: {
                prescriptions: true,
                records: true,
                emergency: false
            },
            connectionDate: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        const batch = db.batch();
        batch.set(db.collection('patient_doctor_relationships').doc(relationshipId), relationshipData);
        batch.update(requestRef, { status: 'accepted', updatedAt: new Date().toISOString() });

        // Update notification
        await batch.commit();

        // Notification for doctor
        await db.collection('notifications').add({
            recipientId: requestData.doctorId,
            senderId: patientId,
            type: 'connection_accepted',
            title: 'Patient Connected',
            message: `${requestData.patient.name || 'A patient'} accepted your connection request`,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            read: false
        });

        res.json({ success: true, relationship: relationshipData });
    } catch (error) {
        console.error('acceptRequest error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Reject connection request
 */
exports.rejectRequest = onRequest(async (req, res) => {
    setCors(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { requestId } = req.body;
        if (!requestId) return res.status(400).json({ success: false, error: 'Request ID required' });

        const db = admin.firestore();
        await db.collection('patient_doctor_requests').doc(requestId).update({
            status: 'rejected',
            updatedAt: new Date().toISOString()
        });

        res.json({ success: true, message: 'Request rejected' });
    } catch (error) {
        console.error('rejectRequest error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Get connected doctors for a patient
 */
exports.getConnectedDoctors = onRequest(async (req, res) => {
    setCors(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { patientId } = req.query;
        if (!patientId) return res.status(400).json({ success: false, error: 'PatientId required' });

        const db = admin.firestore();
        const snap = await db.collection('patient_doctor_relationships')
            .where('patientId', '==', patientId)
            .where('status', '==', 'active')
            .get();

        const doctors = snap.docs.map(doc => doc.data());
        res.json({ success: true, doctors });
    } catch (error) {
        console.error('getConnectedDoctors error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Get connected patients for a doctor
 */
exports.getConnectedPatients = onRequest(async (req, res) => {
    setCors(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { doctorId } = req.query;
        if (!doctorId) return res.status(400).json({ success: false, error: 'DoctorId required' });

        const db = admin.firestore();
        const snap = await db.collection('patient_doctor_relationships')
            .where('doctorId', '==', doctorId)
            .where('status', '==', 'active')
            .get();

        const patients = snap.docs.map(doc => doc.data());
        res.json({ success: true, patients });
    } catch (error) {
        console.error('getConnectedPatients error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Update relationship permissions
 */
exports.updatePermissions = onRequest(async (req, res) => {
    setCors(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { relationshipId, permissions } = req.body;
        if (!relationshipId || !permissions) return res.status(400).json({ success: false, error: 'Missing fields' });

        const db = admin.firestore();
        await db.collection('patient_doctor_relationships').doc(relationshipId).update({
            permissions,
            updatedAt: new Date().toISOString()
        });

        res.json({ success: true, message: 'Permissions updated' });
    } catch (error) {
        console.error('updatePermissions error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Terminate relationship
 */
exports.terminateRelationship = onRequest(async (req, res) => {
    setCors(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { relationshipId } = req.body;
        if (!relationshipId) return res.status(400).json({ success: false, error: 'RelationshipId required' });

        const db = admin.firestore();
        await db.collection('patient_doctor_relationships').doc(relationshipId).update({
            status: 'terminated',
            terminatedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });

        res.json({ success: true, message: 'Relationship terminated' });
    } catch (error) {
        console.error('terminateRelationship error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Search patients for a doctor
 */
exports.searchPatients = onRequest(async (req, res) => {
    setCors(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { query } = req.query;
        if (!query || query.length < 3) return res.status(400).json({ success: false, error: 'Query too short' });

        const db = admin.firestore();
        // Since we can't do full-text search easily in Firestore, we'll do email prefix search
        const snap = await db.collection('users')
            .where('role', '==', 'patient')
            .get();

        const patients = [];
        const lowerQuery = query.toLowerCase();

        snap.forEach(doc => {
            const data = doc.data();
            const name = (data.name || '').toLowerCase();
            const email = (data.email || '').toLowerCase();
            const phone = (data.phone || '');

            if (name.includes(lowerQuery) || email.includes(lowerQuery) || phone.includes(query)) {
                patients.push({
                    id: doc.id,
                    name: data.name,
                    email: data.email,
                    phone: data.phone
                });
            }
        });

        res.json({ success: true, patients: patients.slice(0, 10) });
    } catch (error) {
        console.error('searchPatients error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
