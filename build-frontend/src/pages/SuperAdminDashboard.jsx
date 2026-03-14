import React, { useState, useEffect } from "react";
import { db } from "../firebaseConfig";
import { collection, getDocs, addDoc, query, orderBy } from "firebase/firestore";
import { useAuth } from "../contexts/AuthContext";

const SuperAdminDashboard = () => {
    const { currentUser } = useAuth();
    const [branches, setBranches] = useState([]);
    const [ledger, setLedger] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAddBranch, setShowAddBranch] = useState(false);
    const [newBranch, setNewBranch] = useState({ name: "", address: "", phone: "" });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const branchesSnap = await getDocs(collection(db, "hospital_branches"));
            setBranches(branchesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

            const ledgerSnap = await getDocs(query(collection(db, "health_ledger"), orderBy("index", "desc")));
            setLedger(ledgerSnap.docs.map(doc => doc.data()));
        } catch (error) {
            console.error("Error fetching super admin data:", error);
        }
        setLoading(false);
    };

    const handleAddBranch = async (e) => {
        e.preventDefault();
        // In a real app, this would call the Cloud Function
        // For now, we simulate or call the API if available
        alert("Branch creation functionality would call the 'createHospitalBranch' Cloud Function with blockchain anchoring.");
        setShowAddBranch(false);
    };

    return (
        <div className="min-h-screen bg-slate-50 p-8">
            <div className="max-w-7xl mx-auto">
                <header className="mb-8 flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900">Swasthyalink Group Dashboard</h1>
                        <p className="text-slate-600">Super Admin: {currentUser?.name || "Administrator"}</p>
                    </div>
                    <button
                        onClick={() => setShowAddBranch(true)}
                        className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition"
                    >
                        Add New Branch
                    </button>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Branches List */}
                    <div className="lg:col-span-2 space-y-6">
                        <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
                                <h2 className="font-semibold text-slate-800">Hospital Branches</h2>
                            </div>
                            <div className="divide-y divide-slate-200">
                                {branches.map(branch => (
                                    <div key={branch.id} className="p-6 hover:bg-slate-50 transition">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <h3 className="text-lg font-bold text-slate-900">{branch.name}</h3>
                                                <p className="text-slate-500 text-sm">{branch.address}</p>
                                                <p className="text-slate-500 text-sm">{branch.phone}</p>
                                            </div>
                                            <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full font-medium">
                                                Active
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    </div>

                    {/* Blockchain Ledger */}
                    <div className="space-y-6">
                        <section className="bg-slate-900 rounded-xl shadow-xl text-white overflow-hidden">
                            <div className="px-6 py-4 border-b border-slate-800 flex items-center gap-2">
                                <span className="material-icons text-blue-400">account_balance_wallet</span>
                                <h2 className="font-semibold">Blockchain Health Ledger</h2>
                            </div>
                            <div className="p-4 max-h-[600px] overflow-y-auto space-y-4 font-mono text-xs">
                                {ledger.map(block => (
                                    <div key={block.index} className="bg-slate-800 p-3 rounded border border-slate-700">
                                        <div className="flex justify-between text-blue-400 mb-1">
                                            <span>BLOCK #{block.index}</span>
                                            <span>{new Date(block.timestamp).toLocaleTimeString()}</span>
                                        </div>
                                        <div className="truncate text-slate-400">PREV: {block.previousHash.substring(0, 16)}...</div>
                                        <div className="truncate text-green-400">HASH: {block.hash.substring(0, 16)}...</div>
                                        <div className="mt-2 text-slate-300">
                                            DATA: {JSON.stringify(block.data)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    </div>
                </div>
            </div>

            {showAddBranch && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl">
                        <h2 className="text-2xl font-bold mb-6">Create New Branch</h2>
                        <form onSubmit={handleAddBranch} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Branch Name</label>
                                <input
                                    type="text"
                                    className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                                    placeholder="e.g. Swasthyalink Kochi"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
                                <input
                                    type="text"
                                    className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                                    placeholder="City, State"
                                />
                            </div>
                            <div className="flex gap-4 mt-8">
                                <button
                                    type="button"
                                    onClick={() => setShowAddBranch(false)}
                                    className="flex-1 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                                >
                                    Create & Anchor
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SuperAdminDashboard;
