import { useState, useEffect, useRef } from "react";
import { Bell, CheckCheck, Trash2, ShieldCheck, FlaskConical, QrCode, CalendarDays, FileText, X } from "lucide-react";
import {
  collection, query, where, orderBy, onSnapshot,
  updateDoc, deleteDoc, doc, writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";

export interface Notif {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}

function TypeIcon({ type }: { type: string }) {
  const s = { flexShrink: 0 as const };
  if (type.startsWith("access")) return <ShieldCheck size={16} style={{ ...s, color: "#7c3aed" }} />;
  if (type === "new_record")      return <FileText size={16} style={{ ...s, color: "#2563eb" }} />;
  if (type === "lab_result")      return <FlaskConical size={16} style={{ ...s, color: "#0891b2" }} />;
  if (type === "qr_access")       return <QrCode size={16} style={{ ...s, color: "#7c3aed" }} />;
  if (type.startsWith("appt"))    return <CalendarDays size={16} style={{ ...s, color: "#0d9488" }} />;
  return <Bell size={16} style={{ ...s, color: "#64748b" }} />;
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
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);

  // Real-time listener on Firestore
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "notifications", user.uid, "items"),
      orderBy("createdAt", "desc"),
    );
    const unsub = onSnapshot(q, snap => {
      setNotifs(snap.docs.map(d => ({ id: d.id, ...d.data() } as Notif)));
    });
    return unsub;
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

  const unread = notifs.filter(n => !n.read).length;

  const markRead = async (n: Notif) => {
    if (n.read || !user) return;
    await updateDoc(doc(db, "notifications", user.uid, "items", n.id), { read: true });
  };

  const markAllRead = async () => {
    if (!user) return;
    const batch = writeBatch(db);
    notifs.filter(n => !n.read).forEach(n =>
      batch.update(doc(db, "notifications", user.uid, "items", n.id), { read: true })
    );
    await batch.commit();
  };

  const remove = async (id: string) => {
    if (!user) return;
    await deleteDoc(doc(db, "notifications", user.uid, "items", id));
  };

  return (
    <div style={{ position: "relative" }} ref={panelRef}>
      {/* Bell button */}
      <button
        onClick={() => setOpen(o => !o)}
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

      {/* Dropdown */}
      {open && (
        <div style={{
          position: "absolute", right: 0, top: 46,
          width: 360, maxHeight: 480,
          background: "#fff", border: "1px solid #e2e8f0",
          borderRadius: 16, boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
          zIndex: 100, display: "flex", flexDirection: "column",
          overflow: "hidden",
        }}>
          {/* Header */}
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

          {/* List */}
          <div style={{ overflowY: "auto", flex: 1 }}>
            {notifs.length === 0 ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "40px 24px", gap: 10 }}>
                <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Bell size={22} style={{ color: "#94a3b8" }} />
                </div>
                <p style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", margin: 0 }}>All caught up</p>
                <p style={{ fontSize: 12, color: "#94a3b8", margin: 0 }}>No notifications yet</p>
              </div>
            ) : notifs.map(n => (
              <div
                key={n.id}
                onClick={() => markRead(n)}
                style={{
                  display: "flex", gap: 12, padding: "12px 16px",
                  borderBottom: "1px solid #f8fafc", cursor: "pointer",
                  background: n.read ? "#fff" : "#faf7ff",
                  transition: "background 0.1s",
                }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = n.read ? "#f8fafc" : "#f3effe"}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = n.read ? "#fff" : "#faf7ff"}
              >
                <div style={{ marginTop: 2 }}><TypeIcon type={n.type} /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <p style={{ fontSize: 13, fontWeight: n.read ? 500 : 700, color: "#0f172a", margin: 0, lineHeight: 1.3 }}>{n.title}</p>
                    <span style={{ fontSize: 10, color: "#94a3b8", whiteSpace: "nowrap", flexShrink: 0, marginTop: 2 }}>{timeAgo(n.createdAt)}</span>
                  </div>
                  <p style={{ fontSize: 12, color: "#64748b", margin: "3px 0 0", lineHeight: 1.4 }}>{n.body}</p>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flexShrink: 0 }}>
                  {!n.read && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#7c3aed", marginTop: 4 }} />}
                  <button
                    onClick={e => { e.stopPropagation(); remove(n.id); }}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#cbd5e1", padding: 2, borderRadius: 6, lineHeight: 1 }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "#ef4444"}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "#cbd5e1"}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
