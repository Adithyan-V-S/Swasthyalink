import React, { useRef, useState, useEffect, useCallback } from 'react';
import Webcam from 'react-webcam';
import * as tf from '@tensorflow/tfjs';
import * as poseDetection from '@tensorflow-models/pose-detection';
import '@tensorflow/tfjs-backend-webgl';

// Exercise Database with Demonstration Content
const EXERCISE_DATA = {
    squat: {
        name: 'Squat',
        demoUrl: 'https://upload.wikimedia.org/wikipedia/commons/5/52/Squats_01.gif',
        instructions: 'Lower your hips until they are below your knees. Keep your back straight.',
        checks: ['depth', 'posture']
    },
    pushup: {
        name: 'Push-up',
        demoUrl: 'https://upload.wikimedia.org/wikipedia/commons/b/b3/Push-up-CDC_strength_training_for_older_adults.gif',
        instructions: 'Lower your chest to the floor. Keep your body in a straight line.',
        checks: ['depth', 'line']
    }
};

const AIExerciseCoach = () => {
    const webcamRef = useRef(null);
    const canvasRef = useRef(null);
    const [detector, setDetector] = useState(null);
    const [feedback, setFeedback] = useState("Loading AI Model...");
    const [count, setCount] = useState(0);
    const [isSquatting, setIsSquatting] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [exerciseType, setExerciseType] = useState('squat');
    const [isMuted, setIsMuted] = useState(false);
    const lastSpokenRef = useRef("");

    // Speech Synthesis Helper
    const speak = (text) => {
        if (isMuted) return;
        if (text === lastSpokenRef.current) return; // Don't repeat identical feedback immediately

        // Cancel any ongoing speech
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.1; // Slightly faster for real-time
        utterance.onend = () => { lastSpokenRef.current = ""; };
        window.speechSynthesis.speak(utterance);
        lastSpokenRef.current = text;
    };

    useEffect(() => {
        const loadModel = async () => {
            try {
                await tf.ready();
                const model = poseDetection.SupportedModels.MoveNet;
                const detectorConfig = {
                    modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING
                };
                const newDetector = await poseDetection.createDetector(model, detectorConfig);
                setDetector(newDetector);
                setIsLoading(false);
                setFeedback("Get ready! Stand in full view.");
                speak("I am ready. Stand in full view to begin.");
            } catch (error) {
                console.error("Failed to load MoveNet:", error);
                setFeedback("Error loading AI. Please refresh.");
            }
        };
        loadModel();
    }, []);

    const drawPose = (pose, ctx) => {
        if (!pose || !pose.keypoints) return;
        const keypoints = pose.keypoints;
        const minConfidence = 0.3;

        keypoints.forEach((keypoint) => {
            if (keypoint.score > minConfidence) {
                const { x, y } = keypoint;
                ctx.beginPath();
                ctx.arc(x, y, 5, 0, 2 * Math.PI);
                ctx.fillStyle = '#6366f1';
                ctx.fill();
            }
        });

        const adjacencies = poseDetection.util.getAdjacentPairs(poseDetection.SupportedModels.MoveNet);
        ctx.strokeStyle = '#6366f1';
        ctx.lineWidth = 3;
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

    const calculateAngle = (a, b, c) => {
        const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
        let angle = Math.abs(radians * 180.0 / Math.PI);
        if (angle > 180.0) angle = 360.0 - angle;
        return angle;
    };

    const analyzePose = useCallback((pose) => {
        if (!pose || !pose.keypoints) return;
        const keypoints = pose.keypoints;
        const minConfidence = 0.4;

        // Squat points
        const leftHip = keypoints[11];
        const leftKnee = keypoints[13];
        const leftAnkle = keypoints[15];
        const leftShoulder = keypoints[5];

        if (leftHip.score > minConfidence && leftKnee.score > minConfidence && leftAnkle.score > minConfidence) {
            const kneeAngle = calculateAngle(leftHip, leftKnee, leftAnkle);

            // Calculate torso angle (posture check)
            let backStraight = true;
            if (leftShoulder.score > minConfidence) {
                const torsoAngle = calculateAngle(leftShoulder, leftHip, leftKnee);
                if (torsoAngle < 70) { // Leaning too far forward
                    setFeedback("Keep your back straight!");
                    speak("Keep your back straight");
                    backStraight = false;
                }
            }

            if (exerciseType === 'squat') {
                if (kneeAngle < 100) {
                    if (!isSquatting) {
                        setIsSquatting(true);
                        setFeedback("Good depth! Now push up.");
                        speak("Good depth! Push up.");
                    }
                }

                if (kneeAngle > 165) {
                    if (isSquatting) {
                        setIsSquatting(false);
                        setCount(prev => prev + 1);
                        setFeedback("Great Rep!");
                        speak("Great repetition! One more.");
                    } else if (backStraight) {
                        setFeedback("Ready. Lower your hips.");
                    }
                }
            } else if (exerciseType === 'pushup') {
                const leftElbow = keypoints[7];
                const leftWrist = keypoints[9];
                if (leftShoulder.score > minConfidence && leftElbow.score > minConfidence && leftWrist.score > minConfidence) {
                    const elbowAngle = calculateAngle(leftShoulder, leftElbow, leftWrist);
                    let bodyLineOk = true;
                    if (leftHip.score > minConfidence && leftKnee.score > minConfidence) {
                        const lineAngle = calculateAngle(leftShoulder, leftHip, leftKnee);
                        if (lineAngle < 160) {
                            setFeedback("Keep your hips down!");
                            speak("Keep your hips down");
                            bodyLineOk = false;
                        }
                    }
                    if (elbowAngle < 90) {
                        if (!isSquatting) {
                            setIsSquatting(true);
                            setFeedback("Excellent depth!");
                            speak("Excellent depth! Drive up.");
                        }
                    }
                    if (elbowAngle > 160) {
                        if (isSquatting) {
                            setIsSquatting(false);
                            setCount(prev => prev + 1);
                            setFeedback("Power Rep!");
                            speak("Power rep! One more.");
                        } else if (bodyLineOk) {
                            setFeedback("Ready. Lower your chest.");
                        }
                    }
                }
            }
        } else {
            setFeedback("Make sure your full body is visible.");
        }
    }, [isSquatting, exerciseType, isMuted]);

    const runDetection = useCallback(async () => {
        if (webcamRef.current?.video.readyState === 4 && detector) {
            const video = webcamRef.current.video;
            const videoWidth = video.videoWidth;
            const videoHeight = video.videoHeight;

            canvasRef.current.width = videoWidth;
            canvasRef.current.height = videoHeight;

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
        <div className="flex flex-col items-center p-8 bg-[#0f172a] min-h-screen text-white">
            {/* Header Section */}
            <div className="w-full max-w-6xl flex flex-col md:flex-row justify-between items-center mb-10 gap-6">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-500 rounded-2xl shadow-lg shadow-indigo-500/30">
                        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">AI Exercise Coach</h1>
                        <p className="text-gray-400">Professional guidance in real-time</p>
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    <div className="flex flex-col items-end">
                        <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Repetitions</span>
                        <div className="text-5xl font-black text-indigo-400 tabular-nums">
                            {count.toString().padStart(2, '0')}
                        </div>
                    </div>
                    <button
                        onClick={() => setIsMuted(!isMuted)}
                        className={`p-4 rounded-2xl transition-all ${isMuted ? 'bg-red-500/10 text-red-500' : 'bg-green-500/10 text-green-500'}`}
                    >
                        {isMuted ? (
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15zM17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" /></svg>
                        ) : (
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
                        )}
                    </button>
                </div>
            </div>

            {/* Main Grid Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 w-full max-w-7xl">

                {/* Left Column: Reference / Demo */}
                <div className="flex flex-col gap-4">
                    <div className="bg-slate-800/50 border border-slate-700 rounded-3xl overflow-hidden shadow-2xl">
                        <div className="p-4 border-b border-slate-700 bg-slate-800/80 flex justify-between items-center">
                            <span className="text-sm font-bold uppercase tracking-widest text-indigo-400">Reference Form</span>
                            <span className="px-3 py-1 bg-indigo-500/20 text-indigo-400 rounded-full text-xs font-bold uppercase">Target: Perfect</span>
                        </div>
                        <div className="aspect-video relative bg-black flex items-center justify-center">
                            <img
                                src={EXERCISE_DATA[exerciseType].demoUrl}
                                alt={EXERCISE_DATA[exerciseType].name}
                                className="w-full h-full object-contain"
                            />
                        </div>
                    </div>
                    <div className="bg-slate-800/50 p-6 rounded-3xl border border-slate-700">
                        <h3 className="text-lg font-bold mb-2">Instructions</h3>
                        <p className="text-gray-300 leading-relaxed">
                            {EXERCISE_DATA[exerciseType].instructions}
                        </p>
                    </div>
                </div>

                {/* Right Column: Live Analysis */}
                <div className="flex flex-col gap-4">
                    <div className="bg-slate-800/50 border border-slate-700 rounded-3xl overflow-hidden shadow-2xl relative">
                        <div className="p-4 border-b border-slate-700 bg-slate-800/80 flex justify-between items-center">
                            <span className="text-sm font-bold uppercase tracking-widest text-green-400">Live Feedback</span>
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                <span className="text-xs font-bold uppercase text-gray-400">AI Tracking Active</span>
                            </div>
                        </div>
                        <div className="aspect-video relative bg-black">
                            {isLoading && (
                                <div className="absolute inset-0 flex items-center justify-center z-30 bg-slate-900 bg-opacity-95">
                                    <div className="flex flex-col items-center">
                                        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                                        <p className="font-medium text-indigo-400">Configuring Neural Network...</p>
                                    </div>
                                </div>
                            )}
                            <Webcam
                                ref={webcamRef}
                                mirrored={true}
                                className="absolute inset-0 w-full h-full object-cover grayscale opacity-40"
                            />
                            <canvas
                                ref={canvasRef}
                                className="absolute inset-0 w-full h-full object-cover z-20"
                            />

                            {/* Dynamic Feedback Overlay */}
                            <div className="absolute inset-x-0 bottom-8 flex justify-center z-30 px-6">
                                <div className={`backdrop-blur-xl px-10 py-5 rounded-2xl shadow-2xl border transition-all duration-300 transform ${feedback.includes('Great') || feedback.includes('Good')
                                    ? 'bg-green-500/20 border-green-500/50 scale-105'
                                    : feedback.includes('back') || feedback.includes('visible')
                                        ? 'bg-yellow-500/20 border-yellow-500/50 scale-100'
                                        : 'bg-indigo-500/20 border-indigo-500/50 scale-100'
                                    }`}>
                                    <p className={`text-2xl font-black text-center ${feedback.includes('Great') || feedback.includes('Good') ? 'text-green-400' : 'text-white'
                                        }`}>
                                        {feedback.toUpperCase()}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Controls Bar */}
                    <div className="flex gap-4">
                        <select
                            value={exerciseType}
                            onChange={(e) => {
                                setExerciseType(e.target.value);
                                setCount(0);
                                speak(`Switching to ${e.target.value}. Prepare yourself.`);
                            }}
                            className="flex-1 px-8 py-4 bg-slate-800 border border-slate-700 rounded-2xl font-bold text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all cursor-pointer hover:bg-slate-700"
                        >
                            <option value="squat">🏆 Squats</option>
                            <option value="pushup">💪 Push-ups</option>
                        </select>
                        <button
                            onClick={() => {
                                setCount(0);
                                speak("Counter reset. Ready for next set.");
                            }}
                            className="px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold transition-all shadow-lg shadow-indigo-600/30 flex items-center gap-2"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            Reset
                        </button>
                    </div>
                </div>

            </div>

            {/* Footer Info */}
            <div className="mt-12 text-gray-500 text-sm font-medium flex gap-8 items-center bg-slate-900/50 px-8 py-3 rounded-full border border-slate-800">
                <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                    Pose Tracking: MoveNet V1
                </div>
                <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-indigo-500 rounded-full"></span>
                    Engine: TensorFlow.js
                </div>
                <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                    Feedback: AI Logic
                </div>
            </div>
        </div>
    );
};

export default AIExerciseCoach;
