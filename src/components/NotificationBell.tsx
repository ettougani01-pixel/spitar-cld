import { useState, useEffect, useRef } from "react";
import { Bell, CheckCheck, ShieldCheck, CalendarDays, X, AlertTriangle } from "lucide-react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";

interface DerivedNotif {
  id: string;
  type: string;
  title: string;
  body: string;
  createdAt: string;
}

function TypeIcon({ type }: { type: string }) {
  const s = { flexShrink: 0 as const };
  if (type === "lab_critical")
    return <AlertTriangle size={16} style={{ ...s, color: "#dc2626" }} />;
  if (type === "access_request" || type === "access_approved" || type === "access_rejected")
    return <ShieldCheck size={16} style={{ ...s, color: "#7c3aed" }} />;
  return <CalendarDays size={16} style={{ ...s, color: "#0d9488" }} />;
}

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60)    return "just now";
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function NotificationBell() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState<DerivedNotif[]>([]);
  const [seenIds, setSeenIds] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem("notif_seen_" + "") || "[]")); }
    catch { return new Set(); }
  });
  const panelRef = useRef<HTMLDivElement>(null);

  // Load seen IDs per user
  useEffect(() => {
    if (!user) return;
    try {
      const stored = JSON.parse(localStorage.getItem("notif_seen_" + user.uid) || "[]");
      setSeenIds(new Set(stored));
    } catch { setSeenIds(new Set()); }
  }, [user?.uid]);

  useEffect(() => {
    if (!user) return;
    const unsubs: (() => void)[] = [];
    const role = user.role;

    if (role === "doctor") {
      // Doctor: see new pending appointments from patients
      const apptQ = query(
        collection(db, "appointments"),
        where("doctorId", "==", user.uid),
        where("status", "==", "pending"),
      );
      unsubs.push(onSnapshot(apptQ, snap => {
        const items: DerivedNotif[] = snap.docs.map(d => {
          const data = d.data();
          return {
            id: "appt_" + d.id,
            type: "appointment_request",
            title: data.patientName || "Patient",
            body: `Appointment request: ${data.date} at ${data.time}`,
            createdAt: data.createdAt || new Date().toISOString(),
          };
        });
        setNotifs(prev => {
          const filtered = prev.filter(n => !n.id.startsWith("appt_pending_"));
          const newItems = items.map(i => ({ ...i, id: "appt_pending_" + i.id }));
          return [...newItems, ...filtered].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        });
      }));

      // Doctor: see when access requests are approved/rejected
      const reqQ = query(
        collection(db, "access_requests"),
        where("doctorId", "==", user.uid),
      );
      unsubs.push(onSnapshot(reqQ, snap => {
        const items: DerivedNotif[] = snap.docs
          .filter(d => d.data().status === "approved" || d.data().status === "rejected")
          .map(d => {
            const data = d.data();
            return {
              id: "req_" + d.id,
              type: data.status === "approved" ? "access_approved" : "access_rejected",
              title: "Access Request",
              body: data.status === "approved"
                ? "Patient approved your access request"
                : "Patient declined your access request",
              createdAt: data.updatedAt || data.createdAt || new Date().toISOString(),
            };
          });
        setNotifs(prev => {
          const filtered = prev.filter(n => !n.id.startsWith("req_"));
          return [...items, ...filtered].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        });
      }));
    }

    if (role === "patient") {
      // Patient: critical lab results
      const labQ = query(
        collection(db, "lab_results"),
        where("patientId", "==", user.uid),
        where("status", "==", "critical"),
      );
      unsubs.push(onSnapshot(labQ, snap => {
        const items: DerivedNotif[] = snap.docs.map(d => {
          const data = d.data();
          return {
            id: "lab_" + d.id,
            type: "lab_critical",
            title: "🚨 Critical Lab Result",
            body: `${data.testName}: ${data.result} — Contact your doctor immediately`,
            createdAt: data.createdAt || new Date().toISOString(),
          };
        });
        setNotifs(prev => {
          const filtered = prev.filter(n => !n.id.startsWith("lab_"));
          return [...items, ...filtered].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        });
      }));

      // Patient: see confirmed, cancelled, reschedule_requested appointments
      const apptQ = query(
        collection(db, "appointments"),
        where("patientId", "==", user.uid),
      );
      unsubs.push(onSnapshot(apptQ, snap => {
        const items: DerivedNotif[] = snap.docs
          .filter(d => ["confirmed", "cancelled", "reschedule_requested"].includes(d.data().status))
          .map(d => {
            const data = d.data();
            const bodyMap: Record<string, string> = {
              confirmed: `Dr. ${data.doctorName} confirmed your appointment on ${data.date}`,
              cancelled: `Dr. ${data.doctorName} cancelled your appointment on ${data.date}`,
              reschedule_requested: `Dr. ${data.doctorName} proposed a new time: ${data.rescheduleDate} at ${data.rescheduleTime}`,
            };
            return {
              id: "appt_" + d.id,
              type: "appointment_" + data.status,
              title: `Dr. ${data.doctorName}`,
              body: bodyMap[data.status] || data.status,
              createdAt: data.updatedAt || data.createdAt || new Date().toISOString(),
            };
          });
        setNotifs(prev => {
          const filtered = prev.filter(n => !n.id.startsWith("appt_"));
          return [...items, ...filtered].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        });
      }));

      // Patient: see pending access requests from doctors
      const reqQ = query(
        collection(db, "access_requests"),
        where("patientId", "==", user.uid),
        where("status", "==", "pending"),
      );
      unsubs.push(onSnapshot(reqQ, snap => {
        const items: DerivedNotif[] = snap.docs.map(d => {
          const data = d.data();
          return {
            id: "req_" + d.id,
            type: "access_request",
            title: data.doctorName || "Doctor",
            body: "is requesting access to your medical file",
            createdAt: data.createdAt || new Date().toISOString(),
          };
        });
        setNotifs(prev => {
          const filtered = prev.filter(n => !n.id.startsWith("req_"));
          return [...items, ...filtered].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        });
      }));
    }

    if (role === "admin") {
      // Admin: new access requests
      const reqQ = query(
        collection(db, "access_requests"),
        where("status", "==", "pending"),
      );
      unsubs.push(onSnapshot(reqQ, snap => {
        const items: DerivedNotif[] = snap.docs.map(d => {
          const data = d.data();
          return {
            id: "req_" + d.id,
            type: "access_request",
            title: data.doctorName || "Doctor",
            body: "requested access to a patient file",
            createdAt: data.createdAt || new Date().toISOString(),
          };
        });
        setNotifs(items.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      }));
    }

    return () => unsubs.forEach(u => u());
  }, [user]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const unread = notifs.filter(n => !seenIds.has(n.id)).length;

  const markAllRead = () => {
    if (!user) return;
    const newSeen = new Set([...seenIds, ...notifs.map(n => n.id)]);
    setSeenIds(newSeen);
    localStorage.setItem("notif_seen_" + user.uid, JSON.stringify([...newSeen]));
  };

  const handleOpen = () => {
    setOpen(o => !o);
  };

  return (
    <div style={{ position: "relative" }} ref={panelRef}>
      <button
        onClick={handleOpen}
        style={{
          width: 38, height: 38, borderRadius: "50%", border: "none",
          background: open ? "#f1f5f9" : "transparent",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", position: "relative", transition: "background 0.15s",
        }}
        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "#f1f5f9"}
        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = open ? "#f1f5f9" : "transparent"}
      >
        <Bell size={19} style={{ color: "#64748b" }} />
        {unread > 0 && (
          <span style={{
            position: "absolute", top: -1, right: -1,
            minWidth: 17, height: 17, borderRadius: 10,
            background: "#ef4444", color: "#fff",
            fontSize: 10, fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "0 4px",
          }}>
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: "absolute", right: 0, top: 46,
          width: 360, maxHeight: 480,
          background: "#fff", border: "1px solid #e2e8f0",
          borderRadius: 16, boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
          zIndex: 100, display: "flex", flexDirection: "column",
          overflow: "hidden",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: "1px solid #f1f5f9" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Bell size={15} style={{ color: "#7c3aed" }} />
              <span style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>Notifications</span>
              {unread > 0 && (
                <span style={{ fontSize: 11, fontWeight: 700, padding: "1px 8px", borderRadius: 20, background: "#ede9fe", color: "#7c3aed" }}>
                  {unread} new
                </span>
              )}
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              {unread > 0 && (
                <button onClick={markAllRead} title="Mark all read" style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#7c3aed", background: "none", border: "none", cursor: "pointer", padding: "4px 8px", borderRadius: 8 }}>
                  <CheckCheck size={13} /> All read
                </button>
              )}
              <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: 4, borderRadius: 8 }}>
                <X size={15} />
              </button>
            </div>
          </div>

          <div style={{ overflowY: "auto", flex: 1 }}>
            {notifs.length === 0 ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "40px 24px", gap: 10 }}>
                <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Bell size={22} style={{ color: "#94a3b8" }} />
                </div>
                <p style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", margin: 0 }}>All caught up</p>
                <p style={{ fontSize: 12, color: "#94a3b8", margin: 0 }}>No notifications yet</p>
              </div>
            ) : notifs.map(n => {
              const isUnread = !seenIds.has(n.id);
              return (
                <div
                  key={n.id}
                  style={{
                    display: "flex", gap: 12, padding: "12px 16px",
                    borderBottom: "1px solid #f8fafc",
                    background: isUnread ? "#faf7ff" : "#fff",
                    transition: "background 0.1s",
                  }}
                >
                  <div style={{ marginTop: 2 }}><TypeIcon type={n.type} /></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <p style={{ fontSize: 13, fontWeight: isUnread ? 700 : 500, color: "#0f172a", margin: 0, lineHeight: 1.3 }}>{n.title}</p>
                      <span style={{ fontSize: 10, color: "#94a3b8", whiteSpace: "nowrap", flexShrink: 0, marginTop: 2 }}>{timeAgo(n.createdAt)}</span>
                    </div>
                    <p style={{ fontSize: 12, color: "#64748b", margin: "3px 0 0", lineHeight: 1.4 }}>{n.body}</p>
                  </div>
                  {isUnread && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#7c3aed", marginTop: 6, flexShrink: 0 }} />}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
