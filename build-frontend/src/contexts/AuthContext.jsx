import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../firebaseConfig';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isPresetAdmin, setIsPresetAdmin] = useState(false);

  useEffect(() => {
    // Check for preset admin on mount
    const presetAdmin = localStorage.getItem('presetAdmin') === 'true';
    setIsPresetAdmin(presetAdmin);

    // Function to check and set test user
    const checkTestUser = () => {
      const testUser = localStorage.getItem('testUser');
      const testUserRole = localStorage.getItem('testUserRole');

      if (testUser && testUserRole) {
        console.log('🧪 Using test user from localStorage');
        const mockUser = JSON.parse(testUser);
        console.log('🧪 Test user data:', mockUser);
        console.log('🧪 Test user role:', testUserRole);
        setCurrentUser(mockUser);
        setUserRole(testUserRole);
        setLoading(false);
        return true;
      }
      return false;
    };

    // Check for test user first
    if (checkTestUser()) {
      return;
    }

    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        setCurrentUser(user);

        // Check if this is a test user (mock authentication)
        const isTestUser = localStorage.getItem('testUser') !== null;

        if (isTestUser) {
          console.log('🧪 Using test user - checking role from localStorage');
          const testUserRole = localStorage.getItem('testUserRole');
          setUserRole(testUserRole || 'patient'); // Use stored role or default to patient
          setLoading(false);
          return;
        }

        // Try to get user role from Firestore, with fallback
        try {
          console.log("AuthContext: Attempting to get user role from Firestore for UID:", user.uid);

          const userDocRef = doc(db, 'users', user.uid);
          const userDocSnap = await getDoc(userDocRef);

          if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            console.log("AuthContext: User data from Firestore:", userData);
            setUserRole(userData.role || 'patient');

            // Update currentUser with Firestore data to ensure consistent UID
            const updatedUser = {
              ...user,
              ...userData,
              uid: userDocSnap.id // Use Firestore document ID as the UID (this should override user.uid)
            };
            // Force override the uid property to ensure it's correct
            updatedUser.uid = userDocSnap.id;

            // CRITICAL: Ensure the user object has all necessary Firebase methods
            if (user.getIdToken) {
              updatedUser.getIdToken = user.getIdToken.bind(user);
            }
            if (user.reload) {
              updatedUser.reload = user.reload.bind(user);
            }
            if (user.uid) {
              updatedUser.uid = user.uid; // Keep original Firebase UID for auth
            }

            // Add missing Firebase methods if they don't exist
            if (!updatedUser.getIdToken) {
              console.warn("AuthContext: getIdToken method missing, adding fallback");
              updatedUser.getIdToken = async () => {
                console.log("AuthContext: Fallback getIdToken called, returning test token");
                return 'test-patient-token';
              };
            }

            console.log("AuthContext: Updating currentUser with Firestore data:", updatedUser);
            console.log("AuthContext: UID before setCurrentUser:", updatedUser.uid);
            console.log("AuthContext: Has getIdToken method:", typeof updatedUser.getIdToken === 'function');
            setCurrentUser(updatedUser);
            console.log("AuthContext: setCurrentUser called, UID should be:", userDocSnap.id);
          } else {
            console.log("AuthContext: User document not found, using fallback data");
            // Use fallback user data with Firebase methods
            const userData = {
              ...user,
              uid: user.uid,
              name: user.displayName || user.email?.split('@')[0] || 'User',
              email: user.email,
              role: "patient", // Default to patient role
              createdAt: new Date().toISOString(),
              emailVerified: user.emailVerified
            };

            // Ensure Firebase methods are preserved
            if (user.getIdToken) {
              userData.getIdToken = user.getIdToken.bind(user);
            }
            if (user.reload) {
              userData.reload = user.reload.bind(user);
            }

            setUserRole(userData.role);
            setCurrentUser(userData);
          }
        } catch (error) {
          console.error("AuthContext: Error getting user data from Firestore:", error);
          console.log("AuthContext: Using fallback user data due to error");
          // Use fallback user data with Firebase methods
          const userData = {
            ...user,
            uid: user.uid,
            name: user.displayName || user.email?.split('@')[0] || 'User',
            email: user.email,
            role: "patient", // Default to patient role
            createdAt: new Date().toISOString(),
            emailVerified: user.emailVerified
          };

          // Ensure Firebase methods are preserved
          if (user.getIdToken) {
            userData.getIdToken = user.getIdToken.bind(user);
          }
          if (user.reload) {
            userData.reload = user.reload.bind(user);
          }

          setUserRole(userData.role);
          setCurrentUser(userData);
        }
      } else {
        setCurrentUser(null);
        setUserRole(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // Listen for localStorage changes to handle test user login
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'testUser' || e.key === 'testUserRole') {
        console.log('🧪 localStorage changed, checking for test user...');
        const testUser = localStorage.getItem('testUser');
        const testUserRole = localStorage.getItem('testUserRole');

        if (testUser && testUserRole) {
          console.log('🧪 Test user detected from localStorage change');
          const mockUser = JSON.parse(testUser);
          setCurrentUser(mockUser);
          setUserRole(testUserRole);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const isAuthenticated = () => {
    return currentUser !== null || isPresetAdmin;
  };

  const isEmailVerified = () => {
    // Treat test users and preset admin as verified
    if (localStorage.getItem('testUser') || isPresetAdmin) return true;

    // If Firestore role resolved to doctor or nurse, allow access even if Firebase flag isn't set
    if (userRole === 'doctor' || userRole === 'nurse') return true;

    return !!currentUser?.emailVerified;
  };

  const getUserRole = () => {
    if (isPresetAdmin) return 'admin';
    return userRole;
  };

  const canAccessRoute = (requiredRole = null) => {
    const authStatus = isAuthenticated();
    const emailStatus = isEmailVerified();
    const role = getUserRole();

    console.log('🔐 Checking route access:', {
      requiredRole,
      isAuthenticated: authStatus,
      isEmailVerified: emailStatus,
      userRole: role,
      currentUser: currentUser?.email,
      testUser: localStorage.getItem('testUser'),
      testUserRole: localStorage.getItem('testUserRole')
    });

    if (!authStatus) {
      console.log('🔐 Access denied: Not authenticated');
      return false;
    }
    if (!emailStatus) {
      console.log('🔐 Access denied: Email not verified');
      return false;
    }

    if (requiredRole) {
      // Special handling for family dashboard - patients can access it
      if (requiredRole === 'family' && role === 'patient') {
        console.log('🔐 Access granted: Patient can access family dashboard');
        return true;
      }
      const hasAccess = role === requiredRole;
      console.log('🔐 Role check result:', hasAccess, `(${role} === ${requiredRole})`);
      return hasAccess;
    }

    console.log('🔐 Access granted: No role requirement');
    return true;
  };

  const logout = async () => {
    try {
      // Handle test user logout
      if (localStorage.getItem('testUser')) {
        console.log('🧪 Logging out test user');
        localStorage.removeItem('testUser');
        localStorage.removeItem('testUserRole');
        setCurrentUser(null);
        setUserRole(null);
        return;
      }

      await auth.signOut();
      localStorage.removeItem('presetAdmin');
      setIsPresetAdmin(false);
      setCurrentUser(null);
      setUserRole(null);
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  const value = {
    currentUser,
    userRole: getUserRole(),
    isAuthenticated: isAuthenticated(),
    isEmailVerified: isEmailVerified(),
    isPresetAdmin,
    loading,
    canAccessRoute,
    logout,
    setPresetAdmin: (value) => {
      setIsPresetAdmin(value);
      if (value) {
        localStorage.setItem('presetAdmin', 'true');
      } else {
        localStorage.removeItem('presetAdmin');
      }
    }
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}; 