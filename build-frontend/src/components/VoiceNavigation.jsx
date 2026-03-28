import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { FaMicrophone, FaMicrophoneSlash, FaVolumeUp } from 'react-icons/fa';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion'; // eslint-disable-line no-unused-vars

const COMMANDS = {
    'family network': '/familydashboard',
    'family dashboard': '/familydashboard',
    'profile': '/profile',
    'analytics': '/healthanalytics',
    'health analytics': '/healthanalytics',
    'home': '/',
    'go home': '/',
    'about': '/about',
    'exercise coach': '/exercise-coach',
    'coach': '/exercise-coach',
    'smart report': '/report-analyzer',
    'analyzer': '/report-analyzer',
    'appointments': '/appointments',
    'settings': '/settings',
    'doctor dashboard': '/doctordashboard?tab=dashboard',
    'doctor appointments': '/doctordashboard?tab=appointments',
    'manage appointments': '/doctordashboard?tab=appointments',
    'doctor patients': '/doctordashboard?tab=patients',
    'my patients': '/doctordashboard?tab=patients',
    'connect patient': '/doctordashboard?tab=connect',
    'doctor prescriptions': '/doctordashboard?tab=prescriptions',
    'doctor profile': '/doctordashboard?tab=profile',
};

const VoiceNavigation = () => {
    const [isListening, setIsListening] = useState(false);
    const [isWakeWordMode, setIsWakeWordMode] = useState(false);
    const [isVoiceActive, setIsVoiceActive] = useState(false);
    const [isSwitching, setIsSwitching] = useState(false);
    const [transcript, setTranscript] = useState('');
    const navigate = useNavigate();
    const location = useLocation();
    const { userRole } = useAuth();
    const recognitionRef = useRef(null);
    const wakeWordRecognitionRef = useRef(null);

    const handleCommand = useCallback((text) => {
        const lowercaseText = text.toLowerCase();

        // Doctor specific section commands (only if user is a doctor)
        if (userRole === 'doctor') {
            const doctorSections = {
                'dashboard': 'dashboard',
                'appointments': 'appointments',
                'manage appointments': 'appointments',
                'patients': 'patients',
                'my patients': 'patients',
                'connect': 'connect',
                'connect patient': 'connect',
                'prescriptions': 'prescriptions',
                'profile': 'profile',
                'my profile': 'profile'
            };

            for (const [command, tabId] of Object.entries(doctorSections)) {
                if (lowercaseText.includes(command)) {
                    toast.success(`Switching to ${command}...`, { icon: '🩺' });
                    
                    // If we're already on the dashboard, use a custom event for instant state change
                    if (location.pathname === '/doctordashboard') {
                        window.dispatchEvent(new CustomEvent('doctor-tab-change', { detail: tabId }));
                    } else {
                        navigate(`/doctordashboard?tab=${tabId}`);
                    }
                    return true;
                }
            }
        }

        // Check for exact or partial matches in commands
        let targetRoute = null;
        for (const [command, route] of Object.entries(COMMANDS)) {
            if (lowercaseText.includes(command)) {
                targetRoute = route;
                break;
            }
        }

        if (targetRoute) {
            toast.success(`Navigating to ${lowercaseText}...`, {
                icon: '🚀',
                style: {
                    borderRadius: '10px',
                    background: '#333',
                    color: '#fff',
                },
            });
            navigate(targetRoute);
            return true;
        } else {
            toast.error(`Command not recognized: "${text}"`, {
                style: {
                    borderRadius: '10px',
                    background: '#333',
                    color: '#fff',
                },
            });
            return false;
        }
    }, [navigate]);

    const startListening = useCallback(() => {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            toast.error('Voice recognition is not supported in this browser.');
            setIsSwitching(false);
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognition.lang = 'en-US';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
            setIsListening(true);
            setIsSwitching(false);
        };

        recognition.onresult = (event) => {
            const last = event.results.length - 1;
            const text = event.results[last][0].transcript;
            setTranscript(text);
            handleCommand(text);
        };

        recognition.onerror = (event) => {
            if (event.error !== 'no-speech' && event.error !== 'aborted') {
                console.error('Speech recognition error:', event.error);
                toast.error(`Error: ${event.error}`);
            }
            setIsListening(false);
            setIsSwitching(false);
        };

        recognition.onend = () => {
            setIsListening(false);
            setIsSwitching(false);
        };

        recognitionRef.current = recognition;
        try {
            recognition.start();
        } catch (e) {
            console.error('Start listening error:', e);
            setIsListening(false);
            setIsSwitching(false);
        }
    }, [handleCommand]);

    const stopListening = () => {
        if (recognitionRef.current) {
            recognitionRef.current.stop();
        }
    };

    // Wake word logic
    useEffect(() => {
        let wakeWordRecognition = null;

        if (isWakeWordMode && !isListening && !isSwitching) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (!SpeechRecognition) return;

            wakeWordRecognition = new SpeechRecognition();
            wakeWordRecognition.lang = 'en-US';
            wakeWordRecognition.continuous = true;
            wakeWordRecognition.interimResults = true;

            wakeWordRecognition.onresult = (event) => {
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    const result = event.results[i][0].transcript.toLowerCase();
                    console.log('Voice activity detected:', result); // Debugging log
                    
                    // Visual feedback for voice activity
                    setIsVoiceActive(true);
                    setTimeout(() => setIsVoiceActive(false), 1000);

                    const wakeVariants = [
                        'hey swasthyalink', 'hey swasya link', 'hey swasthya',
                        'hey swasthyalk', 'hey swasya link', 'hey swasthi link',
                        'hey swasthya line', 'hey swasti link', 'hey swasthy',
                        'a swasthya', 'a swasthya link', 'hey soft', 'hey softly',
                        'swasthya', 'swasthyalink'
                    ];

                    const matchedVariant = wakeVariants.find(variant => result.includes(variant));

                    if (matchedVariant) {
                        console.log('Wake word matched:', matchedVariant);
                        
                        // Check if there's more text after the wake word (one-shot command)
                        const commandText = result.split(matchedVariant).pop().trim();
                        if (commandText) {
                            console.log('Detected one-shot command:', commandText);
                            if (handleCommand(commandText)) {
                                wakeWordRecognition.stop();
                                return;
                            }
                        }

                        setIsSwitching(true);
                        wakeWordRecognition.stop();

                        const utterance = new SpeechSynthesisUtterance("Yes, I'm listening");
                        window.speechSynthesis.speak(utterance);

                        // Wait for audio feedback to finish and recognition to stop
                        setTimeout(() => startListening(), 1000);
                        break;
                    }
                }
            };

            wakeWordRecognition.onend = () => {
                // Only restart if we're still in wake word mode and NOT switching to command listening
                if (isWakeWordMode && !isListening && !isSwitching) {
                    try {
                        // Small delay before restarting to avoid errors
                        setTimeout(() => {
                            if (isWakeWordMode && !isListening && !isSwitching && wakeWordRecognition) {
                                wakeWordRecognition.start();
                            }
                        }, 300);
                    } catch (_e) {
                        // Silent fail for restart errors
                    }
                }
            };

            wakeWordRecognition.onerror = (event) => {
                if (event.error === 'not-allowed') {
                    setIsWakeWordMode(false);
                    toast.error('Microphone access denied');
                } else if (event.error !== 'no-speech' && event.error !== 'aborted') {
                    console.error('Wake word recognition error:', event.error);
                }
                
                // For most errors, we want to ensure it continues to attempt listening
                // if we're still in the correct mode. onend will handle the restart.
            };

            wakeWordRecognitionRef.current = wakeWordRecognition;
            try {
                wakeWordRecognition.start();
            } catch (e) {
                console.error('Wake word start error:', e);
            }
        }

        return () => {
            if (wakeWordRecognition) {
                wakeWordRecognition.onend = null; // Prevent restart on cleanup
                wakeWordRecognition.onerror = null;
                wakeWordRecognition.stop();
            }
        };
    }, [isWakeWordMode, isListening, isSwitching, startListening]);

    return (
        <div className="fixed bottom-36 right-5 z-50 flex flex-col items-end gap-3">
            <AnimatePresence>
                {isListening && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        className="bg-white/90 backdrop-blur-sm border border-indigo-100 p-4 rounded-2xl shadow-2xl mb-2 min-w-[200px] pointer-events-none"
                    >
                        <div className="flex items-center gap-3 mb-2">
                            <div className="flex gap-1">
                                {[...Array(3)].map((_, i) => (
                                    <motion.div
                                        key={i}
                                        animate={{ height: [8, 16, 8] }}
                                        transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.1 }}
                                        className="w-1 bg-indigo-600 rounded-full"
                                    />
                                ))}
                            </div>
                            <span className="text-sm font-medium text-gray-700">Listening...</span>
                        </div>
                        {transcript && (
                            <p className="text-xs text-indigo-600 italic font-medium">"{transcript}"</p>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="flex flex-col items-end gap-2">
                <button
                    onClick={() => {
                        const newMode = !isWakeWordMode;
                        setIsWakeWordMode(newMode);
                        toast.success(newMode ? 'Wake-word "Hey Swasthyalink" active' : 'Wake-word disabled');
                        if (!newMode && isListening) stopListening();
                    }}
                    className={`px-4 py-2 rounded-full text-xs font-semibold shadow-md transition-all duration-300 flex items-center gap-2 ${isWakeWordMode
                        ? (isVoiceActive ? 'bg-indigo-400 text-white scale-110' : 'bg-indigo-600 text-white translate-x-0')
                        : 'bg-white text-gray-600 border border-gray-200 translate-x-2'
                        }`}
                    title="Toggle 'Hey Swasthyalink' wake word"
                >
                    <FaVolumeUp className={isWakeWordMode || isVoiceActive ? 'animate-pulse' : ''} />
                    {isWakeWordMode ? (isVoiceActive ? 'Voice Detected...' : 'Voice Wake Active') : 'Enable Wake Word'}
                </button>

                <button
                    onClick={isListening ? stopListening : startListening}
                    disabled={isSwitching}
                    className={`group flex items-center gap-3 px-6 py-4 rounded-full shadow-2xl transition-all duration-500 transform hover:scale-105 active:scale-95 ${isListening
                        ? 'bg-red-500 text-white ring-4 ring-red-200'
                        : isSwitching
                            ? 'bg-indigo-400 text-white cursor-wait'
                            : 'bg-indigo-600 text-white hover:bg-indigo-700'
                        }`}
                >
                    <span className="font-bold text-sm tracking-wide">
                        {isListening ? 'STOP' : isSwitching ? '...' : 'USE ME'}
                    </span>
                    <div className="relative">
                        {isListening ? (
                            <FaMicrophoneSlash className="text-xl" />
                        ) : (
                            <FaMicrophone className="text-xl" />
                        )}
                        {!isListening && !isSwitching && (
                            <motion.div
                                animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                                transition={{ repeat: Infinity, duration: 2 }}
                                className="absolute inset-0 bg-white rounded-full -z-10"
                            />
                        )}
                    </div>
                </button>
            </div>
        </div>
    );
};

export default VoiceNavigation;
