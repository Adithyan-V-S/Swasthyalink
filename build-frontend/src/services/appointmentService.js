const API_URL = 'https://us-central1-swasthyalink-42535.cloudfunctions.net';

export const createAppointment = async (appointmentData) => {
    const response = await fetch(`${API_URL}/createAppointment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(appointmentData)
    });
    return response.json();
};

export const getAppointments = async (uid, role) => {
    const response = await fetch(`${API_URL}/getAppointments?uid=${uid}&role=${role}`);
    return response.json();
};

export const updateAppointmentStatus = async (appointmentId, status) => {
    const response = await fetch(`${API_URL}/updateAppointmentStatus`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointmentId, status })
    });
    return response.json();
};
