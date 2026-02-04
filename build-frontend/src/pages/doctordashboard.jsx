import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { getAuth, signOut } from "firebase/auth";
import { createNotification, subscribeToNotifications, markNotificationAsRead, NOTIFICATION_TYPES } from "../services/notificationService";
import { getPendingRequests, acceptRequest, getConnectedDoctors, createConnectionRequest, searchPatients } from "../services/patientDoctorService";
import { db } from "../firebaseConfig";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import QRCode from "react-qr-code";
import QRScanner from "../components/QRScanner";
import PrescriptionModal from "../components/PrescriptionModal";
import PatientProfileModal from "../components/PatientProfileModal";
import DoctorPrescriptions from "./DoctorPrescriptions";

const DoctorDashboard = () => {
  const { currentUser, userRole } = useAuth();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [profile, setProfile] = useState({
    name: "",
    specialization: "",
    license: "",
    experience: "",
    description: "",
    phone: "",
  });

  const [editing, setEditing] = useState(false);
  const [patients, setPatients] = useState([]);
  const [prescriptions, setPrescriptions] = useState({});
  const [connectionMethod, setConnectionMethod] = useState("qr"); // qr, otp, email
  const [connectionValue, setConnectionValue] = useState("");
  const [notification, setNotification] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [showPrescriptionModal, setShowPrescriptionModal] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [connectionRequests, setConnectionRequests] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showPatientProfile, setShowPatientProfile] = useState(false);
  const [selectedPatientForProfile, setSelectedPatientForProfile] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    console.log('Doctor Dashboard: AuthContext currentUser:', currentUser);

    // Check if we have a valid user (either Firebase user or test user)
    if (currentUser && currentUser.uid) {
      console.log('Doctor Dashboard: Using currentUser for API calls');
      loadDoctorData();
      setupNotifications();

      // Real-time listener for connection requests status
      // When a patient accepts, the status changes there, but we also want to listen to relationships

      const relationshipsRef = collection(db, 'patient_doctor_relationships');
      const q = query(relationshipsRef, where('doctorId', '==', currentUser.uid), where('status', '==', 'active'));

      const unsubscribeRel = onSnapshot(q, (snapshot) => {
        const patientsList = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            patientId: data.patientId,
            patientName: data.patient?.name || 'Unknown',
            patientEmail: data.patient?.email || 'N/A',
            patientPhone: data.patient?.phone || 'N/A',
            connectionDate: data.createdAt,
            ...data.patient // Merge other patient fields
          };
        });

        // Merge with existing full patient data if needed, but for now replace list
        if (snapshot.docChanges().some(change => change.type === 'added')) {
          setNotification('Client list updated!');
        }
        setPatients(patientsList);
      });

      return () => unsubscribeRel();
    } else {
      console.log('Doctor Dashboard: No valid user found');
      setNotification('Please sign in again to access the doctor dashboard.');
    }
  }, [currentUser]);

  const setupNotifications = () => {
    if (!currentUser?.uid) return;

    const unsubscribe = subscribeToNotifications(currentUser.uid, (notifs) => {
      console.log('Doctor Dashboard: Received notifications:', notifs);
      setNotifications(notifs);

      // Count unread notifications
      const unread = notifs.filter(n => !n.read).length;
      setUnreadCount(unread);

      // Check for connection accepted notifications and show SweetAlert
      const connectionAccepted = notifs.find(n =>
        n.type === NOTIFICATION_TYPES.CONNECTION_ACCEPTED && !n.read
      );

      if (connectionAccepted) {
        // Prevent duplicate alerts by tracking shown IDs locally
        const shownKey = `shownNotificationIds_${currentUser.uid}`;
        const shown = new Set(JSON.parse(localStorage.getItem(shownKey) || '[]'));
        if (!shown.has(connectionAccepted.id)) {
          shown.add(connectionAccepted.id);
          localStorage.setItem(shownKey, JSON.stringify(Array.from(shown)));
          showConnectionAcceptedAlert(connectionAccepted);
          // Best-effort mark as read (no-op in fallback)
          markNotificationAsRead(connectionAccepted.id);
        }
      }
    });

    return unsubscribe;
  };

  const showConnectionAcceptedAlert = async (notification) => {
    try {
      // Dynamically import SweetAlert2
      const Swal = (await import('sweetalert2')).default;

      const result = await Swal.fire({
        title: 'Connection Established Successfully!',
        text: notification.message || 'A patient has accepted your connection request',
        icon: 'success',
        confirmButtonText: 'Go to Prescriptions',
        showCancelButton: true,
        cancelButtonText: 'Stay Here',
        confirmButtonColor: '#3B82F6',
        cancelButtonColor: '#6B7280'
      });

      if (result.isConfirmed) {
        // Navigate to prescriptions tab
        setActiveTab('prescriptions');
      }
    } catch (error) {
      console.error('Error showing connection accepted alert:', error);
      // Fallback to regular notification
      setNotification('Connection established successfully!');
    }
  };

  const openPrescriptionModal = (patient) => {
    setSelectedPatient(patient);
    setShowPrescriptionModal(true);
  };

  const openPatientProfile = (patient) => {
    setSelectedPatientForProfile(patient);
    setShowPatientProfile(true);
  };

  const loadDoctorData = async () => {
    try {
      console.log('Doctor Dashboard: Loading doctor data for user:', currentUser?.uid);

      // Check if this is a test user
      const isTestUser = localStorage.getItem('testUser') !== null;
      console.log('Doctor Dashboard: Is test user:', isTestUser);

      // Use real user data from currentUser or testUser
      let doctorData = {};

      if (isTestUser) {
        // Get data from testUser localStorage
        const testUserData = JSON.parse(localStorage.getItem('testUser') || '{}');
        console.log('Doctor Dashboard: Test user data:', testUserData);

        doctorData = {
          name: testUserData.displayName || testUserData.name || "Dr. Unknown",
          specialization: testUserData.specialization || "General Medicine",
          license: testUserData.license || "UNKNOWN123",
          experience: testUserData.experience || "5 years",
          description: testUserData.description || "Healthcare professional",
          phone: testUserData.phone || "+1234567890",
        };
      } else {
        // Use currentUser data
        doctorData = {
          name: currentUser?.displayName || currentUser?.name || "Dr. Unknown",
          specialization: currentUser?.specialization || "General Medicine",
          license: currentUser?.license || "UNKNOWN123",
          experience: currentUser?.experience || "5 years",
          description: currentUser?.description || "Healthcare professional",
          phone: currentUser?.phone || "+1234567890",
        };
      }

      console.log('Doctor Dashboard: Setting profile with data:', doctorData);
      setProfile(doctorData);

      // Use fallback data for now
      setPatients([
        {
          patientId: "demo-patient-1",
          patientName: "John Smith",
          patientEmail: "john.smith@example.com",
          patientPhone: "+1234567890",
          patientAge: 45,
          patientGender: "Male",
          connectionDate: "2024-01-15T10:00:00Z",
          lastInteraction: "2024-01-20T14:30:00Z",
          bloodType: "O+",
          allergies: ["Penicillin"],
          emergencyContact: "Jane Smith - Wife"
        },
        {
          patientId: "demo-patient-2",
          patientName: "Sarah Johnson",
          patientEmail: "sarah.johnson@example.com",
          patientPhone: "+1234567891",
          patientAge: 32,
          patientGender: "Female",
          connectionDate: "2024-01-10T09:00:00Z",
          lastInteraction: "2024-01-18T11:15:00Z",
          bloodType: "A-",
          allergies: ["Shellfish", "Nuts"],
          emergencyContact: "Mike Johnson - Husband"
        },
      ]);

      // Use fallback data for connection requests
      setConnectionRequests([
        {
          id: "demo-request-1",
          patientName: "Michael Brown",
          patientEmail: "michael.brown@email.com",
          requestDate: "2024-01-20",
          status: "pending",
          connectionMethod: "email"
        }
      ]);

      // Clear any previous error notifications
      setNotification('');
      console.log('Doctor Dashboard: Data loaded successfully');
    } catch (error) {
      console.error('Error loading doctor data:', error);
      setNotification('Error loading data. Using demo data.');
    }
  };

  const handleProfileChange = (e) => {
    setProfile({ ...profile, [e.target.name]: e.target.value });
  };

  const refreshAuthToken = async () => {
    try {
      const auth = getAuth();
      const user = auth.currentUser;

      if (!user) {
        console.error('No authenticated user found');
        setNotification('No authenticated user found. Please sign in again.');
        return null;
      }

      if (typeof user.getIdToken !== 'function') {
        console.error('currentUser is not a valid Firebase User object');
        setNotification('Invalid user object. Please sign in again.');
        return null;
      }

      const token = await user.getIdToken(true); // Force refresh
      console.log('Token refreshed successfully');
      setNotification('Authentication refreshed successfully');
      return token;
    } catch (error) {
      console.error('Failed to refresh token:', error);
      setNotification('Failed to refresh authentication. Please sign in again.');
      return null;
    }
  };

  const handleSignOut = async () => {
    try {
      // Clear test user data from localStorage
      localStorage.removeItem('testUser');
      localStorage.removeItem('testUserRole');

      const auth = getAuth();
      await signOut(auth);
      setNotification('Signed out successfully. Please sign in again.');
      // The AuthContext will handle the redirect to login page
    } catch (error) {
      console.error('Error signing out:', error);
      setNotification('Error signing out. Please try again.');
    }
  };

  const saveProfile = () => {
    // TODO: Save profile to backend
    setEditing(false);
    setNotification("Profile saved successfully.");
  };

  const sendPrescription = (patient) => {
    // TODO: Send prescription to patient and notify
    const patientPrescription = prescriptions[patient.id] || "";
    if (!patientPrescription.trim()) {
      setNotification("Please write a prescription before sending.");
      return;
    }
    setNotification(`Prescription sent to ${patient.name}`);
    setPrescriptions({ ...prescriptions, [patient.id]: "" });
  };

  const connectPatient = async () => {
    if (!connectionValue.trim()) {
      setNotification("Please enter a valid value");
      return;
    }

    try {
      if (connectionMethod === "qr") {
        await handleQRConnection(connectionValue);
      } else if (connectionMethod === "email") {
        await handleEmailConnection(connectionValue);
      } else if (connectionMethod === "otp") {
        await handleOTPConnection(connectionValue);
      }

      setConnectionValue("");
    } catch (error) {
      setNotification("Failed to send connection request");
      console.error("Connection error:", error);
    }
  };

  const handleQRConnection = async (qrData) => {
    try {
      // Extract patient ID from QR code URL
      const patientId = qrData.split('/').pop();

      // Create connection request via service
      const result = await createConnectionRequest({
        patientId,
        connectionMethod: 'qr',
        message: `Dr. ${profile.name} wants to connect with you via QR code scan.`
      });

      if (result.success) {
        setNotification("Connection request sent successfully!");
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('QR connection error:', error);
      setNotification("Failed to send connection request: " + error.message);
      throw error;
    }
  };

  const handleEmailConnection = async (email) => {
    try {
      // Create connection request via service with direct method (no OTP)
      const result = await createConnectionRequest({
        patientEmail: email,
        connectionMethod: 'direct', // Use direct method instead of email/otp
        message: `Dr. ${profile.name} wants to connect with you.`
      });

      if (result.success) {
        setNotification("Connection invitation sent! Patient can accept the request directly.");
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Email connection error:', error);
      if (error.message.includes('User not authenticated')) {
        // Try to refresh the token and retry
        console.log('Attempting to refresh authentication token for email connection...');
        const refreshed = await refreshAuthToken();
        if (refreshed) {
          try {
            const retryResult = await createConnectionRequest({
              patientEmail: email,
              connectionMethod: 'direct',
              message: `Dr. ${profile.name} wants to connect with you.`
            });
            if (retryResult.success) {
              setNotification("Connection invitation sent! Patient can accept the request directly.");
              return;
            }
          } catch (retryError) {
            console.error('Retry failed:', retryError);
          }
        }
        setNotification('Please sign in again to send connection requests.');
      } else {
        setNotification("Failed to send email invitation: " + error.message);
      }
      throw error;
    }
  };

  const handleOTPConnection = async (phone) => {
    try {
      // Create connection request via service with OTP method
      const result = await createConnectionRequest({
        patientPhone: phone,
        connectionMethod: 'otp',
        message: `Dr. ${profile.name} wants to connect with you via phone verification.`
      });

      if (result.success) {
        setNotification("OTP sent to patient's phone! They will receive a verification code.");
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('OTP connection error:', error);
      if (error.message.includes('User not authenticated')) {
        setNotification('Please sign in again to send connection requests.');
      } else {
        setNotification("Failed to send OTP: " + error.message);
      }
      throw error;
    }
  };

  const handleQRScan = (qrData) => {
    setConnectionValue(qrData);
    setIsScanning(false);
    setNotification("QR code scanned successfully! Click 'Send Connection Request' to proceed.");
  };

  const handleQRError = (error) => {
    setNotification(`QR Scanner Error: ${error}`);
    setIsScanning(false);
  };

  const startQRScanning = () => {
    setIsScanning(true);
    setConnectionMethod("qr");
  };

  const searchPatientsHandler = async (query) => {
    if (query.length < 3) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const result = await searchPatients(query);
      if (result.success) {
        setSearchResults(result.patients);
      } else {
        setSearchResults([]);
        setNotification('No patients found matching your search.');
      }
    } catch (error) {
      console.error('Error searching patients:', error);
      if (error.message.includes('User not authenticated')) {
        // Try to refresh the token and retry
        console.log('Attempting to refresh authentication token...');
        const refreshed = await refreshAuthToken();
        if (refreshed) {
          try {
            const retryResult = await searchPatients(query);
            if (retryResult.success) {
              setSearchResults(retryResult.patients);
              return;
            }
          } catch (retryError) {
            console.error('Retry failed:', retryError);
          }
        }
        setNotification('Please sign in again to search for patients.');
      } else {
        setNotification('Error searching patients: ' + error.message);
      }
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const connectToPatient = async (patient) => {
    try {
      const result = await createConnectionRequest({
        patientId: patient.id,
        connectionMethod: 'direct',
        message: `Dr. ${profile.name} would like to connect with you to provide medical care.`
      });

      if (result.success) {
        setNotification(`Connection request sent to ${patient.name}`);
        setSearchQuery("");
        setSearchResults([]);
        loadDoctorData(); // Refresh data
      }
    } catch (error) {
      console.error('Error connecting to patient:', error);
      setNotification('Error sending connection request: ' + error.message);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex">
        {/* Sidebar */}
        <div className="w-64 bg-white shadow-lg min-h-screen">
          <div className="p-6">
            {/* Header */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-2">
                <h1 className="text-2xl font-bold text-gray-900">Doctor Dashboard</h1>
                {unreadCount > 0 && (
                  <div className="relative">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-blue-600 text-lg">🔔</span>
                    </div>
                    <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                      {unreadCount}
                    </div>
                  </div>
                )}
              </div>
              <p className="text-gray-600 text-sm">Welcome back, {profile.name}</p>
              <div className="mt-2">
                <div className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium inline-block">
                  Online
                </div>
              </div>
            </div>

            {/* Navigation */}
            <nav className="space-y-2">
              {[
                { id: 'dashboard', name: 'Dashboard', icon: '📊' },
                { id: 'patients', name: 'Patients', icon: '👥' },
                { id: 'connect', name: 'Connect Patient', icon: '🔗' },
                { id: 'prescriptions', name: 'Prescriptions', icon: '💊' },
                { id: 'profile', name: 'Profile', icon: '👤' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${activeTab === tab.id
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'text-gray-600 hover:bg-gray-100'
                    }`}
                >
                  <span className="text-lg">{tab.icon}</span>
                  <span className="flex-1">{tab.name}</span>
                </button>
              ))}
            </nav>

            {/* Doctor Profile Section */}
            <div className="mt-8 pt-8 border-t border-gray-200">
              <div
                onClick={() => setActiveTab('profile')}
                className="flex items-center gap-3 px-3 py-3 bg-gray-50 rounded-lg mb-4 cursor-pointer hover:bg-gray-100 transition-colors"
              >
                <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                  {profile.name ? profile.name.split(' ').map(n => n[0]).join('').toUpperCase() : 'D'}
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-gray-900 text-sm">{profile.name}</div>
                  <div className="text-xs text-gray-500">Doctor</div>
                </div>
                <button className="text-indigo-600 hover:text-indigo-800 text-xs font-medium">
                  Edit
                </button>
              </div>

              {/* Logout Button */}
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-red-600 hover:bg-red-50 transition-colors"
              >
                <span className="text-lg">🚪</span>
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-8">
          <div className="max-w-7xl mx-auto">
            {activeTab === 'dashboard' && (
              <div className="space-y-6">
                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                    <div className="flex items-center">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <span className="text-2xl">👥</span>
                      </div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-600">Total Patients</p>
                        <p className="text-2xl font-bold text-gray-900">{patients.length}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                    <div className="flex items-center">
                      <div className="p-2 bg-green-100 rounded-lg">
                        <span className="text-2xl">📅</span>
                      </div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-600">Today's Appointments</p>
                        <p className="text-2xl font-bold text-gray-900">5</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                    <div className="flex items-center">
                      <div className="p-2 bg-yellow-100 rounded-lg">
                        <span className="text-2xl">⏳</span>
                      </div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-600">Pending Requests</p>
                        <p className="text-2xl font-bold text-gray-900">{connectionRequests.length}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                    <div className="flex items-center">
                      <div className="p-2 bg-purple-100 rounded-lg">
                        <span className="text-2xl">💊</span>
                      </div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-600">Prescriptions</p>
                        <p className="text-2xl font-bold text-gray-900">12</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Recent Activity */}
                <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm text-gray-600">New patient connection request from John Doe</span>
                      <span className="text-xs text-gray-400">2 hours ago</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      <span className="text-sm text-gray-600">Prescription sent to Patient Two</span>
                      <span className="text-xs text-gray-400">4 hours ago</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                      <span className="text-sm text-gray-600">Appointment scheduled with Patient One</span>
                      <span className="text-xs text-gray-400">1 day ago</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'patients' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold text-gray-900">My Patients</h2>
                  <div className="flex space-x-3">
                    <input
                      type="text"
                      placeholder="Search patients..."
                      className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
                      Filter
                    </button>
                  </div>
                </div>

                <div className="grid gap-6">
                  {patients.map((patient) => (
                    <div key={patient.patientId || patient.id} className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center space-x-4">
                          <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold">
                            {(patient.patientName || patient.name || 'P').split(' ').map(n => n[0]).join('').toUpperCase()}
                          </div>
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900">{patient.patientName || patient.name}</h3>
                            <p className="text-gray-600">{patient.patientEmail || patient.email}</p>
                            <div className="flex items-center space-x-4 mt-2">
                              {patient.patientAge && <span className="text-sm text-gray-500">Age: {patient.patientAge}</span>}
                              {patient.patientGender && <span className="text-sm text-gray-500">Gender: {patient.patientGender}</span>}
                              {patient.patientPhone && <span className="text-sm text-gray-500">Phone: {patient.patientPhone}</span>}
                            </div>
                            <div className="flex items-center space-x-2 mt-2">
                              {patient.connectionDate && (
                                <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
                                  Connected: {new Date(patient.connectionDate).toLocaleDateString()}
                                </span>
                              )}
                              <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                Active Patient
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => openPrescriptionModal(patient)}
                            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium"
                          >
                            Prescribe
                          </button>
                          <button
                            onClick={() => openPatientProfile(patient)}
                            className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 text-sm"
                          >
                            View History
                          </button>
                        </div>
                      </div>

                      {/* Patient Medical Info */}
                      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                        {patient.bloodType && (
                          <div className="p-3 bg-red-50 rounded-lg">
                            <p className="text-sm text-gray-600"><strong>Blood Type:</strong> {patient.bloodType}</p>
                          </div>
                        )}
                        {patient.allergies && patient.allergies.length > 0 && (
                          <div className="p-3 bg-yellow-50 rounded-lg">
                            <p className="text-sm text-gray-600"><strong>Allergies:</strong> {patient.allergies.join(', ')}</p>
                          </div>
                        )}
                        {patient.emergencyContact && (
                          <div className="p-3 bg-blue-50 rounded-lg">
                            <p className="text-sm text-gray-600"><strong>Emergency Contact:</strong> {patient.emergencyContact}</p>
                          </div>
                        )}
                        {patient.lastInteraction && (
                          <div className="p-3 bg-gray-50 rounded-lg">
                            <p className="text-sm text-gray-600"><strong>Last Interaction:</strong> {new Date(patient.lastInteraction).toLocaleDateString()}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'connect' && (
              <div className="space-y-6">
                <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                  <h2 className="text-2xl font-bold text-gray-900 mb-6">Connect with Patients</h2>

                  {/* Patient Search */}
                  <div className="mb-8 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Search Existing Patients</h3>
                    <div className="relative">
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value);
                          searchPatientsHandler(e.target.value);
                        }}
                        placeholder="Search by name, email, or phone number..."
                        className="w-full px-4 py-3 pl-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <div className="absolute left-4 top-3.5">
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      </div>
                      {isSearching && (
                        <div className="absolute right-4 top-3.5">
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                        </div>
                      )}
                    </div>

                    {/* Search Results */}
                    {searchResults.length > 0 && (
                      <div className="mt-4 max-h-64 overflow-y-auto">
                        <div className="space-y-2">
                          {searchResults.map((patient) => (
                            <div key={patient.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200 hover:border-blue-300 transition-colors">
                              <div className="flex items-center space-x-3">
                                <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                                  {patient.name ? patient.name.split(' ').map(n => n[0]).join('').toUpperCase() : 'P'}
                                </div>
                                <div>
                                  <p className="font-medium text-gray-900">{patient.name || 'Unknown Patient'}</p>
                                  <p className="text-sm text-gray-600">{patient.email}</p>
                                  {patient.phone && <p className="text-sm text-gray-500">{patient.phone}</p>}
                                </div>
                              </div>
                              <button
                                onClick={() => connectToPatient(patient)}
                                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium"
                              >
                                Connect
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {searchQuery.length >= 3 && searchResults.length === 0 && !isSearching && (
                      <div className="mt-4 p-4 bg-gray-50 rounded-lg text-center">
                        <p className="text-gray-600">No patients found matching "{searchQuery}"</p>
                        <p className="text-sm text-gray-500 mt-1">Try searching by email, phone, or full name</p>
                      </div>
                    )}
                  </div>

                  {/* Connection Methods */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div
                      className={`p-6 rounded-xl border-2 cursor-pointer transition-all ${connectionMethod === "qr"
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:border-gray-300"
                        }`}
                      onClick={() => setConnectionMethod("qr")}
                    >
                      <div className="text-center">
                        <div className="text-4xl mb-3">📱</div>
                        <h3 className="font-semibold text-gray-900 mb-2">QR Code Scan</h3>
                        <p className="text-sm text-gray-600">Scan patient's QR code to connect instantly</p>
                      </div>
                    </div>

                    <div
                      className={`p-6 rounded-xl border-2 cursor-pointer transition-all ${connectionMethod === "email"
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:border-gray-300"
                        }`}
                      onClick={() => setConnectionMethod("email")}
                    >
                      <div className="text-center">
                        <div className="text-4xl mb-3">📧</div>
                        <h3 className="font-semibold text-gray-900 mb-2">Email Invitation</h3>
                        <p className="text-sm text-gray-600">Send connection request via email</p>
                      </div>
                    </div>

                    <div
                      className={`p-6 rounded-xl border-2 cursor-pointer transition-all ${connectionMethod === "otp"
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:border-gray-300"
                        }`}
                      onClick={() => setConnectionMethod("otp")}
                    >
                      <div className="text-center">
                        <div className="text-4xl mb-3">🔢</div>
                        <h3 className="font-semibold text-gray-900 mb-2">OTP Verification</h3>
                        <p className="text-sm text-gray-600">Connect using phone number and OTP</p>
                      </div>
                    </div>
                  </div>

                  {/* Connection Form */}
                  <div className="bg-gray-50 rounded-xl p-6">
                    {connectionMethod === "qr" && (
                      <div>
                        {isScanning ? (
                          <QRScanner
                            onScan={handleQRScan}
                            onError={handleQRError}
                            onClose={() => setIsScanning(false)}
                            isActive={isScanning}
                          />
                        ) : (
                          <div className="text-center">
                            <div className="mb-4">
                              <div className="w-32 h-32 bg-white rounded-lg mx-auto flex items-center justify-center border-2 border-dashed border-gray-300">
                                <div className="text-gray-400">
                                  <div className="text-4xl">📱</div>
                                  <p className="text-sm mt-2">QR Scanner</p>
                                </div>
                              </div>
                            </div>
                            <button
                              onClick={startQRScanning}
                              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-medium mb-4"
                            >
                              Start QR Scanner
                            </button>
                            <p className="text-sm text-gray-600 mb-3">
                              Or paste QR code data manually:
                            </p>
                            <input
                              type="text"
                              placeholder="Paste QR code data here..."
                              value={connectionValue}
                              onChange={(e) => setConnectionValue(e.target.value)}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {connectionMethod === "email" && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Patient Email Address
                        </label>
                        <input
                          type="email"
                          placeholder="patient@example.com"
                          value={connectionValue}
                          onChange={(e) => setConnectionValue(e.target.value)}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        <p className="text-sm text-gray-600 mt-2">
                          An invitation email will be sent to the patient with a secure connection link.
                        </p>
                      </div>
                    )}

                    {connectionMethod === "otp" && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Patient Phone Number
                        </label>
                        <input
                          type="tel"
                          placeholder="+1 (555) 123-4567"
                          value={connectionValue}
                          onChange={(e) => setConnectionValue(e.target.value)}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        <p className="text-sm text-gray-600 mt-2">
                          An OTP will be sent to the patient's phone for verification.
                        </p>
                      </div>
                    )}

                    <button
                      onClick={connectPatient}
                      disabled={!connectionValue.trim()}
                      className="mt-6 w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
                    >
                      Send Connection Request
                    </button>
                  </div>
                </div>

                {/* Pending Requests */}
                {connectionRequests.length > 0 && (
                  <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Pending Connection Requests</h3>
                    <div className="space-y-3">
                      {connectionRequests.map((request) => (
                        <div key={request.id} className="flex items-center justify-between p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                          <div>
                            <p className="font-medium text-gray-900">{request.patientName}</p>
                            <p className="text-sm text-gray-600">{request.patientEmail}</p>
                            <p className="text-xs text-gray-500">Sent on {request.requestDate}</p>
                          </div>
                          <div className="flex space-x-2">
                            <button className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700">
                              Resend
                            </button>
                            <button className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700">
                              Cancel
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'prescriptions' && (
              <DoctorPrescriptions />
            )}

            {activeTab === 'profile' && (
              <div className="space-y-6">
                <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                  <h2 className="text-2xl font-bold text-gray-900 mb-6">Doctor Profile</h2>

                  {editing ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                        <input
                          type="text"
                          name="name"
                          value={profile.name}
                          onChange={handleProfileChange}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Specialization</label>
                        <input
                          type="text"
                          name="specialization"
                          value={profile.specialization}
                          onChange={handleProfileChange}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">License Number</label>
                        <input
                          type="text"
                          name="license"
                          value={profile.license}
                          onChange={handleProfileChange}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Experience</label>
                        <input
                          type="text"
                          name="experience"
                          value={profile.experience}
                          onChange={handleProfileChange}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
                        <input
                          type="text"
                          name="phone"
                          value={profile.phone}
                          onChange={handleProfileChange}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                        <textarea
                          name="description"
                          value={profile.description}
                          onChange={handleProfileChange}
                          rows="4"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div className="md:col-span-2 flex space-x-4">
                        <button
                          onClick={saveProfile}
                          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
                        >
                          Save Changes
                        </button>
                        <button
                          onClick={() => setEditing(false)}
                          className="bg-gray-300 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-400"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-500">Full Name</label>
                          <p className="text-lg text-gray-900">{profile.name}</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-500">Specialization</label>
                          <p className="text-lg text-gray-900">{profile.specialization}</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-500">License Number</label>
                          <p className="text-lg text-gray-900">{profile.license}</p>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-500">Experience</label>
                          <p className="text-lg text-gray-900">{profile.experience}</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-500">Phone Number</label>
                          <p className="text-lg text-gray-900">{profile.phone}</p>
                        </div>
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-500">Description</label>
                        <p className="text-lg text-gray-900">{profile.description}</p>
                      </div>
                      <div className="md:col-span-2 flex space-x-4">
                        <button
                          onClick={() => setEditing(true)}
                          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
                        >
                          Edit Profile
                        </button>
                        <button
                          onClick={refreshAuthToken}
                          className="bg-yellow-600 text-white px-6 py-2 rounded-lg hover:bg-yellow-700"
                        >
                          Refresh Auth
                        </button>
                        <button
                          onClick={handleSignOut}
                          className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700"
                        >
                          Sign Out
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Notification Toast */}
            {notification && (
              <div className="fixed bottom-4 right-4 bg-white border border-gray-200 rounded-lg shadow-lg p-4 max-w-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <p className="text-sm text-gray-900">{notification}</p>
                  </div>
                  <button
                    onClick={() => setNotification("")}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}

            {/* Prescription Modal */}
            <PrescriptionModal
              patient={selectedPatient}
              isOpen={showPrescriptionModal}
              onClose={() => {
                setShowPrescriptionModal(false);
                setSelectedPatient(null);
              }}
              onSuccess={(message) => {
                setNotification(message);
                loadDoctorData(); // Refresh data
              }}
            />

            {/* Patient Profile Modal */}
            <PatientProfileModal
              patient={selectedPatientForProfile}
              isOpen={showPatientProfile}
              onClose={() => {
                setShowPatientProfile(false);
                setSelectedPatientForProfile(null);
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default DoctorDashboard;
