import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebaseConfig';
import { collection, query, where, getDocs, doc, updateDoc, addDoc, onSnapshot, orderBy } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';

const PharmacyDashboard = () => {
    const [activeTab, setActiveTab] = useState('inventory');
    const [inventory, setInventory] = useState([]);
    const [prescriptions, setPrescriptions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAddMedicine, setShowAddMedicine] = useState(false);
    const [newMedicine, setNewMedicine] = useState({ name: '', stock: 0, price: 0, category: 'General' });
    const { user, branchId } = useAuth();
    const navigate = useNavigate();

    // Mock category list
    const categories = ['General', 'Antibiotics', 'Painkillers', 'Vitamins', 'Cardiac', 'Diabetic'];

    useEffect(() => {
        if (!user) return;

        // 1. Listen for Inventory
        const inventoryQuery = query(
            collection(db, "pharmacy"),
            where("branchId", "==", branchId || "kottayam-001")
        );
        const unsubscribeInventory = onSnapshot(inventoryQuery, (snapshot) => {
            const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setInventory(items);
            setLoading(false);
        });

        // 2. Listen for Pending Prescriptions
        const prescriptionsQuery = query(
            collection(db, "prescriptions"),
            where("branchId", "==", branchId || "kottayam-001"),
            where("status", "in", ["pending", "ready"]),
            orderBy("createdAt", "desc")
        );
        const unsubscribePrescriptions = onSnapshot(prescriptionsQuery, (snapshot) => {
            const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setPrescriptions(items);
        });

        return () => {
            unsubscribeInventory();
            unsubscribePrescriptions();
        };
    }, [user, branchId]);

    const handleAddMedicine = async (e) => {
        e.preventDefault();
        try {
            await addDoc(collection(db, "pharmacy"), {
                ...newMedicine,
                branchId: branchId || "kottayam-001",
                companyId: "abc-hospital-group",
                stock: parseInt(newMedicine.stock),
                price: parseFloat(newMedicine.price),
                updatedAt: new Date().toISOString()
            });
            setNewMedicine({ name: '', stock: 0, price: 0, category: 'General' });
            setShowAddMedicine(false);
        } catch (error) {
            console.error("Error adding medicine:", error);
        }
    };

    const handleDispense = async (prescriptionId) => {
        try {
            const docRef = doc(db, "prescriptions", prescriptionId);
            await updateDoc(docRef, {
                status: 'dispensed',
                dispensedAt: new Date().toISOString(),
                dispensedBy: user.uid
            });

            // Simulate blockchain log
            await addDoc(collection(db, "health_ledger"), {
                type: 'PHARMACY_DISPENSE',
                prescriptionId,
                branchId: branchId || "kottayam-001",
                timestamp: new Date().toISOString(),
                data: { status: 'dispensed' }
            });

            alert("Prescription marked as dispensed and logged to blockchain ledger!");
        } catch (error) {
            console.error("Error dispensing:", error);
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 text-white flex">
            {/* Sidebar */}
            <aside className="w-64 bg-slate-800 border-r border-slate-700 p-6 flex flex-col">
                <div className="flex items-center gap-3 mb-10">
                    <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
                        <span className="material-icons text-white">medication</span>
                    </div>
                    <div>
                        <h2 className="font-bold text-lg">Pharmacy</h2>
                        <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest">Branch Access</p>
                    </div>
                </div>

                <nav className="flex-1 space-y-2">
                    <button
                        onClick={() => setActiveTab('inventory')}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'inventory' ? 'bg-emerald-600 shadow-lg shadow-emerald-500/20' : 'hover:bg-slate-700 text-slate-400'}`}
                    >
                        <span className="material-icons text-sm">inventory_2</span>
                        <span className="font-medium">Inventory</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('orders')}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'orders' ? 'bg-emerald-600 shadow-lg shadow-emerald-500/20' : 'hover:bg-slate-700 text-slate-400'}`}
                    >
                        <span className="material-icons text-sm">list_alt</span>
                        <span className="font-medium">Prescriptions</span>
                        {prescriptions.length > 0 && (
                            <span className="ml-auto bg-white text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                {prescriptions.length}
                            </span>
                        )}
                    </button>
                </nav>

                <button
                    onClick={() => auth.signOut().then(() => navigate('/login'))}
                    className="mt-auto flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:text-white hover:bg-slate-700/50 transition-all"
                >
                    <span className="material-icons text-sm">logout</span>
                    <span className="font-medium">Logout</span>
                </button>
            </aside>

            {/* Main Content */}
            <main className="flex-1 p-8 overflow-y-auto">
                <header className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-2xl font-bold">{activeTab === 'inventory' ? 'Medicine Inventory' : 'Prescription Queue'}</h1>
                        <p className="text-slate-400 text-sm mt-1">Status: <span className="text-emerald-400 font-bold">Online</span> • Kottayam Branch</p>
                    </div>
                    {activeTab === 'inventory' && (
                        <button
                            onClick={() => setShowAddMedicine(true)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2"
                        >
                            <span className="material-icons text-sm">add</span>
                            Add Medicine
                        </button>
                    )}
                </header>

                {activeTab === 'inventory' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {inventory.map(item => (
                            <div key={item.id} className="bg-slate-800/50 border border-slate-700 p-6 rounded-2xl hover:border-emerald-500/30 transition-all group">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="p-3 bg-slate-900 rounded-xl">
                                        <span className="material-icons text-emerald-400">pill</span>
                                    </div>
                                    <span className="text-xs font-bold bg-slate-900 px-3 py-1 rounded-full text-slate-400 uppercase tracking-tighter">{item.category}</span>
                                </div>
                                <h3 className="font-bold text-lg mb-1">{item.name}</h3>
                                <div className="flex justify-between items-center mt-6">
                                    <div>
                                        <p className="text-[10px] text-slate-500 uppercase font-bold">Stock Level</p>
                                        <p className={`text-xl font-black ${item.stock < 10 ? 'text-rose-400' : 'text-white'}`}>{item.stock} <span className="text-xs font-normal text-slate-500">units</span></p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] text-slate-500 uppercase font-bold">Unit Price</p>
                                        <p className="text-xl font-black text-emerald-400">₹{item.price}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {inventory.length === 0 && (
                            <div className="col-span-full py-20 text-center border-2 border-dashed border-slate-800 rounded-3xl">
                                <span className="material-icons text-5xl text-slate-700 mb-4">inventory</span>
                                <p className="text-slate-500 font-medium">No inventory data found for this branch.</p>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="space-y-4">
                        {prescriptions.map(order => (
                            <div key={order.id} className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 flex items-center gap-6 hover:bg-slate-800 transition-all">
                                <div className="w-12 h-12 bg-indigo-500/10 rounded-xl flex items-center justify-center">
                                    <span className="material-icons text-indigo-400">description</span>
                                </div>
                                <div className="flex-1">
                                    <h4 className="font-bold text-lg">Patient ID: {order.patientId?.substring(0, 8)}...</h4>
                                    <p className="text-sm text-slate-400">Doctor ID: {order.doctorId?.substring(0, 8)}... • {new Date(order.createdAt).toLocaleTimeString()}</p>
                                </div>
                                <div className="flex flex-wrap gap-2 max-w-sm">
                                    {order.medicines?.map((med, idx) => (
                                        <span key={idx} className="bg-slate-900 border border-slate-700 px-3 py-1 rounded-lg text-xs font-medium text-indigo-300">
                                            {med.name}
                                        </span>
                                    ))}
                                </div>
                                <button
                                    onClick={() => handleDispense(order.id)}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-xl font-bold transition-all"
                                >
                                    Dispense
                                </button>
                            </div>
                        ))}
                        {prescriptions.length === 0 && (
                            <div className="py-20 text-center border-2 border-dashed border-slate-800 rounded-3xl">
                                <span className="material-icons text-5xl text-slate-700 mb-4">task_alt</span>
                                <p className="text-slate-500 font-medium">All orders cleared. No pending prescriptions.</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Add Medicine Modal */}
                {showAddMedicine && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                        <div className="bg-slate-800 border border-slate-700 w-full max-w-md rounded-3xl p-8 shadow-2xl animate-scale-in">
                            <h2 className="text-2xl font-bold mb-6">Stock Entry</h2>
                            <form onSubmit={handleAddMedicine} className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase mb-2 block ml-1">Medicine Name</label>
                                    <input
                                        required
                                        type="text"
                                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 outline-none focus:border-emerald-500 transition-all"
                                        placeholder="e.g. Paracetamol 500mg"
                                        value={newMedicine.name}
                                        onChange={e => setNewMedicine({ ...newMedicine, name: e.target.value })}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase mb-2 block ml-1">Quantity</label>
                                        <input
                                            required
                                            type="number"
                                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 outline-none focus:border-emerald-500 transition-all"
                                            value={newMedicine.stock}
                                            onChange={e => setNewMedicine({ ...newMedicine, stock: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase mb-2 block ml-1">Price per unit</label>
                                        <input
                                            required
                                            type="number"
                                            step="0.01"
                                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 outline-none focus:border-emerald-500 transition-all"
                                            value={newMedicine.price}
                                            onChange={e => setNewMedicine({ ...newMedicine, price: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase mb-2 block ml-1">Category</label>
                                    <select
                                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 outline-none focus:border-emerald-500 transition-all"
                                        value={newMedicine.category}
                                        onChange={e => setNewMedicine({ ...newMedicine, category: e.target.value })}
                                    >
                                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                                <div className="flex gap-4 mt-8">
                                    <button
                                        type="button"
                                        onClick={() => setShowAddMedicine(false)}
                                        className="flex-1 px-4 py-3 rounded-xl font-bold border border-slate-700 hover:bg-slate-700 transition-all"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 px-4 py-3 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-500/20"
                                    >
                                        Save Item
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default PharmacyDashboard;
