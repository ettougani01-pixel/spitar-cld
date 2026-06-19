import { useEffect } from "react";

interface Appointment {
  id: string;
  doctorName?: string;
  patientName?: string;
  date: string;
  time: string;
  status: string;
}

export function useAppointmentReminders(appointments: Appointment[], role: "patient" | "doctor") {
  useEffect(() => {
    if (!appointments.length) return;
    if (!("Notification" in window)) return;

    const confirmed = appointments.filter(a => a.status === "confirmed");
    if (!confirmed.length) return;

    if (Notification.permission === "default") {
      Notification.requestPermission();
      return;
    }
    if (Notification.permission !== "granted") return;

    const timers: ReturnType<typeof setTimeout>[] = [];

    confirmed.forEach(appt => {
      const apptTime = new Date(`${appt.date}T${appt.time}`);
      if (isNaN(apptTime.getTime())) return;

      const now = Date.now();
      const [dayBefore, hourBefore] = [
        apptTime.getTime() - 24 * 60 * 60 * 1000,
        apptTime.getTime() - 60 * 60 * 1000,
      ];

      const who = role === "patient" ? `Dr. ${appt.doctorName}` : appt.patientName;

      [[dayBefore, "Tomorrow"], [hourBefore, "In 1 hour"]].forEach(([fireAt, when]) => {
        const delay = (fireAt as number) - now;
        if (delay <= 0 || delay > 48 * 60 * 60 * 1000) return;

        const t = setTimeout(() => {
          new Notification("SPITAR Appointment Reminder", {
            body: `${when}: ${appt.date} at ${appt.time} with ${who}`,
            icon: "/favicon.ico",
            tag: `appt-${appt.id}-${when}`,
          });
        }, delay);
        timers.push(t);
      });
    });

    return () => timers.forEach(clearTimeout);
  }, [appointments, role]);
}
