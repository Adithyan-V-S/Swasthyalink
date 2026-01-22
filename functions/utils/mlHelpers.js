/**
 * Machine Learning Helper Functions
 * Utility functions for ML operations and data processing
 */

class MLHelpers {
  /**
   * Calculate BMI from height and weight
   * @param {number} height - Height in centimeters
   * @param {number} weight - Weight in kilograms
   * @returns {number} BMI value
   */
  static calculateBMI(height, weight) {
    if (!height || !weight || height <= 0 || weight <= 0) {
      return null;
    }

    const heightInMeters = height / 100;
    return weight / (heightInMeters * heightInMeters);
  }

  /**
   * Classify BMI category
   * @param {number} bmi - BMI value
   * @returns {string} BMI category
   */
  static getBMICategory(bmi) {
    if (bmi < 18.5) return 'underweight';
    if (bmi < 25) return 'normal';
    if (bmi < 30) return 'overweight';
    return 'obese';
  }

  /**
   * Calculate blood pressure category
   * @param {number} systolic - Systolic pressure
   * @param {number} diastolic - Diastolic pressure
   * @returns {string} Blood pressure category
   */
  static getBPCategory(systolic, diastolic) {
    if (systolic < 120 && diastolic < 80) return 'normal';
    if (systolic < 130 && diastolic < 80) return 'elevated';
    if (systolic < 140 || diastolic < 90) return 'stage1';
    if (systolic < 180 || diastolic < 120) return 'stage2';
    return 'crisis';
  }

  /**
   * Calculate age from birth date
   * @param {string} birthDate - Birth date in ISO format
   * @returns {number} Age in years
   */
  static calculateAge(birthDate) {
    if (!birthDate) return null;

    const birth = new Date(birthDate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }

    return age;
  }

  /**
   * Validate health data completeness
   * @param {Object} healthData - Health data object
   * @returns {Object} Validation results
   */
  static validateHealthData(healthData) {
    const requiredFields = ['age', 'gender'];
    const optionalFields = ['height', 'weight', 'bloodPressure', 'cholesterol', 'glucose', 'smoking', 'exercise'];

    const missingRequired = requiredFields.filter(field => !healthData[field]);
    const providedOptional = optionalFields.filter(field => healthData[field]);

    const completeness = Math.round((providedOptional.length / optionalFields.length) * 100);

    return {
      isValid: missingRequired.length === 0,
      missingRequired,
      providedOptional,
      completeness,
      totalFields: requiredFields.length + optionalFields.length,
      providedFields: requiredFields.length - missingRequired.length + providedOptional.length
    };
  }

  /**
   * Normalize health metrics to standard ranges
   * @param {Object} healthData - Raw health data
   * @returns {Object} Normalized health data
   */
  static normalizeHealthData(healthData) {
    const normalized = { ...healthData };

    // Normalize BMI
    if (healthData.height && healthData.weight) {
      normalized.bmi = this.calculateBMI(healthData.height, healthData.weight);
    }

    // Normalize age
    if (healthData.birthDate) {
      normalized.age = this.calculateAge(healthData.birthDate);
    }

    // Normalize blood pressure category
    if (healthData.bloodPressure) {
      const bp = healthData.bloodPressure;
      normalized.bloodPressureCategory = this.getBPCategory(bp.systolic, bp.diastolic);
    }

    // Normalize BMI category
    if (normalized.bmi) {
      normalized.bmiCategory = this.getBMICategory(normalized.bmi);
    }

    return normalized;
  }

  /**
   * Calculate health score based on multiple factors
   * @param {Object} healthData - Normalized health data
   * @returns {Object} Health score and breakdown
   */
  static calculateHealthScore(healthData) {
    const scores = {};
    let totalScore = 0;
    let totalWeight = 0;

    // Age score (0-100, lower is better)
    if (healthData.age) {
      const ageScore = Math.min(healthData.age * 0.5, 100);
      scores.age = ageScore;
      totalScore += ageScore * 0.15;
      totalWeight += 0.15;
    }

    // BMI score (0-100, optimal around 50)
    if (healthData.bmi) {
      let bmiScore;
      if (healthData.bmi >= 18.5 && healthData.bmi <= 24.9) {
        bmiScore = 50; // Optimal range
      } else if (healthData.bmi < 18.5) {
        bmiScore = 30; // Underweight
      } else if (healthData.bmi <= 29.9) {
        bmiScore = 70; // Overweight
      } else {
        bmiScore = 90; // Obese
      }
      scores.bmi = bmiScore;
      totalScore += bmiScore * 0.20;
      totalWeight += 0.20;
    }

    // Blood pressure score (0-100, lower is better)
    if (healthData.bloodPressure) {
      const bp = healthData.bloodPressure;
      let bpScore;
      if (bp.systolic < 120 && bp.diastolic < 80) {
        bpScore = 20; // Normal
      } else if (bp.systolic < 130 && bp.diastolic < 80) {
        bpScore = 40; // Elevated
      } else if (bp.systolic < 140 || bp.diastolic < 90) {
        bpScore = 60; // Stage 1
      } else if (bp.systolic < 180 || bp.diastolic < 120) {
        bpScore = 80; // Stage 2
      } else {
        bpScore = 100; // Crisis
      }
      scores.bloodPressure = bpScore;
      totalScore += bpScore * 0.25;
      totalWeight += 0.25;
    }

    // Lifestyle factors
    if (healthData.smoking) {
      const smokingScore = healthData.smoking === 'never' ? 10 : healthData.smoking === 'former' ? 30 : 80;
      scores.smoking = smokingScore;
      totalScore += smokingScore * 0.15;
      totalWeight += 0.15;
    }

    if (healthData.exercise) {
      const exerciseScore = healthData.exercise === 'regular' ? 20 : healthData.exercise === 'occasional' ? 50 : 80;
      scores.exercise = exerciseScore;
      totalScore += exerciseScore * 0.15;
      totalWeight += 0.15;
    }

    // Lab values
    if (healthData.cholesterol) {
      let cholesterolScore;
      if (healthData.cholesterol < 200) cholesterolScore = 20;
      else if (healthData.cholesterol < 240) cholesterolScore = 50;
      else cholesterolScore = 80;
      scores.cholesterol = cholesterolScore;
      totalScore += cholesterolScore * 0.10;
      totalWeight += 0.10;
    }

    const overallScore = totalWeight > 0 ? totalScore / totalWeight : 0;

    return {
      overallScore: Math.round(overallScore),
      factorScores: scores,
      score: this.getHealthScoreCategory(overallScore)
    };
  }

  /**
   * Get health score category
   * @param {number} score - Overall health score
   * @returns {Object} Score category
   */
  static getHealthScoreCategory(score) {
    if (score < 30) {
      return {
        category: 'Excellent',
        description: 'Outstanding health indicators',
        color: 'green',
        recommendations: ['Maintain current healthy lifestyle']
      };
    } else if (score < 50) {
      return {
        category: 'Good',
        description: 'Generally healthy with minor concerns',
        color: 'blue',
        recommendations: ['Continue regular health monitoring']
      };
    } else if (score < 70) {
      return {
        category: 'Fair',
        description: 'Some health factors need attention',
        color: 'yellow',
        recommendations: ['Consider lifestyle improvements', 'Consult healthcare provider']
      };
    } else {
      return {
        category: 'Poor',
        description: 'Multiple health concerns present',
        color: 'red',
        recommendations: ['Seek medical consultation', 'Implement comprehensive health plan']
      };
    }
  }

  /**
   * Generate statistical summary of health data
   * @param {Array} dataPoints - Array of health data points
   * @returns {Object} Statistical summary
   */
  static generateHealthStats(dataPoints) {
    if (!dataPoints || dataPoints.length === 0) {
      return null;
    }

    const stats = {};

    // Calculate statistics for numeric fields
    const numericFields = ['age', 'bmi', 'cholesterol', 'glucose', 'bloodPressure.systolic', 'bloodPressure.diastolic'];

    numericFields.forEach(field => {
      const values = this.extractValues(dataPoints, field);
      if (values.length > 0) {
        stats[field] = {
          count: values.length,
          average: this.roundTo(values.reduce((sum, val) => sum + val, 0) / values.length, 2),
          min: Math.min(...values),
          max: Math.max(...values),
          trend: this.calculateTrend(values)
        };
      }
    });

    return stats;
  }

  /**
   * Extract values from nested object path
   * @param {Array} dataPoints - Array of data objects
   * @param {string} path - Dot-separated path to value
   * @returns {Array} Extracted values
   */
  static extractValues(dataPoints, path) {
    const keys = path.split('.');
    return dataPoints
      .map(item => {
        let value = item;
        for (const key of keys) {
          value = value?.[key];
        }
        return typeof value === 'number' ? value : null;
      })
      .filter(val => val !== null);
  }

  /**
   * Calculate trend from array of values
   * @param {Array} values - Array of numeric values
   * @returns {string} Trend direction
   */
  static calculateTrend(values) {
    if (values.length < 2) return 'stable';

    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));

    const firstAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;

    const change = ((secondAvg - firstAvg) / firstAvg) * 100;

    if (change > 5) return 'increasing';
    if (change < -5) return 'decreasing';
    return 'stable';
  }

  /**
   * Round number to specified decimal places
   * @param {number} value - Value to round
   * @param {number} decimals - Decimal places
   * @returns {number} Rounded value
   */
  static roundTo(value, decimals = 2) {
    return Number(Math.round(value + 'e' + decimals) + 'e-' + decimals);
  }

  /**
   * Generate health insights from data
   * @param {Object} healthData - Health data
   * @returns {Array} Array of insights
   */
  static generateHealthInsights(healthData) {
    const insights = [];

    if (healthData.bmi) {
      if (healthData.bmi < 18.5) {
        insights.push('Consider consulting a nutritionist for healthy weight gain strategies');
      } else if (healthData.bmi > 25) {
        insights.push('Weight management through diet and exercise is recommended');
      }
    }

    if (healthData.bloodPressure) {
      const bp = healthData.bloodPressure;
      if (bp.systolic >= 140 || bp.diastolic >= 90) {
        insights.push('Blood pressure management is crucial - consider lifestyle modifications');
      }
    }

    if (healthData.cholesterol && healthData.cholesterol >= 240) {
      insights.push('High cholesterol detected - dietary changes and regular monitoring recommended');
    }

    if (healthData.glucose && healthData.glucose >= 126) {
      insights.push('Elevated glucose levels - diabetes management consultation recommended');
    }

    if (healthData.smoking === 'current') {
      insights.push('Smoking cessation programs can significantly improve health outcomes');
    }

    if (healthData.exercise === 'sedentary') {
      insights.push('Regular physical activity can improve overall health and reduce disease risk');
    }

    return insights;
  }
}

module.exports = MLHelpers;
