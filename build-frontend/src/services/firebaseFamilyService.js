import { db, auth } from '../firebaseConfig';
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  deleteDoc,
  setDoc,
  writeBatch
} from 'firebase/firestore';
import {
  createFamilyRequestNotification,
  createFamilyRequestAcceptedNotification,
  createFamilyRequestRejectedNotification
} from './notificationService';

// Collection references
const usersCollection = collection(db, 'users');
const familyRequestsCollection = collection(db, 'familyRequests');
const familyNetworksCollection = collection(db, 'familyNetworks');

/**
 * Search for users in Firestore
 * @param {string} searchTerm - Email or name to search for
 * @param {string} currentUserUid - Current user's UID to exclude from results
 * @returns {Promise<Array>} - Array of matching users
 */
export const searchFirestoreUsers = async (searchTerm, currentUserUid) => {
  try {
    const results = [];

    // Search by email (case insensitive)
    const emailQuery = query(
      usersCollection,
      where('email', '>=', searchTerm.toLowerCase()),
      where('email', '<=', searchTerm.toLowerCase() + '\uf8ff')
    );

    const emailSnapshot = await getDocs(emailQuery);
    emailSnapshot.forEach(doc => {
      if (doc.id !== currentUserUid) {
        results.push({
          id: doc.id,
          ...doc.data()
        });
      }
    });

    // If no results by email, search by displayName
    if (results.length === 0) {
      const nameQuery = query(
        usersCollection,
        where('displayName', '>=', searchTerm),
        where('displayName', '<=', searchTerm + '\uf8ff')
      );

      const nameSnapshot = await getDocs(nameQuery);
      nameSnapshot.forEach(doc => {
        if (doc.id !== currentUserUid) {
          results.push({
            id: doc.id,
            ...doc.data()
          });
        }
      });
    }

    return results;
  } catch (error) {
    console.error('Error searching Firestore users:', error);
    throw error;
  }
};

/**
 * Send a family request to another user
 * @param {string} fromUid - Sender's UID
 * @param {string} fromEmail - Sender's email
 * @param {string} fromName - Sender's name
 * @param {string} toUid - Recipient's UID (if available)
 * @param {string} toEmail - Recipient's email
 * @param {string} toName - Recipient's name
 * @param {string} relationship - Relationship between users
 * @returns {Promise<Object>} - Created request
 */
export const sendFamilyRequest = async (fromUid, fromEmail, fromName, toUid, toEmail, toName, relationship) => {
  try {
    // Check if request already exists
    const existingQuery = query(
      familyRequestsCollection,
      where('fromUid', '==', fromUid),
      where('toEmail', '==', toEmail),
      where('status', '==', 'pending')
    );

    const existingSnapshot = await getDocs(existingQuery);
    if (!existingSnapshot.empty) {
      throw new Error('A pending request already exists for this user');
    }

    // Check if already in family network
    const networkQuery = query(
      familyNetworksCollection,
      where('userUid', '==', fromUid),
      where('members', 'array-contains', { email: toEmail })
    );

    const networkSnapshot = await getDocs(networkQuery);
    if (!networkSnapshot.empty) {
      throw new Error('This user is already in your family network');
    }

    // Create the request
    const newRequest = {
      fromUid,
      fromEmail,
      fromName,
      toUid,
      toEmail,
      toName,
      relationship,
      accessLevel: accessLevel || 'limited',
      isEmergencyContact: isEmergencyContact || false,
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    const requestRef = await addDoc(familyRequestsCollection, newRequest);

    // Create notification for recipient using centralized service (separate from batch for atomicity)
    if (toUid) {
      await createFamilyRequestNotification(toUid, { uid: fromUid, name: fromName, email: fromEmail }, relationship);
    }

    return {
      id: requestRef.id,
      ...newRequest,
      createdAt: new Date().toISOString() // Convert server timestamp to string for frontend
    };
  } catch (error) {
    console.error('Error sending family request:', error);
    throw error;
  }
};

/**
 * Accept a family request
 * @param {string} requestId - Request document ID
 * @param {string} currentUserUid - Current user's UID
 * @returns {Promise<Object>} - Updated request
 */
export const acceptFamilyRequest = async (requestId, currentUserUid) => {
  try {
    const requestRef = doc(familyRequestsCollection, requestId);
    const requestDoc = await getDoc(requestRef);

    if (!requestDoc.exists()) {
      throw new Error('Request not found');
    }

    const requestData = requestDoc.data();

    // Verify this request is for the current user
    if (requestData.toUid && requestData.toUid !== currentUserUid) {
      throw new Error('You are not authorized to accept this request');
    }

    if (requestData.status !== 'pending') {
      throw new Error('This request has already been processed');
    }

    // Check if the family network already contains the member to avoid unnecessary writes
    const senderNetworkRef = doc(familyNetworksCollection, requestData.fromUid);
    const senderNetworkDoc = await getDoc(senderNetworkRef);
    const senderMembers = senderNetworkDoc.exists() ? senderNetworkDoc.data().members || [] : [];
    const senderHasMember = senderMembers.some(member => member.email === (requestData.toEmail));

    const recipientNetworkRef = doc(familyNetworksCollection, requestData.toUid || currentUserUid);
    const recipientNetworkDoc = await getDoc(recipientNetworkRef);
    const recipientMembers = recipientNetworkDoc.exists() ? recipientNetworkDoc.data().members || [] : [];
    const recipientHasMember = recipientMembers.some(member => member.email === (requestData.fromEmail));

    // Use batch write to update request and add family network members atomically
    const batch = writeBatch(db);

    // Update request status
    batch.update(requestRef, {
      status: 'accepted',
      updatedAt: serverTimestamp()
    });

    // Add to sender's family network only if not already present
    if (!senderHasMember) {
      const senderMemberData = {
        uid: requestData.toUid || currentUserUid,
        email: requestData.toEmail,
        name: requestData.toName,
        relationship: requestData.relationship,
        accessLevel: requestData.accessLevel || 'limited',
        isEmergencyContact: requestData.isEmergencyContact || false,
        addedAt: new Date().toISOString()
      };
      batch.update(senderNetworkRef, {
        members: arrayUnion(senderMemberData),
        updatedAt: serverTimestamp()
      });
    }

    // Add to recipient's family network only if not already present
    if (!recipientHasMember) {
      const recipientMemberData = {
        uid: requestData.fromUid,
        email: requestData.fromEmail,
        name: requestData.fromName,
        relationship: getInverseRelationship(requestData.relationship),
        accessLevel: 'limited',
        isEmergencyContact: false,
        addedAt: new Date().toISOString()
      };
      batch.update(recipientNetworkRef, {
        members: arrayUnion(recipientMemberData),
        updatedAt: serverTimestamp()
      });
    }

    // Commit batch
    await batch.commit();

    // Create notification for sender using centralized service (separate from batch)
    await createFamilyRequestAcceptedNotification(requestData.fromUid, { uid: currentUserUid, name: requestData.toName, email: requestData.toEmail }, requestData.relationship);

    return {
      id: requestId,
      ...requestData,
      status: 'accepted',
      updatedAt: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error accepting family request:', error);
    throw error;
  }
};

/**
 * Reject a family request
 * @param {string} requestId - Request document ID
 * @param {string} currentUserUid - Current user's UID
 * @returns {Promise<Object>} - Updated request
 */
export const rejectFamilyRequest = async (requestId, currentUserUid) => {
  try {
    const requestRef = doc(familyRequestsCollection, requestId);
    const requestDoc = await getDoc(requestRef);

    if (!requestDoc.exists()) {
      throw new Error('Request not found');
    }

    const requestData = requestDoc.data();

    // Verify this request is for the current user
    if (requestData.toUid && requestData.toUid !== currentUserUid) {
      throw new Error('You are not authorized to reject this request');
    }

    if (requestData.status !== 'pending') {
      throw new Error('This request has already been processed');
    }

    // Update request status
    await updateDoc(requestRef, {
      status: 'rejected',
      updatedAt: serverTimestamp()
    });

    // Create notification for sender using centralized service
    await createFamilyRequestRejectedNotification(requestData.fromUid, { uid: currentUserUid, name: requestData.toName, email: requestData.toEmail }, requestData.relationship);

    return {
      id: requestId,
      ...requestData,
      status: 'rejected',
      updatedAt: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error rejecting family request:', error);
    throw error;
  }
};

/**
 * Get all family requests for a user
 * @param {string} userUid - User's UID
 * @returns {Promise<Object>} - Sent and received requests
 */
export const getFamilyRequests = async (userUid) => {
  // Check if this is a test user (mock authentication)
  const isTestUser = localStorage.getItem('testUser') !== null;

  if (isTestUser) {
    console.log('🧪 Using test user - returning empty family requests');
    return {
      sent: [],
      received: []
    };
  }

  try {
    // Get sent requests
    const sentQuery = query(
      familyRequestsCollection,
      where('fromUid', '==', userUid)
    );

    const sentSnapshot = await getDocs(sentQuery);
    const sentRequests = [];

    sentSnapshot.forEach(doc => {
      sentRequests.push({
        id: doc.id,
        ...doc.data()
      });
    });

    // Get received requests
    const receivedQuery = query(
      familyRequestsCollection,
      where('toUid', '==', userUid),
      where('status', '==', 'pending')
    );

    const receivedSnapshot = await getDocs(receivedQuery);
    const receivedRequests = [];

    receivedSnapshot.forEach(doc => {
      receivedRequests.push({
        id: doc.id,
        ...doc.data()
      });
    });

    return {
      sent: sentRequests,
      received: receivedRequests
    };
  } catch (error) {
    console.error('Error getting family requests:', error);
    throw error;
  }
};

export const getFamilyNetwork = async (userUid) => {
  console.log('🔍 getFamilyNetwork called with userUid:', userUid);

  try {
    // Read by UID doc to comply with rules match /familyNetworks/{userId}
    const networkRef = doc(familyNetworksCollection, userUid);
    const networkDoc = await getDoc(networkRef);

    if (!networkDoc.exists()) {
      return [];
    }

    const networkData = networkDoc.data();
    const members = networkData.members || [];

    // Deduplicate members by email and UID to prevent duplicates
    // Filter out disabled members first
    const activeMembers = members.filter(member => !member.isDisabled);

    const uniqueMembers = activeMembers.reduce((acc, member) => {
      const existingMember = acc.find(m =>
        (m.email && member.email && m.email === member.email) ||
        (m.uid && member.uid && m.uid === member.uid)
      );

      if (!existingMember) {
        acc.push(member);
      } else {
        // If duplicate found, keep the one with more complete data
        const mergedMember = {
          ...existingMember,
          ...member,
          // Prefer non-null values
          name: member.name || existingMember.name,
          email: member.email || existingMember.email,
          uid: member.uid || existingMember.uid,
          relationship: member.relationship || existingMember.relationship
        };
        const index = acc.findIndex(m => m === existingMember);
        acc[index] = mergedMember;
      }
      return acc;
    }, []);

    return uniqueMembers;
  } catch (error) {
    console.error('Error getting family network:', error);
    throw error;
  }
};

/**
 * Disable a member from family network (soft delete - preserves data)
 * @param {string} userUid - Current user's UID
 * @param {string} memberEmail - Email of member to disable
 * @returns {Promise<boolean>} - Success status
 */
export const removeFamilyMember = async (userUid, memberEmail) => {
  try {
    // Get user's network document by fixed ID
    const networkRef = doc(familyNetworksCollection, userUid);
    const networkDocSnap = await getDoc(networkRef);

    if (!networkDocSnap.exists()) {
      throw new Error('Family network not found');
    }

    const networkData = networkDocSnap.data();

    // Find the member to disable
    const memberToDisable = networkData.members.find(member => member.email === memberEmail);

    if (!memberToDisable) {
      throw new Error('Member not found in family network');
    }

    // Update member to disabled status instead of removing
    const updatedMembers = (networkData.members || []).map(member =>
      member.email === memberEmail
        ? {
          ...member,
          isDisabled: true,
          disabledAt: new Date().toISOString(),
          disabledBy: userUid
        }
        : member
    );

    await updateDoc(networkRef, {
      members: updatedMembers,
      updatedAt: serverTimestamp()
    });

    // Also disable the reverse connection
    const usersQuery = query(
      usersCollection,
      where('email', '==', memberEmail)
    );

    const usersSnapshot = await getDocs(usersQuery);

    if (!usersSnapshot.empty) {
      const memberUid = usersSnapshot.docs[0].id;

      // Get the other user's network
      const otherNetworkRef = doc(familyNetworksCollection, memberUid);
      const otherNetworkDoc = await getDoc(otherNetworkRef);

      if (otherNetworkDoc.exists()) {
        const otherNetworkData = otherNetworkDoc.data();

        // Find current user in the other network by UID and disable
        const updatedOtherMembers = (otherNetworkData.members || []).map(member =>
          member.uid === userUid
            ? {
              ...member,
              isDisabled: true,
              disabledAt: new Date().toISOString(),
              disabledBy: memberUid
            }
            : member
        );

        await updateDoc(otherNetworkRef, {
          members: updatedOtherMembers,
          updatedAt: serverTimestamp()
        });
      }
    }

    console.log(`✅ Family member ${memberEmail} disabled (soft delete) - data preserved in Firestore`);
    return true;
  } catch (error) {
    console.error('Error disabling family member:', error);
    throw error;
  }
};

/**
 * Helper function to add a member to a user's family network
 * @param {string} userUid - User's UID
 * @param {string} memberUid - Member's UID
 * @param {string} memberEmail - Member's email
 * @param {string} memberName - Member's name
 * @param {string} relationship - Relationship to member
 * @returns {Promise<void>}
 */
const addToFamilyNetwork = async (userUid, memberUid, memberEmail, memberName, relationship) => {
  try {
    // Check if user already has a network document
    const networkQuery = query(
      familyNetworksCollection,
      where('userUid', '==', userUid)
    );

    const networkSnapshot = await getDocs(networkQuery);

    const memberData = {
      uid: memberUid,
      email: memberEmail,
      name: memberName,
      relationship: relationship,
      accessLevel: 'limited', // Default access level
      isEmergencyContact: false,
      addedAt: new Date().toISOString()
    };

    if (networkSnapshot.empty) {
      // Create new network document whose doc ID is the userUid (aligns with rules)
      await setDoc(doc(familyNetworksCollection, userUid), {
        userUid: userUid,
        members: [memberData],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } else {
      // Update existing network document (use UID as key if present)
      const existingDocId = networkSnapshot.docs[0]?.id || userUid;
      await updateDoc(doc(familyNetworksCollection, existingDocId), {
        members: arrayUnion(memberData),
        updatedAt: serverTimestamp()
      });
    }
  } catch (error) {
    console.error('Error adding to family network:', error);
    throw error;
  }
};

/**
 * Update family member access level
 * @param {string} userUid - Current user's UID
 * @param {string} memberEmail - Email of member to update
 * @param {string} accessLevel - New access level (full, limited, emergency)
 * @param {boolean} isEmergencyContact - Whether member is emergency contact
 * @returns {Promise<boolean>} - Success status
 */
export const updateFamilyMemberAccess = async (userUid, memberEmail, accessLevel, isEmergencyContact) => {
  try {
    // Get user's network document by UID
    const networkRef = doc(familyNetworksCollection, userUid);
    const networkSnap = await getDoc(networkRef);

    if (!networkSnap.exists()) {
      throw new Error('Family network not found');
    }

    const networkData = networkSnap.data();

    // Find the member to update
    const memberIndex = (networkData.members || []).findIndex(member => member.email === memberEmail);
    if (memberIndex === -1) {
      throw new Error('Member not found in family network');
    }

    // Create updated members array
    const updatedMembers = [...networkData.members];
    updatedMembers[memberIndex] = {
      ...updatedMembers[memberIndex],
      accessLevel,
      isEmergencyContact,
      updatedAt: new Date().toISOString()
    };

    // Update the document
    await updateDoc(networkRef, {
      members: updatedMembers,
      updatedAt: serverTimestamp()
    });

    return true;
  } catch (error) {
    console.error('Error updating family member access:', error);
    throw error;
  }
};

/**
 * Helper function to get the inverse relationship
 * @param {string} relationship - Original relationship
 * @returns {string} - Inverse relationship
 */
const getInverseRelationship = (relationship) => {
  const inverseMap = {
    'Spouse': 'Spouse',
    'Parent': 'Child',
    'Child': 'Parent',
    'Sibling': 'Sibling',
    'Grandparent': 'Grandchild',
    'Grandchild': 'Grandparent',
    'Uncle': 'Niece/Nephew',
    'Aunt': 'Niece/Nephew',
    'Niece/Nephew': 'Uncle/Aunt',
    'Cousin': 'Cousin',
    'Friend': 'Friend',
    'Caregiver': 'Patient'
  };

  return inverseMap[relationship] || 'Family Member';
};