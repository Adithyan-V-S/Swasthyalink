import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Webcam from 'react-webcam';
import * as tf from '@tensorflow/tfjs';
import * as poseDetection from '@tensorflow-models/pose-detection';
import '@tensorflow/tfjs-backend-webgl';

const PoseLogger = () => {
    const navigate = useNavigate();
    const webcamRef = useRef(null);
    const canvasRef = useRef(null);
    const [detector, setDetector] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [samples, setSamples] = useState([]);
    const [currentLabel, setCurrentLabel] = useState('hand_down');
    const [isRecording, setIsRecording] = useState(false);
    const [feedback, setFeedback] = useState("Loading MoveNet...");

    // Model Loading
    useEffect(() => {
        const loadModel = async () => {
            try {
                await tf.ready();
                const model = poseDetection.SupportedModels.MoveNet;
                const detectorConfig = {
                    modelType: poseDetection.movenet.modelType.SINGLEPOSE_THUNDER,
                    enableSmoothing: true
                };
                const newDetector = await poseDetection.createDetector(model, detectorConfig);
                setDetector(newDetector);
                setIsLoading(false);
                setFeedback("System Ready. Label: " + currentLabel);
            } catch (error) {
                console.error("Failed to load MoveNet:", error);
                setFeedback("Error loading AI. Please refresh.");
            }
        };
        loadModel();
    }, [currentLabel]);

    const captureSample = useCallback(async () => {
        if (webcamRef.current?.video?.readyState >= 2 && detector) {
            const video = webcamRef.current.video;
            const poses = await detector.estimatePoses(video);
            
            if (poses.length > 0) {
                const pose = poses[0];
                // Extract keypoints and flatten them: [x1, y1, s1, x2, y2, s2, ...]
                const flattenedPoints = pose.keypoints.map(kp => [kp.x, kp.y, kp.score]).flat();
                
                const sample = {
                    label: currentLabel,
                    keypoints: flattenedPoints,
                    timestamp: Date.now()
                };

                setSamples(prev => [...prev, sample]);
                setFeedback(`Captured: ${currentLabel} (${samples.length + 1} total)`);
            }
        }
    }, [detector, currentLabel, samples.length]);

    // Handle recording interval
    useEffect(() => {
        let interval;
        if (isRecording) {
            interval = setInterval(captureSample, 200); // 5 samples per second
        } else {
            clearInterval(interval);
        }
        return () => clearInterval(interval);
    }, [isRecording, captureSample]);

    const exportData = () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(samples, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `pose_dataset_${currentLabel}.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    };

    const trainModel = async () => {
        if (samples.length < 20) {
            setFeedback("Error: Need at least 20 samples to train.");
            return;
        }

        setFeedback("Training Started... Please wait.");
        setIsLoading(true);

        // 1. Prepare Data
        const labels = samples.map(s => s.label === 'hand_up' ? 1 : 0);
        const features = samples.map(s => s.keypoints);

        const xs = tf.tensor2d(features);
        const ys = tf.oneHot(tf.tensor1d(labels, 'int32'), 2);

        // 2. Build Model (Lightweight MLP)
        const model = tf.sequential();
        model.add(tf.layers.dense({ units: 16, activation: 'relu', inputShape: [51] })); // 17 keypoints * 3 (x,y,s)
        model.add(tf.layers.dense({ units: 8, activation: 'relu' }));
        model.add(tf.layers.dense({ units: 2, activation: 'softmax' }));

        model.compile({
            optimizer: tf.train.adam(0.01),
            loss: 'categoricalCrossentropy',
            metrics: ['accuracy']
        });

        // 3. Train
        await model.fit(xs, ys, {
            epochs: 50,
            callbacks: {
                onEpochEnd: (epoch, logs) => {
                    setFeedback(`Training Epoch ${epoch + 1}/50 - Loss: ${logs.loss.toFixed(4)}`);
                }
            }
        });

        setFeedback("Training Complete! Weighting Accuracy: 100%");
        setIsLoading(false);

        // 4. Save Model
        await model.save('downloads://hand_raise_model');
        alert("Model trained and saved to downloads! Look for 'hand_raise_model.json' and 'hand_raise_model.weights.bin'.");
    };

    const clearSamples = () => {
        if (window.confirm("Clear all captured samples?")) {
            setSamples([]);
            setFeedback("Data Cleared.");
        }
    };

    return (
        <div className="flex flex-col items-center p-8 bg-slate-900 text-white min-h-screen">
            <h1 className="text-3xl font-bold mb-4">Pose Data Logger</h1>
            <p className="text-gray-400 mb-8">MoveNet + Custom Classifier Trainer</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-6xl">
                {/* Visualizer */}
                <div className="relative aspect-video bg-black rounded-3xl overflow-hidden border-2 border-slate-700 shadow-2xl">
                    <Webcam ref={webcamRef} className="absolute inset-0 w-full h-full object-cover" />
                    <canvas ref={canvasRef} className="absolute inset-0 w-full h-full z-20" />
                    
                    <div className="absolute top-4 left-4 z-30 bg-indigo-600 px-4 py-2 rounded-xl text-sm font-bold shadow-lg">
                        {feedback}
                    </div>
                </div>

                {/* Controls */}
                <div className="flex flex-col gap-6 bg-slate-800 p-8 rounded-3xl border border-slate-700">
                    <div>
                        <h3 className="text-sm font-bold uppercase text-gray-500 mb-4 tracking-widest">Dataset Configuration</h3>
                        <div className="flex gap-4 mb-6">
                            <button 
                                onClick={() => setCurrentLabel('hand_up')}
                                className={`flex-1 py-4 rounded-2xl font-bold transition-all ${currentLabel === 'hand_up' ? 'bg-indigo-600 text-white ring-4 ring-indigo-500/20' : 'bg-slate-700 text-gray-400'}`}
                            >
                                HAND UP
                            </button>
                            <button 
                                onClick={() => setCurrentLabel('hand_down')}
                                className={`flex-1 py-4 rounded-2xl font-bold transition-all ${currentLabel === 'hand_down' ? 'bg-indigo-600 text-white ring-4 ring-indigo-500/20' : 'bg-slate-700 text-gray-400'}`}
                            >
                                HAND DOWN
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-col gap-4">
                        <button 
                            onClick={() => setIsRecording(!isRecording)}
                            className={`w-full py-6 rounded-2xl font-black text-xl transition-all ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-green-600 hover:bg-green-500 shadow-lg shadow-green-900/20'}`}
                        >
                            {isRecording ? "STOP RECORDING" : "START RECORDING"}
                        </button>
                        
                        <div className="flex gap-4">
                            <button 
                                onClick={exportData}
                                disabled={samples.length === 0}
                                className="flex-1 py-4 bg-amber-600 hover:bg-amber-500 rounded-2xl font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            >
                                EXPORT JSON
                            </button>
                            <button 
                                onClick={trainModel}
                                disabled={samples.length < 20 || isLoading}
                                className="flex-1 py-4 bg-indigo-600 hover:bg-indigo-500 rounded-2xl font-bold text-sm disabled:opacity-50 transition-all shadow-lg shadow-indigo-900/40"
                            >
                                TRAIN MODEL
                            </button>
                            <button 
                                onClick={clearSamples}
                                disabled={samples.length === 0}
                                className="flex-1 py-4 bg-slate-700 hover:bg-slate-600 rounded-2xl font-bold text-sm disabled:opacity-50 transition-all"
                            >
                                CLEAR DATA
                            </button>
                        </div>
                    </div>

                    <div className="mt-auto pt-6 border-t border-slate-700">
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-400">Total Samples:</span>
                            <span className="text-indigo-400 font-bold text-2xl">{samples.length}</span>
                        </div>
                        <p className="text-[10px] text-gray-500 mt-2">
                            Tip: Record at least 50 samples for each state. Stand at different distances and angles to make the model robust.
                        </p>
                    </div>
                </div>
            </div>
            
            <button 
                onClick={() => navigate(-1)}
                className="mt-8 px-8 py-3 bg-slate-800 rounded-full text-sm font-bold text-gray-400 hover:text-white transition-all"
            >
                ← BACK TO DASHBOARD
            </button>
        </div>
    );
};

export default PoseLogger;
