import { useState, useEffect, useRef, useCallback } from "react";
import { Bell, CheckCheck, Trash2, QrCode, ShieldCheck, FlaskConical, X, CalendarDays } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

interface Notification {
  id: number;
  type: string;
  title: string;
  body: string;
  read: boolean;
  data: Record<string, unknown> | null;
  createdAt: string;
}

function typeIcon(type: string) {
  if (type.startsWith("access")) return <ShieldCheck className="w-4 h-4 text-primary flex-shrink-0" />;
  if (type === "lab_result") return <FlaskConical className="w-4 h-4 text-secondary flex-shrink-0" />;
  if (type === "qr_access") return <QrCode className="w-4 h-4 text-primary flex-shrink-0" />;
  if (type === "appointment_confirmed")   return <CalendarDays className="w-4 h-4 text-green-600 flex-shrink-0" />;
  if (type === "appointment_cancelled")   return <CalendarDays className="w-4 h-4 text-red-500 flex-shrink-0" />;
  if (type === "appointment_rescheduled") return <CalendarDays className="w-4 h-4 text-blue-500 flex-shrink-0" />;
  if (type.startsWith("appointment"))     return <CalendarDays className="w-4 h-4 text-teal-500 flex-shrink-0" />;
  return <Bell className="w-4 h-4 text-muted-foreground flex-shrink-0" />;
}

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();
  const token = localStorage.getItem("spitar_token");
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ["notifications"],
    queryFn: async () => {
      const res = await fetch("/api/notifications", { headers });
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 60_000,
  });

  const unread = notifications.filter(n => !n.read).length;

  // SSE — real-time push
  useEffect(() => {
    if (!token) return;
    const es = new EventSource(`/api/notifications/stream?_t=${token}`, {});
    const handleMessage = (e: MessageEvent) => {
      try {
        const payload = JSON.parse(e.data);
        if (payload.event === "notification") {
          qc.setQueryData<Notification[]>(["notifications"], (prev = []) =>
            [payload.notification, ...prev]
          );
        }
      } catch { /* ignore */ }
    };
    es.addEventListener("message", handleMessage);
    return () => { es.removeEventListener("message", handleMessage); es.close(); };
  }, [token]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const markAllRead = useMutation({
    mutationFn: async () => {
      await fetch("/api/notifications/read-all", { method: "PATCH", headers });
    },
    onSuccess: () => qc.setQueryData<Notification[]>(["notifications"], prev =>
      (prev ?? []).map(n => ({ ...n, read: true }))
    ),
  });

  const markRead = useCallback(async (id: number) => {
    await fetch(`/api/notifications/${id}/read`, { method: "PATCH", headers });
    qc.setQueryData<Notification[]>(["notifications"], prev =>
      (prev ?? []).map(n => n.id === id ? { ...n, read: true } : n)
    );
  }, []);

  const deleteNotif = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`/api/notifications/${id}`, { method: "DELETE", headers });
    },
    onSuccess: (_: void, id: number) => qc.setQueryData<Notification[]>(["notifications"], prev =>
      (prev ?? []).filter(n => n.id !== id)
    ),
  });

  const handleOpen = () => {
    setOpen(o => !o);
  };

  const handleClickNotif = (n: Notification) => {
    if (!n.read) markRead(n.id);
  };

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        onClick={handleOpen}
        className="relative w-9 h-9 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
        aria-label="Notifications"
        data-testid="button-notifications"
      >
        <Bell className="w-5 h-5 text-muted-foreground" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -end-0.5 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1 animate-in zoom-in-50 duration-150">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute end-0 top-11 w-80 sm:w-96 bg-white border border-border rounded-xl shadow-xl z-50 flex flex-col max-h-[480px] animate-in slide-in-from-top-2 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold">Notifications</span>
              {unread > 0 && (
                <span className="text-xs bg-primary/10 text-primary font-semibold px-1.5 py-0.5 rounded-full">
                  {unread} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unread > 0 && (
                <button
                  onClick={() => markAllRead.mutate()}
                  className="text-xs text-primary hover:underline flex items-center gap-1 px-2 py-1 rounded hover:bg-primary/5 transition-colors"
                  title="Mark all as read"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  All read
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded hover:bg-muted text-muted-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="overflow-y-auto flex-1">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center px-6">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                  <Bell className="w-6 h-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground">All caught up</p>
                <p className="text-xs text-muted-foreground mt-1">No notifications yet</p>
              </div>
            ) : (
              notifications.map(n => (
                <div
                  key={n.id}
                  onClick={() => handleClickNotif(n)}
                  className={cn(
                    "flex gap-3 px-4 py-3 hover:bg-muted/50 cursor-pointer group border-b border-border/50 last:border-0 transition-colors",
                    !n.read && "bg-primary/5"
                  )}
                >
                  {/* Icon */}
                  <div className="mt-0.5">{typeIcon(n.type)}</div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={cn("text-sm leading-snug", !n.read ? "font-semibold text-foreground" : "font-medium text-foreground/80")}>
                        {n.title}
                      </p>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap flex-shrink-0 mt-0.5">
                        {timeAgo(n.createdAt)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{n.body}</p>
                  </div>

                  {/* Unread dot + delete */}
                  <div className="flex flex-col items-center gap-2 flex-shrink-0">
                    {!n.read && (
                      <div className="w-2 h-2 rounded-full bg-primary mt-1" />
                    )}
                    <button
                      onClick={e => { e.stopPropagation(); deleteNotif.mutate(n.id); }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-red-500"
                      title="Delete"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
