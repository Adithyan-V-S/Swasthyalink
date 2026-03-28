import React, { useEffect, useState, useMemo } from "react";
import { useAuth } from "../contexts/AuthContext";
import { subscribeToNotifications } from "../services/notificationService";
import FamilyChat from "../components/FamilyChat";
import GeminiChatbot from "../components/GeminiChatbot"; // Internal name remains for now, but label will be Swasthyalink AI
import AddFamilyMember from "../components/AddFamilyMember";
import FamilyRequestManager from "../components/FamilyRequestManager";
import UpdatedAddFamilyMember from "../components/UpdatedAddFamilyMember";
import FamilyNetworkManager from "../components/FamilyNetworkManager";
import { subscribeToConversations } from "../services/chatService";
import { getFamilyNetwork } from "../services/familyService";

// Patient data will be loaded from real data
const mockSharedPatient = {
  name: "Loading...",
  age: "...",
  bloodGroup: "...",
  emergencyContacts: [],
  lastUpdated: "..."
};

// Health records will be loaded from real data
const mockSharedRecords = [];

// Family member info will be loaded from real data
const mockFamilyMember = {
  name: "Loading...",
  relationship: "...",
  accessLevel: "limited",
  avatar: "https://ui-avatars.com/api/?name=Loading&background=gray&color=fff&size=64"
};

const FamilyDashboard = () => {
  const { currentUser, userRole } = useAuth();
  const [activeIdx, setActiveIdx] = useState(0);
  const [filteredRecords, setFilteredRecords] = useState([]);
  const [showAddMember, setShowAddMember] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);

  // Test function to create sample notifications (for debugging)
  const createTestNotifications = () => {
    const testNotifs = [
      {
        id: 'test1',
        type: 'chat_message',
        title: 'New message from John',
        message: 'Hey, how are you feeling today?',
        read: false,
        timestamp: new Date()
      },
      {
        id: 'test2',
        type: 'family_request',
        title: 'Family request from Sarah',
        message: 'Sarah wants to join your family network',
        read: false,
        timestamp: new Date()
      }
    ];
    setNotifications(testNotifs);
    console.log('🧪 Created test notifications:', testNotifs);
  };
  const [familyMembers, setFamilyMembers] = useState([]);
  const [conversations, setConversations] = useState([]);

  // Check for notification redirect
  useEffect(() => {
    const checkNotificationRedirect = () => {
      const redirectTab = localStorage.getItem('familyDashboardTab');
      const openFamilyChat = localStorage.getItem('openFamilyChat');
      
      if (redirectTab !== null) {
        console.log('🔔 Family dashboard redirect detected:', redirectTab);
        setActiveIdx(parseInt(redirectTab, 10));
        localStorage.removeItem('familyDashboardTab');
      }
      
      // Check if we need to open family chat specifically
      if (openFamilyChat === 'true') {
        console.log('🔔 Opening family chat from notification');
        setActiveIdx(3); // Family Chat tab
        localStorage.removeItem('openFamilyChat');
      }
    };

    // Check immediately and after a short delay to ensure component is mounted
    checkNotificationRedirect();
    const timeoutId = setTimeout(checkNotificationRedirect, 100);
    
    return () => clearTimeout(timeoutId);
  }, []);

  // Debug logging
  useEffect(() => {
    console.log("FamilyDashboard: Component mounted");
    console.log("FamilyDashboard: currentUser:", currentUser);
    console.log("FamilyDashboard: userRole:", userRole);
  }, [currentUser, userRole]);

  // DISABLED: Subscribe to notifications (real-time) and conversations for accurate badges
  // This was causing excessive Firestore reads and quota exceeded
  useEffect(() => {
    if (!currentUser) {
      setNotifications([]);
      setConversations([]);
      return;
    }

    console.log('🔔 FamilyDashboard: DISABLED real-time subscriptions to prevent quota exceeded');

    // DISABLED: Real-time subscriptions
    // const unsubNotifs = subscribeToNotifications(currentUser.uid, (notifs) => {
    //   console.log('📬 FamilyDashboard: Received notifications:', notifs?.length || 0);
    //   setNotifications(notifs || []);
    // });

    // const unsubConvos = subscribeToConversations(currentUser.uid, (items) => {
    //   console.log('💬 FamilyDashboard: Received conversations:', items?.length || 0);
    //   setConversations(items || []);
    // });

    // return () => {
    //   if (unsubNotifs) unsubNotifs();
    //   if (unsubConvos) unsubConvos();
    // };
  }, [currentUser]);

  // Remove the old useEffect since we're now using the auth context

  // Fetch family network members automatically
  const fetchFamilyMembers = async () => {
    if (currentUser?.uid) {
      try {
        const members = await getFamilyNetwork(currentUser.uid);
        setFamilyMembers(members || []);
      } catch (error) {
        console.error("Error fetching family members:", error);
      }
    }
  };

  useEffect(() => {
    fetchFamilyMembers();
  }, [currentUser]);

  useEffect(() => {
    // Filter records based on access level
    let accessibleRecords = [];
    
    // Filter based on family member's access level
    switch (mockFamilyMember.accessLevel) {
      case "full":
        accessibleRecords = mockSharedRecords;
        break;
      case "limited":
        accessibleRecords = mockSharedRecords.filter(record => 
          record.accessLevel === "limited" || record.accessLevel === "emergency"
        );
        break;
      case "emergency":
        accessibleRecords = mockSharedRecords.filter(record => 
          record.accessLevel === "emergency"
        );
        break;
      default:
        accessibleRecords = [];
    }
    
    setFilteredRecords(accessibleRecords);
  }, []);


  const getAccessLevelColor = (level) => {
    switch (level) {
      case "full": return "bg-green-100 text-green-800";
      case "limited": return "bg-yellow-100 text-yellow-800";
      case "emergency": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const handleAddFamilyMember = (newMember) => {
    setFamilyMembers(prev => [...prev, newMember]);
    // In a real app, this would also create a chat conversation
    console.log('New family member added:', newMember);   
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'accepted': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'declined': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Calculate badges: chat unread from conversations.unread[currentUser.uid], others from notifications
  const getNotificationBadges = () => {
    const uid = currentUser?.uid;
    // Chat unread from Firestore conversations
    const chatUnread = uid ? (conversations || []).reduce((sum, c) => {
      const unreadCount = c?.unread?.[uid] || 0;
      console.log(`Conversation ${c?.id}: unread for ${uid} = ${unreadCount}`);
      return sum + unreadCount;
    }, 0) : 0;

    // Notifications: unread and not deleted
    const unreadNotifications = notifications.filter(n => !n.read && !n.deleted);
    const familyRequestNotifications = unreadNotifications.filter(n => n.type === 'family_request');

    console.log('🔔 Badge calculation:', {
      convCount: conversations.length,
      chatUnread,
      notifTotal: notifications.length,
      notifUnread: unreadNotifications.length,
      familyRequestNotifications: familyRequestNotifications.length,
      conversations: conversations.map(c => ({
        id: c.id,
        unread: c.unread,
        lastMessage: c.lastMessage
      }))
    });

    return {
      chat: chatUnread,
      familyRequests: familyRequestNotifications.length,
      total: unreadNotifications.length
    };
  };

  // Show loading state if user data is not available
  if (!currentUser && userRole !== 'patient') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading Family Dashboard...</p>
        </div>
      </div>
    );
  }

  // Show error if user doesn't have access (only patients can access family dashboard)
  if (userRole !== 'patient') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="text-red-500 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Access Denied</h2>
          <p className="text-gray-600">Only patients can access the Family Dashboard.</p>
          <p className="text-sm text-gray-500 mt-2">Current role: {userRole}</p>
        </div>
      </div>
    );
  }

  const renderOverview = () => (
    <div className="w-full max-w-7xl space-y-8">
      {/* Header bar with quick stats */}
      <section className="bg-white rounded-2xl shadow-lg p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900">Family Dashboard</h2>
          <p className="text-gray-500">Stay connected and manage shared health with style.</p>
        </div>
        <div className="grid grid-cols-3 gap-3 w-full md:w-auto">
          <div className="bg-gradient-to-br from-indigo-500 to-blue-500 text-white rounded-xl px-4 py-3">
            <div className="text-xs opacity-80">Unread Chats</div>
            <div className="text-2xl font-bold">{badges.chat}</div>
            <button 
              onClick={() => {
                console.log('🔄 Refreshing conversations...');
                // Force re-render by updating state
                setConversations([...conversations]);
              }}
              className="text-xs opacity-70 hover:opacity-100 mt-1"
            >
              Refresh
            </button>
          </div>
          <div className="bg-gradient-to-br from-emerald-500 to-teal-500 text-white rounded-xl px-4 py-3">
            <div className="text-xs opacity-80">Members</div>
            <div className="text-2xl font-bold">{familyMembers.length}</div>
          </div>
          <div className="bg-gradient-to-br from-amber-500 to-orange-500 text-white rounded-xl px-4 py-3">
            <div className="text-xs opacity-80">Status</div>
            <div className="text-2xl font-bold">Active</div>
          </div>
        </div>
      </section>

      {/* Patient Overview + Emergency + Quick Actions */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Patient Overview Card */}
        <div className="lg:col-span-6 bg-white rounded-2xl shadow-lg p-8">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-indigo-700">Patient Overview</h3>
            <div className="flex items-center gap-3">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getAccessLevelColor(mockFamilyMember.accessLevel)}`}>
                {mockFamilyMember.accessLevel} Access
              </span>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-6">
            <div className="bg-gray-50 rounded-xl p-6">
              <h4 className="font-semibold text-gray-800 mb-3">Basic Information</h4>
              <ul className="space-y-2 text-sm">
                <li className="flex justify-between"><span className="text-gray-600">Name</span><span className="font-medium">{mockSharedPatient.name}</span></li>
                <li className="flex justify-between"><span className="text-gray-600">Age</span><span className="font-medium">{mockSharedPatient.age} years</span></li>
                <li className="flex justify-between"><span className="text-gray-600">Blood Group</span><span className="font-medium">{mockSharedPatient.bloodGroup}</span></li>
                <li className="flex justify-between"><span className="text-gray-600">Last Updated</span><span className="font-medium">{mockSharedPatient.lastUpdated}</span></li>
              </ul>
            </div>
            <div className="bg-gray-50 rounded-xl p-6">
              <h4 className="font-semibold text-gray-800 mb-3">Emergency Contacts</h4>
              <div className="space-y-2">
                {mockSharedPatient.emergencyContacts.map((contact, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 bg-white rounded border">
                    <span className="font-medium">{contact}</span>
                    <span className="text-xs text-gray-500">Emergency Contact</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>


        {/* Quick Actions */}
        <div className="lg:col-span-3 bg-white rounded-2xl shadow-lg p-8">
          <h3 className="text-xl font-bold text-gray-800 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => setShowAddMember(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-4 py-3 text-sm">Add Member</button>
            <button onClick={() => setActiveIdx(3)} className="bg-gray-100 hover:bg-gray-200 rounded-xl px-4 py-3 text-sm">Open Chat</button>
            <button onClick={() => setActiveIdx(1)} className="bg-gray-100 hover:bg-gray-200 rounded-xl px-4 py-3 text-sm">View Records</button>
            <button onClick={() => setActiveIdx(2)} className="bg-gray-100 hover:bg-gray-200 rounded-xl px-4 py-3 text-sm">Network</button>
          </div>
        </div>
      </section>
    </div>
  );

  const renderHealthRecords = () => (
    <div className="w-full max-w-6xl">
      <section className="bg-white rounded-xl shadow-lg p-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-indigo-700">Shared Health Records</h2>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">
              Showing {filteredRecords.length} of {mockSharedRecords.length} records
            </span>
          </div>
        </div>
        
        {filteredRecords.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-gray-600">
              No health records are currently shared with your access level.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-y-2">
              <thead>
                <tr className="bg-indigo-100">
                  <th className="px-4 py-2 text-left text-indigo-700">Date</th>
                  <th className="px-4 py-2 text-left text-indigo-700">Doctor</th>
                  <th className="px-4 py-2 text-left text-indigo-700">Diagnosis</th>
                  <th className="px-4 py-2 text-left text-indigo-700">Prescription</th>
                  <th className="px-4 py-2 text-left text-indigo-700">Notes</th>
                  <th className="px-4 py-2 text-left text-indigo-700">Access Level</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((record) => (
                  <tr key={record.id} className="hover:bg-indigo-50 transition-colors">
                    <td className="px-4 py-2 border-b">{record.date}</td>
                    <td className="px-4 py-2 border-b">{record.doctor}</td>
                    <td className="px-4 py-2 border-b">{record.diagnosis}</td>
                    <td className="px-4 py-2 border-b">{record.prescription}</td>
                    <td className="px-4 py-2 border-b">{record.notes}</td>
                    <td className="px-4 py-2 border-b">
                      <span className={`px-2 py-1 text-xs rounded-full ${getAccessLevelColor(record.accessLevel)}`}>
                        {record.accessLevel}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );

  const renderFamilyMembers = () => (
    <div className="w-full max-w-6xl space-y-6">
      {/* Family Requests Section */}
      <section className="bg-white rounded-xl shadow-lg p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-indigo-700">Family Requests</h2>
          <button
            onClick={() => setShowAddMember(true)}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors flex items-center space-x-2"
          >
            <span className="material-icons text-sm">person_add</span>
            <span>Add Member</span>
          </button>
        </div>
        
        <FamilyRequestManager onUpdate={() => {
          console.log("Family requests updated");
          // Force refresh of the family network when requests are updated
          setFamilyMembers([...familyMembers]);
        }} />
      </section>
      
      {/* Family Network Section */}
      <section className="bg-white rounded-xl shadow-lg p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-indigo-700">Family Network</h2>
        </div>
        
        <FamilyNetworkManager onUpdate={() => {
          console.log("Family network updated, refetching members...");
          fetchFamilyMembers();
        }} />
      </section>

      {/* Legacy Family Network UI */}
      <section className="bg-white rounded-xl shadow-lg p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-indigo-700">Family Members (Legacy UI)</h2>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {familyMembers.map((member) => (
            <div key={member.id} className="bg-gray-50 rounded-lg p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center space-x-4 mb-4">
                <div className="relative">
                  <img
                    src={member.avatar}
                    alt={member.name}
                    className="w-16 h-16 rounded-full"
                  />
                  {member.isOnline && (
                    <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 rounded-full border-2 border-white"></div>
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">{member.name}</h3>
                  <p className="text-sm text-gray-600">{member.relationship}</p>
                  <div className="flex items-center space-x-2 mt-1">
                    <span className={`text-xs px-2 py-1 rounded-full ${getAccessLevelColor(member.accessLevel)}`}>
                      {member.accessLevel}
                    </span>
                    <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(member.status)}`}>
                      {member.status}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex items-center space-x-2">
                  <span className="material-icons text-sm">email</span>
                  <span>{member.email}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="material-icons text-sm">phone</span>
                  <span>{member.phone}</span>
                </div>
                {member.lastAccess && (
                  <div className="flex items-center space-x-2">
                    <span className="material-icons text-sm">access_time</span>
                    <span>Last access: {member.lastAccess}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
                <div className="flex items-center space-x-2">
                  {member.isEmergencyContact && (
                    <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded-full">Emergency</span>
                  )}
                  {member.enableChat && (
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">Chat</span>
                  )}
                </div>
                <div className="flex space-x-2">
                  <button className="text-indigo-600 hover:text-indigo-800 transition-colors">
                    <span className="material-icons text-sm">edit</span>
                  </button>
                  <button className="text-red-600 hover:text-red-800 transition-colors">
                    <span className="material-icons text-sm">delete</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );

  const renderMainContent = () => {
    switch (activeIdx) {
      case 0: // Overview
        return renderOverview();
      case 1: // Health Records
        return renderHealthRecords();
      case 2: // Family Members
        return renderFamilyMembers();
      case 3: // Chat
        return (
          <>
            <FamilyChat />
            <GeminiChatbot />
          </>
        );
      case 4: // Emergency
        return (
          <div className="w-full max-w-4xl bg-white rounded-xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-indigo-700 mb-6 text-center">Emergency Information</h2>
            <div className="space-y-6">
              <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-red-800 mb-4">Emergency Contacts</h3>
                <div className="space-y-3">
                  {mockSharedPatient.emergencyContacts.map((contact, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-white p-3 rounded border">
                      <span className="font-medium">{contact}</span>
                      <span className="text-sm text-gray-600">Emergency Contact</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-yellow-800 mb-4">Allergies & Conditions</h3>
                <p className="text-gray-600">No known allergies or critical conditions recorded.</p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-blue-800 mb-4">Current Medications</h3>
                <ul className="space-y-2">
                  <li className="flex items-center">
                    <span className="w-2 h-2 bg-blue-500 rounded-full mr-3"></span>
                    Amlodipine 5mg - Daily
                  </li>
                  <li className="flex items-center">
                    <span className="w-2 h-2 bg-blue-500 rounded-full mr-3"></span>
                    Metformin 500mg - Twice daily
                  </li>
                </ul>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  // Get dynamic notification badges
  const badges = getNotificationBadges();
  
  // Debug: Log badge calculation every time
  console.log('🔔 Current badges:', badges);

  const sidebarLinks = [
    {
      label: "Overview",
      icon: <span className="material-icons text-lg">dashboard</span>
    },
    {
      label: "Health Records",
      icon: <span className="material-icons text-lg">medical_services</span>
    },
    {
      label: "Family Network",
      icon: <span className="material-icons text-lg">family_restroom</span>,
      badge: badges.familyRequests > 0 ? badges.familyRequests : null
    },
    {
      label: "Family Chat",
      icon: <span className="material-icons text-lg">chat</span>,
      badge: badges.chat > 0 ? badges.chat : null
    },
    {
      label: "Emergency",
      icon: <span className="material-icons text-lg">emergency</span>
    },
  ];

  return (
    <main className="min-h-[80vh] bg-gradient-to-br from-blue-50 to-indigo-100 px-4 py-10 flex flex-row items-start">
      {/* Mobile Menu Button */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="md:hidden fixed top-20 left-4 z-40 bg-white p-2 rounded-lg shadow-lg"
      >
        <span className="material-icons text-indigo-700">
          {sidebarOpen ? 'close' : 'menu'}
        </span>
      </button>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black bg-opacity-50 z-30"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 fixed md:relative top-0 left-0 h-full bg-white shadow-xl md:rounded-2xl mr-8 p-6 z-40 w-64 transition-transform duration-300`}>
        <div>
          {/* Family Member Profile Section */}
          <div className="flex flex-col items-center mb-8">
            <div className="relative">
              <img src={mockFamilyMember.avatar} alt="avatar" className="w-16 h-16 rounded-full border-2 border-indigo-500" />
              <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white rounded-full" />
            </div>
            <div className="mt-3 font-semibold text-indigo-700 text-center">{mockFamilyMember.name}</div>
            <div className="text-xs text-gray-500 text-center">{mockFamilyMember.relationship}</div>
          </div>
          
          <div className="text-xl font-bold text-indigo-700 mb-4 text-center">Family Access</div>

          {/* Mini stats */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            <div className="bg-indigo-50 text-indigo-800 rounded-lg p-2 text-center">
              <div className="text-[10px] uppercase">Members</div>
              <div className="text-sm font-bold">{familyMembers.length}</div>
            </div>
            <div className="bg-amber-50 text-amber-800 rounded-lg p-2 text-center">
              <div className="text-[10px] uppercase">Status</div>
              <div className="text-sm font-bold">Active</div>
            </div>
          </div>
          
          {sidebarLinks.map((link, idx) => (
            <button
              key={idx}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-colors relative w-full mb-2 ${
                activeIdx === idx 
                  ? 'bg-indigo-100 text-indigo-900 font-bold shadow-sm' 
                  : 'hover:bg-indigo-50 text-indigo-700 hover:text-indigo-900'
              }`}
              onClick={() => {
                setActiveIdx(idx);
                setSidebarOpen(false); // Close mobile sidebar when option is selected
              }}
            >
              {link.icon}
              <span className="text-sm">{link.label}</span>
              {link.badge && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {link.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </aside>
      
      {/* Main content */}
      <div className="flex-1 flex flex-col items-center md:ml-0 ml-0">
        {renderMainContent()}
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

export default FamilyDashboard; 