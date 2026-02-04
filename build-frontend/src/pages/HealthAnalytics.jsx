import React from 'react';
import HealthAnalyticsDashboard from '../components/HealthAnalyticsDashboard';

const HealthAnalytics = () => {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-3">
          <h1 className="text-3xl font-bold text-gray-900">Health Analytics</h1>
        </div>
        <HealthAnalyticsDashboard />
      </div>
    </div>
  );
};

export default HealthAnalytics;
