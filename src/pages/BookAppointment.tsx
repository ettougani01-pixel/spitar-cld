import { useState, useEffect } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  collection, query, where, getDocs, addDoc, doc, getDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Clock, CheckCircle2, Loader2, Stethoscope, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DoctorProfile, DoctorAvailability } from "@/lib/types";

const TIME_SLOTS = [
  "08:00", "08:30", "09:00", "09:30", "10:00", "10:30",
  "11:00", "11:30", "14:00", "14:30", "15:00", "15:30",
  "16:00", "16:30", "17:00", "17:30",
];

function getNext14Days(): string[] {
  const days: string[] = [];
  const today = new Date();
  for (let i = 1; i <= 14; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const dayOfWeek = d.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 5) { // skip Friday & Sunday (Morocco)
      days.push(d.toISOString().split("T")[0]);
    }
  }
  return days;
}

type Step = "pick" | "confirm" | "done";

export default function BookAppointment() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const doctorId = searchParams.get("doctorId");
  const [doctor, setDoctor] = useState<DoctorProfile | null>(null);
  const [loadingDoctor, setLoadingDoctor] = useState(true);

  const [step, setStep] = useState<Step>("pick");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [reason, setReason] = useState("");
  const [booking, setBooking] = useState(false);
  const [bookedId, setBookedId] = useState("");

  const availableDays = getNext14Days();

  useEffect(() => {
    if (!doctorId) { navigate("/"); return; }
    async function loadDoctor() {
      const docRef = doc(db, "users", doctorId!);
      const snap = await getDoc(docRef);
      if (snap.exists() && snap.data().role === "doctor") {
        setDoctor({ uid: snap.id, ...snap.data() } as DoctorProfile);
      }
      setLoadingDoctor(false);
    }
    loadDoctor();
  }, [doctorId, navigate]);

  const handleBook = async () => {
    if (!user || !doctor || !selectedDate || !selectedTime) return;
    setBooking(true);
    try {
      const ref = await addDoc(collection(db, "appointments"), {
        patientId: user.uid,
        patientName: `${user.firstName} ${user.lastName}`,
        doctorId: doctor.uid,
        doctorName: `${doctor.firstName} ${doctor.lastName}`,
        date: selectedDate,
        time: selectedTime,
        reason,
        status: "pending",
        createdAt: new Date().toISOString(),
      });
      setBookedId(ref.id);
      setStep("done");
    } finally {
      setBooking(false);
    }
  };

  const lang = i18n.language?.startsWith("ar") ? "ar" : i18n.language?.startsWith("fr") ? "fr" : "en";

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] gap-4">
          <p className="text-muted-foreground">Please log in to book an appointment.</p>
          <Link to="/login"><Button>Login</Button></Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">{t("booking.title")}</h1>
          {doctor && !loadingDoctor && (
            <div className="flex items-center gap-3 mt-3 p-3 rounded-xl bg-accent/30 border border-accent">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Stethoscope className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-sm">Dr. {doctor.firstName} {doctor.lastName}</p>
                <p className="text-xs text-muted-foreground">{doctor.specialty}</p>
                {doctor.city && <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><MapPin className="w-3 h-3" />{doctor.city}</p>}
              </div>
              {doctor.consultationFee && (
                <Badge variant="secondary" className="ms-auto shrink-0">
                  {doctor.consultationFee} MAD
                </Badge>
              )}
            </div>
          )}
        </div>

        {step === "done" ? (
          <Card>
            <CardContent className="p-8 text-center space-y-4">
              <CheckCircle2 className="w-14 h-14 text-green-500 mx-auto" />
              <div>
                <h2 className="text-xl font-bold text-green-700">{t("booking.success_title")}</h2>
                <p className="text-sm text-muted-foreground mt-1">{t("booking.success_desc")}</p>
              </div>
              <div className="rounded-lg bg-muted p-3 text-sm text-left space-y-1">
                <p><span className="text-muted-foreground">Doctor:</span> Dr. {doctor?.firstName} {doctor?.lastName}</p>
                <p><span className="text-muted-foreground">Date:</span> {selectedDate}</p>
                <p><span className="text-muted-foreground">Time:</span> {selectedTime}</p>
                <p><span className="text-muted-foreground">Status:</span> <Badge className="text-xs bg-amber-100 text-amber-700 border-amber-200">Pending Confirmation</Badge></p>
              </div>
              <Button className="w-full" onClick={() => navigate("/dashboard")}>
                {t("booking.go_to_dashboard")}
              </Button>
            </CardContent>
          </Card>
        ) : step === "confirm" ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("booking.confirm_booking")}</CardTitle>
              <CardDescription>{t("booking.confirm_as_registered")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg bg-muted p-3 space-y-1 text-sm">
                <p className="flex items-center gap-2"><CalendarDays className="w-3.5 h-3.5 text-muted-foreground" />{selectedDate}</p>
                <p className="flex items-center gap-2"><Clock className="w-3.5 h-3.5 text-muted-foreground" />{selectedTime}</p>
                {reason && <p className="text-muted-foreground text-xs mt-1">"{reason}"</p>}
              </div>
              <div className="space-y-2">
                <Label>{t("booking.reason")}</Label>
                <Textarea
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder={t("booking.reason_placeholder")}
                  rows={3}
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setStep("pick")}>
                  {t("common.back")}
                </Button>
                <Button className="flex-1" onClick={handleBook} disabled={booking}>
                  {booking && <Loader2 className="w-4 h-4 animate-spin me-2" />}
                  {t("common.confirm")}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {/* Date picker */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">{t("booking.select_date")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {availableDays.map(day => {
                    const d = new Date(day + "T12:00:00");
                    const isSelected = selectedDate === day;
                    return (
                      <button
                        key={day}
                        onClick={() => setSelectedDate(day)}
                        className={cn(
                          "rounded-lg border p-2 text-center transition-colors",
                          isSelected
                            ? "bg-primary text-primary-foreground border-primary"
                            : "hover:bg-muted border-border",
                        )}
                      >
                        <p className="text-xs text-opacity-70">
                          {d.toLocaleDateString(lang, { weekday: "short" })}
                        </p>
                        <p className="text-sm font-bold">{d.getDate()}</p>
                        <p className="text-xs text-opacity-70">
                          {d.toLocaleDateString(lang, { month: "short" })}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Time picker */}
            {selectedDate && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">{t("booking.select_time")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-4 gap-2">
                    {TIME_SLOTS.map(slot => {
                      const isSelected = selectedTime === slot;
                      return (
                        <button
                          key={slot}
                          onClick={() => setSelectedTime(slot)}
                          className={cn(
                            "rounded-lg border py-2 text-sm font-medium transition-colors",
                            isSelected
                              ? "bg-primary text-primary-foreground border-primary"
                              : "hover:bg-muted border-border",
                          )}
                        >
                          {slot}
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            <Button
              className="w-full"
              disabled={!selectedDate || !selectedTime}
              onClick={() => setStep("confirm")}
            >
              {t("common.next")} →
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
