const functions = require('firebase-functions');
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Note: In a production environment, use functions.config() or Secret Manager for API keys
// For now, we will expect the key to be set via firebase functions:config:set gemini.key="your_key"
const genAI = new GoogleGenerativeAI(functions.config().gemini ? functions.config().gemini.key : process.env.GEMINI_API_KEY);

exports.analyzeReport = functions.https.onRequest(async (req, res) => {
    // Simple CORS implementation
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(204).send('');
    }

    try {
        const { image, mimeType } = req.body;

        if (!image) {
            return res.status(400).json({ success: false, error: 'Image data is required' });
        }

        // Using gemini-flash-latest as discovered in previous diagnostics
        const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

        const prompt = "Analyze this medical lab report image meticulously.\n1. Look at the header or top section to find patient demographics. Extract the EXACT patient's name as 'patientName'.\n2. Extract 'patientAge' and 'patientGender' if available.\n3. Extract all medical test results into the 'results' array.\n4. Provide a professional 'summary'.\n\nReturn ONLY a strictly valid JSON object with this structure:\n{\n  \"patientName\": \"FullName\",\n  \"patientAge\": \"Age\",\n  \"patientGender\": \"Gender\",\n  \"summary\": \"Brief interpretation\",\n  \"results\": [\n    { \"testName\": \"...\", \"value\": \"...\", \"unit\": \"...\", \"referenceRange\": \"...\", \"status\": \"Normal/High/Low\" }\n  ]\n}\n\nIf any demographic field is not found, set it to null. Do not use placeholders like 'Extracted Name'.";

        const imageParts = [
            {
                inlineData: {
                    data: image,
                    mimeType: mimeType || "image/jpeg"
                },
            },
        ];

        const result = await model.generateContent([prompt, ...imageParts]);
        const response = await result.response;
        const text = response.text();

        // Extract JSON from potential markdown formatting
        const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();

        let reportData;
        try {
            reportData = JSON.parse(cleanJson);
        } catch (parseError) {
            console.error('JSON Parse Error:', parseError, 'Raw Text:', text);
            return res.status(500).json({
                success: false,
                error: 'Failed to parse AI response',
                raw: text
            });
        }

        res.json({ success: true, data: reportData });
    } catch (error) {
        console.error('Analysis Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
