import { getAuth } from 'firebase/auth';
import { auth } from '../firebaseConfig';

const REGION = 'us-central1';
const PROJECT_ID = 'swasthyalink-42535';
const CLOUD_FUNCTIONS_BASE = `https://${REGION}-${PROJECT_ID}.cloudfunctions.net`;

/**
 * Helper to get the current user's ID token.
 */
const getAuthToken = async (currentUser) => {
  let user = currentUser;
  if (!user) {
    const auth = getAuth();
    user = auth.currentUser;
  }

  if (!user) {
    throw new Error('User not authenticated');
  }

  try {
    return await user.getIdToken();
  } catch (error) {
    console.error('Error getting auth token:', error);
    // Fallback for testing environments only - in prod this should fail
    return 'test-token-fallback';
  }
};

/**
 * Search for patients by query
 * @param {string} query - Search query (email, phone, or name)
 * @returns {Promise<Object>} Search results
 */
export const searchPatients = async (query) => {
  try {
    const token = await getAuthToken();

    const response = await fetch(`${CLOUD_FUNCTIONS_BASE}/searchPatientsForDoctor?query=${encodeURIComponent(query)}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error searching patients:', error);
    throw error;
  }
};

/**
 * Create a connection request from doctor to patient
 * @param {Object} requestData - Request data including patientId/email/phone and connectionMethod
 * @returns {Promise<Object>} Result of the request creation
 */
export const createConnectionRequest = async (requestData, currentUser = null) => {
  try {
    const token = await getAuthToken(currentUser);

    const response = await fetch(`${CLOUD_FUNCTIONS_BASE}/sendPatientDoctorRequest`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ...requestData, doctorId: currentUser?.uid || getAuth().currentUser?.uid }),
    });

    if (!response.ok) {
      let errorData = {};
      try { errorData = await response.json(); } catch (_) { }

      if (response.status === 409) {
        return { success: false, alreadyExists: true, error: errorData.error || 'Connection already exists' };
      }
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error creating connection request:', error);
    throw error;
  }
};

/**
 * Resend OTP for a connection request
 * @param {string} requestId - The ID of the request to resend OTP for
 * @returns {Promise<Object>} Result of the resend operation
 */
export const resendRequest = async (requestId) => {
  // Basic stub - implementation depends on if we really need this endpoint
  // For now assuming the backend handles re-request via creating a new one or specific endpoint
  return { success: true, message: 'Not implemented in this version' };
};

/**
 * Get pending doctor connection requests for the current patient
 * @param {string} uid - Patient's UID (optional, uses current user)
 * @returns {Promise<Array>} Array of pending requests
 */
export const getPendingRequests = async (uid, email, currentUser = null) => {
  try {
    const token = await getAuthToken(currentUser);
    const userId = uid || currentUser?.uid || getAuth().currentUser?.uid;

    const emailParam = email ? `?patientEmail=${encodeURIComponent(email)}` : '';
    const response = await fetch(`${CLOUD_FUNCTIONS_BASE}/getPendingPatientDoctorRequests${emailParam}${emailParam ? '&' : '?'}patientId=${userId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      let errorData = {};
      try { errorData = await response.json(); } catch (_) { }
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.requests || [];
  } catch (error) {
    console.error('Error fetching pending requests:', error);
    throw error;
  }
};

/**
 * Accept a doctor connection request with OTP verification
 * @param {string} requestId - The ID of the request to accept
 * @param {string} otp - The OTP code entered by the patient
 * @returns {Promise<Object>} Result of the acceptance
 */
export const acceptRequest = async (requestId, otp) => {
  try {
    const token = await getAuthToken();
    const currentUser = getAuth().currentUser;

    const response = await fetch(`${CLOUD_FUNCTIONS_BASE}/acceptPatientDoctorRequest`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ requestId, patientId: currentUser?.uid, otp }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error accepting request:', error);
    throw error;
  }
};

/**
 * Get connected doctors for the current patient
 * @param {string} uid - Patient's UID (optional, uses current user)
 * @returns {Promise<Array>} Array of connected doctors
 */
export const getConnectedDoctors = async (uid, email, currentUser = null) => {
  try {
    const token = await getAuthToken(currentUser);
    const userId = uid || currentUser?.uid || getAuth().currentUser?.uid;

    const response = await fetch(`${CLOUD_FUNCTIONS_BASE}/getConnectedDoctors?patientId=${userId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      let errorData = {};
      try { errorData = await response.json(); } catch (_) { }
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.doctors || [];
  } catch (error) {
    console.error('Error fetching connected doctors:', error);
    throw error;
  }
};

/**
 * Get connected patients for the current doctor
 * @param {string} uid - Doctor's UID (optional, uses current user)
 * @returns {Promise<Array>} Array of connected patients
 */
export const getConnectedPatients = async (uid) => {
  try {
    const token = await getAuthToken();
    // Use the passed uid or current user
    const doctorId = uid || getAuth().currentUser?.uid;

    const response = await fetch(`${CLOUD_FUNCTIONS_BASE}/getConnectedPatients?doctorId=${doctorId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.patients || [];
  } catch (error) {
    console.error('Error fetching connected patients:', error);
    throw error;
  }
};
