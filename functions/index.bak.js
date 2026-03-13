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

const admin = require('firebase-admin');
if (admin.apps.length === 0) {
    admin.initializeApp();
}

const { analyzeReport } = require('./analyzeReport');
const { geminiChat } = require('./geminiChat');
const { chatbot } = require('./chatbot');
const { createUser, searchUsers, advancedSearch } = require('./userManagement');
const { sendRequest, acceptRequest, rejectRequest, getNetwork, getRequests, updateRelationship, cleanupDuplicates, migrateFamilyConnections } = require('./familyManagement');
const patientDoctor = require('./patientDoctor');
const prescriptions = require('./prescriptions');
const mlService = require('./mlService');
const doctorManagement = require('./doctorManagement');
const notificationService = require('./notifications');
const presenceService = require('./presence');
const otpFunctions = require('./otpFunctions');
const adminService = require('./adminService');

exports.analyzeReport = analyzeReport;
exports.geminiChat = geminiChat;
exports.chatbot = chatbot;
exports.createUser = createUser;
exports.searchUsers = searchUsers;
exports.advancedSearch = advancedSearch;
exports.sendFamilyRequest = sendRequest;
exports.acceptFamilyRequest = acceptRequest;
exports.rejectFamilyRequest = rejectRequest;
exports.getFamilyNetwork = getNetwork;
exports.getFamilyRequests = getRequests;
exports.updateRelationship = updateRelationship;
exports.cleanupFamilyDuplicates = cleanupDuplicates;
exports.migrateFamilyConnections = migrateFamilyConnections;

// Patient-Doctor functions
exports.sendPatientDoctorRequest = patientDoctor.sendConnectionRequest;
exports.getPendingPatientDoctorRequests = patientDoctor.getPendingRequests;
exports.acceptPatientDoctorRequest = patientDoctor.acceptRequest;
exports.rejectPatientDoctorRequest = patientDoctor.rejectRequest;
exports.getConnectedDoctors = patientDoctor.getConnectedDoctors;
exports.getConnectedPatients = patientDoctor.getConnectedPatients;
exports.updatePatientDoctorPermissions = patientDoctor.updatePermissions;
exports.terminatePatientDoctorRelationship = patientDoctor.terminateRelationship;
exports.searchPatientsForDoctor = patientDoctor.searchPatients;

// Prescription functions
exports.createPrescription = prescriptions.createPrescription;
exports.getDoctorPrescriptions = prescriptions.getDoctorPrescriptions;
exports.getPatientPrescriptions = prescriptions.getPatientPrescriptions;
exports.sendPrescription = prescriptions.sendPrescription;
exports.updatePrescriptionStatus = prescriptions.updatePrescriptionStatus;
exports.getPrescriptionDetails = prescriptions.getPrescriptionDetails;
exports.cancelPrescription = prescriptions.cancelPrescription;
exports.getPrescriptionTemplates = prescriptions.getPrescriptionTemplates;
exports.searchDrugs = prescriptions.searchDrugs;

// ML functions
exports.healthRiskAssessment = mlService.healthRiskAssessment;
exports.healthTrends = mlService.healthTrends;
exports.diseaseRisk = mlService.diseaseRisk;
exports.healthStats = mlService.healthStats;
exports.healthRecommendations = mlService.healthRecommendations;
exports.validateHealthData = mlService.validateHealthData;

// Doctor Management functions
exports.submitDoctorRegistration = doctorManagement.submitDoctorRegistration;
exports.getPendingDoctorRegistrations = doctorManagement.getPendingDoctorRegistrations;
exports.approveDoctorRegistration = doctorManagement.approveDoctorRegistration;
exports.rejectDoctorRegistration = doctorManagement.rejectDoctorRegistration;
exports.getAllDoctors = doctorManagement.getAllDoctors;
exports.updateDoctorProfile = doctorManagement.updateDoctorProfile;
exports.authenticateDoctor = doctorManagement.authenticateDoctor;
exports.getDoctorStatistics = doctorManagement.getDoctorStatistics;
exports.getAllPatients = doctorManagement.getAllPatients;

// Notifications functions
exports.getNotifications = notificationService.getNotifications;
exports.markNotificationRead = notificationService.markNotificationRead;
exports.markAllNotificationsRead = notificationService.markAllNotificationsRead;
exports.deleteNotification = notificationService.deleteNotification;
exports.createNotification = notificationService.createNotification;

// Presence functions
exports.updatePresence = presenceService.updatePresence;
exports.getBatchPresence = presenceService.getBatchPresence;

// OTP functions
exports.sendOTP = otpFunctions.sendOTP;
exports.verifyOTP = otpFunctions.verifyOTP;
exports.resendOTP = otpFunctions.resendOTP;


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

// Admin functions
exports.adminLogin = adminService.adminLogin;
exports.updateDoctorStatus = adminService.updateDoctorStatus;
exports.disableDoctor = adminService.disableDoctor;
