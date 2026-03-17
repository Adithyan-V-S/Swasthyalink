import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Webcam from 'react-webcam';
import { toast } from 'react-hot-toast';

const SAMPLE_REPORTS = [
    {
        id: 'sample-1',
        name: 'Blood Test (CBC)',
        type: 'General Wellness',
        path: '/exercises/cbc_sample.png', // Reusing available assets or placeholders
        mockData: {
            patientName: "Yash M. Patel",
            patientAge: "21",
            patientGender: "Male",
            summary: "Your Complete Blood Count is generally within normal limits, indicating good overall health. Hemoglobin and White Blood Cell counts are optimal.",
            results: [
                { testName: "Hemoglobin", value: "14.5", unit: "g/dL", referenceRange: "13.5 - 17.5", status: "Normal" },
                { testName: "WBC Count", value: "7,500", unit: "/mcL", referenceRange: "4,500 - 11,000", status: "Normal" },
                { testName: "Platelets", value: "250,000", unit: "/mcL", referenceRange: "150,000 - 450,000", status: "Normal" }
            ],
            overallStatus: "Healthy",
            recommendations: ["Maintain current balanced diet", "Stay hydrated", "Annual checkup recommended"]
        }
    },
    {
        id: 'sample-2',
        name: 'Lipid Profile',
        type: 'Heart Health',
        path: '/exercises/lipid_sample.png',
        mockData: {
            patientName: "Sarah J. Connor",
            patientAge: "45",
            patientGender: "Female",
            summary: "Your lipid profile shows slightly elevated LDL (bad) cholesterol. Total cholesterol is at the upper limit of normal.",
            results: [
                { testName: "Total Cholesterol", value: "198", unit: "mg/dL", referenceRange: "< 200", status: "Normal" },
                { testName: "LDL Cholesterol", value: "135", unit: "mg/dL", referenceRange: "< 100", status: "High" },
                { testName: "HDL Cholesterol", value: "45", unit: "mg/dL", referenceRange: "> 40", status: "Normal" },
                { testName: "Triglycerides", value: "120", unit: "mg/dL", referenceRange: "< 150", status: "Normal" }
            ],
            overallStatus: "Needs Attention",
            recommendations: ["Reduce saturated fat intake", "Increase cardiovascular exercise (30 mins daily)", "Consult a nutritionist"]
        }
    }
];

const SmartReportAnalyzer = () => {
    const [reportType, setReportType] = useState('lab');
    const [selectedImage, setSelectedImage] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [analysis, setAnalysis] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showCamera, setShowCamera] = useState(false);
    const [history, setHistory] = useState([]);
    const [showHistory, setShowHistory] = useState(false);
    const { currentUser } = useAuth();
    const webcamRef = useRef(null);

    // Load history from localStorage on mount
    useEffect(() => {
        const savedHistory = localStorage.getItem(`report_history_${currentUser?.uid || 'guest'}`);
        if (savedHistory) {
            setHistory(JSON.parse(savedHistory));
        }
    }, [currentUser]);

    const saveToHistory = (newAnalysis, image) => {
        const historyItem = {
            id: Date.now(),
            date: new Date().toLocaleDateString(),
            imagePreview: image,
            analysis: newAnalysis
        };
        const updatedHistory = [historyItem, ...history.slice(0, 9)]; // Keep last 10
        setHistory(updatedHistory);
        localStorage.setItem(`report_history_${currentUser?.uid || 'guest'}`, JSON.stringify(updatedHistory));
    };

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setSelectedImage(file);
            setImagePreview(URL.createObjectURL(file));
            setAnalysis(null);
            setError('');
            setShowCamera(false);
        }
    };

    const capturePhoto = React.useCallback(() => {
        const imageSrc = webcamRef.current.getScreenshot();
        if (imageSrc) {
            setImagePreview(imageSrc);
            setAnalysis(null);
            setError('');
            setShowCamera(false);

            // Convert base64 to File object for compatibility with handleAnalyze
            fetch(imageSrc)
                .then(res => res.blob())
                .then(blob => {
                    const file = new File([blob], "captured_report.jpg", { type: "image/jpeg" });
                    setSelectedImage(file);
                });
        }
    }, [webcamRef]);

    const loadSample = (sample) => {
        setAnalysis(sample.mockData);
        setImagePreview(sample.path);
        setSelectedImage(null);
        setError('');
        toast.success(`Loaded ${sample.name} sample`);
    };

    const convertToBase64 = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result.split(',')[1]);
            reader.onerror = (error) => reject(error);
        });
    };

    const handleAnalyze = async () => {
        if (!selectedImage) return;

        setLoading(true);
        setError('');

        try {
            const base64Image = await convertToBase64(selectedImage);

            const response = await fetch('https://us-central1-swasthyalink-42535.cloudfunctions.net/analyzeReport', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    image: base64Image,
                    mimeType: selectedImage.type
                }),
            });

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'Failed to analyze report');
            }

            const analysisData = data.data;
            console.log("Raw AI Analysis Output:", analysisData);

            // Generate some mock recommendations if missing
            if (!analysisData.recommendations) {
                analysisData.recommendations = ["Continue monitoring health trends", "Consult your physician for professional interpretation", "Share this report with your family network"];
            }
            if (!analysisData.overallStatus) {
                const hasAbnormal = analysisData.results.some(r => r.status !== 'Normal');
                analysisData.overallStatus = hasAbnormal ? "Needs Review" : "Healthy";
            }

            setAnalysis(analysisData);
            saveToHistory(analysisData, imagePreview);
        } catch (err) {
            console.error('Analysis error:', err);
            setError('Failed to analyze the report. Please try again. ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-10">
            <div className="flex justify-between items-center mb-6 print:hidden">
                <button
                    onClick={() => setShowHistory(!showHistory)}
                    className="flex items-center gap-2 text-indigo-600 font-semibold hover:text-indigo-800 transition-colors"
                >
                    <span className="material-icons">{showHistory ? 'arrow_back' : 'history'}</span>
                    {showHistory ? 'Back to Analyzer' : 'View History'}
                </button>
                {showHistory && history.length > 0 && (
                    <button
                        onClick={() => {
                            setHistory([]);
                            localStorage.removeItem(`report_history_${currentUser?.uid || 'guest'}`);
                            toast.success('History cleared successfully');
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg font-semibold hover:bg-red-100 transition-colors"
                    >
                        <span className="material-icons text-sm">delete_outline</span>
                        Clear History
                    </button>
                )}
            </div>

            {showHistory ? (
                <div className="animate-fade-in">
                    <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                        <span className="material-icons text-indigo-600">history</span>
                        Recent Reports
                    </h2>
                    {history.length === 0 ? (
                        <div className="bg-white rounded-2xl p-12 text-center border border-gray-100 shadow-sm">
                            <span className="material-icons text-6xl text-gray-300 mb-4">folder_off</span>
                            <p className="text-gray-500">No report history found.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {history.map((item) => (
                                <div
                                    key={item.id}
                                    className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow cursor-pointer flex gap-4"
                                    onClick={() => {
                                        setAnalysis(item.analysis);
                                        setImagePreview(item.imagePreview);
                                        setShowHistory(false);
                                    }}
                                >
                                    <div className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 border border-gray-200">
                                        <img src={item.imagePreview} alt="Report" className="w-full h-full object-cover" />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="font-bold text-gray-800">{item.analysis.overallStatus} Status</h3>
                                        <p className="text-sm text-gray-500">{item.date}</p>
                                        <p className="text-xs text-indigo-600 mt-1">{item.analysis.results.length} tests found</p>
                                    </div>
                                    <span className="material-icons text-gray-400 self-center">chevron_right</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ) : (
                <div id="printable-report" className="bg-white rounded-[32px] shadow-2xl shadow-indigo-100/50 overflow-hidden border border-indigo-50 print:shadow-none print:border-none print:rounded-none">
                    <div className="bg-gradient-to-r from-indigo-700 via-violet-800 to-indigo-900 px-6 py-4 text-white print:hidden relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl"></div>
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 relative z-10">
                            <div className="flex items-center gap-3">
                                <div className="p-1.5 bg-white/20 rounded-lg backdrop-blur-lg">
                                    <span className="material-icons text-2xl">psychology</span>
                                </div>
                                <div>
                                    <h1 className="text-xl font-black tracking-tight">
                                        Health & Imaging AI
                                    </h1>
                                    <p className="text-[10px] text-indigo-100 font-bold opacity-70 uppercase tracking-widest">
                                        Lab Results • X-rays • Scans
                                    </p>
                                </div>
                            </div>

                            <div className="flex bg-white/10 backdrop-blur-md p-1 rounded-lg items-center border border-white/5">
                                {['lab', 'xray', 'scan'].map((type) => (
                                    <button
                                        key={type}
                                        onClick={() => setReportType(type)}
                                        className={`px-3 py-1 rounded-md text-[9px] font-black uppercase tracking-wider transition-all ${reportType === type
                                                ? 'bg-white text-indigo-900 shadow-sm'
                                                : 'text-white/60 hover:text-white hover:bg-white/10'
                                            }`}
                                    >
                                        {type === 'lab' ? 'Lab Results' : type === 'xray' ? 'X-Ray' : 'Scan'}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Print Only Header */}
                    <div className="hidden print:block p-8 mb-8">
                        <div className="flex justify-between items-end border-b-2 border-gray-800 pb-4 mb-6">
                            <div>
                                <h1 className="text-3xl font-black text-gray-900 uppercase tracking-tighter">SWASTHYALINK</h1>
                                <p className="text-gray-600 font-bold uppercase text-sm tracking-widest">Laboratory Report</p>
                            </div>
                            <div className="text-right">
                                <p className="text-xl font-black text-gray-800 uppercase">Medical Analysis</p>
                                <p className="text-sm text-gray-600 font-medium">Generated: {new Date().toLocaleDateString()} • {new Date().toLocaleTimeString()}</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm border-b-2 border-gray-800 pb-6 border-t border-gray-100 pt-6">
                            <div className="flex"><span className="font-bold w-32 text-gray-600 uppercase">Patient Name:</span> <span className="font-bold text-gray-900 uppercase">{analysis?.patientName || currentUser?.displayName || 'N/A'}</span></div>
                            <div className="flex"><span className="font-bold w-32 text-gray-600 uppercase">Report Type:</span> <span className="text-gray-900">AI Medical Analysis</span></div>
                            <div className="flex"><span className="font-bold w-32 text-gray-600 uppercase">Age / Gender:</span> <span className="text-gray-900">{analysis?.patientAge || 'Adult'} / {analysis?.patientGender || 'Unspecified'}</span></div>
                            <div className="flex"><span className="font-bold w-32 text-gray-600 uppercase">Referred By:</span> <span className="text-gray-900">Self Upload</span></div>
                            <div className="flex"><span className="font-bold w-32 text-gray-600 uppercase">Patient ID:</span> <span className="text-gray-900 uppercase">{currentUser?.uid ? currentUser.uid.substring(0, 8) : 'UNK'}</span></div>
                            <div className="flex"><span className="font-bold w-32 text-gray-600 uppercase">Status:</span> <span className="font-bold text-gray-900 uppercase">{analysis?.overallStatus || 'Completed'}</span></div>
                        </div>
                    </div>

                    <div className="p-10 print:p-8">
                        {/* Upload/Camera Section */}
                        <div className="mb-8 print:hidden">
                            {!imagePreview && !showCamera ? (
                                <div className="space-y-6">
                                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                                        {/* Drop Zone & Unified Browse */}
                                        <div className="lg:col-span-3 border-2 border-dashed border-indigo-100 rounded-[24px] py-16 px-10 text-center hover:bg-indigo-50/50 transition-all cursor-pointer relative group bg-gray-50/30">
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={handleImageChange}
                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                            />
                                            <div className="transform group-hover:scale-110 transition-transform duration-500 mb-4">
                                                <div className="inline-flex p-4 bg-white rounded-full shadow-md text-indigo-500 group-hover:text-indigo-600 transition-colors">
                                                    <span className="material-icons text-5xl">cloud_upload</span>
                                                </div>
                                            </div>
                                            <h3 className="text-2xl font-black text-gray-800 mb-2">Drag & Drop or Click</h3>
                                            <p className="text-gray-500 font-medium">Select a lab report photo to analyze</p>
                                        </div>

                                        {/* Camera Action */}
                                        <button
                                            onClick={() => setShowCamera(true)}
                                            className="flex flex-col items-center justify-center gap-4 p-6 bg-white border-2 border-indigo-100 text-indigo-600 rounded-[24px] font-black hover:bg-indigo-50 transition-all hover:border-indigo-200 group shadow-sm hover:shadow-md"
                                        >
                                            <div className="p-4 bg-indigo-50 rounded-full group-hover:bg-indigo-100 transition-colors">
                                                <span className="material-icons text-4xl group-hover:scale-110 transition-transform">photo_camera</span>
                                            </div>
                                            <span className="text-lg">Take a Photo</span>
                                        </button>
                                    </div>

                                    {/* Samples Section */}
                                    <div className="mt-12 pt-8 border-t border-gray-100">
                                        <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                            <span className="material-icons text-[16px]">visibility</span>
                                            Try our sample reports
                                        </h3>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            {SAMPLE_REPORTS.map((sample) => (
                                                <div
                                                    key={sample.id}
                                                    onClick={() => loadSample(sample)}
                                                    className="p-4 rounded-xl border border-gray-200 hover:border-indigo-400 hover:bg-indigo-50 transition-all cursor-pointer flex justify-between items-center group"
                                                >
                                                    <div>
                                                        <p className="font-bold text-gray-800">{sample.name}</p>
                                                        <p className="text-xs text-gray-500">{sample.type}</p>
                                                    </div>
                                                    <span className="material-icons text-gray-300 group-hover:text-indigo-500 transition-colors">play_circle</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ) : showCamera ? (
                                <div className="bg-gray-900 rounded-2xl overflow-hidden relative">
                                    <Webcam
                                        audio={false}
                                        ref={webcamRef}
                                        screenshotFormat="image/jpeg"
                                        className="w-full"
                                        videoConstraints={{ facingMode: "environment" }}
                                    />
                                    <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-4">
                                        <button
                                            onClick={() => setShowCamera(false)}
                                            className="bg-white/20 backdrop-blur-md text-white p-4 rounded-full hover:bg-white/30"
                                        >
                                            <span className="material-icons">close</span>
                                        </button>
                                        <button
                                            onClick={capturePhoto}
                                            className="bg-white text-indigo-600 p-6 rounded-full shadow-2xl hover:scale-110 active:scale-95 transition-transform"
                                        >
                                            <span className="material-icons text-3xl">photo_camera</span>
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col md:flex-row gap-8 items-start">
                                    <div className="w-full md:w-1/3 relative group">
                                        <img
                                            src={imagePreview}
                                            alt="Report Preview"
                                            className="w-full rounded-2xl shadow-lg border border-gray-200"
                                        />
                                        <button
                                            onClick={() => {
                                                setSelectedImage(null);
                                                setImagePreview(null);
                                                setAnalysis(null);
                                            }}
                                            className="absolute -top-3 -right-3 bg-red-500 text-white p-2 rounded-full shadow-lg hover:bg-red-600 transition-colors"
                                        >
                                            <span className="material-icons text-sm">close</span>
                                        </button>
                                    </div>

                                    <div className="w-full md:w-2/3 flex flex-col justify-center min-h-[300px]">
                                        {!analysis && (
                                            <div className="bg-indigo-50/30 p-12 rounded-[24px] border border-indigo-100/50 backdrop-blur-sm shadow-inner">
                                                <h3 className="text-4xl font-black text-indigo-900 mb-4">Ready to Decode?</h3>
                                                <p className="text-xl text-indigo-700/80 mb-8 leading-relaxed">Our advanced Swasthyalink AI will analyze every line of your report and provide a detailed, plain-language explanation of your health metrics.</p>
                                                <button
                                                    onClick={handleAnalyze}
                                                    disabled={loading}
                                                    className={`w-full md:w-auto px-12 py-5 rounded-2xl font-black text-xl text-white shadow-2xl shadow-indigo-200 transform transition-all hover:scale-[1.02] active:scale-95 ${loading
                                                        ? 'bg-gray-400 cursor-not-allowed'
                                                        : 'bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700'
                                                        }`}
                                                >
                                                    {loading ? (
                                                        <span className="flex items-center justify-center gap-4">
                                                            <div className="w-6 h-6 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                                                            Analyzing your health profile...
                                                        </span>
                                                    ) : (
                                                        <span className="flex items-center justify-center gap-3">
                                                            <span className="material-icons text-2xl">auto_awesome</span>
                                                            Generate AI Analysis
                                                        </span>
                                                    )}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {error && (
                                <div className="mt-6 p-4 bg-red-50 border border-red-100 text-red-700 rounded-xl shadow-sm flex items-center gap-3 animate-shake">
                                    <span className="material-icons text-red-500">error_outline</span>
                                    <p className="font-medium">{error}</p>
                                </div>
                            )}
                        </div>

                        {/* Results Section */}
                        {analysis && (
                            <div className="animate-fade-in-up space-y-8">
                                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-4 print:hidden">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <div className={`px-3 py-1.5 rounded-lg font-black text-[9px] uppercase tracking-widest flex items-center gap-2 shadow-sm ${analysis.overallStatus === 'Healthy'
                                                ? 'bg-green-500 text-white shadow-green-100'
                                                : 'bg-amber-500 text-white shadow-amber-100'
                                            }`}>
                                            <span className="material-icons text-xs">{analysis.overallStatus === 'Healthy' ? 'verified' : 'warning'}</span>
                                            {analysis.overallStatus}
                                        </div>
                                        {analysis.blockchainHash && (
                                            <div className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg font-black text-[9px] uppercase tracking-widest flex items-center gap-2 shadow-sm shadow-indigo-100">
                                                <span className="material-icons text-xs">shield</span>
                                                Verified
                                            </div>
                                        )}
                                    </div>
                                    <button
                                        onClick={handlePrint}
                                        className="w-full lg:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg font-black text-[10px] hover:bg-black transition-all shadow-md active:scale-95"
                                    >
                                        <span className="material-icons text-xs">picture_as_pdf</span>
                                        Download Report
                                    </button>
                                </div>

                                {/* AI Executive Summary - Even Smaller */}
                                <div className="bg-gradient-to-br from-indigo-50 via-white to-blue-50 rounded-[24px] p-6 border border-indigo-100/30 shadow-lg shadow-indigo-100/10 relative overflow-hidden mb-6">
                                    <div className="absolute -top-6 -right-6 opacity-[0.02] transform rotate-12">
                                        <span className="material-icons text-[100px]">medical_information</span>
                                    </div>
                                    <h3 className="text-xl font-black text-indigo-950 mb-4 flex items-center gap-2 relative">
                                        <div className="p-1.5 bg-indigo-600 rounded-lg text-white shadow-sm">
                                            <span className="material-icons text-lg">auto_awesome</span>
                                        </div>
                                        AI Clinical Insights
                                    </h3>
                                    <div className="prose prose-indigo max-w-none">
                                        <p className="text-lg leading-snug font-bold text-gray-800 relative bg-white/40 backdrop-blur-sm p-4 rounded-xl border border-white/60 shadow-inner italic">
                                            "{analysis.summary}"
                                        </p>
                                    </div>

                                    <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <div className="bg-white/60 backdrop-blur-md p-4 rounded-xl border border-white shadow-sm">
                                            <h4 className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-2">Priority Actions</h4>
                                            <div className="space-y-2">
                                                {analysis.recommendations?.slice(0, 2).map((rec, i) => (
                                                    <div key={i} className="flex items-center gap-2 text-[10px] text-gray-700 font-bold">
                                                        <span className="material-icons text-indigo-500 text-xs">task_alt</span>
                                                        {rec}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="bg-indigo-600 p-4 rounded-xl text-white shadow-md shadow-indigo-100 flex items-center">
                                            <div>
                                                <h4 className="text-[9px] font-black text-indigo-200 uppercase tracking-widest mb-1">Clinician Note</h4>
                                                <p className="text-[11px] font-bold leading-tight">Discuss findings with your physician.</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="overflow-x-auto rounded-[32px] shadow-2xl shadow-indigo-100/30 border border-gray-100 bg-white print:rounded-none print:shadow-none print:border-none print:mt-8 print:overflow-visible">
                                    <table className="min-w-full print:border print:border-gray-800">
                                        <thead className="bg-gray-50/50 text-gray-400 uppercase text-sm font-black tracking-[0.2em] print:bg-gray-100 print:text-gray-800 print:border-b-2 print:border-gray-800 print:tracking-widest">
                                            <tr>
                                                <th className="px-10 py-8 text-left print:py-3 print:px-4">Test Description</th>
                                                <th className="px-10 py-8 text-left print:py-3 print:px-4">Result Value</th>
                                                <th className="px-10 py-8 text-left hidden md:table-cell print:table-cell print:py-3 print:px-4">Units</th>
                                                <th className="px-10 py-8 text-left print:py-3 print:px-4">Reference Interval</th>
                                                <th className="px-10 py-8 text-center print:py-3 print:px-4">Status / AI Mark</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 print:divide-gray-300">
                                            {analysis.results.map((item, index) => (
                                                <tr key={index} className="group hover:bg-indigo-50/30 transition-all duration-300 print:hover:bg-transparent">
                                                    <td className="px-10 py-6 print:py-3 print:px-4">
                                                        <p className="font-black text-xl text-gray-800 group-hover:text-indigo-600 transition-colors uppercase tracking-tight print:text-sm print:font-bold print:uppercase print:text-gray-900">{item.testName}</p>
                                                    </td>
                                                    <td className="px-10 py-6 print:py-3 print:px-4">
                                                        <span className={`text-2xl font-black ${item.status !== 'Normal' ? 'text-gray-900 print:font-black' : 'text-gray-800 print:font-semibold'} print:text-base`}>{item.value}</span>
                                                        <span className="text-sm font-bold text-gray-400 ml-2 uppercase tracking-tighter md:hidden print:hidden">{item.unit}</span>
                                                    </td>
                                                    <td className="px-10 py-6 hidden md:table-cell print:table-cell print:py-3 print:px-4 text-gray-500 font-bold print:text-gray-800 print:text-xs print:font-normal">
                                                        {item.unit || '-'}
                                                    </td>
                                                    <td className="px-10 py-6 print:py-3 print:px-4 text-gray-500 font-bold text-lg print:text-xs print:text-gray-800 print:font-normal">{item.referenceRange || '-'}</td>
                                                    <td className="px-10 py-6 text-center print:py-3 print:px-4">
                                                        <span className={`inline-flex items-center px-6 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest border-2 shadow-sm print:shadow-none print:border-none print:px-0 print:py-0 print:text-xs ${item.status === 'High' ? 'bg-red-50 text-red-600 border-red-200 print:bg-transparent print:text-gray-900 print:font-black' :
                                                            item.status === 'Low' ? 'bg-yellow-50 text-yellow-600 border-yellow-200 print:bg-transparent print:text-gray-900 print:font-black' :
                                                                'bg-green-50 text-green-600 border-green-200 print:bg-transparent print:text-gray-800 print:font-normal'
                                                            }`}>
                                                            {item.status}{item.status !== 'Normal' ? ' *' : ''}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Recommendations / Detailed List - Smoothed */}
                                <div className="grid grid-cols-1 gap-6">
                                    <div className="bg-white rounded-[30px] p-8 border border-gray-100 shadow-xl shadow-indigo-100/10">
                                        <h4 className="text-xl font-black text-gray-900 mb-6 flex items-center gap-3">
                                            <div className="p-2.5 bg-emerald-50 rounded-xl text-emerald-600">
                                                <span className="material-icons text-2xl">health_and_safety</span>
                                            </div>
                                            Clinical Action Plan
                                        </h4>
                                        <div className="grid md:grid-cols-2 gap-4">
                                            {analysis.recommendations?.map((rec, i) => (
                                                <div key={i} className="flex items-start gap-3 p-4 bg-gray-50 rounded-2xl hover:bg-indigo-50 transition-colors border border-transparent hover:border-indigo-100 group">
                                                    <div className="mt-0.5 w-6 h-6 rounded-full bg-white flex items-center justify-center flex-shrink-0 shadow-sm transition-transform group-hover:scale-110">
                                                        <span className="material-icons text-[12px] text-indigo-600">arrow_forward</span>
                                                    </div>
                                                    <span className="text-sm font-bold text-gray-700 leading-tight">{rec}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                <div className="hidden print:block mt-12 pt-6 border-t font-black border-gray-800 text-xs text-gray-500 text-center uppercase tracking-widest">
                                    <p>*** End of Report ***</p>
                                    <p className="font-normal mt-2 lowercase">Powered by Swasthyalink AI Engine</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <style>{`
                @media print {
                    @page { 
                        margin: 15mm; 
                        size: A4;
                    }
                    body * { 
                        visibility: hidden; 
                    }
                    #printable-report, #printable-report * {
                        visibility: visible;
                        -webkit-print-color-adjust: exact;
                        color-adjust: exact;
                    }
                    #printable-report {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                        background: white !important;
                    }
                    .print\\:bg-none {
                        background-image: none !important;
                        background: white !important;
                    }
                    table { border-collapse: collapse !important; border: 1px solid #d1d5db !important; width: 100% !important; }
                    th, td { border-bottom: 1px solid #d1d5db !important; }
                }
                .animate-shake {
                    animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both;
                }
                @keyframes shake {
                    10%, 90% { transform: translate3d(-1px, 0, 0); }
                    20%, 80% { transform: translate3d(2px, 0, 0); }
                    30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
                    40%, 60% { transform: translate3d(4px, 0, 0); }
                }
                .animate-fade-in {
                    animation: fadeIn 0.5s ease-out forwards;
                }
                .animate-fade-in-up {
                    animation: fadeInUp 0.6s ease-out forwards;
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

export default SmartReportAnalyzer;
