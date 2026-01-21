const { onRequest } = require("firebase-functions/v2/https");
const admin = require('firebase-admin');
const { v4: uuidv4 } = require('uuid');

// Mock users for name lookups (same as original server.js)
const mockUsers = [
    { email: 'john.doe@example.com', name: 'John Doe' },
    { email: 'jane.smith@example.com', name: 'Jane Smith' },
    { email: 'mike.johnson@example.com', name: 'Mike Johnson' },
    { email: 'sarah.wilson@example.com', name: 'Sarah Wilson' },
    { email: 'emma.brown@example.com', name: 'Emma Brown' },
    { email: 'david.davis@example.com', name: 'David Davis' }
];

function getInverseRelationship(relationship) {
    const inverseMap = {
        'Parent': 'Child',
        'Child': 'Parent',
        'Spouse': 'Spouse',
        'Sibling': 'Sibling',
        'Grandparent': 'Grandchild',
        'Grandchild': 'Grandparent',
        'Uncle': 'Nephew/Niece',
        'Aunt': 'Nephew/Niece',
        'Cousin': 'Cousin',
        'Friend': 'Friend',
        'Caregiver': 'Patient',
        'Patient': 'Caregiver'
    };
    return inverseMap[relationship] || relationship;
}

// Helper for CORS
const setCors = (res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
};

exports.sendRequest = onRequest(async (req, res) => {
    setCors(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { fromUid, fromEmail, toUid, toEmail, toName, relationship } = req.body;

        if (!fromUid || !fromEmail || (!toEmail && !toName) || !relationship) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }

        const db = admin.firestore();

        // 1. Check if already family in Firestore (preserving original logic)
        const fromNetworkSnap = await db.collection('familyNetworks').doc(fromUid).get();
        const fromMembers = fromNetworkSnap.exists ? fromNetworkSnap.data().members || [] : [];
        const alreadyFamily = fromMembers.some(member =>
            (member.email && member.email === toEmail) ||
            (member.uid && member.uid === toUid)
        );

        if (alreadyFamily) {
            return res.status(409).json({ success: false, error: 'Already in family network' });
        }

        // 2. Check for existing pending request in Firestore
        const existingReqs = await db.collection('familyRequests')
            .where('fromEmail', '==', fromEmail)
            .where('status', '==', 'pending')
            .get();

        const alreadyPending = existingReqs.docs.some(doc => {
            const data = doc.data();
            return data.toEmail === toEmail || data.toName === toName;
        });

        if (alreadyPending) {
            return res.status(409).json({ success: false, error: 'Request already pending' });
        }

        // 3. Create new request
        const newRequest = {
            id: uuidv4(),
            fromUid,
            fromEmail,
            toUid: toUid || null,
            toEmail,
            toName,
            relationship,
            status: 'pending',
            createdAt: new Date().toISOString()
        };

        await db.collection('familyRequests').doc(newRequest.id).set(newRequest);

        res.json({ success: true, request: newRequest });
    } catch (error) {
        console.error('sendRequest error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

exports.acceptRequest = onRequest(async (req, res) => {
    setCors(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { id } = req.params[0] ? { id: req.params[0] } : req.body; // Handle both path and body
        const reqId = id || req.query.id;

        const db = admin.firestore();
        const requestRef = db.collection('familyRequests').doc(reqId);
        const requestSnap = await requestRef.get();

        if (!requestSnap.exists) {
            return res.status(404).json({ success: false, error: 'Request not found' });
        }

        const request = requestSnap.data();
        if (request.status !== 'pending') {
            return res.status(400).json({ success: false, error: 'Request already processed' });
        }

        // Logic from server.js
        const fromMember = {
            uid: request.toUid,
            email: request.toEmail || null,
            name: mockUsers.find(u => u.email === request.toEmail)?.name || request.toName || null,
            relationship: request.relationship,
            status: 'accepted',
            addedAt: new Date().toISOString()
        };

        const toMember = {
            uid: request.fromUid,
            email: request.fromEmail,
            name: mockUsers.find(u => u.email === request.fromEmail)?.name || request.fromEmail,
            relationship: getInverseRelationship(request.relationship),
            status: 'accepted',
            addedAt: new Date().toISOString()
        };

        // Update both networks
        const batch = db.batch();
        batch.set(db.collection('familyNetworks').doc(request.fromUid), {
            members: admin.firestore.FieldValue.arrayUnion(fromMember),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        if (request.toUid) {
            batch.set(db.collection('familyNetworks').doc(request.toUid), {
                members: admin.firestore.FieldValue.arrayUnion(toMember),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        }

        // Update request status
        batch.update(requestRef, {
            status: 'accepted',
            respondedAt: new Date().toISOString()
        });

        await batch.commit();

        res.json({ success: true, message: 'Request accepted' });
    } catch (error) {
        console.error('acceptRequest error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

exports.rejectRequest = onRequest(async (req, res) => {
    setCors(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { id } = req.body;
        const reqId = id || req.query.id;

        if (!reqId) return res.status(400).json({ success: false, error: 'Request ID is required' });

        const db = admin.firestore();
        await db.collection('familyRequests').doc(reqId).update({
            status: 'rejected',
            respondedAt: new Date().toISOString()
        });

        res.json({ success: true, message: 'Request rejected' });
    } catch (error) {
        console.error('rejectRequest error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

exports.getNetwork = onRequest(async (req, res) => {
    setCors(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { uid } = req.query;
        if (!uid) return res.status(400).json({ success: false, error: 'UID is required' });

        const db = admin.firestore();
        const networkSnap = await db.collection('familyNetworks').doc(uid).get();

        if (!networkSnap.exists) {
            // Return empty network instead of error (matches browser fallback logic)
            return res.json({ success: true, network: { userUid: uid, members: [] } });
        }

        res.json({ success: true, network: { userUid: uid, ...networkSnap.data() } });
    } catch (error) {
        console.error('getNetwork error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

exports.getRequests = onRequest(async (req, res) => {
    setCors(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { email } = req.query;
        if (!email) return res.status(400).json({ success: false, error: 'Email is required' });

        const db = admin.firestore();

        const sentSnap = await db.collection('familyRequests')
            .where('fromEmail', '==', email)
            .get();

        const receivedSnap = await db.collection('familyRequests')
            .where('toEmail', '==', email)
            .where('status', '==', 'pending')
            .get();

        res.json({
            success: true,
            sent: sentSnap.docs.map(doc => doc.data()),
            received: receivedSnap.docs.map(doc => doc.data())
        });
    } catch (error) {
        console.error('getRequests error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

exports.updateRelationship = onRequest(async (req, res) => {
    setCors(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        // Handle both /request/:id/update-relationship (path) and body
        const { id } = req.params[0] ? { id: req.params[0] } : {};
        const requestId = id || req.body.requestId || req.query.requestId;
        const { newRelationship } = req.body;

        if (!requestId || !newRelationship) {
            return res.status(400).json({ success: false, error: 'Missing requestId or newRelationship' });
        }

        const db = admin.firestore();
        await db.collection('familyRequests').doc(requestId).update({
            relationship: newRelationship,
            updatedAt: new Date().toISOString()
        });

        res.json({ success: true, message: 'Relationship updated successfully' });
    } catch (error) {
        console.error('updateRelationship error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
