const { onRequest } = require("firebase-functions/v2/https");
const admin = require('firebase-admin');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const db = admin.firestore();

// Helper for CORS
const setCors = (res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
};

/**
 * Submit doctor registration request
 */
exports.submitDoctorRegistration = onRequest(async (req, res) => {
    setCors(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const registrationData = req.body;
        const registrationId = uuidv4();
        const registration = {
            id: registrationId,
            ...registrationData,
            status: 'pending',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        await db.collection('doctor_registrations').doc(registrationId).set(registration);

        res.json({
            success: true,
            registration: {
                id: registrationId,
                name: registrationData.name,
                email: registrationData.email,
                specialization: registrationData.specialization,
                status: 'pending'
            }
        });
    } catch (error) {
        console.error('Error submitting doctor registration:', error);
        res.status(500).json({ success: false, error: 'Failed to submit registration' });
    }
});

/**
 * Get pending doctor registrations (Admin only)
 */
exports.getPendingDoctorRegistrations = onRequest(async (req, res) => {
    setCors(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const snapshot = await db.collection('doctor_registrations')
            .where('status', '==', 'pending')
            .orderBy('createdAt', 'desc')
            .get();

        const registrations = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        res.json({ success: true, registrations });
    } catch (error) {
        console.error('Error fetching pending registrations:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch registrations' });
    }
});

/**
 * Approve doctor registration
 */
exports.approveDoctorRegistration = onRequest(async (req, res) => {
    setCors(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { registrationId, adminId } = req.body;
        if (!registrationId) return res.status(400).json({ success: false, error: 'Registration ID is required' });

        const registrationRef = db.collection('doctor_registrations').doc(registrationId);
        const registrationSnap = await registrationRef.get();

        if (!registrationSnap.exists()) return res.status(404).json({ success: false, error: 'Registration not found' });

        const registration = registrationSnap.data();
        if (registration.status !== 'pending') return res.status(400).json({ success: false, error: 'Registration already processed' });

        const doctorId = uuidv4();
        const randomPassword = crypto.randomBytes(8).toString('hex');
        const saltRounds = 12;
        const hashedPassword = await bcrypt.hash(randomPassword, saltRounds);

        const doctorData = {
            id: doctorId,
            registrationId: registrationId,
            name: registration.name,
            email: registration.email,
            specialization: registration.specialization,
            license: registration.license,
            experience: registration.experience || '',
            description: registration.description || '',
            phone: registration.phone,
            loginId: doctorId,
            password: hashedPassword,
            status: 'active',
            approvedBy: adminId || 'system',
            approvedAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            role: 'doctor'
        };

        await db.collection('users').doc(doctorId).set(doctorData);

        await registrationRef.update({
            status: 'approved',
            approvedBy: adminId || 'system',
            approvedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });

        res.json({
            success: true,
            doctor: {
                id: doctorId,
                name: doctorData.name,
                email: doctorData.email,
                specialization: doctorData.specialization,
                status: 'active'
            },
            credentials: {
                doctorId: doctorId,
                loginId: doctorId,
                password: randomPassword
            }
        });
    } catch (error) {
        console.error('Error approving registration:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Reject doctor registration
 */
exports.rejectDoctorRegistration = onRequest(async (req, res) => {
    setCors(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { registrationId, adminId } = req.body;
        if (!registrationId) return res.status(400).json({ success: false, error: 'Registration ID is required' });

        const registrationRef = db.collection('doctor_registrations').doc(registrationId);
        const registrationSnap = await registrationRef.get();

        if (!registrationSnap.exists()) return res.status(404).json({ success: false, error: 'Registration not found' });
        if (registrationSnap.data().status !== 'pending') return res.status(400).json({ success: false, error: 'Registration already processed' });

        await registrationRef.update({
            status: 'rejected',
            rejectedBy: adminId || 'system',
            rejectedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Error rejecting registration:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Get all doctors
 */
exports.getAllDoctors = onRequest(async (req, res) => {
    setCors(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const limitCount = parseInt(req.query.limit) || 50;
        const snapshot = await db.collection('users')
            .where('role', '==', 'doctor')
            .orderBy('createdAt', 'desc')
            .limit(limitCount)
            .get();

        const doctors = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        res.json({ success: true, doctors });
    } catch (error) {
        console.error('Error fetching doctors:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch doctors' });
    }
});

/**
 * Update doctor profile
 */
exports.updateDoctorProfile = onRequest(async (req, res) => {
    setCors(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { doctorId, updateData } = req.body;
        if (!doctorId) return res.status(400).json({ success: false, error: 'Doctor ID is required' });

        const doctorRef = db.collection('users').doc(doctorId);
        const doctorSnap = await doctorRef.get();

        if (!doctorSnap.exists()) return res.status(404).json({ success: false, error: 'Doctor not found' });
        if (doctorSnap.data().role !== 'doctor') return res.status(403).json({ success: false, error: 'User is not a doctor' });

        delete updateData.password;
        delete updateData.loginId;
        delete updateData.role;

        await doctorRef.update({
            ...updateData,
            updatedAt: new Date().toISOString()
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Error updating doctor profile:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Authenticate doctor
 */
exports.authenticateDoctor = onRequest(async (req, res) => {
    setCors(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { loginId, password } = req.body;
        if (!loginId || !password) return res.status(400).json({ success: false, error: 'Credentials are required' });

        const snapshot = await db.collection('users')
            .where('role', '==', 'doctor')
            .where('loginId', '==', loginId)
            .get();

        if (snapshot.empty) return res.status(401).json({ success: false, error: 'Invalid credentials' });

        const doctorDoc = snapshot.docs[0];
        const doctor = doctorDoc.data();

        if (doctor.status !== 'active') return res.status(403).json({ success: false, error: 'Account is not active' });

        const isValidPassword = await bcrypt.compare(password, doctor.password);
        if (!isValidPassword) return res.status(401).json({ success: false, error: 'Invalid credentials' });

        const sessionToken = uuidv4();
        await doctorDoc.ref.update({
            lastLogin: new Date().toISOString(),
            sessionToken: sessionToken,
            updatedAt: new Date().toISOString()
        });

        res.json({
            success: true,
            doctor: {
                id: doctorDoc.id,
                name: doctor.name,
                email: doctor.email,
                specialization: doctor.specialization,
                sessionToken: sessionToken
            }
        });
    } catch (error) {
        console.error('Error authenticating doctor:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Get doctor statistics
 */
exports.getDoctorStatistics = onRequest(async (req, res) => {
    setCors(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const snapshot = await db.collection('users').where('role', '==', 'doctor').get();
        const doctors = snapshot.docs.map(doc => doc.data());

        const regSnapshot = await db.collection('doctor_registrations').where('status', '==', 'pending').get();

        const stats = {
            total: doctors.length,
            active: doctors.filter(d => d.status === 'active').length,
            suspended: doctors.filter(d => d.status === 'suspended').length,
            disabled: doctors.filter(d => d.status === 'disabled').length,
            pendingRegistrations: regSnapshot.size
        };

        res.json({ success: true, stats });
    } catch (error) {
        console.error('Error fetching statistics:', error);
        res.status(500).json({ success: false, error: 'Failed' });
    }
});

/**
 * Get all patients (Admin only)
 */
exports.getAllPatients = onRequest(async (req, res) => {
    setCors(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const limitCount = parseInt(req.query.limit) || 100;
        const snapshot = await db.collection('users')
            .where('role', '==', 'patient')
            .orderBy('createdAt', 'desc')
            .limit(limitCount)
            .get();

        const patients = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        res.json({ success: true, patients });
    } catch (error) {
        console.error('Error fetching patients:', error);
        res.status(500).json({ success: false, error: 'Failed' });
    }
});
