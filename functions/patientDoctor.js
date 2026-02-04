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
 * Send a connection request from doctor to patient
 */
exports.sendConnectionRequest = onRequest(async (req, res) => {
    setCors(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const decodedToken = await validateToken(req);
        const { doctorId, patientId, patientEmail, patientPhone, connectionMethod, message } = req.body;

        if (decodedToken.uid !== doctorId) {
            return res.status(403).json({ success: false, error: 'Unauthorized: Doctor ID mismatch' });
        }

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
                specialization: doctorData.specialization || 'General',
                avatar: doctorData.photoURL || doctorData.avatar || null
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
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        // Ensure we don't write undefined fields
        Object.keys(requestData).forEach(key => requestData[key] === undefined && delete requestData[key]);
        Object.keys(requestData.doctor).forEach(key => requestData.doctor[key] === undefined && delete requestData.doctor[key]);
        Object.keys(requestData.patient).forEach(key => requestData.patient[key] === undefined && delete requestData.patient[key]);

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
        const decodedToken = await validateToken(req);
        const { patientId, patientEmail } = req.query;

        // Ensure user is requesting their own data
        if (decodedToken.uid !== patientId && decodedToken.email !== patientEmail) {
            // We allow fetching if either ID or email matches, but prefer ID check.
            // If patientId is provided, it must match.
            if (patientId && decodedToken.uid !== patientId) {
                return res.status(403).json({ success: false, error: 'Unauthorized' });
            }
        }

        if (!patientId && !patientEmail) {
            return res.status(400).json({ success: false, error: 'Patient identifier required' });
        }

        const db = admin.firestore();
        let query = db.collection('patient_doctor_requests').where('status', '==', 'pending');

        const requests = [];

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
        // Special handling for auth errors to return 401
        if (error.message === 'Unauthorized') {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }
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
        const decodedToken = await validateToken(req);
        const { requestId, patientId, otp } = req.body;

        if (decodedToken.uid !== patientId) {
            return res.status(403).json({ success: false, error: 'Unauthorized' });
        }

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

        // Notification for doctor
        const notificationRef = db.collection('notifications').doc();
        batch.set(notificationRef, {
            recipientId: requestData.doctorId,
            senderId: patientId,
            type: 'connection_accepted',
            title: 'Patient Connected',
            message: `${requestData.patient.name || 'A patient'} accepted your connection request`,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            read: false
        });

        await batch.commit();

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
        const decodedToken = await validateToken(req);
        const { requestId } = req.body;
        if (!requestId) return res.status(400).json({ success: false, error: 'Request ID required' });

        const db = admin.firestore();
        // Verify ownership before updating
        const requestRef = db.collection('patient_doctor_requests').doc(requestId);
        const requestSnap = await requestRef.get();
        if (!requestSnap.exists) return res.status(404).json({ success: false, error: 'Request not found' });

        const requestData = requestSnap.data();
        // Allow rejection if user is either patient or doctor involved
        if (requestData.patientId !== decodedToken.uid && requestData.doctorId !== decodedToken.uid && requestData.patientEmail !== decodedToken.email) {
            return res.status(403).json({ success: false, error: 'Unauthorized' });
        }

        await requestRef.update({
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
        const decodedToken = await validateToken(req);
        const { patientId } = req.query;

        if (decodedToken.uid !== patientId) {
            return res.status(403).json({ success: false, error: 'Unauthorized' });
        }

        if (!patientId) return res.status(400).json({ success: false, error: 'PatientId required' });

        const db = admin.firestore();
        const snap = await db.collection('patient_doctor_relationships')
            .where('patientId', '==', patientId)
            .where('status', '==', 'active')
            .get();

        const doctors = await Promise.all(snap.docs.map(async doc => {
            const relData = doc.data();
            // Fetch fresh doctor data
            try {
                const userSnap = await db.collection('users').doc(relData.doctorId).get();
                if (userSnap.exists) {
                    const userData = userSnap.data();
                    // Merge user data into relationship data for display
                    return {
                        ...relData,
                        doctor: {
                            ...relData.doctor,
                            name: userData.name || userData.displayName || relData.doctor?.name || 'Doctor',
                            email: userData.email || relData.doctor?.email,
                            specialization: userData.specialization || relData.doctor?.specialization || 'General',
                            avatar: userData.photoURL || userData.avatar || relData.doctor?.avatar
                        }
                    };
                }
            } catch (err) {
                console.warn('Error fetching doctor details:', err);
            }
            return relData;
        }));

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
        const decodedToken = await validateToken(req);
        const { doctorId } = req.query;

        if (decodedToken.uid !== doctorId) {
            return res.status(403).json({ success: false, error: 'Unauthorized' });
        }

        if (!doctorId) return res.status(400).json({ success: false, error: 'DoctorId required' });

        const db = admin.firestore();
        const snap = await db.collection('patient_doctor_relationships')
            .where('doctorId', '==', doctorId)
            .where('status', '==', 'active')
            .get();

        const patients = await Promise.all(snap.docs.map(async doc => {
            const relData = doc.data();
            // Fetch fresh patient data
            try {
                const userSnap = await db.collection('users').doc(relData.patientId).get();
                if (userSnap.exists) {
                    const userData = userSnap.data();
                    // Merge user data into relationship data for display
                    return {
                        ...relData,
                        patient: {
                            ...relData.patient,
                            name: userData.name || userData.displayName || relData.patient?.name || 'Patient',
                            email: userData.email || relData.patient?.email,
                            phone: userData.phone || relData.patient?.phone,
                            avatar: userData.photoURL || userData.avatar || relData.patient?.avatar,
                            age: userData.age,
                            gender: userData.gender,
                            bloodType: userData.bloodType,
                            allergies: userData.allergies
                        }
                    };
                }
            } catch (err) {
                console.warn('Error fetching patient details:', err);
            }
            return relData;
        }));

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
        const decodedToken = await validateToken(req);
        const { relationshipId, permissions } = req.body;

        const db = admin.firestore();
        const relRef = db.collection('patient_doctor_relationships').doc(relationshipId);
        const relSnap = await relRef.get();

        if (!relSnap.exists) return res.status(404).json({ success: false, error: 'Relationship not found' });

        // Only patient can update permissions
        if (relSnap.data().patientId !== decodedToken.uid) {
            return res.status(403).json({ success: false, error: 'Unauthorized' });
        }

        if (!relationshipId || !permissions) return res.status(400).json({ success: false, error: 'Missing fields' });

        await relRef.update({
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
        const decodedToken = await validateToken(req);
        const { relationshipId } = req.body;

        const db = admin.firestore();
        const relRef = db.collection('patient_doctor_relationships').doc(relationshipId);
        const relSnap = await relRef.get();

        if (!relSnap.exists) return res.status(404).json({ success: false, error: 'Relationship not found' });

        const data = relSnap.data();
        if (data.patientId !== decodedToken.uid && data.doctorId !== decodedToken.uid) {
            return res.status(403).json({ success: false, error: 'Unauthorized' });
        }

        if (!relationshipId) return res.status(400).json({ success: false, error: 'RelationshipId required' });

        await relRef.update({
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
        const decodedToken = await validateToken(req);
        // Verify user is a doctor (optional, depending on custom claims or just allowing authenticated users)

        const { query } = req.query;
        if (!query || query.length < 3) return res.status(400).json({ success: false, error: 'Query too short' });

        const db = admin.firestore();
        const patients = [];

        // Strategy: 
        // 1. Try exact match on email (most common)
        // 2. Try exact match on phone
        // 3. Fallback to broad search only if 1 & 2 fail or if we want to be exhaustive

        const emailQuery = db.collection('users').where('email', '==', query).where('role', '==', 'patient').get();
        const phoneQuery = db.collection('users').where('phone', '==', query).where('role', '==', 'patient').get();

        const [emailSnap, phoneSnap] = await Promise.all([emailQuery, phoneQuery]);

        const addDocs = (snap) => {
            snap.forEach(doc => {
                const data = doc.data();
                if (!patients.find(p => p.id === doc.id)) {
                    patients.push({
                        id: doc.id,
                        name: data.name,
                        email: data.email,
                        phone: data.phone
                    });
                }
            });
        };

        addDocs(emailSnap);
        addDocs(phoneSnap);

        // If we found results, return them. 
        if (patients.length > 0) {
            return res.json({ success: true, patients });
        }

        // If no exact match, and we are willing to be expensive:
        // Attempt a prefix search for email
        // Note: Firestore string prefix search: where('field', '>=', query).where('field', '<=', query + '\uf8ff')

        const prefixSnap = await db.collection('users')
            .where('role', '==', 'patient')
            .where('email', '>=', query)
            .where('email', '<=', query + '\uf8ff')
            .limit(10)
            .get();

        addDocs(prefixSnap);

        if (patients.length > 0) {
            return res.json({ success: true, patients });
        }

        // Final fallback: The expensive full scan (limit to 50 latest)
        // Only do this if strictly necessary. For now, let's skip it to see if email/phone search is enough.
        // It forces users to be specific, which is good for privacy too.

        res.json({ success: true, patients });
    } catch (error) {
        console.error('searchPatients error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
