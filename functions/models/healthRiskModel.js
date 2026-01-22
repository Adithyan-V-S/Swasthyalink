/**
 * Health Risk Assessment Model
 * Machine learning model for health risk prediction
 */

class HealthRiskModel {
  constructor() {
    this.modelWeights = {
      cardiovascular: {
        age: 0.25,
        bloodPressure: 0.30,
        cholesterol: 0.20,
        smoking: 0.15,
        bmi: 0.10
      },
      diabetes: {
        age: 0.20,
        bmi: 0.25,
        glucose: 0.30,
        familyHistory: 0.15,
        exercise: 0.10
      },
      respiratory: {
        age: 0.20,
        smoking: 0.40,
        bmi: 0.15,
        exercise: 0.15,
        environment: 0.10
      },
      stroke: {
        age: 0.25,
        bloodPressure: 0.35,
        cholesterol: 0.15,
        smoking: 0.15,
        bmi: 0.10
      },
      kidney: {
        age: 0.20,
        bloodPressure: 0.30,
        glucose: 0.25,
        bmi: 0.15,
        familyHistory: 0.10
      }
    };
  }

  /**
   * Predict disease risk using weighted scoring
   * @param {string} diseaseType - Type of disease to predict
   * @param {Object} healthData - Patient health data
   * @returns {number} Risk score (0-1)
   */
  predictDiseaseRisk(diseaseType, healthData) {
    const weights = this.modelWeights[diseaseType];
    if (!weights) {
      throw new Error(`Model not available for disease type: ${diseaseType}`);
    }

    let totalScore = 0;
    let totalWeight = 0;

    for (const [factor, weight] of Object.entries(weights)) {
      if (healthData[factor] !== undefined) {
        const normalizedValue = this.normalizeHealthFactor(factor, healthData[factor]);
        totalScore += normalizedValue * weight;
        totalWeight += weight;
      }
    }

    return totalWeight > 0 ? totalScore / totalWeight : 0;
  }

  /**
   * Normalize health factor values to 0-1 scale
   * @param {string} factor - Health factor name
   * @param {any} value - Raw factor value
   * @returns {number} Normalized value (0-1)
   */
  normalizeHealthFactor(factor, value) {
    const normalizers = {
      age: (age) => Math.min(age / 100, 1), // Normalize age to 0-1 scale
      bloodPressure: (bp) => {
        const systolic = bp.systolic || 120;
        return Math.min(systolic / 200, 1); // Normalize to 0-1 scale
      },
      cholesterol: (cholesterol) => Math.min(cholesterol / 300, 1),
      smoking: (smoking) => smoking === 'current' ? 1 : smoking === 'former' ? 0.5 : 0,
      bmi: (bmi) => {
        if (bmi < 18.5) return 0.3; // Underweight
        if (bmi < 25) return 0.1; // Normal
        if (bmi < 30) return 0.6; // Overweight
        return 1; // Obese
      },
      glucose: (glucose) => Math.min(glucose / 200, 1),
      familyHistory: (history) => history ? 0.8 : 0.2,
      exercise: (exercise) => {
        const exerciseMap = { 'regular': 0.1, 'occasional': 0.5, 'sedentary': 1 };
        return exerciseMap[exercise] || 0.5;
      },
      environment: (environment) => environment === 'polluted' ? 1 : 0.2
    };

    const normalizer = normalizers[factor];
    return normalizer ? normalizer(value) : 0.5;
  }

  /**
   * Get risk interpretation
   * @param {number} riskScore - Risk score (0-1)
   * @returns {Object} Risk interpretation
   */
  getRiskInterpretation(riskScore) {
    if (riskScore < 0.2) {
      return {
        level: 'Low',
        description: 'Minimal risk detected',
        color: 'green',
        recommendations: ['Continue healthy lifestyle', 'Regular check-ups recommended']
      };
    } else if (riskScore < 0.4) {
      return {
        level: 'Moderate',
        description: 'Some risk factors present',
        color: 'yellow',
        recommendations: ['Monitor health indicators', 'Consider lifestyle improvements']
      };
    } else if (riskScore < 0.7) {
      return {
        level: 'High',
        description: 'Significant risk factors present',
        color: 'orange',
        recommendations: ['Consult healthcare provider', 'Implement lifestyle changes', 'Regular monitoring required']
      };
    } else {
      return {
        level: 'Very High',
        description: 'Critical risk factors present',
        color: 'red',
        recommendations: ['Seek immediate medical attention', 'Comprehensive health evaluation needed', 'Urgent lifestyle changes required']
      };
    }
  }

  /**
   * Train model with new data (simplified implementation)
   * @param {Array} trainingData - Array of training samples
   * @param {string} diseaseType - Disease type to train
   */
  async trainModel(trainingData, diseaseType) {
    // Simplified training implementation
    // In a real implementation, this would use proper ML training algorithms
    console.log(`Training ${diseaseType} model with ${trainingData.length} samples`);

    // Update weights based on training data (simplified)
    if (this.modelWeights[diseaseType]) {
      // This is a placeholder for actual model training
      // Real implementation would use gradient descent, neural networks, etc.
      console.log(`Model training completed for ${diseaseType}`);
    }
  }
}

module.exports = new HealthRiskModel();
