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
    bloodPressure: { systolic: '', diastolic: '' },
    cholesterol: '',
    glucose: '',
    bmi: '',
    smoking: 'never',
    exercise: 'occasional'
  });
  const [riskAssessment, setRiskAssessment] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('assessment');

  // Load user's health data from profile or local storage
  useEffect(() => {
    const loadHealthData = () => {
      const savedData = localStorage.getItem('healthData');
      if (savedData) {
        setHealthData(JSON.parse(savedData));
      }
    };
    loadHealthData();
  }, []);

  const handleInputChange = (field, value) => {
    setHealthData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleBloodPressureChange = (type, value) => {
    setHealthData(prev => ({
      ...prev,
      bloodPressure: {
        ...prev.bloodPressure,
        [type]: value
      }
    }));
  };

  const calculateHealthRisk = async () => {
    setLoading(true);
    setError(null);

    try {
      // Validate required fields
      const requiredFields = ['age', 'gender'];
      const missingFields = requiredFields.filter(field => !healthData[field]);

      if (missingFields.length > 0) {
        throw new Error(`Please fill in required fields: ${missingFields.join(', ')}`);
      }

      // Save data to localStorage
      localStorage.setItem('healthData', JSON.stringify(healthData));

      // Call ML service
      const result = await mlService.getHealthRiskAssessment(healthData);
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
      bloodPressure: { systolic: '', diastolic: '' },
      cholesterol: '',
      glucose: '',
      bmi: '',
      smoking: 'never',
      exercise: 'occasional'
    });
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
                  <h3 className="text-lg font-semibold text-gray-900">Basic Information</h3>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Age <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      value={healthData.age}
                      onChange={(e) => handleInputChange('age', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter your age"
                      min="1"
                      max="120"
                    />
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

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      BMI (Body Mass Index)
                    </label>
                    <input
                      type="number"
                      value={healthData.bmi}
                      onChange={(e) => handleInputChange('bmi', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., 24.5"
                      step="0.1"
                      min="10"
                      max="50"
                    />
                  </div>
                </div>

                {/* Vital Signs */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900">Vital Signs</h3>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Blood Pressure (mmHg)
                    </label>
                    <div className="flex space-x-2">
                      <input
                        type="number"
                        value={healthData.bloodPressure.systolic}
                        onChange={(e) => handleBloodPressureChange('systolic', e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Systolic"
                        min="80"
                        max="250"
                      />
                      <span className="flex items-center text-gray-500">/</span>
                      <input
                        type="number"
                        value={healthData.bloodPressure.diastolic}
                        onChange={(e) => handleBloodPressureChange('diastolic', e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Diastolic"
                        min="50"
                        max="150"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Cholesterol (mg/dL)
                    </label>
                    <input
                      type="number"
                      value={healthData.cholesterol}
                      onChange={(e) => handleInputChange('cholesterol', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Total cholesterol"
                      min="100"
                      max="400"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Glucose (mg/dL)
                    </label>
                    <input
                      type="number"
                      value={healthData.glucose}
                      onChange={(e) => handleInputChange('glucose', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Fasting glucose"
                      min="50"
                      max="300"
                    />
                  </div>
                </div>

                {/* Lifestyle Factors */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900">Lifestyle</h3>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Smoking Status
                    </label>
                    <select
                      value={healthData.smoking}
                      onChange={(e) => handleInputChange('smoking', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="never">Never smoked</option>
                      <option value="former">Former smoker</option>
                      <option value="current">Current smoker</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Exercise Frequency
                    </label>
                    <select
                      value={healthData.exercise}
                      onChange={(e) => handleInputChange('exercise', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="sedentary">Sedentary (little to no exercise)</option>
                      <option value="occasional">Occasional (1-2 times/week)</option>
                      <option value="regular">Regular (3+ times/week)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-4 pt-6 border-t border-gray-200">
                <button
                  onClick={calculateHealthRisk}
                  disabled={loading}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-6 py-2 rounded-md font-medium transition-colors"
                >
                  {loading ? 'Analyzing...' : 'Calculate Health Risk'}
                </button>
                <button
                  onClick={resetForm}
                  className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-2 rounded-md font-medium transition-colors"
                >
                  Reset Form
                </button>
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
    </div>
  );
};

export default HealthAnalyticsDashboard;
