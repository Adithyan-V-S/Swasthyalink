const { onRequest } = require("firebase-functions/v2/https");
const PredictiveAnalyticsService = require('./ml/predictiveAnalytics');
const HealthRiskModel = require('./models/healthRiskModel');
const MLHelpers = require('./utils/mlHelpers');

// Helper for CORS
const setCors = (res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
};

/**
 * Health Risk Assessment
 */
exports.healthRiskAssessment = onRequest(async (req, res) => {
    setCors(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const healthData = req.body;
        if (!healthData || Object.keys(healthData).length === 0) {
            return res.status(400).json({ success: false, error: 'Health data is required' });
        }

        const validation = MLHelpers.validateHealthData(healthData);
        if (!validation.isValid) {
            return res.status(400).json({ success: false, error: 'Missing required fields', details: validation });
        }

        const normalizedData = MLHelpers.normalizeHealthData(healthData);
        const riskAssessment = await PredictiveAnalyticsService.calculateHealthRisk(normalizedData);
        const healthScore = MLHelpers.calculateHealthScore(normalizedData);
        const insights = MLHelpers.generateHealthInsights(normalizedData);

        let stats = null;
        if (Array.isArray(healthData)) {
            stats = MLHelpers.generateHealthStats(healthData);
        }

        res.json({
            success: true,
            riskAssessment,
            healthScore,
            insights,
            stats,
            dataQuality: validation,
            generatedAt: new Date().toISOString()
        });
    } catch (error) {
        console.error('Health risk assessment error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Health Trends Prediction
 */
exports.healthTrends = onRequest(async (req, res) => {
    setCors(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { historicalData, userId } = req.body;
        if (!historicalData || !Array.isArray(historicalData) || historicalData.length === 0) {
            return res.status(400).json({ success: false, error: 'Historical health data is required' });
        }

        const trends = await PredictiveAnalyticsService.predictHealthTrends(historicalData);
        res.json({
            success: true,
            trends,
            userId,
            dataPoints: historicalData.length,
            generatedAt: new Date().toISOString()
        });
    } catch (error) {
        console.error('Health trends prediction error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Disease Risk Prediction
 */
exports.diseaseRisk = onRequest(async (req, res) => {
    setCors(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        // Handle diseaseType from path or body since Firebase Functions V2 extracts path as __remaining
        const diseaseType = req.body.diseaseType || req.query.diseaseType;
        const healthData = req.body.healthData || req.body;

        if (!diseaseType) return res.status(400).json({ success: false, error: 'Disease type is required' });
        if (!healthData) return res.status(400).json({ success: false, error: 'Health data is required' });

        const normalizedData = MLHelpers.normalizeHealthData(healthData);
        const riskScore = HealthRiskModel.predictDiseaseRisk(diseaseType, normalizedData);
        const interpretation = HealthRiskModel.getRiskInterpretation(riskScore);

        res.json({
            success: true,
            diseaseType,
            riskScore,
            interpretation,
            factors: normalizedData,
            generatedAt: new Date().toISOString()
        });
    } catch (error) {
        console.error('Disease risk prediction error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Health Statistics
 */
exports.healthStats = onRequest(async (req, res) => {
    setCors(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { dataPoints, metrics } = req.body;
        if (!dataPoints || !Array.isArray(dataPoints) || dataPoints.length === 0) {
            return res.status(400).json({ success: false, error: 'Health data points are required' });
        }

        const stats = MLHelpers.generateHealthStats(dataPoints);
        let filteredStats = stats;
        if (metrics && Array.isArray(metrics)) {
            filteredStats = {};
            metrics.forEach(metric => {
                if (stats[metric]) filteredStats[metric] = stats[metric];
            });
        }

        res.json({
            success: true,
            stats: filteredStats,
            totalDataPoints: dataPoints.length,
            metricsAnalyzed: Object.keys(filteredStats).length,
            generatedAt: new Date().toISOString()
        });
    } catch (error) {
        console.error('Health statistics error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Health Recommendations
 */
exports.healthRecommendations = onRequest(async (req, res) => {
    setCors(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const healthData = req.body;
        if (!healthData) return res.status(400).json({ success: false, error: 'Health data is required' });

        const normalizedData = MLHelpers.normalizeHealthData(healthData);
        const riskAssessment = await PredictiveAnalyticsService.calculateHealthRisk(normalizedData);
        const insights = MLHelpers.generateHealthInsights(normalizedData);

        const recommendations = {
            immediate: riskAssessment.recommendations?.immediate || [],
            shortTerm: riskAssessment.recommendations?.shortTerm || [],
            longTerm: riskAssessment.recommendations?.longTerm || [],
            lifestyle: riskAssessment.recommendations?.lifestyle || [],
            custom: insights
        };

        res.json({
            success: true,
            recommendations,
            basedOn: {
                riskLevel: riskAssessment.overallRisk?.level,
                dataCompleteness: riskAssessment.dataCompleteness
            },
            generatedAt: new Date().toISOString()
        });
    } catch (error) {
        console.error('Health recommendations error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Validate Health Data
 */
exports.validateHealthData = onRequest(async (req, res) => {
    setCors(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const healthData = req.body;
        if (!healthData) return res.status(400).json({ success: false, error: 'Health data is required' });

        const validation = MLHelpers.validateHealthData(healthData);
        const normalizedData = MLHelpers.normalizeHealthData(healthData);
        const healthScore = MLHelpers.calculateHealthScore(normalizedData);

        res.json({
            success: true,
            validation,
            normalizedData,
            healthScore,
            generatedAt: new Date().toISOString()
        });
    } catch (error) {
        console.error('Health data validation error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
