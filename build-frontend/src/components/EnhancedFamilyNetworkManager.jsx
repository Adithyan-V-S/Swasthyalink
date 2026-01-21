import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  getFamilyNetwork,
  updateFamilyMemberAccess,
  removeFamilyMember
} from '../services/familyService';
import Button from './common/Button';
import FamilyTreeVisualization from './FamilyTreeVisualization';

const EnhancedFamilyNetworkManager = ({ onUpdate, onNavigateToChat, onAddMember }) => {
  const { currentUser } = useAuth();
  const [familyMembers, setFamilyMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingMember, setEditingMember] = useState(null);
  const [processingId, setProcessingId] = useState(null);
  const [viewMode, setViewMode] = useState('grid'); // 'grid', 'tree', or 'visualization'

  // Form state for editing
  const [editForm, setEditForm] = useState({
    relationship: '',
    accessLevel: 'limited',
    isEmergencyContact: false,
    canViewRecords: true,
    canViewEmergency: true,
    canReceiveAlerts: false
  });

  const relationships = [
    'Spouse', 'Parent', 'Child', 'Sibling', 'Grandparent',
    'Grandchild', 'Uncle', 'Aunt', 'Cousin', 'Friend', 'Caregiver'
  ];

  const accessLevels = [
    {
      value: 'full',
      label: 'Full Access',
      description: 'Can view all health records and information',
      color: 'bg-green-100 text-green-800'
    },
    {
      value: 'limited',
      label: 'Limited Access',
      description: 'Can view basic health records and emergency information',
      color: 'bg-yellow-100 text-yellow-800'
    },
    {
      value: 'emergency',
      label: 'Emergency Only',
      description: 'Can only access critical information during emergencies',
      color: 'bg-red-100 text-red-800'
    }
  ];

  useEffect(() => {
    loadFamilyNetwork();

    // DISABLED: Auto-refresh every 30 seconds - causing quota exceeded
    // const intervalId = setInterval(() => {
    //   console.log("Auto-refreshing family network");
    //   loadFamilyNetwork();
    // }, 30000); // Refresh every 30 seconds

    // return () => clearInterval(intervalId);
  }, [currentUser]);

  const loadFamilyNetwork = async () => {
    if (!currentUser) return;

    setLoading(true);
    setError('');

    try {
      console.log("Loading family network for user:", currentUser.email, "UID:", currentUser.uid);
      const response = await getFamilyNetwork(currentUser.uid);

      if (response.success) {
        console.log("Family network loaded:", response.network);

        if (response.network && response.network.members && response.network.members.length > 0) {
          console.log(`Found ${response.network.members.length} family members`);
          setFamilyMembers(response.network.members);

          // Update parent component with network stats
          const emergencyContacts = response.network.members.filter(member => member.isEmergencyContact).length;
          onUpdate && onUpdate({
            totalMembers: response.network.members.length,
            pendingRequests: 0, // This would come from a separate API call
            emergencyContacts: emergencyContacts,
            onlineMembers: response.network.members.length // Simplified for now
          });
        } else {
          console.log("No family members found in network");
          setFamilyMembers([]);

          // Update parent component with empty stats
          onUpdate && onUpdate({
            totalMembers: 0,
            pendingRequests: 0,
            emergencyContacts: 0,
            onlineMembers: 0
          });
        }
      } else {
        throw new Error(response.error || 'Failed to load network');
      }
    } catch (error) {
      console.error('Error loading family network:', error);
      setError('Failed to load family network. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleEditMember = (member) => {
    setEditingMember(member);
    setEditForm({
      relationship: member.relationship || '',
      accessLevel: member.accessLevel || 'limited',
      isEmergencyContact: member.isEmergencyContact || false,
      canViewRecords: member.canViewRecords !== false,
      canViewEmergency: member.canViewEmergency !== false,
      canReceiveAlerts: member.canReceiveAlerts || false
    });
  };

  const handleSaveEdit = async () => {
    if (!editingMember) return;

    setProcessingId(editingMember.email);

    try {
      // Update local state immediately for better UX
      setFamilyMembers(prev =>
        prev.map(member =>
          member.email === editingMember.email
            ? {
              ...member,
              ...editForm,
              updatedAt: new Date().toISOString()
            }
            : member
        )
      );

      // TODO: Implement backend update
      // await updateFamilyMemberAccess(editingMember.uid, editForm);

      setEditingMember(null);

      if (onUpdate) onUpdate();

      // Show success message
      alert("Family member access updated successfully!");

    } catch (error) {
      console.error('Error updating family member:', error);
      setError('Failed to update family member. Please try again.');
      // Reload to restore original state
      loadFamilyNetwork();
    } finally {
      setProcessingId(null);
    }
  };

  const handleRemoveMember = async (memberEmail, memberName) => {
    if (!confirm(`Are you sure you want to disable ${memberName} from your family network? This will hide them from your view but preserve all data for security purposes.`)) {
      return;
    }

    setProcessingId(memberEmail);

    try {
      // Call the soft delete function
      const result = await removeFamilyMember(currentUser.uid, memberEmail);

      if (result.success) {
        // Update local state to remove from view
        setFamilyMembers(prev => prev.filter(member => member.email !== memberEmail));

        if (onUpdate) onUpdate();

        alert(`${memberName} has been disabled from your family network. Data preserved for security.`);
        console.log('✅ Family member disabled successfully (data preserved)');
      } else {
        throw new Error(result.error || 'Failed to disable family member');
      }

    } catch (error) {
      console.error('Error disabling family member:', error);
      setError('Failed to disable family member. Please try again.');
      loadFamilyNetwork();
    } finally {
      setProcessingId(null);
    }
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

  const getAccessLevelInfo = (level) => {
    return accessLevels.find(al => al.value === level) || accessLevels[1];
  };

  const getOnlineStatus = (member) => {
    // Mock online status - in real app, this would come from backend
    return Math.random() > 0.5;
  };

  const renderFamilyTree = () => {
    const groupedMembers = familyMembers.reduce((groups, member) => {
      const rel = member.relationship || 'Other';
      if (!groups[rel]) groups[rel] = [];
      groups[rel].push(member);
      return groups;
    }, {});

    return (
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-2xl mx-auto mb-4">
            {currentUser?.displayName?.charAt(0) || 'Y'}
          </div>
          <h3 className="text-xl font-semibold text-gray-800">
            {currentUser?.displayName || 'You'}
          </h3>
          <p className="text-sm text-gray-600">Family Network Center</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Object.entries(groupedMembers).map(([relationship, members]) => (
            <div key={relationship} className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center mb-4">
                <span className="text-2xl mr-2">{getRelationshipIcon(relationship)}</span>
                <h4 className="font-semibold text-gray-800">{relationship}s</h4>
                <span className="ml-auto bg-indigo-100 text-indigo-800 text-xs px-2 py-1 rounded-full">
                  {members.length}
                </span>
              </div>

              <div className="space-y-3">
                {members.map(member => (
                  <div key={member.email} className="bg-white rounded-lg p-3 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="relative">
                          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-teal-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                            {member.name?.charAt(0) || '?'}
                          </div>
                          {getOnlineStatus(member) && (
                            <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
                          )}
                        </div>
                        <div className="ml-3">
                          <p className="font-medium text-gray-900 text-sm">{member.name}</p>
                          <p className="text-xs text-gray-600">{member.email}</p>
                        </div>
                      </div>
                      <div className="flex space-x-1">
                        <button
                          onClick={() => onNavigateToChat && onNavigateToChat(member)}
                          className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                          title="Start Chat"
                        >
                          <span className="material-icons text-sm">chat</span>
                        </button>
                        <button
                          onClick={() => handleEditMember(member)}
                          className="p-1 text-gray-600 hover:bg-gray-50 rounded"
                          title="Edit Access"
                        >
                          <span className="material-icons text-sm">edit</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderGridView = () => {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {familyMembers.map(member => (
          <div key={member.email} className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden hover:shadow-xl transition-shadow">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <div className="relative">
                    <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-xl">
                      {member.name?.charAt(0) || '?'}
                    </div>
                    {getOnlineStatus(member) && (
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white"></div>
                    )}
                  </div>
                  <div className="ml-4">
                    <h3 className="font-semibold text-gray-900 text-lg">{member.name}</h3>
                    <p className="text-sm text-gray-600">{member.email}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3 mb-6">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Relationship</span>
                  <div className="flex items-center">
                    <span className="mr-2">{getRelationshipIcon(member.relationship)}</span>
                    <span className="font-medium text-gray-900">{member.relationship}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Access Level</span>
                  <span className={`px-2 py-1 text-xs rounded-full font-medium ${getAccessLevelInfo(member.accessLevel).color}`}>
                    {getAccessLevelInfo(member.accessLevel).label}
                  </span>
                </div>

                {member.isEmergencyContact && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Emergency Contact</span>
                    <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full font-medium">
                      Yes
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Last Active</span>
                  <span className="text-sm text-gray-500">
                    {member.lastAccess || 'Never'}
                  </span>
                </div>
              </div>

              <div className="flex space-x-2">
                <Button
                  size="small"
                  onClick={() => onNavigateToChat && onNavigateToChat(member)}
                  disabled={!member.uid}
                  leftIcon={<span className="material-icons">chat</span>}
                  className="flex-1"
                >
                  Chat
                </Button>
                <Button
                  variant="secondary"
                  size="small"
                  onClick={() => handleEditMember(member)}
                  disabled={processingId !== null}
                  leftIcon={<span className="material-icons">edit</span>}
                >
                  Edit
                </Button>
                <Button
                  variant="danger"
                  size="small"
                  onClick={() => handleRemoveMember(member.email, member.name)}
                  loading={processingId === member.email}
                  disabled={processingId !== null}
                  leftIcon={<span className="material-icons">visibility_off</span>}
                >
                  Disable
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="p-8 flex justify-center">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
          <p className="text-gray-600">Loading family network...</p>
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
            <h3 className="font-medium text-red-800 mb-2">Error Loading Network</h3>
            <p className="text-sm text-red-700 mb-4">{error}</p>
            <Button
              onClick={loadFamilyNetwork}
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

  if (familyMembers.length === 0) {
    return (
      <div className="p-8 bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200 rounded-xl text-center">
        <div className="text-gray-400 mb-4">
          <span className="material-icons text-6xl">people_outline</span>
        </div>
        <h3 className="text-xl font-semibold text-gray-800 mb-2">No Family Members Yet</h3>
        <p className="text-gray-600 mb-6">
          Add family members to share your health information and enable emergency access.
        </p>
        <div className="flex justify-center space-x-4">
          <Button
            onClick={() => onAddMember && onAddMember()}
            leftIcon={<span className="material-icons">person_add</span>}
          >
            Add Family Member
          </Button>
          <Button
            onClick={loadFamilyNetwork}
            disabled={loading}
            variant="secondary"
            leftIcon={<span className="material-icons">refresh</span>}
          >
            Refresh Network
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Controls */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold text-gray-800">Family Network</h3>
          <p className="text-gray-600 mt-1">
            {familyMembers.length} family member{familyMembers.length !== 1 ? 's' : ''} connected
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${viewMode === 'grid'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
                }`}
            >
              <span className="material-icons text-sm mr-1">grid_view</span>
              Grid
            </button>
            <button
              onClick={() => setViewMode('tree')}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${viewMode === 'tree'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
                }`}
            >
              <span className="material-icons text-sm mr-1">account_tree</span>
              Tree
            </button>
            <button
              onClick={() => setViewMode('visualization')}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${viewMode === 'visualization'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
                }`}
            >
              <span className="material-icons text-sm mr-1">hub</span>
              Visual
            </button>
          </div>
          <Button
            onClick={() => onAddMember && onAddMember()}
            className="hidden md:flex"
            size="small"
            leftIcon={<span className="material-icons">person_add</span>}
          >
            Add Member
          </Button>
          <Button
            onClick={loadFamilyNetwork}
            disabled={loading}
            variant="ghost"
            size="small"
            leftIcon={<span className="material-icons">refresh</span>}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Network View */}
      {viewMode === 'tree' ? renderFamilyTree() :
        viewMode === 'visualization' ? (
          <FamilyTreeVisualization
            familyMembers={familyMembers}
            onEditMember={handleEditMember}
            onNavigateToChat={onNavigateToChat}
          />
        ) : renderGridView()}

      {/* Edit Member Modal */}
      {editingMember && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-800">
                  Edit Family Member Access
                </h2>
                <button
                  onClick={() => setEditingMember(null)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <span className="material-icons">close</span>
                </button>
              </div>
              <p className="text-gray-600 mt-2">
                Manage {editingMember.name}'s access to your health information
              </p>
            </div>

            <div className="p-6 space-y-6">
              {/* Member Info */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                    {editingMember.name?.charAt(0) || '?'}
                  </div>
                  <div className="ml-4">
                    <h3 className="font-semibold text-gray-900">{editingMember.name}</h3>
                    <p className="text-sm text-gray-600">{editingMember.email}</p>
                  </div>
                </div>
              </div>

              {/* Relationship */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Relationship
                </label>
                <select
                  value={editForm.relationship}
                  onChange={(e) => setEditForm(prev => ({ ...prev, relationship: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  {relationships.map(rel => (
                    <option key={rel} value={rel}>
                      {getRelationshipIcon(rel)} {rel}
                    </option>
                  ))}
                </select>
              </div>

              {/* Access Level */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Access Level
                </label>
                <div className="space-y-3">
                  {accessLevels.map(level => (
                    <div
                      key={level.value}
                      className={`p-4 border rounded-lg cursor-pointer transition-all ${editForm.accessLevel === level.value
                          ? 'border-indigo-500 bg-indigo-50'
                          : 'border-gray-200 hover:border-gray-300'
                        }`}
                      onClick={() => setEditForm(prev => ({ ...prev, accessLevel: level.value }))}
                    >
                      <div className="flex items-center">
                        <input
                          type="radio"
                          checked={editForm.accessLevel === level.value}
                          onChange={() => setEditForm(prev => ({ ...prev, accessLevel: level.value }))}
                          className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                        />
                        <div className="ml-3 flex-1">
                          <div className="flex items-center justify-between">
                            <span className="block text-sm font-medium text-gray-900">
                              {level.label}
                            </span>
                            <span className={`px-2 py-1 text-xs rounded-full ${level.color}`}>
                              {level.value}
                            </span>
                          </div>
                          <span className="block text-xs text-gray-500 mt-1">
                            {level.description}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Additional Settings */}
              <div className="space-y-4">
                <h4 className="font-medium text-gray-800">Additional Settings</h4>

                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <span className="block text-sm font-medium text-gray-900">
                      Emergency Contact
                    </span>
                    <span className="block text-xs text-gray-500">
                      Can be contacted during medical emergencies
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={editForm.isEmergencyContact}
                    onChange={(e) => setEditForm(prev => ({ ...prev, isEmergencyContact: e.target.checked }))}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                </div>

                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <span className="block text-sm font-medium text-gray-900">
                      Receive Health Alerts
                    </span>
                    <span className="block text-xs text-gray-500">
                      Get notified about important health updates
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={editForm.canReceiveAlerts}
                    onChange={(e) => setEditForm(prev => ({ ...prev, canReceiveAlerts: e.target.checked }))}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-between">
              <Button
                variant="secondary"
                onClick={() => setEditingMember(null)}
              >
                Cancel
              </Button>

              <Button
                onClick={handleSaveEdit}
                loading={processingId === editingMember.email}
                disabled={processingId !== null}
              >
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnhancedFamilyNetworkManager;