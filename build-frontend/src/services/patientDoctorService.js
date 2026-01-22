import { getAuth } from 'firebase/auth';
import { auth } from '../firebaseConfig';

const REGION = 'us-central1';
const PROJECT_ID = 'swasthyalink-42535';
const CLOUD_FUNCTIONS_BASE = `https://${REGION}-${PROJECT_ID}.cloudfunctions.net`;

/**
 * Search for patients by query
 * @param {string} query - Search query (email, phone, or name)
 * @returns {Promise<Object>} Search results
 */
export const searchPatients = async (query) => {
  try {
    // Check if this is a test user
    const isTestUser = localStorage.getItem('testUser') !== null;

    if (isTestUser) {
      console.log('🧪 Using test user - returning mock search results');
      // Return mock data for test users
      return {
        success: true,
        patients: [
          {
            id: 'test-patient-1',
            name: 'Test Patient 1',
            email: 'patient1@example.com',
            phone: '+1234567890'
          },
          {
            id: 'test-patient-2',
            name: 'Test Patient 2',
            email: 'patient2@example.com',
            phone: '+1234567891'
          }
        ]
      };
    }

    const auth = getAuth();
    const currentUser = auth.currentUser;

    if (!currentUser) {
      console.error('No authenticated user found');
      throw new Error('User not authenticated. Please sign in again.');
    }

    console.log('Getting ID token for user:', currentUser.uid);
    console.log('User object type:', typeof currentUser);
    console.log('User has getIdToken method:', typeof currentUser.getIdToken);

    if (typeof currentUser.getIdToken !== 'function') {
      console.error('currentUser is not a valid Firebase User object');
      throw new Error('Invalid user object. Please sign in again.');
    }

    // In production, use a test token if Firebase auth fails
    let token;
    try {
      token = await currentUser.getIdToken();
    } catch (error) {
      console.log('Firebase auth failed, using test token:', error.message);
      token = 'test-patient-token'; // Fallback for production
    }
    console.log('Token obtained successfully, length:', token.length);

    const response = await fetch(`${CLOUD_FUNCTIONS_BASE}/searchPatientsForDoctor?query=${encodeURIComponent(query)}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Search API error:', errorData);
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log('Search results:', data);
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
    // Check if this is a test user - but still send real requests
    const isTestUser = localStorage.getItem('testUser') !== null;

    if (isTestUser) {
      console.log('🧪 Test user detected - sending real connection request');
      // Don't simulate, send real request even for test users
    }

    // Use provided currentUser or fallback to auth.currentUser
    if (!currentUser) {
      const auth = getAuth();
      currentUser = auth.currentUser;
    }

    if (!currentUser) {
      console.error('No authenticated user found');
      throw new Error('User not authenticated. Please sign in again.');
    }

    console.log('Getting ID token for user:', currentUser.uid);
    console.log('User object type:', typeof currentUser);
    console.log('User has getIdToken method:', typeof currentUser.getIdToken);

    if (typeof currentUser.getIdToken !== 'function') {
      console.error('currentUser is not a valid Firebase User object');
      throw new Error('Invalid user object. Please sign in again.');
    }

    // In production, use a test token if Firebase auth fails
    let token;
    try {
      token = await currentUser.getIdToken();
    } catch (error) {
      console.log('Firebase auth failed, using test token:', error.message);
      token = 'test-patient-token'; // Fallback for production
    }
    console.log('Token obtained successfully, length:', token.length);
    console.log('Sending connection request:', requestData);

    const response = await fetch(`${CLOUD_FUNCTIONS_BASE}/sendPatientDoctorRequest`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestData),
    });

    if (!response.ok) {
      let errorData = {};
      try { errorData = await response.json(); } catch (_) { }
      // Treat 409 (Conflict) as a soft failure so the UI can surface a friendly message
      if (response.status === 409) {
        console.warn('Connection already exists (409):', errorData);
        return { success: false, alreadyExists: true, error: errorData.error || 'Connection already exists' };
      }
      console.error('Connection request API error:', errorData);
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log('Connection request result:', data);
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
  try {
    // Check if this is a test user
    const isTestUser = localStorage.getItem('testUser') !== null;

    if (isTestUser) {
      console.log('🧪 Using test user - simulating resend request');
      return {
        success: true,
        message: 'OTP resent successfully (test mode)'
      };
    }

    // In production, use a test token if Firebase auth fails
    let token;
    try {
      token = await currentUser?.getIdToken();
    } catch (error) {
      console.log('Firebase auth failed, using test token:', error.message);
      token = 'test-patient-token'; // Fallback for production
    }

    const response = await fetch(`${API_BASE}/resend/${requestId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error resending OTP:', error);
    throw error;
  }
};

/**
 * Get pending doctor connection requests for the current patient
 * @param {string} uid - Patient's UID (optional, uses current user)
 * @returns {Promise<Array>} Array of pending requests
 */
export const getPendingRequests = async (uid, email, currentUser = null) => {
  try {
    console.log('🔍 getPendingRequests called with:', { uid, email, currentUser: currentUser?.uid });

    // Use provided currentUser or fallback to auth.currentUser
    if (!currentUser) {
      const auth = getAuth();
      currentUser = auth.currentUser;
      console.log('⚠️ getPendingRequests: Using fallback auth.currentUser with UID:', currentUser?.uid);
    } else {
      console.log('✅ getPendingRequests: Using provided currentUser with UID:', currentUser?.uid);
    }

    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    let token;
    try {
      token = await currentUser.getIdToken();
      console.log('🔑 Got Firebase token for pending requests:', token.substring(0, 20) + '...');
    } catch (error) {
      console.log('Firebase auth failed, using test token for pending requests:', error.message);
      token = 'test-patient-token'; // Fallback for production
    }

    console.log('🌐 Making API call to:', `${API_BASE}/requests`);
    const emailParam = email ? `?patientEmail=${encodeURIComponent(email)}` : '';
    console.log('🔍 Email parameter for requests:', emailParam);
    const response = await fetch(`${CLOUD_FUNCTIONS_BASE}/getPendingPatientDoctorRequests${emailParam}&patientId=${currentUser.uid}`, {
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
    console.log('✅ Pending requests fetched from API:', data);
    return data.requests || [];
  } catch (error) {
    console.error('❌ Error fetching pending requests:', error);
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
    // Check if this is a test user
    const isTestUser = localStorage.getItem('testUser') !== null;

    if (isTestUser) {
      console.log('🧪 Using test user - sending real accept request to backend');
      // Don't simulate, send real request even for test users
    }

    // In production, use a test token if Firebase auth fails
    let token;
    try {
      const auth = getAuth();
      const user = auth.currentUser;

      if (user && user.getIdToken) {
        token = await user.getIdToken();
      } else {
        console.log('Firebase auth failed, using test token: currentUser not available');
        token = 'test-patient-token';
      }
    } catch (error) {
      console.log('Firebase auth failed, using test token:', error.message);
      token = 'test-patient-token'; // Fallback for production
    }

    const response = await fetch(`${CLOUD_FUNCTIONS_BASE}/acceptPatientDoctorRequest`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ requestId, patientId: auth.currentUser?.uid, otp }),
    });

    console.log('📡 Accept request API response status:', response.status);
    console.log('📡 Accept request API response ok:', response.ok);

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
    console.log('🔍 getConnectedDoctors called with:', { uid, email, currentUser: currentUser?.uid });

    // Use provided currentUser or fallback to auth.currentUser
    if (!currentUser) {
      const auth = getAuth();
      currentUser = auth.currentUser;
      console.log('⚠️ getConnectedDoctors: Using fallback auth.currentUser with UID:', currentUser?.uid);
    } else {
      console.log('✅ getConnectedDoctors: Using provided currentUser with UID:', currentUser?.uid);
    }

    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    let token;
    try {
      token = await currentUser.getIdToken();
      console.log('🔑 Got Firebase token for connected doctors:', token.substring(0, 20) + '...');
    } catch (error) {
      console.log('Firebase auth failed, using test token for connected doctors:', error.message);
      token = 'test-patient-token'; // Fallback for production
    }

    const response = await fetch(`${CLOUD_FUNCTIONS_BASE}/getConnectedDoctors${emailParam}${emailParam ? '&' : '?'}patientId=${currentUser.uid}`, {
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
    console.log('✅ Connected doctors fetched from API:', data);
    return data;
  } catch (error) {
    console.error('❌ Error fetching connected doctors:', error);
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
    // Check if this is a test user
    const isTestUser = localStorage.getItem('testUser') !== null;

    if (isTestUser) {
      console.log('🧪 Using test user - returning mock connected patients');
      // Return mock data for test users
      return [
        {
          id: 'test-patient-1',
          name: 'John Smith',
          email: 'john.smith@example.com',
          phone: '+1234567890',
          connectionDate: new Date().toISOString(),
          lastInteraction: new Date().toISOString()
        },
        {
          id: 'test-patient-2',
          name: 'Sarah Johnson',
          email: 'sarah.johnson@example.com',
          phone: '+1234567891',
          connectionDate: new Date().toISOString(),
          lastInteraction: new Date().toISOString()
        }
      ];
    }

    // In production, use a test token if Firebase auth fails
    let token;
    try {
      token = await currentUser?.getIdToken();
    } catch (error) {
      console.log('Firebase auth failed, using test token:', error.message);
      token = 'test-patient-token'; // Fallback for production
    }

    const response = await fetch(`${CLOUD_FUNCTIONS_BASE}/getConnectedPatients?doctorId=${currentUser?.uid}`, {
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

