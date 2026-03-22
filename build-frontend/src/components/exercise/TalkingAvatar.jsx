import React, { useState, useEffect } from 'react';

const TalkingAvatar = ({ isTalking, expression = 'neutral' }) => {
    const [blink, setBlink] = useState(false);

    // Procedural Blinking
    useEffect(() => {
        const blinkInterval = setInterval(() => {
            setBlink(true);
            setTimeout(() => setBlink(false), 150);
        }, Math.random() * 3000 + 2000); // Blink every 2-5 seconds

        return () => clearInterval(blinkInterval);
    }, []);

    // Expression Styles map
    const expressions = {
        neutral: { eye: 'scale-y-100', mouth: 'h-1 w-6 rounded-sm bg-slate-700' },
        happy: { eye: 'scale-y-100', mouth: 'h-4 w-8 rounded-b-full bg-slate-800' },
        alert: { eye: 'scale-y-125 scale-x-110', mouth: 'h-4 w-4 rounded-full bg-slate-800' }
    };

    const currentExpr = expressions[expression] || expressions.neutral;
    
    return (
        <div className="w-full h-full min-h-[300px] relative rounded-3xl overflow-hidden bg-gradient-to-b from-slate-800 to-slate-900 border border-slate-700 shadow-2xl flex items-center justify-center">
            
            {/* Status Indicator */}
            <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${isTalking ? 'bg-green-500 animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-slate-600'}`}></div>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    {isTalking ? 'AI Coach Active' : 'AI Coach Standby'}
                </span>
            </div>

            {/* Avatar Container */}
            <div className={`relative flex flex-col items-center transition-transform duration-500 ${isTalking ? 'scale-[1.02]' : 'scale-100'}`}>
                
                {/* AI Glow Effect (when talking) */}
                <div className={`absolute inset-0 bg-blue-500/20 blur-3xl rounded-full transition-opacity duration-300 ${isTalking ? 'opacity-100 animate-pulse' : 'opacity-0'}`}></div>

                {/* The "Head" */}
                <div className="w-32 h-40 bg-slate-200 rounded-[3rem] shadow-xl relative overflow-hidden flex flex-col items-center z-10 border-b-4 border-slate-300">
                    
                    {/* Eyes Area */}
                    <div className="flex gap-8 mt-12 mb-6">
                        {/* Left Eye */}
                        <div className={`w-4 h-6 bg-slate-800 rounded-full transition-transform duration-150 flex items-center justify-center ${blink ? 'scale-y-10' : currentExpr.eye}`}>
                            {!blink && expression === 'happy' && <div className="w-2 h-2 bg-white rounded-full absolute top-1 right-1"></div>}
                        </div>
                        {/* Right Eye */}
                        <div className={`w-4 h-6 bg-slate-800 rounded-full transition-transform duration-150 flex items-center justify-center ${blink ? 'scale-y-10' : currentExpr.eye}`}>
                             {!blink && expression === 'happy' && <div className="w-2 h-2 bg-white rounded-full absolute top-1 right-1"></div>}
                        </div>
                    </div>

                    {/* Mouth Area */}
                    <div className="relative h-8 flex items-center justify-center">
                        <div className={`transition-all duration-200 ${currentExpr.mouth} ${
                            isTalking && expression !== 'alert' && expression !== 'happy'
                            ? 'animate-[talk_0.2s_ease-in-out_infinite_alternate]' 
                            : ''
                        }`}>
                            {/* Inner mouth for talking (tongue indicator) */}
                            {isTalking && (expression === 'neutral' || expression === 'happy') && (
                                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-2 bg-red-400/80 rounded-t-full opacity-0 animate-[fade_0.4s_infinite_alternate]"></div>
                            )}
                        </div>
                    </div>
                </div>

                {/* The "Body/Shoulders" */}
                <div className="w-48 h-24 bg-gradient-to-b from-blue-600 to-blue-800 rounded-t-full mt-2 shadow-2xl z-0 relative overflow-hidden">
                    <div className="absolute inset-0 border-t-4 border-white/20 rounded-t-full"></div>
                </div>
            </div>

            {/* Custom CSS for Talk Animation */}
            <style>{`
                @keyframes talk {
                    0% { height: 4px; width: 24px; border-radius: 4px; }
                    100% { height: 16px; width: 16px; border-radius: 50%; }
                }
                @keyframes fade {
                    0% { opacity: 0; }
                    100% { opacity: 1; }
                }
            `}</style>
        </div>
    );
};

export default TalkingAvatar;
