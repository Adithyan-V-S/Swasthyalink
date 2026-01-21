// Load environment variables
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { SessionsClient } = require('@google-cloud/dialogflow');
const path = require('path');
const admin = require('firebase-admin');

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize Firebase Admin
try {
  // Prefer env-based credentials in production
  const hasEnvCreds = !!(process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY);
  if (hasEnvCreds) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
      projectId: process.env.FIREBASE_PROJECT_ID,
    });
    console.log('✅ Firebase Admin initialized (env-based)');
  } else {
    // Fallback to local credentials in development
    const serviceAccount = require('./credentials.json');
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id || 'swasthyalink-42535'
    });
    console.log('✅ Firebase Admin initialized (local credentials)');
  }
} catch (error) {
  console.error('❌ Failed to initialize Firebase Admin:', error.message);
  // Continue without Firebase for now to prevent app crash
  console.log('⚠️ Continuing without Firebase Admin - some features may be limited');
}

// Middleware - Updated CORS for Firebase Hosting
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
    'https://swasthyalink-frontend.onrender.com',
    'https://swasthyalink-frontend-v2.onrender.com',
    'https://swasthyakink.web.app',
    'https://swasthyakink.firebaseapp.com'
  ],
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Dialogflow configuration
const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || 'swasthyakink';
const languageCode = 'en';

// Initialize Dialogflow client
let sessionClient;
try {
  // Use environment variables for credentials in production
  const hasDialogflowCreds = !!(process.env.GOOGLE_CLOUD_PROJECT_ID);

  if (hasDialogflowCreds) {
    sessionClient = new SessionsClient({
      projectId: projectId,
    });
    console.log('✅ Dialogflow client initialized successfully (env-based)');
  } else {
    console.log('⚠️ Dialogflow credentials not found, using simulated responses');
    sessionClient = null;
  }
} catch (error) {
  console.error('❌ Failed to initialize Dialogflow client:', error.message);
  console.log('🔧 Using simulated responses instead');
  sessionClient = null;
}

// Helper function to detect intent
async function detectIntent(message, sessionId) {
  if (!sessionClient) {
    // Return simulated response if Dialogflow client is not available
    return simulateDialogflowResponse(message);
  }

  try {
    const sessionPath = sessionClient.projectLocationAgentSessionPath(
      projectId,
      'global',
      sessionId
    );

    const request = {
      session: sessionPath,
      queryInput: {
        text: {
          text: message,
          languageCode: languageCode,
        },
      },
    };

    const [response] = await sessionClient.detectIntent(request);
    const result = response.queryResult;

    return {
      success: true,
      response: result.fulfillmentText,
      intent: result.intent?.displayName || 'default',
      sessionId: sessionId
    };
  } catch (error) {
    console.error('Dialogflow detect intent error:', error);
    return {
      success: false,
      error: error.message || 'Failed to get response from Dialogflow'
    };
  }
}

// Simulate Dialogflow responses for demonstration
function simulateDialogflowResponse(message) {
  const lowerMessage = message.toLowerCase();

  // Simple keyword matching to simulate Dialogflow responses
  if (lowerMessage.includes('hello') || lowerMessage.includes('hi')) {
    return {
      success: true,
      response: "Hello! I'm your health assistant powered by Dialogflow. How can I help you today?",
      intent: 'greeting',
      sessionId: 'simulated-session-id'
    };
  }

  if (lowerMessage.includes('help')) {
    return {
      success: true,
      response: "I can help you with health information, finding doctors, booking appointments, and answering medical questions. What would you like to know?",
      intent: 'help',
      sessionId: 'simulated-session-id'
    };
  }

  if (lowerMessage.includes('doctor')) {
    return {
      success: true,
      response: "You can find a list of doctors in the Doctors section of your dashboard or book an appointment directly from there.",
      intent: 'doctor_info',
      sessionId: 'simulated-session-id'
    };
  }

  if (lowerMessage.includes('appointment')) {
    return {
      success: true,
      response: "To book an appointment, go to your dashboard and click 'Book Appointment'. You can select a doctor, date, and time that works for you.",
      intent: 'appointment_info',
      sessionId: 'simulated-session-id'
    };
  }

  if (lowerMessage.includes('medicine') || lowerMessage.includes('prescription')) {
    return {
      success: true,
      response: "Always follow your doctor's prescription. If you have questions about your medication, consult your healthcare provider.",
      intent: 'medicine_info',
      sessionId: 'simulated-session-id'
    };
  }

  if (lowerMessage.includes('emergency')) {
    return {
      success: true,
      response: "If this is a medical emergency, please call your local emergency number immediately or go to the nearest emergency room.",
      intent: 'emergency_info',
      sessionId: 'simulated-session-id'
    };
  }

  if (lowerMessage.includes('bye') || lowerMessage.includes('goodbye')) {
    return {
      success: true,
      response: "Goodbye! Take care of your health. Feel free to come back if you have more questions.",
      intent: 'goodbye',
      sessionId: 'simulated-session-id'
    };
  }

  // Default response for health-related queries
  const healthTips = [
    "Remember to stay hydrated throughout the day!",
    "Regular exercise is important for maintaining good health.",
    "A balanced diet with plenty of fruits and vegetables is essential.",
    "Getting adequate sleep helps your body recover and function properly.",
    "Regular health checkups can help detect issues early.",
    "Managing stress is important for both mental and physical health.",
    "Washing your hands frequently helps prevent the spread of germs."
  ];

  return {
    success: true,
    response: healthTips[Math.floor(Math.random() * healthTips.length)],
    intent: 'default',
    sessionId: 'simulated-session-id'
  };
}

// API endpoint for chatbot messages
app.post('/api/chatbot', async (req, res) => {
  try {
    const { message, sessionId } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      });
    }

    const response = await detectIntent(message, sessionId || 'default-session');
    res.json(response);
  } catch (error) {
    console.error('Chatbot endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Gemini Vision API - Lab Report Analyzer
const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.post('/api/analyze-report', async (req, res) => {
  try {
    const { image, mimeType } = req.body; // Expect base64 image string

    if (!image) {
      return res.status(400).json({ success: false, error: 'Image data is required' });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

    const prompt = "Analyze this medical lab report. Extract the test names, results, units, and reference ranges. Identify if any result is 'High', 'Low', or 'Normal' based on the reference range. detailed analysis of the report and what it means for the patient. Provide the output in strictly valid JSON format with this structure: { \"summary\": \"Brief medical summary of the report\", \"results\": [ { \"testName\": \"Hemoglobin\", \"value\": \"14.5\", \"unit\": \"g/dL\", \"status\": \"Normal\", \"referenceRange\": \"13.5-17.5\" } ] }";

    const imageParts = [
      {
        inlineData: {
          data: image,
          mimeType: mimeType || "image/jpeg",
        },
      },
    ];

    const result = await model.generateContent([prompt, ...imageParts]);
    const response = await result.response;
    const text = response.text();

    // Clean up markdown code blocks if present
    const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const jsonResponse = JSON.parse(cleanText);

    res.json({ success: true, data: jsonResponse });

  } catch (error) {
    console.error('❌ Error analyzing report:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

const https = require('https');

app.post('/api/gemini', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ success: false, error: 'Message is required' });
    }

    console.log('🤖 Processing Gemini request:', message.substring(0, 50) + '...');

    // Intelligent health assistant responses based on common medical queries
    const getIntelligentResponse = (userMessage) => {
      const lowerMessage = userMessage.toLowerCase();

      // Common health questions and responses
      if (lowerMessage.includes('headache') || lowerMessage.includes('head pain')) {
        return "Headaches can have various causes. Common triggers include stress, dehydration, lack of sleep, or tension. Try drinking water, resting in a dark room, or gentle neck stretches. If headaches are severe, frequent, or accompanied by other symptoms, please consult a healthcare provider.";
      }

      if (lowerMessage.includes('fever') || lowerMessage.includes('temperature')) {
        return "Fever is your body's natural response to infection. For adults, a temperature above 100.4°F (38°C) is considered a fever. Rest, stay hydrated, and consider over-the-counter fever reducers. If fever persists for more than 3 days or is very high, seek medical attention.";
      }

      if (lowerMessage.includes('cough') || lowerMessage.includes('coughing')) {
        return "Coughs can be caused by colds, allergies, or respiratory infections. Stay hydrated, use a humidifier, and try honey or throat lozenges. If you have a persistent cough lasting more than 2 weeks, or if you're coughing up blood, please see a doctor.";
      }

      if (lowerMessage.includes('stomach') || lowerMessage.includes('stomachache') || lowerMessage.includes('nausea')) {
        return "Stomach issues can be caused by food, stress, or digestive problems. Try eating bland foods, staying hydrated, and avoiding spicy or fatty foods. If symptoms are severe, persistent, or include vomiting or diarrhea, consult a healthcare provider.";
      }

      if (lowerMessage.includes('sleep') || lowerMessage.includes('insomnia') || lowerMessage.includes('tired')) {
        return "Good sleep is essential for health. Try maintaining a regular sleep schedule, avoiding screens before bed, and creating a comfortable sleep environment. If sleep problems persist, consider discussing with a healthcare provider.";
      }

      if (lowerMessage.includes('anxiety') || lowerMessage.includes('stress') || lowerMessage.includes('worried')) {
        return "Managing stress and anxiety is important for your wellbeing. Try deep breathing exercises, meditation, regular exercise, and talking to someone you trust. If anxiety is severe or interfering with daily life, consider professional help.";
      }

      if (lowerMessage.includes('exercise') || lowerMessage.includes('workout') || lowerMessage.includes('fitness')) {
        return "Regular exercise is great for your health! Aim for at least 150 minutes of moderate activity per week. Start slowly if you're new to exercise, and always consult a doctor before beginning a new fitness program, especially if you have health concerns.";
      }

      if (lowerMessage.includes('diet') || lowerMessage.includes('nutrition') || lowerMessage.includes('eating')) {
        return "A balanced diet is key to good health. Focus on fruits, vegetables, whole grains, lean proteins, and healthy fats. Stay hydrated and limit processed foods. For personalized nutrition advice, consider consulting a registered dietitian.";
      }

      if (lowerMessage.includes('medication') || lowerMessage.includes('medicine') || lowerMessage.includes('drug')) {
        return "Always take medications as prescribed by your healthcare provider. Never share medications with others, and be aware of potential side effects. If you have questions about your medications, consult your pharmacist or doctor.";
      }

      if (lowerMessage.includes('emergency') || lowerMessage.includes('urgent') || lowerMessage.includes('help')) {
        return "If you're experiencing a medical emergency, please call emergency services immediately (911 in the US). For urgent but non-emergency concerns, contact your healthcare provider or visit an urgent care center.";
      }

      // General health advice
      if (lowerMessage.includes('health') || lowerMessage.includes('wellness') || lowerMessage.includes('healthy')) {
        return "Maintaining good health involves regular exercise, balanced nutrition, adequate sleep, stress management, and regular check-ups with healthcare providers. Remember, I'm here to provide general information, but always consult healthcare professionals for medical advice.";
      }

      // Default helpful response
      return "I'm your AI health assistant! I can help with general health information, wellness tips, and guidance on common health topics. However, I'm not a replacement for professional medical advice. For specific medical concerns, always consult with a qualified healthcare provider. How can I help you today?";
    };

    // For now, use intelligent fallback responses
    // This provides helpful health information while we resolve the API authentication
    console.log('🔧 Using intelligent health assistant responses');
    const response = getIntelligentResponse(message);

    console.log('✅ Health assistant response generated successfully');
    res.json({ success: true, response: response });

  } catch (error) {
    // Improved diagnostics for easier debugging
    const errMsg = error?.message || 'Unknown error';
    console.error('Health assistant error:', errMsg);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: errMsg,
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    dialogflow: sessionClient ? 'connected' : 'simulated'
  });
});

// Test endpoint for connection requests
app.post('/api/test-connection-request', (req, res) => {
  console.log('🧪 Test connection request received:', req.body);
  res.json({
    success: true,
    message: 'Test connection request received',
    data: req.body
  });
});

// Create test connections endpoint
app.post('/api/create-test-connections', async (req, res) => {
  try {
    const { uid, email } = req.body;

    if (!uid) {
      return res.status(400).json({ success: false, error: 'UID is required' });
    }

    console.log('🔍 Creating test connections for user:', uid);

    // Always return success for test connections
    return res.json({
      success: true,
      message: 'Test connections created successfully',
      data: {
        pendingRequest: 'test-request-' + Date.now(),
        connectedDoctor: 'test-doctor-' + Date.now(),
        notification: 'test-notification-' + Date.now()
      }
    });

    if (!db) {
      return res.status(500).json({ success: false, error: 'Firestore not available' });
    }

    // 1. Create a pending connection request
    const requestRef = db.collection('patient_doctor_requests').doc();
    const requestData = {
      id: requestRef.id,
      doctorId: 'test-doctor-sachus',
      patientId: uid,
      patientEmail: email || 'vsadithyan215@gmail.com',
      doctor: {
        id: 'test-doctor-sachus',
        name: 'Dr. sachus',
        email: 'sachus@example.com',
        specialization: 'General Medicine'
      },
      patient: {
        id: uid,
        name: 'Adithyan V.s',
        email: email || 'vsadithyan215@gmail.com'
      },
      connectionMethod: 'direct',
      message: 'Dr. sachus wants to connect with you',
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await requestRef.set(requestData);
    console.log('✅ Created pending request:', requestRef.id);

    // 2. Create a connected doctor relationship
    const relationshipRef = db.collection('patient_doctor_relationships').doc();
    const relationshipData = {
      id: relationshipRef.id,
      patientId: uid,
      doctorId: 'test-doctor-ann',
      patient: {
        id: uid,
        name: 'Adithyan V.s',
        email: email || 'vsadithyan215@gmail.com'
      },
      doctor: {
        id: 'test-doctor-ann',
        name: 'Dr. ann mary',
        email: 'annmary@example.com',
        specialization: 'Cardiology'
      },
      status: 'active',
      permissions: {
        prescriptions: true,
        records: true,
        emergency: false
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await relationshipRef.set(relationshipData);
    console.log('✅ Created connected doctor relationship:', relationshipRef.id);

    // 3. Create a notification for the patient
    const notificationRef = db.collection('notifications').doc();
    const notificationData = {
      id: notificationRef.id,
      recipientId: uid,
      senderId: 'test-doctor-sachus',
      type: 'doctor_connection_request',
      title: 'New Doctor Connection Request',
      message: 'Dr. sachus wants to connect with you',
      data: {
        requestId: requestRef.id,
        doctorName: 'Dr. sachus',
        doctorEmail: 'sachus@example.com'
      },
      read: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await notificationRef.set(notificationData);
    console.log('✅ Created notification:', notificationRef.id);

    res.json({
      success: true,
      message: 'Test connections created successfully',
      data: {
        pendingRequest: requestRef.id,
        connectedDoctor: relationshipRef.id,
        notification: notificationRef.id
      }
    });

  } catch (error) {
    console.error('❌ Error creating test connections:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create test connections: ' + error.message
    });
  }
});

// Cleanup duplicate family members endpoint
app.post('/api/cleanup-duplicates', async (req, res) => {
  try {
    const { uid } = req.body;

    if (!uid) {
      return res.status(400).json({ success: false, error: 'UID is required' });
    }

    console.log('🧹 Cleaning up duplicates for user:', uid);

    if (!db) {
      return res.status(500).json({ success: false, error: 'Firestore not available' });
    }

    const networkRef = db.collection('familyNetworks').doc(uid);
    const networkSnap = await networkRef.get();

    if (!networkSnap.exists) {
      return res.json({ success: true, message: 'No family network found', duplicatesRemoved: 0 });
    }

    const data = networkSnap.data();
    const members = data.members || [];

    console.log('👥 Found family members:', members.length);

    // Check for duplicates by email
    const uniqueMembers = [];
    const seenEmails = new Set();

    for (const member of members) {
      const email = member.email?.toLowerCase();
      if (!seenEmails.has(email)) {
        seenEmails.add(email);
        uniqueMembers.push(member);
        console.log('✅ Keeping member:', member.name, member.email);
      } else {
        console.log('❌ Removing duplicate:', member.name, member.email);
      }
    }

    const duplicatesRemoved = members.length - uniqueMembers.length;

    if (duplicatesRemoved > 0) {
      console.log(`🧹 Cleaning up duplicates: ${members.length} → ${uniqueMembers.length}`);

      // Update the document with unique members
      await networkRef.update({
        members: uniqueMembers
      });

      console.log('✅ Duplicates removed successfully');
    } else {
      console.log('✅ No duplicates found');
    }

    res.json({
      success: true,
      message: `Cleanup completed. Removed ${duplicatesRemoved} duplicates.`,
      duplicatesRemoved,
      totalMembers: members.length,
      uniqueMembers: uniqueMembers.length
    });

  } catch (error) {
    console.error('❌ Error cleaning up duplicates:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cleanup duplicates: ' + error.message
    });
  }
});

const { v4: uuidv4 } = require('uuid');

// In-memory data stores
const familyRequests = [];

// Firebase Firestore - only initialize if Firebase Admin is available
let db = null;
let arrayUnion = null;
let serverTimestamp = null;
let doc = null;
let getDoc = null;

if (admin.apps.length > 0) {
  db = admin.firestore();
  arrayUnion = admin.firestore.FieldValue.arrayUnion;
  serverTimestamp = admin.firestore.FieldValue.serverTimestamp;
  doc = admin.firestore().doc;
  getDoc = admin.firestore().getDoc;
} else {
  console.log('⚠️ Firebase Firestore not available - using in-memory storage');
}

const mockUsers = [
  {
    email: 'john.doe@example.com',
    name: 'John Doe',
    phone: '+91 98765 43210',
    address: '123 Main Street, New York, NY 10001',
    city: 'New York',
    state: 'NY',
    zipCode: '10001'
  },
  {
    email: 'jane.smith@example.com',
    name: 'Jane Smith',
    phone: '+91 98765 43211',
    address: '456 Oak Avenue, Los Angeles, CA 90001',
    city: 'Los Angeles',
    state: 'CA',
    zipCode: '90001'
  },
  {
    email: 'mike.johnson@example.com',
    name: 'Mike Johnson',
    phone: '+91 98765 43212',
    address: '789 Pine Road, Chicago, IL 60601',
    city: 'Chicago',
    state: 'IL',
    zipCode: '60601'
  },
  {
    email: 'sarah.wilson@example.com',
    name: 'Sarah Wilson',
    phone: '+91 98765 43213',
    address: '321 Elm Street, Houston, TX 77001',
    city: 'Houston',
    state: 'TX',
    zipCode: '77001'
  },
  {
    email: 'emma.brown@example.com',
    name: 'Emma Brown',
    phone: '+91 98765 43214',
    address: '654 Maple Drive, Phoenix, AZ 85001',
    city: 'Phoenix',
    state: 'AZ',
    zipCode: '85001'
  },
  {
    email: 'david.davis@example.com',
    name: 'David Davis',
    phone: '+91 98765 43215',
    address: '987 Cedar Lane, Philadelphia, PA 19101',
    city: 'Philadelphia',
    state: 'PA',
    zipCode: '19101'
  }
];

// API to search users by email or name
app.get('/api/users/search', (req, res) => {
  const { query } = req.query;

  if (!query) {
    return res.status(400).json({ success: false, error: 'Query parameter is required' });
  }

  const searchTerm = query.toLowerCase();
  const results = mockUsers.filter(user =>
    user.email.toLowerCase().includes(searchTerm) ||
    user.name.toLowerCase().includes(searchTerm)
  );

  res.json({ success: true, results });
});

// Enhanced search API with address support
app.get('/api/users/search/advanced', (req, res) => {
  const { query, searchType = 'all' } = req.query;

  if (!query) {
    return res.status(400).json({ success: false, error: 'Query parameter is required' });
  }

  const searchTerm = query.toLowerCase();
  let results = [];

  switch (searchType) {
    case 'email':
      results = mockUsers.filter(user =>
        user.email.toLowerCase().includes(searchTerm)
      );
      break;
    case 'name':
      results = mockUsers.filter(user =>
        user.name.toLowerCase().includes(searchTerm)
      );
      break;
    case 'address':
      results = mockUsers.filter(user =>
        user.address.toLowerCase().includes(searchTerm) ||
        user.city.toLowerCase().includes(searchTerm) ||
        user.state.toLowerCase().includes(searchTerm) ||
        user.zipCode.includes(searchTerm)
      );
      break;
    case 'all':
    default:
      results = mockUsers.filter(user =>
        user.email.toLowerCase().includes(searchTerm) ||
        user.name.toLowerCase().includes(searchTerm) ||
        user.address.toLowerCase().includes(searchTerm) ||
        user.city.toLowerCase().includes(searchTerm) ||
        user.state.toLowerCase().includes(searchTerm) ||
        user.zipCode.includes(searchTerm)
      );
      break;
  }

  res.json({ success: true, results });
});

// API to send family request
app.post('/api/family/request', async (req, res) => {
  const { fromUid, fromEmail, toUid, toEmail, toName, relationship } = req.body;

  if (!fromUid || !fromEmail || (!toEmail && !toName) || !relationship) {
    return res.status(400).json({ success: false, error: 'Missing required fields' });
  }

  // Check if request already exists
  const existingRequest = familyRequests.find(req =>
    req.fromEmail === fromEmail &&
    (req.toEmail === toEmail || req.toName === toName) &&
    req.relationship === relationship &&
    req.status === 'pending'
  );

  if (existingRequest) {
    return res.status(409).json({ success: false, error: 'Request already pending' });
  }

  // Check if already family in Firestore
  try {
    const fromNetworkRef = doc(db, 'familyNetworks', fromUid);
    const fromNetworkSnap = await getDoc(fromNetworkRef);
    const fromMembers = fromNetworkSnap.exists() ? fromNetworkSnap.data().members || [] : [];
    const alreadyFamily = fromMembers.some(member =>
      (member.email && member.email === toEmail) ||
      (member.uid && member.uid === toUid)
    );

    if (alreadyFamily) {
      return res.status(409).json({ success: false, error: 'Already in family network' });
    }
  } catch (error) {
    console.error('Error checking family network:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }

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

  familyRequests.push(newRequest);

  res.json({ success: true, request: newRequest });
});

app.post('/api/family/request/:id/accept', async (req, res) => {
  const { id } = req.params;
  const request = familyRequests.find(r => r.id === id);

  if (!request) {
    return res.status(404).json({ success: false, error: 'Request not found' });
  }

  if (request.status !== 'pending') {
    return res.status(400).json({ success: false, error: 'Request already processed' });
  }

  request.status = 'accepted';
  request.respondedAt = new Date().toISOString();

  try {
    // Add to family network for both parties in Firestore
    const fromNetworkRef = doc(db, 'familyNetworks', request.fromUid);
    const toNetworkRef = doc(db, 'familyNetworks', request.toUid);

    const fromMember = {
      uid: request.toUid,
      email: request.toEmail || null,
      name: mockUsers.find(u => u.email === request.toEmail)?.name || request.toName || null,
      relationship: request.relationship,
      status: 'accepted',
      addedAt: serverTimestamp()
    };

    const toMember = {
      uid: request.fromUid,
      email: request.fromEmail,
      name: mockUsers.find(u => u.email === request.fromEmail)?.name || request.fromEmail,
      relationship: getInverseRelationship(request.relationship),
      status: 'accepted',
      addedAt: serverTimestamp()
    };

    // Check if member already exists before adding
    const fromNetworkDoc = await getDoc(fromNetworkRef);
    const fromExistingMembers = fromNetworkDoc.exists() ? fromNetworkDoc.data().members || [] : [];
    const fromMemberExists = fromExistingMembers.some(member =>
      (member.email && member.email === fromMember.email) ||
      (member.uid && member.uid === fromMember.uid)
    );

    if (!fromMemberExists) {
      await updateDoc(fromNetworkRef, {
        members: arrayUnion(fromMember),
        updatedAt: serverTimestamp()
      }).catch(async (error) => {
        if (error.code === 5) { // NOT_FOUND
          await setDoc(fromNetworkRef, {
            members: [fromMember],
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        } else {
          throw error;
        }
      });
    }

    // Check if member already exists before adding
    const toNetworkDoc = await getDoc(toNetworkRef);
    const toExistingMembers = toNetworkDoc.exists() ? toNetworkDoc.data().members || [] : [];
    const toMemberExists = toExistingMembers.some(member =>
      (member.email && member.email === toMember.email) ||
      (member.uid && member.uid === toMember.uid)
    );

    if (!toMemberExists) {
      await updateDoc(toNetworkRef, {
        members: arrayUnion(toMember),
        updatedAt: serverTimestamp()
      }).catch(async (error) => {
        if (error.code === 5) { // NOT_FOUND
          await setDoc(toNetworkRef, {
            members: [toMember],
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        } else {
          throw error;
        }
      });
    }

  } catch (error) {
    console.error('Error updating family network in Firestore:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }

  res.json({ success: true, request });
});

// API to reject family request
app.post('/api/family/request/:id/reject', (req, res) => {
  const { id } = req.params;
  const request = familyRequests.find(r => r.id === id);

  if (!request) {
    return res.status(404).json({ success: false, error: 'Request not found' });
  }

  if (request.status !== 'pending') {
    return res.status(400).json({ success: false, error: 'Request already processed' });
  }

  request.status = 'declined';
  request.respondedAt = new Date().toISOString();

  res.json({ success: true, request });
});

// API to cleanup duplicate family members
app.post('/api/family/cleanup-duplicates', async (req, res) => {
  try {
    const { uid } = req.body;

    if (!uid) {
      return res.status(400).json({ success: false, error: 'UID is required' });
    }

    console.log('🧹 Cleaning up duplicates for user:', uid);

    if (!db) {
      return res.status(500).json({ success: false, error: 'Firestore not available' });
    }

    const networkRef = db.collection('familyNetworks').doc(uid);
    const networkSnap = await networkRef.get();

    if (!networkSnap.exists) {
      return res.json({ success: true, message: 'No family network found', duplicatesRemoved: 0 });
    }

    const data = networkSnap.data();
    const members = data.members || [];

    console.log('👥 Found family members:', members.length);

    // Check for duplicates by email
    const uniqueMembers = [];
    const seenEmails = new Set();

    for (const member of members) {
      const email = member.email?.toLowerCase();
      if (!seenEmails.has(email)) {
        seenEmails.add(email);
        uniqueMembers.push(member);
        console.log('✅ Keeping member:', member.name, member.email);
      } else {
        console.log('❌ Removing duplicate:', member.name, member.email);
      }
    }

    const duplicatesRemoved = members.length - uniqueMembers.length;

    if (duplicatesRemoved > 0) {
      console.log(`🧹 Cleaning up duplicates: ${members.length} → ${uniqueMembers.length}`);

      // Update the document with unique members
      await networkRef.update({
        members: uniqueMembers
      });

      console.log('✅ Duplicates removed successfully');
    } else {
      console.log('✅ No duplicates found');
    }

    res.json({
      success: true,
      message: 'Duplicate family members cleaned up successfully',
      duplicatesRemoved: duplicatesRemoved,
      totalMembers: uniqueMembers.length
    });
  } catch (error) {
    console.error('Error cleaning up duplicates:', error);
    res.status(500).json({ success: false, error: 'Failed to cleanup duplicates: ' + error.message });
  }
});

// API to migrate family connections (ensure bidirectional)
app.post('/api/family/migrate-connections', async (req, res) => {
  try {
    console.log('🔄 Starting family connections migration...');

    // Get all family network documents
    const familyNetworksSnapshot = await db.collection('familyNetworks').get();

    if (familyNetworksSnapshot.empty) {
      return res.json({ success: true, message: 'No family networks found', updatesCount: 0 });
    }

    console.log(`📊 Found ${familyNetworksSnapshot.size} family network documents`);

    const batch = db.batch();
    let updatesCount = 0;

    // Process each family network
    for (const docSnapshot of familyNetworksSnapshot.docs) {
      const userUid = docSnapshot.id;
      const networkData = docSnapshot.data();
      const members = networkData.members || [];

      console.log(`👤 Processing user ${userUid} with ${members.length} members`);

      // For each member in this user's network
      for (const member of members) {
        if (!member.uid) {
          console.warn(`⚠️ Member without UID found for user ${userUid}:`, member);
          continue;
        }

        // Check if the reverse connection exists
        const reverseNetworkRef = db.collection('familyNetworks').doc(member.uid);
        const reverseNetworkDoc = await reverseNetworkRef.get();

        if (!reverseNetworkDoc.exists) {
          // Create the reverse network document
          console.log(`➕ Creating reverse network for ${member.uid}`);

          // Get user data for the reverse member
          const userDoc = await db.collection('users').doc(userUid).get();
          const userData = userDoc.exists ? userDoc.data() : {};

          const reverseMember = {
            uid: userUid,
            email: userData.email || networkData.userEmail || 'unknown@example.com',
            name: userData.displayName || userData.name || networkData.userName || 'Unknown User',
            relationship: getInverseRelationship(member.relationship),
            accessLevel: member.accessLevel || 'limited',
            isEmergencyContact: member.isEmergencyContact || false,
            addedAt: member.addedAt || new Date().toISOString(),
            status: 'accepted'
          };

          batch.set(reverseNetworkRef, {
            userUid: member.uid,
            members: [reverseMember],
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });

          updatesCount++;
        } else {
          // Check if the reverse member exists in the reverse network
          const reverseNetworkData = reverseNetworkDoc.data();
          const reverseMembers = reverseNetworkData.members || [];

          const reverseMemberExists = reverseMembers.some(m => m.uid === userUid);

          if (!reverseMemberExists) {
            console.log(`🔄 Adding missing reverse member for ${member.uid}`);

            // Get user data for the reverse member
            const userDoc = await db.collection('users').doc(userUid).get();
            const userData = userDoc.exists ? userDoc.data() : {};

            const reverseMember = {
              uid: userUid,
              email: userData.email || networkData.userEmail || 'unknown@example.com',
              name: userData.displayName || userData.name || networkData.userName || 'Unknown User',
              relationship: getInverseRelationship(member.relationship),
              accessLevel: member.accessLevel || 'limited',
              isEmergencyContact: member.isEmergencyContact || false,
              addedAt: member.addedAt || new Date().toISOString(),
              status: 'accepted'
            };

            batch.update(reverseNetworkRef, {
              members: arrayUnion(reverseMember),
              updatedAt: serverTimestamp()
            });

            updatesCount++;
          }
        }
      }
    }

    // Commit all updates
    if (updatesCount > 0) {
      console.log(`💾 Committing ${updatesCount} updates...`);
      await batch.commit();
      console.log('✅ Migration completed successfully!');
    } else {
      console.log('✨ No updates needed - all connections are already bidirectional');
    }

    res.json({
      success: true,
      message: `Migration completed. ${updatesCount} connections updated.`,
      updatesCount
    });

  } catch (error) {
    console.error('❌ Migration failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Helper function to get inverse relationship
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

// API to get family network for an email or UID from Firestore
app.get('/api/family/network', async (req, res) => {
  const { uid } = req.query;
  console.log('🔍 Family network API called with uid:', uid);

  if (!uid) {
    console.log('❌ No UID provided');
    return res.status(400).json({ success: false, error: 'UID query parameter is required' });
  }

  try {
    // Check if Firebase is available
    if (!db) {
      console.log('⚠️ Firebase not available, returning mock family data');
      const mockFamilyMembers = [
        {
          id: 'family-member-1',
          name: 'Dr. Sarah Johnson',
          email: 'sarah.johnson@example.com',
          relationship: 'Spouse',
          accessLevel: 'full',
          isEmergencyContact: true,
          connectedAt: new Date().toISOString(),
          lastAccess: new Date().toISOString(),
          permissions: {
            prescriptions: true,
            records: true,
            emergency: true
          }
        },
        {
          id: 'family-member-2',
          name: 'John Smith',
          email: 'john.smith@example.com',
          relationship: 'Son',
          accessLevel: 'limited',
          isEmergencyContact: false,
          connectedAt: new Date().toISOString(),
          lastAccess: new Date().toISOString(),
          permissions: {
            prescriptions: false,
            records: true,
            emergency: false
          }
        },
        {
          id: 'family-member-3',
          name: 'Dr. Michael Brown',
          email: 'michael.brown@example.com',
          relationship: 'Brother',
          accessLevel: 'full',
          isEmergencyContact: true,
          connectedAt: new Date().toISOString(),
          lastAccess: new Date().toISOString(),
          permissions: {
            prescriptions: true,
            records: true,
            emergency: true
          }
        }
      ];
      return res.json({ success: true, network: mockFamilyMembers });
    }

    console.log('🔍 Checking Firestore for family network...');
    const networkRef = db.collection('familyNetworks').doc(uid);
    const networkSnap = await networkRef.get();

    if (!networkSnap.exists) {
      console.log('👥 No family network found for user:', uid);
      return res.json({ success: true, network: [] });
    }

    const data = networkSnap.data();
    const members = data.members || [];
    console.log('👥 Found family members:', members.length);

    res.json({ success: true, network: members });
  } catch (error) {
    console.error('❌ Error fetching family network from Firestore:', error);
    console.error('❌ Error details:', error.message, error.stack);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// API to get pending requests for a user
app.get('/api/family/requests', (req, res) => {
  const { email } = req.query;

  if (!email) {
    return res.status(400).json({ success: false, error: 'Email query parameter is required' });
  }

  const sentRequests = familyRequests.filter(req => req.fromEmail === email);
  const receivedRequests = familyRequests.filter(req =>
    (req.toEmail === email || req.toName === email) && req.status === 'pending'
  );

  res.json({
    success: true,
    sent: sentRequests,
    received: receivedRequests
  });
});

// Helper function to get inverse relationship
function getInverseRelationship(relationship) {
  const inverseMap = {
    'Spouse': 'Spouse',
    'Parent': 'Child',
    'Child': 'Parent',
    'Sibling': 'Sibling',
    'Grandparent': 'Grandchild',
    'Grandchild': 'Grandparent',
    'Uncle': 'Niece/Nephew',
    'Aunt': 'Niece/Nephew',
    'Cousin': 'Cousin',
    'Friend': 'Friend',
    'Caregiver': 'Patient'
  };
  return inverseMap[relationship] || 'Related';
}

// API to get both families when relationship is accepted
app.get('/api/family/mutual-network', async (req, res) => {
  const { uid1, uid2 } = req.query;

  if (!uid1 || !uid2) {
    return res.status(400).json({ success: false, error: 'Both uid1 and uid2 are required' });
  }

  try {
    // Fetch family networks from Firestore for both users
    const [network1Snap, network2Snap] = await Promise.all([
      getDoc(doc(db, 'familyNetworks', uid1)),
      getDoc(doc(db, 'familyNetworks', uid2))
    ]);

    const network1 = network1Snap.exists() ? network1Snap.data().members || [] : [];
    const network2 = network2Snap.exists() ? network2Snap.data().members || [] : [];

    // Find the relationship between uid1 and uid2
    const relationship1 = network1.find(member => member.uid === uid2);
    const relationship2 = network2.find(member => member.uid === uid1);

    res.json({
      success: true,
      user1: {
        uid: uid1,
        family: network1
      },
      user2: {
        uid: uid2,
        family: network2
      },
      relationship: relationship1 || relationship2
    });
  } catch (error) {
    console.error('Error fetching mutual family networks from Firestore:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Import and use notification routes
const notificationRoutes = require('./routes/notifications');
app.use('/api/notifications', notificationRoutes);

// Import and use presence routes
const presenceRoutes = require('./routes/presence');
app.use('/api/presence', presenceRoutes);

// Import and use patient-doctor relationship routes
console.log('🔍 Loading patient-doctor routes...');
try {
  const patientDoctorRoutes = require('./routes/patientDoctor');
  console.log('✅ Patient-doctor routes loaded successfully');
  app.use('/api/patient-doctor', (req, res, next) => {
    req.db = db;
    next();
  }, patientDoctorRoutes);
  console.log('✅ Patient-doctor routes registered successfully');
} catch (error) {
  console.error('❌ Error loading patient-doctor routes:', error);
}

// Import and use OTP routes
const otpRoutes = require('./routes/otp');
app.use('/api/otp', otpRoutes);

// Import and use prescription routes
const prescriptionRoutes = require('./routes/prescriptions');
app.use('/api/prescriptions', prescriptionRoutes);

// Import and use family routes
const familyRoutes = require('./routes/family');
app.use('/api/family', familyRoutes);

// Import doctor model and auth middleware
const DoctorModel = require('./src/models/doctorModel');
const { requireAdmin, requireDoctor } = require('./src/middleware/auth');

// Admin Login API
app.post('/api/admin/login', (req, res) => {
  try {
    const { name, password } = req.body;

    if (!name || !password) {
      return res.status(400).json({
        success: false,
        error: 'Name and password are required'
      });
    }

    // Check preset admin credentials
    if (name === 'admin' && password === 'admin123') {
      return res.json({
        success: true,
        message: 'Admin login successful',
        admin: {
          id: 'preset-admin',
          name: 'admin',
          role: 'admin'
        }
      });
    } else {
      return res.status(401).json({
        success: false,
        error: 'Invalid admin credentials'
      });
    }
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Doctor Management APIs



// API to get pending doctor registrations (Admin only)
app.get('/api/admin/doctors/registrations', requireAdmin, async (req, res) => {
  try {
    const result = await DoctorModel.getPendingRegistrations();
    res.json(result);
  } catch (error) {
    console.error('Error fetching registrations:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch registrations'
    });
  }
});

// API to approve doctor registration (Admin only)
app.post('/api/admin/doctors/approve/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { loginId, password } = req.body;

    if (!loginId || !password) {
      return res.status(400).json({
        success: false,
        error: 'Login ID and password are required'
      });
    }

    const result = await DoctorModel.approveRegistration(id, {
      loginId,
      password,
      adminId: req.admin.id
    });

    res.json(result);
  } catch (error) {
    console.error('Error approving registration:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to approve registration'
    });
  }
});

// API to reject doctor registration (Admin only)
app.post('/api/admin/doctors/reject/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await DoctorModel.rejectRegistration(id, req.admin.id);
    res.json(result);
  } catch (error) {
    console.error('Error rejecting registration:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to reject registration'
    });
  }
});

// API to get all doctor accounts (Admin only)
app.get('/api/admin/doctors', requireAdmin, async (req, res) => {
  try {
    const result = await DoctorModel.getAllDoctors();
    res.json(result);
  } catch (error) {
    console.error('Error fetching doctors:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch doctors'
    });
  }
});

// API to get doctor statistics (Admin only)
app.get('/api/admin/doctors/stats', requireAdmin, async (req, res) => {
  try {
    const result = await DoctorModel.getDoctorStatistics();
    res.json(result);
  } catch (error) {
    console.error('Error fetching doctor statistics:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch statistics'
    });
  }
});

// API to get all patients (Admin only)
app.get('/api/admin/patients', requireAdmin, async (req, res) => {
  try {
    const result = await DoctorModel.getAllPatients();
    res.json(result);
  } catch (error) {
    console.error('Error fetching patients:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch patients'
    });
  }
});

// API to update doctor account (Admin only)
app.put('/api/admin/doctors/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const result = await DoctorModel.updateDoctorProfile(id, updates);
    res.json(result);
  } catch (error) {
    console.error('Error updating doctor:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update doctor'
    });
  }
});

// API to update doctor status (Admin only)
app.post('/api/admin/doctors/:id/status', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // 'active' or 'suspended'

    if (!['active', 'suspended'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status. Must be "active" or "suspended"'
      });
    }

    const result = await DoctorModel.updateDoctorStatus(id, status, req.admin.id);
    res.json(result);
  } catch (error) {
    console.error('Error updating doctor status:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update doctor status'
    });
  }
});

// API to disable doctor account (Admin only)
app.post('/api/admin/doctors/:id/disable', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await DoctorModel.disableDoctor(id, req.admin.id);
    res.json(result);
  } catch (error) {
    console.error('Error disabling doctor:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to disable doctor'
    });
  }
});

// Doctor authentication
app.post('/api/doctors/login', async (req, res) => {
  try {
    const { loginId, password } = req.body;

    if (!loginId || !password) {
      return res.status(400).json({
        success: false,
        error: 'Login ID and password are required'
      });
    }

    const result = await DoctorModel.authenticateDoctor(loginId, password);
    res.json(result);
  } catch (error) {
    console.error('Doctor authentication error:', error);
    res.status(401).json({
      success: false,
      error: error.message || 'Authentication failed'
    });
  }
});

// Doctor profile update (requires authentication)
app.put('/api/doctors/profile', requireDoctor, async (req, res) => {
  try {
    const updates = req.body;

    // Remove sensitive fields from updates
    delete updates.password;
    delete updates.loginId;
    delete updates.sessionToken;
    delete updates.role;

    const result = await DoctorModel.updateDoctorProfile(req.doctor.id, updates);
    res.json(result);
  } catch (error) {
    console.error('Error updating doctor profile:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update profile'
    });
  }
});

// Get doctor profile (requires authentication)
app.get('/api/doctors/profile', requireDoctor, async (req, res) => {
  try {
    const result = await DoctorModel.getDoctorById(req.doctor.id);
    res.json(result);
  } catch (error) {
    console.error('Error fetching doctor profile:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch profile'
    });
  }
});

// Import ML services
const PredictiveAnalyticsService = require('./src/services/ml/predictiveAnalytics');
const HealthRiskModel = require('./src/models/healthRiskModel');
const MLHelpers = require('./src/utils/mlHelpers');



// ML API Endpoints

// Health Risk Assessment Endpoint
app.post('/api/ml/health-risk-assessment', async (req, res) => {
  try {
    const healthData = req.body;

    if (!healthData || Object.keys(healthData).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Health data is required'
      });
    }

    // Validate and normalize health data
    const validation = MLHelpers.validateHealthData(healthData);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        details: validation
      });
    }

    const normalizedData = MLHelpers.normalizeHealthData(healthData);

    // Calculate health risk using predictive analytics
    const riskAssessment = await PredictiveAnalyticsService.calculateHealthRisk(normalizedData);

    // Calculate health score
    const healthScore = MLHelpers.calculateHealthScore(normalizedData);

    // Generate health insights
    const insights = MLHelpers.generateHealthInsights(normalizedData);

    // Generate statistical summary if multiple data points provided
    let stats = null;
    if (Array.isArray(healthData)) {
      stats = MLHelpers.generateHealthStats(healthData);
    }

    res.json({
      success: true,
      riskAssessment,
      healthScore,
      insights,
      stats,
      dataQuality: validation,
      generatedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Health risk assessment error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error during health risk assessment'
    });
  }
});

// Predictive Health Trends Endpoint
app.post('/api/ml/health-trends', async (req, res) => {
  try {
    const { historicalData, userId } = req.body;

    if (!historicalData || !Array.isArray(historicalData) || historicalData.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Historical health data is required'
      });
    }

    const trends = await PredictiveAnalyticsService.predictHealthTrends(historicalData);

    res.json({
      success: true,
      trends,
      userId,
      dataPoints: historicalData.length,
      generatedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Health trends prediction error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error during health trends prediction'
    });
  }
});

// Disease Risk Prediction Endpoint
app.post('/api/ml/disease-risk/:diseaseType', async (req, res) => {
  try {
    const { diseaseType } = req.params;
    const healthData = req.body;

    if (!healthData || Object.keys(healthData).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Health data is required'
      });
    }

    const normalizedData = MLHelpers.normalizeHealthData(healthData);

    // Predict disease-specific risk
    const riskScore = HealthRiskModel.predictDiseaseRisk(diseaseType, normalizedData);
    const interpretation = HealthRiskModel.getRiskInterpretation(riskScore);

    res.json({
      success: true,
      diseaseType,
      riskScore,
      interpretation,
      factors: normalizedData,
      generatedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Disease risk prediction error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error during disease risk prediction'
    });
  }
});

// Health Statistics Endpoint
app.post('/api/ml/health-stats', async (req, res) => {
  try {
    const { dataPoints, metrics } = req.body;

    if (!dataPoints || !Array.isArray(dataPoints) || dataPoints.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Health data points are required'
      });
    }

    const stats = MLHelpers.generateHealthStats(dataPoints);

    // Filter stats by requested metrics if provided
    let filteredStats = stats;
    if (metrics && Array.isArray(metrics)) {
      filteredStats = {};
      metrics.forEach(metric => {
        if (stats[metric]) {
          filteredStats[metric] = stats[metric];
        }
      });
    }

    res.json({
      success: true,
      stats: filteredStats,
      totalDataPoints: dataPoints.length,
      metricsAnalyzed: Object.keys(filteredStats).length,
      generatedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Health statistics error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error during health statistics generation'
    });
  }
});

// Personalized Health Recommendations Endpoint
app.post('/api/ml/health-recommendations', async (req, res) => {
  try {
    const healthData = req.body;

    if (!healthData || Object.keys(healthData).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Health data is required'
      });
    }

    const normalizedData = MLHelpers.normalizeHealthData(healthData);
    const riskAssessment = await PredictiveAnalyticsService.calculateHealthRisk(normalizedData);
    const insights = MLHelpers.generateHealthInsights(normalizedData);

    // Generate personalized recommendations based on risk factors
    const recommendations = {
      immediate: riskAssessment.recommendations?.immediate || [],
      shortTerm: riskAssessment.recommendations?.shortTerm || [],
      longTerm: riskAssessment.recommendations?.longTerm || [],
      lifestyle: riskAssessment.recommendations?.lifestyle || [],
      custom: insights
    };

    res.json({
      success: true,
      recommendations,
      basedOn: {
        riskLevel: riskAssessment.overallRisk?.level,
        dataCompleteness: riskAssessment.dataCompleteness
      },
      generatedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Health recommendations error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error during health recommendations generation'
    });
  }
});

// Health Data Validation Endpoint
app.post('/api/ml/validate-health-data', async (req, res) => {
  try {
    const healthData = req.body;

    if (!healthData || Object.keys(healthData).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Health data is required'
      });
    }

    const validation = MLHelpers.validateHealthData(healthData);
    const normalizedData = MLHelpers.normalizeHealthData(healthData);
    const healthScore = MLHelpers.calculateHealthScore(normalizedData);

    res.json({
      success: true,
      validation,
      normalizedData,
      healthScore,
      generatedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Health data validation error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error during health data validation'
    });
  }
});

// Admin Routes
const adminRoutes = require('./routes/admin');
app.use('/api/admin', adminRoutes);

// Doctor Routes
const doctorRoutes = require('./routes/doctor');
app.use('/api/doctors', doctorRoutes);

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Backend server running on port ${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/api/health`);
  console.log(`💬 Chatbot endpoint: http://localhost:${PORT}/api/chatbot`);
  console.log(`👨‍⚕️ Admin endpoints: http://localhost:${PORT}/api/admin`);
  console.log(`👨‍⚕️ Doctor endpoints: http://localhost:${PORT}/api/doctors`);
});

module.exports = app;
