import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import mlService from '../services/mlService.js';
import HealthRiskSummary from './HealthRiskSummary';
import HealthMetricsChart from './HealthMetricsChart';

const HealthAnalyticsDashboard = () => {
  const { user } = useAuth();
  const [healthData, setHealthData] = useState({
    age: '',
    gender: '',
    height: '',
    weight: '',
    bmi: '',
    bloodPressure: { systolic: '', diastolic: '' },
    cholesterol: '',
    glucose: '',
    heartRate: '',
    sleepDuration: '',
    physicalActivity: 'medium',
    alcoholConsumption: 'none',
    stressLevel: '5',
    familyHistory: 'no',
    existingConditions: '',
    smoking: 'never',
    exercise: 'occasional'
  });
  const [validationErrors, setValidationErrors] = useState({});
  const [riskAssessment, setRiskAssessment] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('assessment');
  const [showSummary, setShowSummary] = useState(false);

  // Load user's health data from profile or local storage
  useEffect(() => {
    const loadHealthData = () => {
      const savedData = localStorage.getItem('healthData');
      if (savedData) {
        try {
          const parsedData = JSON.parse(savedData);
          setHealthData(prev => ({ ...prev, ...parsedData }));
        } catch (e) {
          console.error("Error parsing saved health data", e);
        }
      }
    };
    loadHealthData();
  }, []);

  // Auto-calculate BMI when height or weight changes
  useEffect(() => {
    if (healthData.height && healthData.weight) {
      const h = parseFloat(healthData.height) / 100;
      const w = parseFloat(healthData.weight);
      if (h > 0 && w > 0) {
        const calculatedBmi = (w / (h * h)).toFixed(1);
        setHealthData(prev => ({ ...prev, bmi: calculatedBmi }));
        // Validate BMI after auto-calculation
        validateField('bmi', calculatedBmi);
      }
    }
  }, [healthData.height, healthData.weight]);

  const validateField = (field, value) => {
    let error = '';
    const numValue = value === '' ? null : parseFloat(value);

    switch (field) {
      case 'age':
        if (numValue === null) error = 'Age is required';
        else if (numValue < 1 || numValue > 120) error = 'Age must be between 1 and 120';
        break;
      case 'bmi':
        if (numValue === null) error = 'BMI is required';
        else if (numValue < 10 || numValue > 60) error = 'BMI must be between 10 and 60';
        break;
      case 'systolic':
        if (numValue === null) error = 'Required';
        else if (numValue < 70 || numValue > 200) error = 'Range: 70-200';
        break;
      case 'diastolic':
        if (numValue === null) error = 'Required';
        else if (numValue < 40 || numValue > 130) error = 'Range: 40-130';
        break;
      case 'glucose':
        if (numValue === null) error = 'Required';
        else if (numValue < 50 || numValue > 300) error = 'Range: 50-300';
        break;
      case 'cholesterol':
        if (numValue === null) error = 'Required';
        else if (numValue < 100 || numValue > 400) error = 'Range: 100-400';
        break;
      case 'height':
        if (numValue !== null && (numValue < 50 || numValue > 250)) error = 'Range: 50-250 cm';
        break;
      case 'weight':
        if (numValue !== null && (numValue < 10 || numValue > 300)) error = 'Range: 10-300 kg';
        break;
      case 'heartRate':
        if (numValue !== null && (numValue < 30 || numValue > 220)) error = 'Range: 30-220 bpm';
        break;
      case 'sleepDuration':
        if (numValue !== null && (numValue < 0 || numValue > 24)) error = 'Range: 0-24 hours';
        break;
      case 'stressLevel':
        if (numValue !== null && (numValue < 1 || numValue > 10)) error = 'Range: 1-10';
        break;
      default:
        break;
    }

    setValidationErrors(prev => ({
      ...prev,
      [field]: error
    }));

    return error === '';
  };

  const handleInputChange = (field, value) => {
    // Trim if string
    const processedValue = typeof value === 'string' ? value.trim() : value;
    
    setHealthData(prev => ({
      ...prev,
      [field]: processedValue
    }));

    validateField(field, processedValue);
  };

  const handleBloodPressureChange = (type, value) => {
    setHealthData(prev => ({
      ...prev,
      bloodPressure: {
        ...prev.bloodPressure,
        [type]: value
      }
    }));

    validateField(type, value);
  };

  const handleCalculateClick = () => {
    // Validate all fields before showing summary
    const fieldsToValidate = ['age', 'gender', 'systolic', 'diastolic', 'glucose', 'cholesterol'];
    let hasErrors = false;

    fieldsToValidate.forEach(field => {
      const value = field === 'systolic' || field === 'diastolic' 
        ? healthData.bloodPressure[field] 
        : healthData[field];
      if (!validateField(field, value)) {
        hasErrors = true;
      }
    });

    if (hasErrors || Object.values(validationErrors).some(err => err)) {
      setError("Please fix the errors in the form before proceeding.");
      return;
    }

    setError(null);
    setShowSummary(true);
  };

  const confirmAndCalculate = async () => {
    setShowSummary(false);
    setLoading(true);
    setError(null);

    try {
      // Clean and convert data
      const cleanedData = {
        ...healthData,
        age: parseInt(healthData.age, 10),
        height: parseFloat(healthData.height),
        weight: parseFloat(healthData.weight),
        bmi: parseFloat(healthData.bmi),
        bloodPressure: {
          systolic: parseInt(healthData.bloodPressure.systolic, 10),
          diastolic: parseInt(healthData.bloodPressure.diastolic, 10)
        },
        cholesterol: parseInt(healthData.cholesterol, 10),
        glucose: parseInt(healthData.glucose, 10),
        heartRate: healthData.heartRate ? parseInt(healthData.heartRate, 10) : null,
        sleepDuration: healthData.sleepDuration ? parseFloat(healthData.sleepDuration) : null,
        stressLevel: parseInt(healthData.stressLevel, 10)
      };

      // Save cleaned data to localStorage
      localStorage.setItem('healthData', JSON.stringify(cleanedData));

      // Call ML service with cleaned data
      const result = await mlService.getHealthRiskAssessment(cleanedData);
      setRiskAssessment(result.riskAssessment);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setHealthData({
      age: '',
      gender: '',
      height: '',
      weight: '',
      bmi: '',
      bloodPressure: { systolic: '', diastolic: '' },
      cholesterol: '',
      glucose: '',
      heartRate: '',
      sleepDuration: '',
      physicalActivity: 'medium',
      alcoholConsumption: 'none',
      stressLevel: '5',
      familyHistory: 'no',
      existingConditions: '',
      smoking: 'never',
      exercise: 'occasional'
    });
    setValidationErrors({});
    setRiskAssessment(null);
    setError(null);
    localStorage.removeItem('healthData');
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <p className="text-gray-600">
          Get personalized health insights powered by machine learning algorithms.
          Enter your health metrics below for comprehensive risk assessment.
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            <button
              onClick={() => setActiveTab('assessment')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'assessment'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              Risk Assessment
            </button>
            <button
              onClick={() => setActiveTab('trends')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'trends'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              Health Trends
            </button>
            <button
              onClick={() => setActiveTab('insights')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'insights'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              AI Insights
            </button>
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'assessment' && (
            <div className="space-y-6">
              {/* Health Data Input Form */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Basic Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Basic Information</h3>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Age <span className="text-red-500">*</span>
                      <span className="ml-1 text-gray-400 group relative">
                        ⓘ
                        <span className="invisible group-hover:visible absolute z-10 w-48 p-2 bg-gray-800 text-white text-xs rounded shadow-lg -top-10 left-0">
                          Your chronological age in years.
                        </span>
                      </span>
                    </label>
                    <input
                      type="number"
                      value={healthData.age}
                      onChange={(e) => handleInputChange('age', e.target.value)}
                      className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                        validationErrors.age ? 'border-red-500 bg-red-50' : 'border-gray-300'
                      }`}
                      placeholder="e.g., 25"
                      min="1"
                      max="120"
                    />
                    {validationErrors.age && <p className="mt-1 text-xs text-red-500">{validationErrors.age}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Gender <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={healthData.gender}
                      onChange={(e) => handleInputChange('gender', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select gender</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Height (cm)
                      </label>
                      <input
                        type="number"
                        value={healthData.height}
                        onChange={(e) => handleInputChange('height', e.target.value)}
                        className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          validationErrors.height ? 'border-red-500 bg-red-50' : 'border-gray-300'
                        }`}
                        placeholder="e.g., 175"
                      />
                      {validationErrors.height && <p className="mt-1 text-xs text-red-500">{validationErrors.height}</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Weight (kg)
                      </label>
                      <input
                        type="number"
                        value={healthData.weight}
                        onChange={(e) => handleInputChange('weight', e.target.value)}
                        className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          validationErrors.weight ? 'border-red-500 bg-red-50' : 'border-gray-300'
                        }`}
                        placeholder="e.g., 70"
                      />
                      {validationErrors.weight && <p className="mt-1 text-xs text-red-500">{validationErrors.weight}</p>}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      BMI (Body Mass Index)
                      <span className="ml-2 text-xs text-gray-500 font-normal">(Auto-calculated)</span>
                    </label>
                    <input
                      type="number"
                      value={healthData.bmi}
                      readOnly
                      className={`w-full px-3 py-2 border bg-gray-50 rounded-md cursor-not-allowed ${
                        validationErrors.bmi ? 'border-red-500 text-red-500' : 'border-gray-300 text-gray-700'
                      }`}
                      placeholder="Auto-calculated"
                      step="0.1"
                    />
                    {validationErrors.bmi && <p className="mt-1 text-xs text-red-500">{validationErrors.bmi}</p>}
                  </div>
                </div>

                {/* Vital Signs */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Vital Signs</h3>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Blood Pressure (mmHg) <span className="text-red-500">*</span>
                    </label>
                    <div className="flex space-x-2">
                      <div className="flex-1">
                        <input
                          type="number"
                          value={healthData.bloodPressure.systolic}
                          onChange={(e) => handleBloodPressureChange('systolic', e.target.value)}
                          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                            validationErrors.systolic ? 'border-red-500 bg-red-50' : 'border-gray-300'
                          }`}
                          placeholder="Sys"
                        />
                      </div>
                      <span className="flex items-center text-gray-500">/</span>
                      <div className="flex-1">
                        <input
                          type="number"
                          value={healthData.bloodPressure.diastolic}
                          onChange={(e) => handleBloodPressureChange('diastolic', e.target.value)}
                          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                            validationErrors.diastolic ? 'border-red-500 bg-red-50' : 'border-gray-300'
                          }`}
                          placeholder="Dia"
                        />
                      </div>
                    </div>
                    {(validationErrors.systolic || validationErrors.diastolic) && (
                      <p className="mt-1 text-xs text-red-500">
                        {validationErrors.systolic || validationErrors.diastolic}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Cholesterol (mg/dL) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        value={healthData.cholesterol}
                        onChange={(e) => handleInputChange('cholesterol', e.target.value)}
                        className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          validationErrors.cholesterol ? 'border-red-500 bg-red-50' : 'border-gray-300'
                        }`}
                        placeholder="e.g., 180"
                      />
                      {validationErrors.cholesterol && <p className="mt-1 text-xs text-red-500">{validationErrors.cholesterol}</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Glucose (mg/dL) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        value={healthData.glucose}
                        onChange={(e) => handleInputChange('glucose', e.target.value)}
                        className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          validationErrors.glucose ? 'border-red-500 bg-red-50' : 'border-gray-300'
                        }`}
                        placeholder="e.g., 95"
                      />
                      {validationErrors.glucose && <p className="mt-1 text-xs text-red-500">{validationErrors.glucose}</p>}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 group relative">
                      Heart Rate (bpm)
                      <span className="ml-1 text-gray-400">ⓘ</span>
                      <span className="invisible group-hover:visible absolute z-10 w-48 p-2 bg-gray-800 text-white text-xs rounded shadow-lg -top-10 left-0">
                        Resting heart rate in beats per minute.
                      </span>
                    </label>
                    <input
                      type="number"
                      value={healthData.heartRate}
                      onChange={(e) => handleInputChange('heartRate', e.target.value)}
                      className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        validationErrors.heartRate ? 'border-red-500 bg-red-50' : 'border-gray-300'
                      }`}
                      placeholder="e.g., 72"
                    />
                    {validationErrors.heartRate && <p className="mt-1 text-xs text-red-500">{validationErrors.heartRate}</p>}
                  </div>
                </div>                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Lifestyle & Additional</h3>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Smoking
                      </label>
                      <select
                        value={healthData.smoking}
                        onChange={(e) => handleInputChange('smoking', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="never">Never</option>
                        <option value="former">Former</option>
                        <option value="current">Current</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Alcohol
                      </label>
                      <select
                        value={healthData.alcoholConsumption}
                        onChange={(e) => handleInputChange('alcoholConsumption', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="none">None</option>
                        <option value="occasional">Occasional</option>
                        <option value="frequent">Frequent</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Physical Activity Level
                    </label>
                    <select
                      value={healthData.physicalActivity}
                      onChange={(e) => handleInputChange('physicalActivity', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="low">Low (Sedentary)</option>
                      <option value="medium">Medium (Moderate)</option>
                      <option value="high">High (Active)</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Sleep (hrs/day)
                      </label>
                      <input
                        type="number"
                        value={healthData.sleepDuration}
                        onChange={(e) => handleInputChange('sleepDuration', e.target.value)}
                        className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          validationErrors.sleepDuration ? 'border-red-500 bg-red-50' : 'border-gray-300'
                        }`}
                        placeholder="e.g., 8"
                      />
                      {validationErrors.sleepDuration && <p className="mt-1 text-xs text-red-500">{validationErrors.sleepDuration}</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Stress (1-10)
                      </label>
                      <input
                        type="number"
                        value={healthData.stressLevel}
                        onChange={(e) => handleInputChange('stressLevel', e.target.value)}
                        className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          validationErrors.stressLevel ? 'border-red-500 bg-red-50' : 'border-gray-300'
                        }`}
                        placeholder="1-10"
                        min="1"
                        max="10"
                      />
                      {validationErrors.stressLevel && <p className="mt-1 text-xs text-red-500">{validationErrors.stressLevel}</p>}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Family Medical History
                    </label>
                    <div className="flex space-x-4">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          value="yes"
                          checked={healthData.familyHistory === 'yes'}
                          onChange={(e) => handleInputChange('familyHistory', e.target.value)}
                          className="mr-2"
                        />
                        Yes
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          value="no"
                          checked={healthData.familyHistory === 'no'}
                          onChange={(e) => handleInputChange('familyHistory', e.target.value)}
                          className="mr-2"
                        />
                        No
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Existing Conditions
                    </label>
                    <textarea
                      value={healthData.existingConditions}
                      onChange={(e) => handleInputChange('existingConditions', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., Diabetes, Hypertension"
                      rows="2"
                    ></textarea>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col space-y-3 pt-6 border-t border-gray-200">
                <div className="flex space-x-4">
                  <button
                    onClick={handleCalculateClick}
                    disabled={loading || Object.values(validationErrors).some(err => err)}
                    className={`flex-1 px-6 py-3 rounded-md font-bold text-white transition-all shadow-md ${
                      loading || Object.values(validationErrors).some(err => err)
                        ? 'bg-gray-400 cursor-not-allowed shadow-none'
                        : 'bg-blue-600 hover:bg-blue-700 hover:shadow-lg active:transform active:scale-95'
                    }`}
                  >
                    {loading ? (
                      <span className="flex items-center justify-center">
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Analyzing...
                      </span>
                    ) : 'Calculate Health Risk'}
                  </button>
                  <button
                    onClick={resetForm}
                    className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md font-semibold transition-colors border border-gray-300"
                  >
                    Reset Form
                  </button>
                </div>
                {Object.values(validationErrors).some(err => err) && (
                  <p className="text-center text-sm text-red-600 font-medium animate-pulse">
                    Please correct invalid fields before calculating risk.
                  </p>
                )}
              </div>

              {/* Error Display */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-md p-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-red-800">{error}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'trends' && (
            <HealthMetricsChart />
          )}

          {activeTab === 'insights' && (
            <div className="text-center py-12">
              <div className="text-gray-500">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">AI Insights Coming Soon</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Advanced AI-powered health insights and recommendations will be available here.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Risk Assessment Results */}
      {riskAssessment && (
        <HealthRiskSummary assessment={riskAssessment} />
      )}

      {/* Summary Modal */}
      {showSummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">Health Data Summary</h2>
              <p className="text-gray-500 text-sm mt-1">Please review your information before analyzing risk.</p>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold text-blue-600 mb-2 uppercase text-xs tracking-wider">Basic Info</h4>
                  <ul className="space-y-1 text-sm">
                    <li><span className="text-gray-500">Age:</span> {healthData.age}</li>
                    <li><span className="text-gray-500">Gender:</span> {healthData.gender}</li>
                    <li><span className="text-gray-500">Height:</span> {healthData.height} cm</li>
                    <li><span className="text-gray-500">Weight:</span> {healthData.weight} kg</li>
                    <li><span className="text-gray-500">BMI:</span> {healthData.bmi}</li>
                  </ul>
                </div>
                
                <div>
                  <h4 className="font-semibold text-blue-600 mb-2 uppercase text-xs tracking-wider">Vital Signs</h4>
                  <ul className="space-y-1 text-sm">
                    <li><span className="text-gray-500">Blood Pressure:</span> {healthData.bloodPressure.systolic}/{healthData.bloodPressure.diastolic}</li>
                    <li><span className="text-gray-500">Cholesterol:</span> {healthData.cholesterol} mg/dL</li>
                    <li><span className="text-gray-500">Glucose:</span> {healthData.glucose} mg/dL</li>
                    <li><span className="text-gray-500">Heart Rate:</span> {healthData.heartRate || 'N/A'} bpm</li>
                  </ul>
                </div>

                <div className="md:col-span-2">
                  <h4 className="font-semibold text-blue-600 mb-2 uppercase text-xs tracking-wider">Lifestyle & Additional</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <ul className="space-y-1">
                      <li><span className="text-gray-500">Smoking:</span> {healthData.smoking}</li>
                      <li><span className="text-gray-500">Alcohol:</span> {healthData.alcoholConsumption}</li>
                      <li><span className="text-gray-500">Activity:</span> {healthData.physicalActivity}</li>
                    </ul>
                    <ul className="space-y-1">
                      <li><span className="text-gray-500">Sleep:</span> {healthData.sleepDuration} hrs</li>
                      <li><span className="text-gray-500">Stress:</span> {healthData.stressLevel}/10</li>
                      <li><span className="text-gray-500">Family History:</span> {healthData.familyHistory}</li>
                    </ul>
                  </div>
                  {healthData.existingConditions && (
                    <div className="mt-3 p-3 bg-gray-50 rounded border border-gray-200">
                      <span className="text-xs font-semibold text-gray-500 uppercase block mb-1">Conditions</span>
                      <p className="text-sm text-gray-700">{healthData.existingConditions}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 bg-gray-50 rounded-b-xl flex space-x-4">
              <button
                onClick={() => setShowSummary(false)}
                className="flex-1 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors font-medium"
              >
                Go Back & Edit
              </button>
              <button
                onClick={confirmAndCalculate}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-bold shadow-md"
              >
                Confirm & Analyze
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HealthAnalyticsDashboard;
