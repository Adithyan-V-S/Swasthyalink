import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { searchUsers, sendFamilyRequest } from '../services/familyService';
import { db } from '../firebaseConfig';
import { collection, query, where, getDocs } from 'firebase/firestore';
import Button from './common/Button';
import Input from './common/Input';

const UpdatedAddFamilyMember = ({ isOpen, onClose, onAdd }) => {
  const { currentUser } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [relationship, setRelationship] = useState('');
  const [accessLevel, setAccessLevel] = useState('limited');
  const [isEmergencyContact, setIsEmergencyContact] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const relationships = [
    'Spouse', 'Parent', 'Child', 'Sibling', 'Grandparent',
    'Grandchild', 'Uncle', 'Aunt', 'Cousin', 'Friend', 'Caregiver'
  ];

  // Search for users in Firestore
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setError('');
    setSearchResults([]);

    try {
      // First try to search in Firestore users collection
      const usersRef = collection(db, 'users');
      const q = query(
        usersRef,
        where('email', '>=', searchQuery.toLowerCase()),
        where('email', '<=', searchQuery.toLowerCase() + '\uf8ff')
      );

      const querySnapshot = await getDocs(q);
      const users = [];

      querySnapshot.forEach((doc) => {
        // Don't include current user in results
        if (doc.id !== currentUser.uid) {
          users.push({
            id: doc.id,
            ...doc.data()
          });
        }
      });

      // If no results from email, try name search in Firestore
      if (users.length === 0) {
        const nameQuery = query(
          usersRef,
          where('displayName', '>=', searchQuery),
          where('displayName', '<=', searchQuery + '\uf8ff')
        );

        const nameQuerySnapshot = await getDocs(nameQuery);
        nameQuerySnapshot.forEach((doc) => {
          if (doc.id !== currentUser.uid) {
            users.push({
              id: doc.id,
              ...doc.data()
            });
          }
        });
      }

      // If users found in Firestore, use them
      if (users.length > 0) {
        setSearchResults(users);
      } else {
        // Fall back to backend API if no users found in Firestore
        const response = await searchUsers(searchQuery);
        if (response.success) {
          // Filter out current user
          const filteredResults = response.results.filter(user =>
            user.email !== currentUser?.email
          );
          setSearchResults(filteredResults);
        }
      }
    } catch (error) {
      console.error('Error searching for users:', error);
      setError('Failed to search for users. Please try again.');

      // Try backend API as fallback
      try {
        const response = await searchUsers(searchQuery);
        if (response.success) {
          const filteredResults = response.results.filter(user =>
            user.email !== currentUser?.email
          );
          setSearchResults(filteredResults);
        }
      } catch (backendError) {
        console.error('Backend search also failed:', backendError);
      }
    } finally {
      setIsSearching(false);
    }
  };

  // Send family request
  const handleSendRequest = async () => {
    if (!selectedUser || !relationship) {
      setError('Please select a user and relationship');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      console.log("Sending family request with data:", {
        fromEmail: currentUser.email,
        toEmail: selectedUser.email,
        toName: selectedUser.displayName || selectedUser.name,
        relationship: relationship
      });

      const response = await sendFamilyRequest({
        fromUid: currentUser.uid,
        fromEmail: currentUser.email,
        fromName: currentUser.displayName || currentUser.name || 'User',
        toUid: selectedUser.id || selectedUser.uid,
        toEmail: selectedUser.email,
        toName: selectedUser.displayName || selectedUser.name,
        relationship: relationship,
        accessLevel: accessLevel,
        isEmergencyContact: isEmergencyContact
      });

      console.log("Family request response:", response);

      if (response.success) {
        setSuccess('Family request sent successfully!');
        onAdd({
          id: response.request.id,
          name: selectedUser.displayName || selectedUser.name,
          email: selectedUser.email,
          relationship: relationship,
          accessLevel: accessLevel,
          isEmergencyContact: isEmergencyContact,
          status: 'pending',
          dateAdded: new Date().toISOString()
        });

        // Clear form
        setSelectedUser(null);
        setRelationship('');
        setAccessLevel('limited');
        setIsEmergencyContact(false);
        setSearchQuery('');
        setSearchResults([]);

        // Close modal after a delay
        setTimeout(() => {
          onClose();
        }, 2000);
      } else {
        throw new Error(response.error || 'Failed to send request');
      }
    } catch (error) {
      console.error('Error sending family request:', error);
      setError(error.message || 'Failed to send family request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Enter key in search input
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // Clear form when modal is closed
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setSearchResults([]);
      setSelectedUser(null);
      setRelationship('');
      setError('');
      setSuccess('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-800">Add Family Member</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <span className="material-icons">close</span>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Search Section */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search for Registered Users
            </label>
            <div className="flex">
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Enter email or name"
                leftIcon={<span className="material-icons text-gray-400">search</span>}
              />
              <Button
                onClick={handleSearch}
                disabled={isSearching || !searchQuery.trim()}
                className="ml-2"
              >
                {isSearching ? (
                  <span className="material-icons animate-spin">refresh</span>
                ) : (
                  <span className="material-icons">search</span>
                )}
              </Button>
            </div>
          </div>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-700 mb-2">
                Search Results
              </h3>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                {searchResults.map((user) => (
                  <div
                    key={user.id || user.email}
                    onClick={() => setSelectedUser(user)}
                    className={`p-3 flex items-center cursor-pointer hover:bg-gray-50 ${selectedUser && (selectedUser.id === user.id || selectedUser.email === user.email)
                      ? 'bg-indigo-50 border-l-4 border-indigo-500'
                      : 'border-b border-gray-200'
                      }`}
                  >
                    <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center mr-3">
                      {user.photoURL ? (
                        <img src={user.photoURL} alt="Profile" className="w-10 h-10 rounded-full" />
                      ) : (
                        <span className="material-icons text-indigo-600">person</span>
                      )}
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">
                        {user.displayName || user.name}
                      </h4>
                      <p className="text-sm text-gray-600">{user.email}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* No Results Message */}
          {searchQuery && searchResults.length === 0 && !isSearching && (
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-start">
                <span className="material-icons text-yellow-600 mr-2">info</span>
                <p className="text-sm text-yellow-700">
                  No users found with that email or name. Please try a different search term.
                </p>
              </div>
            </div>
          )}

          {/* Selected User */}
          {selectedUser && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-700 mb-2">
                Selected User
              </h3>
              <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg flex items-center">
                <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center mr-4">
                  {selectedUser.photoURL ? (
                    <img src={selectedUser.photoURL} alt="Profile" className="w-12 h-12 rounded-full" />
                  ) : (
                    <span className="material-icons text-indigo-600 text-2xl">person</span>
                  )}
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">
                    {selectedUser.displayName || selectedUser.name}
                  </h4>
                  <p className="text-sm text-gray-600">{selectedUser.email}</p>
                </div>
              </div>
            </div>
          )}

          {/* Relationship Selection */}
          {selectedUser && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Relationship <span className="text-red-500">*</span>
              </label>
              <select
                value={relationship}
                onChange={(e) => setRelationship(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="">Select relationship</option>
                {relationships.map(rel => (
                  <option key={rel} value={rel}>{rel}</option>
                ))}
              </select>
            </div>
          )}

          {/* Access Level and Emergency Contact */}
          {selectedUser && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Access Level <span className="text-red-500">*</span>
                </label>
                <select
                  value={accessLevel}
                  onChange={(e) => setAccessLevel(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="full">Full Access</option>
                  <option value="limited">Limited Access</option>
                  <option value="emergency">Emergency Only</option>
                </select>
                <p className="text-[10px] text-gray-500 mt-1">
                  {accessLevel === 'full' && "Can view all records and chat."}
                  {accessLevel === 'limited' && "Can view basic stats and chat."}
                  {accessLevel === 'emergency' && "Only accessible during emergencies."}
                </p>
              </div>

              <div className="flex items-center mt-6">
                <label className="flex items-center cursor-pointer group">
                  <div className="relative">
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={isEmergencyContact}
                      onChange={(e) => setIsEmergencyContact(e.target.checked)}
                    />
                    <div className={`w-10 h-4 rounded-full shadow-inner transition-colors ${isEmergencyContact ? 'bg-red-400' : 'bg-gray-300'}`}></div>
                    <div className={`absolute -left-1 -top-1 w-6 h-6 rounded-full shadow transition-transform ${isEmergencyContact ? 'translate-x-full bg-red-600' : 'bg-white'}`}></div>
                  </div>
                  <div className="ml-3 text-sm font-medium text-gray-700 group-hover:text-gray-900 transition-colors">
                    Emergency Contact
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start">
                <span className="material-icons text-red-600 mr-2">error</span>
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-start">
                <span className="material-icons text-green-600 mr-2">check_circle</span>
                <p className="text-sm text-green-700">{success}</p>
              </div>
            </div>
          )}

          {/* Information Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <div className="flex items-start">
              <span className="material-icons text-blue-600 mt-0.5 mr-2">info</span>
              <div>
                <h4 className="font-medium text-blue-800">What happens next?</h4>
                <ul className="text-sm text-blue-700 mt-2 space-y-1">
                  <li>• An invitation will be sent to the selected user</li>
                  <li>• They'll need to accept the invitation to join your family network</li>
                  <li>• Once accepted, they'll appear in your family network</li>
                  <li>• You can modify their access level anytime</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 flex justify-between">
          <Button
            variant="secondary"
            onClick={onClose}
          >
            Cancel
          </Button>

          <Button
            onClick={handleSendRequest}
            loading={loading}
            disabled={!selectedUser || !relationship}
          >
            Send Request
          </Button>
        </div>
      </div>
    </div>
  );
};

export default UpdatedAddFamilyMember;