import React, { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import FamilyChat from "../components/FamilyChat";
// Use real Firebase-backed services for notifications and chat
import {
  subscribeToNotifications,
  NOTIFICATION_TYPES
} from '../services/notificationService';
import { subscribeToConversations } from '../services/chatService';

import GeminiChatbot from "../components/GeminiChatbot";
import UpdatedAddFamilyMember from "../components/UpdatedAddFamilyMember";
import EnhancedFamilyRequestManager from "../components/EnhancedFamilyRequestManager";
import EnhancedFamilyNetworkManager from "../components/EnhancedFamilyNetworkManager";
import FamilyNotificationSystem from "../components/FamilyNotificationSystem";
import FamilyStatusIndicator from "../components/FamilyStatusIndicator";
import SmartReportAnalyzer from "../components/SmartReportAnalyzer";
// import NotificationManager from "../components/NotificationManager";
// import NotificationTest from "../components/NotificationTest";



// Mock shared patient data
const mockSharedPatient = {
  name: "John Doe",
  age: 45,
  bloodGroup: "O+",
  emergencyContacts: ["Sarah Doe", "Emma Doe"],
  lastUpdated: "2024-01-15 14:30",
  allergies: ["Penicillin", "Shellfish"],
  conditions: ["Hypertension", "Type 2 Diabetes"],
  medications: [
    { name: "Amlodipine", dosage: "5mg", frequency: "Daily" },
    { name: "Metformin", dosage: "500mg", frequency: "Twice daily" }
  ]
};

// Mock shared health records
const mockSharedRecords = [
  {
    id: 1,
    date: "2024-05-01",
    doctor: "Dr. A. Sharma",
    diagnosis: "Hypertension",
    prescription: "Amlodipine 5mg",
    notes: "Monitor BP daily. Next visit in 1 month.",
    accessLevel: "full",
    isEmergency: false,
    category: "Cardiology"
  },
  {
    id: 2,
    date: "2024-03-15",
    doctor: "Dr. R. Singh",
    diagnosis: "Type 2 Diabetes",
    prescription: "Metformin 500mg",
    notes: "Maintain diet. Exercise regularly.",
    accessLevel: "limited",
    isEmergency: false,
    category: "Endocrinology"
  },
  {
    id: 3,
    date: "2023-12-10",
    doctor: "Dr. P. Verma",
    diagnosis: "Seasonal Flu",
    prescription: "Rest, Paracetamol",
    notes: "Recovered. No complications.",
    accessLevel: "emergency",
    isEmergency: true,
    category: "General Medicine"
  },
];

const EnhancedFamilyDashboard = () => {
  const { currentUser, userRole } = useAuth();
  const [activeTab, setActiveTab] = useState(() => {
    // Check if there's a saved tab from notification click
    const savedTab = localStorage.getItem('familyDashboardTab');
    if (savedTab) {
      localStorage.removeItem('familyDashboardTab');
      return parseInt(savedTab, 10);
    }
    return 0;
  });
  const [isEmergencyMode, setIsEmergencyMode] = useState(false);
  const [emergencyAccessExpiry, setEmergencyAccessExpiry] = useState(null);
  const [filteredRecords, setFilteredRecords] = useState([]);
  const [showAddMember, setShowAddMember] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [networkStats, setNetworkStats] = useState({
    totalMembers: 0,
    pendingRequests: 0,
    emergencyContacts: 0,
    onlineMembers: 0
  });

  // Check for tab switching from notifications
  useEffect(() => {
    const savedTab = localStorage.getItem('familyDashboardTab');
    const openFamilyChat = localStorage.getItem('openFamilyChat');

    if (savedTab !== null) {
      setActiveTab(parseInt(savedTab));
      localStorage.removeItem('familyDashboardTab');
    }

    // Check if we need to open family chat specifically
    if (openFamilyChat === 'true') {
      console.log('🔔 Opening family chat from notification');
      setActiveTab(3); // Family Chat tab
      localStorage.removeItem('openFamilyChat');
    }
  }, []);

  // Load family network data on component mount to update stats
  useEffect(() => {
    const loadFamilyNetworkStats = async () => {
      if (!currentUser) return;

      try {
        const { getFamilyNetwork } = await import('../services/familyService');
        const response = await getFamilyNetwork(currentUser.uid);

        if (response.success && response.network) {
          const members = response.network.members || [];
          const emergencyContacts = members.filter(member => member.isEmergencyContact).length;

          setNetworkStats({
            totalMembers: members.length,
            pendingRequests: 0, // This would come from a separate API call
            emergencyContacts: emergencyContacts,
            onlineMembers: members.length // Simplified for now
          });
        }
      } catch (error) {
        console.error('Error loading family network stats:', error);
      }
    };

    loadFamilyNetworkStats();
  }, [currentUser]);

  // Debug logging
  useEffect(() => {
    console.log("EnhancedFamilyDashboard: Component mounted");
    console.log("EnhancedFamilyDashboard: currentUser:", currentUser);
    console.log("EnhancedFamilyDashboard: userRole:", userRole);
  }, [currentUser, userRole]);

  useEffect(() => {
    // Filter records based on access level and emergency mode
    let accessibleRecords = [];

    if (isEmergencyMode) {
      accessibleRecords = mockSharedRecords.filter(record => record.isEmergency);
    } else {
      // For demo purposes, show all records
      accessibleRecords = mockSharedRecords;
    }

    setFilteredRecords(accessibleRecords);
  }, [isEmergencyMode]);

  // Subscribe to notifications
  useEffect(() => {
    if (!currentUser) {
      setNotifications([]);
      return;
    }

    const unsubscribe = subscribeToNotifications(currentUser.uid, (notifs) => {
      console.log('Notifications received:', notifs);
      setNotifications(notifs);
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [currentUser]);

  // Subscribe to conversations for unread count
  useEffect(() => {
    if (!currentUser) {
      setConversations([]);
      return;
    }

    const unsubscribe = subscribeToConversations(currentUser.uid, (convos) => {
      console.log('Conversations received:', convos);
      setConversations(convos);
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [currentUser]);

  const activateEmergencyAccess = () => {
    setIsEmergencyMode(true);
    const expiryTime = new Date();
    expiryTime.setHours(expiryTime.getHours() + 24);
    setEmergencyAccessExpiry(expiryTime);

    console.log("Emergency access activated for 24 hours");
    alert("Emergency access activated! You now have access to critical health information.");
  };

  const deactivateEmergencyAccess = () => {
    setIsEmergencyMode(false);
    setEmergencyAccessExpiry(null);
    alert("Emergency access deactivated.");
  };

  const getAccessLevelColor = (level) => {
    switch (level) {
      case "full": return "bg-green-100 text-green-800";
      case "limited": return "bg-yellow-100 text-yellow-800";
      case "emergency": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const handleAddFamilyMember = (newMember) => {
    console.log('New family member added:', newMember);
    // Update network stats
    setNetworkStats(prev => ({
      ...prev,
      totalMembers: prev.totalMembers + 1,
      pendingRequests: prev.pendingRequests + 1
    }));
  };

  const handleNetworkUpdate = (updatedStats) => {
    console.log("Family network updated", updatedStats);
    if (updatedStats) {
      setNetworkStats(updatedStats);
    } else {
      // Refresh network stats by fetching from the component
      // This will be called when the family network is loaded
    }
  };

  const handleNavigateToChat = (member) => {
    console.log("Navigating to chat with:", member);
    setActiveTab(3); // Switch to chat tab

    // Store the member to start chat with
    try {
      localStorage.setItem('startChatMember', JSON.stringify({
        uid: member.uid,
        email: member.email,
        name: member.name
      }));
    } catch (e) {
      console.error('Failed to store chat target', e);
    }
  };

  const handleNotificationClick = (notification) => {
    console.log("Notification clicked:", notification);

    // Handle different notification types with proper redirection
    switch (notification.type) {
      case NOTIFICATION_TYPES.FAMILY_REQUEST:
        setActiveTab(1); // Family Requests tab
        break;
      case NOTIFICATION_TYPES.FAMILY_REQUEST_ACCEPTED:
      case NOTIFICATION_TYPES.FAMILY_REQUEST_REJECTED:
        setActiveTab(2); // Family Network tab
        break;
      case NOTIFICATION_TYPES.CHAT_MESSAGE:
        setActiveTab(3); // Family Chat tab
        // If there's conversation data, we could store it for the chat component to use
        if (notification.data?.conversationId) {
          localStorage.setItem('openConversationId', notification.data.conversationId);
        }
        break;
      case NOTIFICATION_TYPES.EMERGENCY_ALERT:
        setActiveTab(0); // Overview tab for emergency
        setIsEmergencyMode(true);
        break;
      case NOTIFICATION_TYPES.HEALTH_RECORD_SHARED:
        setActiveTab(4); // Health Records tab
        break;
      case NOTIFICATION_TYPES.APPOINTMENT_REMINDER:
      case NOTIFICATION_TYPES.MEDICATION_REMINDER:
        setActiveTab(0); // Overview tab
        break;
      default:
        // Fallback for legacy notifications
        if (notification.tab !== undefined) {
          setActiveTab(notification.tab);
        } else {
          setActiveTab(0); // Default to overview
        }
        break;
    }
  };



  const handleStatusClick = (action) => {
    console.log("Status action clicked:", action);

    switch (action) {
      case 'members':
      case 'online':
      case 'emergency':
      case 'view_network':
        setActiveTab(2); // Switch to family network tab
        break;
      case 'requests':
        setActiveTab(1); // Switch to family requests tab
        break;
      case 'add_member':
        setShowAddMember(true);
        break;
      default:
        break;
    }
  };

  // Show loading state if user data is not available
  if (!currentUser && userRole !== 'patient') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600 mx-auto mb-6"></div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Loading Family Dashboard...</h2>
          <p className="text-gray-600">Please wait while we set up your family network</p>
        </div>
      </div>
    );
  }

  // Show error if user doesn't have access
  if (userRole !== 'patient') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center max-w-md">
          <div className="text-red-500 mb-6">
            <span className="material-icons text-6xl">block</span>
          </div>
          <h2 className="text-3xl font-bold text-gray-800 mb-4">Access Denied</h2>
          <p className="text-gray-600 mb-2">Only patients can access the Family Dashboard.</p>
          <p className="text-sm text-gray-500">Current role: {userRole}</p>
          <div className="mt-6">
            <button
              onClick={() => window.history.back()}
              className="bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  const renderOverview = () => (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl shadow-xl p-8 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">
              Welcome to Your Family Dashboard
            </h1>
            <p className="text-indigo-100 text-lg">
              Stay connected with your family's health journey
            </p>
          </div>
          <div className="hidden md:block">
            <div className="w-24 h-24 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
              <span className="material-icons text-4xl">family_restroom</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Family Members</p>
              <p className="text-3xl font-bold text-gray-900">{networkStats.totalMembers}</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-full">
              <span className="material-icons text-blue-600">people</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-yellow-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Pending Requests</p>
              <p className="text-3xl font-bold text-gray-900">{networkStats.pendingRequests}</p>
            </div>
            <div className="bg-yellow-100 p-3 rounded-full">
              <span className="material-icons text-yellow-600">pending</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-red-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Emergency Contacts</p>
              <p className="text-3xl font-bold text-gray-900">{networkStats.emergencyContacts}</p>
            </div>
            <div className="bg-red-100 p-3 rounded-full">
              <span className="material-icons text-red-600">emergency</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Emergency Mode</p>
              <p className="text-3xl font-bold text-gray-900">{isEmergencyMode ? 'ON' : 'OFF'}</p>
            </div>
            <div className="bg-green-100 p-3 rounded-full">
              <span className="material-icons text-green-600">
                {isEmergencyMode ? 'security' : 'shield'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Patient Overview & Emergency Control */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Patient Overview */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-lg p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-800">Patient Overview</h2>
            <div className="flex items-center space-x-2">
              {isEmergencyMode && (
                <span className="px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800 animate-pulse">
                  Emergency Active
                </span>
              )}
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Basic Information */}
            <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-6">
              <h3 className="font-semibold text-gray-800 mb-4 flex items-center">
                <span className="material-icons mr-2 text-indigo-600">person</span>
                Basic Information
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Name</span>
                  <span className="font-medium">{mockSharedPatient.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Age</span>
                  <span className="font-medium">{mockSharedPatient.age} years</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Blood Group</span>
                  <span className="font-medium text-red-600">{mockSharedPatient.bloodGroup}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Last Updated</span>
                  <span className="font-medium text-sm">{mockSharedPatient.lastUpdated}</span>
                </div>
              </div>
            </div>

            {/* Health Summary */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-100 rounded-xl p-6">
              <h3 className="font-semibold text-gray-800 mb-4 flex items-center">
                <span className="material-icons mr-2 text-blue-600">medical_services</span>
                Health Summary
              </h3>
              <div className="space-y-3">
                <div>
                  <span className="text-gray-600 text-sm">Conditions</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {mockSharedPatient.conditions.map((condition, idx) => (
                      <span key={idx} className="px-2 py-1 bg-blue-200 text-blue-800 text-xs rounded-full">
                        {condition}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="text-gray-600 text-sm">Allergies</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {mockSharedPatient.allergies.map((allergy, idx) => (
                      <span key={idx} className="px-2 py-1 bg-red-200 text-red-800 text-xs rounded-full">
                        {allergy}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Family Status & Emergency Control */}
        <div className="space-y-6">
          {/* Family Status Indicator */}
          <FamilyStatusIndicator onStatusClick={handleStatusClick} />

          {/* Emergency Control */}
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-red-700 mb-6 flex items-center">
              <span className="material-icons mr-2">emergency</span>
              Emergency Access
            </h2>

            <div className="space-y-6">
              <div className="text-center">
                <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-4 ${isEmergencyMode ? 'bg-red-100' : 'bg-gray-100'
                  }`}>
                  <span className={`material-icons text-3xl ${isEmergencyMode ? 'text-red-600' : 'text-gray-400'
                    }`}>
                    {isEmergencyMode ? 'emergency' : 'shield'}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mb-4">
                  {isEmergencyMode
                    ? "Emergency access is active. Critical health information is accessible."
                    : "Activate emergency access to view critical records when needed."}
                </p>
              </div>

              {isEmergencyMode && emergencyAccessExpiry && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-sm text-red-800 font-medium">Active Until:</p>
                  <p className="text-sm text-red-600">{emergencyAccessExpiry.toLocaleString()}</p>
                </div>
              )}

              <button
                onClick={isEmergencyMode ? deactivateEmergencyAccess : activateEmergencyAccess}
                className={`w-full px-6 py-3 rounded-lg font-semibold transition-all ${isEmergencyMode
                    ? 'bg-gray-700 text-white hover:bg-gray-800'
                    : 'bg-red-600 text-white hover:bg-red-700 hover:shadow-lg'
                  }`}
              >
                {isEmergencyMode ? 'Deactivate Emergency' : 'Activate Emergency'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-2xl shadow-lg p-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button
            onClick={() => setShowAddMember(true)}
            className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl px-6 py-4 hover:shadow-lg transition-all transform hover:-translate-y-1"
          >
            <span className="material-icons mb-2 block">person_add</span>
            <span className="text-sm font-medium">Add Member</span>
          </button>
          <button
            onClick={() => setActiveTab(1)}
            className="bg-gradient-to-r from-blue-500 to-cyan-600 text-white rounded-xl px-6 py-4 hover:shadow-lg transition-all transform hover:-translate-y-1"
          >
            <span className="material-icons mb-2 block">inbox</span>
            <span className="text-sm font-medium">View Requests</span>
          </button>
          <button
            onClick={() => setActiveTab(3)}
            className="bg-gradient-to-r from-green-500 to-teal-600 text-white rounded-xl px-6 py-4 hover:shadow-lg transition-all transform hover:-translate-y-1"
          >
            <span className="material-icons mb-2 block">chat</span>
            <span className="text-sm font-medium">Family Chat</span>
          </button>
          <button
            onClick={() => setActiveTab(4)}
            className="bg-gradient-to-r from-red-500 to-pink-600 text-white rounded-xl px-6 py-4 hover:shadow-lg transition-all transform hover:-translate-y-1"
          >
            <span className="material-icons mb-2 block">medical_services</span>
            <span className="text-sm font-medium">Health Records</span>
          </button>
        </div>
      </div>



    </div>
  );

  const renderHealthRecords = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-lg p-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Shared Health Records</h2>
            <p className="text-gray-600 mt-1">
              Showing {filteredRecords.length} of {mockSharedRecords.length} records
            </p>
          </div>
          <div className="flex items-center space-x-4">
            {isEmergencyMode && (
              <span className="px-4 py-2 rounded-full text-sm font-medium bg-red-100 text-red-800">
                Emergency Mode Active
              </span>
            )}
          </div>
        </div>

        {filteredRecords.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <span className="material-icons text-6xl">description</span>
            </div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">No Records Available</h3>
            <p className="text-gray-600">
              {isEmergencyMode
                ? "No emergency records are currently available."
                : "No health records are currently shared with your access level."
              }
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredRecords.map((record) => (
              <div key={record.id} className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-gray-900 text-lg">{record.diagnosis}</h3>
                    <p className="text-gray-600">{record.doctor} • {record.category}</p>
                    <p className="text-sm text-gray-500">{record.date}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`px-3 py-1 text-xs rounded-full font-medium ${getAccessLevelColor(record.accessLevel)}`}>
                      {record.accessLevel}
                    </span>
                    {record.isEmergency && (
                      <span className="px-3 py-1 bg-red-100 text-red-800 text-xs rounded-full font-medium">
                        Emergency
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium text-gray-800 mb-2">Prescription</h4>
                    <p className="text-gray-600">{record.prescription}</p>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-800 mb-2">Notes</h4>
                    <p className="text-gray-600">{record.notes}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderMainContent = () => {
    switch (activeTab) {
      case 0: // Overview
        return renderOverview();
      case 1: // Family Requests
        return (
          <EnhancedFamilyRequestManager
            onUpdate={handleNetworkUpdate}
            onNavigateToChat={handleNavigateToChat}
          />
        );
      case 2: // Family Network
        return (
          <EnhancedFamilyNetworkManager
            onUpdate={handleNetworkUpdate}
            onNavigateToChat={handleNavigateToChat}
            onAddMember={() => setShowAddMember(true)}
          />
        );
      case 3: // Chat
        return (
          <div className="space-y-6">
            <FamilyChat />
            <GeminiChatbot />
          </div>
        );
      case 4: // Health Records
        return renderHealthRecords();
      case 5: // File Storage
        return <SmartReportAnalyzer />;
      default:
        return renderOverview();
    }
  };

  const sidebarLinks = [
    {
      label: "Overview",
      icon: <span className="material-icons text-lg">dashboard</span>,
      description: "Dashboard home"
    },
    {
      label: "Family Requests",
      icon: <span className="material-icons text-lg">inbox</span>,
      badge: networkStats.pendingRequests,
      description: "Manage requests"
    },
    {
      label: "Family Network",
      icon: <span className="material-icons text-lg">people</span>,
      description: "Your family members"
    },
    {
      label: "Family Chat",
      icon: <span className="material-icons text-lg">chat</span>,
      badge: conversations.reduce((total, conv) => {
        const unreadCount = conv.unread?.[currentUser?.uid] || 0;
        return total + unreadCount;
      }, 0),
      description: "Chat with family"
    },
    {
      label: "Health Records",
      icon: <span className="material-icons text-lg">medical_services</span>,
      description: "Shared records"
    },
    {
      label: "File Storage",
      icon: <span className="material-icons text-lg">folder</span>,
      description: "Health documents"
    },
  ];

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Mobile Menu Button */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="md:hidden fixed top-20 left-4 z-50 bg-white p-3 rounded-xl shadow-lg"
      >
        <span className="material-icons text-indigo-700">
          {sidebarOpen ? 'close' : 'menu'}
        </span>
      </button>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="flex">
        {/* Sidebar */}
        <aside className={`${sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          } md:translate-x-0 fixed md:relative top-0 left-0 h-screen bg-white shadow-2xl z-40 w-80 transition-transform duration-300 overflow-y-auto`}>
          <div className="p-6">
            {/* Profile Section */}
            <div className="text-center mb-8">
              <div className="relative inline-block">
                <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-2xl">
                  {currentUser?.displayName?.charAt(0) || 'Y'}
                </div>
                <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 border-2 border-white rounded-full"></div>
              </div>
              <h3 className="mt-4 font-bold text-gray-800 text-lg">
                {currentUser?.displayName || 'Your Name'}
              </h3>
              <p className="text-sm text-gray-600">Family Dashboard</p>
            </div>

            {/* Navigation */}
            <nav className="space-y-2">
              {sidebarLinks.map((link, idx) => (
                <button
                  key={idx}
                  className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl font-medium transition-all relative ${activeTab === idx
                      ? 'bg-indigo-100 text-indigo-900 shadow-sm'
                      : 'hover:bg-gray-50 text-gray-700 hover:text-gray-900'
                    }`}
                  onClick={() => {
                    setActiveTab(idx);
                    setSidebarOpen(false);
                  }}
                >
                  {link.icon}
                  <div className="flex-1 text-left">
                    <div className="font-medium">{link.label}</div>
                    <div className="text-xs text-gray-500">{link.description}</div>
                  </div>
                  {link.badge && link.badge > 0 && (
                    <span className="bg-red-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center">
                      {link.badge}
                    </span>
                  )}
                </button>
              ))}
            </nav>

            {/* Notifications removed - using header notification instead */}

            {/* Emergency Status */}
            <div className="mt-4 p-4 bg-gray-50 rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Emergency Mode</span>
                <span className={`w-3 h-3 rounded-full ${isEmergencyMode ? 'bg-red-500' : 'bg-gray-300'}`}></span>
              </div>
              <p className="text-xs text-gray-600">
                {isEmergencyMode ? 'Active - Critical access enabled' : 'Inactive - Standard access'}
              </p>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <div className="flex-1 p-6 md:p-8">
          {renderMainContent()}
        </div>
      </div>

      {/* Add Family Member Modal */}
      <UpdatedAddFamilyMember
        isOpen={showAddMember}
        onClose={() => setShowAddMember(false)}
        onAdd={handleAddFamilyMember}
      />
    </main>
  );
};

export default EnhancedFamilyDashboard;
