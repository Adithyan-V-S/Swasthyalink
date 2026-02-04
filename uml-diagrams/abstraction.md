# Swasthyalink System Abstraction

## Overview

Swasthyalink is a comprehensive digital healthcare platform that connects patients, doctors, family members, and administrators through secure health record management, prescription handling, and real-time communication. The system follows a multi-layered architecture with clear separation of concerns.

## System Architecture Layers

### 1. Presentation Layer (Frontend)
- **Technology**: React 19.1.0 with Vite
- **Styling**: Tailwind CSS
- **Routing**: React Router DOM
- **State Management**: React Hooks and Context API
- **Key Components**:
  - Patient Dashboard
  - Doctor Dashboard
  - Family Dashboard
  - Admin Panel
  - Authentication Pages (Login, Registration)

### 2. Application Layer (Backend API)
- **Technology**: Node.js with Express.js
- **Authentication**: Firebase Authentication
- **API Routes**:
  - `/api/admin` - Admin operations
  - `/api/doctor` - Doctor management
  - `/api/family` - Family network management
  - `/api/notifications` - Notification system
  - `/api/otp` - OTP verification
  - `/api/patientDoctor` - Patient-doctor relationships
  - `/api/prescriptions` - Prescription management
  - `/api/presence` - User presence tracking

### 3. Business Logic Layer (Models & Services)
- **Models**:
  - `DoctorModel` - Doctor registration, approval, and management
  - `PatientDoctorModel` - Patient-doctor connection requests and relationships
  - `PrescriptionModel` - Prescription creation and lifecycle management
  - `HealthRiskModel` - Health risk assessment
- **Services**:
  - `OTPService` - Email and SMS OTP handling
  - `PatientDoctorService` - Complex relationship operations
  - `ML Services` - Machine learning integrations

### 4. Data Layer
- **Primary Database**: Firebase Firestore (NoSQL)
- **Collections**:
  - `users` - All user accounts (patients, doctors, admins)
  - `doctor_registrations` - Doctor registration requests
  - `connection_requests` - Patient-doctor connection requests
  - `patient_doctor_relationships` - Active patient-doctor relationships
  - `prescriptions` - Medical prescriptions
  - `familyNetworks` - Family member connections
  - `notifications` - System notifications

### 5. External Services Layer
- **Firebase Authentication** - User identity management
- **Firebase Firestore** - NoSQL database
- **Firebase Cloud Functions** - Serverless functions
- **Dialogflow** - AI chatbot integration
- **Google Gemini** - AI-powered features
- **Email/SMS Services** - OTP and notification delivery

## Core Actors

### 1. Patient
- **Primary User**: Individual seeking healthcare services
- **Capabilities**:
  - Manage personal health records
  - Connect with doctors
  - Grant family member access
  - Receive and view prescriptions
  - Schedule appointments
  - Interact with AI chatbot

### 2. Doctor
- **Healthcare Provider**: Licensed medical professional
- **Capabilities**:
  - Request patient connections (via QR, email, OTP)
  - View patient medical history (with permissions)
  - Create and send prescriptions
  - Manage patient relationships
  - Update professional profile

### 3. Family Member
- **Authorized Relative**: Patient's family or emergency contact
- **Capabilities**:
  - View patient health records (permission-based)
  - Access emergency information
  - Receive health notifications
  - Limited or full access levels

### 4. Admin
- **System Administrator**: Platform manager
- **Capabilities**:
  - Approve/reject doctor registrations
  - Manage user accounts
  - Monitor system health
  - View statistics and analytics
  - Disable accounts

## Key Domain Concepts

### Connection Request Workflow
1. Doctor initiates connection request to patient
2. Request sent via QR code, email, or OTP
3. Patient receives notification
4. Patient accepts/rejects request
5. Upon acceptance, relationship is established with default permissions

### Prescription Lifecycle
1. **Pending** - Doctor creates prescription
2. **Sent** - Doctor sends to patient
3. **Received** - Patient acknowledges receipt
4. **Filled** - Prescription fulfilled
5. **Cancelled** - Either party cancels

### Family Network Access Levels
- **Limited Access**: View basic health records only
- **Full Access**: View prescriptions, records, and emergency info
- **Emergency Contact**: Special privileges during emergencies

### Permission Model
- **Role-Based Access Control (RBAC)**: Users have roles (patient, doctor, admin, family)
- **Relationship-Based Permissions**: Doctors have specific permissions per patient relationship
- **Granular Family Permissions**: Family members have customizable access levels

## Security & Privacy

### Authentication
- Firebase Authentication with email/password
- Session token management
- OTP verification for sensitive operations

### Authorization
- Role-based access control
- Relationship verification before data access
- Permission checks at API and database levels

### Data Protection
- Encrypted data transmission (HTTPS)
- Firestore security rules
- Audit trails for access and modifications
- HIPAA-compliant data handling practices

## Integration Points

### AI & ML Features
- **Dialogflow Chatbot**: Patient query handling
- **Gemini AI**: Advanced health insights
- **Health Risk Assessment**: ML-based risk prediction

### Communication Channels
- **Email**: OTP delivery, notifications
- **SMS**: OTP verification
- **In-app Notifications**: Real-time updates

## Scalability Considerations

- **Serverless Architecture**: Firebase Cloud Functions for auto-scaling
- **NoSQL Database**: Firestore for horizontal scaling
- **CDN Delivery**: Static assets via Firebase Hosting
- **Stateless API**: Express backend for easy replication

## Compliance & Standards

- **HIPAA Considerations**: Healthcare data privacy
- **Indian Digital Health Mission**: Alignment with government initiatives
- **Ayushman Bharat**: Digital health infrastructure support

---

**Document Version**: 1.0  
**Last Updated**: 2026-02-03  
**Maintained By**: Swasthyalink Development Team
