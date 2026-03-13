import React, { useRef, useState, useEffect, useCallback } from 'react';
import Webcam from 'react-webcam';
import * as tf from '@tensorflow/tfjs';
import * as faceLandmarksDetection from '@tensorflow-models/face-landmarks-detection';
import '@tensorflow/tfjs-backend-webgl';

// ──────────────────────────────────────────────
//  Exercise Types
// ──────────────────────────────────────────────
const EYE_EXERCISES = {
    look_left_right: {
        name: 'Left-Right Tracking',
        icon: '👁️',
        targetPattern: 'horizontal',
        repsGoal: 10,
        instructions: 'Follow the dot with ONLY your eyes. Keep your head completely still.',
    },
    look_up_down: {
        name: 'Up-Down Tracking',
        icon: '⬆️',
        targetPattern: 'vertical',
        repsGoal: 10,
        instructions: 'Follow the dot with ONLY your eyes. Keep your head completely still.',
    },
    blink_exercise: {
        name: 'Controlled Blinking',
        icon: '😊',
        targetPattern: 'blink',
        repsGoal: 15,
        instructions: 'When the circle pulses, perform one slow, complete blink.',
    },
};

// ──────────────────────────────────────────────
//  Main Component
// ──────────────────────────────────────────────
// ──────────────────────────────────────────────
//  Pure ML Implementation: FaceMesh IRIS
//  Stabilization Shims for Vite/WASM Environment
// ──────────────────────────────────────────────
if (typeof window !== 'undefined') {
    // MediaPipe uses global Module.arguments for internal flags
    window.arguments = window.arguments || [];
    if (!window.Module) {
        window.Module = { arguments: [] };
    } else {
        window.Module.arguments = window.Module.arguments || [];
    }
}

const EyeExerciseCoach = () => {
    const webcamRef = useRef(null);
    const canvasRef = useRef(null);
    const detectorRef = useRef(null);
    const animFrameRef = useRef(null);
    const isInitializingRef = useRef(false);

    const [isLoading, setIsLoading] = useState(true);
    const [modelError, setModelError] = useState(null);
    const [exerciseType, setExerciseType] = useState('look_left_right');
    const [isSessionActive, setIsSessionActive] = useState(false);
    const [isCalibrated, setIsCalibrated] = useState(false);

    const [count, setCount] = useState(0);
    const [feedback, setFeedback] = useState('Initializing Pupil Tracker...');
    const [isMuted, setIsMuted] = useState(false);

    const [faceDetected, setFaceDetected] = useState(false);
    const [targetPos, setTargetPos] = useState({ x: 0.5, y: 0.5 });
    const [targetPhase, setTargetPhase] = useState(0);

    const targetPhaseRef = useRef(0);
    const countRef = useRef(0);
    const exerciseTypeRef = useRef('look_left_right');
    const isSessionRef = useRef(false);
    const isCalibratedRef = useRef(false);
    const irisBaselineRef = useRef(null); // { left: {x, y}, right: {x, y} }
    const lastRepTimeRef = useRef(0);
    const blinkStateRef = useRef('open');
    const lastSpokenRef = useRef('');
    const frameCounterRef = useRef(0);

    useEffect(() => { exerciseTypeRef.current = exerciseType; }, [exerciseType]);
    useEffect(() => { isSessionRef.current = isSessionActive; }, [isSessionActive]);
    useEffect(() => { countRef.current = count; }, [count]);
    useEffect(() => { targetPhaseRef.current = targetPhase; }, [targetPhase]);
    useEffect(() => { isCalibratedRef.current = isCalibrated; }, [isCalibrated]);

    const speak = useCallback((text) => {
        if (isMuted) return;
        if (text === lastSpokenRef.current) return;
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.rate = 1.0;
        u.onend = () => { lastSpokenRef.current = ''; };
        window.speechSynthesis.speak(u);
        lastSpokenRef.current = text;
    }, [isMuted]);

    useEffect(() => {
        const loadModel = async () => {
            if (isInitializingRef.current || detectorRef.current) return;
            isInitializingRef.current = true;

            try {
                setFeedback('Booting Neural Engine...');
                // Force WebGL for high performance on Windows
                await tf.setBackend('webgl');
                await tf.ready();

                const model = faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh;
                const detectorConfig = {
                    runtime: 'mediapipe',
                    solutionPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4/',
                    refineLandmarks: true,
                };

                const detector = await faceLandmarksDetection.createDetector(model, detectorConfig);
                detectorRef.current = detector;
                setIsLoading(false);
                setFeedback('Pupil Tracker Active! Position face.');
                speak('Vision systems active. Please calibrate when ready.');
                console.log("Neural Engine: Ready (using mediapipe runtime)");
            } catch (err) {
                console.error('Neural Engine Core Error:', err);
                setModelError(err.message);
                setFeedback('Neural Error. Try refreshing.');
            } finally {
                isInitializingRef.current = false;
            }
        };
        loadModel();

        return () => {
            if (detectorRef.current) {
                console.log("Neural Engine: Shutting down detector.");
                detectorRef.current.dispose();
                detectorRef.current = null;
            }
        };
    }, []);

    // ── Guided Target ──────────────────────────────────────
    useEffect(() => {
        if (!isSessionActive || !isCalibrated) return;
        const exercise = EYE_EXERCISES[exerciseType];

        const getTarget = (phase, pattern) => {
            switch (pattern) {
                case 'horizontal': {
                    const xs = [0.15, 0.5, 0.85, 0.5];
                    return { x: xs[phase % xs.length], y: 0.5 };
                }
                case 'vertical': {
                    const ys = [0.15, 0.5, 0.85, 0.5];
                    return { x: 0.5, y: ys[phase % ys.length] };
                }
                case 'blink':
                    return { x: 0.5, y: 0.5 };
                default: return { x: 0.5, y: 0.5 };
            }
        };

        const interval = setInterval(() => {
            const p = targetPhaseRef.current + 1;
            targetPhaseRef.current = p;
            setTargetPhase(p);
            setTargetPos(getTarget(p, exercise.targetPattern));
        }, exercise.targetPattern === 'blink' ? 2500 : 2000);

        return () => clearInterval(interval);
    }, [isSessionActive, isCalibrated, exerciseType]);

    // ── Analyze Pupil Gaze ─────────────────────────────────
    const analyzeGaze = useCallback((landmarks, vw, vh) => {
        if (!landmarks || landmarks.length < 478) return;

        // Iris landmarks: 
        // 468: Left Iris Center
        // 473: Right Iris Center
        const leftIris = landmarks[468];
        const rightIris = landmarks[473];

        // We use relative movement of irises compared to eye corners
        // to determine gaze direction, independent of head movement.
        // Left Eye Corners: 33 (outer), 133 (inner)
        // Right Eye Corners: 362 (inner), 263 (outer)

        const lOuter = landmarks[33];
        const lInner = landmarks[133];
        const rInner = landmarks[362];
        const rOuter = landmarks[263];

        // Normalize iris position within eye bounds
        const getEyeNorm = (iris, inner, outer) => ({
            x: (iris.x - outer.x) / (inner.x - outer.x),
            y: (iris.y - (inner.y + outer.y) / 2) / (inner.x - outer.x) // normalized by width
        });

        const lNorm = getEyeNorm(leftIris, lInner, lOuter);
        const rNorm = getEyeNorm(rightIris, rOuter, rInner); // right is flipped index-wise

        const currentGaze = {
            x: (lNorm.x + rNorm.x) / 2,
            y: (lNorm.y + rNorm.y) / 2
        };

        if (!isCalibratedRef.current) return;

        // Relative gaze shift from baseline
        const dx = currentGaze.x - irisBaselineRef.current.x;
        const dy = currentGaze.y - irisBaselineRef.current.y;

        if (!isSessionRef.current) return;

        const exercise = EYE_EXERCISES[exerciseTypeRef.current];
        const tX = targetPos.x - 0.5;
        const tY = targetPos.y - 0.5;
        const now = Date.now();
        let detected = false;

        // Thresholds for "looking" (tuned for pupil tracking)
        const THRESHOLD_X = 0.08;
        const THRESHOLD_Y = 0.05;

        // ── Exercise Checking ──
        if (exerciseTypeRef.current === 'look_left_right') {
            if (tX < -0.2 && dx < -THRESHOLD_X) detected = true; // Looking Right (mirrored)
            else if (tX > 0.2 && dx > THRESHOLD_X) detected = true; // Looking Left

            if (Math.abs(tX) < 0.1) setFeedback('Center Position');
            else if (!detected) setFeedback(`Look ${tX < 0 ? 'LEFT' : 'RIGHT'}`);
            else setFeedback(`✅ Excellent ${tX < 0 ? 'Left' : 'Right'} gaze!`);
        } else if (exerciseTypeRef.current === 'look_up_down') {
            if (tY < -0.2 && dy < -THRESHOLD_Y) detected = true;
            else if (tY > 0.2 && dy > THRESHOLD_Y) detected = true;

            if (Math.abs(tY) < 0.1) setFeedback('Center Position');
            else if (!detected) setFeedback(`Look ${tY < 0 ? 'UP' : 'DOWN'}`);
            else setFeedback(`✅ Excellent ${tY < 0 ? 'Up' : 'Down'} gaze!`);
        } else if (exerciseTypeRef.current === 'blink_exercise') {
            // Eyelid landmarks: Upper 159, Lower 145 (left eye)
            const lUpper = landmarks[159];
            const lLower = landmarks[145];
            const ear = Math.abs(lUpper.y - lLower.y) / Math.abs(lInner.x - lOuter.x);

            const CLOSED_THRESHOLD = 0.15;
            const isClosed = ear < CLOSED_THRESHOLD;

            if (blinkStateRef.current === 'open' && isClosed) {
                blinkStateRef.current = 'closed';
            } else if (blinkStateRef.current === 'closed' && !isClosed) {
                blinkStateRef.current = 'open';
                if (now - lastRepTimeRef.current > 1000) {
                    detected = true;
                    setFeedback('✅ Great Blink!');
                }
            }
        }

        if (detected && now - lastRepTimeRef.current > 1500) {
            lastRepTimeRef.current = now;
            const nc = countRef.current + 1;
            countRef.current = nc;
            setCount(nc);
            if (nc % 2 === 0) speak('Target hit.');
        }

        if (countRef.current >= exercise.repsGoal) {
            setIsSessionActive(false);
            isSessionRef.current = false;
            setFeedback(`🎉 Done! ${exercise.repsGoal} reps complete!`);
            speak('Eye exercise complete. Great work!');
        }
    }, [targetPos, speak]);

    // ── Detection Loop ─────────────────────────────────────
    const runDetection = useCallback(async () => {
        if (!detectorRef.current || !webcamRef.current?.video) return;
        const video = webcamRef.current.video;
        if (video.readyState < 2 || video.videoWidth === 0) return;

        const vw = video.videoWidth;
        const vh = video.videoHeight;

        if (canvasRef.current) {
            canvasRef.current.width = vw;
            canvasRef.current.height = vh;
        }

        try {
            // flipHorizontal: true because our webcam is mirrored
            const faces = await detectorRef.current.estimateFaces(video, {
                flipHorizontal: true,
                staticImageMode: false
            });

            if (faces && faces.length > 0) {
                if (!faceDetected) {
                    console.log("Neural Engine: Face Detected!");
                    setFaceDetected(true);
                }

                const landmarks = faces[0].keypoints;
                const hasIris = landmarks.length >= 478;

                // Debug log every ~60 frames
                frameCounterRef.current++;
                if (frameCounterRef.current % 60 === 0) {
                    console.log("Neural Heartbeat:", {
                        status: "Processing Frames",
                        points: landmarks.length,
                        hasIris: hasIris,
                        pupilLock: landmarks[468] ? 'LOCKED' : 'SEARCHING'
                    });
                }

                analyzeGaze(landmarks, vw, vh);

                if (canvasRef.current) {
                    const ctx = canvasRef.current.getContext('2d');
                    if (ctx) drawHUD(faces[0], ctx, vw, vh);
                }
            } else {
                if (faceDetected) {
                    console.log("Neural Engine: Face Lost");
                    setFaceDetected(false);
                }
                setFeedback('SEARCHING FOR FACE...');
            }
        } catch (err) {
            console.error('Inference Engine Error:', err);
        }
    }, [analyzeGaze, faceDetected]);

    const drawHUD = (face, ctx, vw, vh) => {
        ctx.clearRect(0, 0, vw, vh);

        // Draw Eyes/Pupils (Real ML visual feedback)
        face.keypoints.forEach((kp, i) => {
            // Irises: 468-477
            if (i >= 468 && i <= 477) {
                ctx.beginPath();
                ctx.arc(kp.x, kp.y, 2, 0, 2 * Math.PI);
                ctx.fillStyle = '#10b981'; // emerald
                ctx.fill();
            }
            // Eye outlines
            if ((i >= 33 && i <= 133) || (i >= 362 && i <= 466)) {
                // only draw some points for performance/look
                if (i % 4 === 0) {
                    ctx.beginPath();
                    ctx.arc(kp.x, kp.y, 1, 0, 2 * Math.PI);
                    ctx.fillStyle = 'rgba(16, 185, 129, 0.4)';
                    ctx.fill();
                }
            }
        });
    };

    useEffect(() => {
        const loop = async () => {
            await runDetection();
            animFrameRef.current = requestAnimationFrame(loop);
        };
        loop();
        return () => cancelAnimationFrame(animFrameRef.current);
    }, [runDetection]);

    // ── Session ────────────────────────────────────────────
    const calibrate = async () => {
        const video = webcamRef.current?.video;
        if (!video || !detectorRef.current) return;

        const faces = await detectorRef.current.estimateFaces(video, { flipHorizontal: false });
        if (faces.length > 0) {
            const landmarks = faces[0].keypoints;

            // Calculate baseline gaze
            const leftIris = landmarks[468];
            const rightIris = landmarks[473];
            const lOuter = landmarks[33];
            const lInner = landmarks[133];
            const rInner = landmarks[362];
            const rOuter = landmarks[263];

            const getEyeNorm = (iris, inner, outer) => ({
                x: (iris.x - outer.x) / (inner.x - outer.x),
                y: (iris.y - (inner.y + outer.y) / 2) / (inner.x - outer.x)
            });

            const lNorm = getEyeNorm(leftIris, lInner, lOuter);
            const rNorm = getEyeNorm(rightIris, rOuter, rInner);

            irisBaselineRef.current = {
                x: (lNorm.x + rNorm.x) / 2,
                y: (lNorm.y + rNorm.y) / 2
            };

            setIsCalibrated(true);
            setFeedback('✅ Calibrated! Ready to start.');
            speak('Calibrated. High precision pupil tracking is active.');
        } else {
            setFeedback('Face not detected during calibration.');
        }
    };

    const startSession = () => {
        if (!isCalibrated) {
            calibrate();
            return;
        }
        setCount(0);
        countRef.current = 0;
        lastRepTimeRef.current = 0;
        setTargetPhase(0);
        targetPhaseRef.current = 0;
        setTargetPos({ x: 0.5, y: 0.5 });
        setIsSessionActive(true);
        setFeedback('Session started! Follow the dot with your eyes...');
        speak(`Starting ${EYE_EXERCISES[exerciseType].name}.`);
    };

    const exercise = EYE_EXERCISES[exerciseType];
    const progress = Math.min(100, (count / (exercise?.repsGoal || 1)) * 100);

    return (
        <div className="flex flex-col items-center p-6 bg-[#0a0f1e] text-white min-h-screen">
            {/* Header */}
            <div className="w-full max-w-6xl flex flex-col md:flex-row justify-between items-center mb-10 gap-6">
                <div className="flex items-center gap-5">
                    <div className="p-4 bg-emerald-500/20 rounded-2xl border border-emerald-500/30">
                        <span className="text-4xl">🧬</span>
                    </div>
                    <div>
                        <h1 className="text-4xl font-black tracking-tight bg-gradient-to-r from-emerald-400 to-teal-200 bg-clip-text text-transparent">
                            Neural Eye Coach
                        </h1>
                        <p className="text-gray-400 text-sm font-medium">Real-time Iris Landmark Detection · FaceMesh IRIS</p>
                    </div>
                </div>
                <div className="flex items-center gap-6 bg-slate-800/50 px-8 py-4 rounded-3xl border border-slate-700">
                    <div className="text-center">
                        <span className="text-xs font-bold uppercase tracking-widest text-emerald-400 block mb-1">Repetitions</span>
                        <div className="flex items-baseline gap-2">
                            <span className="text-5xl font-black">{count.toString().padStart(2, '0')}</span>
                            <span className="text-xl text-gray-500 font-bold">/ {exercise?.repsGoal}</span>
                        </div>
                    </div>
                    <div className="w-px h-10 bg-slate-700" />
                    <button
                        onClick={() => setIsMuted(!isMuted)}
                        className={`p-3 rounded-2xl transition-all ${isMuted ? 'bg-red-500/10 text-red-500' : 'bg-emerald-500/10 text-emerald-400'}`}
                    >
                        {isMuted ? '🔇' : '🔊'}
                    </button>
                </div>
            </div>

            {/* Main Interface */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 w-full max-w-7xl">
                {/* Controls & Metrics */}
                <div className="flex flex-col gap-6">
                    <div className="bg-slate-800/40 rounded-[2.5rem] border border-slate-700/50 p-8 shadow-2xl backdrop-blur-sm">
                        <h3 className="text-xs font-black uppercase tracking-widest text-emerald-400 mb-6 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                            Select Rehabilitation Mode
                        </h3>
                        <div className="grid grid-cols-1 gap-3">
                            {Object.entries(EYE_EXERCISES).map(([key, ex]) => (
                                <button
                                    key={key}
                                    onClick={() => {
                                        setExerciseType(key);
                                        setCount(0); countRef.current = 0;
                                        setIsSessionActive(false);
                                        setFeedback(`Ready for ${ex.name}.`);
                                    }}
                                    className={`p-5 rounded-[1.5rem] border-2 text-left flex items-center justify-between transition-all group ${exerciseType === key
                                        ? 'bg-emerald-500/10 border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.1)]'
                                        : 'bg-slate-900/50 border-slate-700 hover:border-slate-600'}`}
                                >
                                    <div className="flex items-center gap-4">
                                        <span className="text-3xl group-hover:scale-110 transition-transform">{ex.icon}</span>
                                        <div>
                                            <span className="font-black block text-lg">{ex.name}</span>
                                            <span className="text-xs text-gray-400 block font-medium">{ex.repsGoal} Repetitions</span>
                                        </div>
                                    </div>
                                    {exerciseType === key && <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,1)]" />}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="bg-slate-800/40 rounded-[2.5rem] border border-slate-700/50 p-8 shadow-2xl">
                        <h3 className="text-xs font-black uppercase tracking-widest text-emerald-400 mb-4">Exercise Progress</h3>
                        <div className="flex justify-between text-sm mb-2 font-bold px-1">
                            <span className="text-gray-400 uppercase tracking-tighter">Completion</span>
                            <span>{Math.round(progress)}%</span>
                        </div>
                        <div className="h-4 bg-slate-900 rounded-full overflow-hidden border border-slate-700/50 p-1">
                            <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-700" style={{ width: `${progress}%` }} />
                        </div>
                        <p className="mt-6 text-gray-300 text-sm leading-relaxed bg-slate-900/40 p-5 rounded-2xl border border-slate-700/30 font-medium italic">
                            "{exercise?.instructions}"
                        </p>
                    </div>

                    <div className="flex gap-4">
                        {!isSessionActive ? (
                            <button
                                onClick={startSession}
                                disabled={isLoading || !!modelError || !faceDetected}
                                className="flex-2 py-5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-[1.5rem] font-black text-xl transition-all shadow-xl shadow-emerald-900/20 active:scale-95 flex items-center justify-center gap-3"
                            >
                                {!faceDetected ? '⏳ Detecting Face...' : !isCalibrated ? '🎯 Click to Calibrate' : '▶ Play Exercises'}
                            </button>
                        ) : (
                            <button onClick={() => setIsSessionActive(false)} className="flex-2 py-5 bg-red-600 hover:bg-red-500 text-white rounded-[1.5rem] font-black text-xl transition-all active:scale-95 shadow-xl shadow-red-900/20">
                                ⏹ STOP SESSION
                            </button>
                        )}
                        <button onClick={calibrate} className="flex-1 px-6 py-5 bg-slate-700 hover:bg-slate-600 text-white rounded-[1.5rem] font-bold transition-all border border-slate-600 active:scale-95">
                            Recalibrate
                        </button>
                    </div>
                </div>

                {/* Tracking View */}
                <div className="flex flex-col gap-6">
                    <div className="bg-black border-4 border-slate-800 rounded-[2.5rem] overflow-hidden shadow-2xl relative aspect-square lg:aspect-video group">
                        {isLoading && (
                            <div className="absolute inset-0 flex items-center justify-center z-50 bg-[#0a0f1e]">
                                <div className="flex flex-col items-center gap-6">
                                    <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="bg-slate-900/80 backdrop-blur-md px-8 py-4 rounded-full border border-slate-700 shadow-2xl">
                                            <h3 className="text-white font-bold text-xl tracking-widest uppercase animate-pulse">
                                                {faceDetected ? 'Neural Sync Active' : 'Searching for Face...'}
                                            </h3>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Webcam & Overlay */}
                        <Webcam
                            ref={webcamRef}
                            mirrored={true}
                            className="absolute inset-0 w-full h-full object-cover opacity-60 grayscale-[0.3]"
                        />
                        <canvas
                            ref={canvasRef}
                            className="absolute inset-0 w-full h-full object-cover z-20"
                            style={{ transform: 'scaleX(-1)' }}
                        />

                        {/* Guided Target Dot */}
                        {isSessionActive && exerciseType !== 'blink_exercise' && (
                            <div
                                className="absolute z-30 transition-all duration-1000 ease-in-out"
                                style={{ left: `${targetPos.x * 100}%`, top: `${targetPos.y * 100}%`, transform: 'translate(-50%, -50%)' }}
                            >
                                <div className="w-12 h-12 rounded-full border-4 border-yellow-400 shadow-[0_0_40px_rgba(250,204,21,0.6)] flex items-center justify-center">
                                    <div className="w-2 h-2 bg-yellow-400 rounded-full animate-ping" />
                                </div>
                            </div>
                        )}

                        {/* Blink Cue */}
                        {isSessionActive && exerciseType === 'blink_exercise' && (
                            <div className="absolute inset-0 flex items-center justify-center z-30">
                                <div className={`transition-all duration-500 ${targetPhase % 2 === 0 ? 'scale-150 opacity-100' : 'scale-75 opacity-20'}`}>
                                    <div className="w-32 h-32 rounded-full border-4 border-emerald-400 shadow-[0_0_60px_rgba(52,211,153,0.3)] flex items-center justify-center">
                                        <span className="text-5xl">😊</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Feedback Banner */}
                        <div className="absolute bottom-6 inset-x-0 flex justify-center z-40 px-6">
                            <div className={`backdrop-blur-2xl px-10 py-5 rounded-[2rem] border-2 transition-all duration-500 shadow-2xl ${feedback.includes('✅') || feedback.includes('🎉')
                                ? 'bg-emerald-500/20 border-emerald-400/50 scale-105'
                                : 'bg-slate-900/80 border-slate-700/50'
                                }`}>
                                <p className={`text-2xl font-black uppercase text-center tracking-tight leading-none ${feedback.includes('✅') || feedback.includes('🎉') ? 'text-emerald-400' : 'text-white'
                                    }`}>
                                    {feedback}
                                </p>
                            </div>
                        </div>

                        {/* Tracking Status Badge */}
                        <div className="absolute top-6 left-6 z-40">
                            <div className={`flex items-center gap-3 px-5 py-2.5 rounded-2xl backdrop-blur-md border ${faceDetected ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border-red-500/30 text-red-500'
                                }`}>
                                <div className={`w-2.5 h-2.5 rounded-full ${faceDetected ? 'bg-emerald-400 animate-pulse' : 'bg-red-500'}`} />
                                <span className="text-xs font-black uppercase tracking-[0.2em]">{faceDetected ? 'Face Locked' : 'Searching...'}</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-slate-800/20 p-5 rounded-3xl border border-slate-700/30">
                        <p className="text-gray-400 text-xs font-medium text-center leading-relaxed">
                            <span className="text-emerald-400 font-bold uppercase mr-1">Pro Tip:</span>
                            Maintain consistent lighting on your face for the most accurate pupil tracking.
                            Keep your head still and guide your gaze to match the yellow target.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EyeExerciseCoach;
