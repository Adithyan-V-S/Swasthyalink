// Mock notification service for development/testing
export const NOTIFICATION_TYPES = {
  CHAT_MESSAGE: 'chat_message',
  FAMILY_REQUEST: 'family_request',
  FAMILY_REQUEST_ACCEPTED: 'family_request_accepted',
  FAMILY_REQUEST_REJECTED: 'family_request_rejected',
  EMERGENCY_ALERT: 'emergency_alert',
  HEALTH_RECORD: 'health_record',
  HEALTH_RECORD_SHARED: 'health_record_shared',
  APPOINTMENT: 'appointment',
  APPOINTMENT_REMINDER: 'appointment_reminder',
  MEDICATION_REMINDER: 'medication_reminder',
  SYSTEM_ALERT: 'system_alert',
  DOCTOR_CONNECTION_REQUEST: 'doctor_connection_request'
};

// Mock notifications data
const mockNotifications = [
  {
    id: 'notif-1',
    type: NOTIFICATION_TYPES.CHAT_MESSAGE,
    title: 'New Message',
    message: 'Adithyan V.s sent you a message: "Hey! How are you doing?"',
    recipientId: 'current-user-id',
    senderId: 'adithyan-user-id',
    senderName: 'Adithyan V.s',
    read: false,
    timestamp: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
    conversationId: 'conv-adithyan',
    data: {
      conversationId: 'conv-adithyan',
      messagePreview: 'Hey! How are you doing?'
    }
  },
  {
    id: 'notif-2',
    type: NOTIFICATION_TYPES.CHAT_MESSAGE,
    title: 'New Message',
    message: 'Adithyan V.s sent you a message: "Are you free for a call?"',
    recipientId: 'current-user-id',
    senderId: 'adithyan-user-id',
    senderName: 'Adithyan V.s',
    read: false,
    timestamp: new Date(Date.now() - 10 * 60 * 1000), // 10 minutes ago
    conversationId: 'conv-adithyan',
    data: {
      conversationId: 'conv-adithyan',
      messagePreview: 'Are you free for a call?'
    }
  },
  {
    id: 'notif-3',
    type: NOTIFICATION_TYPES.FAMILY_REQUEST,
    title: 'Family Request',
    message: 'John Doe wants to join your family network as your son',
    recipientId: 'current-user-id',
    senderId: 'john-user-id',
    senderName: 'John Doe',
    read: false,
    timestamp: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
    data: {
      relationship: 'son',
      requestId: 'req-john-123'
    }
  },
  {
    id: 'notif-4',
    type: NOTIFICATION_TYPES.EMERGENCY_ALERT,
    title: 'Emergency Alert',
    message: 'Emergency contact Sarah needs immediate assistance!',
    recipientId: 'current-user-id',
    senderId: 'sarah-user-id',
    senderName: 'Sarah Emergency Contact',
    read: false,
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    data: {
      emergencyType: 'medical',
      location: 'Home',
      priority: 'high'
    }
  },
  {
    id: 'notif-5',
    type: NOTIFICATION_TYPES.HEALTH_RECORD,
    title: 'Health Record Shared',
    message: 'Dr. Smith shared your lab results',
    recipientId: 'current-user-id',
    senderId: 'dr-smith-id',
    senderName: 'Dr. Smith',
    read: true,
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
    data: {
      recordType: 'lab_results',
      recordId: 'lab-123'
    }
  }
];

// Mock conversations data
const mockConversations = [
  {
    id: 'conv-adithyan',
    participants: ['test-user-123', 'adithyan-user-id'],
    participantInfo: {
      'test-user-123': {
        name: 'Test User',
        email: 'test@swasthyalink.com'
      },
      'adithyan-user-id': {
        name: 'Adithyan V.s',
        email: 'adithyan@example.com'
      }
    },
    lastMessage: 'Are you free for a call?',
    lastMessageTime: new Date(Date.now() - 10 * 60 * 1000),
    lastSenderId: 'adithyan-user-id',
    unread: {
      'test-user-123': 5, // 5 unread messages for current user
      'adithyan-user-id': 0
    },
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 10 * 60 * 1000)
  }
];

// Mock messages data
const mockMessages = [
  {
    id: 'msg-1',
    conversationId: 'conv-adithyan',
    senderId: 'adithyan-user-id',
    senderName: 'Adithyan V.s',
    text: 'Hey! How are you doing?',
    timestamp: new Date(Date.now() - 15 * 60 * 1000),
    read: false
  },
  {
    id: 'msg-2',
    conversationId: 'conv-adithyan',
    senderId: 'adithyan-user-id',
    senderName: 'Adithyan V.s',
    text: 'I wanted to check in on you',
    timestamp: new Date(Date.now() - 12 * 60 * 1000),
    read: false
  },
  {
    id: 'msg-3',
    conversationId: 'conv-adithyan',
    senderId: 'adithyan-user-id',
    senderName: 'Adithyan V.s',
    text: 'Are you free for a call?',
    timestamp: new Date(Date.now() - 10 * 60 * 1000),
    read: false
  },
  {
    id: 'msg-4',
    conversationId: 'conv-adithyan',
    senderId: 'adithyan-user-id',
    senderName: 'Adithyan V.s',
    text: 'Let me know when you have time',
    timestamp: new Date(Date.now() - 8 * 60 * 1000),
    read: false
  },
  {
    id: 'msg-5',
    conversationId: 'conv-adithyan',
    senderId: 'adithyan-user-id',
    senderName: 'Adithyan V.s',
    text: 'Hope everything is going well!',
    timestamp: new Date(Date.now() - 5 * 60 * 1000),
    read: false
  }
];

// Keep track of active subscriptions
let subscribers = [];

// Helper to notify all subscribers when data changes
const notifySubscribers = () => {
  subscribers.forEach(({ userId, callback }) => {
    // In a real app, this would be a filtered Firestore query
    const userNotifications = mockNotifications.filter(n =>
      n.recipientId === userId || n.recipientId === 'current-user-id'
    );
    callback([...userNotifications]);
  });
};

// Mock subscription function for notifications
export const subscribeToNotifications = (userId, callback) => {
  // Add to active subscribers
  const sub = { userId, callback };
  subscribers.push(sub);

  // Initial load
  const userNotifications = mockNotifications.filter(n =>
    n.recipientId === userId || n.recipientId === 'current-user-id'
  );

  // Simulate network delay for initial load
  setTimeout(() => {
    callback([...userNotifications]);
  }, 100);

  // Return unsubscribe function
  return () => {
    subscribers = subscribers.filter(s => s !== sub);
  };
};

// Mock subscription function for conversations
export const subscribeToConversations = (userId, callback) => {
  console.log('💬 Mock: Subscribing to conversations for user:', userId);

  // Filter conversations for the user
  const userConversations = mockConversations.filter(c =>
    c.participants.includes(userId)
  );

  // Simulate real-time updates
  setTimeout(() => {
    console.log(`💬 Mock: Loaded ${userConversations.length} conversations`);
    callback(userConversations);
  }, 500);

  // Return unsubscribe function
  return () => {
    console.log('💬 Mock: Unsubscribed from conversations');
  };
};

// Mock subscription function for messages
export const subscribeToMessages = (conversationId, callback) => {
  console.log('💬 Mock: Subscribing to messages for conversation:', conversationId);

  // Filter messages for the conversation
  const conversationMessages = mockMessages.filter(m => m.conversationId === conversationId);

  // Simulate real-time updates
  setTimeout(() => {
    console.log(`💬 Mock: Loaded ${conversationMessages.length} messages`);
    callback(conversationMessages);
  }, 300);

  // Return unsubscribe function
  return () => {
    console.log('💬 Mock: Unsubscribed from messages');
  };
};

// Mock notification creation functions
export const createNotification = async (notificationData) => {
  console.log('📝 Mock: Creating notification', notificationData);

  const newNotification = {
    id: `notif-${Date.now()}`,
    read: false,
    timestamp: new Date(),
    createdAt: new Date(), // Added for compatibility with components using createdAt
    ...notificationData
  };

  console.log('   └─ New Notification ID:', newNotification.id, 'Recipient:', newNotification.recipientId);
  mockNotifications.unshift(newNotification);

  // Notify UI
  notifySubscribers();

  return { success: true, notificationId: newNotification.id };
};

export const createChatMessageNotification = async (recipientId, sender, message, conversationId) => {
  console.log('📝 Mock: Creating chat notification');

  const newNotification = {
    id: `notif-${Date.now()}`,
    type: NOTIFICATION_TYPES.CHAT_MESSAGE,
    title: 'New Message',
    message: `${sender.name} sent you a message: "${message}"`,
    recipientId,
    senderId: sender.uid,
    senderName: sender.name,
    read: false,
    timestamp: new Date(),
    conversationId,
    data: {
      conversationId,
      messagePreview: message
    }
  };

  // Add to mock data
  mockNotifications.unshift(newNotification);

  // Notify UI
  notifySubscribers();

  return { success: true, notificationId: newNotification.id };
};

export const createFamilyRequestNotification = async (recipientId, requester, relationship) => {
  console.log('👨‍👩‍👧‍👦 Mock: Creating family request notification');

  const newNotification = {
    id: `notif-${Date.now()}`,
    type: NOTIFICATION_TYPES.FAMILY_REQUEST,
    title: 'Family Request',
    message: `${requester.name} wants to join your family network as your ${relationship}`,
    recipientId,
    senderId: requester.uid,
    senderName: requester.name,
    read: false,
    timestamp: new Date(),
    data: {
      relationship,
      requestId: `req-${Date.now()}`
    }
  };

  mockNotifications.unshift(newNotification);

  // Notify UI
  notifySubscribers();

  return { success: true, notificationId: newNotification.id };
};

export const createFamilyRequestAcceptedNotification = async (recipientId, accepter) => {
  console.log('👨‍👩‍👧‍👦 Mock: Creating family request accepted notification');

  const newNotification = {
    id: `notif-${Date.now()}`,
    type: NOTIFICATION_TYPES.FAMILY_REQUEST_ACCEPTED,
    title: 'Family Request Accepted',
    message: `${accepter.name} accepted your family request`,
    recipientId,
    senderId: accepter.uid,
    senderName: accepter.name,
    read: false,
    timestamp: new Date()
  };

  mockNotifications.unshift(newNotification);
  notifySubscribers();

  return { success: true, notificationId: newNotification.id };
};

export const createFamilyRequestRejectedNotification = async (recipientId, rejecter) => {
  console.log('👨‍👩‍👧‍👦 Mock: Creating family request rejected notification');

  const newNotification = {
    id: `notif-${Date.now()}`,
    type: NOTIFICATION_TYPES.FAMILY_REQUEST_REJECTED,
    title: 'Family Request Declined',
    message: `${rejecter.name} declined your family request`,
    recipientId,
    senderId: rejecter.uid,
    senderName: rejecter.name,
    read: false,
    timestamp: new Date()
  };

  mockNotifications.unshift(newNotification);
  notifySubscribers();

  return { success: true, notificationId: newNotification.id };
};

export const createEmergencyAlertNotification = async (recipientId, sender, message) => {
  console.log('🚨 Mock: Creating emergency notification');

  const newNotification = {
    id: `notif-${Date.now()}`,
    type: NOTIFICATION_TYPES.EMERGENCY_ALERT,
    title: 'Emergency Alert',
    message: `${sender.name}: ${message}`,
    recipientId,
    senderId: sender.uid,
    senderName: sender.name,
    read: false,
    timestamp: new Date(),
    data: {
      emergencyType: 'general',
      priority: 'high'
    }
  };

  mockNotifications.unshift(newNotification);

  // Notify UI
  notifySubscribers();

  return { success: true, notificationId: newNotification.id };
};

// Mock utility functions
export const markNotificationAsRead = async (notificationId) => {
  console.log('✅ Mock: Marking notification as read:', notificationId);

  const notification = mockNotifications.find(n => n.id === notificationId);
  if (notification) {
    notification.read = true;
    notification.readAt = new Date();

    // Notify UI
    notifySubscribers();
  }

  return { success: true };
};

export const markAllNotificationsAsRead = async (userId) => {
  console.log('✅ Mock: Marking all notifications as read for user:', userId);

  mockNotifications.forEach(n => {
    if (n.recipientId === userId || n.recipientId === 'current-user-id') {
      n.read = true;
      n.readAt = new Date();
    }
  });

  // Notify UI
  notifySubscribers();

  return { success: true };
};

export const deleteNotification = async (notificationId) => {
  console.log('🗑️ Mock: Deleting notification:', notificationId);

  const index = mockNotifications.findIndex(n => n.id === notificationId);
  if (index > - 1) {
    mockNotifications.splice(index, 1);

    // Notify UI
    notifySubscribers();
  }

  return { success: true };
};

// Utility functions
export const getNotificationIcon = (type) => {
  switch (type) {
    case NOTIFICATION_TYPES.CHAT_MESSAGE:
      return 'chat';
    case NOTIFICATION_TYPES.FAMILY_REQUEST:
      return 'group_add';
    case NOTIFICATION_TYPES.EMERGENCY_ALERT:
      return 'emergency';
    case NOTIFICATION_TYPES.HEALTH_RECORD:
      return 'medical_services';
    case NOTIFICATION_TYPES.APPOINTMENT:
      return 'event';
    default:
      return 'notifications';
  }
};

export const getNotificationColor = (type) => {
  switch (type) {
    case NOTIFICATION_TYPES.CHAT_MESSAGE:
      return 'text-blue-600';
    case NOTIFICATION_TYPES.FAMILY_REQUEST:
      return 'text-green-600';
    case NOTIFICATION_TYPES.EMERGENCY_ALERT:
      return 'text-red-600';
    case NOTIFICATION_TYPES.HEALTH_RECORD:
      return 'text-purple-600';
    case NOTIFICATION_TYPES.APPOINTMENT:
      return 'text-orange-600';
    default:
      return 'text-gray-600';
  }
};

export const formatNotificationTime = (timestamp) => {
  if (!timestamp) return '';

  const now = new Date();
  const time = new Date(timestamp);
  const diffInMinutes = Math.floor((now - time) / (1000 * 60));

  if (diffInMinutes < 1) return 'Just now';
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `${diffInDays}d ago`;

  return time.toLocaleDateString();
};
