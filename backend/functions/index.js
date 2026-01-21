// Removed unused variables to fix lint errors
const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

// Removed unused variables to fix lint errors

// Trigger on new family request creation
exports.onFamilyRequestCreate = functions.firestore
  .document('familyRequests/{requestId}')
  .onCreate(async (snap, context) => {
    const request = snap.data();
    if (!request) return null;

    const notification = {
      recipientId: request.toEmail || request.toName,
      type: 'family_request',
      message: (request.fromEmail || 'Someone') + ' sent you a family request for relationship: ' + (request.relationship || ''),
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      read: false,
      relatedId: context.params.requestId,
    };

    try {
      await db.collection('notifications').add(notification);
      console.log('Notification created for family request:', context.params.requestId);
    } catch (error) {
      console.error('Error creating notification for family request:', error);
    }
    return null;
  });

// Trigger on new family chat message creation
const chatNotificationTimestamps = new Map();

exports.onFamilyChatCreate = functions.firestore
  .document('familyChats/{chatId}/messages/{messageId}')
  .onCreate(async (snap, context) => {
    const message = snap.data();
    if (!message) return null;

    const chatId = context.params.chatId;
    const messageId = context.params.messageId;

    const lastSenderId = message.lastSenderId;
    const participantInfo = message.participantInfo || {};

    // Rate limiting: allow notifications per chatId only once every 10 seconds
    const now = Date.now();
    const lastNotified = chatNotificationTimestamps.get(chatId) || 0;
    if (now - lastNotified < 10000) {
      console.log(`Skipping notifications for chat ${chatId} due to rate limiting.`);
      return null;
    }
    chatNotificationTimestamps.set(chatId, now);

    const notifications = [];

    for (const participantId in participantInfo) {
      if (participantId !== lastSenderId) {
        const participant = participantInfo[participantId];
        const recipientId = participant.email || participantId;

        const notification = {
          recipientId: recipientId,
          type: 'chat',
          message: 'New message from ' + (message.lastSenderId || 'a family member') + ': ' + (message.lastMessage || ''),
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          read: false,
          conversationId: chatId,
          relatedId: messageId,
        };

        notifications.push(notification);
      }
    }

    try {
      const batch = db.batch();
      notifications.forEach((notif) => {
        const docRef = db.collection('notifications').doc();
        batch.set(docRef, notif);
      });
      await batch.commit();
      console.log('Notifications created for family chat message:', messageId);
    } catch (error) {
      console.error('Error creating notifications for family chat message:', error);
    }
    return null;
  });
const analyzeReport = require('./analyzeReport');

exports.analyzeReport = analyzeReport.analyzeReport;
