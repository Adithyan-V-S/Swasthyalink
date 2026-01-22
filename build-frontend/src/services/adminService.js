const REGION = 'us-central1';
const PROJECT_ID = 'swasthyalink-42535';
const CLOUD_FUNCTIONS_BASE = `https://${REGION}-${PROJECT_ID}.cloudfunctions.net`;

const getAdminHeaders = () => {
    const adminSession = localStorage.getItem('adminSession');
    let token = 'preset-admin-token';
    if (adminSession) {
        try {
            const session = JSON.parse(adminSession);
            token = session.token || token;
        } catch (e) { }
    }
    return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };
};

export const adminLogin = async (credentials) => {
    try {
        const response = await fetch(`${CLOUD_FUNCTIONS_BASE}/adminLogin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(credentials)
        });
        return await response.json();
    } catch (error) {
        console.error('Admin login error:', error);
        return { success: false, error: error.message };
    }
};

export const getAllDoctors = async () => {
    try {
        const response = await fetch(`${CLOUD_FUNCTIONS_BASE}/getAllDoctors`, {
            headers: getAdminHeaders()
        });
        return await response.json();
    } catch (error) {
        console.error('Error fetching doctors:', error);
        return { success: false, error: error.message };
    }
};

export const getPendingDoctorRegistrations = async () => {
    try {
        const response = await fetch(`${CLOUD_FUNCTIONS_BASE}/getPendingDoctorRegistrations`, {
            headers: getAdminHeaders()
        });
        return await response.json();
    } catch (error) {
        console.error('Error fetching registrations:', error);
        return { success: false, error: error.message };
    }
};

export const approveDoctorRegistration = async (registrationId, loginId, password) => {
    try {
        const adminSession = JSON.parse(localStorage.getItem('adminSession') || '{}');
        const response = await fetch(`${CLOUD_FUNCTIONS_BASE}/approveDoctorRegistration`, {
            method: 'POST',
            headers: getAdminHeaders(),
            body: JSON.stringify({
                registrationId,
                loginId,
                password,
                adminId: adminSession.id
            })
        });
        return await response.json();
    } catch (error) {
        console.error('Error approving doctor:', error);
        return { success: false, error: error.message };
    }
};

export const rejectDoctorRegistration = async (registrationId) => {
    try {
        const adminSession = JSON.parse(localStorage.getItem('adminSession') || '{}');
        const response = await fetch(`${CLOUD_FUNCTIONS_BASE}/rejectDoctorRegistration`, {
            method: 'POST',
            headers: getAdminHeaders(),
            body: JSON.stringify({ registrationId, adminId: adminSession.id })
        });
        return await response.json();
    } catch (error) {
        console.error('Error rejecting doctor:', error);
        return { success: false, error: error.message };
    }
};

export const updateDoctorStatus = async (id, status) => {
    try {
        const adminSession = JSON.parse(localStorage.getItem('adminSession') || '{}');
        const response = await fetch(`${CLOUD_FUNCTIONS_BASE}/updateDoctorStatus`, {
            method: 'POST',
            headers: getAdminHeaders(),
            body: JSON.stringify({ id, status, adminId: adminSession.id })
        });
        return await response.json();
    } catch (error) {
        console.error('Error updating doctor status:', error);
        return { success: false, error: error.message };
    }
};

export const disableDoctor = async (id) => {
    try {
        const adminSession = JSON.parse(localStorage.getItem('adminSession') || '{}');
        const response = await fetch(`${CLOUD_FUNCTIONS_BASE}/disableDoctor`, {
            method: 'POST',
            headers: getAdminHeaders(),
            body: JSON.stringify({ id, adminId: adminSession.id })
        });
        return await response.json();
    } catch (error) {
        console.error('Error disabling doctor:', error);
        return { success: false, error: error.message };
    }
};

export const getAllPatients = async () => {
    try {
        const response = await fetch(`${CLOUD_FUNCTIONS_BASE}/getAllPatients`, {
            headers: getAdminHeaders()
        });
        return await response.json();
    } catch (error) {
        console.error('Error fetching patients:', error);
        return { success: false, error: error.message };
    }
};
