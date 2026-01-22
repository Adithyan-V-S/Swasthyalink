import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

const FamilyCleanupButton = () => {
  const [isCleaning, setIsCleaning] = useState(false);
  const [message, setMessage] = useState('');
  const { user } = useAuth();

  const handleCleanup = async () => {
    if (!user?.uid) {
      setMessage('❌ User not authenticated');
      return;
    }

    if (!window.confirm('This will remove duplicate family members. Continue?')) {
      return;
    }

    setIsCleaning(true);
    setMessage('');

    try {
      const REGION = 'us-central1';
      const PROJECT_ID = 'swasthyalink-42535';
      const CLOUD_FUNCTIONS_BASE = `https://${REGION}-${PROJECT_ID}.cloudfunctions.net`;

      const response = await fetch(`${CLOUD_FUNCTIONS_BASE}/cleanupFamilyDuplicates?uid=${user.uid}`, {
        method: 'POST'
      });

      const result = await response.json();

      if (result.success) {
        setMessage(`✅ Duplicates cleaned up successfully! Removed ${result.duplicatesRemoved || 0} duplicates. Please refresh the page.`);
      } else {
        setMessage('❌ Failed to cleanup duplicates: ' + result.error);
      }
    } catch (error) {
      console.error('Error cleaning up duplicates:', error);
      setMessage('❌ Error: ' + error.message);
    } finally {
      setIsCleaning(false);
    }
  };

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-yellow-800">
            Fix Duplicate Family Members
          </h3>
          <p className="text-sm text-yellow-700 mt-1">
            If you see duplicate family members, click this button to clean them up.
          </p>
          {message && (
            <p className="text-sm mt-2 font-medium">{message}</p>
          )}
        </div>
        <button
          onClick={handleCleanup}
          disabled={isCleaning}
          className="bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isCleaning ? 'Cleaning...' : 'Fix Duplicates'}
        </button>
      </div>
    </div>
  );
};

export default FamilyCleanupButton;


