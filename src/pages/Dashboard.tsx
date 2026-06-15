import { useAuth } from "@/contexts/AuthContext";
import PatientDashboard from "./dashboards/PatientDashboard";
import DoctorDashboard from "./dashboards/DoctorDashboard";
import AdminDashboard from "./dashboards/AdminDashboard";
import HospitalDashboard from "./dashboards/HospitalDashboard";
import LabDashboard from "./dashboards/LabDashboard";

export default function Dashboard() {
  const { user } = useAuth();

  if (!user) return null;

  switch (user.role) {
    case "patient": return <PatientDashboard />;
    case "doctor": return <DoctorDashboard />;
    case "admin": return <AdminDashboard />;
    case "hospital": return <HospitalDashboard />;
    case "lab": return <LabDashboard />;
    default: return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Unknown role: {user.role}</p>
      </div>
    );
  }
}
