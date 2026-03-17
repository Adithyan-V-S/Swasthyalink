import React, { useEffect, useState, useRef } from "react";
import { useAuth } from "../contexts/AuthContext";
import FamilyChat from "../components/FamilyChat";
// Use real Firebase-backed services for notifications and chat
import {
  subscribeToNotifications,
  NOTIFICATION_TYPES
} from '../services/notificationService';
import { subscribeToConversations } from '../services/chatService';
import { toast } from 'react-hot-toast';

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
  const [familyMembers, setFamilyMembers] = useState([]);
  const [selectedMember, setSelectedMember] = useState(null);
  const [familyRecords, setFamilyRecords] = useState([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [familyFiles, setFamilyFiles] = useState([]);
  const [activeFileCategory, setActiveFileCategory] = useState('All');
  const fileInputRef = useRef(null);
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

  // Load family network data and members
  useEffect(() => {
    const loadFamilyData = async () => {
      if (!currentUser) return;

      try {
        const { getFamilyNetwork } = await import('../services/familyService');
        const response = await getFamilyNetwork(currentUser.uid);

        if (response.success && response.network) {
          const members = response.network.members || [];
          setFamilyMembers(members);
          const emergencyCount = members.filter(member => member.isEmergencyContact).length;

          setNetworkStats({
            totalMembers: members.length,
            pendingRequests: 0,
            emergencyContacts: emergencyCount,
            onlineMembers: members.length
          });
        }
      } catch (error) {
        console.error('Error loading family network:', error);
      }
    };

    loadFamilyData();
  }, [currentUser]);

  // Load records for selected family member
  useEffect(() => {
    const fetchFamilyRecords = async () => {
      if (!selectedMember || !currentUser) {
        setFamilyRecords([]);
        return;
      }

      setRecordsLoading(true);
      try {
        const { collection, query, where, getDocs } = await import('firebase/firestore');
        const { db } = await import('../firebaseConfig');

        // Fetch prescriptions for the selected family member
        const prescriptionsRef = collection(db, 'prescriptions');
        const q = query(prescriptionsRef, where('patientId', '==', selectedMember.uid || selectedMember.id));
        const snap = await getDocs(q);

        let records = snap.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            date: data.createdAt ? new Date(data.createdAt.seconds ? data.createdAt.seconds * 1000 : data.createdAt).toLocaleDateString() : 'N/A',
            doctor: data.doctorName || 'Unknown Doctor',
            diagnosis: data.diagnosis || 'Medical Consultation',
            prescription: data.medication || (data.medications?.[0]?.name) || 'See details',
            notes: data.notes || data.instructions || 'No additional notes',
            accessLevel: selectedMember.accessLevel || 'limited',
            category: 'Prescription',
            isEmergency: data.isEmergency || false
          };
        });

        // Apply access level filtering (Reality logic)
        if (selectedMember.uid !== currentUser.uid && selectedMember.accessLevel === 'limited') {
          records = records.filter(r => r.isEmergency);
        }

        setFamilyRecords(records);
      } catch (error) {
        console.error('Error fetching family records:', error);
        toast.error('Failed to load family medical history');
      } finally {
        setRecordsLoading(false);
      }
    };

    if (activeTab === 4) { // Health Records tab
      fetchFamilyRecords();
    }
  }, [selectedMember, currentUser, activeTab]);

  // Special listener for emergency mode
  useEffect(() => {
    if (isEmergencyMode) {
      // In emergency mode, we might want to load records for ALL emergency contacts
      console.log("Emergency mode records filter active");
    }
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

  // Subscribe to family documents for real-time vault updates
  useEffect(() => {
    if (!currentUser) {
      setFamilyFiles([]);
      return;
    }

    let unsubscribe;
    const fetchDocuments = async () => {
      try {
        const { collection, query, where, onSnapshot, orderBy } = await import('firebase/firestore');
        const { db } = await import('../firebaseConfig');

        const docsRef = collection(db, 'familyDocuments');
        const q = query(
          docsRef,
          where('ownerId', '==', currentUser.uid)
        );

        unsubscribe = onSnapshot(q, (snapshot) => {
          const docs = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            date: doc.data().createdAt ? new Date(doc.data().createdAt.seconds * 1000).toLocaleDateString() : 'N/A'
          })).sort((a, b) => b.createdAt?.seconds - a.createdAt?.seconds);

          setFamilyFiles(docs);
        }, (error) => {
          console.error('Error listening to family documents:', error);
        });
      } catch (error) {
        console.error('Error setting up document listener:', error);
      }
    };

    fetchDocuments();
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [currentUser]);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !currentUser) return;

    const loadingToast = toast.loading('Securing document in vault...');

    try {
      const { collection, addDoc, serverTimestamp } = await import('firebase/firestore');
      const { db } = await import('../firebaseConfig');

      // In a real app, we'd upload to Firebase Storage here and get a URL
      // For this demo, we'll store metadata and a local blob URL
      const fileMetadata = {
        name: file.name,
        type: file.type.includes('image') ? 'Imaging' : 'Lab Reports',
        size: (file.size / (1024 * 1024)).toFixed(1) + ' MB',
        owner: 'Self',
        ownerId: currentUser.uid,
        createdAt: serverTimestamp(),
        mimeType: file.type,
        // We simulate the URL - in reality this would be the Storage link
        url: URL.createObjectURL(file)
      };

      await addDoc(collection(db, 'familyDocuments'), fileMetadata);
      toast.success('Document saved to your persistent vault!', { id: loadingToast });
    } catch (error) {
      console.error('Error uploading document:', error);
      toast.error('Failed to save document', { id: loadingToast });
    }

    // Reset input
    e.target.value = '';
  };

  const [summarizingId, setSummarizingId] = useState(null);

  const handleSummarizeDocument = async (file) => {
    if (summarizingId) return;

    setSummarizingId(file.id);
    const loadingToast = toast.loading(`Gemini is analyzing ${file.name}...`);

    try {
      const { default: GeminiService } = await import('../services/geminiService');
      const prompt = `Please provide a concise medical summary for this document. 
      Document Name: ${file.name}
      Document Type: ${file.type}
      Context: This is a health document stored in a family health vault. 
      Focus on key findings and recommendations.`;

      const summary = await GeminiService.sendMessage(prompt);

      // Update local state to show summary (persistent save could also be done here)
      setFamilyFiles(prev => prev.map(f =>
        f.id === file.id ? { ...f, aiSummary: summary } : f
      ));

      toast.success('Analysis complete!', { id: loadingToast });
    } catch (error) {
      console.error('Summarization error:', error);
      toast.error('AI analysis failed', { id: loadingToast });
    } finally {
      setSummarizingId(null);
    }
  };

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
      <div className="bg-white rounded-2xl shadow-xl p-8 border border-indigo-50">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
          <div>
            <h2 className="text-3xl font-black text-gray-900 tracking-tight">Family Medical History</h2>
            <p className="text-gray-500 mt-1 font-medium">
              {selectedMember
                ? `Viewing records for ${selectedMember.name}`
                : "Select a family member to view their shared medical history"}
            </p>
          </div>
          <div className="flex items-center gap-4">
            {isEmergencyMode && (
              <span className="px-4 py-2 rounded-full text-sm font-bold bg-red-100 text-red-700 animate-pulse border border-red-200">
                Emergency Access Active
              </span>
            )}
          </div>
        </div>

        {/* Member Selector Strip - Including Self */}
        <div className="flex gap-4 overflow-x-auto pb-4 mb-8 custom-scrollbar">
          <button
            onClick={() => setSelectedMember({ uid: currentUser.uid, name: 'Me', relationship: 'Owner', photoURL: currentUser.photoURL, accessLevel: 'full' })}
            className={`flex items-center gap-3 p-3 rounded-2xl transition-all border-2 flex-shrink-0 ${selectedMember?.uid === currentUser.uid
              ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100'
              : 'bg-white border-gray-100 text-gray-700 hover:border-indigo-200 hover:bg-gray-50'
              }`}
          >
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold border-2 border-white/20">
              {currentUser?.displayName?.charAt(0) || 'M'}
            </div>
            <div className="text-left">
              <p className="font-bold text-sm whitespace-nowrap">My Profile</p>
              <p className={`text-[10px] font-bold uppercase tracking-wider ${selectedMember?.uid === currentUser.uid ? 'text-indigo-100' : 'text-gray-400'}`}>Private</p>
            </div>
          </button>

          {familyMembers.map((member) => (
            <button
              key={member.uid || member.id}
              onClick={() => setSelectedMember(member)}
              className={`flex items-center gap-3 p-3 rounded-2xl transition-all border-2 flex-shrink-0 ${selectedMember?.uid === member.uid
                ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100'
                : 'bg-white border-gray-100 text-gray-700 hover:border-indigo-200 hover:bg-gray-50'
                }`}
            >
              <img
                src={member.photoURL || member.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name)}&background=4f46e5&color=fff&size=32`}
                alt={member.name}
                className="w-10 h-10 rounded-full border-2 border-white/20"
              />
              <div className="text-left">
                <p className="font-bold text-sm whitespace-nowrap">{member.name}</p>
                <p className={`text-[10px] font-bold uppercase tracking-wider ${selectedMember?.uid === member.uid ? 'text-indigo-100' : 'text-gray-400'
                  }`}>
                  {member.relationship}
                </p>
              </div>
            </button>
          ))}
        </div>

        {recordsLoading ? (
          <div className="text-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
            <p className="text-gray-500 font-medium tracking-wide">Retrieving medical archives...</p>
          </div>
        ) : !selectedMember ? (
          <div className="text-center py-24 bg-gray-50/50 rounded-3xl border-2 border-dashed border-gray-100">
            <div className="bg-white w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
              <span className="material-icons text-4xl text-indigo-300">account_circle</span>
            </div>
            <h3 className="text-xl font-black text-gray-800 mb-2">Member Profiles</h3>
            <p className="text-gray-500 max-w-xs mx-auto">Select a family member from the list above to view their approved health records and prescriptions.</p>
          </div>
        ) : familyRecords.length === 0 ? (
          <div className="text-center py-24 bg-gray-50/50 rounded-3xl border-2 border-dashed border-gray-100">
            <div className="bg-white w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
              <span className="material-icons text-4xl text-gray-300">no_sim</span>
            </div>
            <h3 className="text-xl font-black text-gray-800 mb-2">No Records Shared</h3>
            <p className="text-gray-500 max-w-xs mx-auto">
              {selectedMember.name} hasn't shared any medical records or prescriptions with your access level yet.
            </p>
          </div>
        ) : (
          <div className="grid gap-6">
            {familyRecords.map((record) => (
              <div key={record.id} className="group bg-white border border-gray-100 rounded-3xl p-8 hover:shadow-2xl hover:shadow-indigo-100/50 transition-all duration-300 transform hover:-translate-y-1">
                <div className="flex flex-col md:flex-row md:items-start justify-between mb-6">
                  <div className="flex items-center gap-4 mb-4 md:mb-0">
                    <div className="p-4 bg-indigo-50 rounded-2xl text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors duration-300">
                      <span className="material-icons text-2xl">
                        {record.category === 'Prescription' ? 'medication' : 'assignment'}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-black text-2xl text-gray-900 group-hover:text-indigo-600 transition-colors uppercase tracking-tight">{record.diagnosis}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-gray-500 font-bold text-sm tracking-wide">{record.doctor}</p>
                        <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                        <p className="text-indigo-500 font-bold text-sm">{record.date}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-4 py-2 text-[10px] rounded-full font-black uppercase tracking-[0.1em] border-2 ${getAccessLevelColor(record.accessLevel || selectedMember.accessLevel)}`}>
                      {record.accessLevel || selectedMember.accessLevel} Access
                    </span>
                    {selectedMember.accessLevel === 'full' && (
                      <button
                        onClick={() => toast.success('Record saved to your health history')}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-black uppercase tracking-wider hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
                      >
                        <span className="material-icons text-sm">save_alt</span>
                        Save to History
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-8 mt-4 pt-6 border-t border-gray-50">
                  <div className="space-y-2">
                    <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                      <span className="material-icons text-sm">pill</span>
                      Main Prescription
                    </h4>
                    <p className="text-lg text-gray-800 font-bold bg-gray-50 rounded-2xl p-4 border border-gray-100">
                      {record.prescription}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                      <span className="material-icons text-sm">notes</span>
                      Clinical Notes
                    </h4>
                    <p className="text-lg text-gray-600 font-medium leading-relaxed italic border-l-4 border-indigo-100 pl-6">
                      {record.notes}
                    </p>
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
        return (
          <div className="space-y-8 animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div>
                <h2 className="text-3xl font-black text-gray-900 tracking-tight">Family Vault</h2>
                <p className="text-gray-500 font-medium">Securely store and share family medical documents</p>
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-3 px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95"
              >
                <span className="material-icons">upload_file</span>
                Upload Document
              </button>
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                onChange={handleFileUpload}
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              />
            </div>

            {/* Storage Categories */}
            <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
              {['All', 'Lab Reports', 'Imaging', 'Prescriptions', 'Certificates'].map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveFileCategory(cat)}
                  className={`px-6 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${activeFileCategory === cat
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100'
                    : 'bg-white text-gray-600 border border-gray-100 hover:border-indigo-200'
                    }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Document Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {familyFiles.filter(f => activeFileCategory === 'All' || f.type === activeFileCategory).length === 0 ? (
                <div className="col-span-full py-20 text-center bg-white/50 rounded-[32px] border-2 border-dashed border-gray-100">
                  <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="material-icons text-gray-300 text-3xl">folder_open</span>
                  </div>
                  <h3 className="text-lg font-black text-gray-800">No Documents Found</h3>
                  <p className="text-sm text-gray-500">Upload medical files to start building your family vault.</p>
                </div>
              ) : (
                familyFiles
                  .filter(f => activeFileCategory === 'All' || f.type === activeFileCategory)
                  .map(file => (
                    <div key={file.id} className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-lg hover:shadow-2xl transition-all group relative">
                      <div className="flex justify-between items-start mb-6">
                        <div className="p-4 bg-indigo-50 rounded-2xl text-indigo-600 transition-colors group-hover:bg-indigo-600 group-hover:text-white">
                          <span className="material-icons text-3xl">
                            {file.type === 'Imaging' ? 'image' : 'description'}
                          </span>
                        </div>
                        <button className="p-2 text-gray-400 hover:text-indigo-600">
                          <span className="material-icons">more_vert</span>
                        </button>
                      </div>
                      <h3 className="text-lg font-black text-gray-900 group-hover:text-indigo-600 transition-colors mb-1 truncate">{file.name}</h3>
                      <div className="flex items-center gap-2 mb-4">
                        <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">{file.type}</span>
                        <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                        <span className="text-[10px] font-black uppercase text-indigo-500 tracking-widest">{file.owner}</span>
                      </div>

                      {file.aiSummary && (
                        <div className="mb-4 p-3 bg-indigo-50 rounded-xl border border-indigo-100 animate-fade-in text-left">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="material-icons text-xs text-indigo-600">auto_awesome</span>
                            <span className="text-[9px] font-black uppercase text-indigo-600 tracking-widest">AI Summary</span>
                          </div>
                          <p className="text-xs text-gray-700 leading-relaxed italic">{file.aiSummary}</p>
                        </div>
                      )}

                      <div className="flex gap-2 mt-4">
                        <button
                          onClick={() => window.open(file.url, '_blank')}
                          className="flex-1 flex items-center justify-center gap-2 py-2 bg-gray-50 text-gray-700 rounded-xl text-[10px] font-black uppercase hover:bg-gray-100 transition-all border border-gray-100"
                        >
                          <span className="material-icons text-sm">visibility</span>
                          View
                        </button>
                        <button
                          onClick={() => handleSummarizeDocument(file)}
                          disabled={summarizingId === file.id}
                          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[10px] font-black uppercase transition-all border ${file.aiSummary
                            ? 'bg-green-50 border-green-100 text-green-700'
                            : 'bg-indigo-50 border-indigo-100 text-indigo-700 hover:bg-indigo-600 hover:text-white'
                            }`}
                        >
                          <span className={`material-icons text-sm ${summarizingId === file.id ? 'animate-spin' : ''}`}>
                            {summarizingId === file.id ? 'refresh' : 'psychology'}
                          </span>
                          {file.aiSummary ? 'Analyzed' : 'Summary'}
                        </button>
                      </div>

                      <div className="flex justify-between items-center mt-6 pt-4 border-t border-gray-50">
                        <span className="text-xs font-bold text-gray-400">{file.date}</span>
                        <span className="text-xs font-black text-gray-700">{file.size}</span>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        );
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
