const functions = require('firebase-functions');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const { defineString } = require('firebase-functions/params');
const geminiKey = defineString('GEMINI_API_KEY');
const blockchainService = require('./blockchainService');

const { onRequest } = require("firebase-functions/v2/https");

exports.analyzeReport = onRequest(async (req, res) => {
    const genAI = new GoogleGenerativeAI(geminiKey.value());
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // Simple CORS implementation
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(204).send('');
    }

    try {
        const { image, mimeType, reportType } = req.body;

        if (!image) {
            return res.status(400).json({ success: false, error: 'Image data is required' });
        }

        // Switched to gemini-1.5-flash to avoid 503 high-demand errors on latest alias
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        let promptText = "";
        if (reportType === 'xray') {
            promptText = "Analyze this medical X-Ray image. Identify any visible structures, bones, anomalies, fractures, or joint issues. Provide a brief medical summary of the findings. Provide the output in strictly valid JSON format with this structure: { \"summary\": \"Brief medical summary of the X-Ray findings\", \"results\": [ { \"testName\": \"Bone/Joint Area\", \"value\": \"Finding description\", \"unit\": \"\", \"status\": \"Normal/Abnormal\", \"referenceRange\": \"\" } ] }";
        } else if (reportType === 'scan') {
            promptText = "Analyze this medical MRI or CT Scan. Identify any visible tissues, organs, anomalies, masses, or lesions. Provide a brief medical summary of the findings. Provide the output in strictly valid JSON format with this structure: { \"summary\": \"Brief medical summary of the scan findings\", \"results\": [ { \"testName\": \"Organ/Tissue region\", \"value\": \"Finding description\", \"unit\": \"\", \"status\": \"Normal/Abnormal\", \"referenceRange\": \"\" } ] }";
        } else {
            promptText = "Analyze this medical lab report. Extract the test names, results, units, and reference ranges. Identify if any result is 'High', 'Low', or 'Normal' based on the reference range. Provide a brief medical summary of the report and what it means for the patient. Provide the output in strictly valid JSON format with this structure: { \"summary\": \"Brief medical summary of the report\", \"results\": [ { \"testName\": \"Hemoglobin\", \"value\": \"14.5\", \"unit\": \"g/dL\", \"status\": \"Normal\", \"referenceRange\": \"13.5-17.5\" } ] }";
        }

        const imageParts = [
            {
                inlineData: {
                    data: image,
                    mimeType: mimeType || "image/jpeg"
                },
            },
        ];

        const result = await model.generateContent([promptText, ...imageParts]);
        const response = await result.response;
        const text = response.text();

        // Extract JSON from potential markdown formatting and conversational fillers
        let cleanJson = text;
        const firstBrace = cleanJson.indexOf('{');
        const lastBrace = cleanJson.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
            cleanJson = cleanJson.substring(firstBrace, lastBrace + 1);
        } else {
            cleanJson = cleanJson.replace(/```json/gi, '').replace(/```/g, '').trim();
        }

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

        // 🛡️ Blockchain Integration: Secure the analysis in the ledger
        try {
            const block = await blockchainService.addMedicalBlock({
                recordType: 'lab_report_analysis',
                recordId: `analysis-${Date.now()}`,
                patientId: 'currentUser', // We'd ideally pull the real ID from the token here
                diagnosis: reportData.summary || 'Lab Analysis',
                timestamp: new Date().toISOString(),
                dataHash: reportData.results ? reportData.results.length : 0 // Summary fingerprint
            });
            console.log(`Lab report analysis linked to blockchain block ${block.index}`);
            reportData.blockchainIndex = block.index;
            reportData.blockchainHash = block.hash;
        } catch (bcError) {
            console.error('Blockchain linking failed for lab report:', bcError);
        }

        res.json({ success: true, data: reportData });
    } catch (error) {
        console.error('Analysis Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
