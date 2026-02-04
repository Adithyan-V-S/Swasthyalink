# Swasthyalink Class Diagram

This document contains the class diagram for the Swasthyalink healthcare platform, showing the core models, their attributes, methods, and relationships.

## Class Diagram

```mermaid
classDiagram
    %% Core User Classes
    class User {
        +String id
        +String email
        +String name
        +String role
        +String phone
        +String status
        +Date createdAt
        +Date updatedAt
        +authenticate()
        +updateProfile()
    }

    class Patient {
        +String id
        +String name
        +String email
        +String phone
        +Number age
        +String gender
        +String bloodType
        +String[] allergies
        +String medicalHistory
        +Object emergencyContact
        +Date createdAt
        +getHealthRecords()
        +grantFamilyAccess()
        +connectWithDoctor()
    }

    class Doctor {
        +String id
        +String registrationId
        +String name
        +String email
        +String specialization
        +String license
        +String experience
        +String description
        +String phone
        +String loginId
        +String password
        +String status
        +Date approvedAt
        +Date createdAt
        +submitRegistration()
        +authenticateDoctor()
        +updateProfile()
        +searchPatients()
        +createPrescription()
    }

    class Admin {
        +String id
        +String name
        +String email
        +String role
        +Date createdAt
        +approveDoctorRegistration()
        +rejectDoctorRegistration()
        +disableDoctor()
        +getAllDoctors()
        +getAllPatients()
        +getDoctorStatistics()
    }

    class FamilyMember {
        +String id
        +String name
        +String email
        +String relationship
        +String accessLevel
        +Boolean isEmergencyContact
        +Date connectedAt
        +Date lastAccess
        +Object permissions
        +viewHealthRecords()
        +updateAccessLevel()
    }

    %% Relationship Models
    class DoctorRegistration {
        +String id
        +String name
        +String email
        +String specialization
        +String license
        +String experience
        +String phone
        +String status
        +String approvedBy
        +Date createdAt
        +Date updatedAt
        +submit()
        +approve()
        +reject()
    }

    class ConnectionRequest {
        +String id
        +String doctorId
        +String patientId
        +String patientEmail
        +String patientPhone
        +String connectionMethod
        +String status
        +String requestMessage
        +String otpId
        +Date createdAt
        +Date expiresAt
        +create()
        +accept()
        +reject()
        +verifyOTP()
    }

    class PatientDoctorRelationship {
        +String id
        +String patientId
        +String doctorId
        +String status
        +Object permissions
        +Date connectionDate
        +Date lastInteraction
        +Date createdAt
        +updatePermissions()
        +terminate()
    }

    class Prescription {
        +String id
        +String doctorId
        +String patientId
        +Object[] medications
        +String diagnosis
        +String instructions
        +String notes
        +String status
        +String priority
        +Date validUntil
        +Date createdAt
        +create()
        +send()
        +updateStatus()
        +cancel()
    }

    class Medication {
        +String name
        +String dosage
        +String frequency
        +String duration
        +String instructions
    }

    class FamilyNetwork {
        +String userId
        +FamilyMember[] members
        +Date createdAt
        +addMember()
        +removeMember()
        +updateMemberAccess()
        +getActiveMembers()
    }

    class Notification {
        +String id
        +String recipientId
        +String senderId
        +String type
        +String title
        +String message
        +Object data
        +String priority
        +Boolean read
        +Date createdAt
        +markAsRead()
        +send()
    }

    %% Service Classes
    class OTPService {
        +String otpId
        +String recipient
        +String otp
        +String type
        +Date expiresAt
        +sendEmailOTP()
        +sendSMSOTP()
        +verifyOTP()
        +cleanupExpired()
    }

    class PatientDoctorService {
        +createConnectionRequest()
        +acceptConnectionRequest()
        +rejectConnectionRequest()
        +getDoctorPatients()
        +getPatientDoctors()
        +searchPatients()
        +updateRelationshipPermissions()
        +terminateRelationship()
    }

    %% Relationships
    User <|-- Patient : inherits
    User <|-- Doctor : inherits
    User <|-- Admin : inherits
    User <|-- FamilyMember : inherits

    Doctor "1" --> "0..*" DoctorRegistration : submits
    Admin "1" --> "0..*" DoctorRegistration : approves/rejects

    Doctor "1" --> "0..*" ConnectionRequest : creates
    Patient "1" --> "0..*" ConnectionRequest : receives
    ConnectionRequest "1" --> "0..1" OTPService : uses

    ConnectionRequest "1" --> "0..1" PatientDoctorRelationship : creates
    Patient "1" --> "0..*" PatientDoctorRelationship : has
    Doctor "1" --> "0..*" PatientDoctorRelationship : has

    Doctor "1" --> "0..*" Prescription : creates
    Patient "1" --> "0..*" Prescription : receives
    Prescription "1" --> "1..*" Medication : contains

    Patient "1" --> "1" FamilyNetwork : owns
    FamilyNetwork "1" --> "0..*" FamilyMember : contains

    Prescription "1" --> "0..*" Notification : triggers
    ConnectionRequest "1" --> "0..*" Notification : triggers

    PatientDoctorService ..> PatientDoctorRelationship : manages
    PatientDoctorService ..> ConnectionRequest : manages
    OTPService ..> ConnectionRequest : validates
```

## Key Relationships Explained

### Inheritance
- **User** is the base class for Patient, Doctor, Admin, and FamilyMember
- All user types share common attributes (id, email, name, role)

### Associations

#### Doctor Registration Flow
- **Doctor** submits **DoctorRegistration**
- **Admin** approves or rejects **DoctorRegistration**
- Upon approval, Doctor account is created in Users collection

#### Patient-Doctor Connection Flow
- **Doctor** creates **ConnectionRequest** for a **Patient**
- **ConnectionRequest** may use **OTPService** for verification
- Upon acceptance, **PatientDoctorRelationship** is established
- Both **Patient** and **Doctor** can have multiple relationships

#### Prescription Management
- **Doctor** creates **Prescription** for **Patient**
- **Prescription** contains one or more **Medication** objects
- **Prescription** triggers **Notification** to patient

#### Family Network
- **Patient** owns one **FamilyNetwork**
- **FamilyNetwork** contains multiple **FamilyMember** objects
- Each **FamilyMember** has specific access permissions

### Service Dependencies
- **PatientDoctorService** manages ConnectionRequest and PatientDoctorRelationship operations
- **OTPService** validates ConnectionRequest when email/SMS verification is required

## Permissions Model

### PatientDoctorRelationship Permissions
```javascript
{
  viewMedicalHistory: boolean,
  prescribeMedications: boolean,
  scheduleAppointments: boolean,
  accessEmergencyInfo: boolean
}
```

### FamilyMember Permissions
```javascript
{
  prescriptions: boolean,
  records: boolean,
  emergency: boolean
}
```

## Status Enumerations

### ConnectionRequest Status
- `pending` - Awaiting patient response
- `accepted` - Patient accepted, relationship created
- `rejected` - Patient rejected
- `expired` - Request expired (7 days)

### Prescription Status
- `pending` - Created but not sent
- `sent` - Sent to patient
- `received` - Patient acknowledged
- `filled` - Prescription fulfilled
- `cancelled` - Cancelled by doctor or patient

### Doctor Status
- `active` - Approved and active
- `suspended` - Temporarily suspended
- `disabled` - Permanently disabled

---

**Document Version**: 1.0  
**Last Updated**: 2026-02-03  
**Maintained By**: Swasthyalink Development Team
