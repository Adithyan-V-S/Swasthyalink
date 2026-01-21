const functions = require('firebase-functions');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const { defineString } = require('firebase-functions/params');
const geminiKey = defineString('GEMINI_API_KEY');

const { onRequest } = require("firebase-functions/v2/https");

exports.analyzeReport = onRequest(async (req, res) => {
    const genAI = new GoogleGenerativeAI(geminiKey.value());
    const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

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

        const prompt = "Analyze this medical lab report. Extract the test names, results, units, and reference ranges. Identify if any result is 'High', 'Low', or 'Normal' based on the reference range. Provide a brief medical summary of the report and what it means for the patient. Provide the output in strictly valid JSON format with this structure: { \"summary\": \"Brief medical summary of the report\", \"results\": [ { \"testName\": \"Hemoglobin\", \"value\": \"14.5\", \"unit\": \"g/dL\", \"status\": \"Normal\", \"referenceRange\": \"13.5-17.5\" } ] }";

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
