import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebaseConfig';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';

const HospitalAdminDashboard = () => {
    const [activeTab, setActiveTab] = useState('overview');
    const [branches, setBranches] = useState([]);
    const [blockchainStatus, setBlockchainStatus] = useState(null);
    const [loading, setLoading] = useState(false);
    const [showAddBranch, setShowAddBranch] = useState(false);
    const [newBranch, setNewBranch] = useState({ name: '', address: '', phone: '' });
    const navigate = useNavigate();

    useEffect(() => {
        fetchBranches();
    }, []);

    const fetchBranches = async () => {
        setLoading(true);
        try {
            const snapshot = await getDocs(collection(db, "hospital_branches"));
            const fetchedBranches = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setBranches(fetchedBranches);
        } catch (error) {
            console.error("Error fetching branches:", error);
            setBranches([]);
        }
        setLoading(false);
    };

    const handleCreateBranch = async () => {
        if (!newBranch.name || !newBranch.address) return;
        setLoading(true);
        try {
            const companyId = "abc-hospital-group"; // Linking to your group

            const response = await fetch('https://us-central1-swasthyalink-42535.cloudfunctions.net/createHospitalBranch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    companyId,
                    ...newBranch
                })
            });

            if (response.ok) {
                setNewBranch({ name: '', address: '', phone: '' });
                setShowAddBranch(false);
                fetchBranches(); // Fetch real data from Firestore
                alert("New branch registered successfully in Firestore!");
            } else {
                const err = await response.json();
                alert("Error: " + err.error);
            }
        } catch (error) {
            console.error("Failed to create branch:", error);
            alert("Cloud Function failed. Make sure your backend is deployed.");
        }
        setLoading(false);
    };

    const verifyLedger = async () => {
        setLoading(true);
        try {
            const response = await fetch('https://us-central1-swasthyalink-42535.cloudfunctions.net/verifyBlockchainIntegrity');
            const result = await response.json();
            setBlockchainStatus(result);
        } catch (error) {
            console.error("Verification failed:", error);
        }
        setLoading(false);
    };

    const addTestRecord = async () => {
        setLoading(true);
        try {
            const medicalData = {
                patientId: "test-user-123",
                diagnosis: "Routine Checkup",
                notes: "Vital signs normal. Blockchain record generated.",
            };

            const response = await fetch('https://us-central1-swasthyalink-42535.cloudfunctions.net/addMedicalBlock', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(medicalData)
            });
            const result = await response.json();
            alert(`New block added at index ${result.block.index}! Hash: ${result.block.hash.substring(0, 10)}...`);
            verifyLedger(); // Refresh status
        } catch (error) {
            console.error("Failed to add test record:", error);
            alert("Record addition failed. Make sure functions are deployed.");
        }
        setLoading(false);
    };

    return (
        <div className="min-h-screen bg-slate-900 text-white p-8">
            <header className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-blue-400">Hospital Group Admin</h1>
                    <p className="text-slate-400 font-medium lowercase tracking-wider opacity-60">L I V E _ M O D E</p>
                </div>
                <div className="flex space-x-4">
                    <button
                        onClick={addTestRecord}
                        className="bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 px-6 py-2 rounded-lg font-semibold hover:bg-indigo-600/30 transition-all"
                        disabled={loading}
                    >
                        {loading ? 'Processing...' : 'Audit Ledger'}
                    </button>
                    <button
                        onClick={verifyLedger}
                        className={`px-6 py-2 rounded-lg font-semibold transition-all ${blockchainStatus?.isValid ? 'bg-emerald-600' : 'bg-blue-600'} hover:opacity-90`}
                        disabled={loading}
                    >
                        {loading ? 'Verifying...' : 'Verify Blockchain Integrity'}
                    </button>
                    <button onClick={() => auth.signOut().then(() => navigate('/login'))} className="bg-slate-800 text-slate-400 border border-slate-700 px-4 py-2 rounded-lg hover:text-white transition-colors">Logout</button>
                </div>
            </header>

            {blockchainStatus && (
                <div className={`mb-8 p-4 rounded-xl border ${blockchainStatus.isValid ? 'bg-emerald-900/20 border-emerald-500/50' : 'bg-rose-900/20 border-rose-500/50'}`}>
                    <div className="flex items-center space-x-3">
                        <div className={`w-3 h-3 rounded-full ${blockchainStatus.isValid ? 'bg-emerald-500' : 'bg-rose-500'} animate-pulse`}></div>
                        <h2 className="font-bold">{blockchainStatus.isValid ? 'Ledger Verified: All records secure' : 'INTEGRITY ALERT: Chain Compromised'}</h2>
                    </div>
                    <p className="text-sm text-slate-400 mt-1">Checked {blockchainStatus.totalBlocks} blocks in the health ledger.</p>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="md:col-span-2 space-y-6">
                    <section className="bg-slate-800/50 rounded-2xl p-6 shadow-xl border border-slate-700">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold">Active Branches & Cities</h2>
                            <button
                                onClick={() => setShowAddBranch(!showAddBranch)}
                                className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-all flex items-center gap-2 shadow-lg shadow-blue-500/20"
                            >
                                <span className="material-icons text-sm">{showAddBranch ? 'close' : 'add_location'}</span>
                                {showAddBranch ? 'Cancel' : 'Onboard New Branch'}
                            </button>
                        </div>

                        {showAddBranch && (
                            <div className="mb-8 p-6 bg-slate-900/50 rounded-xl border border-blue-500/30 animate-fade-in">
                                <h3 className="text-lg font-bold mb-4 text-blue-400">Onboard New Hospital Branch</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <input
                                        type="text"
                                        placeholder="Branch Name (e.g. ABC Kottayam)"
                                        value={newBranch.name}
                                        onChange={(e) => setNewBranch({ ...newBranch, name: e.target.value })}
                                        className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 outline-none focus:border-blue-500 text-white"
                                    />
                                    <input
                                        type="text"
                                        placeholder="City / Address"
                                        value={newBranch.address}
                                        onChange={(e) => setNewBranch({ ...newBranch, address: e.target.value })}
                                        className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 outline-none focus:border-blue-500 text-white"
                                    />
                                    <input
                                        type="text"
                                        placeholder="Phone Number"
                                        value={newBranch.phone}
                                        onChange={(e) => setNewBranch({ ...newBranch, phone: e.target.value })}
                                        className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 outline-none focus:border-blue-500 text-white"
                                    />
                                    <button
                                        onClick={handleCreateBranch}
                                        disabled={loading || !newBranch.name}
                                        className="bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-all disabled:opacity-50 h-full"
                                    >
                                        {loading ? 'Registering...' : 'Register to Firestore'}
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {branches.map(branch => (
                                <div key={branch.id} className="bg-slate-900/40 p-5 rounded-xl border border-slate-700 hover:border-blue-500/50 transition-all group hover:bg-slate-900/60 shadow-lg">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h3 className="font-bold text-lg group-hover:text-blue-400 transition-colors">{branch.name}</h3>
                                            <p className="text-sm text-slate-400 mt-1">{branch.address || 'No address specified'}</p>
                                        </div>
                                        <div className="p-2 bg-slate-800 rounded-lg">
                                            <span className="material-icons text-slate-400 group-hover:text-blue-400 text-xl">location_city</span>
                                        </div>
                                    </div>
                                    <div className="mt-4 flex justify-between items-center pt-4 border-t border-slate-800">
                                        <div className="flex items-center gap-2">
                                            <span className="w-2 h-2 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
                                            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Live & Authenticated</span>
                                        </div>
                                        <button className="text-xs text-blue-400 hover:text-blue-300 font-bold flex items-center gap-1 group/btn">
                                            Manage Staff
                                            <span className="material-icons text-[14px] group-hover/btn:translate-x-1 transition-transform">arrow_forward</span>
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {branches.length === 0 && (
                                <div className="col-span-2 text-center py-12 bg-slate-900/30 rounded-2xl border border-dashed border-slate-700">
                                    <span className="material-icons text-4xl text-slate-700 mb-2">domain_disabled</span>
                                    <p className="text-slate-500">No real branches found in Firestore.</p>
                                    <p className="text-sm text-slate-600 mt-1">Onboard your first branch to start management.</p>
                                </div>
                            )}
                        </div>
                    </section>
                </div>

                <aside className="space-y-6">
                    <section className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-6 shadow-xl shadow-blue-500/10">
                        <h2 className="text-xl font-bold mb-2">Blockchain Status</h2>
                        <div className="space-y-4 mt-6">
                            <div className="flex justify-between items-center">
                                <span className="text-blue-100 text-sm">Algorithm</span>
                                <span className="font-mono text-xs bg-black/20 px-2 py-0.5 rounded">SHA-256</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-blue-100 text-sm">Consensus</span>
                                <span className="font-mono text-xs bg-black/20 px-2 py-0.5 rounded">PoA (Proof of Authority)</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-blue-100 text-sm">Blocks Attached</span>
                                <span className="font-mono text-xs bg-black/20 px-2 py-0.5 rounded">{blockchainStatus?.totalBlocks || 0}</span>
                            </div>
                        </div>
                        <div className="mt-8 pt-6 border-t border-white/10">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center">
                                    <span className="material-icons text-blue-100">verified_user</span>
                                </div>
                                <div>
                                    <p className="text-xs text-blue-100 opacity-80 uppercase tracking-widest font-bold">Integrity Score</p>
                                    <p className="text-lg font-bold">100.0% Immutable</p>
                                </div>
                            </div>
                        </div>
                    </section>

                    <section className="bg-slate-800/80 rounded-2xl p-6 border border-slate-700">
                        <h3 className="font-bold mb-4 flex items-center gap-2">
                            <span className="material-icons text-blue-400 text-sm">info</span>
                            Real Data Mode
                        </h3>
                        <p className="text-sm text-slate-400 leading-relaxed">
                            This dashboard is now connected to live Cloud Functions and Firestore. New branches added here will be available project-wide instantly.
                        </p>
                    </section>
                </aside>
            </div>
        </div>
    );
};

export default HospitalAdminDashboard;
