import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { auth, db } from "../firebaseConfig";
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore";
import EnhancedNotificationCenter from "./EnhancedNotificationCenter";
import Sidebar from "./Sidebar";
import { useAuth } from "../contexts/AuthContext";
import QRCode from "react-qr-code";

const Header = () => {
  const [notifications, setNotifications] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef(null);
  const navigate = useNavigate();
  const { currentUser, userRole, isAuthenticated, logout } = useAuth();
  let sidebarTimer = null;

  useEffect(() => {
    // Check if this is a test user (mock authentication)
    const isTestUser = localStorage.getItem('testUser') !== null;

    if (!isAuthenticated || !currentUser) {
      setNotifications([]);
      return;
    }

    // For test users, don't try to access Firestore
    if (isTestUser) {
      console.log('🧪 Using test user - skipping Firestore notifications');
      setNotifications([]);
      return;
    }

    // Reference to notifications collection filtered by current user
    const notificationsRef = collection(db, "notifications");
    const q = query(
      notificationsRef,
      where("recipientId", "==", currentUser.uid),
      orderBy("timestamp", "desc")
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const notifs = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        notifs.push({
          id: doc.id,
          type: data.type,
          message: data.message,
          timestamp: data.timestamp?.toDate ? data.timestamp.toDate().toLocaleString() : data.timestamp,
          read: data.read || false,
          conversationId: data.conversationId || null,
        });
      });
      setNotifications(notifs);
    }, (error) => {
      console.error('❌ Error fetching notifications:', error);
      setNotifications([]);
    });

    return () => unsubscribe();
  }, [isAuthenticated, currentUser]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setProfileMenuOpen(false);
      }
    }
    if (profileMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [profileMenuOpen]);

  const handleMarkAsRead = (id) => {
    setNotifications(notifications.map(n =>
      n.id === id ? { ...n, read: true } : n
    ));
  };

  const handleNotificationClick = (n) => {
    // Example: navigate to family chat based on conversationId
    if (n.type === 'chat' && n.conversationId) {
      navigate('/familydashboard');
      // Hint to FamilyChat to auto-open this conversation
      try {
        localStorage.setItem('openConversationId', n.conversationId);
      } catch { }
    }
    // Mark clicked notification as read
    if (!n.read) handleMarkAsRead(n.id);
  };

  const handleClearAll = () => {
    setNotifications(notifications.map(n => ({ ...n, read: true })));
  };

  // Sidebar open/close handlers
  const openSidebar = () => {
    if (sidebarTimer) clearTimeout(sidebarTimer);
    setSidebarOpen(true);
  };
  const closeSidebar = () => {
    sidebarTimer = setTimeout(() => setSidebarOpen(false), 150);
  };
  const toggleSidebar = () => setSidebarOpen((prev) => !prev);

  // Profile menu handlers
  const handleProfileMenu = () => setProfileMenuOpen((prev) => !prev);
  const handleLogout = async () => {
    await logout();
    setProfileMenuOpen(false);
    navigate('/');
  };
  const handleSettings = () => {
    navigate('/settings');
    setProfileMenuOpen(false);
  };
  const handleProfile = () => {
    navigate('/profile');
    setProfileMenuOpen(false);
  };

  console.log('🔍 Header rendering for user:', currentUser?.uid, 'isAuthenticated:', isAuthenticated);

  return (
    <header className="sticky top-0 z-[60] bg-white border-b border-gray-200 shadow-sm">
      <nav className="w-full flex flex-wrap items-center justify-between py-2 px-6 min-h-[50px]">
        {/* Left section: hamburger + logo */}
        <div className="flex items-center space-x-3 h-full">
          {isAuthenticated && (
            <button
              className="focus:outline-none m-0 p-0 h-full flex items-center"
              onClick={toggleSidebar}
              onMouseEnter={openSidebar}
              aria-label="Open sidebar menu"
              style={{ lineHeight: 0 }}
            >
              <span className="material-icons text-blue-600 text-2xl leading-none">menu</span>
            </button>
          )}
          <img src="/pwa-icon-512.png" alt="Swasthyalink Logo" className="h-8 w-8 object-contain rounded-full shadow-sm" />
          <span className="text-blue-600 drop-shadow-sm text-xl font-bold tracking-wide">Swasthyalink</span>
        </div>
        {/* Right section: notifications, profile menu, login/register */}
        <div className="flex flex-1 items-center justify-end">
          {isAuthenticated ? (
            <>
              <Sidebar open={sidebarOpen} onClose={closeSidebar} />
              <div className="flex items-center gap-4">
                <EnhancedNotificationCenter />
                {/* Profile menu - Hidden for doctors */}
                {userRole !== 'doctor' && (
                  <div className="relative" ref={profileMenuRef}>
                    <button
                      className="focus:outline-none flex items-center"
                      onClick={handleProfileMenu}
                      aria-label="Open profile menu"
                    >
                      <span className="material-icons text-blue-600 text-2xl">account_circle</span>
                    </button>
                    {profileMenuOpen && (
                      <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg z-50 py-2 px-4">
                        {currentUser?.uid && (
                          <div className="flex flex-col items-center mb-3">
                            <h4 className="text-sm font-semibold mb-1">My Patient QR</h4>
                            <QRCode value={`https://yourapp.com/patient/${currentUser.uid}`} size={100} />
                            <div className="text-xs text-gray-500 break-all mt-1">UID: {currentUser.uid}</div>
                            <div className="text-[10px] text-gray-400 break-all">https://yourapp.com/patient/{currentUser.uid}</div>
                          </div>
                        )}
                        <button onClick={handleProfile} className="block w-full text-left px-4 py-2 text-gray-700 hover:bg-indigo-50 rounded">Profile</button>
                        <button onClick={handleSettings} className="block w-full text-left px-4 py-2 text-gray-700 hover:bg-indigo-50 rounded">Settings</button>
                        <button onClick={handleLogout} className="block w-full text-left px-4 py-2 text-red-600 hover:bg-red-50 rounded">Logout</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center ml-auto gap-3">
              <Link to="/login" className="bg-white text-indigo-600 px-3 py-1.5 rounded-full shadow hover:bg-yellow-300 hover:text-indigo-800 transition-colors duration-200 text-sm">Login</Link>
              <Link to="/register" className="bg-yellow-300 text-indigo-800 px-3 py-1.5 rounded-full shadow hover:bg-white hover:text-indigo-600 transition-colors duration-200 text-sm">Register</Link>
            </div>
          )}
        </div>
      </nav>
    </header>
  );
};

export default Header;
