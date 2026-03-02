import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebaseConfig';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { toast } from 'react-hot-toast';
import BranchQueue from '../components/BranchQueue';
import PatientVitalsForm from '../components/PatientVitalsForm';

const NurseDashboard = () => {
    const { currentUser } = useAuth();
    const [activeTab, setActiveTab] = useState('queue');
    const [queue, setQueue] = useState([]);
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [stats, setStats] = useState({
        checkedIn: 0,
        completed: 0,
        averageWait: '12m'
    });

    // Mock Queue Data for MVP demonstration
    // In production, this would be a real-time Firestore listener on a 'visits' collection
    useEffect(() => {
        const mockQueue = [
            { id: 'p1', name: 'Rahul Sharma', checkInTime: '10:15 AM', priority: 'High', age: 45, gender: 'Male' },
            { id: 'p2', name: 'Priya Patel', checkInTime: '10:30 AM', priority: 'Normal', age: 32, gender: 'Female' },
            { id: 'p3', name: 'Amit Singh', checkInTime: '10:45 AM', priority: 'Normal', age: 28, gender: 'Male' },
            { id: 'p4', name: 'Sneha Reddy', checkInTime: '11:00 AM', priority: 'High', age: 52, gender: 'Female' },
        ];
        setQueue(mockQueue);
        setStats(prev => ({ ...prev, checkedIn: mockQueue.length }));
    }, []);

    const handleSaveVitals = async (vitalsData) => {
        try {
            // 1. Save to patient_vitals collection
            const vitalsRef = collection(db, 'patient_vitals');
            const docRef = await addDoc(vitalsRef, {
                patientId: selectedPatient.id,
                patientName: selectedPatient.name,
                nurseId: currentUser.uid,
                nurseName: currentUser.displayName || 'Head Nurse',
                branchId: currentUser.branchId || 'default-kerala',
                companyId: currentUser.companyId || 'abc-hospital-group',
                ...vitalsData,
                createdAt: serverTimestamp()
            });

            // 2. Trigger Blockchain Linking (Cloud Function)
            const response = await fetch('https://us-central1-swasthyalink-42535.cloudfunctions.net/addMedicalBlock', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    recordType: 'vitals',
                    recordId: docRef.id,
                    patientId: selectedPatient.id,
                    diagnosis: `Vitals recorded: BMI ${vitalsData.bmi}`,
                    timestamp: new Date().toISOString()
                }),
            });

            const bcData = await response.json();

            toast.success(
                <div className="flex flex-col">
                    <span className="font-bold text-sm">Vitals Secured!</span>
                    <span className="text-[10px] opacity-70">Linked to Ledger Block #{bcData.data?.index || '...'}</span>
                </div>,
                { duration: 4000 }
            );

            // Move patient to "completed" in local state
            setQueue(prev => prev.filter(p => p.id !== selectedPatient.id));
            setSelectedPatient(null);
            setStats(prev => ({ ...prev, completed: prev.completed + 1 }));
            setActiveTab('queue');

        } catch (error) {
            console.error('Error saving vitals:', error);
            toast.error('Failed to save vitals. Please check connection.');
        }
    };

    return (
        <div className="min-h-screen bg-[#f8fafc] flex flex-col">
            {/* Elegant Header */}
            <header className="bg-slate-900 border-b border-slate-800 px-8 py-4 flex justify-between items-center shadow-2xl">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-green-500/20 rounded-2xl flex items-center justify-center border border-green-500/30">
                        <span className="material-icons text-green-400">medical_services</span>
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-white tracking-tight uppercase italic">Swasthyalink</h1>
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                                Nurse Care Station • Kerala Branch
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    <div className="hidden md:flex gap-8">
                        <div className="text-right">
                            <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Shift Status</p>
                            <p className="text-white font-bold text-sm">Active (08:00 - 16:00)</p>
                        </div>
                        <div className="text-right border-l border-slate-800 pl-8">
                            <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Nurse in Charge</p>
                            <p className="text-white font-bold text-sm">{currentUser?.displayName || 'Alice Johnson'}</p>
                        </div>
                    </div>
                    <button className="bg-slate-800 p-2 rounded-xl text-slate-400 hover:text-white transition-colors">
                        <span className="material-icons">notifications</span>
                    </button>
                </div>
            </header>

            <main className="flex-1 p-8">
                <div className="max-w-[1400px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">

                    {/* Sidebar: Stats & Quick Actions */}
                    <div className="lg:col-span-3 space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-white p-6 rounded-[24px] border border-gray-100 shadow-sm">
                                <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest mb-1">Waiting</p>
                                <p className="text-3xl font-black text-slate-900">{queue.length}</p>
                            </div>
                            <div className="bg-white p-6 rounded-[24px] border border-gray-100 shadow-sm">
                                <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest mb-1">Cleared</p>
                                <p className="text-3xl font-black text-green-600">{stats.completed}</p>
                            </div>
                        </div>

                        <div className="bg-gradient-to-br from-indigo-600 to-blue-700 p-8 rounded-[32px] text-white shadow-xl relative overflow-hidden group">
                            <div className="absolute top-0 right-0 opacity-10 transform translate-x-1/4 -translate-y-1/4">
                                <span className="material-icons text-[120px]">verified_user</span>
                            </div>
                            <h4 className="text-xl font-bold mb-2 relative">Ledger Status</h4>
                            <p className="text-blue-100 text-sm opacity-80 mb-6 relative">
                                Every vital record you save is automatically hashed and added to the blockchain ledger for total record integrity.
                            </p>
                            <div className="flex items-center gap-2 bg-white/20 backdrop-blur-md px-3 py-1 rounded-full w-fit">
                                <span className="w-1.5 h-1.5 bg-green-400 rounded-full"></span>
                                <span className="text-[10px] font-bold uppercase">Blockchain Live</span>
                            </div>
                        </div>

                        <div className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm">
                            <h4 className="text-sm font-black text-gray-800 uppercase tracking-widest mb-6">Nav</h4>
                            <nav className="space-y-2">
                                {[
                                    { id: 'queue', name: 'Patient Queue', icon: 'groups' },
                                    { id: 'vitals', name: 'Vitals Center', icon: 'monitor_heart', disabled: !selectedPatient },
                                    { id: 'history', name: 'Branch Logs', icon: 'history' }
                                ].map(tab => (
                                    <button
                                        key={tab.id}
                                        disabled={tab.disabled}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === tab.id
                                            ? 'bg-blue-50 text-blue-600 translate-x-2'
                                            : tab.disabled ? 'opacity-30 grayscale cursor-not-allowed' : 'text-gray-500 hover:bg-gray-50'
                                            }`}
                                    >
                                        <span className="material-icons text-xl">{tab.icon}</span>
                                        {tab.name}
                                    </button>
                                ))}
                            </nav>
                        </div>
                    </div>

                    {/* Main Stage */}
                    <div className="lg:col-span-9">
                        {activeTab === 'queue' && (
                            <div className="animate-fade-in grid grid-cols-1 md:grid-cols-12 gap-8 h-full min-h-[600px]">
                                <div className="md:col-span-12">
                                    <BranchQueue
                                        queue={queue}
                                        onSelectPatient={(p) => {
                                            setSelectedPatient(p);
                                            setActiveTab('vitals');
                                        }}
                                        selectedPatientId={selectedPatient?.id}
                                    />
                                </div>
                            </div>
                        )}

                        {activeTab === 'vitals' && selectedPatient && (
                            <div className="animate-fade-in-up">
                                <div className="flex items-center gap-4 mb-6">
                                    <button
                                        onClick={() => setActiveTab('queue')}
                                        className="p-2 bg-white border border-gray-200 rounded-xl text-gray-500 hover:text-blue-600 transition-colors"
                                    >
                                        <span className="material-icons">arrow_back</span>
                                    </button>
                                    <h2 className="text-2xl font-black text-slate-900">Health Assessment</h2>
                                </div>
                                <PatientVitalsForm
                                    patient={selectedPatient}
                                    onSave={handleSaveVitals}
                                    onCancel={() => {
                                        setSelectedPatient(null);
                                        setActiveTab('queue');
                                    }}
                                />
                            </div>
                        )}

                        {activeTab === 'history' && (
                            <div className="bg-white p-12 rounded-[32px] border border-gray-100 shadow-sm text-center">
                                <span className="material-icons text-6xl text-gray-200 mb-4">analytics</span>
                                <h3 className="text-xl font-bold text-gray-800">Branch History</h3>
                                <p className="text-gray-500 max-w-sm mx-auto mt-2">Historical view of patient check-ins and vital sign logs for the Kerala branch coming soon.</p>
                            </div>
                        )}
                    </div>
                </div>
            </main>

            {/* Custom Styles */}
            <style>{`
                .animate-fade-in {
                    animation: fadeIn 0.4s ease-out forwards;
                }
                .animate-fade-in-up {
                    animation: fadeInUp 0.5s ease-out forwards;
                }
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes fadeInUp {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
};

export default NurseDashboard;
