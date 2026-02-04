import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { db } from "../firebaseConfig";
import { collection, query, where, getDocs, orderBy, limit, onSnapshot } from "firebase/firestore";

const NurseDashboard = () => {
    const { currentUser } = useAuth();
    const [patients, setPatients] = useState([]);
    const [vitals, setVitals] = useState({
        heartRate: "",
        bloodPressure: "",
        temperature: "",
        oxygen: ""
    });
    const [loading, setLoading] = useState(true);
    const [activeDepartment, setActiveDepartment] = useState("General");

    useEffect(() => {
        // Fetch nurse details to get department
        const fetchNurseDetails = async () => {
            if (currentUser?.uid) {
                try {
                    const nurseDoc = await getDocs(query(collection(db, "users"), where("uid", "==", currentUser.uid)));
                    if (!nurseDoc.empty) {
                        const data = nurseDoc.docs[0].data();
                        setActiveDepartment(data.department || "General");
                    }
                } catch (error) {
                    console.error("Error fetching nurse details:", error);
                }
            }
        };

        fetchNurseDetails();
    }, [currentUser]);

    useEffect(() => {
        // Mock patients for the department
        const mockPatients = [
            { id: "P1", name: "Amit Sharma", age: 45, bed: "102-A", status: "Stable", lastCheck: "2h ago" },
            { id: "P2", name: "Priya Patel", age: 32, bed: "205", status: "Critical", lastCheck: "15m ago" },
            { id: "P3", name: "Rahul Verma", age: 58, bed: "108-B", status: "Under Observation", lastCheck: "1h ago" },
        ];
        setPatients(mockPatients);
        setLoading(false);
    }, []);

    const handleVitalSubmit = (e) => {
        e.preventDefault();
        alert("Vitals captured successfully!");
        setVitals({ heartRate: "", bloodPressure: "", temperature: "", oxygen: "" });
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
            {/* Header */}
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                        Nurse Care Console
                    </h1>
                    <p className="text-slate-400">Department: {activeDepartment} | Shift: Day</p>
                </div>
                <div className="flex items-center gap-4 bg-slate-900/50 p-2 rounded-2xl border border-slate-800">
                    <div className="text-right">
                        <p className="text-sm font-medium">{currentUser?.displayName || "Nurse User"}</p>
                        <p className="text-xs text-emerald-400 flex items-center justify-end gap-1">
                            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span> Online
                        </p>
                    </div>
                    <div className="w-10 h-10 bg-emerald-500/20 rounded-full flex items-center justify-center text-emerald-400">
                        <span className="material-icons">medical_services</span>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left: Patient List */}
                <div className="lg:col-span-2 space-y-6">
                    <section className="bg-slate-900/50 rounded-3xl p-6 border border-slate-800/50 shadow-xl">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-semibold flex items-center gap-2">
                                <span className="material-icons text-blue-400">group</span> Active Patients
                            </h2>
                            <span className="text-xs bg-blue-500/10 text-blue-400 px-3 py-1 rounded-full border border-blue-500/20">
                                {patients.length} Ward Patients
                            </span>
                        </div>

                        <div className="space-y-4">
                            {patients.map((patient) => (
                                <div key={patient.id} className="group bg-slate-800/30 hover:bg-slate-800/60 rounded-2xl p-4 transition-all border border-slate-700/50 hover:border-blue-500/30 cursor-pointer">
                                    <div className="flex justify-between items-start">
                                        <div className="flex gap-4">
                                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${patient.status === 'Critical' ? 'bg-red-500/20 text-red-500' : 'bg-slate-700/50 text-slate-400'}`}>
                                                <span className="material-icons">person</span>
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-slate-200">{patient.name}</h3>
                                                <p className="text-xs text-slate-500">Bed: {patient.bed} | Age: {patient.age}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${patient.status === 'Critical' ? 'bg-red-500/10 text-red-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                                                {patient.status}
                                            </span>
                                            <p className="text-[10px] text-slate-500 mt-1">Checked {patient.lastCheck}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Quick Vital Entry */}
                    <section className="bg-slate-900/50 rounded-3xl p-6 border border-slate-800/50 shadow-xl">
                        <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                            <span className="material-icons text-emerald-400">favorite</span> Vital Sign Entry
                        </h2>
                        <form onSubmit={handleVitalSubmit} className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="space-y-2">
                                <label className="text-xs text-slate-400">Heart Rate (BPM)</label>
                                <input
                                    type="text"
                                    value={vitals.heartRate}
                                    onChange={(e) => setVitals({ ...vitals, heartRate: e.target.value })}
                                    className="w-full bg-slate-800 border-slate-700 rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none transition-all placeholder-slate-600"
                                    placeholder="72"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs text-slate-400">BP (mmHg)</label>
                                <input
                                    type="text"
                                    value={vitals.bloodPressure}
                                    onChange={(e) => setVitals({ ...vitals, bloodPressure: e.target.value })}
                                    className="w-full bg-slate-800 border-slate-700 rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none transition-all placeholder-slate-600"
                                    placeholder="120/80"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs text-slate-400">Temp (°F)</label>
                                <input
                                    type="text"
                                    value={vitals.temperature}
                                    onChange={(e) => setVitals({ ...vitals, temperature: e.target.value })}
                                    className="w-full bg-slate-800 border-slate-700 rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none transition-all placeholder-slate-600"
                                    placeholder="98.6"
                                />
                            </div>
                            <div className="space-y-2 text-right flex flex-col justify-end">
                                <button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-emerald-900/20">
                                    Update
                                </button>
                            </div>
                        </form>
                    </section>
                </div>

                {/* Right: Tasks & Notifications */}
                <div className="space-y-8">
                    <section className="bg-gradient-to-br from-indigo-900/40 to-slate-900/50 rounded-3xl p-6 border border-indigo-500/20 shadow-xl backdrop-blur-sm">
                        <h2 className="text-xl font-semibold mb-6 flex items-center gap-2 text-indigo-300">
                            <span className="material-icons">list_alt</span> Shift Tasks
                        </h2>
                        <div className="space-y-4">
                            {[
                                { task: "Administer meds - Ward B", priority: "High", time: "10:30 AM" },
                                { task: "Update patient records", priority: "Normal", time: "11:00 AM" },
                                { task: "Handover meeting", priority: "Low", time: "02:00 PM" },
                            ].map((item, i) => (
                                <div key={i} className="flex items-center gap-4 bg-slate-950/40 p-4 rounded-2xl border border-slate-800/50">
                                    <div className={`w-2 h-10 rounded-full ${item.priority === 'High' ? 'bg-red-500' : 'bg-slate-700'}`}></div>
                                    <div className="flex-1">
                                        <p className="text-sm font-medium text-slate-200">{item.task}</p>
                                        <p className="text-[10px] text-slate-500">{item.time}</p>
                                    </div>
                                    <span className="material-icons text-slate-600 hover:text-emerald-400 cursor-pointer transition-colors">check_circle</span>
                                </div>
                            ))}
                        </div>
                    </section>

                    <section className="bg-slate-900/50 rounded-3xl p-6 border border-slate-800/50">
                        <div className="flex items-center gap-3 p-4 bg-orange-500/10 border border-orange-500/20 rounded-2xl">
                            <span className="material-icons text-orange-500">warning</span>
                            <div>
                                <p className="text-sm font-bold text-orange-200">System Maintenance</p>
                                <p className="text-[10px] text-orange-300/70">12:00 AM - 02:00 AM tonight</p>
                            </div>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
};

export default NurseDashboard;
