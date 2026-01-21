import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  getFamilyRequests,
  acceptFamilyRequest,
  rejectFamilyRequest,
  updateFamilyRequestRelationship
} from '../services/familyService';
import {
  createFamilyRequestAcceptedNotification,
  createNotification,
  NOTIFICATION_TYPES
} from '../services/notificationService';
import Button from './common/Button';

const EnhancedFamilyRequestManager = ({ onUpdate, onNavigateToChat }) => {
  const { currentUser } = useAuth();
  const [sentRequests, setSentRequests] = useState([]);
  const [receivedRequests, setReceivedRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [processingId, setProcessingId] = useState(null);
  const [editingRequest, setEditingRequest] = useState(null);
  const [recipientRelationship, setRecipientRelationship] = useState('');

  const relationships = [
    'Spouse', 'Parent', 'Child', 'Sibling', 'Grandparent',
    'Grandchild', 'Uncle', 'Aunt', 'Cousin', 'Friend', 'Caregiver'
  ];

  useEffect(() => {
    loadRequests();
  }, [currentUser]);

  const loadRequests = async () => {
    if (!currentUser) return;

    setLoading(true);
    setError('');

    try {
      console.log("Loading family requests for user email:", currentUser.email);
      const response = await getFamilyRequests(currentUser.email);

      if (response.success) {
        console.log("Family requests loaded:", response.requests);

        const filteredSent = (response.requests.sent || []).filter(req => req.status === 'pending');
        const filteredReceived = (response.requests.received || []).filter(req => req.status === 'pending');

        setSentRequests(filteredSent);
        setReceivedRequests(filteredReceived);
      } else {
        throw new Error(response.error || 'Failed to load requests');
      }
    } catch (error) {
      console.error('Error loading family requests:', error);
      setError('Failed to load family requests. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptWithRelationship = async (requestId) => {
    if (!recipientRelationship) {
      setError('Please specify your relationship to the sender');
      return;
    }

    setProcessingId(requestId);

    try {
      console.log("Accepting family request with relationship:", requestId, recipientRelationship);

      // Update the request with recipient's relationship
      await updateFamilyRequestRelationship({ requestId, newRelationship: recipientRelationship });

      // Accept the request
      const response = await acceptFamilyRequest(requestId);

      if (response.success) {
        console.log("Family request accepted successfully");

        // Find the request to get sender info
        const acceptedRequest = receivedRequests.find(req => req.id === requestId);

        // Send notification to the sender
        if (acceptedRequest) {
          await createFamilyRequestAcceptedNotification(
            acceptedRequest.fromUid,
            {
              uid: currentUser.uid,
              name: currentUser.displayName || currentUser.email,
              email: currentUser.email
            },
            recipientRelationship
          );
        }

        // Remove from received requests
        setReceivedRequests(prev => prev.filter(req => req.id !== requestId));

        // Update sent requests status
        setSentRequests(prev =>
          prev.map(req =>
            req.id === requestId
              ? { ...req, status: 'accepted' }
              : req
          )
        );

        // Notify parent component
        if (onUpdate) onUpdate();

        // Reset editing state
        setEditingRequest(null);
        setRecipientRelationship('');

        // Force a reload of the family network
        setTimeout(() => {
          loadRequests();
        }, 1000);

        // Show success message
        alert("Family request accepted successfully! You can now chat with your family member.");
      } else {
        throw new Error(response.error || 'Failed to accept request');
      }
    } catch (error) {
      console.error('Error accepting request:', error);
      setError('Failed to accept request. Please try again.');
      loadRequests();
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (requestId) => {
    setProcessingId(requestId);

    try {
      console.log("Rejecting family request:", requestId);

      setReceivedRequests(prev => prev.filter(req => req.id !== requestId));

      const response = await rejectFamilyRequest(requestId);

      if (response.success) {
        console.log("Family request rejected successfully");

        setSentRequests(prev =>
          prev.map(req =>
            req.id === requestId
              ? { ...req, status: 'rejected' }
              : req
          )
        );

        if (onUpdate) onUpdate();

        setTimeout(() => {
          loadRequests();
        }, 1000);

        alert("Family request rejected successfully!");
      } else {
        throw new Error(response.error || 'Failed to reject request');
      }
    } catch (error) {
      console.error('Error rejecting request:', error);
      setError('Failed to reject request. Please try again.');
      loadRequests();
    } finally {
      setProcessingId(null);
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '';

    const date = typeof timestamp === 'string'
      ? new Date(timestamp)
      : timestamp.toDate();

    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getRelationshipIcon = (relationship) => {
    const icons = {
      'Spouse': '💑',
      'Parent': '👨‍👩‍👧‍👦',
      'Child': '👶',
      'Sibling': '👫',
      'Grandparent': '👴',
      'Grandchild': '👶',
      'Uncle': '👨',
      'Aunt': '👩',
      'Cousin': '👥',
      'Friend': '🤝',
      'Caregiver': '🩺'
    };
    return icons[relationship] || '👤';
  };

  if (loading) {
    return (
      <div className="p-8 flex justify-center">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
          <p className="text-gray-600">Loading family requests...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-xl">
        <div className="flex items-start">
          <span className="material-icons text-red-600 mr-3 mt-1">error</span>
          <div className="flex-1">
            <h3 className="font-medium text-red-800 mb-2">Error Loading Requests</h3>
            <p className="text-sm text-red-700 mb-4">{error}</p>
            <Button
              onClick={loadRequests}
              variant="danger"
              size="small"
            >
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (receivedRequests.length === 0 && sentRequests.length === 0) {
    return (
      <div className="p-8 bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200 rounded-xl text-center">
        <div className="text-gray-400 mb-4">
          <span className="material-icons text-6xl">mail_outline</span>
        </div>
        <h3 className="text-xl font-semibold text-gray-800 mb-2">No Family Requests</h3>
        <p className="text-gray-600 mb-6">
          You don't have any pending family requests at the moment.
        </p>
        <div className="flex justify-center space-x-4">
          <Button
            onClick={loadRequests}
            variant="secondary"
            leftIcon={<span className="material-icons">refresh</span>}
          >
            Refresh Requests
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header with Stats */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold text-gray-800">Family Requests</h3>
          <p className="text-gray-600 mt-1">
            Manage your family network connections
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="bg-blue-100 text-blue-800 px-4 py-2 rounded-lg">
            <span className="text-sm font-medium">
              {receivedRequests.length} Received
            </span>
          </div>
          <div className="bg-green-100 text-green-800 px-4 py-2 rounded-lg">
            <span className="text-sm font-medium">
              {sentRequests.length} Sent
            </span>
          </div>
          <Button
            onClick={loadRequests}
            variant="ghost"
            size="small"
            leftIcon={<span className="material-icons">refresh</span>}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Received Requests */}
      {receivedRequests.length > 0 && (
        <div className="bg-white rounded-xl shadow-lg border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center">
              <span className="material-icons text-blue-600 mr-3">inbox</span>
              <h4 className="text-lg font-semibold text-gray-800">
                Received Requests ({receivedRequests.length})
              </h4>
            </div>
            <p className="text-sm text-gray-600 mt-1">
              People who want to connect with you
            </p>
          </div>

          <div className="divide-y divide-gray-200">
            {receivedRequests.map(request => (
              <div key={request.id} className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold text-lg mr-4">
                      {request.fromName?.charAt(0) || '?'}
                    </div>
                    <div>
                      <h5 className="font-semibold text-gray-900 text-lg">
                        {request.fromName}
                      </h5>
                      <p className="text-sm text-gray-600">
                        {request.fromEmail}
                      </p>
                      <div className="flex items-center mt-2">
                        <span className="text-2xl mr-2">
                          {getRelationshipIcon(request.relationship)}
                        </span>
                        <span className="text-sm text-gray-700">
                          Wants to add you as their <strong>{request.relationship}</strong>
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Sent {formatDate(request.createdAt)}
                      </p>
                    </div>
                  </div>
                  <span className="px-3 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full font-medium">
                    Pending
                  </span>
                </div>

                {editingRequest === request.id ? (
                  <div className="bg-gray-50 rounded-lg p-4 mb-4">
                    <h6 className="font-medium text-gray-800 mb-3">
                      Confirm Your Relationship
                    </h6>
                    <p className="text-sm text-gray-600 mb-4">
                      How would you describe your relationship to {request.fromName}?
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-4">
                      {relationships.map(rel => (
                        <button
                          key={rel}
                          onClick={() => setRecipientRelationship(rel)}
                          className={`p-3 text-sm rounded-lg border transition-all ${recipientRelationship === rel
                            ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                            : 'border-gray-200 hover:border-gray-300 text-gray-700'
                            }`}
                        >
                          <div className="flex items-center justify-center">
                            <span className="mr-2">{getRelationshipIcon(rel)}</span>
                            {rel}
                          </div>
                        </button>
                      ))}
                    </div>
                    <div className="flex justify-end space-x-2">
                      <Button
                        variant="secondary"
                        size="small"
                        onClick={() => {
                          setEditingRequest(null);
                          setRecipientRelationship('');
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="small"
                        onClick={() => handleAcceptWithRelationship(request.id)}
                        loading={processingId === request.id}
                        disabled={!recipientRelationship || processingId !== null}
                      >
                        Accept Request
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex space-x-3">
                    <Button
                      onClick={() => {
                        setEditingRequest(request.id);
                        setRecipientRelationship('');
                      }}
                      loading={processingId === request.id}
                      disabled={processingId !== null}
                      size="small"
                      leftIcon={<span className="material-icons">check</span>}
                    >
                      Accept
                    </Button>
                    <Button
                      onClick={() => handleReject(request.id)}
                      loading={processingId === request.id}
                      disabled={processingId !== null}
                      variant="danger"
                      size="small"
                      leftIcon={<span className="material-icons">close</span>}
                    >
                      Reject
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sent Requests */}
      {sentRequests.length > 0 && (
        <div className="bg-white rounded-xl shadow-lg border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center">
              <span className="material-icons text-green-600 mr-3">send</span>
              <h4 className="text-lg font-semibold text-gray-800">
                Sent Requests ({sentRequests.length})
              </h4>
            </div>
            <p className="text-sm text-gray-600 mt-1">
              Requests you've sent to others
            </p>
          </div>

          <div className="divide-y divide-gray-200">
            {sentRequests.map(request => (
              <div key={request.id} className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-teal-600 rounded-full flex items-center justify-center text-white font-semibold text-lg mr-4">
                      {request.toName?.charAt(0) || '?'}
                    </div>
                    <div>
                      <h5 className="font-semibold text-gray-900 text-lg">
                        {request.toName}
                      </h5>
                      <p className="text-sm text-gray-600">
                        {request.toEmail}
                      </p>
                      <div className="flex items-center mt-2">
                        <span className="text-2xl mr-2">
                          {getRelationshipIcon(request.relationship)}
                        </span>
                        <span className="text-sm text-gray-700">
                          Requested as your <strong>{request.relationship}</strong>
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Sent {formatDate(request.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className={`px-3 py-1 text-xs rounded-full font-medium ${request.status === 'pending'
                      ? 'bg-yellow-100 text-yellow-800'
                      : request.status === 'accepted'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                      }`}>
                      {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                    </span>
                    {request.status === 'accepted' && (
                      <Button
                        size="small"
                        variant="ghost"
                        className="mt-2"
                        onClick={() => onNavigateToChat && onNavigateToChat(request)}
                        leftIcon={<span className="material-icons">chat</span>}
                      >
                        Start Chat
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default EnhancedFamilyRequestManager;