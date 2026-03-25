import React, { useRef, useState, useEffect, useCallback } from 'react';
import Webcam from 'react-webcam';
import * as tf from '@tensorflow/tfjs';
import * as poseDetection from '@tensorflow-models/pose-detection';
import '@tensorflow/tfjs-backend-webgl';
import { computePostureMetrics, analyseBodyHealth } from '../../services/bodyAnalysisService';
import { useNavigate } from 'react-router-dom';

// Map exercise names to routes/IDs
const EXERCISE_MAP = {
    'Neck Rotation': 'neck_rotation',
    'Neck Tilt': 'neck_tilt',
    'Neck Slide': 'neck_slide',
    'Shoulder Raise': 'shoulder_raise',
    'Arm Stretch': 'arm_stretch',
    'Hand Stretching': 'hand_stretch',
    'Squat': 'squat',
    'Lunge': 'lunge',
    'Knee Bend': 'kneebend',
    'Push-up': 'pushup',
    'Eye Blinking Exercise': 'eye-blink',
    'Eye Focus Exercise': 'eye-focus',
};

const STATUS_COLOR = {
    Normal: 'text-green-400',
    Warning: 'text-yellow-400',
    'Attention Required': 'text-red-400',
};
const STATUS_BG = {
    Normal: 'bg-green-500/10 border-green-500/30',
    Warning: 'bg-yellow-500/10 border-yellow-500/30',
    'Attention Required': 'bg-red-500/10 border-red-500/30',
};
const URGENCY_COLOR = {
    Routine: 'bg-green-500/20 text-green-300 border-green-500/40',
    Monitor: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
    'See Doctor Soon': 'bg-orange-500/20 text-orange-300 border-orange-500/40',
    Emergency: 'bg-red-500/20 text-red-300 border-red-500/40',
};

const SCAN_STATES = {
    IDLE: 'idle',
    LOADING: 'loading',
    SCANNING: 'scanning',
    ANALYSING: 'analysing',
    DONE: 'done',
    ERROR: 'error',
};

export default function BodyHealthScanner({ onSelectExercise, onClose }) {
    const navigate = useNavigate();
    const webcamRef = useRef(null);
    const canvasRef = useRef(null);
    const detectorRef = useRef(null);
    const animFrameRef = useRef(null);
    const blinkCountRef = useRef(0);
    const blinkStateRef = useRef('open'); // 'open' | 'closed'
    const scanStartRef = useRef(null);

    const [scanState, setScanState] = useState(SCAN_STATES.IDLE);
    const [countdown, setCountdown] = useState(5);
    const [report, setReport] = useState(null);
    const [liveMetrics, setLiveMetrics] = useState(null);
    const [errorMsg, setErrorMsg] = useState('');

    // ─── Load MoveNet detector ──────────────────────────────────────────────────
    useEffect(() => {
        let mounted = true;
        const loadDetector = async () => {
            await tf.setBackend('webgl');
            await tf.ready();
            const detector = await poseDetection.createDetector(
                poseDetection.SupportedModels.MoveNet,
                { modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING }
            );
            if (mounted) detectorRef.current = detector;
        };
        loadDetector().catch(console.error);
        return () => {
            mounted = false;
            if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        };
    }, []);

    // ─── Live Pose Preview Loop ─────────────────────────────────────────────────
    const liveScanLoop = useCallback(async () => {
        if (!detectorRef.current || !webcamRef.current?.video) return;
        const video = webcamRef.current.video;
        if (video.readyState < 2) {
            animFrameRef.current = requestAnimationFrame(liveScanLoop);
            return;
        }
        try {
            const poses = await detectorRef.current.estimatePoses(video);
            if (poses.length > 0) {
                const kp = poses[0].keypoints;
                const metrics = computePostureMetrics(kp);
                setLiveMetrics(metrics);

                // Draw skeleton on canvas
                const canvas = canvasRef.current;
                if (canvas) {
                    canvas.width = video.videoWidth;
                    canvas.height = video.videoHeight;
                    const ctx = canvas.getContext('2d');
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    kp.forEach(point => {
                        if (point.score > 0.35) {
                            ctx.beginPath();
                            ctx.arc(point.x, point.y, 5, 0, 2 * Math.PI);
                            ctx.fillStyle = '#818cf8';
                            ctx.fill();
                        }
                    });
                    // Draw connections
                    const PAIRS = [[5,6],[5,7],[7,9],[6,8],[8,10],[5,11],[6,12],[11,12],[11,13],[13,15],[12,14],[14,16],[0,5],[0,6]];
                    ctx.strokeStyle = '#6366f1';
                    ctx.lineWidth = 2;
                    PAIRS.forEach(([a, b]) => {
                        if (kp[a]?.score > 0.35 && kp[b]?.score > 0.35) {
                            ctx.beginPath();
                            ctx.moveTo(kp[a].x, kp[a].y);
                            ctx.lineTo(kp[b].x, kp[b].y);
                            ctx.stroke();
                        }
                    });
                }

                // Track blink rate via eye keypoints (very rough — real EAR needs face mesh)
                const leftEye = kp[1];
                const rightEye = kp[2];
                if (leftEye?.score > 0.5 && rightEye?.score > 0.5) {
                    const eyeY = (leftEye.y + rightEye.y) / 2;
                    // Naive closed-eye approximation: eyes drop relative to nose
                    const nose = kp[0];
                    if (nose?.score > 0.5) {
                        const diff = nose.y - eyeY;
                        if (diff < 15 && blinkStateRef.current === 'open') {
                            blinkStateRef.current = 'closed';
                        } else if (diff > 20 && blinkStateRef.current === 'closed') {
                            blinkStateRef.current = 'open';
                            blinkCountRef.current += 1;
                        }
                    }
                }
            }
        } catch (e) { /* silent */ }
        animFrameRef.current = requestAnimationFrame(liveScanLoop);
    }, []);

    // ─── Start / Stop live loop ─────────────────────────────────────────────────
    useEffect(() => {
        if (scanState === SCAN_STATES.IDLE || scanState === SCAN_STATES.SCANNING) {
            animFrameRef.current = requestAnimationFrame(liveScanLoop);
        }
        return () => {
            if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        };
    }, [scanState, liveScanLoop]);

    // ─── Capture webcam frame as base64 ────────────────────────────────────────
    const captureFrame = () => {
        if (!webcamRef.current?.video) return null;
        const video = webcamRef.current.video;
        const cvs = document.createElement('canvas');
        cvs.width = video.videoWidth;
        cvs.height = video.videoHeight;
        cvs.getContext('2d').drawImage(video, 0, 0);
        return cvs.toDataURL('image/jpeg', 0.7).split(',')[1];
    };

    // ─── Run Full Scan ──────────────────────────────────────────────────────────
    const runScan = useCallback(async () => {
        if (scanState !== SCAN_STATES.IDLE) return;
        setScanState(SCAN_STATES.SCANNING);
        blinkCountRef.current = 0;
        scanStartRef.current = Date.now();

        // 5-second countdown to collect data
        let remaining = 5;
        setCountdown(remaining);
        const tick = setInterval(() => {
            remaining -= 1;
            setCountdown(remaining);
            if (remaining <= 0) {
                clearInterval(tick);
                performAnalysis();
            }
        }, 1000);
    }, [scanState]);

    const performAnalysis = async () => {
        setScanState(SCAN_STATES.ANALYSING);
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);

        try {
            const imageBase64 = captureFrame();

            // Final pose snapshot
            let finalMetrics = liveMetrics || {};
            const elapsedSecs = (Date.now() - scanStartRef.current) / 1000;
            const blinksPerMin = Math.round((blinkCountRef.current / elapsedSecs) * 60);
            finalMetrics.blinkRate = blinksPerMin;
            finalMetrics.blinkRateNormal = blinksPerMin >= 10 && blinksPerMin <= 20;

            const result = await analyseBodyHealth(finalMetrics, imageBase64);
            setReport(result);
            setScanState(SCAN_STATES.DONE);
        } catch (err) {
            setErrorMsg(err.message || 'Unknown error');
            setScanState(SCAN_STATES.ERROR);
        }
    };

    const resetScan = () => {
        setReport(null);
        setErrorMsg('');
        setScanState(SCAN_STATES.IDLE);
        blinkCountRef.current = 0;
    };

    // ─── UI ────────────────────────────────────────────────────────────────────
    return (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex flex-col items-center overflow-y-auto py-8 px-4">
            {/* Header */}
            <div className="w-full max-w-6xl mb-6 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                        <span className="text-3xl">🩺</span>
                        AI Body Health Scanner
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">
                        Clinical posture analysis · Disease indicators · Eye health · Exercise recommendations
                    </p>
                </div>
                <button
                    onClick={onClose}
                    className="text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl p-3 transition-all"
                    title="Close Scanner"
                >✕</button>
            </div>

            <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left: Camera + Skeleton */}
                <div className="bg-slate-900 border border-slate-700 rounded-3xl overflow-hidden shadow-2xl">
                    <div className="p-4 border-b border-slate-700 flex items-center justify-between">
                        <span className="text-sm font-bold text-indigo-400 uppercase tracking-widest">Live Camera Feed</span>
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${scanState === SCAN_STATES.SCANNING ? 'bg-red-500/20 text-red-400 animate-pulse' : 'bg-green-500/20 text-green-400'}`}>
                            {scanState === SCAN_STATES.SCANNING ? '● SCANNING' : '● LIVE'}
                        </span>
                    </div>
                    <div className="relative aspect-video bg-black">
                        <Webcam
                            ref={webcamRef}
                            audio={false}
                            mirrored={true}
                            className="w-full h-full object-cover"
                            videoConstraints={{ facingMode: 'user', width: 640, height: 480 }}
                        />
                        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" style={{ transform: 'scaleX(-1)' }} />

                        {/* Countdown Overlay */}
                        {scanState === SCAN_STATES.SCANNING && (
                            <>
                                <div className="absolute inset-0 flex items-center justify-center bg-indigo-950/40 z-30">
                                    <div className="text-center">
                                        <div className="text-7xl font-black text-indigo-300 animate-pulse">{countdown}</div>
                                        <p className="text-white font-semibold mt-2">Hold your position...</p>
                                    </div>
                                </div>
                                {/* Scanning Line Animation */}
                                <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent shadow-[0_0_15px_rgba(99,102,241,0.8)] z-40 animate-scan pointer-events-none"></div>
                            </>
                        )}
                        {scanState === SCAN_STATES.ANALYSING && (
                            <div className="absolute inset-0 flex items-center justify-center bg-slate-950/60">
                                <div className="text-center">
                                    <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                                    <p className="text-white font-bold text-lg">Analysing with Swasthyalink AI...</p>
                                    <p className="text-slate-400 text-sm">Processing posture metrics & health indicators</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Live Metrics Panel */}
                    {liveMetrics && (
                        <div className="p-4 grid grid-cols-2 gap-2">
                            {[
                                { label: 'Head Forward', value: liveMetrics.headForwardPosture, raw: liveMetrics.headForwardRatio },
                                { label: 'Shoulders', value: liveMetrics.shoulderImbalance, raw: liveMetrics.shoulderImbalanceRatio },
                                { label: 'Hip Tilt', value: liveMetrics.hipTilt, raw: liveMetrics.hipTiltRatio },
                                { label: 'Spine', value: liveMetrics.spinalAlignment, raw: liveMetrics.spinalDeviationRatio },
                                { label: 'Left Knee', value: liveMetrics.leftKneeAlignment || '—' },
                                { label: 'Neck Tilt', value: liveMetrics.neckTilt, raw: liveMetrics.neckTiltRatio },
                            ].map(({ label, value, raw }) => (
                                <div key={label} className="bg-slate-800/60 rounded-xl px-3 py-2 flex justify-between items-center text-xs">
                                    <span className="text-slate-400">{label}</span>
                                    <span className={value === 'Normal' ? 'text-green-400 font-semibold' : 'text-yellow-400 font-semibold'}>
                                        {value || '—'}
                                        {raw !== undefined ? ` (${raw})` : ''}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Scan Button */}
                    {(scanState === SCAN_STATES.IDLE || scanState === SCAN_STATES.DONE || scanState === SCAN_STATES.ERROR) && (
                        <div className="p-4 pt-0 flex gap-3">
                            <button
                                id="run-body-scan-btn"
                                onClick={scanState === SCAN_STATES.IDLE ? runScan : resetScan}
                                className="flex-1 py-3 rounded-xl font-bold text-white transition-all shadow-lg"
                                style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
                            >
                                {scanState === SCAN_STATES.IDLE ? '🔍 Run Full Body Scan' : '🔄 Scan Again'}
                            </button>
                        </div>
                    )}
                </div>

                {/* Right: Results Panel */}
                <div className="flex flex-col gap-4">
                    {/* Idle State */}
                    {scanState === SCAN_STATES.IDLE && !report && (
                        <div className="bg-slate-900 border border-slate-700 rounded-3xl p-8 text-center flex flex-col items-center justify-center h-full min-h-[400px]">
                            <div className="text-6xl mb-4">🩺</div>
                            <h2 className="text-xl font-bold text-white mb-2">Ready to Scan</h2>
                            <p className="text-slate-400 text-sm leading-relaxed max-w-sm">
                                Stand 1–2 metres from the camera so your full body is visible. Click "Run Full Body Scan" and hold still for 5 seconds.
                            </p>
                            <div className="mt-6 grid grid-cols-3 gap-3 w-full max-w-sm text-xs text-slate-400">
                                {['🦴 Posture Analysis', '⚠️ Disease Indicators', '👁️ Eye Health'].map(item => (
                                    <div key={item} className="bg-slate-800 rounded-xl p-3 text-center">{item}</div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Error State */}
                    {scanState === SCAN_STATES.ERROR && (
                        <div className="bg-slate-900 border border-red-500/40 rounded-3xl p-8 text-center">
                            <div className="text-5xl mb-4">❌</div>
                            <h2 className="text-xl font-bold text-red-400 mb-2">Analysis Failed</h2>
                            <p className="text-slate-400 text-sm">{errorMsg}</p>
                        </div>
                    )}

                    {/* Results */}
                    {report && (
                        <>
                            {/* Score + Summary */}
                            <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-lg font-bold text-white">Posture Score</h2>
                                    <span className={`px-3 py-1 text-sm font-bold rounded-full border ${URGENCY_COLOR[report.urgencyLevel] || 'bg-slate-700 text-white border-slate-600'}`}>
                                        {report.urgencyLevel}
                                    </span>
                                </div>
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="relative w-20 h-20">
                                        <svg viewBox="0 0 36 36" className="w-20 h-20 -rotate-90">
                                            <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#334155" strokeWidth="3" />
                                            <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none"
                                                stroke={report.postureScore >= 80 ? '#4ade80' : report.postureScore >= 60 ? '#facc15' : '#f87171'}
                                                strokeWidth="3" strokeDasharray={`${report.postureScore || 0}, 100`} />
                                        </svg>
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <span className="text-2xl font-black text-white">{report.postureScore ?? '—'}</span>
                                        </div>
                                    </div>
                                    <p className="text-slate-300 text-sm leading-relaxed flex-1">{report.summary}</p>
                                </div>
                            </div>

                            {/* Findings */}
                            <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6">
                                <h2 className="text-lg font-bold text-white mb-4">🔬 Clinical Findings</h2>
                                <div className="space-y-3">
                                    {(report.findings || []).map((f, idx) => (
                                        <div key={idx} className={`rounded-xl p-4 border ${STATUS_BG[f.status] || 'bg-slate-800 border-slate-700'}`}>
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="font-bold text-white text-sm">{f.area}</span>
                                                <span className={`text-xs font-bold ${STATUS_COLOR[f.status] || 'text-slate-300'}`}>{f.status}</span>
                                            </div>
                                            <p className="text-slate-300 text-xs mb-2">{f.detail}</p>
                                            {f.possibleConditions?.length > 0 && (
                                                <div className="flex flex-wrap gap-1">
                                                    {f.possibleConditions.map(c => (
                                                        <span key={c} className="px-2 py-0.5 bg-slate-700/60 text-slate-300 text-xs rounded-full">{c}</span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                    {(report.findings || []).length === 0 && (
                                        <p className="text-slate-400 text-sm text-center py-4">No significant findings detected.</p>
                                    )}
                                </div>
                            </div>

                            {/* Eye Health */}
                            <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6">
                                <h2 className="text-lg font-bold text-white mb-4">👁️ Eye Health</h2>
                                {report.eyeHealth && (
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between bg-slate-800 rounded-xl p-3">
                                            <span className="text-slate-400 text-sm">Blink Rate</span>
                                            <span className={`text-sm font-bold ${report.eyeHealth.blinkRateStatus === 'Normal' ? 'text-green-400' : 'text-yellow-400'}`}>
                                                {report.eyeHealth.blinkRateStatus}
                                            </span>
                                        </div>
                                        {report.eyeHealth.blinkRateNote && (
                                            <p className="text-slate-400 text-xs px-1">{report.eyeHealth.blinkRateNote}</p>
                                        )}
                                        {report.eyeHealth.additionalFindings && (
                                            <div className="bg-slate-800/60 rounded-xl p-3">
                                                <p className="text-slate-300 text-xs">{report.eyeHealth.additionalFindings}</p>
                                            </div>
                                        )}
                                        {report.eyeHealth.recommendSeeDoctor && (
                                            <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-3 text-orange-300 text-xs font-semibold">
                                                ⚠️ We recommend consulting an ophthalmologist for a detailed eye assessment.
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Recommended Exercises */}
                            <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6">
                                <h2 className="text-lg font-bold text-white mb-4">🏋️ Recommended Exercises</h2>
                                <div className="space-y-2">
                                    {(report.recommendedExercises || []).map((ex, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => {
                                                const id = EXERCISE_MAP[ex.exercise];
                                                if (id) {
                                                    if (id.startsWith('eye-')) {
                                                        const type = id.replace('eye-', '');
                                                        navigate(`/eye-exercise?type=${type}`);
                                                        onClose();
                                                    } else if (onSelectExercise) {
                                                        onSelectExercise(id);
                                                        onClose();
                                                    }
                                                }
                                            }}
                                            className="w-full text-left bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 rounded-xl p-3 transition-all group"
                                        >
                                            <div className="flex items-center justify-between">
                                                <span className="text-indigo-300 font-semibold text-sm group-hover:text-indigo-200">{ex.exercise}</span>
                                                <span className="text-indigo-400 text-xs">Start →</span>
                                            </div>
                                            <p className="text-slate-400 text-xs mt-1">{ex.reason}</p>
                                        </button>
                                    ))}
                                    {(report.recommendedExercises || []).length === 0 && (
                                        <p className="text-slate-400 text-sm text-center py-4">No specific exercises recommended at this time.</p>
                                    )}
                                </div>
                            </div>

                            {/* Disclaimer */}
                            <div className="bg-slate-800/40 rounded-2xl p-4 text-xs text-slate-500 text-center border border-slate-700">
                                ⚕️ {report.disclaimer}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
