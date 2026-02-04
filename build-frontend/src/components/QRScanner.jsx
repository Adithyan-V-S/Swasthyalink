import React, { useState, useEffect, useRef } from 'react';
import { Html5QrcodeScanner, Html5QrcodeSupportedFormats } from 'html5-qrcode';

const QRScanner = ({ onScan, onError, onClose, isActive }) => {
  const [scanResult, setScanResult] = useState(null);
  const [isReady, setIsReady] = useState(false);
  const scannerRef = useRef(null);

  // Use a stable element ID
  const qrcodeRegionId = "html5qr-code-full-region";

  useEffect(() => {
    // Only initialize scanner if active and not already running
    if (isActive && !scannerRef.current) {
      // Short delay to ensure DOM is ready
      const timer = setTimeout(() => {
        startScanner();
      }, 100);
      return () => clearTimeout(timer);
    }

    // Cleanup function
    return () => {
      stopScanner();
    };
  }, [isActive]);

  const startScanner = () => {
    try {
      // Config for the scanner
      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE]
      };

      // Create instance if not exists
      // Note: Html5QrcodeScanner builds its own UI. 
      // If we want custom UI we should use Html5Qrcode class instead.
      // For simplicity and robustness, using the Scanner UI first.

      // clear any previous instance
      if (scannerRef.current) {
        scannerRef.current.clear().catch(err => console.error('Failed to clear scanner', err));
      }

      const scanner = new Html5QrcodeScanner(qrcodeRegionId, config, /* verbose= */ false);
      scannerRef.current = scanner;

      scanner.render((decodedText, decodedResult) => {
        console.log('Code scanned =', decodedText);
        if (onScan) {
          onScan(decodedText);
          stopScanner(); // Stop after successful scan
        }
      }, (errorMessage) => {
        // parse error, ignore it.
        // console.log('Scan parse error=', errorMessage);
      });

      setIsReady(true);
    } catch (err) {
      console.error("Error starting scanner:", err);
      if (onError) onError(err.message);
    }
  };

  const stopScanner = () => {
    if (scannerRef.current) {
      try {
        scannerRef.current.clear().catch(error => {
          console.error("Failed to clear html5-qrcode scanner. ", error);
        });
      } catch (e) {
        console.error("Error stopping scanner", e);
      }
      scannerRef.current = null;
      setIsReady(false);
    }
  };

  const handleManualInput = (qrData) => {
    if (qrData.trim() && onScan) {
      onScan(qrData.trim());
    }
  };

  return (
    <div className="relative bg-white p-4 rounded-lg">
      <h3 className="text-lg font-semibold text-center mb-4">Scan Patient QR Code</h3>

      {!isActive ? (
        <div className="text-center p-4">Scanner is closed</div>
      ) : (
        <div id={qrcodeRegionId} className="w-full max-w-sm mx-auto overflow-hidden"></div>
      )}

      <div className="mt-4 flex justify-between items-center">
        <button
          onClick={onClose}
          className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
        >
          Close
        </button>
      </div>

      {/* Manual input option */}
      <div className="mt-6 border-t pt-4">
        <ManualQRInput onSubmit={handleManualInput} />
      </div>
    </div>
  );
};

const ManualQRInput = ({ onSubmit }) => {
  const [qrData, setQrData] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (qrData.trim()) {
      onSubmit(qrData);
      setQrData('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Or paste QR code data manually:
        </label>
        <input
          type="text"
          value={qrData}
          onChange={(e) => setQrData(e.target.value)}
          placeholder="https://swasthyalink.com/patient/..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>
      <button
        type="submit"
        disabled={!qrData.trim()}
        className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
      >
        Process QR Data
      </button>
    </form>
  );
};

export default QRScanner;
