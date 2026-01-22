const { onRequest } = require("firebase-functions/v2/https");
const admin = require('firebase-admin');

const db = admin.firestore();

// Helper for CORS
const setCors = (res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
};

/**
 * Get notifications for a user
 */
exports.getNotifications = onRequest(async (req, res) => {
    setCors(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const userId = req.query.userId || req.body.userId;
        const limit = parseInt(req.query.limit) || 50;

        if (!userId) return res.status(400).json({ success: false, error: 'User ID is required' });

        const snapshot = await db.collection('notifications')
            .where('recipientId', '==', userId)
            .where('isDisabled', '==', false)
            .orderBy('createdAt', 'desc')
            .limit(limit)
            .get();

        const notifications = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            timestamp: doc.data().timestamp?.toDate?.() || doc.data().timestamp,
            createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt
        }));

        res.json({ success: true, notifications, total: notifications.length });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Mark notification as read
 */
exports.markNotificationRead = onRequest(async (req, res) => {
    setCors(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { notificationId } = req.body;
        if (!notificationId) return res.status(400).json({ success: false, error: 'Notification ID is required' });

        await db.collection('notifications').doc(notificationId).update({
            read: true,
            readAt: admin.firestore.FieldValue.serverTimestamp()
        });

        res.json({ success: true, message: 'Notification marked as read' });
    } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Mark all notifications as read for a user
 */
exports.markAllNotificationsRead = onRequest(async (req, res) => {
    setCors(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { userId } = req.body;
        if (!userId) return res.status(400).json({ success: false, error: 'User ID is required' });

        const snapshot = await db.collection('notifications')
            .where('recipientId', '==', userId)
            .where('read', '==', false)
            .where('isDisabled', '==', false)
            .get();

        const batch = db.batch();
        snapshot.forEach(doc => {
            batch.update(doc.ref, {
                read: true,
                readAt: admin.firestore.FieldValue.serverTimestamp()
            });
        });

        await batch.commit();

        res.json({ success: true, message: `Marked ${snapshot.size} notifications as read` });
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Delete notification (soft delete)
 */
exports.deleteNotification = onRequest(async (req, res) => {
    setCors(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { notificationId, userId } = req.body;
        if (!notificationId) return res.status(400).json({ success: false, error: 'Notification ID is required' });

        await db.collection('notifications').doc(notificationId).update({
            isDisabled: true,
            disabledAt: new Date().toISOString(),
            disabledBy: userId || 'user'
        });

        res.json({ success: true, message: 'Notification disabled' });
    } catch (error) {
        console.error('Error disabling notification:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Create notification (Helper)
 */
exports.createNotification = onRequest(async (req, res) => {
    setCors(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { recipientId, type, title, message, data = {}, priority = 'normal' } = req.body;
        if (!recipientId || !type || !title || !message) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }

        const notification = {
            recipientId,
            type,
            title,
            message,
            data,
            priority,
            read: false,
            isDisabled: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        };

        const docRef = await db.collection('notifications').add(notification);

        res.json({ success: true, notificationId: docRef.id });
    } catch (error) {
        console.error('Error creating notification:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
