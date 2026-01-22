/**
 * Prescription Service for SwasthyaLink
 * Handles prescription-related API calls
 */

import { getAuth } from 'firebase/auth';

const REGION = 'us-central1';
const PROJECT_ID = 'swasthyalink-42535';
const CLOUD_FUNCTIONS_BASE = `https://${REGION}-${PROJECT_ID}.cloudfunctions.net`;

/**
 * Get prescriptions for the current patient
 */
export const getPatientPrescriptions = async (currentUser = null) => {
  try {
    console.log('🔍 getPatientPrescriptions called with currentUser:', currentUser);

    // Use provided currentUser or fallback to auth.currentUser
    if (!currentUser) {
      const auth = getAuth();
      currentUser = auth.currentUser;
      console.log('⚠️ getPatientPrescriptions: Using fallback auth.currentUser with UID:', currentUser?.uid);
    } else {
      console.log('✅ getPatientPrescriptions: Using provided currentUser with UID:', currentUser?.uid);
    }

    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    let token;
    try {
      token = await currentUser.getIdToken();
      console.log('🔑 Got Firebase token for prescriptions:', token.substring(0, 20) + '...');
    } catch (error) {
      console.log('Firebase auth failed, using test token for prescriptions:', error.message);
      token = 'test-patient-token'; // Fallback for production
    }

    console.log('🌐 Making API call to:', `${API_BASE}/patient`);
    const response = await fetch(`${CLOUD_FUNCTIONS_BASE}/getPatientPrescriptions?patientId=${currentUser.uid}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    console.log('📡 API response status:', response.status);
    console.log('📡 API response ok:', response.ok);

    if (!response.ok) {
      let errorData = {};
      try { errorData = await response.json(); } catch (_) { }
      console.error('❌ API error response:', errorData);
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log('✅ Patient prescriptions fetched:', data);
    return data;
  } catch (error) {
    console.error('❌ Error fetching patient prescriptions:', error);
    throw error;
  }
};

/**
 * Get prescription details by ID
 */
export const getPrescriptionDetails = async (prescriptionId, currentUser = null) => {
  try {
    // Use provided currentUser or fallback to auth.currentUser
    if (!currentUser) {
      const auth = getAuth();
      currentUser = auth.currentUser;
    }

    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    let token;
    try {
      token = await currentUser.getIdToken();
    } catch (error) {
      console.log('Firebase auth failed, using test token for prescription details:', error.message);
      token = 'test-patient-token'; // Fallback for production
    }

    const response = await fetch(`${CLOUD_FUNCTIONS_BASE}/getPrescriptionDetails?prescriptionId=${prescriptionId}`, {
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
    console.log('✅ Prescription details fetched:', data);
    return data;
  } catch (error) {
    console.error('Error fetching prescription details:', error);
    throw error;
  }
};

/**
 * Update prescription status
 */
export const updatePrescriptionStatus = async (prescriptionId, status, currentUser = null) => {
  try {
    // Use provided currentUser or fallback to auth.currentUser
    if (!currentUser) {
      const auth = getAuth();
      currentUser = auth.currentUser;
    }

    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    let token;
    try {
      token = await currentUser.getIdToken();
    } catch (error) {
      console.log('Firebase auth failed, using test token for prescription status update:', error.message);
      token = 'test-patient-token'; // Fallback for production
    }

    const response = await fetch(`${CLOUD_FUNCTIONS_BASE}/updatePrescriptionStatus`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prescriptionId, status, userId: currentUser.uid }),
    });

    if (!response.ok) {
      let errorData = {};
      try { errorData = await response.json(); } catch (_) { }
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log('✅ Prescription status updated:', data);
    return data;
  } catch (error) {
    console.error('Error updating prescription status:', error);
    throw error;
  }
};

/**
 * Cancel prescription
 */
export const cancelPrescription = async (prescriptionId, reason = '', currentUser = null) => {
  try {
    // Use provided currentUser or fallback to auth.currentUser
    if (!currentUser) {
      const auth = getAuth();
      currentUser = auth.currentUser;
    }

    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    let token;
    try {
      token = await currentUser.getIdToken();
    } catch (error) {
      console.log('Firebase auth failed, using test token for prescription cancellation:', error.message);
      token = 'test-patient-token'; // Fallback for production
    }

    const response = await fetch(`${CLOUD_FUNCTIONS_BASE}/cancelPrescription`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prescriptionId, userId: currentUser.uid, reason }),
    });

    if (!response.ok) {
      let errorData = {};
      try { errorData = await response.json(); } catch (_) { }
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log('✅ Prescription cancelled:', data);
    return data;
  } catch (error) {
    console.error('Error cancelling prescription:', error);
    throw error;
  }
};
