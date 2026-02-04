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
            {/* Header / Navigation */}
            <div className="flex justify-between items-center mb-6">
                <button
                    onClick={() => setShowHistory(!showHistory)}
                    className="flex items-center gap-2 text-indigo-600 font-semibold hover:text-indigo-800 transition-colors"
                >
                    <span className="material-icons">{showHistory ? 'arrow_back' : 'history'}</span>
                    {showHistory ? 'Back to Analyzer' : 'View History'}
                </button>
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
                <div className="bg-white rounded-[32px] shadow-2xl shadow-indigo-100/50 overflow-hidden border border-indigo-50 print:shadow-none print:border-none">
                    <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-blue-700 px-10 py-10 text-white print:hidden">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                            <div>
                                <h1 className="text-3xl sm:text-4xl font-black flex items-center gap-4">
                                    <span className="material-icons text-4xl">analytics</span>
                                    Smart Lab Report Analyzer
                                </h1>
                                <p className="text-lg text-indigo-100 mt-2 opacity-90 print:hidden font-medium max-w-2xl">
                                    AI-powered medical insights. Decode your results instantly.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Print Only Header */}
                    <div className="hidden print:block p-8 border-b-2 border-indigo-600 mb-8">
                        <div className="flex justify-between items-center">
                            <div>
                                <h1 className="text-3xl font-black text-indigo-600 uppercase tracking-tighter italic">Swasthyalink</h1>
                                <p className="text-gray-500 font-bold">Smart Digital Health Report</p>
                            </div>
                            <div className="text-right">
                                <p className="text-sm font-black text-gray-800 uppercase tracking-widest">Medical Analysis</p>
                                <p className="text-gray-500 font-medium">{new Date().toLocaleDateString()} • {new Date().toLocaleTimeString()}</p>
                            </div>
                        </div>
                        <div className="mt-6 flex gap-12 text-sm">
                            <div>
                                <p className="text-gray-400 font-bold uppercase text-[10px] tracking-widest">Patient Name</p>
                                <p className="font-black text-gray-800">{currentUser?.displayName || 'Valued User'}</p>
                            </div>
                            <div>
                                <p className="text-gray-400 font-bold uppercase text-[10px] tracking-widest">Report Type</p>
                                <p className="font-black text-gray-800">Laboratory Data Analysis</p>
                            </div>
                        </div>
                    </div>

                    <div className="p-10">
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
                                                <p className="text-xl text-indigo-700/80 mb-8 leading-relaxed">Our advanced Gemini AI will analyze every line of your report and provide a detailed, plain-language explanation of your health metrics.</p>
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
                                <div className="flex justify-between items-center print:hidden">
                                    <div className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 ${analysis.overallStatus === 'Healthy' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                                        }`}>
                                        <span className="material-icons">{analysis.overallStatus === 'Healthy' ? 'check_circle' : 'warning'}</span>
                                        Overall Status: {analysis.overallStatus}
                                    </div>
                                    <button
                                        onClick={handlePrint}
                                        className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 active:scale-95"
                                    >
                                        <span className="material-icons">download</span>
                                        Download PDF Report
                                    </button>
                                </div>

                                <div className="bg-gradient-to-br from-indigo-600 to-blue-700 rounded-[32px] p-10 shadow-2xl shadow-indigo-200 relative overflow-hidden text-white print:bg-indigo-50 print:text-indigo-900 print:shadow-none print:border print:border-indigo-100">
                                    <div className="absolute top-0 right-0 opacity-10 transform translate-x-1/4 -translate-y-1/4 print:hidden">
                                        <span className="material-icons text-[250px]">psychology</span>
                                    </div>
                                    <h3 className="text-3xl font-black mb-6 flex items-center gap-3 relative print:text-indigo-600">
                                        <div className="p-2 bg-white/20 backdrop-blur-md rounded-lg print:bg-indigo-100">
                                            <span className="material-icons text-3xl print:text-indigo-600">summarize</span>
                                        </div>
                                        Executive AI Summary
                                    </h3>
                                    <p className="text-2xl leading-relaxed font-medium relative italic text-indigo-50 print:text-indigo-900 print:text-lg">
                                        "{analysis.summary}"
                                    </p>
                                </div>

                                <div className="overflow-x-auto rounded-[32px] shadow-2xl shadow-indigo-100/30 border border-gray-100 bg-white">
                                    <table className="min-w-full">
                                        <thead className="bg-gray-50/50 text-gray-400 uppercase text-sm font-black tracking-[0.2em]">
                                            <tr>
                                                <th className="px-10 py-8 text-left">Detailed Health Indicator</th>
                                                <th className="px-10 py-8 text-left">Observed Value</th>
                                                <th className="px-10 py-8 text-left">Reference Range</th>
                                                <th className="px-10 py-8 text-center">AI Assessment</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {analysis.results.map((item, index) => (
                                                <tr key={index} className="group hover:bg-indigo-50/30 transition-all duration-300">
                                                    <td className="px-10 py-6">
                                                        <p className="font-black text-xl text-gray-800 group-hover:text-indigo-600 transition-colors uppercase tracking-tight">{item.testName}</p>
                                                    </td>
                                                    <td className="px-10 py-6">
                                                        <span className="text-2xl font-black text-gray-900">{item.value}</span>
                                                        <span className="text-sm font-bold text-gray-400 ml-2 uppercase tracking-tighter">{item.unit}</span>
                                                    </td>
                                                    <td className="px-10 py-6 text-gray-500 font-bold text-lg">{item.referenceRange}</td>
                                                    <td className="px-10 py-6 text-center">
                                                        <span className={`inline-flex items-center px-6 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest border-2 shadow-sm ${item.status === 'High' ? 'bg-red-50 text-red-600 border-red-200' :
                                                            item.status === 'Low' ? 'bg-yellow-50 text-yellow-600 border-yellow-200' :
                                                                'bg-green-50 text-green-600 border-green-200'
                                                            }`}>
                                                            {item.status}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Recommendations */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print:hidden">
                                    <div className="bg-white rounded-[32px] p-10 border border-gray-100 shadow-xl shadow-indigo-100/20">
                                        <h4 className="text-2xl font-black text-gray-800 mb-8 flex items-center gap-3">
                                            <div className="p-2 bg-green-50 rounded-xl">
                                                <span className="material-icons text-green-500 text-3xl">tips_and_updates</span>
                                            </div>
                                            Clinical Action Plan
                                        </h4>
                                        <ul className="space-y-6">
                                            {analysis.recommendations?.map((rec, i) => (
                                                <li key={i} className="flex items-start gap-5 text-lg text-gray-600 group">
                                                    <div className="mt-1.5 w-6 h-6 rounded-full bg-indigo-50 flex items-center justify-center flex-shrink-0 group-hover:bg-indigo-600 transition-colors">
                                                        <span className="material-icons text-[14px] text-indigo-400 group-hover:text-white transition-colors">arrow_forward</span>
                                                    </div>
                                                    <span className="leading-relaxed font-medium">{rec}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                    <div className="bg-indigo-600 rounded-[32px] p-10 text-white shadow-2xl shadow-indigo-200 flex flex-col justify-between relative overflow-hidden group">
                                        <div className="absolute -bottom-10 -right-10 opacity-10 transform scale-150 group-hover:rotate-12 transition-transform duration-700">
                                            <span className="material-icons text-[200px]">support_agent</span>
                                        </div>
                                        <div className="relative">
                                            <h4 className="text-3xl font-black mb-4">Expert Interpretation</h4>
                                            <p className="text-lg text-indigo-100 opacity-90 leading-relaxed mb-8">While AI provides amazing insights, we always recommend discussing these results with a certified medical professional for a personalized clinical diagnosis.</p>
                                        </div>
                                        <button className="relative bg-white text-indigo-600 py-5 rounded-2xl font-black text-xl hover:bg-indigo-50 transition-all transform hover:scale-[1.02] shadow-xl">
                                            Consult a Dr. Now
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <style jsx>{`
                @media print {
                    @page { 
                        margin: 15mm; 
                        size: A4;
                    }
                    body { 
                        -webkit-print-color-adjust: exact;
                        background: white !important;
                    }
                    .bg-white { background: white !important; }
                    .rounded-\[32px\] { border-radius: 12px !important; }
                    table { border: 1px solid #e5e7eb !important; }
                    th { background-color: #f9fafb !important; color: #374151 !important; border-bottom: 2px solid #e5e7eb !important; }
                    td { border-bottom: 1px solid #f3f4f6 !important; }
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
