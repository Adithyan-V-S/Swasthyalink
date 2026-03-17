/**
 * Body Health Analysis Service
 * Sends pose metrics and a webcam frame to Gemini for structured health analysis.
 * Uses the existing Gemini Cloud Function endpoint.
 */

const GEMINI_ENDPOINT = 'https://us-central1-swasthyalink-42535.cloudfunctions.net/geminiChat';

/**
 * Compute biomechanical metrics from MoveNet keypoints
 * @param {Array} keypoints - MoveNet 17-keypoint array
 * @returns {Object} structured metrics
 */
export function computePostureMetrics(keypoints) {
    const kp = keypoints;
    const get = (i) => kp[i] && kp[i].score > 0.35 ? kp[i] : null;

    const nose = get(0);
    const leftShoulder = get(5);
    const rightShoulder = get(6);
    const leftHip = get(11);
    const rightHip = get(12);
    const leftKnee = get(13);
    const rightKnee = get(14);
    const leftAnkle = get(15);
    const rightAnkle = get(16);
    const leftEar = get(3);
    const rightEar = get(4);

    const metrics = {};

    // 1. Head Forward Posture — how far nose is ahead(left on screen = further in real world) of shoulders
    if (nose && leftShoulder && rightShoulder) {
        const shoulderMidX = (leftShoulder.x + rightShoulder.x) / 2;
        const shoulderMidY = (leftShoulder.y + rightShoulder.y) / 2;
        const headOffset = shoulderMidY - nose.y; // positive = head above shoulders (normal)
        const horizontalOffset = Math.abs(nose.x - shoulderMidX);
        const shoulderWidth = Math.abs(leftShoulder.x - rightShoulder.x) || 100;

        metrics.headForwardRatio = parseFloat((horizontalOffset / shoulderWidth).toFixed(2));
        metrics.headForwardPosture = metrics.headForwardRatio > 0.18 ? 'Detected' : 'Normal';
        metrics.headHeight = parseFloat(headOffset.toFixed(1));
    }

    // 2. Shoulder Imbalance
    if (leftShoulder && rightShoulder) {
        const diff = Math.abs(leftShoulder.y - rightShoulder.y);
        const shoulderWidth = Math.abs(leftShoulder.x - rightShoulder.x) || 100;
        metrics.shoulderImbalanceRatio = parseFloat((diff / shoulderWidth).toFixed(2));
        metrics.shoulderImbalance = metrics.shoulderImbalanceRatio > 0.12 ? 'Detected' : 'Normal';
        metrics.highShoulder = leftShoulder.y < rightShoulder.y ? 'Left Higher' : 'Right Higher';
    }

    // 3. Hip Tilt
    if (leftHip && rightHip) {
        const diff = Math.abs(leftHip.y - rightHip.y);
        const hipWidth = Math.abs(leftHip.x - rightHip.x) || 100;
        metrics.hipTiltRatio = parseFloat((diff / hipWidth).toFixed(2));
        metrics.hipTilt = metrics.hipTiltRatio > 0.10 ? 'Detected' : 'Normal';
        metrics.highHip = leftHip.y < rightHip.y ? 'Left Higher' : 'Right Higher';
    }

    // 4. Spinal Lateral Deviation — nose, shoulder mid, hip mid should be vertically aligned
    if (nose && leftShoulder && rightShoulder && leftHip && rightHip) {
        const shoulderMidX = (leftShoulder.x + rightShoulder.x) / 2;
        const hipMidX = (leftHip.x + rightHip.x) / 2;
        const deviation = Math.abs(nose.x - hipMidX);
        const shoulderWidth = Math.abs(leftShoulder.x - rightShoulder.x) || 100;
        metrics.spinalDeviationRatio = parseFloat((deviation / shoulderWidth).toFixed(2));
        metrics.spinalAlignment = metrics.spinalDeviationRatio > 0.20 ? 'Possible Deviation' : 'Normal';
        metrics.shoulderHipOffset = parseFloat((shoulderMidX - hipMidX).toFixed(1));
    }

    // 5. Knee Valgus / Varus
    if (leftKnee && leftHip && leftAnkle) {
        const kneeOffset = leftKnee.x - ((leftHip.x + leftAnkle.x) / 2);
        metrics.leftKneeAlignment = Math.abs(kneeOffset) > 20 ? (kneeOffset > 0 ? 'Valgus (Knock-knee)' : 'Varus (Bow-leg)') : 'Normal';
    }
    if (rightKnee && rightHip && rightAnkle) {
        const kneeOffset = rightKnee.x - ((rightHip.x + rightAnkle.x) / 2);
        metrics.rightKneeAlignment = Math.abs(kneeOffset) > 20 ? (kneeOffset > 0 ? 'Valgus (Knock-knee)' : 'Varus (Bow-leg)') : 'Normal';
    }

    // 6. Neck Tilt
    if (leftEar && rightEar) {
        const earDiff = Math.abs(leftEar.y - rightEar.y);
        const earWidth = Math.abs(leftEar.x - rightEar.x) || 50;
        metrics.neckTiltRatio = parseFloat((earDiff / earWidth).toFixed(2));
        metrics.neckTilt = metrics.neckTiltRatio > 0.15 ? 'Detected' : 'Normal';
    }

    // 7. Eye Aspect Ratio tracked over time (blink rate) - populated externally
    metrics.blinkRate = null; // Filled by the scanner component from blink tracking
    metrics.eyeRedness = null; // Filled from Gemini Vision

    return metrics;
}

/**
 * Analyse posture metrics and optionally a webcam image using Gemini
 * @param {Object} metrics - computed posture metrics
 * @param {string|null} imageBase64 - JPEG image in base64 for eye analysis (optional)
 * @returns {Promise<Object>} structured health report
 */
export async function analyseBodyHealth(metrics, imageBase64 = null) {
    const exerciseList = [
        'Neck Rotation', 'Neck Tilt', 'Neck Slide',
        'Shoulder Raise', 'Arm Stretch', 'Hand Stretching',
        'Squat', 'Lunge', 'Knee Bend', 'Push-up',
        'Eye Blinking Exercise', 'Eye Rolling Exercise', 'Eye Focus Exercise'
    ];

    const prompt = `
You are a senior physiotherapy AI clinical assistant integrated into the Swasthyalink digital healthcare platform.
A patient's live webcam pose has been analysed. Here are the detected biomechanical metrics:

${JSON.stringify(metrics, null, 2)}

Based ONLY on these clinical posture indicators, produce a structured health analysis in the following strict JSON format (no extra text, just the JSON object):

{
  "postureScore": <number 0-100, 100 being perfect posture>,
  "summary": "<2-3 sentence plain-language summary of overall findings>",
  "findings": [
    {
      "area": "<body area>",
      "status": "<Normal | Warning | Attention Required>",
      "detail": "<clinical observation>",
      "possibleConditions": ["<condition1>", "<condition2>"]
    }
  ],
  "eyeHealth": {
    "blinkRateStatus": "<Normal | Low | Very Low | Unable to Detect>",
    "blinkRateNote": "<clinical note>",
    "additionalFindings": "<any other eye observations from the image if provided, else 'No image provided'>",
    "recommendSeeDoctor": <true|false>
  },
  "recommendedExercises": [
    {
      "exercise": "<name from list: ${exerciseList.join(', ')}>",
      "reason": "<why this exercise is recommended based on the findings>"
    }
  ],
  "urgencyLevel": "<Routine | Monitor | See Doctor Soon | Emergency>",
  "disclaimer": "This is an AI clinical screening tool and not a medical diagnosis. Consult a qualified healthcare professional."
}

Available exercise options: ${exerciseList.join(', ')}

Important rules:
- Only recommend exercises from the list provided.
- Base ALL conditions on the metrics provided (do not hallucinate).
- Respond with ONLY valid JSON. No markdown, no code blocks.
`;

    try {
        const response = await fetch(GEMINI_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: prompt }),
        });

        if (!response.ok) {
            throw new Error(`Gemini API error: ${response.status}`);
        }

        const data = await response.json();
        const rawText = data.response || '';

        // Safely extract JSON from response
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('No valid JSON in Gemini response');

        return JSON.parse(jsonMatch[0]);
    } catch (err) {
        console.error('Body analysis service error:', err);
        // Return a graceful fallback
        return {
            postureScore: null,
            summary: 'Analysis could not be completed. Please try again.',
            findings: [],
            eyeHealth: { blinkRateStatus: 'Unable to Detect', blinkRateNote: '', additionalFindings: '', recommendSeeDoctor: false },
            recommendedExercises: [],
            urgencyLevel: 'Routine',
            disclaimer: 'This is an AI clinical screening tool and not a medical diagnosis.',
            error: err.message
        };
    }
}
