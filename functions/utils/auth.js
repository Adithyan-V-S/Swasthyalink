const admin = require('firebase-admin');

/**
 * Validates the Firebase ID token in the request header.
 * @param {Object} req - The request object.
 * @returns {Promise<Object>} The decoded token if valid.
 * @throws {Error} If the token is missing or invalid.
 */
const validateToken = async (req) => {
    if (!req.headers.authorization || !req.headers.authorization.startsWith('Bearer ')) {
        throw new Error('Unauthorized');
    }

    const idToken = req.headers.authorization.split('Bearer ')[1];
    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        return decodedToken;
    } catch (error) {
        console.error('Error verifying auth token:', error);
        throw new Error('Unauthorized');
    }
};

module.exports = { validateToken };
