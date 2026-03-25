import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Webcam from 'react-webcam';
import * as tf from '@tensorflow/tfjs';
import * as faceLandmarksDetection from '@tensorflow-models/face-landmarks-detection';
import '@tensorflow/tfjs-backend-webgl';

// ──────────────────────────────────────────────
//  Exercise Types & Translations
// ──────────────────────────────────────────────
const TRANSLATIONS = {
    en: {
        title: "Neural Eye Coach",
        subtitle: "Real-time Iris Landmark Detection",
        repetitions: "Repetitions",
        progress: "Exercise Progress",
        completion: "Completion",
        detecting: "⏳ Detecting Face...",
        calibrate: "🎯 Click to Calibrate",
        play: "▶ Start Exercise",
        playCourse: "🚀 Start Daily Course",
        stop: "⏹ STOP SESSION",
        recalibrate: "Recalibrate",
        searching: "SEARCHING FOR FACE...",
        locked: "NEURAL SYNC ACTIVE",
        faceLocked: "Face Locked",
        searchingStatus: "Searching...",
        proTip: "Pro Tip: Maintain consistent lighting and keep your head still.",
        done: "🎉 Done!",
        targetHit: "Target hit.",
        sessionStarted: "Session started! Follow the dot...",
        calibrated: "✅ Calibrated! Ready to start.",
        ready: "Ready",
        left: "LEFT",
        right: "RIGHT",
        up: "UP",
        down: "DOWN",
        center: "Center Position",
        look: "Look",
        excellent: "Excellent",
        gaze: "gaze!",
        blink: "Blink",
        greatBlink: "✅ Great Blink!",
        courseComplete: "Daily course complete. Amazing job!"
    },
    ml: {
        title: "ന്യൂറൽ ഐ കോച്ച്",
        subtitle: "തത്സമയ ഐറിസ് ലാൻഡ്മാർക്ക് ഡിറ്റക്ഷൻ",
        repetitions: "ആവർത്തനങ്ങൾ",
        progress: "പരിശീലന പുരോഗതി",
        completion: "പൂർത്തിയാക്കൽ",
        detecting: "⏳ മുഖം തിരയുന്നു...",
        calibrate: "🎯 കാലിബ്രേറ്റ് ചെയ്യുക",
        play: "▶ തുടങ്ങുക",
        playCourse: "🚀 പ്രതിദിന കോഴ്സ് തുടങ്ങുക",
        stop: "⏹ നിർത്തുക",
        recalibrate: "റീകാലിബ്രേറ്റ്",
        searching: "മുഖത്തിനായി തിരയുന്നു...",
        locked: "ന്യൂറൽ സിങ്ക് സജീവമാണ്",
        faceLocked: "മുഖം കണ്ടെത്തി",
        searchingStatus: "തിരയുന്നു...",
        proTip: "പ്രോ ടിപ്പ്: വെളിച്ചം ക്രമീകരിക്കുക, തല അനക്കാതെ വയ്ക്കുക.",
        done: "🎉 കഴിഞ്ഞു!",
        targetHit: "ലക്ഷ്യം കണ്ടു.",
        sessionStarted: "പരിശീലനം തുടങ്ങി! ബിന്ദുവിനെ ശ്രദ്ധിക്കൂ...",
        calibrated: "✅ കാലിബ്രേറ്റ് ചെയ്തു! തുടങ്ങാൻ തയ്യാറാണ്.",
        ready: "തയ്യാറാണ്",
        left: "ഇടത്",
        right: "വലത്",
        up: "മുകളിലേക്ക്",
        down: "താഴേക്ക്",
        center: "മധ്യഭാഗം",
        look: "നോക്കൂ",
        excellent: "മികച്ചത്",
        gaze: "നോട്ടം!",
        blink: "ചിമ്മുക",
        greatBlink: "✅ നന്നായി ചിമ്മി!",
        courseComplete: "പ്രതിദിന പരിശീലനം പൂർത്തിയായി. മികച്ച നേട്ടം!"
    }
};

const EYE_EXERCISES = [
    {
        id: 'look_left_right',
        name: { en: 'Left-Right Tracking', ml: 'ഇടത്-വലത് നോട്ടം' },
        icon: '👁️',
        targetPattern: 'horizontal',
        repsGoal: 10,
        instructions: {
            en: 'Follow the dot with ONLY your eyes. Keep your head completely still.',
            ml: 'കണ്ണുകൾ മാത്രം ഉപയോഗിച്ച് ബിന്ദുവിനെ പിന്തുടരുക. തല അനക്കരുത്.'
        }
    },
    {
        id: 'look_up_down',
        name: { en: 'Up-Down Tracking', ml: 'മുകളിലേക്കും താഴേക്കും' },
        icon: '⬆️',
        targetPattern: 'vertical',
        repsGoal: 10,
        instructions: {
            en: 'Follow the dot with ONLY your eyes. Keep your head completely still.',
            ml: 'കണ്ണുകൾ മാത്രം ഉപയോഗിച്ച് ബിന്ദുവിനെ പിന്തുടരുക. തല അനക്കരുത്.'
        }
    },
    {
        id: 'blink_exercise',
        name: { en: 'Controlled Blinking', ml: 'കണ്ണുകൾ ചിമ്മുക' },
        icon: '😊',
        targetPattern: 'blink',
        repsGoal: 15,
        instructions: {
            en: 'When the circle pulses, perform one slow, complete blink.',
            ml: 'വൃത്തം വലുതാകുമ്പോൾ സാവധാനം കണ്ണുകൾ ഒന്ന് ചിമ്മുക.'
        }
    },
];

// ──────────────────────────────────────────────
//  Main Component
// ──────────────────────────────────────────────
if (typeof window !== 'undefined') {
    window.arguments = window.arguments || [];
    if (!window.Module) {
        window.Module = { arguments: [] };
    } else {
        window.Module.arguments = window.Module.arguments || [];
    }
}

const EyeExerciseCoach = () => {
    const navigate = useNavigate();
    const webcamRef = useRef(null);
    const canvasRef = useRef(null);
    const detectorRef = useRef(null);
    const animFrameRef = useRef(null);
    const isInitializingRef = useRef(false);
    const lastLandmarksRef = useRef(null);

    const [searchParams] = useSearchParams();
    const [isLoading, setIsLoading] = useState(true);
    const [modelError, setModelError] = useState(null);
    const [exerciseIndex, setExerciseIndex] = useState(0);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isSessionActive, setIsSessionActive] = useState(false);
    const [isCalibrated, setIsCalibrated] = useState(false);
    const [language, setLanguage] = useState('en');
    const [isCourseMode, setIsCourseMode] = useState(false);

    const [count, setCount] = useState(0);
    const [feedback, setFeedback] = useState('Initializing Pupil Tracker...');
    const [isMuted, setIsMuted] = useState(false);

    const [faceDetected, setFaceDetected] = useState(false);
    const [targetPos, setTargetPos] = useState({ x: 0.5, y: 0.5 });
    const [targetPhase, setTargetPhase] = useState(0);

    const targetPhaseRef = useRef(0);
    const countRef = useRef(0);
    const exerciseIndexRef = useRef(0);
    const isSessionRef = useRef(false);
    const isCalibratedRef = useRef(false);
    const irisBaselineRef = useRef(null);
    const lastRepTimeRef = useRef(0);
    const blinkStateRef = useRef('open');
    const lastSpokenRef = useRef('');
    const frameCounterRef = useRef(0);

    const t = TRANSLATIONS[language];
    const currentExercise = EYE_EXERCISES[exerciseIndex];

    useEffect(() => { exerciseIndexRef.current = exerciseIndex; }, [exerciseIndex]);
    useEffect(() => { isSessionRef.current = isSessionActive; }, [isSessionActive]);
    useEffect(() => { countRef.current = count; }, [count]);
    useEffect(() => { targetPhaseRef.current = targetPhase; }, [targetPhase]);
    useEffect(() => { isCalibratedRef.current = isCalibrated; }, [isCalibrated]);

    const playChime = useCallback((type = 'success') => {
        try {
            const context = new (window.AudioContext || window.webkitAudioContext)();
            const osc = context.createOscillator();
            const gain = context.createGain();

            osc.connect(gain);
            gain.connect(context.destination);

            osc.type = 'sine';
            if (type === 'success') {
                osc.frequency.setValueAtTime(880, context.currentTime); // A5
                osc.frequency.exponentialRampToValueAtTime(440, context.currentTime + 0.1);
            } else {
                osc.frequency.setValueAtTime(440, context.currentTime);
            }

            gain.gain.setValueAtTime(0.1, context.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.2);

            osc.start();
            osc.stop(context.currentTime + 0.2);
        } catch (e) { console.error("Audio error:", e); }
    }, []);

    const speak = useCallback((text, forceLang) => {
        if (isMuted) return;
        if (text === lastSpokenRef.current) return;
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        const targetLang = forceLang || (language === 'ml' ? 'ml-IN' : 'en-US');
        u.lang = targetLang;

        // Enhanced voice selection for Malayalam
        const voices = window.speechSynthesis.getVoices();
        // Priority: 1. Exact match 2. Google browser voices 3. Any language start match
        let voice = voices.find(v => v.lang === targetLang) ||
            voices.find(v => v.name.includes('Google') && v.lang.startsWith(targetLang.split('-')[0])) ||
            voices.find(v => v.lang.startsWith(targetLang.split('-')[0]));

        if (voice) u.voice = voice;

        u.rate = 1.0;
        u.onend = () => { lastSpokenRef.current = ''; };
        window.speechSynthesis.speak(u);
        lastSpokenRef.current = text;
    }, [isMuted, language]);

    const drawFaceMesh = (landmarks, ctx, { opacity = 1 } = {}) => {
        if (!landmarks || landmarks.length === 0) return;
        ctx.save();
        ctx.globalAlpha = opacity;

        ctx.fillStyle = '#10b981';
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 1.5;

        // Draw a sparse mesh to give the user a confident skeleton overlay
        landmarks.forEach((kp) => {
            if (kp && typeof kp.x === 'number' && typeof kp.y === 'number') {
                ctx.beginPath();
                ctx.arc(kp.x, kp.y, 1.5, 0, 2 * Math.PI);
                ctx.fill();
            }
        });

        if (faceLandmarksDetection.util && typeof faceLandmarksDetection.util.getAdjacentPairs === 'function') {
            const pairs = faceLandmarksDetection.util.getAdjacentPairs(faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh);
            if (pairs && pairs.length) {
                pairs.forEach(([i, j]) => {
                    const a = landmarks[i];
                    const b = landmarks[j];
                    if (a && b && typeof a.x === 'number' && typeof b.x === 'number') {
                        ctx.beginPath();
                        ctx.moveTo(a.x, a.y);
                        ctx.lineTo(b.x, b.y);
                        ctx.stroke();
                    }
                });
            }
        }

        ctx.restore();
    };

    // Handle exercise redirection from search params
    useEffect(() => {
        const type = searchParams.get('type');
        if (type === 'blink') {
            setExerciseIndex(2); // EYE_EXERCISES[2] is blink
        } else if (type === 'focus') {
            setExerciseIndex(0); // Default to horizontal tracking for focus
        }
    }, [searchParams]);

    // Fullscreen Toggle
    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.error(`Error attempting to enable full-screen mode: ${err.message}`);
            });
        } else {
            document.exitFullscreen();
        }
    };

    useEffect(() => {
        const handleFSChange = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', handleFSChange);
        return () => document.removeEventListener('fullscreenchange', handleFSChange);
    }, []);

    useEffect(() => {
        const loadModel = async () => {
            if (isInitializingRef.current || detectorRef.current) return;
            isInitializingRef.current = true;

            try {
                setFeedback('Booting Neural Engine...');
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
                setFeedback(t.detecting);
                speak(language === 'en' ? 'Vision systems ready.' : 'വിഷൻ സിസ്റ്റം തയ്യാറാണ്.');
            } catch (err) {
                console.error('Neural Engine Error:', err);
                setModelError(err.message);
                setFeedback('Error loading model.');
            } finally {
                isInitializingRef.current = false;
            }
        };
        loadModel();
        return () => {
            if (detectorRef.current) {
                detectorRef.current.dispose();
                detectorRef.current = null;
            }
        };
    }, [language, t.detecting]);

    // ── Guided Target ──────────────────────────────────────
    useEffect(() => {
        if (!isSessionActive || !isCalibrated) return;
        const exercise = EYE_EXERCISES[exerciseIndex];

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
    }, [isSessionActive, isCalibrated, exerciseIndex]);

    // ── Analyze Pupil Gaze ─────────────────────────────────
    const analyzeGaze = useCallback((landmarks) => {
        if (!landmarks || landmarks.length < 478 || !isCalibratedRef.current || !isSessionRef.current) return;

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

        const currentGaze = {
            x: (lNorm.x + rNorm.x) / 2,
            y: (lNorm.y + rNorm.y) / 2
        };

        const dx = currentGaze.x - irisBaselineRef.current.x;
        const dy = currentGaze.y - irisBaselineRef.current.y;

        const exercise = EYE_EXERCISES[exerciseIndexRef.current];
        const tX = targetPos.x - 0.5;
        const tY = targetPos.y - 0.5;
        const now = Date.now();
        let detected = false;

        const THRESHOLD_X = 0.08;
        const THRESHOLD_Y = 0.05;

        if (exercise.id === 'look_left_right') {
            if (tX < -0.2 && dx < -THRESHOLD_X) detected = true; // Looking Right (mirrored)
            else if (tX > 0.2 && dx > THRESHOLD_X) detected = true; // Looking Left

            if (Math.abs(tX) < 0.1) setFeedback(t.center);
            else if (!detected) setFeedback(`${t.look} ${tX < 0 ? t.left : t.right}`);
            else setFeedback(`✅ ${t.excellent} ${tX < 0 ? t.left : t.right} ${t.gaze}`);
        } else if (exercise.id === 'look_up_down') {
            if (tY < -0.2 && dy < -THRESHOLD_Y) detected = true;
            else if (tY > 0.2 && dy > THRESHOLD_Y) detected = true;

            if (Math.abs(tY) < 0.1) setFeedback(t.center);
            else if (!detected) setFeedback(`${t.look} ${tY < 0 ? t.up : t.down}`);
            else setFeedback(`✅ ${t.excellent} ${tY < 0 ? t.up : t.down} ${t.gaze}`);
        } else if (exercise.id === 'blink_exercise') {
            const lUpper = landmarks[159];
            const lLower = landmarks[145];
            const ear = Math.abs(lUpper.y - lLower.y) / Math.abs(lInner.x - lOuter.x);

            const isClosed = ear < 0.15;
            if (blinkStateRef.current === 'open' && isClosed) {
                blinkStateRef.current = 'closed';
            } else if (blinkStateRef.current === 'closed' && !isClosed) {
                blinkStateRef.current = 'open';
                if (now - lastRepTimeRef.current > 1000) {
                    detected = true;
                    setFeedback(t.greatBlink);
                }
            }
        }

        if (detected && now - lastRepTimeRef.current > 1500) {
            lastRepTimeRef.current = now;
            const nc = countRef.current + 1;
            countRef.current = nc;
            setCount(nc);
            playChime('success');
            if (nc % 2 === 0) speak(t.targetHit);

            if (nc >= exercise.repsGoal) {
                handleExerciseCompletion();
            }
        }
    }, [targetPos, speak, t, language]);

    const handleExerciseCompletion = () => {
        if (isCourseMode && exerciseIndexRef.current < EYE_EXERCISES.length - 1) {
            const nextIdx = exerciseIndexRef.current + 1;
            setExerciseIndex(nextIdx);
            setCount(0);
            countRef.current = 0;
            setFeedback(`Moving to ${EYE_EXERCISES[nextIdx].name[language]}...`);
            speak(language === 'en' ? `Next up: ${EYE_EXERCISES[nextIdx].name.en}` : `അടുത്തത്: ${EYE_EXERCISES[nextIdx].name.ml}`);
        } else {
            setIsSessionActive(false);
            isSessionRef.current = false;
            setIsCourseMode(false);
            setFeedback(isCourseMode ? t.courseComplete : t.done);
            speak(isCourseMode ? t.courseComplete : t.done);
        }
    };

    const runDetection = useCallback(async () => {
        if (!detectorRef.current || !webcamRef.current?.video) return;
        const video = webcamRef.current.video;
        if (video.readyState < 2 || video.videoWidth === 0) return;

        const faces = await detectorRef.current.estimateFaces(video, { flipHorizontal: true, staticImageMode: false });
        if (faces && faces.length > 0) {
            if (!faceDetected) setFaceDetected(true);
            const landmarks = faces[0].keypoints;
            lastLandmarksRef.current = landmarks;
            analyzeGaze(landmarks);
            if (canvasRef.current) {
                const ctx = canvasRef.current.getContext('2d');
                if (ctx) {
                    ctx.clearRect(0, 0, video.videoWidth, video.videoHeight);
                    // Keep a lightweight mesh overlay for visual guidance
                    drawFaceMesh(landmarks, ctx, { opacity: 0.9 });
                    // Highlight the irises more prominently
                    landmarks.slice(468, 478).forEach(kp => {
                        ctx.beginPath();
                        ctx.arc(kp.x, kp.y, 3, 0, 2 * Math.PI);
                        ctx.fillStyle = '#10b981';
                        ctx.fill();
                    });
                }
            }
        } else {
            if (faceDetected) setFaceDetected(false);
            if (canvasRef.current && lastLandmarksRef.current) {
                const ctx = canvasRef.current.getContext('2d');
                if (ctx) {
                    ctx.clearRect(0, 0, video.videoWidth, video.videoHeight);
                    drawFaceMesh(lastLandmarksRef.current, ctx, { opacity: 0.18 });
                }
            }
        }
    }, [analyzeGaze, faceDetected]);

    useEffect(() => {
        const loop = async () => { await runDetection(); animFrameRef.current = requestAnimationFrame(loop); };
        loop();
        return () => cancelAnimationFrame(animFrameRef.current);
    }, [runDetection]);

    const calibrate = async () => {
        const video = webcamRef.current?.video;
        if (!video || !detectorRef.current) return;
        const faces = await detectorRef.current.estimateFaces(video, { flipHorizontal: false });
        if (faces.length > 0) {
            const landmarks = faces[0].keypoints;
            const getEyeNorm = (iris, inner, outer) => ({
                x: (iris.x - outer.x) / (inner.x - outer.x),
                y: (iris.y - (inner.y + outer.y) / 2) / (inner.x - outer.x)
            });
            irisBaselineRef.current = {
                x: (getEyeNorm(landmarks[468], landmarks[133], landmarks[33]).x + getEyeNorm(landmarks[473], landmarks[263], landmarks[362]).x) / 2,
                y: (getEyeNorm(landmarks[468], landmarks[133], landmarks[33]).y + getEyeNorm(landmarks[473], landmarks[263], landmarks[362]).y) / 2
            };
            setIsCalibrated(true);
            setFeedback(t.calibrated);
            speak(t.calibrated);
        }
    };

    const startSession = (course = false) => {
        if (!isCalibrated) { calibrate(); return; }
        if (course) { setIsCourseMode(true); setExerciseIndex(0); }
        setCount(0);
        countRef.current = 0;
        setIsSessionActive(true);
        setFeedback(t.sessionStarted);
        speak(t.sessionStarted);
    };

    const progress = Math.min(100, (count / (currentExercise.repsGoal)) * 100);

    return (
        <div className={`flex flex-col p-4 bg-[#0a0f1e] text-white min-h-screen overflow-hidden ${isFullscreen ? 'fixed inset-0 z-[9999]' : ''}`}>
            {/* Minimal Header */}
            <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2 rounded-full bg-slate-800/60 text-white hover:bg-slate-700 transition-all"
                        title="Go back"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <span className="text-3xl">🧬</span>
                    <div>
                        <h1 className="text-xl font-bold bg-gradient-to-r from-emerald-400 to-teal-200 bg-clip-text text-transparent">{t.title}</h1>
                        <p className="text-[10px] text-gray-500 uppercase tracking-tighter">{t.subtitle}</p>
                    </div>
                </div>

                <div className="flex items-center gap-2 bg-slate-800/50 p-1 px-3 rounded-full border border-slate-700">
                    <button onClick={() => setLanguage('en')} className={`px-2 py-1 rounded-full text-[10px] font-bold ${language === 'en' ? 'bg-emerald-500 text-white' : 'text-gray-400'}`}>ENG</button>
                    <button onClick={() => setLanguage('ml')} className={`px-2 py-1 rounded-full text-[10px] font-bold ${language === 'ml' ? 'bg-emerald-500 text-white' : 'text-gray-400'}`}>MAL</button>
                    <div className="w-px h-3 bg-slate-700 mx-1" />
                    <button onClick={() => setIsMuted(!isMuted)} className="text-sm">{isMuted ? '🔇' : '🔊'}</button>
                    <div className="w-px h-3 bg-slate-700 mx-1" />
                    <button 
                        onClick={toggleFullscreen} 
                        className="p-1.5 hover:bg-slate-700 rounded-lg transition-all text-white/70 hover:text-white"
                        title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
                    >
                        {isFullscreen ? (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                            </svg>
                        )}
                    </button>
                </div>
            </div>

            {/* Compact Grid */}
            <div className="grid grid-cols-12 gap-4 flex-1">
                {/* Left: Video & Main Controls */}
                <div className={`${isFullscreen ? 'col-span-12' : 'col-span-12 lg:col-span-7'} flex flex-col gap-3 h-full`}>
                    <div className={`relative bg-black rounded-3xl overflow-hidden border-2 border-slate-800 shadow-2xl transition-all duration-500 ${isFullscreen ? 'flex-1' : 'aspect-video'}`}>
                        {!faceDetected && (
                            <div className="absolute inset-0 flex items-center justify-center z-50 bg-[#0a0f1e]/80">
                                <div className="text-center px-6 py-3 bg-slate-900/90 rounded-2xl border border-slate-700">
                                    <p className="text-emerald-400 font-bold animate-pulse text-sm">{t.searching}</p>
                                </div>
                            </div>
                        )}
                        <Webcam ref={webcamRef} mirrored={true} className="absolute inset-0 w-full h-full object-cover opacity-50" />
                        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full z-20" style={{ transform: 'scaleX(-1)' }} />

                        {/* Status Overlay */}
                        <div className="absolute top-4 left-4 z-40 bg-slate-900/60 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${faceDetected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                            <span className="text-[10px] font-bold uppercase tracking-widest">{faceDetected ? t.faceLocked : t.searchingStatus}</span>
                        </div>

                        {/* Visual Target */}
                        {isSessionActive && (
                            currentExercise.id === 'blink_exercise' ? (
                                <div className="absolute inset-0 flex items-center justify-center z-30">
                                    <div className={`w-20 h-20 rounded-full border-4 border-emerald-400 animate-ping flex items-center justify-center`}>
                                        <span className="text-3xl">😊</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="absolute z-30 transition-all duration-1000" style={{ left: `${targetPos.x * 100}%`, top: `${targetPos.y * 100}%`, transform: 'translate(-50%, -50%)' }}>
                                    <div className="w-10 h-10 rounded-full border-4 border-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.5)] flex items-center justify-center">
                                        <div className="w-1.5 h-1.5 bg-yellow-400 rounded-full" />
                                    </div>
                                </div>
                            )
                        )}

                        {/* Feedback Banner */}
                        <div className="absolute bottom-4 inset-x-0 flex justify-center z-40">
                            <div className="bg-slate-900/90 border border-slate-700 px-6 py-2 rounded-2xl shadow-xl">
                                <p className="text-center font-bold text-sm text-emerald-400">{feedback}</p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                        {!isSessionActive ? (
                            <>
                                <button onClick={() => startSession(false)} className="col-span-2 py-4 bg-emerald-600 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-emerald-500 transition-all">
                                    {isCalibrated ? t.play : t.calibrate}
                                </button>
                                <button onClick={calibrate} className="py-4 bg-slate-800 rounded-2xl font-bold border border-slate-700 text-xs text-amber-200">
                                    {t.recalibrate}
                                </button>
                            </>
                        ) : (
                            <button onClick={() => { setIsSessionActive(false); setIsCourseMode(false); }} className="col-span-3 py-4 bg-red-600 rounded-2xl font-bold uppercase tracking-widest">
                                {t.stop}
                            </button>
                        )}
                    </div>
                </div>

                {/* Right: Exercise Selection & Goal */}
                {!isFullscreen && (
                    <div className="col-span-12 lg:col-span-5 flex flex-col gap-3">
                    <div className="bg-slate-800/30 p-4 rounded-3xl border border-white/5">
                        <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3">{t.progress}</h3>
                        <div className="flex justify-between items-end mb-1">
                            <span className="text-2xl font-black">{count.toString().padStart(2, '0')}<span className="text-xs text-gray-500 ml-1">/ {currentExercise.repsGoal}</span></span>
                            <span className="text-xs font-bold text-emerald-400">{Math.round(progress)}%</span>
                        </div>
                        <div className="h-2 bg-slate-900 rounded-full overflow-hidden p-0.5">
                            <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
                        </div>
                        <p className="mt-3 text-[10px] text-gray-400 italic">"{currentExercise.instructions[language]}"</p>
                    </div>

                    <div className="flex-1 bg-slate-800/20 rounded-3xl border border-white/5 p-4 overflow-y-auto">
                        <div className="space-y-2">
                            {EYE_EXERCISES.map((ex, idx) => (
                                <button
                                    key={ex.id}
                                    onClick={() => { setExerciseIndex(idx); setCount(0); setIsSessionActive(false); setIsCourseMode(false); }}
                                    className={`w-full p-3 rounded-2xl border text-left flex items-center justify-between transition-all ${exerciseIndex === idx ? 'bg-emerald-500/20 border-emerald-500/50' : 'bg-slate-900/40 border-slate-700 hover:border-slate-600'}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="text-xl">{ex.icon}</span>
                                        <div>
                                            <p className="text-xs font-bold">{ex.name[language]}</p>
                                            <p className="text-[9px] text-gray-500">{ex.repsGoal} {t.repetitions}</p>
                                        </div>
                                    </div>
                                    {exerciseIndex === idx && <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                                </button>
                            ))}
                        </div>

                        {!isSessionActive && (
                            <button onClick={() => startSession(true)} className="w-full mt-4 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-emerald-900/20 hover:scale-[1.02] transition-transform">
                                {t.playCourse}
                            </button>
                        )}
                    </div>

                        <div className="bg-slate-900/50 p-4 rounded-2xl border border-white/5">
                            <p className="text-[9px] text-gray-500 text-center leading-relaxed font-bold">
                                <span className="text-emerald-400 mr-1">TIPS:</span> {t.proTip}
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default EyeExerciseCoach;
