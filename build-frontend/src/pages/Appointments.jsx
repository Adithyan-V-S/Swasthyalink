import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { getAppointments, createAppointment } from "../services/appointmentService";
import { db } from "../firebaseConfig";
import { collection, getDocs, query, where } from "firebase/firestore";

const Appointments = () => {
    const { currentUser } = useAuth();
    const [appointments, setAppointments] = useState([]);
    const [doctors, setDoctors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showBooking, setShowBooking] = useState(false);
    const [formData, setFormData] = useState({ doctorId: "", date: "", time: "", reason: "" });

    useEffect(() => {
        const loadInitialData = async () => {
            if (!currentUser) return;
            setLoading(true);
            try {
                // Fetch user's appointments
                const apptsRes = await getAppointments(currentUser.uid, 'patient');
                if (apptsRes.success) setAppointments(apptsRes.appointments);

                // Fetch available doctors
                const doctorsSnap = await getDocs(query(collection(db, "users"), where("role", "==", "doctor")));
                setDoctors(doctorsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            } catch (error) {
                console.error("Error loading appointment data:", error);
            }
            setLoading(false);
        };
        loadInitialData();
    }, [currentUser]);

    const handleBooking = async (e) => {
        e.preventDefault();
        try {
            const res = await createAppointment({
                ...formData,
                patientId: currentUser.uid,
                branchId: currentUser.branchId
            });
            if (res.success) {
                alert("Appointment booked successfully!");
                setShowBooking(false);
                // Refresh list
                const apptsRes = await getAppointments(currentUser.uid, 'patient');
                if (apptsRes.success) setAppointments(apptsRes.appointments);
            }
        } catch (error) {
            alert("Booking failed: " + error.message);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-4xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">My Appointments</h1>
                    <button
                        onClick={() => setShowBooking(true)}
                        className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-semibold shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:-translate-y-0.5 transition-all"
                    >
                        Book New Appointment
                    </button>
                </div>

                {loading ? (
                    <div className="flex justify-center p-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {appointments.length === 0 ? (
                            <div className="bg-white rounded-2xl p-12 text-center border-2 border-dashed border-gray-200">
                                <p className="text-gray-500">You have no upcoming appointments.</p>
                            </div>
                        ) : (
                            appointments.map(appt => (
                                <div key={appt.id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="bg-indigo-50 text-indigo-700 text-xs font-bold px-2 py-0.5 rounded uppercase">
                                                {appt.status}
                                            </span>
                                            <h3 className="text-lg font-bold text-gray-900">{appt.date} at {appt.time}</h3>
                                        </div>
                                        <p className="text-gray-600 font-medium">Doctor ID: {appt.doctorId}</p>
                                        <p className="text-gray-400 text-sm mt-1">{appt.reason}</p>
                                    </div>
                                    <button className="text-red-500 text-sm font-semibold hover:text-red-700">Cancel</button>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>

            {showBooking && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-3xl p-8 max-w-lg w-full shadow-2xl animate-in fade-in zoom-in duration-200">
                        <h2 className="text-2xl font-bold mb-6 text-gray-900">Schedule a Consultation</h2>
                        <form onSubmit={handleBooking} className="space-y-5">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Select Doctor</label>
                                <select
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                    value={formData.doctorId}
                                    onChange={(e) => setFormData({ ...formData, doctorId: e.target.value })}
                                    required
                                >
                                    <option value="">Select a doctor</option>
                                    {doctors.map(doc => (
                                        <option key={doc.id} value={doc.id}>{doc.name} ({doc.specialization})</option>
                                    ))}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Date</label>
                                    <input
                                        type="date"
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                        value={formData.date}
                                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Time</label>
                                    <input
                                        type="time"
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                        value={formData.time}
                                        onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Reason for Visit</label>
                                <textarea
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all h-24 resize-none"
                                    placeholder="Describe your symptoms..."
                                    value={formData.reason}
                                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                                ></textarea>
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowBooking(false)}
                                    className="flex-1 px-4 py-3 border border-gray-200 text-gray-600 rounded-xl font-bold hover:bg-gray-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all"
                                >
                                    Confirm Booking
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Appointments;
