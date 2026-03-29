import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebaseConfig';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, addDoc, onSnapshot, orderBy } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import toast, { Toaster } from 'react-hot-toast';

const PharmacyDashboard = () => {
    const [activeTab, setActiveTab] = useState('inventory');
    const [inventory, setInventory] = useState([]);
    const [prescriptions, setPrescriptions] = useState([]);
    const [allMedicineNames, setAllMedicineNames] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAddMedicine, setShowAddMedicine] = useState(false);
    const [newMedicine, setNewMedicine] = useState({ name: '', stock: 0, price: 0, category: 'General', type: 'Tablet' });
    const [branchName, setBranchName] = useState('Kottayam Branch'); // Default fallback
    const [filteredSuggestions, setFilteredSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [errors, setErrors] = useState({ stock: '', price: '' });
    const { currentUser, branchId, logout } = useAuth();
    const navigate = useNavigate();

    // Comprehensive Medicine Master Data
    const MEDICINE_DATA = [
        { name: "Paracetamol", type: "Tablet", category: "Painkillers" },
        { name: "Amoxicillin", type: "Capsule", category: "Antibiotics" },
        { name: "Cetirizine", type: "Tablet", category: "Allergy" },
        { name: "Ibuprofen", type: "Tablet", category: "Painkillers" },
        { name: "Metformin", type: "Tablet", category: "Diabetic" },
        { name: "Atorvastatin", type: "Tablet", category: "Cardiac" },
        { name: "Amlodipine", type: "Tablet", category: "Cardiac" },
        { name: "Azithromycin", type: "Tablet", category: "Antibiotics" },
        { name: "Omeprazole", type: "Capsule", category: "Gastro" },
        { name: "Pantoprazole", type: "Tablet", category: "Gastro" },
        { name: "Telmisartan", type: "Tablet", category: "Cardiac" },
        { name: "Losartan", type: "Tablet", category: "Cardiac" },
        { name: "Glimenpiride", type: "Tablet", category: "Diabetic" },
        { name: "Vildagliptin", type: "Tablet", category: "Diabetic" },
        { name: "Ciprofloxacin", type: "Tablet", category: "Antibiotics" },
        { name: "Ceftriaxone", type: "Injection", category: "Antibiotics" },
        { name: "Meropenem", type: "Injection", category: "Antibiotics" },
        { name: "Dexona", type: "Injection", category: "Steroids" },
        { name: "Hydrocortisone", type: "Injection", category: "Steroids" },
        { name: "Pantocid", type: "Injection", category: "Gastro" },
        { name: "Zintac", type: "Injection", category: "Gastro" },
        { name: "Insulin Glargine", type: "Injection", category: "Diabetic" },
        { name: "Insulin Aspart", type: "Injection", category: "Diabetic" },
        { name: "Digoxin", type: "Tablet", category: "Cardiac" },
        { name: "Warfarin", type: "Tablet", category: "Cardiac" },
        { name: "Clopidogrel", type: "Tablet", category: "Cardiac" },
        { name: "Aspirin", type: "Tablet", category: "Cardiac" },
        { name: "Diclofenac", type: "Tablet", category: "Painkillers" },
        { name: "Tramadol", type: "Tablet", category: "Painkillers" },
        { name: "Salbutamol", type: "Inhaler", category: "Respiratory" },
        { name: "Fluticasone", type: "Inhaler", category: "Respiratory" },
        { name: "Montelukast", type: "Tablet", category: "Respiratory" },
        { name: "Levocetirizine", type: "Tablet", category: "Allergy" },
        { name: "Fexofenadine", type: "Tablet", category: "Allergy" },
        { name: "Multivitamin", type: "Tablet", category: "Vitamins" },
        { name: "Calcium Carbonate", type: "Tablet", category: "Vitamins" },
        { name: "Vitamin D3", type: "Drops", category: "Vitamins" },
        { name: "B-Complex", type: "Syrup", category: "Vitamins" },
        { name: "Iron Supplement", type: "Syrup", category: "Vitamins" },
        { name: "Lactulose", type: "Syrup", category: "Gastro" },
        { name: "Gelusil", type: "Syrup", category: "Gastro" },
        { name: "Digene", type: "Syrup", category: "Gastro" },
        { name: "Cough Syrup", type: "Syrup", category: "General" },
        { name: "ORS", type: "Sachet", category: "General" },
        { name: "Electral", type: "Sachet", category: "General" }
    ];

    // Medicine Types for selection
    const MEDICINE_TYPES = ['Tablet', 'Capsule', 'Syrup', 'Injection', 'Inhaler', 'Drops', 'Sachet', 'Ointment', 'Gel'];

    // Updated category list
    const categories = ['General', 'Antibiotics', 'Painkillers', 'Vitamins', 'Cardiac', 'Diabetic', 'Allergy', 'Gastro', 'Respiratory', 'Steroids'];

    useEffect(() => {
        if (!currentUser) return;

        const effectiveBranchId = branchId || "kottayam-001";
        console.log("🕵️ PharmacyDashboard: Using branchId:", effectiveBranchId);

        // 1. Listen for Inventory
        const inventoryQuery = query(
            collection(db, "pharmacy"),
            where("branchId", "==", effectiveBranchId)
        );
        const unsubscribeInventory = onSnapshot(inventoryQuery, (snapshot) => {
            const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            console.log("🕵️ PharmacyDashboard: Inventory items fetched:", items.length);
            setInventory(items);
            setLoading(false);
        });

        // 2. Listen for Pending Prescriptions (Simplified to only filter by branch to avoid index errors)
        const prescriptionsQuery = query(
            collection(db, "prescriptions"),
            where("branchId", "==", effectiveBranchId)
        );
        const unsubscribePrescriptions = onSnapshot(prescriptionsQuery, (snapshot) => {
            const items = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .filter(item => ["pending", "ready"].includes(item.status))
                .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
            setPrescriptions(items);
        }, (error) => {
            console.error("🕵️ Error in prescriptions listener:", error);
        });

        // 3. Fetch Branch Name
        const fetchBranchInfo = async () => {
            if (!branchId) return;
            try {
                const branchDoc = await getDoc(doc(db, "hospital_branches", branchId));
                if (branchDoc.exists()) {
                    setBranchName(branchDoc.data().name || "Unknown Branch");
                }
            } catch (error) {
                console.error("Error fetching branch name:", error);
            }
        };

        // 4. Fetch Global Medicine List for Autocomplete
        const fetchMedicines = async () => {
            try {
                const snapshot = await getDocs(collection(db, "pharmacy"));
                const names = [...new Set(snapshot.docs.map(doc => doc.data().name))];
                if (typeof setAllMedicineNames === 'function') {
                    setAllMedicineNames(names.sort());
                }
            } catch (error) {
                console.error("Error fetching medicine list:", error);
            }
        };

        fetchBranchInfo();
        fetchMedicines();

        return () => {
            unsubscribeInventory();
            unsubscribePrescriptions();
        };
    }, [currentUser, branchId]);

    // Group inventory by name and type to prevent duplicate cards
    const groupedInventory = inventory.reduce((acc, item) => {
        // Create a unique key for grouping
        const key = `${item.name}-${item.type}`.toLowerCase().trim();
        if (!acc[key]) {
            acc[key] = { ...item, stock: 0 };
        }
        acc[key].stock += parseInt(item.stock || 0);
        
        // Keep the latest price and metadata
        if (!acc[key].updatedAt || new Date(item.updatedAt) > new Date(acc[key].updatedAt)) {
            acc[key].price = item.price;
            acc[key].category = item.category;
            acc[key].updatedAt = item.updatedAt;
        }
        return acc;
    }, {});
    const sortedInventory = Object.values(groupedInventory).sort((a, b) => a.name.localeCompare(b.name));

    // Real-time Dashboard Stats
    const stats = useMemo(() => {
        const totalItems = sortedInventory.length;
        const totalUnits = sortedInventory.reduce((sum, item) => sum + item.stock, 0);
        const lowStock = sortedInventory.filter(item => item.stock < 10).length;
        const totalVal = sortedInventory.reduce((sum, item) => sum + (item.stock * item.price), 0);
        const pendingRx = prescriptions.length;

        return { totalItems, totalUnits, lowStock, totalVal, pendingRx };
    }, [sortedInventory, prescriptions]);

    // Chart Data Generation (Stock by Category)
    const chartData = useMemo(() => {
        return categories.map(cat => ({
            name: cat,
            stock: sortedInventory.filter(item => item.category === cat).reduce((sum, item) => sum + item.stock, 0)
        })).filter(d => d.stock > 0);
    }, [sortedInventory, categories]);

    const handleAddMedicine = async (e) => {
        e.preventDefault();
        if (newMedicine.name.trim() === '') {
            toast.error("Medicine name is required.");
            return;
        }
        if (parseFloat(newMedicine.stock) <= 0 || isNaN(newMedicine.stock)) {
            toast.error("Invalid stock quantity.");
            return;
        }
        if (parseFloat(newMedicine.price) <= 0 || isNaN(newMedicine.price)) {
            toast.error("Invalid unit price.");
            return;
        }

        const loadingToast = toast.loading("Recording stock entry...");

        try {
            const effectiveBranchId = branchId || "kottayam-001";
            const stockData = {
                ...newMedicine,
                branchId: effectiveBranchId,
                branchName: branchName,
                companyId: "abc-hospital-group",
                stock: parseInt(newMedicine.stock),
                price: parseFloat(newMedicine.price),
                updatedAt: new Date().toISOString()
            };

            await addDoc(collection(db, "pharmacy"), stockData);

            await addDoc(collection(db, "health_ledger"), {
                branchId: effectiveBranchId,
                type: 'PHARMACY_STOCK_ENTRY',
                timestamp: new Date().toISOString(),
                data: { ...stockData }
            });

            setNewMedicine({ name: '', stock: 0, price: 0, category: 'General', type: 'Tablet' });
            setShowAddMedicine(false);
            toast.success("Stock recorded and anchored to blockchain!", { id: loadingToast });
        } catch (error) {
            console.error("Error adding stock:", error);
            toast.error("Failed to record entry.", { id: loadingToast });
        }
    };

    const validateStock = (val) => {
        if (val === '') return '';
        const num = parseFloat(val);
        if (isNaN(num)) return 'Must be a number';
        if (num <= 0) return 'Must be greater than 0';
        return '';
    };

    const validatePrice = (val) => {
        if (val === '') return '';
        const num = parseFloat(val);
        if (isNaN(num)) return 'Must be a valid price';
        if (num <= 0) return 'Price must be positive';
        return '';
    };

    const handleMedicineChange = (e) => {
        const val = e.target.value;
        setNewMedicine({ ...newMedicine, name: val });
        
        if (val.trim().length < 2) {
            setFilteredSuggestions([]);
            setShowSuggestions(false);
            return;
        }

        const searchVal = val.toLowerCase();
        const filtered = MEDICINE_DATA.filter(med => 
            med.name.toLowerCase().includes(searchVal) || 
            med.type.toLowerCase().includes(searchVal)
        ).slice(0, 10);

        setFilteredSuggestions(filtered);
        setShowSuggestions(filtered.length > 0);
    };

    const handleSelectSuggestion = (med) => {
        setNewMedicine({ 
            ...newMedicine, 
            name: med.name,
            type: med.type,
            category: med.category
        });
        setShowSuggestions(false);
    };

    const handleDispense = async (prescriptionId) => {
        try {
            const docRef = doc(db, "prescriptions", prescriptionId);
            await updateDoc(docRef, {
                status: 'dispensed',
                dispensedAt: new Date().toISOString(),
                dispensedBy: currentUser.uid
            });

            await addDoc(collection(db, "health_ledger"), {
                type: 'PHARMACY_DISPENSE',
                prescriptionId,
                branchId: branchId || "kottayam-001",
                timestamp: new Date().toISOString(),
                data: { status: 'dispensed' }
            });

            toast.success("Prescription dispensed!");
        } catch (error) {
            console.error("Error dispensing:", error);
            toast.error("Dispense failed.");
        }
    };

    return (
        <div className="h-screen bg-slate-900 text-white flex font-outfit overflow-hidden">
            <Toaster position="top-right" toastOptions={{
                duration: 4000,
                style: { background: '#0f172a', color: '#fff', border: '1px solid #1e293b' }
            }} />

            {/* Sidebar */}
            <aside className="w-80 h-full bg-slate-900 border-r border-slate-800 p-8 flex flex-col relative z-20">
                <div className="absolute top-[-10%] left-[-10%] w-40 h-40 bg-emerald-500/5 blur-[100px] rounded-full pointer-events-none" />
                
                <div className="flex items-center gap-4 mb-12 px-2 text-white">
                    <motion.div 
                        whileHover={{ rotate: 180 }}
                        className="w-12 h-12 bg-gradient-to-tr from-emerald-600 to-teal-400 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20"
                    >
                        <span className="material-icons text-white text-2xl">medication</span>
                    </motion.div>
                    <div>
                        <h2 className="font-black text-xl tracking-tight leading-none">Swasthya<span className="text-emerald-500">Link</span></h2>
                        <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-1">PHARMACY DASHBOARD</p>
                    </div>
                </div>

                <nav className="flex-1 space-y-3">
                    {[
                        { id: 'inventory', label: 'Dashboard', icon: 'dashboard', description: 'Inventory & Analytics' },
                        { id: 'orders', label: 'Prescriptions', icon: 'receipt_long', description: 'Patient' + (prescriptions.length > 0 ? ` (${prescriptions.length})` : '') }
                    ].map((item) => (
                        <motion.button
                            key={item.id}
                            whileHover={{ x: 5 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setActiveTab(item.id)}
                            className={`w-full group flex items-start gap-4 px-5 py-5 rounded-[2rem] transition-all relative ${
                                activeTab === item.id 
                                ? 'bg-emerald-600 text-white shadow-2xl shadow-emerald-500/30' 
                                : 'hover:bg-slate-800/50 text-slate-400'
                            }`}
                        >
                            <span className={`material-icons mt-0.5 ${activeTab === item.id ? 'text-white' : 'text-slate-500 group-hover:text-emerald-400'}`}>
                                {item.icon}
                            </span>
                            <div className="text-left">
                                <p className="font-black text-sm uppercase tracking-wide leading-none mb-1">{item.label}</p>
                                <p className={`text-[10px] font-bold opacity-60 ${activeTab === item.id ? 'text-emerald-100' : 'text-slate-500'}`}>{item.description}</p>
                            </div>
                        </motion.button>
                    ))}
                </nav>

                <div className="mt-auto space-y-4">
                    <button
                        onClick={async () => {
                            await logout();
                            navigate('/login');
                        }}
                        className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-2xl text-slate-500 hover:text-white hover:bg-rose-500/10 hover:border-rose-500/20 border border-transparent transition-all group"
                    >
                        <span className="material-icons text-sm group-hover:text-rose-400">logout</span>
                        <span className="font-black text-xs uppercase tracking-widest group-hover:text-rose-400">Sign Out</span>
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 p-12 overflow-y-auto bg-slate-950">
                <header className="flex justify-between items-end mb-10">
                    <div>
                        <h1 className="text-4xl font-black text-white tracking-tighter leading-none mb-2">
                           {activeTab === 'inventory' ? 'Medicine Inventory' : 'Prescription Queue'}
                        </h1>
                        <div className="flex items-center gap-4">
                            <span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-400 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-500/20">
                                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                                Live System
                            </span>
                            <span className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">{branchName}</span>
                        </div>
                    </div>
                    {activeTab === 'inventory' && (
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setShowAddMedicine(true)}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-4 rounded-2xl font-black transition-all shadow-xl shadow-emerald-500/20 flex items-center gap-3 border border-emerald-400/20"
                        >
                            <span className="material-icons text-lg">add_circle</span>
                            <span>ADD MEDICINE</span>
                        </motion.button>
                    )}
                </header>

                {/* Stat Bar */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
                    {[
                        { label: 'Total Units', value: stats.totalUnits.toLocaleString(), icon: 'inventory', color: 'emerald' },
                        { label: 'Low Stock', value: stats.lowStock, icon: 'warning', color: 'rose', alert: stats.lowStock > 0 },
                        { label: 'Pending RX', value: stats.pendingRx, icon: 'receipt_long', color: 'indigo' },
                        { label: 'Inv. Value', value: `₹${Math.round(stats.totalVal).toLocaleString()}`, icon: 'payments', color: 'amber' }
                    ].map((stat, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.1 }}
                            className="bg-slate-900/60 border border-slate-800 p-6 rounded-[2rem] hover:border-slate-700 transition-all backdrop-blur-xl group"
                        >
                            <div className={`p-3 bg-${stat.color}-500/10 rounded-2xl w-fit mb-4 group-hover:scale-110 transition-transform`}>
                                <span className={`material-icons text-${stat.color}-400`}>{stat.icon}</span>
                            </div>
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{stat.label}</p>
                            <h4 className={`text-3xl font-black ${stat.alert ? 'text-rose-400 animate-pulse' : 'text-white'}`}>{stat.value}</h4>
                        </motion.div>
                    ))}
                </div>

                {/* Analytics Section */}
                {activeTab === 'inventory' && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-slate-900/40 border border-slate-800 rounded-[2.5rem] p-8 mb-10 backdrop-blur-2xl"
                    >
                        <div className="flex justify-between items-center mb-8">
                            <div>
                                <h3 className="font-black text-xl text-white">Stock Analysis</h3>
                                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Units by Category</p>
                            </div>
                            <div className="flex gap-2">
                                <div className="flex items-center gap-2 px-3 py-1 bg-slate-800/50 rounded-lg text-[10px] font-bold text-slate-400">
                                    <span className="w-2 h-2 bg-emerald-500 rounded-full" /> Stock Level
                                </div>
                            </div>
                        </div>
                        <div className="h-[250px] w-full mt-4">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                    <XAxis 
                                        dataKey="name" 
                                        stroke="#64748b" 
                                        fontSize={10} 
                                        fontWeight={800} 
                                        tickLine={false} 
                                        axisLine={false}
                                        tick={{ fill: '#64748b' }}
                                    />
                                    <Tooltip 
                                        contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '16px', color: '#f8fafc' }}
                                        itemStyle={{ color: '#10b981', fontWeight: 800 }}
                                        cursor={{ fill: '#1e293b', radius: 8 }}
                                    />
                                    <Bar dataKey="stock" radius={[10, 10, 0, 0]}>
                                        {chartData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#10b981' : '#34d399'} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </motion.div>
                )}

                {/* Main Content Area with Transitions */}
                <AnimatePresence mode="wait">
                    {activeTab === 'inventory' ? (
                        <motion.div
                            key="inventory"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
                        >
                            {sortedInventory.map((item, index) => (
                                <motion.div 
                                    key={index}
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: index * 0.05 }}
                                    whileHover={{ y: -8, transition: { duration: 0.2 } }}
                                    className="bg-slate-900/40 border border-slate-800/80 p-8 rounded-[2.5rem] hover:border-emerald-500/40 transition-all group backdrop-blur-xl relative overflow-hidden"
                                >
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-[50px] rounded-full pointer-events-none" />
                                    
                                    <div className="flex justify-between items-start mb-6">
                                        <div className="p-4 bg-slate-950 rounded-[1.25rem] shadow-inner group-hover:scale-110 transition-transform">
                                            <span className="material-icons text-emerald-400 text-2xl">pill</span>
                                        </div>
                                        <span className="text-[10px] font-black bg-slate-950 border border-slate-800 px-4 py-1.5 rounded-full text-slate-400 uppercase tracking-widest">{item.category}</span>
                                    </div>

                                    <h3 className="font-black text-2xl mb-1 text-white tracking-tight">{item.name}</h3>
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-8">{item.type || 'Tablet'}</p>

                                    <div className="flex justify-between items-end bg-slate-950/40 p-5 rounded-3xl border border-slate-800/50">
                                        <div>
                                            <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1 leading-none">Stock Level</p>
                                            <p className={`text-2xl font-black ${item.stock < 10 ? 'text-rose-400' : 'text-white'}`}>
                                                {item.stock} <span className="text-[10px] font-bold text-slate-600 uppercase ml-1">units</span>
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1 leading-none">Unit Price</p>
                                            <p className="text-2xl font-black text-emerald-400 font-mono">₹{item.price}</p>
                                        </div>
                                    </div>

                                    {item.stock < 10 && (
                                        <div className="mt-4 flex items-center gap-2 text-rose-400 bg-rose-400/5 py-2 px-4 rounded-xl border border-rose-400/10">
                                            <span className="material-icons text-sm">warning</span>
                                            <span className="text-[10px] font-black uppercase tracking-[0.15em]">Low Stock Alert</span>
                                        </div>
                                    )}
                                </motion.div>
                            ))}
                            {sortedInventory.length === 0 && (
                                <div className="col-span-full py-32 text-center border-2 border-dashed border-slate-800 rounded-[3rem] backdrop-blur-sm bg-slate-900/10">
                                    <span className="material-icons text-6xl text-slate-800 mb-6">inventory</span>
                                    <p className="text-slate-500 font-black uppercase tracking-widest text-sm">Inventory Vault Empty</p>
                                </div>
                            )}
                        </motion.div>
                    ) : (
                        <motion.div
                            key="orders"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="space-y-6"
                        >
                            {prescriptions.map((order, idx) => (
                                <motion.div 
                                    key={order.id}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: idx * 0.1 }}
                                    className="bg-slate-900/40 border border-slate-800 rounded-[2.5rem] p-8 flex items-center gap-8 hover:bg-slate-900 transition-all backdrop-blur-2xl group relative overflow-hidden"
                                >
                                    <div className="absolute top-0 left-0 w-24 h-24 bg-indigo-500/5 blur-[40px] rounded-full pointer-events-none" />
                                    
                                    <div className="w-16 h-16 bg-indigo-500/10 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                                        <span className="material-icons text-indigo-400 text-3xl">description</span>
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mb-1">Patient Name</p>
                                        <h4 className="font-black text-2xl text-white mb-2">{order.patientName || 'Emergency Case'}</h4>
                                        <div className="flex items-center gap-3">
                                            <span className="px-3 py-1 bg-slate-950 rounded-full text-[10px] font-black text-emerald-400 uppercase tracking-widest border border-slate-800">{order.medication}</span>
                                            <span className="text-xs text-slate-500 font-medium">Qty: {order.dosage}</span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-2">Priority Status</p>
                                        <span className="px-5 py-2 bg-indigo-500/10 text-indigo-400 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-indigo-500/20">
                                            {order.status}
                                        </span>
                                    </div>
                                    <motion.button
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={() => handleDispense(order.id)}
                                        className="bg-indigo-600 hover:bg-indigo-500 text-white px-10 py-5 rounded-3xl font-black uppercase text-xs tracking-widest shadow-2xl shadow-indigo-500/20 transition-all border border-indigo-400/20"
                                    >
                                        Dispense Now
                                    </motion.button>
                                </motion.div>
                            ))}
                            {prescriptions.length === 0 && (
                                <div className="py-32 text-center border-2 border-dashed border-slate-800 rounded-[3rem] backdrop-blur-sm bg-slate-900/10">
                                    <motion.span 
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        className="material-icons text-7xl text-emerald-500/20 mb-6"
                                    >
                                        check_circle
                                    </motion.span>
                                    <p className="text-slate-500 font-black uppercase tracking-widest text-sm">All Orders Completed</p>
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Add Medicine Modal */}
                <AnimatePresence>
                    {showAddMedicine && (
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl flex items-center justify-center p-6 z-[100]"
                        >
                            <motion.div 
                                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                                animate={{ scale: 1, opacity: 1, y: 0 }}
                                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                                className="bg-slate-900/80 border border-slate-800 w-full max-w-xl rounded-[3rem] p-12 shadow-[0_0_100px_rgba(16,185,129,0.05)] relative overflow-hidden"
                            >
                                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-emerald-500 to-transparent opacity-50" />
                                
                                <div className="flex justify-between items-center mb-10">
                                    <div>
                                        <h2 className="text-4xl font-black text-white tracking-tight">Stock Entry</h2>
                                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em] mt-2">Inventory Management</p>
                                    </div>
                                    <button 
                                        onClick={() => setShowAddMedicine(false)}
                                        className="p-3 hover:bg-slate-800 rounded-2xl transition-colors text-slate-500 hover:text-white"
                                    >
                                        <span className="material-icons">close</span>
                                    </button>
                                </div>

                                <form onSubmit={handleAddMedicine} className="space-y-8">
                                    <div className="space-y-6">
                                        <div className="relative group">
                                            <label className="text-[10px] font-black text-slate-500 uppercase mb-3 block ml-2 tracking-widest">Medicine Designation</label>
                                            <div className="relative">
                                                <span className="material-icons absolute left-5 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-emerald-400 transition-colors">search</span>
                                                <input
                                                    required
                                                    type="text"
                                                    className="w-full bg-slate-950/50 border border-slate-800 rounded-3xl pl-14 pr-6 py-5 outline-none focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/5 transition-all text-white font-bold placeholder:text-slate-700"
                                                    placeholder="Search or enter name..."
                                                    value={newMedicine.name}
                                                    onChange={handleMedicineChange}
                                                    onFocus={() => { if (filteredSuggestions.length > 0) setShowSuggestions(true); }}
                                                />
                                            </div>
                                            
                                            <AnimatePresence>
                                                {showSuggestions && (
                                                    <motion.div 
                                                        initial={{ opacity: 0, y: 10 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        exit={{ opacity: 0, y: 10 }}
                                                        className="absolute z-[110] w-full mt-3 bg-slate-900 border border-slate-800 rounded-[2rem] shadow-2xl overflow-hidden max-h-72 overflow-y-auto custom-scrollbar backdrop-blur-3xl"
                                                    >
                                                        {filteredSuggestions.map((med, index) => (
                                                            <button
                                                                key={index}
                                                                type="button"
                                                                onClick={() => handleSelectSuggestion(med)}
                                                                className="w-full text-left px-7 py-5 hover:bg-emerald-500/10 transition-colors border-b border-slate-800/50 last:border-0 group flex justify-between items-center"
                                                            >
                                                                <div>
                                                                    <p className="font-black text-white group-hover:text-emerald-400 transition-colors">{med.name}</p>
                                                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">{med.category}</p>
                                                                </div>
                                                                <span className="text-[10px] px-3 py-1 bg-slate-800 rounded-full text-slate-400 font-black tracking-widest">{med.type}</span>
                                                            </button>
                                                        ))}
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>

                                        <div className="grid grid-cols-2 gap-6">
                                            <div className="group">
                                                <label className="text-[10px] font-black text-slate-500 uppercase mb-3 block ml-2 tracking-widest">Initial Stock</label>
                                                <div className="relative">
                                                    <span className="material-icons absolute left-5 top-1/2 -translate-y-1/2 text-slate-600 transition-colors">analytics</span>
                                                    <input
                                                        required
                                                        type="number"
                                                        className={`w-full bg-slate-950/50 border ${errors.stock ? 'border-rose-500/50' : 'border-slate-800'} rounded-3xl pl-14 pr-6 py-5 outline-none focus:border-emerald-500/50 transition-all text-white font-bold`}
                                                        value={newMedicine.stock}
                                                        onChange={e => {
                                                            const val = e.target.value;
                                                            setNewMedicine({ ...newMedicine, stock: val });
                                                            setErrors(prev => ({ ...prev, stock: validateStock(val) }));
                                                        }}
                                                    />
                                                </div>
                                                {errors.stock && <p className="text-[10px] text-rose-400 font-bold mt-2 ml-2 animate-pulse">{errors.stock}</p>}
                                            </div>
                                            <div className="group">
                                                <label className="text-[10px] font-black text-slate-500 uppercase mb-3 block ml-2 tracking-widest">Unit Pricing (₹)</label>
                                                <div className="relative">
                                                    <span className="material-icons absolute left-5 top-1/2 -translate-y-1/2 text-slate-600 transition-colors">payments</span>
                                                    <input
                                                        required
                                                        type="number"
                                                        step="0.01"
                                                        className={`w-full bg-slate-950/50 border ${errors.price ? 'border-rose-500/50' : 'border-slate-800'} rounded-3xl pl-14 pr-6 py-5 outline-none focus:border-emerald-500/50 transition-all text-white font-bold font-mono`}
                                                        value={newMedicine.price}
                                                        onChange={e => {
                                                            const val = e.target.value;
                                                            setNewMedicine({ ...newMedicine, price: val });
                                                            setErrors(prev => ({ ...prev, price: validatePrice(val) }));
                                                        }}
                                                    />
                                                </div>
                                                {errors.price && <p className="text-[10px] text-rose-400 font-bold mt-2 ml-2 animate-pulse">{errors.price}</p>}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-6">
                                            <div>
                                                <label className="text-[10px] font-black text-slate-500 uppercase mb-3 block ml-2 tracking-widest">Dosage Form</label>
                                                <select
                                                    className="w-full bg-slate-950/50 border border-slate-800 rounded-3xl px-7 py-5 outline-none focus:border-emerald-500/50 transition-all appearance-none text-white font-bold"
                                                    value={newMedicine.type}
                                                    onChange={e => setNewMedicine({ ...newMedicine, type: e.target.value })}
                                                >
                                                    {MEDICINE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-black text-slate-500 uppercase mb-3 block ml-2 tracking-widest">Medical Category</label>
                                                <select
                                                    className="w-full bg-slate-950/50 border border-slate-800 rounded-3xl px-7 py-5 outline-none focus:border-emerald-500/50 transition-all appearance-none text-white font-bold"
                                                    value={newMedicine.category}
                                                    onChange={e => setNewMedicine({ ...newMedicine, category: e.target.value })}
                                                >
                                                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                                                </select>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex gap-4 pt-6">
                                        <button
                                            type="button"
                                            onClick={() => setShowAddMedicine(false)}
                                            className="flex-1 px-8 py-5 rounded-[1.75rem] font-black uppercase text-xs tracking-[0.2em] border border-slate-800 text-slate-500 hover:bg-slate-800 hover:text-white transition-all underline-offset-4"
                                        >
                                            Discard
                                        </button>
                                        <motion.button
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.98 }}
                                            type="submit"
                                            className="flex-1 px-8 py-5 rounded-[1.75rem] font-black uppercase text-xs tracking-[0.2em] bg-emerald-600 hover:bg-emerald-500 transition-all shadow-2xl shadow-emerald-500/30 text-white border border-emerald-400/20"
                                        >
                                            Commit Entry
                                        </motion.button>
                                    </div>
                                </form>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>
        </div>
    );
};

export default PharmacyDashboard;
