export type UserRole = "patient" | "doctor" | "hospital" | "lab" | "admin";

export interface UserProfile {
  uid: string;
  email: string;
  passwordPlain?: string;
  role: UserRole;
  spitarId: string;
  firstName: string;
  lastName: string;
  phone?: string;
  city?: string;
  isVerified: boolean;
  isSuspended: boolean;
  createdAt: string;
  photoURL?: string;
}

export interface DoctorProfile extends UserProfile {
  role: "doctor";
  specialty: string;
  specialtyAr?: string;
  specialtyFr?: string;
  hospitalAffiliation?: string;
  licenseNumber?: string;
  bio?: string;
  consultationFee?: number;
  rating?: number;
}

export type ChronicCondition =
  | "cancer"
  | "pregnancy"
  | "diabetes"
  | "hypertension"
  | "asthma"
  | "heart_disease"
  | "kidney_disease"
  | "liver_disease"
  | "epilepsy"
  | "thyroid"
  | "hiv"
  | "tuberculosis"
  | "mental_health";

export interface PatientProfile extends UserProfile {
  role: "patient";
  dateOfBirth?: string;
  bloodType?: string;
  gender?: string;
  address?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  universalDoctorAccess: boolean;
  hospitalOpenAccess: boolean;
  chronicConditions?: ChronicCondition[];
}

export interface HospitalProfile extends UserProfile {
  role: "hospital";
  name: string;
  address: string;
  type?: string;
  beds?: number;
}

export interface LabProfile extends UserProfile {
  role: "lab";
  name: string;
  address: string;
  licenseNumber?: string;
  openingHours?: string;
}

export interface MedicalRecord {
  id: string;
  patientId: string;
  doctorId: string;
  doctorName: string;
  type: "consultation" | "prescription" | "surgery" | "diagnosis" | "imaging" | "other";
  title: string;
  description: string;
  date: string;
  createdAt: string;
  updatedAt?: string;
}

export interface LabResult {
  id: string;
  patientId: string;
  labId: string;
  labName: string;
  testName: string;
  result: string;
  referenceRange?: string;
  status: "normal" | "abnormal" | "critical" | "pending";
  date: string;
  createdAt: string;
}

export interface Appointment {
  id: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  date: string;
  time: string;
  status: "pending" | "confirmed" | "cancelled" | "completed" | "reschedule_requested";
  reason?: string;
  notes?: string;
  cancelReason?: string;
  rescheduleDate?: string;
  rescheduleTime?: string;
  createdAt: string;
}

export interface AccessPermission {
  id: string;
  patientId: string;
  granteeId: string;
  granteeRole: "doctor" | "hospital";
  granteeName: string;
  grantedAt: string;
  revokedAt?: string;
  isActive: boolean;
}

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  data?: Record<string, unknown>;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  receiverId: string;
  senderName: string;
  content: string;
  createdAt: string;
  isRead: boolean;
}

export interface DoctorAvailability {
  id: string;
  doctorId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  slotDurationMinutes: number;
}
