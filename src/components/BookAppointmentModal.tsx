import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Calendar, Clock, User, Phone, Mail, Lock,
  AlertTriangle, Loader2, CheckCircle2, ChevronLeft, ChevronRight,
  Building2, MapPin, Stethoscope,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

type Doctor = {
  userId: number;
  spitarId: string;
  firstName: string;
  lastName: string;
  specialty: string | null;
  hospital: string | null;
  city: string | null;
  phone: string | null;
};

type Slot = { time: string; available: boolean };

type Props = {
  doctor: Doctor;
  open: boolean;
  onClose: () => void;
  onSuccess: (result: { spitarId?: string; needsVerification?: boolean }) => void;
};

type Step = "slot" | "details" | "success";

const DAYS_AHEAD = 14;

function getAvailableDates(): Date[] {
  const dates: Date[] = [];
  const today = new Date();
  for (let i = 1; i <= DAYS_AHEAD; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    if (d.getDay() !== 0 && d.getDay() !== 5) dates.push(d); // Skip Friday & Sunday (Morocco weekend)
  }
  return dates;
}

export default function BookAppointmentModal({ doctor, open, onClose, onSuccess }: Props) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();

  const dates = getAvailableDates();
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [reason, setReason] = useState("");
  const [step, setStep] = useState<Step>("slot");
  const [dateOffset, setDateOffset] = useState(0);

  // Quick-register form
  const [qrForm, setQrForm] = useState({
    name: "", email: "", phone: "", password: "", confirmPassword: "",
    emergencyName: "", emergencyPhone: "",
  });
  const f = (k: keyof typeof qrForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setQrForm(p => ({ ...p, [k]: e.target.value }));

  const [bookedResult, setBookedResult] = useState<{ spitarId?: string; needsVerification?: boolean } | null>(null);

  const dateStr = selectedDate ? selectedDate.toISOString().split("T")[0] : "";

  const { data: slots, isLoading: slotsLoading } = useQuery<Slot[]>({
    queryKey: ["slots", doctor.userId, dateStr],
    queryFn: async () => {
      const res = await fetch(`/api/appointments/slots?doctorId=${doctor.userId}&date=${dateStr}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedDate,
  });

  const bookMut = useMutation({
    mutationFn: async () => {
      const token = localStorage.getItem("spitar_token");
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      let body: Record<string, unknown> = {
        doctorId: doctor.userId,
        scheduledDate: dateStr,
        scheduledTime: selectedTime,
        reason,
      };

      if (!user) {
        if (!qrForm.name || !qrForm.email || !qrForm.phone || !qrForm.password) throw new Error(t("booking.fill_all_fields"));
        if (qrForm.password !== qrForm.confirmPassword) throw new Error(t("booking.passwords_no_match"));
        if (!qrForm.emergencyName || !qrForm.emergencyPhone) throw new Error(t("booking.emergency_required"));
        body = {
          ...body,
          quickRegister: true,
          patientName: qrForm.name,
          patientEmail: qrForm.email,
          patientPhone: qrForm.phone,
          patientPassword: qrForm.password,
          emergencyContactName: qrForm.emergencyName,
          emergencyContactPhone: qrForm.emergencyPhone,
        };
      }

      const res = await fetch("/api/appointments", { method: "POST", headers, body: JSON.stringify(body) });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? t("common.error"));
      }
      return res.json();
    },
    onSuccess: (data) => {
      setBookedResult({ spitarId: data.spitarId, needsVerification: data.needsVerification });
      if (data.token) localStorage.setItem("spitar_token", data.token);
      setStep("success");
    },
    onError: (err: Error) => {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    },
  });

  const visibleDates = dates.slice(dateOffset, dateOffset + 7);

  const isRtl = i18n.language === "ar";
  const PrevIcon = isRtl ? ChevronRight : ChevronLeft;
  const NextIcon = isRtl ? ChevronLeft : ChevronRight;

  const canProceed = !!selectedDate && !!selectedTime;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            {t("booking.title")}
          </DialogTitle>
          <DialogDescription>
            <span className="font-medium text-foreground">Dr. {doctor.firstName} {doctor.lastName}</span>
            {doctor.specialty && <span className="text-muted-foreground"> · {doctor.specialty}</span>}
          </DialogDescription>
        </DialogHeader>

        {/* Doctor info strip */}
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          {doctor.specialty && (
            <span className="flex items-center gap-1"><Stethoscope className="w-3 h-3" />{doctor.specialty}</span>
          )}
          {doctor.hospital && (
            <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{doctor.hospital}</span>
          )}
          {doctor.city && (
            <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{doctor.city}</span>
          )}
        </div>

        {/* ── Step: Slot selection ─────────────────────────────────────────── */}
        {step === "slot" && (
          <div className="space-y-5">
            {/* Date picker strip */}
            <div>
              <p className="text-sm font-medium mb-2">{t("booking.select_date")}</p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setDateOffset(Math.max(0, dateOffset - 7))}
                  disabled={dateOffset === 0}
                  className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-30 transition-colors"
                >
                  <PrevIcon className="w-4 h-4" />
                </button>
                <div className="flex-1 flex gap-1 overflow-x-auto">
                  {visibleDates.map(d => {
                    const ds = d.toISOString().split("T")[0];
                    const isSelected = ds === dateStr;
                    const dayName = d.toLocaleDateString(i18n.language, { weekday: "short" });
                    const dayNum = d.getDate();
                    const month = d.toLocaleDateString(i18n.language, { month: "short" });
                    return (
                      <button
                        key={ds}
                        onClick={() => { setSelectedDate(d); setSelectedTime(""); }}
                        className={cn(
                          "flex flex-col items-center min-w-[44px] px-1.5 py-2 rounded-xl border text-xs transition-all",
                          isSelected
                            ? "bg-primary border-primary text-white"
                            : "border-border hover:border-primary/40 hover:bg-primary/5",
                        )}
                      >
                        <span className="font-medium capitalize">{dayName}</span>
                        <span className="text-base font-bold leading-tight">{dayNum}</span>
                        <span className="opacity-70 capitalize">{month}</span>
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => setDateOffset(Math.min(dates.length - 7, dateOffset + 7))}
                  disabled={dateOffset + 7 >= dates.length}
                  className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-30 transition-colors"
                >
                  <NextIcon className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Time slots */}
            {selectedDate && (
              <div>
                <p className="text-sm font-medium mb-2">{t("booking.select_time")}</p>
                {slotsLoading ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="grid grid-cols-4 gap-2">
                    {(slots ?? []).map(s => (
                      <button
                        key={s.time}
                        disabled={!s.available}
                        onClick={() => setSelectedTime(s.time)}
                        className={cn(
                          "py-2 px-1 rounded-lg text-xs font-medium border transition-all",
                          !s.available && "opacity-35 cursor-not-allowed bg-muted border-border line-through",
                          s.available && selectedTime === s.time && "bg-primary border-primary text-white",
                          s.available && selectedTime !== s.time && "border-border hover:border-primary/40 hover:bg-primary/5",
                        )}
                      >
                        <Clock className="w-3 h-3 mx-auto mb-0.5" />
                        {s.time}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Reason */}
            {selectedTime && (
              <div className="space-y-1.5">
                <Label>{t("booking.reason")} <span className="text-muted-foreground text-xs">({t("common.optional")})</span></Label>
                <Textarea
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder={t("booking.reason_placeholder")}
                  rows={2}
                />
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <Button variant="outline" onClick={onClose} className="flex-1">{t("common.cancel")}</Button>
              <Button
                className="flex-1"
                disabled={!canProceed}
                onClick={() => setStep("details")}
              >
                {t("booking.next")}
              </Button>
            </div>
          </div>
        )}

        {/* ── Step: Patient details ────────────────────────────────────────── */}
        {step === "details" && (
          <div className="space-y-4">
            {/* Booking summary */}
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 text-sm space-y-1">
              <div className="flex items-center gap-2 text-primary font-medium">
                <Calendar className="w-3.5 h-3.5" />
                {selectedDate?.toLocaleDateString(i18n.language, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
              </div>
              <div className="flex items-center gap-2 text-primary font-medium">
                <Clock className="w-3.5 h-3.5" />
                {selectedTime}
              </div>
            </div>

            {user ? (
              /* Registered user — just confirm */
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 border border-border">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-sm font-bold text-primary">{user.firstName?.[0]}</span>
                  </div>
                  <div>
                    <p className="font-medium text-sm">{user.firstName} {user.lastName}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </div>
                  <Badge variant="secondary" className="ms-auto text-xs">{user.spitarId}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{t("booking.confirm_as_registered")}</p>
              </div>
            ) : (
              /* Quick registration form */
              <div className="space-y-4">
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800 flex gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{t("booking.quick_reg_notice")}</span>
                </div>

                <div className="space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("booking.your_info")}</p>
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1.5"><User className="w-3.5 h-3.5" />{t("booking.full_name")}</Label>
                    <Input value={qrForm.name} onChange={f("name")} placeholder={t("booking.full_name_placeholder")} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" />{t("auth.email")}</Label>
                      <Input type="email" value={qrForm.email} onChange={f("email")} placeholder="you@email.com" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" />{t("auth.phone")}</Label>
                      <Input type="tel" value={qrForm.phone} onChange={f("phone")} placeholder="+212 6XX XXX XXX" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" />{t("auth.password")}</Label>
                      <Input type="password" value={qrForm.password} onChange={f("password")} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>{t("booking.confirm_password")}</Label>
                      <Input type="password" value={qrForm.confirmPassword} onChange={f("confirmPassword")} />
                    </div>
                  </div>
                </div>

                {/* Emergency contact */}
                <div className="space-y-3 bg-red-50 border border-red-100 rounded-xl p-3">
                  <p className="text-xs font-semibold text-red-800 uppercase tracking-wide flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {t("booking.emergency_contact")} <span className="text-red-600">*</span>
                  </p>
                  <p className="text-xs text-red-700">{t("booking.emergency_contact_desc")}</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-red-800">{t("booking.emergency_name")}</Label>
                      <Input value={qrForm.emergencyName} onChange={f("emergencyName")} placeholder={t("booking.emergency_name_placeholder")} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-red-800">{t("booking.emergency_phone")}</Label>
                      <Input type="tel" value={qrForm.emergencyPhone} onChange={f("emergencyPhone")} placeholder="+212 6XX XXX XXX" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("slot")} className="gap-1.5">
                <PrevIcon className="w-4 h-4" /> {t("common.back")}
              </Button>
              <Button className="flex-1 gap-1.5" onClick={() => bookMut.mutate()} disabled={bookMut.isPending}>
                {bookMut.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                {t("booking.confirm_booking")}
              </Button>
            </div>
          </div>
        )}

        {/* ── Step: Success ────────────────────────────────────────────────── */}
        {step === "success" && (
          <div className="text-center py-6 space-y-4">
            <div className="w-16 h-16 rounded-full bg-secondary/10 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 text-secondary" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-foreground mb-2">{t("booking.success_title")}</h3>
              <p className="text-muted-foreground text-sm">{t("booking.success_desc")}</p>
              {bookedResult?.spitarId && (
                <div className="mt-3 bg-primary/5 border border-primary/20 rounded-xl p-3 inline-block">
                  <p className="text-xs text-muted-foreground mb-1">{t("auth.spitar_id")}</p>
                  <p className="text-xl font-bold font-mono text-primary">{bookedResult.spitarId}</p>
                </div>
              )}
              {bookedResult?.needsVerification && (
                <p className="mt-3 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-2">
                  {t("booking.verify_email_notice")}
                </p>
              )}
            </div>
            <Button className="w-full" onClick={() => onSuccess({ spitarId: bookedResult?.spitarId, needsVerification: bookedResult?.needsVerification })}>
              {user ? t("booking.go_to_dashboard") : t("booking.go_to_verify")}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
