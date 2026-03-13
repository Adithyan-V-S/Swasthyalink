import axios from 'axios';
import { getAuth } from 'firebase/auth';

const REGION = 'us-central1';
const PROJECT_ID = 'swasthyalink-42535';
const CLOUD_FUNCTIONS_BASE = `https://${REGION}-${PROJECT_ID}.cloudfunctions.net`;

const getAuthToken = async () => {
    const auth = getAuth();
    const user = auth.currentUser;
    if (user) {
        return await user.getIdToken();
    }
    return null;
};

export const logPhysioSession = async (sessionData) => {
    try {
        const token = await getAuthToken();
        const response = await axios.post(`${CLOUD_FUNCTIONS_BASE}/logPhysioSession`, sessionData, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });
        return response.data;
    } catch (error) {
        console.error("Error logging physio session:", error);
        throw error;
    }
};

export const logInjuryRisk = async (riskData) => {
    try {
        const token = await getAuthToken();
        const response = await axios.post(`${CLOUD_FUNCTIONS_BASE}/logInjuryRisk`, riskData, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });
        return response.data;
    } catch (error) {
        console.error("Error logging injury risk:", error);
        throw error;
    }
};
