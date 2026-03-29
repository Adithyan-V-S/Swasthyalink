import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../firebaseConfig";
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc, setDoc } from "firebase/firestore";
import { useAuth } from "../contexts/AuthContext";
import { signInAnonymously, onAuthStateChanged, createUserWithEmailAndPassword } from "firebase/auth";

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState("overview");
  const [doctors, setDoctors] = useState([]);
  const [staff, setStaff] = useState([]);
  const [pharmacy, setPharmacy] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    specialization: "",
    license: "",
    phone: "",
    department: "" // Added for nurse
  });
  const [editingItem, setEditingItem] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [branchInfo, setBranchInfo] = useState({ name: "Loading Branch...", id: null });
  const [presetAdmin, setPresetAdmin] = useState(localStorage.getItem('presetAdmin') === 'true');
  const [storageMode, setStorageMode] = useState('checking'); // 'firestore', 'localStorage', 'checking'
  const [patients, setPatients] = useState([]);
  const [analytics, setAnalytics] = useState({
    totalPatients: 0,
    totalDoctors: 0,
    totalRevenue: 0,
    appointments: 0,
    growthRate: 0,
    patientGrowth: 0,
    revenueGrowth: 0
  });
  const navigate = useNavigate();
  const { logout, setPresetAdmin: setAuthPresetAdmin } = useAuth();

  // Calculate analytics based on real data
  const calculateAnalytics = () => {
    // Filter data by current branch
    const branchDoctors = doctors.filter(d =>
      !branchInfo.id ||
      d.branchId === branchInfo.id ||
      !d.branchId || // Show unassigned doctors too for now
      d.id.startsWith('DOC_SAMPLE')
    );
    const branchPatients = patients.filter(p =>
      !branchInfo.id ||
      p.branchId === branchInfo.id ||
      !p.branchId || // Show unassigned patients too
      p.id.startsWith('PAT_')
    );

    const totalDoctors = branchDoctors.length;
    const totalPatients = branchPatients.length;

    // Generate some realistic analytics based on actual data
    const totalRevenue = totalPatients * 150 + totalDoctors * 500; // Estimated revenue
    const appointments = Math.floor(totalPatients * 0.3); // 30% of patients have appointments today

    // Calculate growth rates
    const patientGrowth = totalPatients > 0 ? 12 : 0;
    const revenueGrowth = totalRevenue > 0 ? 8 : 0;

    setAnalytics({
      totalPatients,
      totalDoctors,
      totalRevenue,
      appointments,
      growthRate: 12.5,
      patientGrowth,
      revenueGrowth
    });
  };

  // Initialize sample patient data if not exists
  const initializeSampleData = () => {
    if (!localStorage.getItem('mockPatients')) {
      const samplePatients = [
        {
          id: 'PAT_001',
          uid: 'PAT_001',
          name: 'John Doe',
          email: 'john.doe@example.com',
          phone: '9876543210',
          age: 35,
          role: 'patient',
          status: 'active',
          createdAt: new Date().toISOString()
        },
        {
          id: 'PAT_002',
          uid: 'PAT_002',
          name: 'Jane Smith',
          email: 'jane.smith@example.com',
          phone: '9876543211',
          age: 28,
          role: 'patient',
          status: 'active',
          createdAt: new Date().toISOString()
        },
        {
          id: 'PAT_003',
          uid: 'PAT_003',
          name: 'Robert Johnson',
          email: 'robert.johnson@example.com',
          phone: '9876543212',
          age: 42,
          role: 'patient',
          status: 'active',
          createdAt: new Date().toISOString()
        },
        {
          id: 'PAT_004',
          uid: 'PAT_004',
          name: 'Emily Davis',
          email: 'emily.davis@example.com',
          phone: '9876543213',
          age: 31,
          role: 'patient',
          status: 'active',
          createdAt: new Date().toISOString()
        },
        {
          id: 'PAT_005',
          uid: 'PAT_005',
          name: 'Michael Wilson',
          email: 'michael.wilson@example.com',
          phone: '9876543214',
          age: 39,
          role: 'patient',
          status: 'active',
          createdAt: new Date().toISOString()
        }
      ];
      localStorage.setItem('mockPatients', JSON.stringify(samplePatients));
      console.log('Sample patient data initialized');
    }
  };

  useEffect(() => {
    // Calculate analytics whenever doctors, patients, or branch info changes
    calculateAnalytics();
  }, [doctors, patients, branchInfo]);

  useEffect(() => {
    const presetAdmin = localStorage.getItem('presetAdmin') === 'true';

    if (presetAdmin) {
      console.log("Preset admin detected, setting up admin session");

      // Initialize sample data if not exists
      initializeSampleData();

      if (!localStorage.getItem('mockDoctors')) {
        const sampleDoctors = [
          {
            id: 'DOC_SAMPLE_001',
            uid: 'DOC_SAMPLE_001',
            name: 'Dr. Sarah Johnson',
            email: 'sarah.johnson@swasthyalink.com',
            password: 'Doc123456!',
            specialization: 'Cardiology',
            license: 'MD12345',
            phone: '9876543210',
            role: 'doctor',
            status: 'active',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          },
          {
            id: 'DOC_SAMPLE_002',
            uid: 'DOC_SAMPLE_002',
            name: 'Dr. Michael Chen',
            email: 'michael.chen@swasthyalink.com',
            password: 'Doc789012!',
            specialization: 'Pediatrics',
            license: 'MD67890',
            phone: '9876543211',
            role: 'doctor',
            status: 'active',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        ];
        localStorage.setItem('mockDoctors', JSON.stringify(sampleDoctors));
        localStorage.setItem('mockStaff', JSON.stringify([]));
        localStorage.setItem('mockPharmacy', JSON.stringify([]));
        console.log('Sample data initialized for preset admin');
      }

      // Sign in anonymously for preset admin
      signInAnonymously(auth)
        .then((userCredential) => {
          console.log("Anonymous sign-in successful:", userCredential.user.uid);
          const mockUser = {
            uid: userCredential.user.uid,
            email: "admin@gmail.com",
            isAnonymous: true
          };
          setCurrentUser(mockUser);
          setLoading(false);
          fetchBranchInfo(mockUser);
          fetchData(mockUser);
        })
        .catch((error) => {
          console.error("Anonymous sign-in failed:", error);
          setLoading(false);
        });
      return;
    }

    // Regular Firebase auth check
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userDocSnapshot = await getDocs(collection(db, "users"));
        const userDoc = userDocSnapshot.docs.find(doc => doc.data().uid === user.uid);
        if (userDoc && userDoc.data().role === "admin") {
          const userData = { ...user, ...userDoc.data() };
          setCurrentUser(userData);
          fetchBranchInfo(userData);
          fetchData(userData);
        } else {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const fetchBranchInfo = async (user) => {
    try {
      console.log("🔍 Resolving branch identity for user:", user?.email);
      let targetBranchId = user?.branchId;

      const branchesSnapshot = await getDocs(collection(db, "hospital_branches"));
      const allBranches = branchesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      if (allBranches.length > 0) {
        // If user has a branchId, use it. Otherwise, use the first one for testing/demo.
        const activeBranch = allBranches.find(b => b.id === targetBranchId) || allBranches[0];
        setBranchInfo({ name: activeBranch.name, id: activeBranch.id, ...activeBranch });
        console.log("✅ Branch linked:", activeBranch.name, "(", activeBranch.id, ")");
      } else {
        setBranchInfo({ name: "No Active Branch", id: null });
      }
    } catch (error) {
      console.error("Error fetching branch info:", error);
      setBranchInfo({ name: "Kottayam Branch (Offline)", id: "kottayam-001" });
    }
  };

  const fetchData = async (user = currentUser) => {
    try {
      setLoading(true);

      const isPresetAdmin = localStorage.getItem('presetAdmin') === 'true';

      if (auth.currentUser) {
        // Fetch from Firestore if authenticated
        console.log("Fetching data from Firestore...");

        // Fetch doctors (filter by branch and exclude disabled)
        const doctorsSnapshot = await getDocs(collection(db, "users"));
        const currentBranchId = branchInfo?.id;
        const doctorsData = doctorsSnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(u => u.role === "doctor" && !u.isDisabled && (u.branchId === currentBranchId || !currentBranchId));

        console.log(`Fetched doctors for branch ${currentBranchId}:`, doctorsData);
        setDoctors(doctorsData);

        // Fetch patients (filter out disabled ones)
        const patientsSnapshot = await getDocs(collection(db, "users"));
        const patientsData = patientsSnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(user => user.role === "patient" && !user.isDisabled);

        console.log("Fetched patients from Firestore:", patientsData);
        setPatients(patientsData);

        // Fetch staff (e.g. Nurses) and filter by branch
        const staffSnapshot = await getDocs(collection(db, "staff"));
        const staffData = staffSnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(s => s.branchId === currentBranchId || !currentBranchId);
        setStaff(staffData);

        // Fetch pharmacy staff and filter by branch
        const pharmacySnapshot = await getDocs(collection(db, "users"));
        const pharmacyData = pharmacySnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(u => u.role === "pharmacy" && !u.isDisabled && (u.branchId === currentBranchId || !currentBranchId));
        console.log(`Fetched pharmacy staff for branch ${currentBranchId}:`, pharmacyData);
        setPharmacy(pharmacyData);

        // Fetch all legitimate users (Patients global, Staff branch-specific, exclude admins)
        const usersSnapshot = await getDocs(collection(db, "users"));
        const usersData = usersSnapshot.docs
          .map(doc => ({
            id: doc.id,
            ...doc.data(),
            authMethod: doc.data().uid ? 'Google' : 'Email',
            createdAt: doc.data().createdAt || 'Unknown'
          }))
          .filter(u => {
            if (u.isDisabled) return false;
            if (u.role === "hospital_admin" || u.role === "admin") return false;
            
            // Patients are global
            if (u.role === "patient") return true;

            // Health staff (doctors/pharmacy) must match the branch
            const isStaff = u.role === "doctor" || u.role === "pharmacy" || u.role === "nurse";
            if (isStaff) {
              return u.branchId === currentBranchId || !currentBranchId;
            }

            return true; // Other roles are global by default
          });
        console.log(`Scoped users list for branch ${currentBranchId}:`, usersData);
        setUsers(usersData);

        setStorageMode('firestore');

      } else if (isPresetAdmin) {
        // Load from localStorage for preset admin
        console.log("Loading data from local storage (preset admin)...");

        const mockDoctors = JSON.parse(localStorage.getItem('mockDoctors') || '[]');
        const mockStaff = JSON.parse(localStorage.getItem('mockStaff') || '[]');
        const mockPharmacy = JSON.parse(localStorage.getItem('mockPharmacy') || '[]');
        const mockPatients = JSON.parse(localStorage.getItem('mockPatients') || '[]');

        // Combine all users for user management view
        const allUsers = [
          ...mockDoctors.map(d => ({ ...d, role: 'doctor', authMethod: 'Local', createdAt: 'Demo' })),
          ...mockPatients.map(p => ({ ...p, role: 'patient', authMethod: 'Local', createdAt: 'Demo' })),
          ...mockStaff.map(s => ({ ...s, role: 'staff', authMethod: 'Local', createdAt: 'Demo' }))
        ];

        console.log("Loaded mock doctors:", mockDoctors);
        console.log("Loaded mock patients:", mockPatients);
        console.log("Combined users for management:", allUsers);
        setDoctors(mockDoctors);
        setStaff(mockStaff);
        setPharmacy(mockPharmacy);
        setPatients(mockPatients);
        setUsers(allUsers);

        setStorageMode('localStorage');
      } else {
        console.log("No authentication found");
        setDoctors([]);
        setStaff([]);
        setPharmacy([]);
        setPatients([]);
        setStorageMode('none');
      }
    } catch (error) {
      console.error("Error fetching data:", error);

      // Fallback to localStorage if Firestore fails
      const isPresetAdmin = localStorage.getItem('presetAdmin') === 'true';
      if (isPresetAdmin) {
        console.log("Firestore failed, falling back to local storage...");
        const mockDoctors = JSON.parse(localStorage.getItem('mockDoctors') || '[]');
        const mockStaff = JSON.parse(localStorage.getItem('mockStaff') || '[]');
        const mockPharmacy = JSON.parse(localStorage.getItem('mockPharmacy') || '[]');
        const mockPatients = JSON.parse(localStorage.getItem('mockPatients') || '[]');

        // Combine all users for user management view
        const allUsers = [
          ...mockDoctors.map(d => ({ ...d, role: 'doctor', authMethod: 'Local', createdAt: 'Demo' })),
          ...mockPatients.map(p => ({ ...p, role: 'patient', authMethod: 'Local', createdAt: 'Demo' })),
          ...mockStaff.map(s => ({ ...s, role: 'staff', authMethod: 'Local', createdAt: 'Demo' }))
        ];

        setDoctors(mockDoctors);
        setStaff(mockStaff);
        setPharmacy(mockPharmacy);
        setPatients(mockPatients);
        setUsers(allUsers);
        setStorageMode('localStorage');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      console.log("Logout initiated");
      // Clear preset admin flag
      setAuthPresetAdmin(false);
      await logout();
      console.log("Sign out completed");
      navigate("/login");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  // Generate auto credentials
  const generateCredentials = () => {
    const timestamp = Date.now();
    const randomNum = Math.floor(Math.random() * 1000);
    const prefix = activeTab === "staff" ? "NURSE" : "DOC";
    const passPrefix = activeTab === "staff" ? "Nurse" : "Doc";

    const id = `${prefix}_${timestamp}_${randomNum}`;
    const autoEmail = `${activeTab === "staff" ? "nurse" : "doctor"}${timestamp}@swasthyalink.com`;
    const autoPassword = `${passPrefix}${timestamp.toString().slice(-6)}!`;

    console.log("🔧 Generated credentials:", { id, autoEmail, autoPassword });

    setFormData({
      ...formData,
      email: autoEmail,
      password: autoPassword
    });

    return { id, autoEmail, autoPassword };
  };

  const handleAddDoctor = async (e) => {
    e.preventDefault();

    if (!formData.name || !formData.specialization || !formData.license || !formData.phone) {
      alert('Please fill in all required fields');
      return;
    }

    // Check if user is authenticated or using preset admin
    const isPresetAdmin = localStorage.getItem('presetAdmin') === 'true';
    if (!auth.currentUser && !isPresetAdmin) {
      alert("User not authenticated");
      return;
    }

    // Generate credentials if not provided
    let doctorId, email, password;
    if (!formData.email || !formData.password) {
      const credentials = generateCredentials();
      doctorId = credentials.doctorId;
      email = credentials.autoEmail;
      password = credentials.autoPassword;

      console.log("🔧 Using generated credentials:", {
        doctorId,
        email,
        password,
        originalCredentials: credentials
      });
    } else {
      doctorId = `DOC_${Date.now()}`;
      email = formData.email.trim().toLowerCase();
      password = formData.password;

      console.log("🔧 Using manual credentials:", {
        doctorId,
        email,
        password
      });
    }

    const newDoctor = {
      id: doctorId,
      uid: doctorId,
      name: formData.name.trim(),
      email: email,
      password: password, // In production, this should be hashed
      // Demo-only: store generated password for display/copy in admin UI
      generatedPassword: password,
      specialization: formData.specialization.trim(),
      license: formData.license.trim(),
      phone: formData.phone.trim(),
      branchId: branchInfo.id,
      companyId: "abc-hospital-group", // Linked to the group
      role: "doctor",
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    try {
      setLoading(true);

      console.log('Adding doctor:', newDoctor);

      // Always store in localStorage first for immediate availability
      const existingDoctors = JSON.parse(localStorage.getItem('mockDoctors') || '[]');
      existingDoctors.push(newDoctor);
      localStorage.setItem('mockDoctors', JSON.stringify(existingDoctors));
      window.dispatchEvent(new CustomEvent('mockDoctorsUpdated'));
      console.log('✅ Doctor added to localStorage');

      // Try to create Firebase Auth account for the doctor (optional)
      try {
        console.log('Creating Firebase Auth account for doctor:', email);
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const firebaseUser = userCredential.user;

        console.log('✅ Firebase Auth user created:', firebaseUser.uid);

        // Update the doctor object with Firebase UID
        newDoctor.uid = firebaseUser.uid;
        newDoctor.firebaseUid = firebaseUser.uid;

        // Update localStorage with Firebase UID
        const updatedDoctors = JSON.parse(localStorage.getItem('mockDoctors') || '[]');
        const doctorIndex = updatedDoctors.findIndex(doc => doc.id === newDoctor.id);
        if (doctorIndex !== -1) {
          updatedDoctors[doctorIndex] = newDoctor;
          localStorage.setItem('mockDoctors', JSON.stringify(updatedDoctors));
        }

        // Create user document in Firestore
        const userData = {
          uid: firebaseUser.uid,
          name: newDoctor.name,
          email: newDoctor.email,
          role: 'doctor',
          branchId: branchInfo.id,
          companyId: "abc-hospital-group",
          // Demo-only: persist generated password so admin can copy it later
          generatedPassword: password,
          specialization: newDoctor.specialization,
          license: newDoctor.license,
          phone: newDoctor.phone,
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          emailVerified: true
        };

        const docRef = doc(db, "users", firebaseUser.uid);
        await setDoc(docRef, userData);
        console.log('✅ Doctor document created in Firestore');

        console.log('✅ Doctor added successfully to both Firebase and localStorage');

      } catch (firebaseError) {
        console.error('Firebase error:', firebaseError);

        if (firebaseError.code === 'auth/email-already-in-use') {
          console.log('Doctor email already exists in Firebase, continuing with localStorage only');
        } else {
          console.log('Firebase account creation failed, but doctor is available in localStorage');
        }
        // Don't throw error - doctor is still available in localStorage
      }

      alert(`Doctor added successfully!\n\nDoctor ID: ${doctorId}\nEmail: ${email}\nPassword: ${password}\nName: ${formData.name}`);

      // Reset form
      setFormData({
        name: "",
        email: "",
        password: "",
        specialization: "",
        license: "",
        phone: ""
      });
      setShowAddForm(false);
      setIsEditing(false);
      setEditingItem(null);

      // Refresh the doctors list
      await fetchData();

    } catch (error) {
      console.error("Error adding doctor:", error);

      // Provide helpful error message
      let errorMessage = "Error adding doctor: ";
      if (error.message.includes('Missing or insufficient permissions')) {
        errorMessage += "Database permissions error. Using local storage for demo purposes.";

        // Fallback to localStorage
        const isPresetAdmin = localStorage.getItem('presetAdmin') === 'true';
        if (isPresetAdmin) {
          try {
            const existingDoctors = JSON.parse(localStorage.getItem('mockDoctors') || '[]');
            existingDoctors.push(newDoctor);
            localStorage.setItem('mockDoctors', JSON.stringify(existingDoctors));

            alert(`Doctor added successfully (local storage)!\n\nDoctor ID: ${doctorId}\nEmail: ${email}\nPassword: ${password}\nName: ${formData.name}`);

            // Reset form and refresh
            setFormData({
              name: "",
              email: "",
              password: "",
              specialization: "",
              license: "",
              phone: ""
            });
            setShowAddForm(false);
            setIsEditing(false);
            setEditingItem(null);
            await fetchData();
            return;
          } catch (localError) {
            errorMessage += ` Local storage fallback also failed: ${localError.message}`;
          }
        }
      } else {
        errorMessage += error.message;
      }

      alert(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleEditDoctor = (doctor) => {
    setEditingItem(doctor);
    setIsEditing(true);
    setFormData({
      name: doctor.name,
      email: doctor.email,
      password: doctor.password || "",
      specialization: doctor.specialization,
      license: doctor.license,
      phone: doctor.phone
    });
    setShowAddForm(true);
  };

  const handleUpdateDoctor = async (e) => {
    e.preventDefault();

    if (!formData.name || !formData.email || !formData.specialization || !formData.license || !formData.phone) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      setLoading(true);

      const updatedDoctor = {
        ...editingItem,
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        password: formData.password || editingItem.password,
        specialization: formData.specialization.trim(),
        license: formData.license.trim(),
        phone: formData.phone.trim(),
        updatedAt: new Date().toISOString()
      };

      const isPresetAdmin = localStorage.getItem('presetAdmin') === 'true';

      if (auth.currentUser) {
        // Update in Firestore
        const docRef = doc(db, "users", editingItem.id);
        await updateDoc(docRef, updatedDoctor);
        console.log('Doctor updated successfully in Firestore');
      } else if (isPresetAdmin) {
        // Update in localStorage
        const mockDoctors = JSON.parse(localStorage.getItem('mockDoctors') || '[]');
        const doctorIndex = mockDoctors.findIndex(doc => doc.id === editingItem.id);
        if (doctorIndex !== -1) {
          mockDoctors[doctorIndex] = updatedDoctor;
          localStorage.setItem('mockDoctors', JSON.stringify(mockDoctors));
          console.log('Doctor updated successfully in local storage');
        }
      }

      alert(`Doctor updated successfully!\n\nName: ${formData.name}`);

      // Reset form
      setFormData({
        name: "",
        email: "",
        password: "",
        specialization: "",
        license: "",
        phone: ""
      });
      setShowAddForm(false);
      setIsEditing(false);
      setEditingItem(null);

      // Refresh the doctors list
      await fetchData();

    } catch (error) {
      console.error("Error updating doctor:", error);
      alert(`Error updating doctor: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text, type = 'text') => {
    try {
      await navigator.clipboard.writeText(text);
      // Show a brief success message
      const message = type === 'email' ? 'Email copied!' :
        type === 'password' ? 'Password copied!' :
          type === 'credentials' ? 'Credentials copied!' : 'Copied!';

      // Create a temporary toast notification
      const toast = document.createElement('div');
      toast.className = 'fixed top-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 transition-opacity';
      toast.textContent = message;
      document.body.appendChild(toast);

      setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => document.body.removeChild(toast), 300);
      }, 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
  };

  const handleDeleteDoctor = async (doctorId) => {
    if (window.confirm("Are you sure you want to disable this doctor? This will hide them from the system but preserve all data for security purposes.")) {
      try {
        const isPresetAdmin = localStorage.getItem('presetAdmin') === 'true';

        if (auth.currentUser) {
          // Disable doctor instead of deleting (soft delete - preserves data)
          await updateDoc(doc(db, "users", doctorId), {
            isDisabled: true,
            disabledAt: new Date().toISOString(),
            disabledBy: auth.currentUser.uid
          });
          console.log('Doctor disabled successfully from Firestore (data preserved)');
        } else if (isPresetAdmin) {
          // Delete from localStorage
          const mockDoctors = JSON.parse(localStorage.getItem('mockDoctors') || '[]');
          const filteredDoctors = mockDoctors.filter(doc => doc.id !== doctorId);
          localStorage.setItem('mockDoctors', JSON.stringify(filteredDoctors));
          console.log('Doctor deleted successfully from local storage');
        }

        fetchData();
        alert("Doctor deleted successfully!");
      } catch (error) {
        console.error("Error deleting doctor:", error);
        alert(`Error deleting doctor: ${error.message}`);
      }
    }
  };

  const handleAddStaff = async (e) => {
    e.preventDefault();
    try {
      const newStaff = {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        role: formData.specialization, // Using specialization field for staff role
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, "staff"), newStaff);
      setFormData({
        name: "",
        email: "",
        password: "",
        specialization: "",
        license: "",
        phone: ""
      });
      setShowAddForm(false);
      fetchData();
    } catch (error) {
      console.error("Error adding staff:", error);
    }
  };

  const handleAddNurse = async (e) => {
    e.preventDefault();

    if (!formData.name || !formData.email || !formData.phone || !formData.password) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      setLoading(true);
      const email = formData.email.trim().toLowerCase();
      const password = formData.password;

      // Create Firebase Auth account
      console.log('🚀 Attempting to create nurse account in Firebase Auth:', { email, passwordLength: password.length });
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;

      const nurseData = {
        uid: firebaseUser.uid,
        name: formData.name.trim(),
        email: email,
        role: 'nurse',
        branchId: branchInfo.id,
        companyId: 'abc-hospital-group',
        department: formData.department || 'General',
        phone: formData.phone.trim(),
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        emailVerified: true
      };

      await setDoc(doc(db, "users", firebaseUser.uid), nurseData);

      // Also add to staff collection if needed by current logic
      await addDoc(collection(db, "staff"), {
        ...nurseData,
        nurseId: firebaseUser.uid
      });

      alert(`Nurse added successfully!\nEmail: ${email}`);

      setFormData({
        name: "",
        email: "",
        password: "",
        specialization: "",
        license: "",
        phone: "",
        department: ""
      });
      setShowAddForm(false);
      fetchData();
    } finally {
      setLoading(false);
    }
  };

  const handleAddPharmacist = async (e) => {
    e.preventDefault();

    if (!formData.name || !formData.email || !formData.phone || !formData.password) {
      alert('Please fill in all required fields');
      return;
    }

    if (storageMode === 'localStorage') {
      const mockPharmacy = JSON.parse(localStorage.getItem('mockPharmacy') || '[]');
      const newPharmacist = {
        id: `PHARM_MOCK_${Date.now()}`,
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        role: 'pharmacy',
        branchId: branchInfo.id,
        phone: formData.phone.trim(),
        status: 'active',
        createdAt: new Date().toISOString()
      };
      mockPharmacy.push(newPharmacist);
      localStorage.setItem('mockPharmacy', JSON.stringify(mockPharmacy));
      alert(`Pharmacy Staff added successfully (Demo Mode)!`);
      resetForm();
      setShowAddForm(false);
      fetchData();
      return;
    }

    try {
      setLoading(true);
      const email = formData.email.trim().toLowerCase();
      const password = formData.password;

      console.log('🚀 Creating pharmacy staff account:', { email });

      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;

      const pharmacistData = {
        uid: firebaseUser.uid,
        name: formData.name.trim(),
        email: email,
        role: 'pharmacy',
        branchId: branchInfo.id,
        companyId: 'abc-hospital-group',
        phone: formData.phone.trim(),
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        emailVerified: true
      };

      await setDoc(doc(db, "users", firebaseUser.uid), pharmacistData);

      alert(`Pharmacy Staff added successfully!\nEmail: ${email}`);

      resetForm();
      setShowAddForm(false);
      fetchData();
    } catch (error) {
      console.error("Error adding pharmacist:", error);
      alert(`Error adding pharmacy staff: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleEditStaff = (member) => {
    setEditingItem(member);
    setIsEditing(true);
    setFormData({
      name: member.name || "",
      email: member.email || "",
      password: member.password || member.generatedPassword || "",
      specialization: member.role || "",
      license: member.license || "",
      phone: member.phone || "",
      department: member.department || ""
    });
    setShowAddForm(true);
    // Don't change activeTab here, stay where we are (staff or pharmacy tab)
  };

  const handleUpdateNurse = async (e) => {
    e.preventDefault();
    if (!editingItem) return;

    const currentRole = (editingItem.role || '').toLowerCase().trim();
    const roleLabel = currentRole === 'pharmacy' ? 'Pharmacist' : 'Nurse Staff';

    try {
      setLoading(true);
      const updateData = {
        name: formData.name.trim(),
        department: formData.department || 'General',
        phone: formData.phone.trim(),
        updatedAt: new Date().toISOString()
      };

      if (storageMode === 'firestore') {
        const userUid = editingItem.uid || editingItem.nurseId;
        console.log(`Updating ${currentRole} in Firestore. User UID:`, userUid, "Staff ID:", editingItem.id);

        let userDocRef = null;
        if (userUid) {
          userDocRef = doc(db, "users", userUid);
        } else {
          // Fallback: Try to find user by email if UID is missing
          console.warn(`${roleLabel} UID missing, searching users collection by email...`);
          const usersRef = collection(db, "users");
          const q = query(usersRef, where("email", "==", editingItem.email));
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) {
            userDocRef = doc(db, "users", querySnapshot.docs[0].id);
            console.log("Found user by email. New doc ID:", querySnapshot.docs[0].id);
          }
        }

        if (userDocRef) {
          try {
            await updateDoc(userDocRef, updateData);
            console.log("Successfully updated users collection");
          } catch (err) {
            console.error("Failed to update users collection:", err);
            // Don't throw yet, try to update staff record
          }
        }

        // Only update the staff document if this is a nurse/general staff, 
        // not a pharmacist (pharmacists only exist in 'users' collection)
        if (currentRole !== 'pharmacy') {
          await updateDoc(doc(db, "staff", editingItem.id), updateData);
          console.log("Successfully updated staff collection");
        } else {
          console.log("Skipping staff collection update for pharmacist role");
        }
      } else {
        const role = currentRole;
        const storageKey = role === 'pharmacy' ? 'mockPharmacy' : 'mockStaff';
        const mockData = JSON.parse(localStorage.getItem(storageKey) || '[]');
        const updatedData = mockData.map(item => (item.id === editingItem.id) ? { ...item, ...updateData } : item);
        localStorage.setItem(storageKey, JSON.stringify(updatedData));
      }

      alert(`✨ ${roleLabel} updated successfully!`);
      setShowAddForm(false);
      setIsEditing(false);
      setEditingItem(null);
      resetForm();
      fetchData();
    } catch (error) {
      console.error(`Error updating ${editingItem.role}:`, error);
      alert(`Error updating ${editingItem.role}: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      email: "",
      password: "",
      specialization: "",
      license: "",
      phone: "",
      department: ""
    });
  };

  const handleDeleteStaff = async (member) => {
    if (!window.confirm(`Are you sure you want to remove access for ${member.name}?`)) return;

    try {
      setLoading(true);
      const updateData = {
        status: 'disabled',
        updatedAt: new Date().toISOString()
      };

      const roleLabel = member.role === 'pharmacy' ? 'Pharmacist' : 'Nurse Staff';

      if (storageMode === 'firestore') {
        const userUid = member.uid || member.nurseId;
        console.log(`Disabling ${member.role}. User UID:`, userUid, "Staff ID:", member.id);

        let userDocRef = null;
        if (userUid) {
          userDocRef = doc(db, "users", userUid);
        } else {
          // Fallback: Try to find user by email
          const q = query(collection(db, "users"), where("email", "==", member.email));
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) {
            userDocRef = doc(db, "users", querySnapshot.docs[0].id);
          }
        }

        if (userDocRef) {
          await updateDoc(userDocRef, updateData);
        }

        // Only update 'staff' collection if it's not a pharmacist
        if (member.role !== 'pharmacy') {
          await updateDoc(doc(db, "staff", member.id), updateData);
        }
      } else {
        const role = member.role;
        const storageKey = role === 'pharmacy' ? 'mockPharmacy' : 'mockStaff';
        const mockData = JSON.parse(localStorage.getItem(storageKey) || '[]');
        const updatedData = mockData.map(item => item.id === member.id ? { ...item, ...updateData } : item);
        localStorage.setItem(storageKey, JSON.stringify(updatedData));
      }

      alert(`${roleLabel} access removed successfully.`);
      fetchData();
    } catch (error) {
      console.error(`Error disabling ${member.role}:`, error);
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = (e) => {
    if (activeTab === "doctors") {
      if (isEditing) {
        handleUpdateDoctor(e);
      } else {
        handleAddDoctor(e);
      }
    } else if (activeTab === "staff") {
      if (isEditing) {
        handleUpdateNurse(e);
      } else {
        handleAddNurse(e);
      }
    } else if (activeTab === "pharmacy") {
      if (isEditing) {
        handleUpdateNurse(e); // Use shared update logic
      } else {
        handleAddPharmacist(e);
      }
    }
  };

  if (loading) {
    // For preset admin, show dashboard even if loading
    const isPresetAdmin = localStorage.getItem('presetAdmin') === 'true';
    if (isPresetAdmin && currentUser) {
      // Show dashboard even if loading for preset admin
    } else {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-900">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-4 text-gray-300">Loading admin dashboard...</p>
          </div>
        </div>
      );
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center mr-3">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent flex flex-col">
                <span className="text-xs uppercase tracking-widest text-blue-400/80 mb-0.5">Hospital Branch Admin</span>
                <span>{branchInfo.name}</span>
              </h1>
              {storageMode === 'localStorage' && (
                <div className="mt-1 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-900 text-yellow-200 border border-yellow-700">
                  <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full mr-1.5"></span>
                  Demo Mode
                </div>
              )}
              {storageMode === 'firestore' && (
                <div className="mt-1 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-900 text-green-200 border border-green-700">
                  <span className="w-1.5 h-1.5 bg-green-400 rounded-full mr-1.5"></span>
                  Live Mode
                </div>
              )}
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                  <span className="text-sm font-semibold">A</span>
                </div>
                <span className="text-gray-300">Admin</span>
              </div>
              <button
                onClick={handleLogout}
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors flex items-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 bg-gray-800 min-h-screen border-r border-gray-700">
          <nav className="mt-8">
            {[
              { id: "overview", name: "Overview", icon: "M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" },
              { id: "users", name: "Users", icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" },
              { id: "doctors", name: "Doctors", icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" },
              { id: "staff", name: "Staff", icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" },
              { id: "pharmacy", name: "Pharmacy", icon: "M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center space-x-3 px-6 py-3 text-left transition-colors ${activeTab === tab.id
                  ? "bg-blue-600 text-white"
                  : "text-gray-300 hover:bg-gray-700"
                  }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
                </svg>
                <span className="font-medium">{tab.name}</span>
              </button>
            ))}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-8">
          {activeTab === "overview" && (
            <div className="space-y-8">
              {/* Storage Mode Information */}
              {storageMode === 'localStorage' && (
                <div className="bg-gradient-to-r from-yellow-600 to-orange-600 rounded-xl p-6 shadow-lg border border-yellow-500">
                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0">
                      <div className="w-12 h-12 bg-yellow-500 rounded-lg flex items-center justify-center">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-white mb-2">Demo Mode Active</h3>
                      <p className="text-yellow-100 text-sm mb-3">
                        You're currently using the admin dashboard in demo mode. All data is stored locally in your browser
                        and will be reset when you clear browser data. This is perfect for testing and demonstration purposes.
                      </p>
                      <div className="flex items-center space-x-4 text-xs text-yellow-200">
                        <span>✓ Full CRUD operations</span>
                        <span>✓ Auto-generated credentials</span>
                        <span>✓ Sample data included</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Analytics Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-6 shadow-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-blue-200 text-sm font-medium">Total Patients</p>
                      <p className="text-3xl font-bold text-white">{analytics.totalPatients}</p>
                      <p className="text-blue-200 text-sm">+{analytics.patientGrowth}% from last month</p>
                    </div>
                    <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-green-600 to-green-700 rounded-xl p-6 shadow-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-green-200 text-sm font-medium">Total Doctors</p>
                      <p className="text-3xl font-bold text-white">{analytics.totalDoctors}</p>
                      <p className="text-green-200 text-sm">Active medical staff</p>
                    </div>
                    <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-purple-600 to-purple-700 rounded-xl p-6 shadow-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-purple-200 text-sm font-medium">Total Revenue</p>
                      <p className="text-3xl font-bold text-white">${analytics.totalRevenue.toLocaleString()}</p>
                      <p className="text-purple-200 text-sm">+{analytics.revenueGrowth}% from last month</p>
                    </div>
                    <div className="w-12 h-12 bg-purple-500 rounded-lg flex items-center justify-center">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-orange-600 to-orange-700 rounded-xl p-6 shadow-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-orange-200 text-sm font-medium">Appointments</p>
                      <p className="text-3xl font-bold text-white">{analytics.appointments}</p>
                      <p className="text-orange-200 text-sm">Today's appointments</p>
                    </div>
                    <div className="w-12 h-12 bg-orange-500 rounded-lg flex items-center justify-center">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent Activity */}
              <div className="bg-gray-800 rounded-xl p-6 shadow-lg">
                <h3 className="text-xl font-bold text-white mb-4">Recent Activity</h3>
                <div className="space-y-4">
                  {[
                    { action: "New patient registered", time: "2 minutes ago", type: "patient" },
                    { action: "Doctor appointment scheduled", time: "15 minutes ago", type: "appointment" },
                    { action: "Pharmacy inventory updated", time: "1 hour ago", type: "pharmacy" },
                    { action: "Staff member added", time: "2 hours ago", type: "staff" }
                  ].map((activity, index) => (
                    <div key={index} className="flex items-center space-x-3 p-3 bg-gray-700 rounded-lg">
                      <div className={`w-2 h-2 rounded-full ${activity.type === 'patient' ? 'bg-blue-500' :
                        activity.type === 'appointment' ? 'bg-green-500' :
                          activity.type === 'pharmacy' ? 'bg-purple-500' : 'bg-orange-500'
                        }`}></div>
                      <div className="flex-1">
                        <p className="text-white font-medium">{activity.action}</p>
                        <p className="text-gray-400 text-sm">{activity.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Other Tabs Content */}
          {activeTab !== "overview" && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-white capitalize">
                  {activeTab === "users" && "Manage Users"}
                  {activeTab === "doctors" && "Manage Doctors"}
                  {activeTab === "staff" && "Manage Nurse Staff"}
                  {activeTab === "pharmacy" && "Manage Pharmacy"}
                </h2>
                {activeTab !== "users" && (
                  <button
                    onClick={() => {
                      resetForm();
                      setIsEditing(false);
                      setShowAddForm(true);
                    }}
                    className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    <span>Add {activeTab === "staff" ? "Nurse Staff" : activeTab.slice(0, -1)}</span>
                  </button>
                )}
                {activeTab === "users" && (
                  <div className="text-gray-400 text-sm">
                    Users register automatically through the login system
                  </div>
                )}
              </div>

              <div className="bg-gray-800 rounded-xl shadow-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-700">
                    <thead className="bg-gray-700">
                      <tr>
                        {activeTab === "users" && (
                          <>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Email</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Role</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Auth Method</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Created</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Actions</th>
                          </>
                        )}
                        {activeTab === "doctors" && (
                          <>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Email</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Password</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Specialization</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">License</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Phone</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Actions</th>
                          </>
                        )}
                        {activeTab === "staff" && (
                          <>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Email</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Role</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Phone</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Actions</th>
                          </>
                        )}
                        {activeTab === "pharmacy" && (
                          <>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Email</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Role</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Phone</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Actions</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody className="bg-gray-800 divide-y divide-gray-700">
                      {activeTab === "users" && users.map((user) => (
                        <tr key={user.id} className="hover:bg-gray-700">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                            {user.name || user.displayName || 'Unknown'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                            {user.email}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${user.role === 'admin' ? 'bg-red-100 text-red-800' :
                              user.role === 'doctor' ? 'bg-blue-100 text-blue-800' :
                                user.role === 'patient' ? 'bg-green-100 text-green-800' :
                                  'bg-gray-100 text-gray-800'
                              }`}>
                              {user.role || 'patient'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${user.authMethod === 'Google' ? 'bg-blue-100 text-blue-800' :
                              'bg-gray-100 text-gray-800'
                              }`}>
                              {user.authMethod}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                            {user.createdAt && user.createdAt !== 'Demo' && user.createdAt !== 'Unknown'
                              ? new Date(user.createdAt).toLocaleDateString()
                              : user.createdAt || 'Unknown'
                            }
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                            <div className="flex space-x-2">
                              <button
                                onClick={() => {
                                  if (user.role === 'doctor') {
                                    setActiveTab('doctors');
                                  } else if (user.role === 'patient') {
                                    // Could navigate to patient management if implemented
                                    alert(`Patient management for ${user.name || user.email} - Feature coming soon!`);
                                  } else {
                                    alert(`User details for ${user.name || user.email} - Feature coming soon!`);
                                  }
                                }}
                                className="text-blue-400 hover:text-blue-300 font-medium"
                              >
                                View Details
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {activeTab === "doctors" && doctors.map((doctor) => (
                        <tr key={doctor.id} className="hover:bg-gray-700">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">{doctor.name}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                            <div className="flex items-center space-x-2">
                              <span className="truncate max-w-xs" title={doctor.email}>{doctor.email}</span>
                              <button
                                onClick={() => copyToClipboard(doctor.email, 'email')}
                                className="text-blue-400 hover:text-blue-300 transition-colors p-1 rounded hover:bg-gray-600"
                                title="Copy email"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                              </button>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                            <div className="flex items-center space-x-2">
                              <span className="font-mono text-xs bg-gray-700 px-2 py-1 rounded border">
                                {(doctor.password || doctor.generatedPassword) ? '••••••••' : 'N/A'}
                              </span>
                              {(doctor.password || doctor.generatedPassword) && (
                                <button
                                  onClick={() => copyToClipboard(doctor.password || doctor.generatedPassword, 'password')}
                                  className="text-green-400 hover:text-green-300 transition-colors p-1 rounded hover:bg-gray-600"
                                  title="Copy password"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                  </svg>
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{doctor.specialization}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{doctor.license}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{doctor.phone}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex space-x-2">
                              <button
                                onClick={() => copyToClipboard(`Email: ${doctor.email}\nPassword: ${doctor.password || doctor.generatedPassword}`, 'credentials')}
                                className="text-purple-400 hover:text-purple-300 transition-colors text-xs bg-purple-900 px-2 py-1 rounded"
                                title="Copy both email and password"
                              >
                                Copy All
                              </button>
                              <button
                                onClick={() => handleEditDoctor(doctor)}
                                className="text-blue-400 hover:text-blue-300 transition-colors"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteDoctor(doctor.id)}
                                className="text-red-400 hover:text-red-300 transition-colors"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {activeTab === "staff" && staff.filter(m => m.status !== 'disabled').map((member) => (
                        <tr key={member.id} className="hover:bg-gray-700">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">{member.name}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{member.email}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{member.department || member.role}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{member.phone}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex space-x-3">
                              <button
                                onClick={() => handleEditStaff(member)}
                                className="text-blue-400 hover:text-blue-300 transition-colors"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteStaff(member)}
                                className="text-red-400 hover:text-red-300 transition-colors"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {activeTab === "pharmacy" && pharmacy.map((member) => (
                        <tr key={member.id} className="hover:bg-gray-700">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">{member.name}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{member.email}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">Pharmacist</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{member.phone}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex space-x-3">
                              <button
                                onClick={() => handleEditStaff(member)}
                                className="text-blue-400 hover:text-blue-300 transition-colors"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteDoctor(member.id)}
                                className="text-red-400 hover:text-red-300 transition-colors"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Add Form Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-8 border w-96 shadow-2xl rounded-xl bg-gray-800 border-gray-700">
            <div className="mt-3">
              <h3 className="text-xl font-bold text-white mb-6">
                {isEditing
                  ? `Edit ${activeTab === 'staff' ? 'Nurse Staff' : (activeTab === 'pharmacy' ? 'Pharmacist' : activeTab.slice(0, -1))}`
                  : `Add ${activeTab === 'staff' ? 'Nurse Staff' : (activeTab === 'pharmacy' ? 'Pharmacist' : activeTab.slice(0, -1))}`
                }
              </h3>
              <form onSubmit={handleFormSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
                  <div className="flex space-x-2">
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter email or auto-generate"
                    />
                    {(activeTab === "doctors" || activeTab === "staff") && !isEditing && (
                      <button
                        type="button"
                        onClick={generateCredentials}
                        className="bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700 transition-colors whitespace-nowrap"
                      >
                        Auto Generate
                      </button>
                    )}
                  </div>
                </div>
                {(activeTab === "doctors" || activeTab === "staff" || activeTab === "pharmacy") && (
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Password</label>
                    <input
                      type="text"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder={isEditing ? "Leave blank to keep current password" : "Create password for staff"}
                      required={!isEditing}
                    />
                  </div>
                )}
                {activeTab === "doctors" && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Specialization</label>
                      <input
                        type="text"
                        value={formData.specialization}
                        onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">License</label>
                      <input
                        type="text"
                        value={formData.license}
                        onChange={(e) => setFormData({ ...formData, license: e.target.value })}
                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                      />
                    </div>
                  </>
                )}
                {activeTab === "staff" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Department</label>
                    <select
                      value={formData.department}
                      onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    >
                      <option value="">Select Department</option>
                      <option value="Emergency">Emergency</option>
                      <option value="ICU">ICU</option>
                      <option value="OPD">OPD</option>
                      <option value="Surgery">Surgery</option>
                      <option value="General">General</option>
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Phone</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddForm(false);
                      setIsEditing(false);
                      setEditingItem(null);
                      setFormData({
                        name: "",
                        email: "",
                        password: "",
                        specialization: "",
                        license: "",
                        phone: "",
                        department: ""
                      });
                    }}
                    className="bg-gray-600 text-gray-300 px-6 py-3 rounded-lg hover:bg-gray-500 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    {isEditing ? 'Update' : 'Add'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
