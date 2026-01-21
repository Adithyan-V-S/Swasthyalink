const { onRequest } = require("firebase-functions/v2/https");
const admin = require('firebase-admin');

// Mock users from original server.js to maintain functionality if DB is empty
const mockUsers = [
    {
        email: 'john.doe@example.com',
        name: 'John Doe',
        phone: '+91 98765 43210',
        address: '123 Main Street, New York, NY 10001',
        city: 'New York',
        state: 'NY',
        zipCode: '10001'
    },
    {
        email: 'jane.smith@example.com',
        name: 'Jane Smith',
        phone: '+91 98765 43211',
        address: '456 Oak Avenue, Los Angeles, CA 90001',
        city: 'Los Angeles',
        state: 'CA',
        zipCode: '90001'
    },
    {
        email: 'mike.johnson@example.com',
        name: 'Mike Johnson',
        phone: '+91 98765 43212',
        address: '789 Pine Road, Chicago, IL 60601',
        city: 'Chicago',
        state: 'IL',
        zipCode: '60601'
    },
    {
        email: 'sarah.wilson@example.com',
        name: 'Sarah Wilson',
        phone: '+91 98765 43213',
        address: '321 Elm Street, Houston, TX 77001',
        city: 'Houston',
        state: 'TX',
        zipCode: '77001'
    },
    {
        email: 'emma.brown@example.com',
        name: 'Emma Brown',
        phone: '+91 98765 43214',
        address: '654 Maple Drive, Phoenix, AZ 85001',
        city: 'Phoenix',
        state: 'AZ',
        zipCode: '85001'
    },
    {
        email: 'david.davis@example.com',
        name: 'David Davis',
        phone: '+91 98765 43215',
        address: '987 Cedar Lane, Philadelphia, PA 19101',
        city: 'Philadelphia',
        state: 'PA',
        zipCode: '19101'
    }
];

// Helper for CORS
const setCors = (res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
};

exports.searchUsers = onRequest(async (req, res) => {
    setCors(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { query: searchTerm } = req.query;

        if (!searchTerm) {
            return res.status(400).json({ success: false, error: 'Query parameter is required' });
        }

        const lowerTerm = searchTerm.toLowerCase();

        // 1. Try Firestore users collection
        const db = admin.firestore();
        const usersSnapshot = await db.collection('users')
            .where('role', '==', 'patient') // Usually we search for patients in this context
            .limit(20)
            .get();

        let results = [];
        if (!usersSnapshot.empty) {
            results = usersSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })).filter(user =>
                (user.email && user.email.toLowerCase().includes(lowerTerm)) ||
                (user.name && user.name.toLowerCase().includes(lowerTerm))
            );
        }

        // 2. If no real users or explicitly requested, include mock users to preserve functionality
        const filteredMocks = mockUsers.filter(user =>
            user.email.toLowerCase().includes(lowerTerm) ||
            user.name.toLowerCase().includes(searchTerm)
        );

        // Combine (Prioritize real users)
        const combined = [...results, ...filteredMocks].slice(0, 10);

        res.json({ success: true, results: combined });
    } catch (error) {
        console.error('searchUsers error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

exports.advancedSearch = onRequest(async (req, res) => {
    setCors(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { query: searchTerm, searchType = 'all' } = req.query;

        if (!searchTerm) {
            return res.status(400).json({ success: false, error: 'Query parameter is required' });
        }

        const lowerTerm = searchTerm.toLowerCase();

        // Follow the exact switch logic from server.js
        const filterFn = (user) => {
            switch (searchType) {
                case 'email':
                    return user.email && user.email.toLowerCase().includes(lowerTerm);
                case 'name':
                    return user.name && user.name.toLowerCase().includes(lowerTerm);
                case 'address':
                    return (user.address && user.address.toLowerCase().includes(lowerTerm)) ||
                        (user.city && user.city.toLowerCase().includes(lowerTerm)) ||
                        (user.state && user.state.toLowerCase().includes(lowerTerm)) ||
                        (user.zipCode && user.zipCode.includes(searchTerm));
                default:
                    return (user.email && user.email.toLowerCase().includes(lowerTerm)) ||
                        (user.name && user.name.toLowerCase().includes(lowerTerm)) ||
                        (user.address && user.address.toLowerCase().includes(lowerTerm)) ||
                        (user.city && user.city.toLowerCase().includes(lowerTerm)) ||
                        (user.state && user.state.toLowerCase().includes(lowerTerm)) ||
                        (user.zipCode && user.zipCode.includes(searchTerm));
            }
        };

        const results = mockUsers.filter(filterFn);
        // In advanced search, they only used mockUsers in server.js, so we keep that to strictly follow logic

        res.json({ success: true, results });
    } catch (error) {
        console.error('advancedSearch error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
