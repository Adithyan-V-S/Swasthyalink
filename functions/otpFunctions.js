const { onRequest } = require("firebase-functions/v2/https");
const otpService = require('./src/services/otpService');

// Helper for CORS
const setCors = (res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
};

/**
 * Send OTP via email
 */
exports.sendOTP = onRequest(async (req, res) => {
    setCors(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { email, phone, doctorName, purpose, method = 'email' } = req.body;

        let result;
        if (method === 'email' && email) {
            result = await otpService.sendEmailOTP(email, doctorName, purpose);
        } else if (method === 'phone' && phone) {
            result = await otpService.sendSMSOTP(phone, doctorName, purpose);
        } else {
            return res.status(400).json({ success: false, error: 'Invalid method or missing recipient' });
        }

        res.json(result);
    } catch (error) {
        console.error('Error sending OTP:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Verify OTP
 */
exports.verifyOTP = onRequest(async (req, res) => {
    setCors(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { otpId, otp } = req.body;
        if (!otpId || !otp) return res.status(400).json({ success: false, error: 'OTP ID and code are required' });

        const result = await otpService.verifyOTP(otpId, otp);
        res.json(result);
    } catch (error) {
        console.error('Error verifying OTP:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Resend OTP
 */
exports.resendOTP = onRequest(async (req, res) => {
    setCors(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { otpId } = req.body;
        if (!otpId) return res.status(400).json({ success: false, error: 'OTP ID is required' });

        const result = await otpService.resendOTP(otpId);
        res.json(result);
    } catch (error) {
        console.error('Error resending OTP:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
