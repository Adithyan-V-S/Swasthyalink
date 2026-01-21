import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

const SmartReportAnalyzer = () => {
    const [selectedImage, setSelectedImage] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [analysis, setAnalysis] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const { currentUser } = useAuth();

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setSelectedImage(file);
            setImagePreview(URL.createObjectURL(file));
            setAnalysis(null);
            setError('');
        }
    };

    const convertToBase64 = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result.split(',')[1]); // Remove data:image/jpeg;base64, prefix
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

            setAnalysis(data.data);
        } catch (err) {
            console.error('Analysis error:', err);
            setError('Failed to analyze the report. Please try again. ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container mx-auto px-4 py-8 max-w-5xl">
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-indigo-100">
                <div className="bg-indigo-600 px-8 py-6 text-white">
                    <h1 className="text-3xl font-bold flex items-center gap-3">
                        <span className="material-icons text-4xl">analytics</span>
                        Smart Lab Report Analyzer
                    </h1>
                    <p className="text-indigo-100 mt-2 opacity-90">
                        Upload your medical lab report (image) and let AI explain the results in simple terms.
                    </p>
                </div>

                <div className="p-8">
                    {/* Upload Section */}
                    <div className="mb-8">
                        {!imagePreview ? (
                            <div className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center hover:bg-gray-50 transition-colors cursor-pointer relative">
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleImageChange}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                />
                                <span className="material-icons text-6xl text-gray-400 mb-4">cloud_upload</span>
                                <p className="text-xl font-medium text-gray-600">Click or Drag to Upload Report Image</p>
                                <p className="text-sm text-gray-400 mt-2">Supports JPG, PNG</p>
                            </div>
                        ) : (
                            <div className="flex flex-col md:flex-row gap-8 items-start">
                                <div className="w-full md:w-1/3 relative group">
                                    <img
                                        src={imagePreview}
                                        alt="Report Preview"
                                        className="w-full rounded-lg shadow-md border border-gray-200"
                                    />
                                    <button
                                        onClick={() => {
                                            setSelectedImage(null);
                                            setImagePreview(null);
                                            setAnalysis(null);
                                        }}
                                        className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                                    >
                                        <span className="material-icons text-sm">close</span>
                                    </button>
                                </div>

                                <div className="w-full md:w-2/3 flex flex-col justify-center">
                                    {!analysis && (
                                        <div className="text-center py-8">
                                            <h3 className="text-xl font-semibold text-gray-800 mb-4">Ready to Analyze?</h3>
                                            <button
                                                onClick={handleAnalyze}
                                                disabled={loading}
                                                className={`px-8 py-3 rounded-full font-bold text-white shadow-lg transform transition-all hover:scale-105 ${loading
                                                    ? 'bg-gray-400 cursor-not-allowed'
                                                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700'
                                                    }`}
                                            >
                                                {loading ? (
                                                    <span className="flex items-center gap-2">
                                                        <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
                                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                        </svg>
                                                        Analyzing with Gemini AI...
                                                    </span>
                                                ) : (
                                                    <span className="flex items-center gap-2">
                                                        <span className="material-icons">auto_awesome</span>
                                                        Analyze Report
                                                    </span>
                                                )}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {error && (
                            <div className="mt-4 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-r shadow-sm flex items-center gap-3">
                                <span className="material-icons text-red-500">error</span>
                                {error}
                            </div>
                        )}
                    </div>

                    {/* Results Section */}
                    {analysis && (
                        <div className="animate-fade-in-up">
                            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-6 mb-8 shadow-inner">
                                <h3 className="text-lg font-bold text-indigo-900 mb-2 flex items-center gap-2">
                                    <span className="material-icons text-indigo-600">summarize</span>
                                    Wait a Minute.. Here is the Summary
                                </h3>
                                <p className="text-indigo-800 leading-relaxed text-lg">
                                    {analysis.summary}
                                </p>
                            </div>

                            <div className="overflow-x-auto rounded-xl shadow border border-gray-200">
                                <table className="min-w-full bg-white">
                                    <thead className="bg-gray-50 text-gray-500 uppercase text-xs font-bold tracking-wider">
                                        <tr>
                                            <th className="px-6 py-4 text-left">Test Name</th>
                                            <th className="px-6 py-4 text-left">Result</th>
                                            <th className="px-6 py-4 text-left">Reference Range</th>
                                            <th className="px-6 py-4 text-center">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {analysis.results.map((item, index) => (
                                            <tr key={index} className={`hover:bg-gray-50 transition-colors ${item.status === 'High' ? 'bg-red-50' :
                                                item.status === 'Low' ? 'bg-yellow-50' : ''
                                                }`}>
                                                <td className="px-6 py-4 font-medium text-gray-900">{item.testName}</td>
                                                <td className="px-6 py-4 font-bold text-gray-800">
                                                    {item.value} <span className="text-xs font-normal text-gray-500 ml-1">{item.unit}</span>
                                                </td>
                                                <td className="px-6 py-4 text-gray-600 text-sm">{item.referenceRange}</td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide shadow-sm ${item.status === 'High' ? 'bg-red-100 text-red-700 border border-red-200' :
                                                        item.status === 'Low' ? 'bg-yellow-100 text-yellow-800 border border-yellow-200' :
                                                            'bg-green-100 text-green-700 border border-green-200'
                                                        }`}>
                                                        {item.status === 'High' && <span className="material-icons text-[14px] mr-1">arrow_upward</span>}
                                                        {item.status === 'Low' && <span className="material-icons text-[14px] mr-1">arrow_downward</span>}
                                                        {item.status === 'Normal' && <span className="material-icons text-[14px] mr-1">check_circle</span>}
                                                        {item.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SmartReportAnalyzer;
