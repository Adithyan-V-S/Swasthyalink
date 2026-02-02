import React, { useRef, useState, useEffect, useCallback } from 'react';
import Webcam from 'react-webcam';
import * as tf from '@tensorflow/tfjs';
import * as poseDetection from '@tensorflow-models/pose-detection';
import '@tensorflow/tfjs-backend-webgl';
import confetti from 'canvas-confetti';

// Exercise Database with Demonstration Content
const EXERCISE_DATA = {
    squat: {
        name: 'Squat',
        demoUrl: '/exercises/squat.png',
        instructions: 'Lower your hips until they are below your knees. Keep your back straight.',
        checks: ['depth', 'posture']
    },
    pushup: {
        name: 'Push-up',
        demoUrl: '/exercises/pushup.png',
        instructions: 'Lower your chest to the floor. Keep your body in a straight line.',
        checks: ['depth', 'line']
    },
    lunge: {
        name: 'Lunge',
        demoUrl: '/exercises/lunge.png',
        instructions: 'Take a long step forward and lower your hips until both knees are bent at a 90-degree angle.',
        checks: ['depth', 'balance']
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
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [lastRepTime, setLastRepTime] = useState(0);
    const [mediaError, setMediaError] = useState(false);
    const lastSpokenRef = useRef("");

    // --- Premium Workout Mode State ---
    const [isPremium, setIsPremium] = useState(false);
    const [workoutMode, setWorkoutMode] = useState('practice'); // 'practice' or 'workout'
    const [repTarget, setRepTarget] = useState(15);
    const [isResting, setIsResting] = useState(false);
    const [restTimeLeft, setRestTimeLeft] = useState(30);
    const [showWorkoutSummary, setShowWorkoutSummary] = useState(false);
    const [sessionStartTime, setSessionStartTime] = useState(null);
    const [accuracyStats, setAccuracyStats] = useState({ perfect: 0, total: 0 });
    const restTimerRef = useRef(null);

    // Dynamic Alpha for smoothing
    const alpha = 0.2;

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

    // --- Celebration Effect ---
    useEffect(() => {
        if (showWorkoutSummary) {
            const duration = 3 * 1000;
            const animationEnd = Date.now() + duration;
            const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 300 };

            const randomInRange = (min, max) => Math.random() * (max - min) + min;

            const interval = setInterval(function () {
                const timeLeft = animationEnd - Date.now();

                if (timeLeft <= 0) {
                    return clearInterval(interval);
                }

                const particleCount = 50 * (timeLeft / duration);
                // since particles fall down, start a bit higher than random
                confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
                confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
            }, 250);
        }
    }, [showWorkoutSummary]);

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

    const [debugInfo, setDebugInfo] = useState({ kneeAngle: 0, state: 'Neutral', confidence: 0 });
    const debugInfoRef = useRef({ kneeAngle: 0, state: 'Neutral', confidence: 0 });
    const anglesRef = useRef({ knee: 180, elbow: 180, torso: 180 });
    const isRestingRef = useRef(false);
    const summaryRef = useRef(false);
    const countRef = useRef(0);
    const exerciseTypeRef = useRef('squat');
    const isSquattingRef = useRef(false);
    const workoutModeRef = useRef('practice');
    const repTargetRef = useRef(15);
    const lastRepTimeRef = useRef(0);
    const frameCounterRef = useRef(0);
    const totalFramesRef = useRef(0);
    const [engineHeat, setEngineHeat] = useState(0);

    // Sync refs for the high-frequency loop (Ultimate Stability Pattern)
    useEffect(() => { isRestingRef.current = isResting; }, [isResting]);
    useEffect(() => { summaryRef.current = showWorkoutSummary; }, [showWorkoutSummary]);
    useEffect(() => { countRef.current = count; }, [count]);
    useEffect(() => { exerciseTypeRef.current = exerciseType; }, [exerciseType]);
    useEffect(() => { isSquattingRef.current = isSquatting; }, [isSquatting]);
    useEffect(() => { lastRepTimeRef.current = lastRepTime; }, [lastRepTime]);
    useEffect(() => { workoutModeRef.current = workoutMode; }, [workoutMode]);
    useEffect(() => { repTargetRef.current = repTarget; }, [repTarget]);

    const analyzePose = useCallback((pose) => {
        if (!pose || !pose.keypoints) {
            setFeedback("Make sure your full body is visible.");
            setIsSquatting(false); // Reset state if tracking lost
            return;
        }
        const keypoints = pose.keypoints;
        const minConfidence = 0.5;

        // --- Workout Mode Check ---
        if (workoutModeRef.current === 'workout' && countRef.current >= repTargetRef.current && !isRestingRef.current) {
            if (!summaryRef.current) handleWorkoutComplete();
            return;
        }

        // Squat points
        const leftHip = keypoints[11];
        const leftKnee = keypoints[13];
        const leftAnkle = keypoints[15];
        const leftShoulder = keypoints[5];

        if (leftHip.score > minConfidence && leftKnee.score > minConfidence && leftAnkle.score > minConfidence) {
            const rawKneeAngle = calculateAngle(leftHip, leftKnee, leftAnkle);

            // Heavy Smoothing
            const smoothKneeAngle = alpha * rawKneeAngle + (1 - alpha) * anglesRef.current.knee;
            anglesRef.current.knee = smoothKneeAngle;

            // Debug Info Update (Sync ref first for loop, state second for UI)
            const newDebug = {
                kneeAngle: Math.round(smoothKneeAngle),
                state: isSquattingRef.current ? 'Down' : 'Up',
                confidence: Math.round(leftKnee.score * 100) / 100
            };
            debugInfoRef.current = newDebug;
            setDebugInfo(newDebug);

            // Calculate torso angle (posture check)
            let backStraight = true;
            if (leftShoulder.score > minConfidence) {
                const rawTorsoAngle = calculateAngle(leftShoulder, leftHip, leftKnee);
                const smoothTorsoAngle = alpha * rawTorsoAngle + (1 - alpha) * anglesRef.current.torso;
                anglesRef.current.torso = smoothTorsoAngle;

                if (smoothTorsoAngle < 70) {
                    setFeedback("Keep your back straight!");
                    backStraight = false;
                }
            }

            if (exerciseTypeRef.current === 'squat') {
                // Down Trigger: < 90 degrees
                if (smoothKneeAngle < 90) {
                    if (!isSquattingRef.current) {
                        setIsSquatting(true);
                        setFeedback("Good depth! Now push up.");
                        speak("Good depth! Push up.");
                        frameCounterRef.current = 0; // Reset counter
                    }
                }

                // Up Trigger: > 170 degrees (MUST HOLD for stable frames)
                if (smoothKneeAngle > 170) {
                    if (isSquattingRef.current) {
                        frameCounterRef.current += 1; // Increment hold counter

                        // Require 5 consecutive frames (approx 100-200ms) of valid standing
                        if (frameCounterRef.current > 5) {
                            const now = Date.now();
                            if (now - lastRepTimeRef.current > 2000) {
                                setIsSquatting(false);
                                setCount(prev => prev + 1);
                                setLastRepTime(now);
                                setFeedback("Great Rep!");
                                speak("Great repetition! One more.");
                                frameCounterRef.current = 0;
                            }
                        }
                    } else {
                        frameCounterRef.current = 0;
                        if (backStraight) setFeedback("Ready. Lower your hips.");
                    }
                }
            } else if (exerciseTypeRef.current === 'pushup') {
                const leftElbow = keypoints[7];
                const leftWrist = keypoints[9];
                if (leftShoulder.score > minConfidence && leftElbow.score > minConfidence && leftWrist.score > minConfidence) {
                    const rawElbowAngle = calculateAngle(leftShoulder, leftElbow, leftWrist);
                    const smoothElbowAngle = alpha * rawElbowAngle + (1 - alpha) * anglesRef.current.elbow;
                    anglesRef.current.elbow = smoothElbowAngle;

                    const newDebug = {
                        kneeAngle: Math.round(smoothElbowAngle),
                        state: isSquattingRef.current ? 'Down' : 'Up',
                        confidence: Math.round(leftElbow.score * 100) / 100
                    };
                    debugInfoRef.current = newDebug;
                    setDebugInfo(newDebug);

                    let bodyLineOk = true;
                    if (leftHip.score > minConfidence && leftKnee.score > minConfidence) {
                        const lineAngle = calculateAngle(leftShoulder, leftHip, leftKnee);
                        if (lineAngle < 160) {
                            setFeedback("Keep your hips down!");
                            bodyLineOk = false;
                        }
                    }

                    if (smoothElbowAngle < 80) {
                        if (!isSquattingRef.current) {
                            setIsSquatting(true);
                            setFeedback("Excellent depth!");
                            speak("Excellent depth! Drive up.");
                            frameCounterRef.current = 0;
                        }
                    }

                    if (smoothElbowAngle > 165) {
                        if (isSquattingRef.current) {
                            frameCounterRef.current += 1;
                            if (frameCounterRef.current > 5) {
                                const now = Date.now();
                                if (now - lastRepTimeRef.current > 2000) {
                                    setIsSquatting(false);
                                    setCount(prev => prev + 1);
                                    setLastRepTime(now);
                                    setFeedback("Power Rep!");
                                    speak("Power rep! One more.");
                                    frameCounterRef.current = 0;
                                }
                            }
                        } else {
                            frameCounterRef.current = 0;
                            if (bodyLineOk) setFeedback("Ready. Lower your chest.");
                        }
                    }
                }
            } else if (exerciseTypeRef.current === 'lunge') {
                if (leftHip.score > minConfidence && leftKnee.score > minConfidence && leftAnkle.score > minConfidence) {
                    const rawKneeAngle = calculateAngle(leftHip, leftKnee, leftAnkle);
                    const smoothKneeAngle = alpha * rawKneeAngle + (1 - alpha) * anglesRef.current.knee;
                    anglesRef.current.knee = smoothKneeAngle;

                    const newDebug = {
                        kneeAngle: Math.round(smoothKneeAngle),
                        state: isSquattingRef.current ? 'Lunge Down' : 'Standing',
                        confidence: Math.round(leftKnee.score * 100) / 100
                    };
                    debugInfoRef.current = newDebug;
                    setDebugInfo(newDebug);

                    if (smoothKneeAngle < 100) {
                        if (!isSquattingRef.current) {
                            setIsSquatting(true);
                            setFeedback("Great step! Back up.");
                            speak("Great step. Step back.");
                            frameCounterRef.current = 0;
                        }
                    }

                    if (smoothKneeAngle > 165) {
                        if (isSquattingRef.current) {
                            frameCounterRef.current += 1;
                            if (frameCounterRef.current > 5) {
                                const now = Date.now();
                                if (now - lastRepTimeRef.current > 2000) {
                                    setIsSquatting(false);
                                    setCount(prev => prev + 1);
                                    setLastRepTime(now);
                                    setFeedback("Strong Lunge!");
                                    speak("Strong lunge. Switch legs if needed.");
                                    frameCounterRef.current = 0;
                                }
                            }
                        } else {
                            frameCounterRef.current = 0;
                            setFeedback("Ready. Take a long step.");
                        }
                    }
                }
            }
        } else {
            setFeedback("Make sure your full body is visible.");
            setIsSquatting(false);
        }
    }, [isMuted]); // Callback is now perfectly stable - only depends on muted state for 'speak'

    const handleWorkoutComplete = () => {
        setIsResting(false);
        setShowWorkoutSummary(true);
        // Confetti logic will be added here
    };

    const startRestTimer = () => {
        setIsResting(true);
        setRestTimeLeft(30);
        restTimerRef.current = setInterval(() => {
            setRestTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(restTimerRef.current);
                    setIsResting(false);
                    setCount(0); // Reset for next set?
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    };

    const runDetection = useCallback(async () => {
        if (webcamRef.current?.video?.readyState >= 2 && detector && canvasRef.current) {
            const video = webcamRef.current.video;
            const videoWidth = video.videoWidth;
            const videoHeight = video.videoHeight;

            canvasRef.current.width = videoWidth;
            canvasRef.current.height = videoHeight;

            if (videoWidth > 0 && videoHeight > 0) {
                try {
                    const poses = await detector.estimatePoses(video);
                    if (poses.length > 0) {
                        const pose = poses[0];
                        analyzePose(pose);
                        const ctx = canvasRef.current.getContext("2d");
                        if (ctx) {
                            ctx.clearRect(0, 0, videoWidth, videoHeight);
                            drawPose(pose, ctx);
                            // Draw Debug Overlay from Ref (NOT state to avoid thrashing)
                            ctx.font = "20px Arial";
                            ctx.fillStyle = "yellow";
                            ctx.fillText(`Knee: ${debugInfoRef.current.kneeAngle}°`, 10, 30);
                            ctx.fillText(`State: ${debugInfoRef.current.state}`, 10, 60);
                        }
                    }
                    totalFramesRef.current++;
                    if (totalFramesRef.current % 30 === 0) setEngineHeat(prev => prev + 1);
                } catch (error) {
                    console.error("Pose detection error:", error);
                }
            }
        }
    }, [detector, analyzePose]); // Stable analyzePose makes runDetection stable

    useEffect(() => {
        let animationFrameId;
        const loop = async () => {
            await runDetection();
            animationFrameId = requestAnimationFrame(loop);
        };
        loop();
        return () => cancelAnimationFrame(animationFrameId);
    }, [runDetection]);

    const toggleFullscreen = () => {
        setIsFullscreen(!isFullscreen);
    };

    return (
        <div className={`flex flex-col items-center p-8 bg-[#0f172a] text-white transition-all duration-300 ${isFullscreen ? 'fixed inset-0 z-[100] h-screen w-screen overflow-y-auto' : 'min-h-screen relative'}`}>
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
                            {workoutMode === 'workout' && (
                                <span className="text-2xl text-slate-600 font-bold ml-1">/ {repTarget}</span>
                            )}
                        </div>
                    </div>

                    <div className="hidden lg:flex flex-col items-center px-6 border-l border-slate-800">
                        <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1 font-bold">MODE</span>
                        <div className="flex bg-slate-900/50 p-1 rounded-xl border border-slate-700">
                            <button
                                onClick={() => setWorkoutMode('practice')}
                                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${workoutMode === 'practice' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                            >
                                PRACTICE
                            </button>
                            <button
                                onClick={() => {
                                    if (isPremium) {
                                        setWorkoutMode('workout');
                                    } else {
                                        speak("This feature requires Swasthyalink Premium.");
                                        // Auto-simulate premium for now to show user
                                        setIsPremium(true);
                                        setWorkoutMode('workout');
                                    }
                                }}
                                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${workoutMode === 'workout' ? 'bg-amber-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                            >
                                {!isPremium && <svg className="w-3 h-3 text-amber-500" fill="currentColor" viewBox="0 0 20 20"><path d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" /></svg>}
                                WORKOUT
                            </button>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={toggleFullscreen}
                            className="p-4 rounded-2xl bg-slate-800 text-gray-300 hover:bg-slate-700 transition-all font-medium flex items-center gap-2"
                            title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
                        >
                            {isFullscreen ? (
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 14h6m-6 0v6m0-6l5-5m5 5l5-5m0 5v6m0-6h6m-6 0l5-5" /></svg>
                            ) : (
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
                            )}
                        </button>

                        <button
                            onClick={() => setIsMuted(!isMuted)}
                            className={`p-4 rounded-2xl transition-all ${isMuted ? 'bg-red-500/10 text-red-500' : 'bg-green-500/10 text-green-500'}`}
                            title={isMuted ? "Unmute Coach" : "Mute Coach"}
                        >
                            {isMuted ? (
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15zM17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" /></svg>
                            ) : (
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Grid Layout */}
            <div className={`grid grid-cols-1 ${isFullscreen ? 'lg:grid-cols-2 h-full' : 'lg:grid-cols-2'} gap-8 w-full max-w-7xl flex-1`}>

                {/* Left Column: Reference / Demo */}
                <div className="flex flex-col gap-4">
                    <div className="bg-slate-800/50 border border-slate-700 rounded-3xl overflow-hidden shadow-2xl">
                        <div className="p-4 border-b border-slate-700 bg-slate-800/80 flex justify-between items-center">
                            <span className="text-sm font-bold uppercase tracking-widest text-indigo-400">Reference Form</span>
                            <span className="px-3 py-1 bg-indigo-500/20 text-indigo-400 rounded-full text-xs font-bold uppercase">Target: Perfect</span>
                        </div>
                        <div className={`aspect-video relative bg-black flex items-center justify-center ${isFullscreen ? 'h-[40vh]' : ''}`}>
                            {EXERCISE_DATA[exerciseType] ? (
                                <img
                                    key={exerciseType}
                                    src={EXERCISE_DATA[exerciseType].demoUrl}
                                    alt={EXERCISE_DATA[exerciseType].name}
                                    className="w-full h-full object-contain"
                                    onError={(e) => {
                                        console.error("Local guide failed to load:", e);
                                        setMediaError(true);
                                    }}
                                />
                            ) : (
                                <div className="text-gray-500 flex flex-col items-center bg-slate-900/50 w-full h-full justify-center p-8">
                                    <div className="p-6 bg-red-500/10 rounded-full mb-4">
                                        <svg className="w-12 h-12 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                        </svg>
                                    </div>
                                    <p className="font-bold text-gray-300 text-center mb-2">Tutorial Video Blocked</p>
                                    <p className="text-sm text-gray-500 text-center max-w-xs mb-4">Your network might be blocking common animation sources. AI tracking will still work!</p>
                                    <button
                                        onClick={() => setMediaError(false)}
                                        className="px-4 py-2 bg-indigo-500/20 text-indigo-400 rounded-lg text-sm font-bold hover:bg-indigo-500/30 transition-all"
                                    >
                                        Try Loading Again
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="bg-slate-800/50 p-6 rounded-3xl border border-slate-700">
                        <h3 className="text-lg font-bold mb-2">Instructions</h3>
                        <p className="text-gray-300 leading-relaxed">
                            {EXERCISE_DATA[exerciseType]?.instructions || "Select an exercise to begin."}
                        </p>
                    </div>
                </div>

                {/* Right Column: Live Analysis */}
                <div className="flex flex-col gap-4">
                    <div className="bg-slate-800/50 border border-slate-700 rounded-3xl overflow-hidden shadow-2xl relative flex-1 flex flex-col">
                        <div className="p-4 border-b border-slate-700 bg-slate-800/80 flex justify-between items-center shrink-0">
                            <div className="flex items-center gap-3">
                                <span className="text-sm font-bold uppercase tracking-widest text-green-400">Analysis Engine</span>
                                <div className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-tighter ${isResting ? 'bg-amber-500/20 text-amber-500' :
                                    showWorkoutSummary ? 'bg-indigo-500/20 text-indigo-400' :
                                        'bg-green-500/20 text-green-500'
                                    }`}>
                                    {isResting ? 'Resting' : showWorkoutSummary ? 'Session Finished' : 'Active Tracking'}
                                </div>
                                <div className="px-2 py-0.5 rounded-md text-[8px] font-bold bg-slate-700 text-slate-400">
                                    Heat: {engineHeat}
                                </div>
                            </div>
                            <button
                                onClick={() => {
                                    setDetector(null);
                                    setIsLoading(true);
                                    setTimeout(() => window.location.reload(), 500);
                                }}
                                className="text-[10px] font-bold text-slate-500 hover:text-white transition-all uppercase underline underline-offset-4"
                            >
                                Force Reset AI
                            </button>
                        </div>
                        <div className={`relative bg-black flex-1 w-full ${isFullscreen ? 'h-full min-h-[50vh]' : 'aspect-video'}`}>
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
                    <div className="flex gap-4 shrink-0">
                        <select
                            value={exerciseType}
                            onChange={(e) => {
                                setExerciseType(e.target.value);
                                setMediaError(false); // Reset error state on switch
                                setCount(0);
                                speak(`Switching to ${e.target.value}. Prepare yourself.`);
                            }}
                            className="flex-1 px-8 py-4 bg-slate-800 border border-slate-700 rounded-2xl font-bold text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all cursor-pointer hover:bg-slate-700"
                        >
                            <option value="squat">🏆 Squats</option>
                            <option value="pushup">💪 Push-ups</option>
                            <option value="lunge">🦵 Lunges</option>
                        </select>

                        {/* Adjustable Rep Target (Premium Feature UI) */}
                        {workoutMode === 'workout' && (
                            <div className="flex items-center gap-3 bg-slate-800 border border-slate-700 px-6 py-2 rounded-2xl shadow-inner">
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest whitespace-nowrap">Target</span>
                                <input
                                    type="number"
                                    value={repTarget}
                                    onChange={(e) => setRepTarget(Math.max(1, parseInt(e.target.value) || 1))}
                                    className="w-16 bg-transparent text-2xl font-black text-indigo-400 focus:outline-none border-b-2 border-slate-700 focus:border-indigo-500 transition-all text-center"
                                />
                            </div>
                        )}

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

            {/* Premium Workout Summary Overlay */}
            {showWorkoutSummary && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/90 backdrop-blur-xl animate-in fade-in duration-500">
                    <div className="bg-slate-900 border border-slate-700 p-10 rounded-[2.5rem] shadow-2xl max-w-lg w-full text-center relative overflow-hidden">
                        <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-amber-500"></div>

                        <div className="p-4 rounded-full bg-amber-500/20 inline-block mb-6 shadow-inner">
                            <svg className="w-16 h-16 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                        </div>

                        <h2 className="text-4xl font-black mb-2 text-white tracking-tight">WORKOUT COMPLETE!</h2>
                        <p className="text-slate-400 font-medium mb-10">You've reached your daily goals with Swasthyalink Pro.</p>

                        <div className="grid grid-cols-2 gap-4 mb-10">
                            <div className="bg-slate-800/80 p-6 rounded-3xl border border-slate-700 shadow-lg">
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">TOTAL REPS</p>
                                <p className="text-4xl font-black text-indigo-400">{count}</p>
                            </div>
                            <div className="bg-slate-800/80 p-6 rounded-3xl border border-slate-700 shadow-lg">
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">SET ACCURACY</p>
                                <p className="text-4xl font-black text-green-400">100%</p>
                            </div>
                        </div>

                        <button
                            onClick={() => {
                                setShowWorkoutSummary(false);
                                setCount(0);
                                setWorkoutMode('practice');
                                if (restTimerRef.current) clearInterval(restTimerRef.current);
                            }}
                            className="w-full py-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black text-xl shadow-xl shadow-indigo-600/30 transition-all hover:scale-[1.02] active:scale-95"
                        >
                            CLOSE SUMMARY
                        </button>
                    </div>
                </div>
            )}

            {/* Rest Timer Overlay */}
            {isResting && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/80 backdrop-blur-md">
                    <div className="text-center">
                        <p className="text-xl font-bold text-indigo-400 mb-2 uppercase tracking-widest">Rest Period</p>
                        <p className="text-9xl font-black text-white tabular-nums">{restTimeLeft}</p>
                        <button
                            onClick={() => setIsResting(false)}
                            className="mt-8 px-6 py-2 bg-slate-800 text-slate-400 rounded-full text-sm font-bold hover:text-white transition-all uppercase tracking-widest"
                        >
                            Skip Rest
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AIExerciseCoach;
