import axios from 'axios';

const REGION = 'us-central1';
const PROJECT_ID = 'swasthyalink-42535';
const CLOUD_FUNCTIONS_BASE = `https://${REGION}-${PROJECT_ID}.cloudfunctions.net`;

const API_BASE_URL = CLOUD_FUNCTIONS_BASE;

const mlService = {
  /**
   * Get health risk assessment from backend ML service
   * @param {Object} healthData - User health data
   * @returns {Promise<Object>} Risk assessment result
   */
  async getHealthRiskAssessment(healthData) {
    try {
      const response = await axios.post(`${API_BASE_URL}/healthRiskAssessment`, healthData);
      return response.data;
    } catch (error) {
      console.error('Error fetching health risk assessment:', error);
      throw new Error('Failed to get health risk assessment');
    }
  },

  async getHealthTrends(historicalData, userId) {
    try {
      const response = await axios.post(`${API_BASE_URL}/healthTrends`, { historicalData, userId });
      return response.data;
    } catch (error) {
      console.error('Error fetching health trends:', error);
      throw new Error('Failed to get health trends');
    }
  },

  async getDiseaseRisk(diseaseType, healthData) {
    try {
      const response = await axios.post(`${API_BASE_URL}/diseaseRisk`, { diseaseType, ...healthData });
      return response.data;
    } catch (error) {
      console.error('Error fetching disease risk:', error);
      throw new Error('Failed to get disease risk');
    }
  },

  async getHealthStats(dataPoints, metrics) {
    try {
      const response = await axios.post(`${API_BASE_URL}/healthStats`, { dataPoints, metrics });
      return response.data;
    } catch (error) {
      console.error('Error fetching health stats:', error);
      throw new Error('Failed to get health stats');
    }
  },

  async getHealthRecommendations(healthData) {
    try {
      const response = await axios.post(`${API_BASE_URL}/healthRecommendations`, healthData);
      return response.data;
    } catch (error) {
      console.error('Error fetching health recommendations:', error);
      throw new Error('Failed to get health recommendations');
    }
  },

  async validateHealthData(healthData) {
    try {
      const response = await axios.post(`${API_BASE_URL}/validateHealthData`, healthData);
      return response.data;
    } catch (error) {
      console.error('Error validating health data:', error);
      throw new Error('Failed to validate health data');
    }
  }

  // Additional ML service methods can be added here
};

export default mlService;
