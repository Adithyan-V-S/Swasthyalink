/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const { setGlobalOptions } = require("firebase-functions");
const { onRequest } = require("firebase-functions/v2/https");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const logger = require("firebase-functions/logger");

// For cost control, you can set the maximum number of containers that can be
// running at the same time. This helps mitigate the impact of unexpected
// traffic spikes by instead downgrading performance. This limit is a
// per-function limit. You can override the limit for each function using the
// `maxInstances` option in the function's options, e.g.
// `onRequest({ maxInstances: 5 }, (req, res) => { ... })`.
// NOTE: setGlobalOptions does not apply to functions using the v1 API. V1
// functions should each use functions.runWith({ maxInstances: 10 }) instead.
// In the v1 API, each function can only serve one request per container, so
// this will be the maximum concurrent request count.
setGlobalOptions({ maxInstances: 10 });

const { analyzeReport } = require('./analyzeReport');
const { geminiChat } = require('./geminiChat');
const { chatbot } = require('./chatbot');
const { searchUsers, advancedSearch } = require('./userManagement');
const { sendRequest, acceptRequest, rejectRequest, getNetwork, getRequests, updateRelationship } = require('./familyManagement');

exports.analyzeReport = analyzeReport;
exports.geminiChat = geminiChat;
exports.chatbot = chatbot;
exports.searchUsers = searchUsers;
exports.advancedSearch = advancedSearch;
exports.sendFamilyRequest = sendRequest;
exports.acceptFamilyRequest = acceptRequest;
exports.rejectFamilyRequest = rejectRequest;
exports.getFamilyNetwork = getNetwork;
exports.getFamilyRequests = getRequests;
exports.updateRelationship = updateRelationship;

const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

exports.onFamilyRequestCreate = onDocumentCreated('familyRequests/{requestId}', async (event) => {
    const request = event.data.data();
    if (!request) return null;

    const notification = {
        recipientId: request.toEmail || request.toName,
        type: 'family_request',
        message: (request.fromEmail || 'Someone') + ' sent you a family request for relationship: ' + (request.relationship || ''),
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        read: false,
        relatedId: event.params.requestId,
    };

    try {
        await db.collection('notifications').add(notification);
        console.log('Notification created for family request:', event.params.requestId);
    } catch (error) {
        console.error('Error creating notification for family request:', error);
    }
    return null;
});

// Add other triggers if needed...
