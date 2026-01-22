import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  updateDoc,
  doc,
  serverTimestamp,
  writeBatch,
  getDocs
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { db } from '../firebaseConfig';

const REGION = 'us-central1';
const PROJECT_ID = 'swasthyalink-42535';
const CLOUD_FUNCTIONS_BASE = `https://${REGION}-${PROJECT_ID}.cloudfunctions.net`;

// Notification types
export const NOTIFICATION_TYPES = {
  FAMILY_REQUEST: 'family_request',
  FAMILY_REQUEST_ACCEPTED: 'family_request_accepted',
  FAMILY_REQUEST_REJECTED: 'family_request_rejected',
  CHAT_MESSAGE: 'chat_message',
  EMERGENCY_ALERT: 'emergency_alert',
  HEALTH_RECORD_SHARED: 'health_record_shared',
  APPOINTMENT_REMINDER: 'appointment_reminder',
  MEDICATION_REMINDER: 'medication_reminder',
  SYSTEM_ALERT: 'system_alert',
  DOCTOR_CONNECTION_REQUEST: 'doctor_connection_request',
  CONNECTION_ACCEPTED: 'connection_accepted',
  PRESCRIPTION_RECEIVED: 'prescription_received'
};

// Create a new notification (Firestore write)
export const createNotification = async (notifData) => {
  try {
    const auth = getAuth();
    const token = auth.currentUser ? await auth.currentUser.getIdToken() : '';

    const response = await fetch(`${CLOUD_FUNCTIONS_BASE}/createNotification`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(notifData)
    });

    if (!response.ok) throw new Error('Failed to create notification');
    return await response.json();
  } catch (error) {
    console.error('Error creating notification:', error);
    return { success: false, error: error.message };
  }
};

// Cache for notifications to reduce Firebase calls
const notificationCache = new Map();
const CACHE_DURATION = 30000; // 30 seconds

// Firebase quota management - Normal mode
const QUOTA_LIMITS = {
  DAILY_READS: 1000, // Allow reasonable reads
  DAILY_WRITES: 100, // Allow reasonable writes
  DAILY_DELETES: 50 // Allow reasonable deletes
};

const quotaUsage = {
  reads: 0,
  writes: 0,
  deletes: 0,
  lastReset: new Date().toDateString()
};

// Reset quota usage daily
const resetQuotaIfNeeded = () => {
  const today = new Date().toDateString();
  if (quotaUsage.lastReset !== today) {
    quotaUsage.reads = 0;
    quotaUsage.writes = 0;
    quotaUsage.deletes = 0;
    quotaUsage.lastReset = today;
  }
};

// Check if quota is exceeded
const checkQuota = (operation) => {
  resetQuotaIfNeeded();

  switch (operation) {
    case 'read':
      return quotaUsage.reads < QUOTA_LIMITS.DAILY_READS;
    case 'write':
      return quotaUsage.writes < QUOTA_LIMITS.DAILY_WRITES;
    case 'delete':
      return quotaUsage.deletes < QUOTA_LIMITS.DAILY_DELETES;
    default:
      return true;
  }
};

// Increment quota usage
const incrementQuota = (operation) => {
  resetQuotaIfNeeded();

  switch (operation) {
    case 'read':
      quotaUsage.reads++;
      break;
    case 'write':
      quotaUsage.writes++;
      break;
    case 'delete':
      quotaUsage.deletes++;
      break;
  }
};

// Get quota status
export const getQuotaStatus = () => {
  resetQuotaIfNeeded();
  return {
    reads: { used: quotaUsage.reads, limit: QUOTA_LIMITS.DAILY_READS, remaining: QUOTA_LIMITS.DAILY_READS - quotaUsage.reads },
    writes: { used: quotaUsage.writes, limit: QUOTA_LIMITS.DAILY_WRITES, remaining: QUOTA_LIMITS.DAILY_WRITES - quotaUsage.writes },
    deletes: { used: quotaUsage.deletes, limit: QUOTA_LIMITS.DAILY_DELETES, remaining: QUOTA_LIMITS.DAILY_DELETES - quotaUsage.deletes }
  };
};

// Local storage cache for persistence across page reloads
const getFromLocalStorage = (key) => {
  try {
    const item = localStorage.getItem(key);
    if (!item) return null;
    const parsed = JSON.parse(item);
    if (Date.now() - parsed.timestamp > CACHE_DURATION) {
      localStorage.removeItem(key);
      return null;
    }
    return parsed.data;
  } catch (error) {
    console.warn('Error reading from localStorage:', error);
    return null;
  }
};

const setToLocalStorage = (key, data) => {
  try {
    localStorage.setItem(key, JSON.stringify({
      data,
      timestamp: Date.now()
    }));
  } catch (error) {
    console.warn('Error writing to localStorage:', error);
  }
};

// Subscribe to user's notifications (real-time)
export const subscribeToNotifications = (userId, callback) => {
  if (!userId) return null;

  // Check if this is a test user (mock authentication)
  const isTestUser = localStorage.getItem('testUser') !== null;

  if (isTestUser) {
    console.log('🧪 Using test user - fetching notifications from backend');

    // Fetch notifications from backend for test users
    const fetchNotifications = async () => {
      try {
        const auth = getAuth();
        const currentUser = auth.currentUser;

        if (!currentUser) {
          console.log('No authenticated user for notifications');
          callback([]);
          return;
        }

        let token;
        try {
          token = await currentUser.getIdToken();
        } catch (error) {
          console.log('Firebase auth failed, using test token for notifications:', error.message);
          token = 'test-doctor-token'; // Fallback for production
        }

        const REGION = 'us-central1';
        const PROJECT_ID = 'swasthyalink-42535';
        const CLOUD_FUNCTIONS_BASE = `https://${REGION}-${PROJECT_ID}.cloudfunctions.net`;

        const response = await fetch(`${CLOUD_FUNCTIONS_BASE}/getNotifications?userId=${currentUser.uid}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          console.log('✅ Notifications fetched from backend:', data);
          callback(data.notifications || []);
        } else {
          console.error('Failed to fetch notifications:', response.status);
          callback([]);
        }
      } catch (error) {
        console.error('Error fetching notifications:', error);
        callback([]);
      }
    };

    // Track last shown notification IDs to avoid repeat alerts
    const SHOWN_KEY = `shownNotificationIds_${userId}`;
    const getShown = () => new Set(JSON.parse(localStorage.getItem(SHOWN_KEY) || '[]'));
    const setShown = (set) => localStorage.setItem(SHOWN_KEY, JSON.stringify(Array.from(set)));

    // Wrap fetch to record IDs
    const fetchAndRecord = async () => {
      await fetchNotifications();
    };

    // Fetch immediately
    fetchAndRecord();

    // Reduce polling frequency to lower noise
    const interval = setInterval(fetchAndRecord, 15000); // every 15s

    return () => clearInterval(interval);
  }

  // Check quota before subscribing
  if (!checkQuota('read')) {
    console.log('⚠️ Firebase read quota exceeded, using local storage fallback');
    // Use local storage fallback
    const localNotifications = JSON.parse(localStorage.getItem('localNotifications') || '[]')
      .filter(notif => notif.recipientId === userId && !notif.deleted)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    callback(localNotifications);

    // Set up interval to check for new local notifications
    const interval = setInterval(() => {
      const updatedNotifications = JSON.parse(localStorage.getItem('localNotifications') || '[]')
        .filter(notif => notif.recipientId === userId && !notif.deleted)
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      callback(updatedNotifications);
    }, 15000); // every 15s

    return () => clearInterval(interval);
  }

  incrementQuota('read');
  const q = query(
    collection(db, 'notifications'),
    where('recipientId', '==', userId),
    orderBy('timestamp', 'desc')
  );

  const unsubscribe = onSnapshot(q, (snapshot) => {
    const notifs = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));

    // Also include local notifications
    const localNotifications = JSON.parse(localStorage.getItem('localNotifications') || '[]')
      .filter(notif => notif.recipientId === userId && !notif.deleted);

    // Merge and sort all notifications
    const allNotifications = [...notifs, ...localNotifications]
      .sort((a, b) => {
        const timeA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp);
        const timeB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp);
        return timeB - timeA;
      });

    callback(allNotifications);
  }, (error) => {
    console.error('subscribeToNotifications error:', error);
    // Fallback to local storage on error
    const localNotifications = JSON.parse(localStorage.getItem('localNotifications') || '[]')
      .filter(notif => notif.recipientId === userId && !notif.deleted)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    callback(localNotifications);
  });

  return unsubscribe;
};

// Mark notification as read
export const markNotificationAsRead = async (notificationId) => {
  try {
    const auth = getAuth();
    const token = auth.currentUser ? await auth.currentUser.getIdToken() : '';

    const response = await fetch(`${CLOUD_FUNCTIONS_BASE}/markNotificationRead`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ notificationId })
    });

    if (!response.ok) throw new Error('Failed to mark notification as read');
    return await response.json();
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return { success: false, error: error.message };
  }
};

// Mark all notifications as read for a user
export const markAllNotificationsAsRead = async (userId) => {
  try {
    const auth = getAuth();
    const token = auth.currentUser ? await auth.currentUser.getIdToken() : '';

    const response = await fetch(`${CLOUD_FUNCTIONS_BASE}/markAllNotificationsRead`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ userId })
    });

    if (!response.ok) throw new Error('Failed to mark all notifications as read');
    return await response.json();
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    return { success: false, error: error.message };
  }
};

export const deleteNotification = async (notificationId) => {
  try {
    const auth = getAuth();
    const token = auth.currentUser ? await auth.currentUser.getIdToken() : '';
    const userId = auth.currentUser ? auth.currentUser.uid : 'user';

    const response = await fetch(`${CLOUD_FUNCTIONS_BASE}/deleteNotification`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ notificationId, userId })
    });

    if (!response.ok) throw new Error('Failed to delete notification');
    return await response.json();
  } catch (error) {
    console.error('Error deleting notification:', error);
    return { success: false, error: error.message };
  }
};

export const getUnreadNotificationCount = async (userId) => {
  try {
    const auth = getAuth();
    const token = auth.currentUser ? await auth.currentUser.getIdToken() : '';

    const response = await fetch(`${CLOUD_FUNCTIONS_BASE}/getNotifications?userId=${userId}&limit=1`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) throw new Error('Failed to get unread count');
    const data = await response.json();
    // Simplified: our CF returns notifications and total. Filter read in CF or just use this.
    return { success: true, count: data.notifications?.filter(n => !n.read).length || 0 };
  } catch (error) {
    console.error('Error getting unread count:', error);
    return { success: false, error: error.message, count: 0 };
  }
};

// Create family request notification
export const createFamilyRequestNotification = async (recipientId, senderInfo, relationship) => {
  return createNotification({
    recipientId,
    senderId: senderInfo.uid,
    type: NOTIFICATION_TYPES.FAMILY_REQUEST,
    title: 'New Family Request',
    message: `${senderInfo.name || senderInfo.email} wants to add you as their ${relationship}`,
    data: {
      senderInfo,
      relationship,
      actionRequired: true
    },
    priority: 'high'
  });
};

// Create family request accepted notification
export const createFamilyRequestAcceptedNotification = async (recipientId, accepterInfo, relationship) => {
  return createNotification({
    recipientId,
    senderId: accepterInfo.uid,
    type: NOTIFICATION_TYPES.FAMILY_REQUEST_ACCEPTED,
    title: 'Family Request Accepted',
    message: `${accepterInfo.name || accepterInfo.email} accepted your family request`,
    data: {
      accepterInfo,
      relationship
    },
    priority: 'normal'
  });
};

// Create chat message notification
export const createChatMessageNotification = async (recipientId, payload) => {
  // payload: { text, fromUid, conversationId, fromName? }
  if (!recipientId || !payload?.fromUid) {
    console.error('❌ Invalid parameters for chat notification:', { recipientId, payload });
    return { success: false, error: 'Invalid parameters' };
  }
  const title = `New message`;
  const message = payload.text?.slice(0, 140) || '';
  return createNotification({
    recipientId,
    senderId: payload.fromUid,
    type: NOTIFICATION_TYPES.CHAT_MESSAGE,
    title,
    message,
    data: {
      conversationId: payload.conversationId,
      messagePreview: message,
    },
    priority: 'normal'
  });
};



// Create family request rejected notification
export const createFamilyRequestRejectedNotification = async (recipientId, senderInfo, relationship) => {
  return createNotification({
    recipientId,
    senderId: senderInfo.uid,
    type: NOTIFICATION_TYPES.FAMILY_REQUEST_REJECTED,
    title: '❌ Family Request Declined',
    message: `${senderInfo.name || senderInfo.email} declined your family request`,
    data: {
      senderInfo,
      relationship,
      actionRequired: false
    },
    priority: 'normal'
  });
};

// Create emergency alert notification
export const createEmergencyAlertNotification = async (recipientId, senderInfo, alertMessage) => {
  return createNotification({
    recipientId,
    senderId: senderInfo.uid,
    type: NOTIFICATION_TYPES.EMERGENCY_ALERT,
    title: '🚨 Emergency Alert',
    message: alertMessage,
    data: {
      senderInfo,
      isEmergency: true
    },
    priority: 'urgent'
  });
};

// Get notification icon based on type
export const getNotificationIcon = (type) => {
  switch (type) {
    case NOTIFICATION_TYPES.FAMILY_REQUEST:
      return 'person_add';
    case NOTIFICATION_TYPES.FAMILY_REQUEST_ACCEPTED:
      return 'check_circle';
    case NOTIFICATION_TYPES.FAMILY_REQUEST_REJECTED:
      return 'cancel';
    case NOTIFICATION_TYPES.CHAT_MESSAGE:
      return 'chat';
    case NOTIFICATION_TYPES.EMERGENCY_ALERT:
      return 'emergency';
    case NOTIFICATION_TYPES.HEALTH_RECORD_SHARED:
      return 'health_and_safety';
    case NOTIFICATION_TYPES.APPOINTMENT_REMINDER:
      return 'event';
    case NOTIFICATION_TYPES.MEDICATION_REMINDER:
      return 'medication';
    case NOTIFICATION_TYPES.SYSTEM_ALERT:
      return 'info';
    case NOTIFICATION_TYPES.DOCTOR_CONNECTION_REQUEST:
      return 'medical_services';
    case NOTIFICATION_TYPES.CONNECTION_ACCEPTED:
      return 'check_circle';
    case NOTIFICATION_TYPES.PRESCRIPTION_RECEIVED:
      return 'medication';
    default:
      return 'notifications';
  }
};

// Get notification color based on priority
export const getNotificationColor = (priority) => {
  switch (priority) {
    case 'urgent':
      return 'text-red-600 bg-red-50 border-red-200';
    case 'high':
      return 'text-orange-600 bg-orange-50 border-orange-200';
    case 'normal':
      return 'text-blue-600 bg-blue-50 border-blue-200';
    case 'low':
      return 'text-gray-600 bg-gray-50 border-gray-200';
    default:
      return 'text-blue-600 bg-blue-50 border-blue-200';
  }
};

// Format notification time with detailed date and time
export const formatNotificationTime = (timestamp) => {
  if (!timestamp) return 'Just now';

  try {
    const now = new Date();
    let notificationTime;

    if (timestamp instanceof Date) {
      notificationTime = timestamp;
    } else if (typeof timestamp === 'string' || typeof timestamp === 'number') {
      notificationTime = new Date(timestamp);
    } else if (timestamp && typeof timestamp === 'object' && timestamp.toDate) {
      // Handle Firestore timestamp
      notificationTime = timestamp.toDate();
    } else {
      return 'Just now';
    }

    // Check if the date is valid
    if (isNaN(notificationTime.getTime())) {
      return 'Just now';
    }

    const diffInMinutes = Math.floor((now - notificationTime) / (1000 * 60));
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInMinutes / 1440);

    // For very recent notifications (less than 1 minute)
    if (diffInMinutes < 1) return 'Just now';

    // For recent notifications (less than 1 hour)
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;

    // For today's notifications (less than 24 hours)
    if (diffInMinutes < 1440) {
      const timeString = notificationTime.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
      return `Today at ${timeString}`;
    }

    // For yesterday's notifications
    if (diffInDays === 1) {
      const timeString = notificationTime.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
      return `Yesterday at ${timeString}`;
    }

    // For older notifications (less than 7 days)
    if (diffInDays < 7) {
      const timeString = notificationTime.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
      const dayName = notificationTime.toLocaleDateString('en-US', { weekday: 'short' });
      return `${dayName} at ${timeString}`;
    }

    // For very old notifications (more than 7 days)
    const dateString = notificationTime.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: notificationTime.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
    const timeString = notificationTime.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    return `${dateString} at ${timeString}`;
  } catch (error) {
    console.warn('Error formatting notification time:', error);
    return 'Just now';
  }
};