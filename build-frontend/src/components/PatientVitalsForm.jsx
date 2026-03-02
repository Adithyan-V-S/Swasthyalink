import React, { useState, useEffect } from 'react';

const PatientVitalsForm = ({ patient, onSave, onCancel }) => {
    const [vitals, setVitals] = useState({
        bp_systolic: '',
        bp_diastolic: '',
        heartRate: '',
        spo2: '',
        temperature: '',
        weight: '',
        height: '',
        notes: ''
    });

    const [bmi, setBmi] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Calculate BMI whenever weight or height changes
    useEffect(() => {
        if (vitals.weight && vitals.height) {
            const weightKg = parseFloat(vitals.weight);
            const heightCm = parseFloat(vitals.height);
            if (weightKg > 0 && heightCm > 0) {
                const heightM = heightCm / 100;
                const calculatedBmi = (weightKg / (heightM * heightM)).toFixed(1);
                setBmi(calculatedBmi);
            } else {
                setBmi(null);
            }
        } else {
            setBmi(null);
        }
    }, [vitals.weight, vitals.height]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setVitals(prev => ({ ...prev, [name]: value }));
    };

    const getBmiCategory = (bmiValue) => {
        if (!bmiValue) return null;
        if (bmiValue < 18.5) return { label: 'Underweight', color: 'text-blue-500' };
        if (bmiValue < 25) return { label: 'Normal', color: 'text-green-500' };
        if (bmiValue < 30) return { label: 'Overweight', color: 'text-yellow-500' };
        return { label: 'Obese', color: 'text-red-500' };
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await onSave({
                ...vitals,
                bmi: bmi,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            console.error('Error saving vitals:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const bmiInfo = getBmiCategory(bmi);

    return (
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
            <div className="bg-gradient-to-r from-green-600 to-teal-600 px-6 py-4">
                <h3 className="text-xl font-bold text-white">Record Vitals: {patient?.name}</h3>
                <p className="text-green-100 text-sm">Fill in the current health metrics for the patient.</p>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Blood Pressure */}
                    <div className="space-y-2">
                        <label className="block text-sm font-bold text-gray-700">Blood Pressure (mmHg)</label>
                        <div className="flex items-center gap-2">
                            <input
                                type="number"
                                name="bp_systolic"
                                value={vitals.bp_systolic}
                                onChange={handleInputChange}
                                placeholder="Sys"
                                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                                required
                            />
                            <span className="text-gray-400">/</span>
                            <input
                                type="number"
                                name="bp_diastolic"
                                value={vitals.bp_diastolic}
                                onChange={handleInputChange}
                                placeholder="Dia"
                                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                                required
                            />
                        </div>
                    </div>

                    {/* Heart Rate */}
                    <div className="space-y-2">
                        <label className="block text-sm font-bold text-gray-700">Heart Rate (BPM)</label>
                        <input
                            type="number"
                            name="heartRate"
                            value={vitals.heartRate}
                            onChange={handleInputChange}
                            placeholder="e.g. 72"
                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                            required
                        />
                    </div>

                    {/* SpO2 */}
                    <div className="space-y-2">
                        <label className="block text-sm font-bold text-gray-700">SpO2 (%)</label>
                        <input
                            type="number"
                            name="spo2"
                            value={vitals.spo2}
                            onChange={handleInputChange}
                            placeholder="e.g. 98"
                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                            required
                        />
                    </div>

                    {/* Temperature */}
                    <div className="space-y-2">
                        <label className="block text-sm font-bold text-gray-700">Temperature (°C)</label>
                        <input
                            type="number"
                            step="0.1"
                            name="temperature"
                            value={vitals.temperature}
                            onChange={handleInputChange}
                            placeholder="e.g. 36.6"
                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                            required
                        />
                    </div>

                    {/* Weight */}
                    <div className="space-y-2">
                        <label className="block text-sm font-bold text-gray-700">Weight (kg)</label>
                        <input
                            type="number"
                            step="0.1"
                            name="weight"
                            value={vitals.weight}
                            onChange={handleInputChange}
                            placeholder="e.g. 70"
                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                            required
                        />
                    </div>

                    {/* Height */}
                    <div className="space-y-2">
                        <label className="block text-sm font-bold text-gray-700">Height (cm)</label>
                        <input
                            type="number"
                            name="height"
                            value={vitals.height}
                            onChange={handleInputChange}
                            placeholder="e.g. 175"
                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                            required
                        />
                    </div>
                </div>

                {/* BMI Display */}
                {bmi && (
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 flex items-center justify-between">
                        <div>
                            <span className="text-gray-500 text-sm font-medium">Calculated BMI</span>
                            <div className="text-2xl font-black text-gray-900">{bmi}</div>
                        </div>
                        <div className="text-right">
                            <span className="text-gray-500 text-sm font-medium">Category</span>
                            <div className={`text-xl font-bold ${bmiInfo?.color}`}>{bmiInfo?.label}</div>
                        </div>
                    </div>
                )}

                {/* Notes */}
                <div className="space-y-2">
                    <label className="block text-sm font-bold text-gray-700">Initial Assessment / Notes</label>
                    <textarea
                        name="notes"
                        value={vitals.notes}
                        onChange={handleInputChange}
                        rows="3"
                        placeholder="Nurse's observations..."
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 outline-none resize-none"
                    />
                </div>

                <div className="flex gap-4 pt-4">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="flex-1 px-6 py-3 border border-gray-200 text-gray-600 font-bold rounded-xl hover:bg-gray-50 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="flex-1 px-6 py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 shadow-lg shadow-green-100 transition-all disabled:opacity-50"
                    >
                        {isSubmitting ? 'Saving...' : 'Save & Link to Ledger'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default PatientVitalsForm;
