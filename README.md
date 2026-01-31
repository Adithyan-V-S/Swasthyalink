# Swasthyalink - Digital Healthcare Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![React](https://img.shields.io/badge/React-19.1.0-blue.svg)](https://reactjs.org/)
[![Firebase](https://img.shields.io/badge/Firebase-11.10.0-orange.svg)](https://firebase.google.com/)

> A comprehensive digital healthcare platform connecting patients, doctors, and family members through secure health record management and real-time communication.

## 🌟 Overview

Swasthyalink is a modern healthcare management system designed to digitize and streamline healthcare processes in India. The platform provides secure, accessible, and user-friendly interfaces for managing medical records, appointments, and family health information.(Serverless Architecture)

### Key Objectives
- **Digital Health Records**: Centralized, secure storage of medical information
- **Family Integration**: Controlled access for family members and emergency contacts
- **Healthcare Accessibility**: Easy-to-use interfaces for all user types
- **Security & Privacy**: HIPAA-compliant data handling and access controls
- **Government Alignment**: Supporting India's digital health initiatives

## 🚀 Features

### 👤 Patient Portal
- Personal health record management
- QR code-based quick access
- Family member access control
- Appointment scheduling
- Emergency contact management
- Real-time notifications

### 👨‍⚕️ Doctor Dashboard
- Patient record access and updates
- Appointment management
- Prescription and diagnosis tracking
- Secure patient communication
- Medical history analysis

### 👨‍👩‍👧‍👦 Family Access
- Controlled health record viewing
- Emergency access capabilities
- Notification system
- Secure family dashboard
- Permission-based information sharing

## 🏗️ Architecture

```
Swasthyalink/
├── frontend/              # React application
│   ├── src/
│   │   ├── components/    # Reusable UI components
│   │   ├── pages/         # Application pages
│   │   ├── assets/        # Static assets
│   │   └── firebaseConfig.js
│   ├── public/            # Public assets
│   └── package.json
├── docs/                  # Documentation (future)
├── tests/                 # Test suites (future)
└── README.md
```

## 🛠️ Technology Stack

### Frontend
- **React 19.1.0** - Modern UI library
- **Vite 7.0.4** - Fast build tool and dev server
- **Tailwind CSS 3.4.17** - Utility-first CSS framework
- **React Router DOM** - Client-side routing
- **Material Icons** - Icon library

### Backend & Services
- **Firebase Authentication** - User authentication
- **Firebase Firestore** - NoSQL database
- **Firebase Hosting** - Web hosting (deployment)

### Development Tools
- **ESLint** - Code linting and formatting
- **PostCSS** - CSS processing
- **Autoprefixer** - CSS vendor prefixing

## 🚀 Quick Start

### Prerequisites
- Node.js (v18.0 or higher)
- npm or yarn package manager
- Firebase account

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd Swasthyalink
   ```

2. **Install dependencies**
   ```bash
   cd frontend
   npm install
   ```

3. **Configure Firebase**
   - Create a Firebase project
   - Enable Authentication and Firestore
   - Update `frontend/src/firebaseConfig.js` with your credentials

4. **Start development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   Navigate to `http://localhost:5173`

## 📚 Documentation

- [Frontend Documentation](./frontend/README.md) - Detailed frontend setup and development guide
- [Family Module Guide](./frontend/FAMILY_MODULE_README.md) - Comprehensive family feature documentation
- [API Documentation](./docs/api.md) - API endpoints and usage (coming soon)
- [Deployment Guide](./docs/deployment.md) - Production deployment instructions (coming soon)

## 🔐 Security & Compliance

- **Data Encryption**: All data transmitted and stored securely
- **Access Controls**: Role-based permissions and access levels
- **Audit Trails**: Comprehensive logging of all access and modifications
- **Privacy Protection**: HIPAA-compliant data handling practices
- **Emergency Access**: Secure emergency access protocols

## 🌐 Government Health Policy Alignment

Swasthyalink supports key Indian government health initiatives:
- **Ayushman Bharat** - Digital health infrastructure
- **National Digital Health Mission** - Health ID integration
- **Pradhan Mantri Jan Arogya Yojana** - Healthcare accessibility
- **Digital India** - Technology-driven healthcare solutions

## 🤝 Contributing

We welcome contributions from the community! Please read our [Contributing Guidelines](CONTRIBUTING.md) for details on:
- Code of conduct
- Development process
- Pull request procedures
- Issue reporting

### Development Workflow
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests (when available)
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📞 Support & Contact

- **Email**: support@swasthyalink.com
- **Documentation**: Comprehensive guides in `/docs`
- **Issues**: GitHub Issues for bug reports and feature requests
- **Community**: Join our community discussions

## 🙏 Acknowledgments

- **Healthcare Professionals** - For valuable feedback and requirements
- **Open Source Community** - For the amazing tools and libraries
- **Government of India** - For digital health policy guidance
- **Contributors** - Everyone who has contributed to this project

---

**Made with ❤️ for better healthcare in India**
