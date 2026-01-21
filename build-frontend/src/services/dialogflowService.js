import { v4 as uuidv4 } from 'uuid';

class DialogflowService {
  constructor() {
    this.apiUrl = 'https://us-central1-swasthyalink-42535.cloudfunctions.net/chatbot';
    this.useLocalFallback = true; // Set to true to use local fallback when backend is unavailable
  }

  // Local fallback responses for when the backend is unavailable
  getLocalResponse(message) {
    const lowerMessage = message.toLowerCase();

    // Simple keyword matching to simulate Dialogflow responses
    if (lowerMessage.includes('hello') || lowerMessage.includes('hi')) {
      return {
        success: true,
        response: "Hello! I'm your health assistant. How can I help you today?",
        intent: 'greeting',
        sessionId: 'local-session-id'
      };
    }

    if (lowerMessage.includes('help')) {
      return {
        success: true,
        response: "I can help you with health information, finding doctors, booking appointments, and answering medical questions. What would you like to know?",
        intent: 'help',
        sessionId: 'local-session-id'
      };
    }

    if (lowerMessage.includes('doctor')) {
      return {
        success: true,
        response: "You can find a list of doctors in the Doctors section of your dashboard or book an appointment directly from there.",
        intent: 'doctor_info',
        sessionId: 'local-session-id'
      };
    }

    if (lowerMessage.includes('appointment')) {
      return {
        success: true,
        response: "To book an appointment, go to your dashboard and click 'Book Appointment'. You can select a doctor, date, and time that works for you.",
        intent: 'appointment_info',
        sessionId: 'local-session-id'
      };
    }

    if (lowerMessage.includes('medicine') || lowerMessage.includes('prescription')) {
      return {
        success: true,
        response: "Always follow your doctor's prescription. If you have questions about your medication, consult your healthcare provider.",
        intent: 'medicine_info',
        sessionId: 'local-session-id'
      };
    }

    if (lowerMessage.includes('emergency')) {
      return {
        success: true,
        response: "If this is a medical emergency, please call your local emergency number immediately or go to the nearest emergency room.",
        intent: 'emergency_info',
        sessionId: 'local-session-id'
      };
    }

    if (lowerMessage.includes('family')) {
      return {
        success: true,
        response: "You can manage your family connections in the Family Dashboard. Add family members to share health information and enable emergency access.",
        intent: 'family_info',
        sessionId: 'local-session-id'
      };
    }

    if (lowerMessage.includes('bye') || lowerMessage.includes('goodbye')) {
      return {
        success: true,
        response: "Goodbye! Take care of your health. Feel free to come back if you have more questions.",
        intent: 'goodbye',
        sessionId: 'local-session-id'
      };
    }

    // Default response for health-related queries
    const healthTips = [
      "Remember to stay hydrated throughout the day!",
      "Regular exercise is important for maintaining good health.",
      "A balanced diet with plenty of fruits and vegetables is essential.",
      "Getting adequate sleep helps your body recover and function properly.",
      "Regular health checkups can help detect issues early.",
      "Managing stress is important for both mental and physical health.",
      "Washing your hands frequently helps prevent the spread of germs."
    ];

    return {
      success: true,
      response: healthTips[Math.floor(Math.random() * healthTips.length)],
      intent: 'default',
      sessionId: 'local-session-id'
    };
  }

  async detectIntent(message, sessionId = null) {
    if (!sessionId) {
      sessionId = uuidv4();
    }

    try {
      // Try to connect to the backend
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message, sessionId }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('DialogflowService detectIntent error:', error);

      // Use local fallback if enabled
      if (this.useLocalFallback) {
        console.log('Using local fallback response system');
        return this.getLocalResponse(message);
      }

      return {
        success: false,
        error: error.message || 'Failed to get response from Dialogflow'
      };
    }
  }
}

export default new DialogflowService();
