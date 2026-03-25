import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Webcam from 'react-webcam';
import * as tf from '@tensorflow/tfjs';
import * as poseDetection from '@tensorflow-models/pose-detection';
import '@tensorflow/tfjs-backend-webgl';
import confetti from 'canvas-confetti';
import { logPhysioSession, logInjuryRisk } from '../../services/physioService';
import BodyHealthScanner from './BodyHealthScanner';
import TalkingAvatar from './TalkingAvatar';
import { TRANSLATIONS, EXERCISE_TRANSLATIONS } from './translations';

// Exercise Database with Demonstration Content
const EXERCISE_DATA = {
    kneebend: {
        name: 'Knee Bend (Rehab)',
        demoUrl: '/exercises/kneebend.png',
        instructions: 'Slowly bend your knee to a comfortable angle. Do not push past pain.',
        checks: ['depth', 'valgus']
    },
    shoulder_raise: {
        name: 'Hand Raise',
        demoUrl: '/exercises/shoulder_raise.png',
        instructions: 'Stand facing the camera. Raise your arm forward until it is parallel to the floor, hold for 2 seconds, then lower slowly.',
        checks: ['height', 'shoulder_shrug']
    },
    arm_stretch: {
        name: 'Arm Stretch',
        demoUrl: '/exercises/lunge.png',
        instructions: 'Extend your arms straight out. Keep a slight bend in the elbow.',
        checks: ['extension']
    },
    squat: {
        name: 'Squat',
        demoUrl: '/exercises/squat.png',
        instructions: 'Lower your hips until they are below your knees. Keep your back straight.',
        checks: ['depth', 'posture', 'valgus']
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
    },
    hand_stretch: {
        name: 'Hand Stretching',
        demoUrl: '/exercises/hand_stretch.png',
        instructions: 'Spread your arms wide apart, then bring them together until your palms touch in front of you. This improves chest and arm flexibility.',
        checks: ['clasp', 'alignment']
    },
    neck_rotation: {
        name: 'Neck Rotation',
        demoUrl: '/exercises/neck_rotation.png',
        instructions: 'Slowly turn your head to the left, then to the right. Keep your chin level and shoulders still.',
        checks: ['rotation', 'stability']
    },
    neck_tilt: {
        name: 'Neck Tilt',
        demoUrl: '/exercises/neck_tilt.png',
        instructions: 'Gently tilt your head up to look at the ceiling, then down to look at your chest.',
        checks: ['tilt', 'smoothness']
    },
    neck_slide: {
        name: 'Neck Slide',
        demoUrl: '/exercises/neck_slide.png',
        instructions: 'Slide your head forward and backward while keeping your chin level, like a turtle peaking out.',
        checks: ['slide', 'alignment']
    }
};

const AIExerciseCoach = () => {
    const navigate = useNavigate();
    const webcamRef = useRef(null);
    const canvasRef = useRef(null);
    const [detector, setDetector] = useState(null);
    const [feedback, setFeedback] = useState("");
    const [count, setCount] = useState(0);
    const [isSquatting, setIsSquatting] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [exerciseType, setExerciseType] = useState('squat');
    const [classifier, setClassifier] = useState(null);
    const [showScanner, setShowScanner] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [lastRepTime, setLastRepTime] = useState(0);
    const [mediaError, setMediaError] = useState(false);
    const lastSpokenRef = useRef("");
    const lastPoseRef = useRef(null);
    const [injuryRisk, setInjuryRisk] = useState({ level: 'Low', message: 'No significant risks detected.' });

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
    const [diagnosticsEnabled, setDiagnosticsEnabled] = useState(false);
    const [jointConfidence, setJointConfidence] = useState({});
    const [canvasDebug, setCanvasDebug] = useState(false);
    
    // --- Talking Avatar State ---
    const [isTalking, setIsTalking] = useState(false);
    const [avatarExpression, setAvatarExpression] = useState('neutral');

    // --- Language State ---
    const [language, setLanguage] = useState('en');

    // Translation Helper
    const t = useCallback((key) => {
        return TRANSLATIONS[language][key] || key;
    }, [language]);

    // Guarded Feedback Update
    const updateFeedback = (message) => {
        if (message !== feedback) {
            setFeedback(message);
        }
    };

    // --- Tracking Control State ---
    const [isTracking, setIsTracking] = useState(true);
    const isTrackingRef = useRef(true);

    // Dynamic Alpha for smoothing
    const alpha = 0.2;

    // Speech Synthesis Helper
    const speak = (text, key) => {
        if (isMuted) return;
        
        // Use translated text if key is provided
        const spokenText = key ? t(key) : text;
        if (spokenText === lastSpokenRef.current) return;

        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(spokenText);
        utterance.rate = 1.1;
        
        // Voice Selection for Malayalam
        if (language === 'ml') {
            const voices = window.speechSynthesis.getVoices();
            // Try to find a Malayalam voice, fallback to Hindi or any Indian English voice for better accent if ML not available
            const mlVoice = voices.find(v => v.lang.includes('ml-IN') || v.lang.includes('ml'));
            if (mlVoice) {
                utterance.voice = mlVoice;
                utterance.lang = 'ml-IN';
            } else {
                // Fallback to Hindi which often has better phonetic match for Malayalam characters than English
                const hiVoice = voices.find(v => v.lang.includes('hi-IN'));
                if (hiVoice) {
                    utterance.voice = hiVoice;
                    utterance.lang = 'hi-IN';
                } else {
                    utterance.lang = 'ml-IN'; // Still set lang for generic engines
                }
            }
        } else {
            utterance.lang = 'en-US';
        }
        
        utterance.onstart = () => setIsTalking(true);
        utterance.onend = () => {
            setIsTalking(false);
            lastSpokenRef.current = "";
        };
        utterance.onerror = () => setIsTalking(false);

        window.speechSynthesis.speak(utterance);
        lastSpokenRef.current = spokenText;
    };

    useEffect(() => {
        const loadModel = async () => {
            try {
                await tf.ready();
                const model = poseDetection.SupportedModels.MoveNet;
                const detectorConfig = {
                    modelType: poseDetection.movenet.modelType.SINGLEPOSE_THUNDER,
                    enableSmoothing: true,
                    multiPoseMaxDetections: 1
                };
                const newDetector = await poseDetection.createDetector(model, detectorConfig);
                setDetector(newDetector);

                // Load Custom Classifier
                try {
                    const customModel = await tf.loadLayersModel('/models/hand_raise_model.json');
                    setClassifier(customModel);
                    console.log("Custom Hand Raise Model Loaded!");
                } catch (ce) {
                    console.warn("Custom model not found at /models/hand_raise_model.json. Falling back to geometric rules.", ce);
                }

                setIsLoading(false);
                updateFeedback(t('systemCalibrated'));
                speak(null, 'aiHighPrecision');
            } catch (error) {
                console.error("Failed to load MoveNet:", error);
                updateFeedback(t('errorLoadingAI'));
            }
        };
        loadModel();
    }, [t]);

    // Reset Exercise State when switching
    useEffect(() => {
        setCount(0);
        setIsSquatting(false);
        frameCounterRef.current = 0;
        // Reset angles to neutral defaults for specific exercises
        anglesRef.current = {
            knee: 180,
            elbow: 180,
            torso: exerciseType === 'shoulder_raise' ? -1 : 180
        };
        const name = EXERCISE_TRANSLATIONS[language][exerciseType]?.name || exerciseType;
        updateFeedback(`${t('readyFor')} ${name}. ${t('standInView')}`);
        speak(`${name} ${t('selected')}`);
    }, [exerciseType, language, t]);

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

    const isPositive = (text) => {
        const positiveKeys = [
            'perfectDepth', 'eliteRep', 'excellentForm', 
            'fullDepth', 'sharpRep', 'greatStance', 
            'perfectRep', 'perfectGlide', 'repComplete',
            'greatStretchReturn', 'goodBend', 'goodRotation', 'goodSlide'
        ];
        return positiveKeys.some(key => text === t(key) || text.startsWith(t(key)));
    };

    const isWarning = (text) => {
        const warningKeys = ['jointsNotVisible', 'kneeValgus', 'warningHighRisk'];
        return warningKeys.some(key => text === t(key) || text.startsWith(t(key)));
    };

    // Update Avatar Expression based on feedback and state
    useEffect(() => {
        if (injuryRisk.level === 'High') {
            setAvatarExpression('alert');
        } else if (isPositive(feedback)) {
            setAvatarExpression('happy');
            const timer = setTimeout(() => setAvatarExpression('neutral'), 3000);
            return () => clearTimeout(timer);
        } else {
            setAvatarExpression('neutral');
        }
    }, [feedback, injuryRisk.level]);

    const drawPose = (pose, ctx, { opacity = 1 } = {}) => {
        if (!pose || !pose.keypoints) return;
        const keypoints = pose.keypoints;
        const minConfidence = 0.3;

        ctx.save();
        ctx.globalAlpha = opacity;
        
        // Draw connections (lines) first
        const adjacencies = poseDetection.util.getAdjacentPairs(poseDetection.SupportedModels.MoveNet);
        adjacencies.forEach(([i, j]) => {
            const kp1 = keypoints[i];
            const kp2 = keypoints[j];
            if (kp1 && kp2 && kp1.score > minConfidence && kp2.score > minConfidence) {
                ctx.beginPath();
                ctx.moveTo(kp1.x, kp1.y);
                ctx.lineTo(kp2.x, kp2.y);
                ctx.strokeStyle = '#00ff88'; // Bright neon green
                ctx.lineWidth = 3;
                ctx.lineCap = 'round';
                ctx.stroke();
            }
        });

        // Draw joints (circles) on top
        keypoints.forEach((keypoint) => {
            if (keypoint && keypoint.score > minConfidence) {
                const { x, y } = keypoint;
                // Outer glow
                ctx.beginPath();
                ctx.arc(x, y, 8, 0, 2 * Math.PI);
                ctx.fillStyle = 'rgba(0, 255, 136, 0.3)';
                ctx.fill();
                
                // Core joint
                ctx.beginPath();
                ctx.arc(x, y, 5, 0, 2 * Math.PI);
                ctx.fillStyle = '#00ff88';
                ctx.fill();
                
                // Inner highlight
                ctx.beginPath();
                ctx.arc(x, y, 3, 0, 2 * Math.PI);
                ctx.fillStyle = '#ffffff';
                ctx.fill();
            }
        });

        ctx.restore();
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
    const injuryRiskRef = useRef({ level: 'Low', message: 'No significant risks detected.' });

    // Sync refs for the high-frequency loop (Ultimate Stability Pattern)
    useEffect(() => { injuryRiskRef.current = injuryRisk; }, [injuryRisk]);
    useEffect(() => { isRestingRef.current = isResting; }, [isResting]);
    useEffect(() => { summaryRef.current = showWorkoutSummary; }, [showWorkoutSummary]);
    useEffect(() => { countRef.current = count; }, [count]);
    useEffect(() => { exerciseTypeRef.current = exerciseType; }, [exerciseType]);
    useEffect(() => { isSquattingRef.current = isSquatting; }, [isSquatting]);
    useEffect(() => { lastRepTimeRef.current = lastRepTime; }, [lastRepTime]);
    useEffect(() => { workoutModeRef.current = workoutMode; }, [workoutMode]);
    useEffect(() => { repTargetRef.current = repTarget; }, [repTarget]);
    useEffect(() => { isTrackingRef.current = isTracking; }, [isTracking]);

    const analyzePose = useCallback((pose) => {
        if (!pose || !pose.keypoints || pose.keypoints.length === 0) {
            updateFeedback(t('searchingPerson'));
            setIsSquatting(false);
            return;
        }
        const keypoints = pose.keypoints;
        const minConfidence = exerciseTypeRef.current === 'shoulder_raise' ? 0.4 : 0.5;

        if (workoutModeRef.current === 'workout' && countRef.current >= repTargetRef.current && !isRestingRef.current) {
            if (!summaryRef.current) handleWorkoutComplete();
            return;
        }

        const leftHip = keypoints[11];
        const leftKnee = keypoints[13];
        const leftAnkle = keypoints[15];
        const leftShoulder = keypoints[5];
        const rightKnee = keypoints[14];
        const rightAnkle = keypoints[16];

        // --- Injury Risk Prediction (Lower Body Focused) ---
        if (leftKnee.score > minConfidence && rightKnee.score > minConfidence && leftAnkle.score > minConfidence && rightAnkle.score > minConfidence) {
            const ankleDist = Math.abs(leftAnkle.x - rightAnkle.x);
            const kneeDist = Math.abs(leftKnee.x - rightKnee.x);
            if (kneeDist < ankleDist * 0.7 && exerciseTypeRef.current !== 'lunge') {
                if (injuryRiskRef.current.level !== 'High') {
                    const risk = { level: 'High', message: t('kneeValgus') };
                    injuryRiskRef.current = risk;
                    setInjuryRisk(risk);
                    speak(null, 'warningHighRisk');
                    logInjuryRisk({ userId: 'patient123', riskLevel: 'High', message: 'Knee Valgus (Knees collapsing inward)', exerciseType: exerciseTypeRef.current }).catch(console.error);
                }
            } else if (injuryRiskRef.current.level === 'High') {
                const risk = { level: 'Low', message: t('goodPosture') };
                injuryRiskRef.current = risk;
                setInjuryRisk(risk);
            }
        }

        // Logic branching by tracking requirements
        const isUpperBodyOnly = ['shoulder_raise', 'arm_stretch', 'hand_stretch', 'neck_rotation', 'neck_tilt', 'neck_slide'].includes(exerciseTypeRef.current);
        const isFullBody = ['pushup'].includes(exerciseTypeRef.current);

        // --- Lower/Full Body Logic Section ---
        if (!isUpperBodyOnly) {
            if (leftHip.score > minConfidence && leftKnee.score > minConfidence && leftAnkle.score > minConfidence) {
                const rawKneeAngle = calculateAngle(leftHip, leftKnee, leftAnkle);
                const smoothKneeAngle = alpha * rawKneeAngle + (1 - alpha) * anglesRef.current.knee;
                anglesRef.current.knee = smoothKneeAngle;

                const newDebug = {
                    kneeAngle: Math.round(smoothKneeAngle),
                    state: isSquattingRef.current ? 'Down' : 'Up',
                    confidence: Math.round(leftKnee.score * 100) / 100
                };
                debugInfoRef.current = newDebug;
                setDebugInfo(newDebug);

                if (exerciseTypeRef.current === 'squat') {
                    const hipKneeDist = Math.abs(leftHip.y - leftKnee.y);
                    const kneeAnkleDist = Math.abs(leftKnee.y - leftAnkle.y);
                    if (smoothKneeAngle < 95 && hipKneeDist < (kneeAnkleDist * 0.8)) {
                        if (!isSquattingRef.current) {
                            setIsSquatting(true);
                            updateFeedback(t('perfectDepth'));
                            speak(null, 'targetReached');
                            frameCounterRef.current = 0;
                        }
                    }
                    if (smoothKneeAngle > 165) {
                        if (isSquattingRef.current) {
                            frameCounterRef.current += 1;
                            if (frameCounterRef.current > 3) {
                                const now = Date.now();
                                if (now - lastRepTimeRef.current > 1500) {
                                    setIsSquatting(false);
                                    setCount(prev => prev + 1);
                                    setLastRepTime(now);
                                    updateFeedback(t('eliteRep'));
                                    speak(null, 'excellentForm');
                                    frameCounterRef.current = 0;
                                }
                            }
                        } else {
                            frameCounterRef.current = 0;
                            updateFeedback(t('readyDriveHips'));
                        }
                    }
                } else if (exerciseTypeRef.current === 'pushup') {
                    const leftElbow = keypoints[7];
                    const leftWrist = keypoints[9];
                    if (leftShoulder.score > minConfidence && leftElbow.score > minConfidence && leftWrist.score > minConfidence) {
                        const rawElbowAngle = calculateAngle(leftShoulder, leftElbow, leftWrist);
                        const smoothElbowAngle = alpha * rawElbowAngle + (1 - alpha) * anglesRef.current.elbow;
                        anglesRef.current.elbow = smoothElbowAngle;
                        if (smoothElbowAngle < 85) {
                            if (!isSquattingRef.current) {
                                setIsSquatting(true);
                                updateFeedback(t('fullDepth'));
                                frameCounterRef.current = 0;
                            }
                        }
                        if (smoothElbowAngle > 160) {
                            if (isSquattingRef.current) {
                                frameCounterRef.current += 1;
                                if (frameCounterRef.current > 3) {
                                    const now = Date.now();
                                    if (now - lastRepTimeRef.current > 1200) {
                                        setIsSquatting(false);
                                        setCount(prev => prev + 1);
                                        setLastRepTime(now);
                                        updateFeedback(t('sharpRep'));
                                    }
                                }
                            }
                        }
                    }
                } else if (exerciseTypeRef.current === 'lunge') {
                    if (smoothKneeAngle < 105) {
                        if (!isSquattingRef.current) {
                            setIsSquatting(true);
                            updateFeedback(t('greatStance'));
                        }
                    }
                    if (smoothKneeAngle > 165) {
                        if (isSquattingRef.current) {
                            setIsSquatting(false);
                            setCount(prev => prev + 1);
                            setLastRepTime(Date.now());
                        }
                    }
                } else if (exerciseTypeRef.current === 'kneebend') {
                    if (smoothKneeAngle < 120) {
                        if (!isSquattingRef.current) {
                            setIsSquatting(true);
                            updateFeedback(t('goodBend'));
                        }
                    }
                    if (smoothKneeAngle > 165) {
                        if (isSquattingRef.current) {
                            setIsSquatting(false);
                            setCount(prev => prev + 1);
                            setLastRepTime(Date.now());
                        }
                    }
                }
            } else {
                updateFeedback(t('jointsNotVisible'));
                setIsSquatting(false);
            }
        }

        // --- Upper Body Logic Section ---
        if (isUpperBodyOnly || isFullBody) {
            const leftWrist = keypoints[9];
            const rightWrist = keypoints[10];
            const leftElbow = keypoints[7];
            const rightElbow = keypoints[8];
            const leftShoulder = keypoints[5];
            const rightShoulder = keypoints[6];
            const head = keypoints[0];

            if (exerciseTypeRef.current === 'hand_stretch') {
                if (leftWrist.score > minConfidence && rightWrist.score > minConfidence && leftShoulder.score > minConfidence) {
                    const wristDist = Math.abs(leftWrist.x - rightWrist.x);
                    const shoulderDist = Math.abs(leftShoulder.x - rightShoulder.x) || 100;

                    const palmsTogether = wristDist < 80 && Math.abs(leftWrist.y - rightWrist.y) < 80;
                    const armsWide = wristDist > shoulderDist * 2.1;

                    const newDebug = {
                        kneeAngle: Math.round(wristDist),
                        state: isSquattingRef.current ? 'Ready for Palms' : 'Ready for Stretch',
                        confidence: Math.round(leftWrist.score * 100) / 100
                    };
                    debugInfoRef.current = newDebug;
                    setDebugInfo(newDebug);

                    if (armsWide) {
                        if (!isSquattingRef.current) {
                            setIsSquatting(true);
                            updateFeedback(t('palmsTogether'));
                            speak(null, 'palmsTogether');
                        } else {
                            updateFeedback(t('bringPalmsFinish'));
                        }
                    } else if (palmsTogether) {
                        if (isSquattingRef.current) {
                            const now = Date.now();
                            if (now - lastRepTimeRef.current > 1000) {
                                setIsSquatting(false);
                                setCount(prev => prev + 1);
                                setLastRepTime(now);
                                updateFeedback(t('perfectRep'));
                                speak(null, 'openArmsWide');
                            }
                        } else {
                            updateFeedback(t('spreadArmsWide'));
                        }
                    }
                } else {
                    updateFeedback(t('searchingHands'));
                }
            } else if (exerciseTypeRef.current === 'shoulder_raise') {
                if (classifier && pose.keypoints.length > 0) {
                    const inputTensor = tf.tensor2d([pose.keypoints.map(kp => [kp.x, kp.y, kp.score]).flat()]);
                    const prediction = classifier.predict(inputTensor);
                    const scores = prediction.dataSync();
                    const isUp = scores[1] > 0.6;
                    const isDown = scores[0] > 0.6;
                    
                    const upConf = Math.round(scores[1] * 100);
                    const downConf = Math.round(scores[0] * 100);

                    if (isUp) {
                        updateFeedback(`${t('handUp')} [${upConf}%]`);
                        if (!isSquattingRef.current) {
                            setIsSquatting(true);
                            speak(null, 'upPosDetected');
                        }
                    } else if (isDown) {
                        updateFeedback(`${t('handDown')} [${downConf}%]`);
                        if (isSquattingRef.current) {
                            setIsSquatting(false);
                            setCount(prev => prev + 1);
                            setLastRepTime(Date.now());
                            speak(null, 'perfectRep');
                        }
                    } else {
                        updateFeedback(`${t('aiScanning')}: UP(${upConf}%) DOWN(${downConf}%)`);
                    }
                    inputTensor.dispose();
                    prediction.dispose();
                } else if (leftShoulder.score > minConfidence && leftWrist.score > minConfidence) {
                    const verticalOffset = leftShoulder.y - leftWrist.y;
                    if (verticalOffset > 0) {
                        if (!isSquattingRef.current) {
                            setIsSquatting(true);
                        }
                    } else if (verticalOffset < -50) {
                        if (isSquattingRef.current) {
                            setIsSquatting(false);
                            setCount(prev => prev + 1);
                            setLastRepTime(Date.now());
                        }
                    }
                }
            } else if (exerciseTypeRef.current === 'arm_stretch') {
                if (leftWrist.score > minConfidence && rightWrist.score > minConfidence) {
                    const wristDist = Math.abs(leftWrist.x - rightWrist.x);
                    const shoulderDist = Math.abs(leftShoulder.x - rightShoulder.x) || 100;
                    if (wristDist > shoulderDist * 2.5) {
                        if (!isSquattingRef.current) {
                            setIsSquatting(true);
                            updateFeedback(t('fullStretchActive'));
                        }
                    } else if (wristDist < shoulderDist * 1.5) {
                        if (isSquattingRef.current) {
                            setIsSquatting(false);
                            setCount(prev => prev + 1);
                            setLastRepTime(Date.now());
                        }
                    }
                }
            } else if (exerciseTypeRef.current === 'neck_rotation') {
                const nose = keypoints[0];
                const leftEar = keypoints[3];
                const rightEar = keypoints[4];
                if (nose.score > 0.4 && leftEar.score > 0.4 && rightEar.score > 0.4) {
                    const distL = Math.abs(nose.x - leftEar.x);
                    const distR = Math.abs(nose.x - rightEar.x);
                    const ratio = distL / (distR || 1);
                    if (ratio < 0.35 || ratio > 2.8) {
                        if (!isSquattingRef.current) {
                            setIsSquatting(true);
                            updateFeedback(t('greatStretchReturn'));
                            speak(null, 'goodRotation');
                        }
                    } else if (ratio > 0.8 && ratio < 1.25) {
                        if (isSquattingRef.current) {
                            setIsSquatting(false);
                            setCount(prev => prev + 1);
                            updateFeedback(t('repComplete'));
                        }
                    }
                }
            } else if (exerciseTypeRef.current === 'neck_tilt') {
                const nose = keypoints[0];
                const leftEar = keypoints[3];
                const rightEar = keypoints[4];
                if (nose.score > 0.4 && leftEar.score > 0.4 && rightEar.score > 0.4) {
                    const midEarY = (leftEar.y + rightEar.y) / 2;
                    const earDist = Math.abs(leftEar.x - rightEar.x);
                    const tilt = nose.y - midEarY;
                    if (Math.abs(tilt) > earDist * 0.4) {
                        if (!isSquattingRef.current) {
                            setIsSquatting(true);
                            updateFeedback(t('greatStretchReturn'));
                            speak(null, 'holdTilt');
                        }
                    } else if (Math.abs(tilt) < earDist * 0.15) {
                        if (isSquattingRef.current) {
                            setIsSquatting(false);
                            setCount(prev => prev + 1);
                            updateFeedback(t('repComplete'));
                        }
                    }
                }
            } else if (exerciseTypeRef.current === 'neck_slide') {
                if (keypoints[3].score > 0.4 && keypoints[4].score > 0.4 && keypoints[5].score > 0.4 && keypoints[6].score > 0.4) {
                    const headCenter = (keypoints[3].x + keypoints[4].x) / 2;
                    const shoulderCenter = (keypoints[5].x + keypoints[6].x) / 2;
                    const shoulderWidth = Math.abs(keypoints[5].x - keypoints[6].x);
                    const slideDist = Math.abs(headCenter - shoulderCenter);
                    if (slideDist > shoulderWidth * 0.15) {
                        if (!isSquattingRef.current) {
                            setIsSquatting(true);
                            updateFeedback(t('goodSlide'));
                        }
                    } else if (slideDist < shoulderWidth * 0.05) {
                        if (isSquattingRef.current) {
                            setIsSquatting(false);
                            setCount(prev => prev + 1);
                            updateFeedback(t('perfectGlide'));
                        }
                    }
                }
            }
        }
    }, [isMuted, language, t]);

    const handleWorkoutComplete = () => {
        setIsResting(false);
        setShowWorkoutSummary(true);
        // Log the completed session to the clinical dashboard
        logPhysioSession({ userId: 'patient123', exerciseType: exerciseTypeRef.current, reps: countRef.current, duration: 300, accuracy: 100 }).catch(console.error);
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
        if (!isTrackingRef.current) return;
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
                        lastPoseRef.current = pose;
                        analyzePose(pose);
                    } else {
                        // Only keep ghost if we lose detection
                        if (canvasRef.current && lastPoseRef.current) {
                            const ctx = canvasRef.current.getContext("2d");
                            if (ctx) {
                                ctx.clearRect(0, 0, videoWidth, videoHeight);
                                drawPose(lastPoseRef.current, ctx, { opacity: 0.15 });
                            }
                        }
                    }
                    
                    // Always draw current pose if detected
                    if (!canvasRef.current) return;
                    const ctx = canvasRef.current.getContext("2d");
                    if (ctx && poses.length > 0) {
                        ctx.clearRect(0, 0, videoWidth, videoHeight);
                        drawPose(poses[0], ctx, { opacity: 1 });
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
        <div className={`flex flex-col items-center p-4 md:p-8 bg-[#0f172a] text-white transition-all duration-300 overflow-x-hidden ${isFullscreen ? 'fixed inset-0 z-[100] h-screen w-screen overflow-y-auto' : 'min-h-screen relative'}`}>
            {/* Body Health Scanner Overlay */}
            {showScanner && (
                <BodyHealthScanner
                    onSelectExercise={(id) => setExerciseType(id)}
                    onClose={() => setShowScanner(false)}
                />
            )}
            {/* Header Section */}
            <div className="w-full max-w-7xl flex flex-wrap items-center justify-between mb-8 gap-y-6 gap-x-4 px-2">
                {/* Left Section: Back + Title */}
                <div className="flex items-center gap-3 min-w-0 flex-shrink-0">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2.5 rounded-xl bg-slate-800/60 text-white hover:bg-slate-700 transition-all border border-slate-700/50"
                        title="Go back"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <div className="flex flex-col min-w-0">
                        <h1 className="text-xl md:text-2xl font-black tracking-tight whitespace-nowrap overflow-hidden text-ellipsis">{t('header')}</h1>
                        <p className="text-[10px] md:text-xs text-indigo-400 font-bold uppercase tracking-widest hidden sm:block opacity-70">{t('subheader')}</p>
                    </div>
                </div>

                {/* Center/Right Section: Controls Group */}
                <div className="flex items-center flex-wrap gap-3 md:gap-4 ml-auto">
                    {/* Language Selector */}
                    <div className="relative group flex-shrink">
                        <select
                            value={language}
                            onChange={(e) => setLanguage(e.target.value)}
                            className="appearance-none bg-indigo-500/10 border border-indigo-500/20 px-3 py-1.5 pr-8 rounded-lg text-xs font-black text-indigo-300 hover:bg-indigo-500/20 transition-all cursor-pointer focus:ring-1 focus:ring-indigo-500 outline-none uppercase tracking-tighter"
                        >
                            <option value="en" className="bg-slate-900">EN</option>
                            <option value="ml" className="bg-slate-900">മലയാളം</option>
                        </select>
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-indigo-400">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                            </svg>
                        </div>
                    </div>

                    <div className="flex items-baseline gap-2 px-3 py-1.5 bg-slate-800/40 rounded-xl border border-slate-700/50">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{t('repetitions')}</span>
                        <div className="text-2xl md:text-3xl font-black text-indigo-400 tabular-nums">
                            {count.toString().padStart(2, '0')}
                            {workoutMode === 'workout' && (
                                <span className="text-sm text-slate-600 font-bold ml-1">/ {repTarget}</span>
                            )}
                        </div>
                    </div>

                    <div className="hidden sm:flex flex-col items-end px-3 border-l border-slate-800">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-0.5">{t('injuryRisk')}</span>
                        <div className={`text-sm font-black uppercase tracking-tighter ${injuryRisk.level === 'High' ? 'text-red-500 animate-pulse' : 'text-green-500'}`}>
                            {injuryRisk.level}
                        </div>
                    </div>

                    <div className="hidden lg:flex flex-col items-center px-3 border-l border-slate-800">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">{t('mode')}</span>
                        <div className="flex bg-slate-900/80 p-1 rounded-lg border border-slate-700">
                            <button
                                onClick={() => setWorkoutMode('practice')}
                                className={`px-2 md:px-3 py-1 rounded-md text-[10px] font-black transition-all ${workoutMode === 'practice' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-white'}`}
                            >
                                {t('practice')}
                            </button>
                            <button
                                onClick={() => {
                                    setIsPremium(true);
                                    setWorkoutMode('workout');
                                }}
                                className={`px-2 md:px-3 py-1 rounded-md text-[10px] font-black transition-all ${workoutMode === 'workout' ? 'bg-amber-600 text-white' : 'text-slate-500 hover:text-white'}`}
                            >
                                {t('workout')}
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center gap-1 md:gap-2">
                        <button
                            onClick={() => setShowScanner(true)}
                            className="p-2 rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 hover:bg-indigo-600 hover:text-white transition-all"
                            title="Body Scanner"
                        >
                            <span className="text-sm">🩺</span>
                        </button>
                        
                        <button
                            onClick={() => setIsMuted(!isMuted)}
                            className={`p-2 rounded-lg transition-all ${isMuted ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'bg-green-500/10 text-green-500 border border-green-500/20'}`}
                            title={isMuted ? "Unmute" : "Mute"}
                        >
                            {isMuted ? (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15zM17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" /></svg>
                            ) : (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
                            )}
                        </button>

                        <button
                            onClick={() => setDiagnosticsEnabled(!diagnosticsEnabled)}
                            className={`p-2 rounded-lg transition-all ${diagnosticsEnabled ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}
                            title="Diagnostics"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                        </button>

                        <button
                            onClick={toggleFullscreen}
                            className="p-2 rounded-lg bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700 transition-all font-medium"
                            title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
                        >
                            {isFullscreen ? (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 14h6m-6 0v6m0-6l5-5m5 5l5-5m0 5v6m0-6h6m-6 0l5-5" /></svg>
                            ) : (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
                            )}
                        </button>
                    </div>
                </div>
            </div>
            {/* Main Grid Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 w-full max-w-7xl items-stretch">

                {/* Left Column: Unified AI Coach + Reference Form side-by-side */}
                <div className="flex flex-col h-full">
                    <div className="bg-slate-800/50 border border-slate-700 rounded-3xl overflow-hidden shadow-2xl flex flex-col flex-1">

                        {/* Unified Header */}
                        <div className="p-4 border-b border-slate-700 bg-slate-800/80 flex justify-between items-center shrink-0">
                            <div className="flex items-center gap-4">
                                <span className="text-sm font-bold uppercase tracking-widest text-indigo-400">{t('aiCoach')}</span>
                                <span className="px-3 py-1 bg-indigo-500/20 text-indigo-400 rounded-full text-xs font-bold uppercase">{t('liveGuidance')}</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-sm font-bold uppercase tracking-widest text-indigo-400">{t('referenceForm')}</span>
                                <span className="px-3 py-1 bg-indigo-500/20 text-indigo-400 rounded-full text-xs font-bold uppercase">{t('targetPerfect')}</span>
                            </div>
                        </div>

                        {/* 2-Column Body: AI Coach | Reference Form */}
                        <div className="grid grid-cols-1 md:grid-cols-2 flex-1 min-h-0">

                            {/* Left: AI Coach Avatar */}
                            <div className="flex flex-col border-b md:border-b-0 md:border-r border-slate-700 bg-slate-900/40">
                                <div className="flex-1 w-full p-4 flex items-center justify-center min-h-[200px]">
                                    <TalkingAvatar isTalking={isTalking} expression={avatarExpression} />
                                </div>
                            </div>

                            {/* Right: Reference Exercise Image + Instructions */}
                            <div className="flex flex-col">
                                <div className="relative bg-black flex-1 flex items-center justify-center min-h-[160px]">
                                    {EXERCISE_DATA[exerciseType] ? (
                                        <img
                                            key={exerciseType}
                                            src={EXERCISE_DATA[exerciseType].demoUrl}
                                            alt={EXERCISE_TRANSLATIONS[language][exerciseType]?.name}
                                            className="w-full h-full object-contain"
                                            style={{ maxHeight: '260px' }}
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
                                {/* Instructions */}
                                <div className="p-4 border-t border-slate-700 bg-slate-900/30 shrink-0">
                                    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">{t('instructions')}</h3>
                                    <p className="text-gray-300 leading-relaxed text-sm">
                                        {EXERCISE_TRANSLATIONS[language][exerciseType]?.instructions || t('selectExercise')}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column: Live Analysis */}
                <div className="flex flex-col gap-4">
                    <div className="bg-slate-800/50 border border-slate-700 rounded-3xl shadow-2xl relative flex flex-col">
                        <div className="p-4 border-b border-slate-700 bg-slate-800/80 flex justify-between items-center shrink-0 flex-wrap gap-2">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-bold uppercase tracking-widest text-green-400">{t('analysisEngine')}</span>
                                {classifier && exerciseType === 'shoulder_raise' && (
                                    <div className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-tighter bg-indigo-600 text-white animate-pulse">
                                        {t('customAIActive')}
                                    </div>
                                )}
                                <div className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-tighter ${isResting ? 'bg-amber-500/20 text-amber-500' :
                                    showWorkoutSummary ? 'bg-indigo-500/20 text-indigo-400' :
                                        'bg-green-500/20 text-green-500'
                                    }`}>
                                    {isResting ? t('resting') : showWorkoutSummary ? t('sessionFinished') : t('activeTracking')}
                                </div>
                                <div className="px-2 py-0.5 rounded-md text-[8px] font-bold bg-slate-700 text-slate-400">
                                    Heat: {engineHeat}
                                </div>
                                {/* Start / Stop buttons */}
                                <button
                                    onClick={() => setIsTracking(true)}
                                    disabled={isTracking}
                                    className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                                        isTracking
                                            ? 'bg-green-600/20 text-green-500 cursor-default opacity-60'
                                            : 'bg-green-600 text-white hover:bg-green-500 shadow-lg shadow-green-600/30'
                                    }`}
                                >
                                    {t('start')}
                                </button>
                                <button
                                    onClick={() => setIsTracking(false)}
                                    disabled={!isTracking}
                                    className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                                        !isTracking
                                            ? 'bg-red-500/20 text-red-400 cursor-default opacity-60'
                                            : 'bg-red-500/10 text-red-400 hover:bg-red-500/30'
                                    }`}
                                >
                                    {t('stop')}
                                </button>
                            </div>
                            <button
                                onClick={() => {
                                    setDetector(null);
                                    setIsLoading(true);
                                    setTimeout(() => window.location.reload(), 500);
                                }}
                                className="text-[10px] font-bold text-slate-500 hover:text-white transition-all uppercase underline underline-offset-4"
                            >
                                {t('forceResetAI')}
                            </button>
                        </div>
                        <div className="relative bg-black w-full flex-1" style={{ minHeight: 'clamp(280px, 45vh, 520px)' }}>
                            {isLoading && (
                                <div className="absolute inset-0 flex items-center justify-center z-30 bg-slate-900 bg-opacity-95">
                                    <div className="flex flex-col items-center">
                                        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                                        <p className="font-medium text-indigo-400">{t('configuringNeuralNetwork')}</p>
                                    </div>
                                </div>
                            )}
                            <Webcam
                                ref={webcamRef}
                                mirrored={true}
                                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', opacity: 0.85 }}
                            />
                            <canvas
                                ref={canvasRef}
                                className="absolute inset-0 w-full h-full z-20"
                                style={{ 
                                    transform: 'scaleX(-1)',
                                    display: 'block',
                                    backgroundColor: canvasDebug ? 'rgba(0, 255, 0, 0.05)' : 'transparent'
                                }}
                            />

                            {/* Dynamic Feedback Overlay */}
                            <div className="absolute inset-x-0 bottom-8 flex justify-center z-30 px-6">
                                <div className={`backdrop-blur-xl px-10 py-5 rounded-2xl shadow-2xl border transition-all duration-300 transform ${isPositive(feedback)
                                    ? 'bg-green-500/20 border-green-500/50 scale-105'
                                    : isWarning(feedback)
                                        ? 'bg-yellow-500/20 border-yellow-500/50 scale-100'
                                        : 'bg-indigo-500/20 border-indigo-500/50 scale-100'
                                    }`}>
                                    <p className={`text-2xl font-black text-center ${isPositive(feedback) ? 'text-green-400' : 'text-white'
                                        }`}>
                                        {feedback.toUpperCase()}
                                    </p>
                                </div>
                            </div>

                            {/* Diagnostic Panel Overlay */}
                            {diagnosticsEnabled && (
                                <div className="absolute top-4 right-4 z-[40] w-48 bg-slate-900/90 backdrop-blur-md border border-slate-700 rounded-2xl p-4 shadow-2xl animate-in slide-in-from-right duration-300">
                                    <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                        <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></div>
                                        {t('diagnostics')}
                                    </h4>
                                    <div className="space-y-4">
                                        {Object.entries(jointConfidence).filter(([k]) => k !== 'side').map(([joint, conf]) => (
                                            <div key={joint}>
                                                <div className="flex justify-between text-[8px] font-bold text-slate-500 uppercase mb-1">
                                                    <span>{joint}</span>
                                                    <span className={conf > 70 ? 'text-green-400' : conf > 40 ? 'text-yellow-400' : 'text-red-400'}>{conf}%</span>
                                                </div>
                                                <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full transition-all duration-500 ${conf > 70 ? 'bg-green-500' : conf > 40 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                                        style={{ width: `${conf}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        ))}
                                        <div className="pt-2 border-t border-slate-800">
                                            <div className="flex justify-between text-[8px] font-bold text-slate-500 uppercase">
                                                <span>{t('activeSide')}</span>
                                                <span className="text-indigo-400">{jointConfidence.side || t('none')}</span>
                                            </div>
                                            <div className="flex justify-between text-[8px] font-bold text-slate-500 uppercase mt-2">
                                                <span>{t('angle')}</span>
                                                <span className="text-white font-black">{debugInfo.kneeAngle}°</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
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
                            <option value="kneebend">🦵 {t('kneebend')}</option>
                            <option value="shoulder_raise">💪 {t('shoulder_raise')}</option>
                            <option value="arm_stretch">👐 {t('arm_stretch')}</option>
                            <option value="squat">🏋️ {t('squat')}</option>
                            <option value="pushup">💪 {t('pushup')}</option>
                            <option value="lunge">🦵 {t('lunge')}</option>
                            <option value="hand_stretch">🖐️ {t('hand_stretch')}</option>
                            <option value="neck_rotation">🔄 {t('neck_rotation')}</option>
                            <option value="neck_tilt">↕️ {t('neck_tilt')}</option>
                            <option value="neck_slide">↔️ {t('neck_slide')}</option>
                        </select>

                        {/* Adjustable Rep Target (Premium Feature UI) */}
                        {workoutMode === 'workout' && (
                            <div className="flex items-center gap-3 bg-slate-800 border border-slate-700 px-6 py-2 rounded-2xl shadow-inner">
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest whitespace-nowrap">{t('target')}</span>
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
                                speak(null, 'counterReset');
                            }}
                            className="px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold transition-all shadow-lg shadow-indigo-600/30 flex items-center gap-2"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            {t('reset')}
                        </button>
                    </div>
                </div>

            </div>

            {/* Footer Info */}
            <div className="mt-12 text-gray-500 text-sm font-medium flex gap-8 items-center bg-slate-900/50 px-8 py-3 rounded-full border border-slate-800">
                <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                    {t('poseTracking')}: MoveNet V1
                </div>
                <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-indigo-500 rounded-full"></span>
                    {t('engine')}: TensorFlow.js
                </div>
                <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                    {t('feedback')}: AI Logic
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

                        <h2 className="text-4xl font-black mb-2 text-white tracking-tight">{t('workoutComplete')}</h2>
                        <p className="text-slate-400 font-medium mb-10">{t('dailyGoalsReached')}</p>

                        <div className="grid grid-cols-2 gap-4 mb-10">
                            <div className="bg-slate-800/80 p-6 rounded-3xl border border-slate-700 shadow-lg">
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">{t('totalReps')}</p>
                                <p className="text-4xl font-black text-indigo-400">{count}</p>
                            </div>
                            <div className="bg-slate-800/80 p-6 rounded-3xl border border-slate-700 shadow-lg">
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">{t('setAccuracy')}</p>
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
                            {t('closeSummary')}
                        </button>
                    </div>
                </div>
            )}

            {/* Rest Timer Overlay */}
            {isResting && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/80 backdrop-blur-md">
                    <div className="text-center">
                        <p className="text-xl font-bold text-indigo-400 mb-2 uppercase tracking-widest">{t('restPeriod')}</p>
                        <p className="text-9xl font-black text-white tabular-nums">{restTimeLeft}</p>
                        <button
                            onClick={() => setIsResting(false)}
                            className="mt-8 px-6 py-2 bg-slate-800 text-slate-400 rounded-full text-sm font-bold hover:text-white transition-all uppercase tracking-widest"
                        >
                            {t('skipRest')}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AIExerciseCoach;