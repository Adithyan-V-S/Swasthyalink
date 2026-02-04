import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { auth } from "../firebaseConfig";
import { getConnectedPatients } from "../services/patientDoctorService";
import { savePrescription, subscribeToDoctorPrescriptions, formatDate, isTestUser } from "../utils/firebaseUtils";

const DoctorPrescriptions = () => {
  const { currentUser } = useAuth();
  const location = useLocation();
  const [connectedPatients, setConnectedPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [prescription, setPrescription] = useState({
    medication: "",
    dosage: "",
    frequency: "",
    duration: "",
    instructions: "",
    notes: ""
  });
  const [prescriptions, setPrescriptions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [notification, setNotification] = useState("");

  useEffect(() => {
    loadConnectedPatients();
    loadPrescriptions();

    // Set up real-time subscription to prescriptions
    if (currentUser?.uid && !isTestUser()) {
      const unsubscribe = subscribeToDoctorPrescriptions(currentUser.uid, (prescriptions) => {
        setPrescriptions(prescriptions);
      });

      return () => {
        if (unsubscribe) unsubscribe();
      };
    }
  }, [currentUser]);

  // After patients load, try to preselect based on URL/state or single result
  useEffect(() => {
    if (!connectedPatients || connectedPatients.length === 0) return;

    // Prefer explicit routing hints
    const search = new URLSearchParams(location.search || "");
    const hintedId = search.get('patientId') || location.state?.patientId || location.state?.patient?.id;

    if (hintedId) {
      const match = connectedPatients.find(p => p.id === hintedId);
      if (match) {
        setSelectedPatient(match);
        return;
      }
    }

    // If only one patient is connected, auto-select
    if (!selectedPatient && connectedPatients.length === 1) {
      setSelectedPatient(connectedPatients[0]);
    }
  }, [connectedPatients, location.state, location.search]);

  const loadConnectedPatients = async () => {
    try {
      setIsLoading(true);
      // Check if this is a test user
      if (isTestUser()) {
        // Use mock data for test users
        const mockPatients = [
          {
            id: "patient1",
            name: "John Smith",
            email: "john.smith@example.com",
            age: 45,
            gender: "Male",
            bloodType: "O+",
            allergies: ["Penicillin"],
            lastVisit: "2024-01-15"
          },
          {
            id: "patient2",
            name: "Sarah Johnson",
            email: "sarah.johnson@example.com",
            age: 32,
            gender: "Female",
            bloodType: "A-",
            allergies: ["Shellfish"],
            lastVisit: "2024-01-10"
          }
        ];
        setConnectedPatients(mockPatients);
        // Auto-select the first connected patient for a smoother UX
        if (!selectedPatient && mockPatients.length > 0) {
          setSelectedPatient(mockPatients[0]);
        }
        return;
      }

      // For real users, fetch from backend
      const response = await getConnectedPatients();
      // Service may return an array or an object with { patients }
      const rawPatients = Array.isArray(response) ? response : response?.patients;
      if (rawPatients && rawPatients.length >= 0) {
        const patients = rawPatients.map((patient) => {
          // The backend returns relationship objects, which contain a nested 'patient' object with user details
          // We need to check both the root (if flattened) and the nested 'patient' property
          const patientData = patient.patient || {};

          const normalized = {
            id: patient.patientId || patient.id || patient.uid,
            name: patientData.name || patient.name || patient.patientName || patient.fullName || 'Unknown Patient',
            email: patientData.email || patient.email || patient.patientEmail || 'No email',
            age: patientData.age || patient.age || 'Not specified',
            gender: patientData.gender || patient.gender || 'Not specified',
            bloodType: patientData.bloodType || patient.bloodType || 'Not specified',
            allergies: patientData.allergies || patient.allergies || [],
            lastVisit: patient.lastVisit || patient.connectedAt || patient.lastInteraction || 'Never'
          };
          return normalized;
        });
        console.log('DoctorPrescriptions: Loaded connected patients (normalized):', patients);
        setConnectedPatients(patients);
        // If none selected yet, auto-select the first available connected patient
        if (!selectedPatient && patients.length > 0) {
          setSelectedPatient(patients[0]);
        }
      } else {
        setConnectedPatients([]);
      }
    } catch (error) {
      console.error('Error loading connected patients:', error);
      setNotification('Error loading patients');
    } finally {
      setIsLoading(false);
    }
  };

  const loadPrescriptions = async () => {
    try {
      // Mock prescriptions data
      setPrescriptions([
        {
          id: "pres1",
          patientName: "John Smith",
          medication: "Amoxicillin 500mg",
          dosage: "500mg",
          frequency: "3 times daily",
          duration: "7 days",
          instructions: "Take with food",
          prescribedDate: "2024-01-20",
          status: "Active"
        },
        {
          id: "pres2",
          patientName: "Sarah Johnson",
          medication: "Metformin 850mg",
          dosage: "850mg",
          frequency: "Twice daily",
          duration: "30 days",
          instructions: "Take with breakfast and dinner",
          prescribedDate: "2024-01-18",
          status: "Active"
        }
      ]);
    } catch (error) {
      console.error('Error loading prescriptions:', error);
    }
  };

  const handlePrescriptionChange = (e) => {
    setPrescription({
      ...prescription,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmitPrescription = async (e) => {
    e.preventDefault();

    if (!selectedPatient) {
      setNotification('Please select a patient');
      return;
    }

    if (!prescription.medication.trim()) {
      setNotification('Please enter medication name');
      return;
    }

    try {
      setIsLoading(true);

      // Create prescription object
      const newPrescription = {
        id: Date.now().toString(),
        patientId: selectedPatient.id,
        patientName: selectedPatient.name,
        patientEmail: selectedPatient.email,
        doctorId: currentUser?.uid,
        doctorName: currentUser?.name || "Dr. Unknown",
        doctorEmail: currentUser?.email || "unknown@example.com",
        ...prescription,
        prescribedDate: new Date().toISOString().split('T')[0],
        status: "Active",
        createdAt: new Date().toISOString()
      };

      // Save to Firestore using utility function
      const result = await savePrescription(newPrescription);

      if (result.success) {
        // Show success message with SweetAlert2
        const Swal = (await import('sweetalert2')).default;
        await Swal.fire({
          title: 'Prescription Saved Successfully!',
          text: `Prescription for ${selectedPatient.name} has been saved.`,
          icon: 'success',
          confirmButtonText: 'OK',
          confirmButtonColor: '#3B82F6'
        });

        // Reset form
        setPrescription({
          medication: "",
          dosage: "",
          frequency: "",
          duration: "",
          instructions: "",
          notes: ""
        });
        setSelectedPatient(null);

        // Clear notification
        setNotification('');
      } else {
        throw new Error(result.error || 'Failed to save prescription');
      }

    } catch (error) {
      console.error('Error saving prescription:', error);
      setNotification('Error saving prescription');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Active': return 'bg-green-100 text-green-800';
      case 'Completed': return 'bg-blue-100 text-blue-800';
      case 'Cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Prescription Management</h1>
              <p className="text-gray-600 mt-1">Write and manage patient prescriptions</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* Write Prescription Form */}
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Write New Prescription</h2>

            <form onSubmit={handleSubmitPrescription} className="space-y-6">
              {/* Patient Selection / Display */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Patient
                </label>
                {selectedPatient ? (
                  <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
                    <div>
                      <div className="font-medium text-gray-900">{selectedPatient.name}</div>
                      <div className="text-sm text-gray-600">{selectedPatient.email}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedPatient(null)}
                      className="text-sm text-blue-700 hover:text-blue-900"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <select
                    value={selectedPatient?.id || ""}
                    onChange={(e) => {
                      const patient = connectedPatients.find(p => p.id === e.target.value);
                      setSelectedPatient(patient);
                    }}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="">Choose a patient...</option>
                    {connectedPatients && connectedPatients.length > 0 ? connectedPatients.map((patient, index) => (
                      <option key={patient.id || `patient-${index}`} value={patient.id}>
                        {patient.name} ({patient.email})
                      </option>
                    )) : null}
                  </select>
                )}
              </div>

              {/* Patient Info Display */}
              {selectedPatient && (
                <div className="bg-blue-50 rounded-lg p-4">
                  <h3 className="font-medium text-gray-900 mb-2">Patient Information</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Age:</span> {selectedPatient.age}
                    </div>
                    <div>
                      <span className="text-gray-600">Gender:</span> {selectedPatient.gender}
                    </div>
                    <div>
                      <span className="text-gray-600">Blood Type:</span> {selectedPatient.bloodType}
                    </div>
                    <div>
                      <span className="text-gray-600">Allergies:</span> {selectedPatient.allergies?.join(', ') || 'None'}
                    </div>
                  </div>
                </div>
              )}

              {/* Medication Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Medication Name *
                  </label>
                  <input
                    type="text"
                    name="medication"
                    value={prescription.medication}
                    onChange={handlePrescriptionChange}
                    placeholder="e.g., Amoxicillin 500mg"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Dosage
                  </label>
                  <input
                    type="text"
                    name="dosage"
                    value={prescription.dosage}
                    onChange={handlePrescriptionChange}
                    placeholder="e.g., 500mg"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Frequency
                  </label>
                  <select
                    name="frequency"
                    value={prescription.frequency}
                    onChange={handlePrescriptionChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select frequency...</option>
                    <option value="Once daily">Once daily</option>
                    <option value="Twice daily">Twice daily</option>
                    <option value="3 times daily">3 times daily</option>
                    <option value="4 times daily">4 times daily</option>
                    <option value="As needed">As needed</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Duration
                  </label>
                  <input
                    type="text"
                    name="duration"
                    value={prescription.duration}
                    onChange={handlePrescriptionChange}
                    placeholder="e.g., 7 days, 2 weeks"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Instructions
                </label>
                <textarea
                  name="instructions"
                  value={prescription.instructions}
                  onChange={handlePrescriptionChange}
                  rows="3"
                  placeholder="e.g., Take with food, Avoid alcohol, etc."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Additional Notes
                </label>
                <textarea
                  name="notes"
                  value={prescription.notes}
                  onChange={handlePrescriptionChange}
                  rows="2"
                  placeholder="Any additional notes for the patient..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading || !selectedPatient}
                className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
              >
                {isLoading ? 'Saving...' : 'Save Prescription'}
              </button>
            </form>
          </div>

          {/* Recent Prescriptions */}
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Recent Prescriptions</h2>

            {prescriptions.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No prescriptions yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {prescriptions && prescriptions.length > 0 ? prescriptions.map((pres, index) => {
                  console.log('Rendering prescription:', { id: pres.id, medication: pres.medication, index });
                  return (
                    <div key={pres.id || `prescription-${index}`} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="font-medium text-gray-900">{pres.medication}</h3>
                          <p className="text-sm text-gray-600">{pres.patientName}</p>
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(pres.status)}`}>
                          {pres.status}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-sm text-gray-600 mb-3">
                        <div>
                          <span className="font-medium">Dosage:</span> {pres.dosage || 'Not specified'}
                        </div>
                        <div>
                          <span className="font-medium">Frequency:</span> {pres.frequency || 'Not specified'}
                        </div>
                        <div>
                          <span className="font-medium">Duration:</span> {pres.duration || 'Not specified'}
                        </div>
                        <div>
                          <span className="font-medium">Date:</span> {pres.prescribedDate}
                        </div>
                      </div>

                      {pres.instructions && (
                        <div className="text-sm text-gray-600">
                          <span className="font-medium">Instructions:</span> {pres.instructions}
                        </div>
                      )}

                      {pres.notes && (
                        <div className="text-sm text-gray-600 mt-2">
                          <span className="font-medium">Notes:</span> {pres.notes}
                        </div>
                      )}
                    </div>
                  );
                }) : null}
              </div>
            )}
          </div>
        </div>
      </div>

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
    </div>
  );
};

export default DoctorPrescriptions;



