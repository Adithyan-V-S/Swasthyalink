import React, { useRef, useState, useEffect, useCallback } from 'react';
import Webcam from 'react-webcam';
import * as tf from '@tensorflow/tfjs';
import * as poseDetection from '@tensorflow-models/pose-detection';
import '@tensorflow/tfjs-backend-webgl'; // Register WebGL backend

const AIExerciseCoach = () => {
    const webcamRef = useRef(null);
    const canvasRef = useRef(null);
    const [detector, setDetector] = useState(null);
    const [feedback, setFeedback] = useState("Loading AI Model...");
    const [count, setCount] = useState(0);
    const [isSquatting, setIsSquatting] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [exerciseType, setExerciseType] = useState('squat'); // Default to squat

    // Load MoveNet model
    useEffect(() => {
        const loadModel = async () => {
            try {
                await tf.ready();
                const model = poseDetection.SupportedModels.MoveNet;
                const detectorConfig = {
                    modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING // Fastest model
                };
                const newDetector = await poseDetection.createDetector(model, detectorConfig);
                setDetector(newDetector);
                setIsLoading(false);
                setFeedback("Get ready! Stand in full view.");
            } catch (error) {
                console.error("Failed to load MoveNet:", error);
                setFeedback("Error loading AI. Please refresh.");
            }
        };
        loadModel();
    }, []);

    // Drawing helper: Draw keypoints and skeleton
    const drawPose = (pose, ctx) => {
        if (!pose || !pose.keypoints) return;

        const keypoints = pose.keypoints;
        const minConfidence = 0.3;

        // Draw keypoints
        keypoints.forEach((keypoint) => {
            if (keypoint.score > minConfidence) {
                const { x, y } = keypoint;
                ctx.beginPath();
                ctx.arc(x, y, 5, 0, 2 * Math.PI);
                ctx.fillStyle = '#00ff00'; // Green dots
                ctx.fill();
            }
        });

        // Draw skeleton lines
        const adjacencies = poseDetection.util.getAdjacentPairs(poseDetection.SupportedModels.MoveNet);
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 2;
        adjacencies.forEach(([i, j]) => {
            const kp1 = keypoints[i];
            const kp2 = keypoints[j];
            if (kp1.score > minConfidence && kp2.score > minConfidence) {
                ctx.beginPath();
                ctx.moveTo(kp1.x, kp1.y);
                ctx.lineTo(kp2.x, kp2.y);
                ctx.stroke();
            }
        });
    };

    // calculate angle between three points (A, B, C) where B is the vertex
    const calculateAngle = (a, b, c) => {
        const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
        let angle = Math.abs(radians * 180.0 / Math.PI);
        if (angle > 180.0) angle = 360.0 - angle;
        return angle;
    };

    // Exercise Analysis Logic
    const analyzePose = useCallback((pose) => {
        if (!pose || !pose.keypoints) return;
        const keypoints = pose.keypoints;

        // Keypoint indices for MoveNet: 
        // 11: left_hip, 12: right_hip, 13: left_knee, 14: right_knee, 15: left_ankle, 16: right_ankle
        const leftHip = keypoints[11];
        const leftKnee = keypoints[13];
        const leftAnkle = keypoints[15];

        const rightHip = keypoints[12];
        const rightKnee = keypoints[14];
        const rightAnkle = keypoints[16];

        const minConfidence = 0.4;

        // Ensure necessary points are visible
        if (leftHip.score > minConfidence && leftKnee.score > minConfidence && leftAnkle.score > minConfidence) {

            // Calculate Knee Angle (Squat depth)
            const kneeAngle = calculateAngle(leftHip, leftKnee, leftAnkle);

            // Squat Logic
            if (exerciseType === 'squat') {
                if (kneeAngle < 100) { // Squatting down (deep enough)
                    if (!isSquatting) {
                        setIsSquatting(true);
                        setFeedback("Good depth! Now stand up.");
                    }
                }

                if (kneeAngle > 160) { // Standing up
                    if (isSquatting) {
                        setIsSquatting(false);
                        setCount(prev => prev + 1);
                        setFeedback("Great Rep! Keep going.");
                    } else {
                        setFeedback("Ready. Lower your hips.");
                    }
                }
            }
        } else {
            setFeedback("Make sure your full body is visible.");
        }
    }, [isSquatting, exerciseType]);


    // Detection Loop
    const runDetection = useCallback(async () => {
        if (
            typeof webcamRef.current !== "undefined" &&
            webcamRef.current !== null &&
            webcamRef.current.video.readyState === 4 &&
            detector
        ) {
            // Get Video Properties
            const video = webcamRef.current.video;
            const videoWidth = video.videoWidth;
            const videoHeight = video.videoHeight;

            // Set video width
            webcamRef.current.video.width = videoWidth;
            webcamRef.current.video.height = videoHeight;

            // Set canvas width
            canvasRef.current.width = videoWidth;
            canvasRef.current.height = videoHeight;

            // Make Detections
            const poses = await detector.estimatePoses(video);

            if (poses.length > 0) {
                const pose = poses[0];
                analyzePose(pose);
                const ctx = canvasRef.current.getContext("2d");
                ctx.clearRect(0, 0, videoWidth, videoHeight);
                drawPose(pose, ctx);
            }
        }
    }, [detector, analyzePose]);

    // Use requestAnimationFrame for the loop
    useEffect(() => {
        let animationFrameId;
        const loop = async () => {
            await runDetection();
            animationFrameId = requestAnimationFrame(loop);
        };
        loop();
        return () => cancelAnimationFrame(animationFrameId);
    }, [runDetection]);


    return (
        <div className="flex flex-col items-center justify-center p-6 bg-gray-50 rounded-3xl min-h-[600px]">
            {/* Header */}
            <div className="w-full flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">AI Exercise Coach</h2>
                    <p className="text-gray-500">Real-time posture analysis</p>
                </div>
                <div className="bg-indigo-100 text-indigo-700 px-4 py-2 rounded-xl font-bold text-lg">
                    Reps: {count}
                </div>
            </div>

            {/* Canvas/Video Container */}
            <div className="relative w-full max-w-2xl aspect-video bg-black rounded-2xl overflow-hidden shadow-xl border-4 border-white">
                {isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center z-20 bg-black bg-opacity-80 text-white">
                        <div className="flex flex-col items-center animate-pulse">
                            <svg className="w-10 h-10 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                            </svg>
                            <p>Loading AI Model...</p>
                        </div>
                    </div>
                )}

                <Webcam
                    ref={webcamRef}
                    mirrored={true}
                    className="absolute inset-0 w-full h-full object-cover z-0"
                />
                <canvas
                    ref={canvasRef}
                    className="absolute inset-0 w-full h-full object-cover z-10"
                />

                {/* Feedback Overlay */}
                <div className="absolute bottom-6 left-0 right-0 flex justify-center z-20">
                    <div className="bg-white/90 backdrop-blur-sm px-6 py-3 rounded-full shadow-lg border border-gray-200">
                        <p className={`text-lg font-bold ${feedback.includes('Great') || feedback.includes('Good') ? 'text-green-600' : 'text-indigo-600'}`}>
                            {feedback}
                        </p>
                    </div>
                </div>
            </div>

            {/* Controls */}
            <div className="mt-8 flex gap-4">
                <button
                    onClick={() => setCount(0)}
                    className="px-6 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-semibold transition"
                >
                    Reset Counter
                </button>
                <select
                    value={exerciseType}
                    onChange={(e) => setExerciseType(e.target.value)}
                    className="px-6 py-2 bg-white border border-gray-200 rounded-lg font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                    <option value="squat">Squat</option>
                    {/* Can add more types later */}
                </select>
            </div>
        </div>
    );
};

export default AIExerciseCoach;
