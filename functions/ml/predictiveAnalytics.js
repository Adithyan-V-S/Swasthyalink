/**
 * Predictive Health Analytics Service
 * Provides health risk assessment and predictive insights based on patient data
 */

// Import real ML models for diabetes and stroke prediction
const DiabetesMLModel = require('./diabetesMLModel');
const StrokeMLModel = require('./strokeMLModel');

class PredictiveAnalyticsService {
  constructor() {
    this.riskFactors = {
      age: {
        weight: 0.15,
        thresholds: {
          low: { min: 0, max: 30, risk: 0.1 },
          moderate: { min: 31, max: 50, risk: 0.3 },
          high: { min: 51, max: 65, risk: 0.6 },
          veryHigh: { min: 66, max: 120, risk: 0.9 }
        }
      },
      bmi: {
        weight: 0.20,
        thresholds: {
          underweight: { min: 0, max: 18.5, risk: 0.3 },
          normal: { min: 18.5, max: 24.9, risk: 0.1 },
          overweight: { min: 25, max: 29.9, risk: 0.4 },
          obese: { min: 30, max: 100, risk: 0.8 }
        }
      },
      bloodPressure: {
        weight: 0.18,
        thresholds: {
          normal: { systolic: { min: 0, max: 120 }, diastolic: { min: 0, max: 80 }, risk: 0.1 },
          elevated: { systolic: { min: 121, max: 129 }, diastolic: { min: 0, max: 80 }, risk: 0.3 },
          stage1: { systolic: { min: 130, max: 139 }, diastolic: { min: 81, max: 89 }, risk: 0.6 },
          stage2: { systolic: { min: 140, max: 180 }, diastolic: { min: 90, max: 120 }, risk: 0.9 },
          crisis: { systolic: { min: 181, max: 300 }, diastolic: { min: 121, max: 200 }, risk: 1.0 }
        }
      },
      cholesterol: {
        weight: 0.15,
        thresholds: {
          desirable: { min: 0, max: 200, risk: 0.1 },
          borderline: { min: 201, max: 239, risk: 0.4 },
          high: { min: 240, max: 500, risk: 0.8 }
        }
      },
      glucose: {
        weight: 0.12,
        thresholds: {
          normal: { min: 0, max: 100, risk: 0.1 },
          prediabetic: { min: 101, max: 125, risk: 0.5 },
          diabetic: { min: 126, max: 500, risk: 0.9 }
        }
      },
      smoking: {
        weight: 0.10,
        thresholds: {
          never: { risk: 0.1 },
          former: { risk: 0.3 },
          current: { risk: 0.8 }
        }
      },
      exercise: {
        weight: 0.10,
        thresholds: {
          regular: { risk: 0.1 },
          occasional: { risk: 0.3 },
          sedentary: { risk: 0.7 }
        }
      }
    };

    this.diseaseModels = {
      cardiovascular: {
        name: 'Cardiovascular Disease Risk',
        factors: ['age', 'bloodPressure', 'cholesterol', 'smoking', 'bmi', 'exercise'],
        baseRisk: 0.05
      },
      diabetes: {
        name: 'Type 2 Diabetes Risk',
        diseaseType: 'diabetes',
        factors: ['age', 'bmi', 'glucose', 'bloodPressure', 'pregnancies', 'insulin'],
        baseRisk: 0.03,
        isMLModel: true
      },
      stroke: {
        name: 'Stroke Risk',
        diseaseType: 'stroke',
        factors: ['age', 'bloodPressure', 'cholesterol', 'smoking', 'bmi', 'hypertension', 'heartDisease'],
        baseRisk: 0.02,
        isMLModel: true
      },
      kidney: {
        name: 'Kidney Disease Risk',
        factors: ['age', 'bloodPressure', 'glucose', 'bmi'],
        baseRisk: 0.01
      }
    };
  }

  /**
   * Calculate overall health risk score
   * @param {Object} healthData - Patient health data
   * @returns {Object} Risk assessment results
   */
  async calculateHealthRisk(healthData) {
    try {
      const riskScores = {};
      let totalWeightedRisk = 0;
      let totalWeight = 0;

      // Calculate risk for each factor
      for (const [factor, config] of Object.entries(this.riskFactors)) {
        if (healthData[factor] !== undefined) {
          const factorRisk = this.calculateFactorRisk(factor, healthData[factor]);
          riskScores[factor] = {
            score: factorRisk,
            weight: config.weight,
            contribution: factorRisk * config.weight
          };
          totalWeightedRisk += factorRisk * config.weight;
          totalWeight += config.weight;
        }
      }

      const overallRisk = totalWeight > 0 ? totalWeightedRisk / totalWeight : 0;

      // Calculate disease-specific risks
      const diseaseRisks = {};
      for (const [disease, model] of Object.entries(this.diseaseModels)) {
        diseaseRisks[disease] = this.calculateDiseaseRisk(healthData, model);
      }

      // Generate recommendations
      const recommendations = this.generateRecommendations(healthData, riskScores, diseaseRisks);

      // Calculate risk level
      const riskLevel = this.determineRiskLevel(overallRisk);

      return {
        success: true,
        overallRisk: {
          score: overallRisk,
          level: riskLevel,
          category: this.getRiskCategory(riskLevel)
        },
        factorBreakdown: riskScores,
        diseaseRisks,
        recommendations,
        generatedAt: new Date().toISOString(),
        dataCompleteness: this.calculateDataCompleteness(healthData)
      };
    } catch (error) {
      console.error('Error calculating health risk:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Calculate risk for a specific health factor
   * @param {string} factor - Health factor name
   * @param {any} value - Factor value
   * @returns {number} Risk score (0-1)
   */
  calculateFactorRisk(factor, value) {
    const config = this.riskFactors[factor];
    if (!config) return 0;

    switch (factor) {
      case 'age':
        return this.calculateAgeRisk(value);
      case 'bmi':
        return this.calculateBMIRisk(value);
      case 'bloodPressure':
        return this.calculateBPRisk(value);
      case 'cholesterol':
        return this.calculateCholesterolRisk(value);
      case 'glucose':
        return this.calculateGlucoseRisk(value);
      case 'smoking':
        return this.calculateLifestyleRisk(value, config.thresholds);
      case 'exercise':
        return this.calculateLifestyleRisk(value, config.thresholds);
      default:
        return 0.5; // Default moderate risk for unknown factors
    }
  }

  /**
   * Calculate age-related risk
   */
  calculateAgeRisk(age) {
    for (const [level, threshold] of Object.entries(this.riskFactors.age.thresholds)) {
      if (age >= threshold.min && age <= threshold.max) {
        return threshold.risk;
      }
    }
    return 0.5; // Default moderate risk
  }

  /**
   * Calculate BMI-related risk
   */
  calculateBMIRisk(bmi) {
    for (const [level, threshold] of Object.entries(this.riskFactors.bmi.thresholds)) {
      if (bmi >= threshold.min && bmi <= threshold.max) {
        return threshold.risk;
      }
    }
    return 0.5; // Default moderate risk
  }

  /**
   * Calculate blood pressure risk
   */
  calculateBPRisk(bp) {
    const systolic = bp.systolic || 120;
    const diastolic = bp.diastolic || 80;

    for (const [level, threshold] of Object.entries(this.riskFactors.bloodPressure.thresholds)) {
      if (systolic >= threshold.systolic.min && systolic <= threshold.systolic.max &&
          diastolic >= threshold.diastolic.min && diastolic <= threshold.diastolic.max) {
        return threshold.risk;
      }
    }
    return 0.5; // Default moderate risk
  }

  /**
   * Calculate cholesterol risk
   */
  calculateCholesterolRisk(cholesterol) {
    for (const [level, threshold] of Object.entries(this.riskFactors.cholesterol.thresholds)) {
      if (cholesterol >= threshold.min && cholesterol <= threshold.max) {
        return threshold.risk;
      }
    }
    return 0.5; // Default moderate risk
  }

  /**
   * Calculate glucose risk
   */
  calculateGlucoseRisk(glucose) {
    for (const [level, threshold] of Object.entries(this.riskFactors.glucose.thresholds)) {
      if (glucose >= threshold.min && glucose <= threshold.max) {
        return threshold.risk;
      }
    }
    return 0.5; // Default moderate risk
  }

  /**
   * Calculate lifestyle factor risk
   */
  calculateLifestyleRisk(value, thresholds) {
    for (const [level, threshold] of Object.entries(thresholds)) {
      if (value === level) {
        return threshold.risk;
      }
    }
    return 0.5; // Default moderate risk
  }

  /**
   * Calculate disease-specific risk
   */
  calculateDiseaseRisk(healthData, model) {
    // Use real ML model for diabetes prediction
    if (model.diseaseType === 'diabetes') {
      const mlPrediction = DiabetesMLModel.predict(healthData);
      if (mlPrediction.success) {
        return {
          risk: mlPrediction.probability,
          level: mlPrediction.riskLevel,
          category: mlPrediction.riskCategory,
          confidence: mlPrediction.confidence,
          interpretation: mlPrediction.interpretation,
          isMLModel: true,
          modelInfo: mlPrediction.modelInfo
        };
      }
    }

    // Use real ML model for stroke prediction
    if (model.diseaseType === 'stroke') {
      const mlPrediction = StrokeMLModel.predict(healthData);
      if (mlPrediction.success) {
        return {
          risk: mlPrediction.probability,
          level: mlPrediction.riskLevel,
          category: mlPrediction.riskCategory,
          confidence: mlPrediction.confidence,
          interpretation: mlPrediction.interpretation,
          isMLModel: true,
          modelInfo: mlPrediction.modelInfo
        };
      }
    }

    // Fallback to rule-based calculation for other diseases
    let totalRisk = model.baseRisk;
    let totalWeight = 1; // Base risk weight

    for (const factor of model.factors) {
      if (healthData[factor] !== undefined) {
        const factorRisk = this.calculateFactorRisk(factor, healthData[factor]);
        totalRisk += factorRisk * 0.2; // Each factor contributes 20% to disease risk
        totalWeight += 0.2;
      }
    }

    return Math.min(totalRisk / totalWeight, 1.0);
  }

  /**
   * Generate personalized recommendations
   */
  generateRecommendations(healthData, riskScores, diseaseRisks) {
    const recommendations = {
      immediate: [],
      shortTerm: [],
      longTerm: [],
      lifestyle: []
    };

    // Immediate actions based on high-risk factors
    Object.entries(riskScores).forEach(([factor, data]) => {
      if (data.score > 0.7) {
        switch (factor) {
          case 'bloodPressure':
            recommendations.immediate.push('Consult a doctor immediately for blood pressure management');
            break;
          case 'glucose':
            recommendations.immediate.push('Seek medical attention for glucose level management');
            break;
          case 'bmi':
            recommendations.immediate.push('Consult healthcare provider for weight management');
            break;
        }
      }
    });

    // Short-term recommendations
    if (riskScores.bmi?.score > 0.6) {
      recommendations.shortTerm.push('Start a balanced diet and regular exercise routine');
    }
    if (riskScores.exercise?.score > 0.5) {
      recommendations.shortTerm.push('Incorporate at least 30 minutes of physical activity daily');
    }
    if (riskScores.smoking?.score > 0.5) {
      recommendations.shortTerm.push('Consider smoking cessation programs and support');
    }

    // Long-term recommendations
    recommendations.longTerm.push('Schedule regular health check-ups every 6 months');
    recommendations.longTerm.push('Maintain a health journal to track vital signs');
    recommendations.longTerm.push('Consider genetic testing for personalized health insights');

    // Lifestyle recommendations
    recommendations.lifestyle.push('Maintain a balanced diet rich in fruits and vegetables');
    recommendations.lifestyle.push('Ensure adequate sleep (7-9 hours per night)');
    recommendations.lifestyle.push('Practice stress management techniques');
    recommendations.lifestyle.push('Stay hydrated with at least 8 glasses of water daily');

    return recommendations;
  }

  /**
   * Determine risk level based on score
   */
  determineRiskLevel(score) {
    if (score < 0.2) return 'low';
    if (score < 0.4) return 'moderate';
    if (score < 0.6) return 'high';
    return 'very-high';
  }

  /**
   * Get risk category description
   */
  getRiskCategory(level) {
    const categories = {
      'low': {
        description: 'Excellent health status',
        color: 'green',
        action: 'Maintain current healthy lifestyle'
      },
      'moderate': {
        description: 'Good health with some risk factors',
        color: 'yellow',
        action: 'Monitor health indicators regularly'
      },
      'high': {
        description: 'Significant health risks present',
        color: 'orange',
        action: 'Consult healthcare provider and make lifestyle changes'
      },
      'very-high': {
        description: 'Critical health risks requiring immediate attention',
        color: 'red',
        action: 'Seek immediate medical consultation'
      }
    };
    return categories[level] || categories['moderate'];
  }

  /**
   * Calculate data completeness percentage
   */
  calculateDataCompleteness(healthData) {
    const requiredFields = Object.keys(this.riskFactors);
    const providedFields = requiredFields.filter(field => healthData[field] !== undefined);
    return Math.round((providedFields.length / requiredFields.length) * 100);
  }

  /**
   * Predict health trends based on historical data
   * @param {Array} historicalData - Array of historical health readings
   * @returns {Object} Trend analysis
   */
  async predictHealthTrends(historicalData) {
    try {
      if (!historicalData || historicalData.length < 2) {
        return {
          success: false,
          error: 'Insufficient historical data for trend analysis'
        };
      }

      const trends = {};

      // Analyze trends for each health metric
      for (const [metric, config] of Object.entries(this.riskFactors)) {
        const values = historicalData.map(data => data[metric]).filter(val => val !== undefined);

        if (values.length >= 2) {
          trends[metric] = this.analyzeTrend(values);
        }
      }

      return {
        success: true,
        trends,
        prediction: this.generateTrendPredictions(trends),
        confidence: this.calculateTrendConfidence(historicalData.length)
      };
    } catch (error) {
      console.error('Error predicting health trends:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Analyze trend for a series of values
   */
  analyzeTrend(values) {
    if (values.length < 2) return { trend: 'stable', confidence: 0 };

    const recent = values.slice(-3); // Last 3 values
    const older = values.slice(0, -3); // Earlier values

    const recentAvg = recent.reduce((sum, val) => sum + val, 0) / recent.length;
    const olderAvg = older.length > 0 ? older.reduce((sum, val) => sum + val, 0) / older.length : recentAvg;

    const change = recentAvg - olderAvg;
    const percentChange = olderAvg !== 0 ? (change / olderAvg) * 100 : 0;

    let trend, confidence;
    if (Math.abs(percentChange) < 5) {
      trend = 'stable';
      confidence = 0.8;
    } else if (percentChange > 10) {
      trend = 'increasing';
      confidence = 0.7;
    } else if (percentChange < -10) {
      trend = 'decreasing';
      confidence = 0.7;
    } else {
      trend = 'slightly-changing';
      confidence = 0.5;
    }

    return { trend, change: percentChange, confidence };
  }

  /**
   * Generate predictions based on trends
   */
  generateTrendPredictions(trends) {
    const predictions = [];

    Object.entries(trends).forEach(([metric, trendData]) => {
      if (trendData.trend === 'increasing' && trendData.confidence > 0.6) {
        predictions.push(`${metric} levels are trending upward - consider preventive measures`);
      } else if (trendData.trend === 'decreasing' && trendData.confidence > 0.6) {
        predictions.push(`${metric} levels are improving - continue current health practices`);
      }
    });

    return predictions;
  }

  /**
   * Calculate confidence in trend analysis
   */
  calculateTrendConfidence(dataPoints) {
    if (dataPoints < 3) return 0.3;
    if (dataPoints < 7) return 0.5;
    if (dataPoints < 14) return 0.7;
    return 0.9;
  }
}

module.exports = new PredictiveAnalyticsService();
