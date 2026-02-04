# Swasthyalink Object Diagram

This document contains an object diagram showing a concrete scenario of instances and their relationships in the Swasthyalink healthcare platform.

## Scenario: Dr. Sarah Connects with Patient John and Prescribes Medication

This object diagram illustrates a real-world scenario where:
1. Dr. Sarah Johnson (Cardiologist) sends a connection request to Patient John Smith
2. John accepts the connection via OTP verification
3. A patient-doctor relationship is established
4. Dr. Sarah creates a prescription for John
5. John's wife (Mary Smith) has family access to view the prescription

## Object Diagram

```mermaid
classDiagram
    class drSarah ["doctor1: Doctor"] {
        id: "doc-001"
        name: "Dr. Sarah Johnson"
        email: "sarah.johnson@hospital.com"
        specialization: "Cardiology"
        license: "MED-2024-001"
        status: "active"
    }

    class patientJohn ["patient1: Patient"] {
        id: "pat-001"
        name: "John Smith"
        email: "john.smith@email.com"
        phone: "+91-9876543210"
        age: 45
        gender: "Male"
        bloodType: "O+"
        allergies: ["Penicillin"]
    }

    class connectionReq ["request1: ConnectionRequest"] {
        id: "req-001"
        doctorId: "doc-001"
        patientId: "pat-001"
        patientEmail: "john.smith@email.com"
        connectionMethod: "email"
        status: "accepted"
        otpId: "otp-001"
        createdAt: "2026-02-01T10:00:00Z"
    }

    class otpService ["otp1: OTPService"] {
        otpId: "otp-001"
        recipient: "john.smith@email.com"
        otp: "123456"
        type: "prescription_connection"
        expiresAt: "2026-02-01T10:10:00Z"
        verified: true
    }

    class relationship ["rel1: PatientDoctorRelationship"] {
        id: "rel-001"
        patientId: "pat-001"
        doctorId: "doc-001"
        status: "active"
        permissions: {
            viewMedicalHistory: true,
            prescribeMedications: true,
            scheduleAppointments: true,
            accessEmergencyInfo: false
        }
        connectionDate: "2026-02-01T10:05:00Z"
    }

    class prescription ["rx1: Prescription"] {
        id: "rx-001"
        doctorId: "doc-001"
        patientId: "pat-001"
        diagnosis: "Hypertension"
        status: "sent"
        priority: "normal"
        validUntil: "2026-03-01T00:00:00Z"
        createdAt: "2026-02-02T14:30:00Z"
    }

    class med1 ["medication1: Medication"] {
        name: "Amlodipine"
        dosage: "5mg"
        frequency: "Once daily"
        duration: "30 days"
        instructions: "Take in the morning"
    }

    class med2 ["medication2: Medication"] {
        name: "Aspirin"
        dosage: "75mg"
        frequency: "Once daily"
        duration: "30 days"
        instructions: "Take after breakfast"
    }

    class familyNetwork ["network1: FamilyNetwork"] {
        userId: "pat-001"
        createdAt: "2026-01-15T08:00:00Z"
    }

    class familyMember ["member1: FamilyMember"] {
        id: "fam-001"
        name: "Mary Smith"
        email: "mary.smith@email.com"
        relationship: "Spouse"
        accessLevel: "full"
        isEmergencyContact: true
        permissions: {
            prescriptions: true,
            records: true,
            emergency: true
        }
    }

    class notification1 ["notif1: Notification"] {
        id: "notif-001"
        recipientId: "pat-001"
        senderId: "doc-001"
        type: "prescription"
        title: "New Prescription"
        message: "You have received a new prescription"
        priority: "normal"
        read: false
    }

    class adminUser ["admin1: Admin"] {
        id: "admin-001"
        name: "System Admin"
        email: "admin@swasthyalink.com"
        role: "admin"
    }

    class doctorReg ["registration1: DoctorRegistration"] {
        id: "reg-001"
        name: "Dr. Sarah Johnson"
        email: "sarah.johnson@hospital.com"
        specialization: "Cardiology"
        license: "MED-2024-001"
        status: "approved"
        approvedBy: "admin-001"
    }

    %% Relationships between objects
    drSarah --> connectionReq : creates
    patientJohn --> connectionReq : receives
    connectionReq --> otpService : uses
    connectionReq --> relationship : creates upon acceptance
    
    drSarah --> relationship : has
    patientJohn --> relationship : has
    
    drSarah --> prescription : creates
    patientJohn --> prescription : receives
    prescription --> med1 : contains
    prescription --> med2 : contains
    
    patientJohn --> familyNetwork : owns
    familyNetwork --> familyMember : contains
    familyMember -.-> prescription : can view
    
    prescription --> notification1 : triggers
    
    adminUser --> doctorReg : approved
    doctorReg --> drSarah : resulted in
```

## Scenario Walkthrough

### Step 1: Doctor Registration (Background)
- **Admin** (`admin1`) approved **DoctorRegistration** (`registration1`)
- This created the **Doctor** account (`drSarah`)

### Step 2: Connection Request
- **Doctor** (`drSarah`) creates **ConnectionRequest** (`request1`) for **Patient** (`patientJohn`)
- Connection method is "email"
- **OTPService** (`otp1`) sends OTP "123456" to john.smith@email.com

### Step 3: OTP Verification & Acceptance
- **Patient** (`patientJohn`) receives OTP and verifies it
- **ConnectionRequest** status changes to "accepted"
- **PatientDoctorRelationship** (`rel1`) is created with default permissions

### Step 4: Prescription Creation
- **Doctor** (`drSarah`) creates **Prescription** (`rx1`) for hypertension
- **Prescription** contains two **Medication** objects:
  - `medication1`: Amlodipine 5mg
  - `medication2`: Aspirin 75mg
- **Prescription** status is "sent"

### Step 5: Notification
- **Notification** (`notif1`) is triggered and sent to **Patient** (`patientJohn`)
- Patient receives notification about new prescription

### Step 6: Family Access
- **Patient** (`patientJohn`) has a **FamilyNetwork** (`network1`)
- **FamilyMember** (`member1` - Mary Smith, spouse) has full access
- Mary can view the **Prescription** (`rx1`) due to her permissions

## Key Object Interactions

### Doctor-Patient Connection Flow
```
drSarah → connectionReq → otpService → (verification) → relationship
```

### Prescription Flow
```
drSarah → prescription → [med1, med2] → notification1 → patientJohn
```

### Family Access Flow
```
patientJohn → familyNetwork → familyMember → (can view) → prescription
```

## Instance Data Highlights

### Permissions in PatientDoctorRelationship
The relationship (`rel1`) has specific permissions:
- ✅ View Medical History
- ✅ Prescribe Medications
- ✅ Schedule Appointments
- ❌ Access Emergency Info (not granted)

### Family Member Access
Mary Smith (`member1`) has full access:
- ✅ View Prescriptions
- ✅ View Records
- ✅ Emergency Access
- Emergency Contact: Yes

### Prescription Details
- **Diagnosis**: Hypertension
- **Medications**: 2 (Amlodipine + Aspirin)
- **Duration**: 30 days
- **Priority**: Normal
- **Status**: Sent (patient notified)

---

**Document Version**: 1.0  
**Last Updated**: 2026-02-03  
**Maintained By**: Swasthyalink Development Team
