import { useEffect } from "react";

interface Medication {
  name: string;
  dosage?: string;
  frequency?: string;
  reminderTimes?: string[]; // e.g. ["08:00", "14:00", "20:00"]
}

export function useMedicationReminders(medications: Medication[]) {
  useEffect(() => {
    if (!medications.length) return;
    if (!("Notification" in window)) return;

    const fire = () => {
      const now = new Date();
      const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      medications.forEach(med => {
        if (!med.reminderTimes?.length) return;
        if (med.reminderTimes.includes(hhmm)) {
          if (Notification.permission === "granted") {
            new Notification(`💊 Medication Reminder`, {
              body: `Time to take ${med.name}${med.dosage ? ` — ${med.dosage}` : ""}`,
              icon: "/favicon.ico",
            });
          }
        }
      });
    };

    const requestAndStart = async () => {
      if (Notification.permission === "default") {
        await Notification.requestPermission();
      }
      fire();
      const interval = setInterval(fire, 60_000);
      return interval;
    };

    let interval: ReturnType<typeof setInterval>;
    requestAndStart().then(id => { interval = id; });
    return () => clearInterval(interval);
  }, [medications]);
}
