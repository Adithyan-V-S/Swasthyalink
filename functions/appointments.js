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
 * Create a new Appointment
 */
exports.createAppointment = onRequest(async (req, res) => {
    setCors(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');
    try {
        const { patientId, doctorId, branchId, date, time, reason } = req.body;
        if (!patientId || !doctorId || !date || !time) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }

        const appointmentId = uuidv4();
        const appointment = {
            id: appointmentId,
            patientId,
            doctorId,
            branchId: branchId || null,
            date,
            time,
            reason: reason || '',
            status: 'pending',
            createdAt: new Date().toISOString()
        };

        await db.collection('appointments').doc(appointmentId).set(appointment);
        res.json({ success: true, appointment });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Get Appointments for a user (Doctor or Patient)
 */
exports.getAppointments = onRequest(async (req, res) => {
    setCors(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');
    try {
        const { uid, role } = req.query;
        if (!uid || !role) return res.status(400).json({ success: false, error: 'UID and role are required' });

        let q = db.collection('appointments');
        if (role === 'doctor') {
            q = q.where('doctorId', '==', uid);
        } else if (role === 'patient') {
            q = q.where('patientId', '==', uid);
        }

        const snapshot = await q.get();
        const appointments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Sort in memory to avoid requiring a composite index
        appointments.sort((a, b) => new Date(a.date) - new Date(b.date));
        
        res.json({ success: true, appointments });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Update Appointment Status
 */
exports.updateAppointmentStatus = onRequest(async (req, res) => {
    setCors(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');
    try {
        const { appointmentId, status } = req.body;
        if (!appointmentId || !status) return res.status(400).json({ success: false, error: 'AppointmentId and status are required' });

        await db.collection('appointments').doc(appointmentId).update({
            status,
            updatedAt: new Date().toISOString()
        });

        res.json({ success: true, message: 'Appointment status updated' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
