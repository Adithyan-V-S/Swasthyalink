const { onRequest } = require("firebase-functions/v2/https");
const { SessionsClient } = require('@google-cloud/dialogflow');

// Dialogflow configuration
const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || 'swasthyalink-42535';
const languageCode = 'en';

// Initialize Dialogflow client
let sessionClient;
try {
    // If we have a project ID, try to initialize
    if (projectId) {
        sessionClient = new SessionsClient();
        console.log('✅ Dialogflow client initialized');
    }
} catch (error) {
    console.error('❌ Failed to initialize Dialogflow client:', error.message);
    sessionClient = null;
}

/**
 * Simulates Dialogflow responses for demonstration/fallback
 */
function simulateResponse(message) {
    const lowerMessage = message.toLowerCase();
    const sessionId = 'simulated-session';

    if (lowerMessage.includes('hello') || lowerMessage.includes('hi')) {
        return {
            success: true,
            response: "Hello! I'm your health assistant powered by Dialogflow. How can I help you today?",
            intent: 'greeting',
            sessionId
        };
    }

    if (lowerMessage.includes('help')) {
        return {
            success: true,
            response: "I can help you with health information, finding doctors, booking appointments, and answering medical questions. What would you like to know?",
            intent: 'help',
            sessionId
        };
    }

    if (lowerMessage.includes('doctor')) {
        return {
            success: true,
            response: "You can find a list of doctors in the Doctors section of your dashboard or book an appointment directly from there.",
            intent: 'doctor_info',
            sessionId
        };
    }

    if (lowerMessage.includes('appointment')) {
        return {
            success: true,
            response: "To book an appointment, go to your dashboard and click 'Book Appointment'. You can select a doctor, date, and time that works for you.",
            intent: 'appointment_info',
            sessionId
        };
    }

    if (lowerMessage.includes('medicine') || lowerMessage.includes('prescription')) {
        return {
            success: true,
            response: "Always follow your doctor's prescription. If you have questions about your medication, consult your healthcare provider.",
            intent: 'medicine_info',
            sessionId
        };
    }

    if (lowerMessage.includes('emergency')) {
        return {
            success: true,
            response: "If this is a medical emergency, please call your local emergency number immediately or go to the nearest emergency room.",
            intent: 'emergency_info',
            sessionId
        };
    }

    if (lowerMessage.includes('bye') || lowerMessage.includes('goodbye')) {
        return {
            success: true,
            response: "Goodbye! Take care of your health. Feel free to come back if you have more questions.",
            intent: 'goodbye',
            sessionId
        };
    }

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
        sessionId
    };
}

exports.chatbot = onRequest(async (req, res) => {
    // CORS headers
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(204).send('');
    }

    try {
        const { message, sessionId } = req.body;

        if (!message) {
            return res.status(400).json({ success: false, error: 'Message is required' });
        }

        // Use simulation if client isn't available
        if (!sessionClient) {
            return res.json(simulateResponse(message));
        }

        const sessionPath = sessionClient.projectLocationAgentSessionPath(
            projectId,
            'global',
            sessionId || 'default-session'
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

        res.json({
            success: true,
            response: result.fulfillmentText,
            intent: result.intent?.displayName || 'default',
            sessionId: sessionId || 'default-session'
        });

    } catch (error) {
        console.error('Chatbot Error:', error);
        // Fallback to simulation on actual error
        res.json(simulateResponse(req.body.message || ''));
    }
});
