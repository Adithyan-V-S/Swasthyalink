const { onRequest } = require("firebase-functions/v2/https");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { defineString } = require('firebase-functions/params');

const geminiKey = defineString('GEMINI_API_KEY');

// Prompt engineering for the health assistant
const HEALTH_ASSISTANT_SYSTEM_INSTRUCTION = `You are a helpful AI Health Assistant for Swasthyalink. 
Your goal is to provide accurate, balanced, and empathetic health and wellness information.
Always include a disclaimer that you are not a replacement for professional medical advice.
If asked about emergencies, advise the user to contact local emergency services immediately.
Keep your responses concise and easy to understand for patients.
Stay positive and encouraging.`;

exports.geminiChat = onRequest(async (req, res) => {
    // Simple CORS implementation
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(204).send('');
    }

    try {
        const { message } = req.body;

        if (!message) {
            return res.status(400).json({ success: false, error: 'Message is required' });
        }

        const genAI = new GoogleGenerativeAI(geminiKey.value());
        const model = genAI.getGenerativeModel({
            model: "gemini-flash-latest",
            systemInstruction: HEALTH_ASSISTANT_SYSTEM_INSTRUCTION
        });

        const result = await model.generateContent(message);
        const response = await result.response;
        const text = response.text();

        res.json({ success: true, response: text });
    } catch (error) {
        console.error('Gemini Chat Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
