import React from 'react';

const BranchQueue = ({ queue, onSelectPatient, selectedPatientId }) => {
    return (
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100 h-full flex flex-col">
            <div className="bg-slate-800 px-6 py-4 flex justify-between items-center">
                <div>
                    <h3 className="text-xl font-bold text-white">Patient Queue</h3>
                    <p className="text-slate-400 text-sm">Real-time branch check-ins</p>
                </div>
                <div className="bg-blue-500 text-white px-3 py-1 rounded-full text-xs font-bold">
                    {queue.length} Waiting
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {queue.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center p-8">
                        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                            <span className="material-icons text-gray-300 transform scale-150">people_outline</span>
                        </div>
                        <p className="text-gray-500 font-medium">No patients in the queue.</p>
                        <p className="text-gray-400 text-xs mt-1">New check-ins will appear here automatically.</p>
                    </div>
                ) : (
                    queue.map((item, index) => (
                        <div
                            key={item.id}
                            onClick={() => onSelectPatient(item)}
                            className={`p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between group ${selectedPatientId === item.id
                                    ? 'bg-blue-50 border-blue-200 shadow-md'
                                    : 'bg-gray-50 border-gray-100 hover:bg-white hover:border-blue-200'
                                }`}
                        >
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shadow-sm ${index === 0 ? 'bg-orange-500' : 'bg-indigo-500'
                                    }`}>
                                    {item.name[0].toUpperCase()}
                                </div>
                                <div>
                                    <h4 className="font-bold text-gray-800 leading-none">{item.name}</h4>
                                    <span className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">
                                        Check-in: {item.checkInTime}
                                    </span>
                                </div>
                            </div>

                            <div className="flex flex-col items-end">
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${item.priority === 'High'
                                        ? 'bg-red-100 text-red-600'
                                        : 'bg-green-100 text-green-600'
                                    }`}>
                                    {item.priority}
                                </span>
                                <span className="text-[10px] text-gray-400 mt-1">#{index + 1} in line</span>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-100">
                <button className="w-full py-3 bg-white border border-gray-200 text-gray-600 text-sm font-bold rounded-xl hover:bg-gray-100 transition-colors flex items-center justify-center gap-2">
                    <span className="material-icons text-sm">refresh</span>
                    Refresh Queue
                </button>
            </div>
        </div>
    );
};

export default BranchQueue;
