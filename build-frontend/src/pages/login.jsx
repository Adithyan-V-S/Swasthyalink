import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { auth, googleProvider, db } from "../firebaseConfig";
import { signInWithPopup, signInWithRedirect, getRedirectResult, sendPasswordResetEmail, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import authService from "../services/authService";
import { ERROR_MESSAGES } from "../constants";
import { useAuth } from "../contexts/AuthContext";
import { testCredentialGeneration, validateCredentials, fixStoredDoctors } from "../utils/credentialTest";

const Login = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [showResend, setShowResend] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState("");
  const [forgotPasswordMessage, setForgotPasswordMessage] = useState("");
  const [refreshKey, setRefreshKey] = useState(0); // To trigger re-render when localStorage changes
  const navigate = useNavigate();
  const location = useLocation();
  const { setPresetAdmin } = useAuth();

  useEffect(() => {
    if (location.state?.message) {
      setMessage(location.state.message);
    }

    // Run credential tests on page load
    console.log("🧪 Running credential tests...");
    testCredentialGeneration();
  }, [location]);

  // Listen for localStorage changes to update the credentials display
  useEffect(() => {
    const handleStorageChange = () => {
      setRefreshKey(prev => prev + 1);
    };

    window.addEventListener('storage', handleStorageChange);

    // Also listen for custom events (for same-tab updates)
    window.addEventListener('mockDoctorsUpdated', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('mockDoctorsUpdated', handleStorageChange);
    };
  }, []);

  // Handle redirect result for fallback authentication
  useEffect(() => {
    const handleRedirectResult = async () => {
      console.log("🔄 Checking for redirect sign-in result...");
      try {
        const result = await getRedirectResult(auth);
        if (result) {
          console.log("✅ Google redirect sign-in successful:", result);
          const user = result.user;

          // Check if this is an admin user (same logic as popup method)
          const adminEmails = [
            "admin@gmail.com",
            "admin@swasthyalink.com",
            "administrator@swasthyalink.com"
          ];

          const isAdminEmail = adminEmails.includes(user.email.toLowerCase()) ||
            user.email.toLowerCase().includes('admin');

          if (isAdminEmail) {
            console.log("Admin user detected via Google redirect:", user.email);
            setPresetAdmin(true);
            navigate("/admindashboard");
            return;
          }

          // Continue with normal user flow...
          const userDocRef = doc(db, "users", user.uid);
          const userDocSnap = await getDoc(userDocRef);

          if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            console.log("Existing user data (redirect):", userData);
            if (userData.role === "doctor") {
              navigate("/doctordashboard");
            } else if (userData.role === "nurse") {
              navigate("/nursedashboard");
            } else if (userData.role === "patient") {
              navigate("/patientdashboard");
            } else if (userData.role === "family") {
              navigate("/familydashboard");
            } else {
              navigate("/patientdashboard"); // Default to patient dashboard
            }
          } else {
            // New user, create user document and redirect to patient dashboard
            console.log("New user detected (redirect), creating user document...");
            try {
              const userData = {
                uid: user.uid,
                name: user.displayName || 'Unknown User',
                email: user.email,
                role: "patient", // Default role for Google sign-in users
                createdAt: new Date().toISOString(),
                lastActive: new Date().toISOString(),
                emailVerified: user.emailVerified,
                photoURL: user.photoURL || null
              };

              await setDoc(userDocRef, userData);
              console.log("✅ User document created successfully (redirect)");
              navigate("/patientdashboard");
            } catch (createError) {
              console.error("❌ Error creating user document (redirect):", createError);
              setError("Failed to create user profile. Please try again.");
            }
          }
        } else {
          console.log("ℹ️ No redirect sign-in result found.");
        }
      } catch (error) {
        console.error("Redirect result error:", error);
        setError("Authentication failed. Please try again.");
      }
    };

    handleRedirectResult();
  }, [navigate]);



  const handleGoogleSignIn = async () => {
    console.log("[DEBUG] Google sign-in button clicked (popup method)");
    setLoading(true);
    setError("");
    try {
      const result = await signInWithPopup(auth, googleProvider);
      console.log("✅ Google popup sign-in successful:", result);

      // Get the signed-in user
      const user = result.user;

      // Check if this is an admin user
      const adminEmails = [
        "admin@gmail.com",
        "admin@swasthyalink.com",
        "administrator@swasthyalink.com"
      ];

      const isAdminEmail = adminEmails.includes(user.email.toLowerCase()) ||
        user.email.toLowerCase().includes('admin');

      if (isAdminEmail) {
        console.log("Admin user detected via Google popup:", user.email);
        setPresetAdmin(true);
        navigate("/admindashboard");
        return;
      }

      // Check if user exists in Firestore
      const userDocRef = doc(db, "users", user.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists()) {
        // User exists, navigate based on role
        const userData = userDocSnap.data();
        console.log("Existing user data:", userData);
        if (userData.role === "doctor") {
          navigate("/doctordashboard");
        } else if (userData.role === "nurse") {
          navigate("/nursedashboard");
        } else if (userData.role === "patient") {
          navigate("/patientdashboard");
        } else if (userData.role === "family") {
          navigate("/familydashboard");
        } else {
          navigate("/patientdashboard"); // Default to patient dashboard
        }
      } else {
        // New user, create user document and redirect to patient dashboard
        console.log("New user detected, creating user document...");
        try {
          const userData = {
            uid: user.uid,
            name: user.displayName || 'Unknown User',
            email: user.email,
            role: "patient", // Default role for Google sign-in users
            createdAt: new Date().toISOString(),
            lastActive: new Date().toISOString(),
            emailVerified: user.emailVerified,
            photoURL: user.photoURL || null
          };

          await setDoc(userDocRef, userData);
          console.log("✅ User document created successfully");
          navigate("/patientdashboard");
        } catch (createError) {
          console.error("❌ Error creating user document:", createError);
          setError("Failed to create user profile. Please try again.");
        }
      }
    } catch (err) {
      console.error("[ERROR] Google sign-in (popup) failed:", err);

      // Handle specific Google Auth errors
      if (err.code === 'auth/popup-closed-by-user') {
        setError("Sign-in was cancelled. Please try again.");
      } else if (err.code === 'auth/popup-blocked') {
        setError("Popup was blocked by your browser. Please allow popups and try again.");
      } else if (err.code === 'auth/network-request-failed') {
        setError("Network error. Please check your connection and try again.");
      } else {
        setError(`Google sign-in failed: ${err.message}. Please try again.`);
      }
    } finally {
      setLoading(false);
    }
  };

  const createTestUserAccount = async (testUser) => {
    try {
      // Create user in Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(auth, testUser.email, testUser.password);
      const user = userCredential.user;

      console.log(`✅ Test user created: ${user.uid}`);

      // Create user document in Firestore
      const userData = {
        uid: user.uid,
        name: testUser.role === 'doctor' ? (testUser.name || 'Dr. Test Doctor') :
          testUser.role === 'nurse' ? (testUser.name || 'Nurse Demo') :
            testUser.role === 'patient' ? 'Test Patient' : 'Test Family Member',
        email: user.email,
        role: testUser.role,
        createdAt: new Date().toISOString(),
        lastActive: new Date().toISOString(),
        emailVerified: user.emailVerified,
        photoURL: user.photoURL || null
      };

      // Add doctor-specific fields if it's a doctor account
      if (testUser.role === 'doctor') {
        userData.specialization = testUser.specialization || 'General Medicine';
        userData.license = testUser.license || 'TEST123';
        userData.phone = testUser.phone || '+1234567890';
        userData.status = 'active';
      }

      await setDoc(doc(db, "users", user.uid), userData);
      console.log(`✅ User document created in Firestore for ${testUser.role}`);

      return user;
    } catch (error) {
      if (error.code === 'auth/email-already-in-use') {
        console.log(`User ${testUser.email} already exists, signing in instead`);
        // User already exists, sign them in
        const userCredential = await signInWithEmailAndPassword(auth, testUser.email, testUser.password);
        return userCredential.user;
      } else {
        console.error('Error creating test user:', error);
        throw error;
      }
    }
  };

  const handleDemoLogin = (demoEmail, demoPassword) => {
    setEmail(demoEmail);
    setPassword(demoPassword);
    // Use a small timeout to allow state updates before submit
    setTimeout(() => {
      const loginBtn = document.querySelector('button[type="submit"]');
      if (loginBtn) loginBtn.click();
    }, 100);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    console.log("Login attempt with:", { email, password });

    // Preset admin login check
    if (email === "admin@gmail.com" && password === "admin123") {
      console.log("Preset admin credentials detected, redirecting to admin dashboard");
      setLoading(false);
      setPresetAdmin(true);
      console.log("Preset admin set, attempting navigation...");
      try {
        navigate("/admindashboard");
        console.log("Navigation to /admin completed");
      } catch (error) {
        console.error("Navigation error:", error);
      }
      return;
    }

    // Additional test credentials for demo purposes
    const testCredentials = [
      { email: "test@swasthyakink.com", password: "test123", role: "patient", redirect: "/patientdashboard" },
      { email: "doctor@swasthyakink.com", password: "doctor123", role: "doctor", redirect: "/doctordashboard" },
      { email: "nurse@swasthyalink.com", password: "nurse123", role: "nurse", redirect: "/nursedashboard" },
      { email: "family@swasthyakink.com", password: "family123", role: "family", redirect: "/familydashboard" },
      { email: "doctor1758796374014@swasthyakink.com", password: "Doc374014!", role: "doctor", redirect: "/doctordashboard" },
      { email: "doctor1758810279159@swasthyalink.com", password: "Doc279159!", role: "doctor", redirect: "/doctordashboard" }
    ];

    // Check for exact match first
    let testUser = testCredentials.find(cred => cred.email === email && cred.password === password);

    // If no exact match, check for doctor pattern: doctor{timestamp}@swasthyalink.com with Doc{last6digits}!
    if (!testUser && email.includes('@swasthyalink.com') && email.startsWith('doctor')) {
      const timestampMatch = email.match(/doctor(\d+)@swasthyalink\.com/);
      if (timestampMatch) {
        const timestamp = timestampMatch[1];
        const expectedPassword = `Doc${timestamp.slice(-6)}!`;

        if (password === expectedPassword) {
          testUser = {
            email: email,
            password: password,
            role: "doctor",
            redirect: "/doctordashboard"
          };
          console.log(`Doctor pattern detected: ${email} with password ${password}`);
        }
      }
    }

    if (testUser) {
      console.log(`Test ${testUser.role} credentials detected, creating account and redirecting to ${testUser.redirect}`);
      setLoading(false);

      try {
        // Create the test user account in Firebase Authentication
        await createTestUserAccount(testUser);

        // Force set the role in localStorage for immediate access
        localStorage.setItem('testUserRole', testUser.role);
        console.log(`✅ Set testUserRole to: ${testUser.role}`);

        // Force a storage event to trigger AuthContext update
        window.dispatchEvent(new StorageEvent('storage', {
          key: 'testUserRole',
          newValue: testUser.role
        }));

        // Small delay to ensure AuthContext updates
        setTimeout(() => {
          navigate(testUser.redirect);
          console.log(`Navigation to ${testUser.redirect} completed`);
        }, 100);
      } catch (error) {
        console.error("Error creating test user or navigation:", error);
        setError("Failed to create test account. Please try again.");
        setLoading(false);
      }
      return;
    }

    // Check for doctors created through admin dashboard
    const mockDoctors = JSON.parse(localStorage.getItem('mockDoctors') || '[]');
    console.log("🔍 Available mock doctors:", mockDoctors);
    console.log("🔍 Looking for:", { email: email.toLowerCase(), password });
    console.log("🔍 localStorage mockDoctors key exists:", localStorage.getItem('mockDoctors') !== null);
    console.log("🔍 Number of mock doctors found:", mockDoctors.length);

    // Add the admin-created doctor to mockDoctors if not already present
    if (email === "websitejobportal@gmail.com" && password === "websitejobportal123") {
      console.log("🔍 Adding admin-created doctor to mockDoctors list");
      const adminDoctor = {
        id: 'ADMIN_DOC_1',
        uid: 'ADMIN_DOC_1',
        name: 'Dr. Website Job Portal',
        email: 'websitejobportal@gmail.com',
        password: 'websitejobportal123',
        specialization: 'General Medicine',
        license: 'ADMIN123456',
        phone: '+1234567890',
        role: 'doctor',
        status: 'active',
        createdAt: new Date().toISOString()
      };

      // Check if doctor already exists
      const existingDoctor = mockDoctors.find(doc => doc.email === adminDoctor.email);
      if (!existingDoctor) {
        mockDoctors.push(adminDoctor);
        localStorage.setItem('mockDoctors', JSON.stringify(mockDoctors));
        console.log("✅ Admin-created doctor added to mockDoctors");
      }
    }

    // Debug: Show all doctor emails and passwords for troubleshooting
    mockDoctors.forEach((doc, index) => {
      console.log(`🩺 Doctor ${index + 1}:`, {
        email: doc.email,
        emailLower: doc.email?.toLowerCase(),
        password: doc.password,
        name: doc.name,
        specialization: doc.specialization,
        id: doc.id,
        uid: doc.uid
      });
      console.log(`🔍 Comparing: "${doc.email?.toLowerCase()}" === "${email.toLowerCase()}" ?`, doc.email?.toLowerCase() === email.toLowerCase());
      console.log(`🔍 Password match: "${doc.password}" === "${password}" ?`, doc.password === password);
    });

    // If no mock doctors found, try to create some test data
    if (mockDoctors.length === 0) {
      console.log("⚠️ No mock doctors found, creating test data...");
      const testDoctors = [
        {
          id: 'TEST_DOC_1',
          uid: 'TEST_DOC_1',
          name: 'Dr. Test Doctor 1',
          email: 'doctor1758796374014@swasthyakink.com',
          password: 'Doc374014!',
          specialization: 'General Medicine',
          license: 'TEST123456',
          phone: '+1234567890',
          role: 'doctor',
          status: 'active',
          createdAt: new Date().toISOString()
        },
        {
          id: 'TEST_DOC_2',
          uid: 'TEST_DOC_2',
          name: 'Dr. Test Doctor 2',
          email: 'doctor1760371140428@swasthyalink.com',
          password: 'Doc140428!',
          specialization: 'Cardiology',
          license: 'TEST789012',
          phone: '+1234567891',
          role: 'doctor',
          status: 'active',
          createdAt: new Date().toISOString()
        }
      ];

      localStorage.setItem('mockDoctors', JSON.stringify(testDoctors));
      console.log("✅ Test doctors created in localStorage");

      // Re-check with the new data
      const newMockDoctors = JSON.parse(localStorage.getItem('mockDoctors') || '[]');
      console.log("🔍 New mock doctors after creation:", newMockDoctors);

      // Try to find the doctor again
      const newDoctorMatch = newMockDoctors.find(doc =>
        doc.email?.toLowerCase().trim() === email.toLowerCase().trim() &&
        doc.password?.trim() === password.trim()
      );

      if (newDoctorMatch) {
        console.log("✅ Doctor found after creating test data:", newDoctorMatch);
        // Process the login with the found doctor
        const doctorUser = {
          uid: newDoctorMatch.uid || newDoctorMatch.id || `doctor_${Date.now()}`,
          email: newDoctorMatch.email,
          displayName: newDoctorMatch.name,
          emailVerified: true,
          specialization: newDoctorMatch.specialization,
          license: newDoctorMatch.license,
          phone: newDoctorMatch.phone,
          role: 'doctor'
        };

        localStorage.setItem('testUser', JSON.stringify(doctorUser));
        localStorage.setItem('testUserRole', 'doctor');

        window.dispatchEvent(new StorageEvent('storage', {
          key: 'testUser',
          newValue: JSON.stringify(doctorUser)
        }));

        try {
          navigate("/doctordashboard");
          console.log("Navigation to doctor dashboard completed");
        } catch (error) {
          console.error("Navigation error:", error);
        }
        return;
      }
    }

    const doctorMatch = mockDoctors.find(doc =>
      doc.email?.toLowerCase().trim() === email.toLowerCase().trim() &&
      doc.password?.trim() === password.trim()
    );
    console.log("🔍 Doctor match result:", doctorMatch);

    if (doctorMatch) {
      console.log("✅ Doctor credentials found in admin-created doctors");
      console.log("Doctor match details:", doctorMatch);
      setLoading(false);

      // Create doctor user object for localStorage
      const doctorUser = {
        uid: doctorMatch.uid || doctorMatch.id || `doctor_${Date.now()}`,
        email: doctorMatch.email,
        displayName: doctorMatch.name,
        emailVerified: true,
        specialization: doctorMatch.specialization,
        license: doctorMatch.license,
        phone: doctorMatch.phone,
        role: 'doctor'
      };

      // Try Firebase Auth first, but don't fail if it doesn't work
      try {
        console.log("Attempting Firebase Auth sign-in...");
        const userCredential = await signInWithEmailAndPassword(auth, doctorMatch.email, doctorMatch.password);
        const user = userCredential.user;

        console.log("✅ Doctor signed in successfully with Firebase Auth:", user.uid);

        // Update doctor user with Firebase UID
        doctorUser.uid = user.uid;

      } catch (firebaseError) {
        console.log("Firebase Auth failed, using localStorage authentication:", firebaseError.message);

        // Try to create Firebase account if it doesn't exist
        if (firebaseError.code === 'auth/user-not-found' || firebaseError.code === 'auth/wrong-password') {
          try {
            console.log("Creating Firebase account for doctor...");
            await createTestUserAccount({
              email: doctorMatch.email,
              password: doctorMatch.password,
              role: "doctor",
              name: doctorMatch.name,
              specialization: doctorMatch.specialization,
              license: doctorMatch.license,
              phone: doctorMatch.phone,
              redirect: "/doctordashboard"
            });

            // Update doctor user with new Firebase UID
            const updatedDoctors = JSON.parse(localStorage.getItem('mockDoctors') || '[]');
            const doctorIndex = updatedDoctors.findIndex(doc => doc.id === doctorMatch.id);
            if (doctorIndex !== -1) {
              updatedDoctors[doctorIndex].uid = doctorUser.uid;
              localStorage.setItem('mockDoctors', JSON.stringify(updatedDoctors));
            }

          } catch (createError) {
            console.log("Firebase account creation failed, continuing with localStorage:", createError.message);
          }
        }
      }

      // Store user data and proceed with login
      localStorage.setItem('testUser', JSON.stringify(doctorUser));
      localStorage.setItem('testUserRole', 'doctor');

      // Force trigger storage event for same-tab detection
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'testUser',
        newValue: JSON.stringify(doctorUser)
      }));

      try {
        navigate("/doctordashboard");
        console.log("Navigation to doctor dashboard completed");
      } catch (error) {
        console.error("Navigation error:", error);
      }

      return;
    }

    // Preset doctor login check (temporary for testing)
    if (email === "doctor@gmail.com" && password === "doctor123") {
      console.log("Preset doctor credentials detected, redirecting to doctor dashboard");
      setLoading(false);
      // Simulate doctor user
      const mockDoctor = {
        uid: "mock-doctor-uid",
        email: "doctor@gmail.com",
        displayName: "Dr. Test Doctor",
        emailVerified: true
      };
      localStorage.setItem('testUser', JSON.stringify(mockDoctor));
      localStorage.setItem('testUserRole', 'doctor');

      // Force trigger storage event for same-tab detection
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'testUser',
        newValue: JSON.stringify(mockDoctor)
      }));

      try {
        navigate("/doctordashboard");
        console.log("Navigation to doctor dashboard completed");
      } catch (error) {
        console.error("Navigation error:", error);
      }
      return;
    }

    // Preset patient login check (temporary for testing)
    if (email === "patient@gmail.com" && password === "patient123") {
      console.log("Preset patient credentials detected, redirecting to patient dashboard");
      setLoading(false);
      // Simulate patient user
      const mockPatient = {
        uid: "mock-patient-uid",
        email: "patient@gmail.com",
        displayName: "Test Patient",
        emailVerified: true
      };
      localStorage.setItem('testUser', JSON.stringify(mockPatient));
      localStorage.setItem('testUserRole', 'patient');

      // Force trigger storage event for same-tab detection
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'testUser',
        newValue: JSON.stringify(mockPatient)
      }));

      try {
        navigate("/patientdashboard");
        console.log("Navigation to patient dashboard completed");
      } catch (error) {
        console.error("Navigation error:", error);
      }
      return;
    }

    console.log("Not preset credentials, proceeding with Firebase Auth");

    try {
      const response = await authService.login(email, password);
      if (response.success) {
        const user = response.user;

        // Check if user is a doctor - doctors don't need email verification
        const userDocRef = doc(db, "users", user.uid);
        const userDocSnap = await getDoc(userDocRef);
        const isDoctor = userDocSnap.exists() && userDocSnap.data().role === 'doctor';
        const isNurse = userDocSnap.exists() && userDocSnap.data().role === 'nurse';

        if (!user.emailVerified && !isDoctor && !isNurse) {
          setError(ERROR_MESSAGES.INVALID_EMAIL);
          setShowResend(true);
          setLoading(false);
          return;
        }
        if (userDocSnap.exists()) {
          const userData = userDocSnap.data();
          // Navigate based on user role
          if (userData.role === 'doctor') {
            navigate("/doctordashboard");
          } else if (userData.role === 'nurse') {
            navigate("/nursedashboard");
          } else if (userData.role === 'admin') {
            navigate("/admindashboard");
          } else {
            navigate("/patientdashboard");
          }
        } else {
          setError("User data not found. Please contact support.");
        }
      } else {
        setError(response.error || ERROR_MESSAGES.AUTHENTICATION_FAILED);
      }
    } catch (err) {
      console.error("Login error:", err);

      // Provide helpful error message for invalid credentials
      if (err.message && err.message.includes('auth/invalid-credential')) {
        setError("Invalid email or password. Please try the test credentials below or contact support.");
      } else {
        setError(err.message || ERROR_MESSAGES.AUTHENTICATION_FAILED);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setLoading(true);
    setError("");
    try {
      if (auth.currentUser) {
        await auth.currentUser.sendEmailVerification();
        setError("Verification email resent. Please check your inbox.");
        setShowResend(false);
      }
    } catch (err) {
      setError("Failed to resend verification email. Try again later.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!forgotPasswordEmail) {
      setForgotPasswordMessage("Please enter your email address.");
      return;
    }

    setLoading(true);
    setForgotPasswordMessage("");

    try {
      await sendPasswordResetEmail(auth, forgotPasswordEmail);
      setForgotPasswordMessage("Password reset email sent! Please check your inbox.");
      setForgotPasswordEmail("");
      setTimeout(() => {
        setShowForgotPassword(false);
        setForgotPasswordMessage("");
      }, 3000);
    } catch (err) {
      if (err.code === 'auth/user-not-found') {
        setForgotPasswordMessage("No account found with this email address.");
      } else if (err.code === 'auth/invalid-email') {
        setForgotPasswordMessage("Please enter a valid email address.");
      } else {
        setForgotPasswordMessage("Failed to send reset email. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 relative">
      {/* Back to Home Button */}
      <Link
        to="/"
        className="absolute top-6 left-6 flex items-center gap-2 text-indigo-600 hover:text-indigo-800 transition-colors duration-200"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
        </svg>
        <span className="font-medium">Back to Home</span>
      </Link>

      {/* Card container */}
      <div className="mx-auto max-w-6xl px-4 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100">
          {/* Left: Login form */}
          <section className="p-10 lg:p-12">
            <div className="mb-6 flex flex-col">
              <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">
                {showForgotPassword ? "Reset Password" : "Welcome Back"}
              </h2>
              <p className="text-gray-500 mt-1">
                {showForgotPassword
                  ? "Enter your email to reset your password"
                  : "Enter your email and password to access your account."}
              </p>
            </div>

            {message && (
              <div className="w-full mb-4 text-center p-2 bg-green-100 text-green-700 rounded-lg">
                {message}
              </div>
            )}

            {/* Google Sign-In */}
            {!showForgotPassword && (
              <button
                onClick={() => {
                  console.log("[DEBUG] Google sign-in button onClick fired");
                  handleGoogleSignIn();
                }}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-white border border-gray-300 text-gray-700 py-2 rounded-lg font-medium text-base shadow hover:bg-indigo-50 hover:text-indigo-700 transition-colors duration-200 mb-6"
              >
                <svg className="w-5 h-5" viewBox="0 0 48 48"><g><path fill="#4285F4" d="M24 9.5c3.54 0 6.7 1.22 9.19 3.61l6.85-6.85C35.64 2.7 30.23 0 24 0 14.82 0 6.73 5.82 2.69 14.09l7.98 6.2C12.36 13.6 17.74 9.5 24 9.5z" /><path fill="#34A853" d="M46.1 24.55c0-1.64-.15-3.22-.42-4.74H24v9.01h12.42c-.54 2.9-2.18 5.36-4.65 7.01l7.19 5.59C43.98 37.13 46.1 31.3 46.1 24.55z" /><path fill="#FBBC05" d="M10.67 28.29c-1.13-3.36-1.13-6.97 0-10.33l-7.98-6.2C.7 15.1 0 19.44 0 24c0 4.56.7 8.9 2.69 12.24l7.98-6.2z" /><path fill="#EA4335" d="M24 48c6.23 0 11.64-2.06 15.52-5.6l-7.19-5.59c-2.01 1.35-4.59 2.15-8.33 2.15-6.26 0-11.64-4.1-13.33-9.64l-7.98 6.2C6.73 42.18 14.82 48 24 48z" /><path fill="none" d="M0 0h48v48H0z" /></g></svg>
                {loading ? "Signing in..." : "Sign in with Google"}
              </button>
            )}

            {error && <div className="text-red-500 text-sm mb-2">{error}</div>}

            {/* Debug credentials UI removed for production */}

            {showForgotPassword ? (
              // Forgot Password Form
              <form className="w-full flex flex-col gap-4" onSubmit={handleForgotPassword}>
                {forgotPasswordMessage && (
                  <div className={`text-sm mb-2 p-2 rounded-lg ${forgotPasswordMessage.includes("sent")
                    ? "bg-green-100 text-green-700"
                    : "bg-red-100 text-red-700"
                    }`}>
                    {forgotPasswordMessage}
                  </div>
                )}
                <div>
                  <input
                    type="email"
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    placeholder="Enter your email address"
                    required
                    value={forgotPasswordEmail}
                    onChange={e => setForgotPasswordEmail(e.target.value)}
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-indigo-600 text-white py-2 rounded-lg font-semibold text-lg shadow hover:bg-indigo-700 transition-colors duration-200 mt-2"
                  disabled={loading}
                >
                  {loading ? "Sending..." : "Send Reset Email"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(false)}
                  className="w-full bg-gray-100 text-gray-700 py-2 rounded-lg font-medium shadow hover:bg-gray-200 transition-colors duration-200"
                >
                  Back to Login
                </button>
              </form>
            ) : (
              // Login Form
              <form className="w-full flex flex-col gap-4" onSubmit={handleSubmit}>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    placeholder="e.g. user@health.com"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                  />
                  {/* Show password hint for current email */}
                  {(() => {
                    const mockDoctors = JSON.parse(localStorage.getItem('mockDoctors') || '[]');
                    const currentDoctor = mockDoctors.find(doc => doc.email === email.toLowerCase());
                    if (currentDoctor && email) {
                      return (
                        <div className="text-xs text-green-600 mt-1 bg-green-50 p-2 rounded">
                          💡 Password hint: {currentDoctor.password}
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 pr-10"
                      placeholder="Enter your password"
                      required
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-2 text-gray-500 hover:text-indigo-600 focus:outline-none"
                      onClick={() => setShowPassword((v) => !v)}
                      tabIndex={-1}
                    >
                      {showPassword ? (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12.01c1.636 4.01 5.735 6.99 10.066 6.99 2.042 0 3.97-.488 5.627-1.354M21.12 15.804A10.477 10.477 0 0022.066 12c-1.636-4.01-5.735-6.99-10.066-6.99-1.13 0-2.22.148-3.25.425M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0zm6.32 4.906A10.477 10.477 0 0022.066 12c-1.636-4.01-5.735-6.99-10.066-6.99-2.042 0-3.97-.488-5.627-1.354M3.98 8.223A10.477 10.477 0 001.934 12.01c1.636 4.01 5.735 6.99 10.066 6.99 2.042 0 3.97-.488 5.627-1.354M3.98 8.223l16.34 9.557" />
                        </svg>
                      )}
                    </button>
                  </div>
                  <div className="text-right mt-1">
                    <button
                      type="button"
                      onClick={() => setShowForgotPassword(true)}
                      className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
                    >
                      Forgot Password?
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  className="w-full bg-indigo-600 text-white py-2 rounded-lg font-semibold text-base shadow hover:bg-indigo-700 transition-colors duration-200 mt-2"
                  disabled={loading}
                >
                  {loading ? "Logging in..." : "Log In"}
                </button>
              </form>
            )}

            {showResend && (
              <button
                onClick={handleResendVerification}
                className="w-full bg-yellow-400 text-indigo-800 py-2 rounded-lg font-semibold text-base shadow hover:bg-yellow-500 transition-colors duration-200 mt-2 mb-2"
                disabled={loading}
              >
                {loading ? "Resending..." : "Resend Verification Email"}
              </button>
            )}

            {/* Quick Demo Access */}
            {!showForgotPassword && (
              <div className="mt-8 pt-8 border-t border-gray-100">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Quick Demo Access</p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => handleDemoLogin('admin@gmail.com', 'admin123')}
                    className="flex items-center gap-2 px-3 py-2 bg-slate-50 text-slate-600 rounded-lg hover:bg-slate-100 transition-colors text-sm border border-slate-200"
                  >
                    <span className="material-icons text-base">admin_panel_settings</span> Admin
                  </button>
                  <button
                    onClick={() => handleDemoLogin('doctor@swasthyakink.com', 'doctor123')}
                    className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors text-sm border border-blue-200"
                  >
                    <span className="material-icons text-base">medical_services</span> Doctor
                  </button>
                  <button
                    onClick={() => handleDemoLogin('nurse@swasthyalink.com', 'nurse123')}
                    className="flex items-center gap-2 px-3 py-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors text-sm border border-emerald-200"
                  >
                    <span className="material-icons text-base">person</span> Nurse
                  </button>
                  <button
                    onClick={() => handleDemoLogin('test@swasthyakink.com', 'test123')}
                    className="flex items-center gap-2 px-3 py-2 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 transition-colors text-sm border border-purple-200"
                  >
                    <span className="material-icons text-base">person</span> Patient
                  </button>
                </div>
              </div>
            )}

            {!showForgotPassword && (
              <div className="mt-6 text-sm text-gray-600">
                Don't have an account?{' '}
                <Link to="/register" className="text-indigo-600 hover:text-yellow-500 font-semibold">Register Now.</Link>
              </div>
            )}
          </section>

          {/* Right: Health promo panel */}
          <aside className="relative bg-gradient-to-br from-indigo-600 to-blue-600 p-10 lg:p-12 text-white">
            <div className="max-w-md">
              <h3 className="text-2xl font-bold leading-tight">Effortlessly manage your health and family care.</h3>
              <p className="mt-3 text-indigo-100">Log in to access your dashboard, track health records, and coordinate care with your family and doctors.</p>
            </div>

            {/* Mock analytics card */}
            <div className="mt-10 grid gap-4">
              <div className="bg-white/10 backdrop-blur rounded-xl p-4 shadow-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-indigo-100 text-sm">Weekly Steps</p>
                    <p className="text-2xl font-semibold">52,840</p>
                  </div>
                  <div className="w-16 h-16 rounded-full bg-white/20 grid place-items-center">
                    <span className="material-icons">fitness_center</span>
                  </div>
                </div>
                <div className="mt-3 h-2 bg-white/20 rounded-full overflow-hidden">
                  <div className="h-full w-3/4 bg-green-300 rounded-full" />
                </div>
              </div>

              <div className="bg-white rounded-xl p-4 text-indigo-900 shadow-xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-indigo-100 grid place-items-center">💖</div>
                  <div>
                    <p className="text-sm text-indigo-500">Heart Rate</p>
                    <p className="font-semibold">72 bpm • Resting</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Decorative blot */}
            <div className="pointer-events-none absolute -bottom-10 -right-10 w-56 h-56 bg-white/10 rounded-full blur-3xl" />
          </aside>
        </div>
      </div>


    </main>
  );
};

export default Login; 