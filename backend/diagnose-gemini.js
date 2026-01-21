require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function listModels() {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }, { apiVersion: 'v1' });
        console.log("Using API Version: v1");
        // Note: The library doesn't easily expose listModels without a service account sometimes, 
        // but we can try to get the model info.
        console.log("Checking API Key...");
        const result = await model.generateContent("test");
        console.log("API Key works!");
    } catch (error) {
        console.error("Error details:", error);
        if (error.message.includes("API_KEY_INVALID")) {
            console.error("CRITICAL: Your GEMINI_API_KEY is invalid.");
        }
    }
}

listModels();
