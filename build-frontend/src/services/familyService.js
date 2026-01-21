import { db, auth } from '../firebaseConfig';
import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  query,
  where,
  updateDoc,
  deleteDoc,
  serverTimestamp
} from 'firebase/firestore';
import {
  createFamilyRequestNotification,
  createFamilyRequestAcceptedNotification,
  createFamilyRequestRejectedNotification
} from './notificationService';
import { getFamilyNetwork as getFirebaseFamilyNetwork } from './firebaseFamilyService';

// Send a family request
export const sendFamilyRequest = async (requestData) => {
  try {
    const response = await fetch('https://us-central1-swasthyalink-42535.cloudfunctions.net/sendFamilyRequest', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestData)
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to send family request');
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error sending family request:', error);
    return { success: false, error: error.message };
  }
};

// Accept a family request
export const acceptFamilyRequest = async (requestId) => {
  try {
    const response = await fetch('https://us-central1-swasthyalink-42535.cloudfunctions.net/acceptFamilyRequest', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ id: requestId })
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to accept family request');
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error accepting family request:', error);
    return { success: false, error: error.message };
  }
};

// Reject a family request
export const rejectFamilyRequest = async (requestId) => {
  try {
    const response = await fetch('https://us-central1-swasthyalink-42535.cloudfunctions.net/rejectFamilyRequest', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ id: requestId })
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to reject family request');
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error rejecting family request:', error);
    return { success: false, error: error.message };
  }
};

// Get family requests 
export const getFamilyRequests = async (userEmail) => {
  try {
    const response = await fetch(`https://us-central1-swasthyalink-42535.cloudfunctions.net/getFamilyRequests?email=${encodeURIComponent(userEmail)}`);
    if (!response.ok) {
      throw new Error('Failed to fetch family requests');
    }
    const data = await response.json();
    return {
      success: true,
      requests: {
        sent: data.sent,
        received: data.received
      }
    };
  } catch (error) {
    console.error('Error fetching family requests:', error);
    return { success: false, error: error.message };
  }
};

// Get family network
export const getFamilyNetwork = async (userUid) => {
  try {
    const response = await fetch(`https://us-central1-swasthyalink-42535.cloudfunctions.net/getFamilyNetwork?uid=${encodeURIComponent(userUid)}`);
    if (!response.ok) {
      throw new Error('Failed to fetch family network');
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching family network:', error);
    return { success: false, error: error.message };
  }
};

// Disable family member (soft delete - preserves data)
export const removeFamilyMember = async (userUid, memberUid) => {
  try {
    console.log('🔒 Disabling family member (soft delete):', { userUid, memberUid });

    // Import the real function from firebaseFamilyService
    const { removeFamilyMember: firebaseRemoveMember } = await import('./firebaseFamilyService');

    // Call the soft delete function
    await firebaseRemoveMember(userUid, memberUid);

    return {
      success: true,
      message: 'Family member disabled successfully (data preserved)',
      softDelete: true
    };
  } catch (error) {
    console.error('Error disabling family member:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Update member access level
export const updateMemberAccessLevel = async (userUid, memberEmail, accessLevel, isEmergencyContact) => {
  try {
    const { updateFamilyMemberAccess: firebaseUpdateAccess } = await import('./firebaseFamilyService');
    const success = await firebaseUpdateAccess(userUid, memberEmail, accessLevel, isEmergencyContact);
    return { success };
  } catch (error) {
    console.error('Error updating member access level:', error);
    return { success: false, error: error.message };
  }
};

// Backward-compatibility alias for UI components expecting this name
export const updateFamilyMemberAccess = updateMemberAccessLevel;

// New function to search users via backend API
export const searchUsers = async (query) => {
  try {
    const response = await fetch(`https://us-central1-swasthyalink-42535.cloudfunctions.net/searchUsers?query=${encodeURIComponent(query)}`);
    if (!response.ok) {
      throw new Error('Failed to fetch search results');
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error in searchUsers:', error);
    return { success: false, results: [] };
  }
};

// New function to update family request relationship
export const updateFamilyRequestRelationship = async ({ requestId, newRelationship }) => {
  try {
    const response = await fetch(`https://us-central1-swasthyalink-42535.cloudfunctions.net/updateRelationship`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ requestId, newRelationship })
    });
    if (!response.ok) {
      throw new Error('Failed to update family request relationship');
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error in updateFamilyRequestRelationship:', error);
    return { success: false, error: error.message };
  }
};
