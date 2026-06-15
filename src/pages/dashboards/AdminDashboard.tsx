import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  collection, query, getDocs, doc, updateDoc, deleteDoc,
  orderBy, limit, where, getCountFromServer, addDoc, serverTimestamp, setDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebase";
import {
  ShieldCheck, Users, Activity, BarChart3, Building2, Trash2, Ban,
  CheckCircle2, Search, UserCheck, UserX, RefreshCw, Eye, EyeOff, Plus,
  Hospital, FlaskConical, Stethoscope, User, Clock, TrendingUp,
  AlertCircle, XCircle, Mail,
} from "lucide-react";
import { cn, generateHospitalId, generateHospitalEmail, generatePassword } from "@/lib/utils";
import { createUserWithEmailAndPassword as createAccount } from "firebase/auth";
import type { UserProfile } from "@/lib/types";

type Tab = "overview" | "users" | "hospitals" | "analytics" | "audit";

interface AuditEntry {
  id: string;
  action: string;
  targetEmail?: string;
  adminEmail: string;
  timestamp: any;
}

interface HospitalDoc {
  id: string;
  spitarId: string;
  name: string;
  city: string;
  type: string;
  phone?: string;
  email: string;
  passwordPlain: string;
  uid?: string;
  status: "active" | "pending" | "suspended";
  createdAt: string;
}

function getStatusBadge(u: UserProfile) {
  if (u.isSuspended) return { label: "Suspended", bg: "#fee2e2", color: "#dc2626", dot: "#ef4444" };
  if (!u.isVerified) return { label: "Pending", bg: "#fef3c7", color: "#b45309", dot: "#f59e0b" };
  return { label: "Active", bg: "#dcfce7", color: "#15803d", dot: "#22c55e" };
}

function getRoleStyle(role: string) {
  const map: Record<string, { bg: string; color: string }> = {
    patient: { bg: "#dbeafe", color: "#1d4ed8" },
    doctor: { bg: "#dcfce7", color: "#15803d" },
    lab: { bg: "#ede9fe", color: "#6d28d9" },
    hospital: { bg: "#fef3c7", color: "#b45309" },
    admin: { bg: "#fee2e2", color: "#b91c1c" },
  };
  return map[role] ?? { bg: "#f1f5f9", color: "#374151" };
}

function formatDate(iso?: string) {
  if (!iso) return "—";
  try { return new Intl.DateTimeFormat("en", { day: "2-digit", month: "short", year: "2-digit" }).format(new Date(iso)); }
  catch { return iso; }
}

function getAuditColor(action: string) {
  if (action.includes("DELETE")) return "#dc2626";
  if (action.includes("SUSPEND")) return "#f59e0b";
  if (action.includes("VERIFY")) return "#16a34a";
  return "#6366f1";
}

const STAT_CARDS = (s: ReturnType<typeof buildStats>, t: (k: string) => string) => [
  { label: t("admin.total_users"), value: s.total, icon: Users, color: "#0057B8", bg: "#EFF6FF" },
  { label: t("admin.patients"), value: s.patients, icon: User, color: "#2563eb", bg: "#dbeafe" },
  { label: t("admin.doctors"), value: s.doctors, icon: Stethoscope, color: "#16a34a", bg: "#dcfce7" },
  { label: t("admin.labs"), value: s.labs, icon: FlaskConical, color: "#7c3aed", bg: "#ede9fe" },
];

function buildStats(users: UserProfile[], hospitals: number) {
  return {
    total: users.length,
    patients: users.filter(u => u.role === "patient").length,
    doctors: users.filter(u => u.role === "doctor").length,
    labs: users.filter(u => u.role === "lab").length,
    hospitals,
    verified: users.filter(u => u.isVerified).length,
    suspended: users.filter(u => u.isSuspended).length,
  };
}

export default function AdminDashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("users");
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [hospitals, setHospitals] = useState<HospitalDoc[]>([]);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [deleteTarget, setDeleteTarget] = useState<UserProfile | null>(null);
  const [viewTarget, setViewTarget] = useState<UserProfile | null>(null);
  const [resetSent, setResetSent] = useState(false);

  const sendReset = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
    setResetSent(true);
    setTimeout(() => setResetSent(false), 4000);
    await logAudit("SEND_RESET_PASSWORD", email);
  };
  const [addHospitalOpen, setAddHospitalOpen] = useState(false);
  const [hospitalForm, setHospitalForm] = useState({ name: "", city: "", type: "public", phone: "", email: "", password: "" });
  const [hospitalSearch, setHospitalSearch] = useState("");
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [creatingAccounts, setCreatingAccounts] = useState(false);

  const stats = buildStats(users, hospitals.length);

  const logAudit = useCallback(async (action: string, targetEmail?: string) => {
    if (!user) return;
    try { await addDoc(collection(db, "auditLogs"), { action, targetEmail, adminEmail: user.email, adminId: user.uid, timestamp: serverTimestamp() }); }
    catch {}
  }, [user]);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [snap, hSnap, aSnap] = await Promise.all([
        getDocs(query(collection(db, "users"), orderBy("createdAt", "desc"), limit(200))),
        getDocs(query(collection(db, "hospitals"), orderBy("createdAt", "desc"), limit(100))),
        getDocs(query(collection(db, "auditLogs"), orderBy("timestamp", "desc"), limit(50))),
      ]);
      setUsers(snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile)));
      setHospitals(hSnap.docs.map(d => ({ id: d.id, ...d.data() } as HospitalDoc)));
      setAuditLog(aSnap.docs.map(d => ({ id: d.id, ...d.data() } as AuditEntry)));
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  const toggleSuspend = async (u: UserProfile) => {
    const v = !u.isSuspended;
    await updateDoc(doc(db, "users", u.uid), { isSuspended: v });
    setUsers(p => p.map(x => x.uid === u.uid ? { ...x, isSuspended: v } : x));
    await logAudit(v ? "SUSPEND_USER" : "UNSUSPEND_USER", u.email);
  };

  const toggleVerify = async (u: UserProfile) => {
    const v = !u.isVerified;
    await updateDoc(doc(db, "users", u.uid), { isVerified: v });
    setUsers(p => p.map(x => x.uid === u.uid ? { ...x, isVerified: v } : x));
    await logAudit(v ? "VERIFY_USER" : "UNVERIFY_USER", u.email);
  };

  const deleteUser = async () => {
    if (!deleteTarget) return;
    await deleteDoc(doc(db, "users", deleteTarget.uid));
    setUsers(p => p.filter(x => x.uid !== deleteTarget.uid));
    await logAudit("DELETE_USER", deleteTarget.email);
    setDeleteTarget(null);
  };

  const addHospital = async () => {
    if (!hospitalForm.name || !hospitalForm.city) return;
    setSaving(true);
    try {
      const counter = hospitals.length + 1;
      const spitarId = generateHospitalId(counter);
      const email = hospitalForm.email || generateHospitalEmail(hospitalForm.name, hospitalForm.city);
      const password = hospitalForm.password || generatePassword();

      // Create Firebase Auth account
      let uid: string | undefined;
      try {
        const result = await createAccount(auth, email, password);
        uid = result.user.uid;
      } catch (e: any) {
        if (e.code !== "auth/email-already-in-use") throw e;
      }

      const ref = doc(collection(db, "hospitals"));
      const data: HospitalDoc = {
        id: ref.id, spitarId, name: hospitalForm.name, city: hospitalForm.city,
        type: hospitalForm.type, phone: hospitalForm.phone, email, passwordPlain: password,
        uid, status: "active", createdAt: new Date().toISOString(),
      };

      // Also create user doc for the hospital
      if (uid) {
        await setDoc(doc(db, "users", uid), {
          uid, email, passwordPlain: password, role: "hospital",
          spitarId, firstName: hospitalForm.name, lastName: "",
          isVerified: true, isSuspended: false, createdAt: new Date().toISOString(),
        });
      }

      await setDoc(ref, data);
      setHospitals(p => [data, ...p]);
      await logAudit("ADD_HOSPITAL", hospitalForm.name);
      setHospitalForm({ name: "", city: "", type: "public", phone: "", email: "", password: "" });
      setAddHospitalOpen(false);
    } catch (e: any) {
      alert("Error: " + e.message);
    }
    setSaving(false);
  };

  const toggleHospitalStatus = async (h: HospitalDoc) => {
    const newStatus = h.status === "active" ? "suspended" : "active";
    await updateDoc(doc(db, "hospitals", h.id), { status: newStatus });
    setHospitals(p => p.map(x => x.id === h.id ? { ...x, status: newStatus } : x));
    await logAudit(`HOSPITAL_${newStatus.toUpperCase()}`, h.name);
  };

  const filtered = users.filter(u => {
    const matchRole = roleFilter === "all" || u.role === roleFilter;
    const matchSearch = !searchQuery ||
      `${u.firstName} ${u.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.spitarId?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchRole && matchSearch;
  });

  const NAV = [
    { label: t("admin.overview"), icon: Activity, active: activeTab === "overview", onClick: () => setActiveTab("overview"), href: "#" },
    { label: t("admin.users"), icon: Users, active: activeTab === "users", onClick: () => setActiveTab("users"), href: "#" },
    { label: t("admin.hospitals"), icon: Building2, active: activeTab === "hospitals", onClick: () => setActiveTab("hospitals"), href: "#" },
    { label: t("admin.analytics"), icon: BarChart3, active: activeTab === "analytics", onClick: () => setActiveTab("analytics"), href: "#" },
    { label: t("admin.audit_log"), icon: Clock, active: activeTab === "audit", onClick: () => setActiveTab("audit"), href: "#" },
  ];

  return (
    <DashboardLayout navItems={NAV} title={t("admin.title")}>
      {/* Welcome header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h2 style={{ fontSize: 26, fontWeight: 800, margin: 0, color: "#0f172a" }}>
              {t("admin.welcome")}, {user?.firstName}!
            </h2>
            <p style={{ fontSize: 14, color: "#64748b", margin: "4px 0 0" }}>{t("admin.platform_admin")}</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 5, background: "#fee2e2", color: "#b91c1c", fontWeight: 700, fontSize: 13, padding: "5px 12px", borderRadius: 99 }}>
              <ShieldCheck size={14} /> Admin
            </span>
            <Button variant="outline" size="sm" onClick={loadData} className="gap-2">
              <RefreshCw size={13} /> {t("admin.refresh")}
            </Button>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 28 }}>
        {STAT_CARDS(stats, t).map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} style={{ background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 14, padding: "20px 18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 6px", fontWeight: 500 }}>{label}</p>
              <p style={{ fontSize: 32, fontWeight: 800, margin: 0, color: "#0f172a" }}>{loading ? "—" : value}</p>
            </div>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Icon size={22} color={color} />
            </div>
          </div>
        ))}
      </div>

      {loading ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200, gap: 12, color: "#64748b" }}>
          <RefreshCw size={20} className="animate-spin" /> Loading…
        </div>
      ) : (
        <>
          {/* OVERVIEW */}
          {activeTab === "overview" && (
            <div style={{ background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 14, overflow: "hidden" }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", gap: 8 }}>
                <Clock size={15} color="#64748b" />
                <span style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>{t("admin.recent_registrations")}</span>
              </div>
              {users.slice(0, 10).map((u, i) => {
                const status = getStatusBadge(u);
                return (
                  <div key={u.uid} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 20px", borderBottom: i < 9 ? "1px solid #f8fafc" : "none" }}>
                    <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: "#0057B8", flexShrink: 0 }}>
                      {u.firstName?.[0]}{u.lastName?.[0]}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>{u.firstName} {u.lastName}</p>
                      <p style={{ fontSize: 12, color: "#94a3b8", margin: 0 }}>{u.email}</p>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 99, background: getRoleStyle(u.role).bg, color: getRoleStyle(u.role).color }}>{u.role}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 99, background: status.bg, color: status.color, display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: status.dot, display: "inline-block" }} />{status.label}
                    </span>
                    <span style={{ fontSize: 11, color: "#cbd5e1" }}>{formatDate(u.createdAt)}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* USERS TABLE */}
          {activeTab === "users" && (
            <div style={{ background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 14, overflow: "hidden" }}>
              {/* Search + Filter */}
              <div style={{ padding: "16px 20px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
                  <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
                  <input
                    style={{ width: "100%", height: 38, paddingLeft: 32, paddingRight: 12, border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box", background: "#f8fafc" }}
                    placeholder={t("admin.search_users")}
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {["all", "patient", "doctor", "hospital", "lab"].map(r => (
                    <button
                      key={r}
                      onClick={() => setRoleFilter(r)}
                      style={{
                        padding: "6px 14px", borderRadius: 99, fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer",
                        background: roleFilter === r ? "#0057B8" : "#f1f5f9",
                        color: roleFilter === r ? "#fff" : "#64748b",
                        transition: "all 0.15s",
                      }}
                    >
                      {r === "all" ? t("common.all") : t(`admin.${r === "patient" ? "patients" : r === "doctor" ? "doctors" : r === "lab" ? "labs" : "hospitals"}`)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Table */}
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#f8fafc" }}>
                      {[t("admin.spitar_id"), t("admin.name"), t("admin.email"), t("admin.role"), t("admin.status"), t("admin.joined"), t("admin.actions")].map(col => (
                        <th key={col} style={{ padding: "10px 16px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "#64748b", borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap" }}>{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr><td colSpan={7} style={{ padding: 40, textAlign: "center", color: "#94a3b8", fontSize: 14 }}>No users found</td></tr>
                    ) : (
                      filtered.map(u => {
                        const status = getStatusBadge(u);
                        const role = getRoleStyle(u.role);
                        return (
                          <tr key={u.uid} style={{ borderBottom: "1px solid #f8fafc" }} className="hover:bg-slate-50/50">
                            {/* SPITAR ID */}
                            <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>
                              <span style={{ fontSize: 12, fontWeight: 700, fontFamily: "monospace", background: "#f1f5f9", padding: "3px 8px", borderRadius: 6, color: "#475569" }}>
                                {u.spitarId ?? "—"}
                              </span>
                            </td>
                            {/* Name */}
                            <td style={{ padding: "12px 16px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: "#0057B8", flexShrink: 0 }}>
                                  {u.firstName?.[0]}{u.lastName?.[0]}
                                </div>
                                <span style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", whiteSpace: "nowrap" }}>{u.firstName} {u.lastName}</span>
                              </div>
                            </td>
                            {/* Email */}
                            <td style={{ padding: "12px 16px" }}>
                              <span style={{ fontSize: 12, color: "#64748b" }}>{u.email}</span>
                            </td>
                            {/* Role */}
                            <td style={{ padding: "12px 16px" }}>
                              <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 99, background: role.bg, color: role.color }}>{u.role}</span>
                            </td>
                            {/* Status */}
                            <td style={{ padding: "12px 16px" }}>
                              <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 99, background: status.bg, color: status.color, display: "inline-flex", alignItems: "center", gap: 5 }}>
                                <span style={{ width: 6, height: 6, borderRadius: "50%", background: status.dot }} />
                                {status.label}
                              </span>
                            </td>
                            {/* Joined */}
                            <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>
                              <span style={{ fontSize: 12, color: "#94a3b8" }}>{formatDate(u.createdAt)}</span>
                            </td>
                            {/* Actions */}
                            <td style={{ padding: "12px 16px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                <ActionBtn title="View" onClick={() => setViewTarget(u)} color="#0057B8">
                                  <Eye size={13} />
                                </ActionBtn>
                                <ActionBtn title={u.isSuspended ? "Unsuspend" : "Suspend"} onClick={() => toggleSuspend(u)} color={u.isSuspended ? "#16a34a" : "#f59e0b"}>
                                  {u.isSuspended ? <CheckCircle2 size={13} /> : <Ban size={13} />}
                                </ActionBtn>
                                <ActionBtn title={u.isVerified ? "Unverify" : "Verify"} onClick={() => toggleVerify(u)} color={u.isVerified ? "#64748b" : "#2563eb"}>
                                  {u.isVerified ? <UserX size={13} /> : <UserCheck size={13} />}
                                </ActionBtn>
                                <ActionBtn title="Delete" onClick={() => setDeleteTarget(u)} color="#dc2626">
                                  <Trash2 size={13} />
                                </ActionBtn>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              <div style={{ padding: "10px 20px", borderTop: "1px solid #f1f5f9" }}>
                <span style={{ fontSize: 12, color: "#94a3b8" }}>{filtered.length} user{filtered.length !== 1 ? "s" : ""}</span>
              </div>
            </div>
          )}

          {/* HOSPITALS */}
          {activeTab === "hospitals" && (() => {
            const activeH = hospitals.filter(h => h.status === "active").length;
            const pendingH = hospitals.filter(h => h.status === "pending").length;
            const filteredH = hospitals.filter(h =>
              !hospitalSearch ||
              h.name.toLowerCase().includes(hospitalSearch.toLowerCase()) ||
              h.city?.toLowerCase().includes(hospitalSearch.toLowerCase()) ||
              h.type?.toLowerCase().includes(hospitalSearch.toLowerCase()) ||
              h.spitarId?.toLowerCase().includes(hospitalSearch.toLowerCase())
            );
            return (
              <div style={{ background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 14, overflow: "hidden" }}>
                {/* Header */}
                <div style={{ padding: "16px 20px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", gap: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#dcfce7", borderRadius: 10, padding: "8px 14px" }}>
                      <CheckCircle2 size={15} color="#16a34a" />
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#15803d" }}>Registered {activeH} / {hospitals.length}</span>
                    </div>
                    {pendingH > 0 && (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#fef3c7", borderRadius: 10, padding: "8px 14px" }}>
                        <AlertCircle size={15} color="#d97706" />
                        <span style={{ fontSize: 13, fontWeight: 700, color: "#b45309" }}>Pending {pendingH}</span>
                      </div>
                    )}
                  </div>
                  <div style={{ flex: 1 }} />
                  <Button size="sm" className="gap-2" onClick={() => setAddHospitalOpen(true)} style={{ background: "#0057B8" }}>
                    <Plus size={13} />Add Manual Hospital
                  </Button>
                </div>

                {/* Search */}
                <div style={{ padding: "12px 20px", borderBottom: "1px solid #f1f5f9" }}>
                  <div style={{ position: "relative" }}>
                    <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
                    <input
                      style={{ width: "100%", height: 38, paddingLeft: 32, paddingRight: 12, border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 13, outline: "none", background: "#f8fafc", boxSizing: "border-box" }}
                      placeholder="Search by name, city, type, or SPITAR ID..."
                      value={hospitalSearch}
                      onChange={e => setHospitalSearch(e.target.value)}
                    />
                  </div>
                </div>

                {/* Table */}
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "#f8fafc" }}>
                        {[t("admin.spitar_id"), t("admin.hospital"), t("admin.city"), t("admin.type"), t("admin.email"), t("admin.password"), t("admin.status"), t("admin.actions")].map(col => (
                          <th key={col} style={{ padding: "10px 14px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "#64748b", borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap" }}>{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredH.length === 0 ? (
                        <tr><td colSpan={8} style={{ padding: 48, textAlign: "center", color: "#94a3b8", fontSize: 14 }}>
                          No hospitals yet. Click "Add Manual Hospital" to get started.
                        </td></tr>
                      ) : (
                        filteredH.map(h => {
                          const isVisible = showPasswords[h.id];
                          const isSuspended = h.status === "suspended";
                          return (
                            <tr key={h.id} style={{ borderBottom: "1px solid #f8fafc" }}>
                              {/* SPITAR ID */}
                              <td style={{ padding: "12px 14px" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                                  <span style={{ fontSize: 11, fontWeight: 700, fontFamily: "monospace", background: "#fef3c7", color: "#b45309", padding: "2px 7px", borderRadius: 5 }}>{h.spitarId}</span>
                                  <button onClick={() => navigator.clipboard.writeText(h.spitarId)} style={{ border: "none", background: "none", cursor: "pointer", color: "#94a3b8", padding: 2 }} title="Copy">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                                  </button>
                                </div>
                              </td>
                              {/* Hospital name + phone */}
                              <td style={{ padding: "12px 14px" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                  <div style={{ width: 32, height: 32, borderRadius: 8, background: "#fef3c7", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                    <Hospital size={15} color="#d97706" />
                                  </div>
                                  <div>
                                    <p style={{ fontSize: 13, fontWeight: 700, margin: 0, color: "#0f172a", whiteSpace: "nowrap" }}>{h.name}</p>
                                    {h.phone && <p style={{ fontSize: 11, color: "#94a3b8", margin: 0 }}>{h.phone}</p>}
                                  </div>
                                </div>
                              </td>
                              {/* City */}
                              <td style={{ padding: "12px 14px" }}>
                                <span style={{ fontSize: 12, color: "#64748b", display: "flex", alignItems: "center", gap: 4 }}>
                                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><path d="M12 2a7 7 0 0 1 7 7c0 5.25-7 13-7 13S5 14.25 5 9a7 7 0 0 1 7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>
                                  {h.city}
                                </span>
                              </td>
                              {/* Type */}
                              <td style={{ padding: "12px 14px" }}>
                                <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 99, background: h.type === "public" ? "#dbeafe" : "#ede9fe", color: h.type === "public" ? "#1d4ed8" : "#6d28d9" }}>
                                  {h.type.charAt(0).toUpperCase() + h.type.slice(1)}
                                </span>
                              </td>
                              {/* Email */}
                              <td style={{ padding: "12px 14px" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                                  <span style={{ fontSize: 11, color: "#64748b", maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.email}</span>
                                  <button onClick={() => navigator.clipboard.writeText(h.email)} style={{ border: "none", background: "none", cursor: "pointer", color: "#94a3b8", padding: 2 }}>
                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                                  </button>
                                </div>
                              </td>
                              {/* Password */}
                              <td style={{ padding: "12px 14px" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                  <span style={{ fontSize: 12, fontFamily: "monospace", color: "#0f172a", letterSpacing: isVisible ? 0 : 2 }}>
                                    {isVisible ? h.passwordPlain : "••••••••"}
                                  </span>
                                  <button
                                    onClick={() => setShowPasswords(p => ({ ...p, [h.id]: !p[h.id] }))}
                                    style={{ border: "none", background: "none", cursor: "pointer", color: "#94a3b8", padding: 2 }}
                                    title={isVisible ? "Hide" : "Show"}
                                  >
                                    {isVisible
                                      ? <EyeOff size={13} />
                                      : <Eye size={13} />
                                    }
                                  </button>
                                  {isVisible && (
                                    <button onClick={() => navigator.clipboard.writeText(h.passwordPlain)} style={{ border: "none", background: "none", cursor: "pointer", color: "#94a3b8", padding: 2 }}>
                                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                                    </button>
                                  )}
                                </div>
                              </td>
                              {/* Status */}
                              <td style={{ padding: "12px 14px" }}>
                                <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 99, background: isSuspended ? "#fee2e2" : "#dcfce7", color: isSuspended ? "#dc2626" : "#15803d", display: "inline-flex", alignItems: "center", gap: 5 }}>
                                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: isSuspended ? "#ef4444" : "#22c55e" }} />
                                  {isSuspended ? "Suspended" : "Active"}
                                </span>
                              </td>
                              {/* Actions */}
                              <td style={{ padding: "12px 14px" }}>
                                <div style={{ display: "flex", gap: 4 }}>
                                  <ActionBtn title={isSuspended ? "Activate" : "Suspend"} onClick={() => toggleHospitalStatus(h)} color={isSuspended ? "#16a34a" : "#f59e0b"}>
                                    {isSuspended ? <CheckCircle2 size={13} /> : <Ban size={13} />}
                                  </ActionBtn>
                                  <ActionBtn title="Delete" onClick={async () => { await deleteDoc(doc(db, "hospitals", h.id)); setHospitals(p => p.filter(x => x.id !== h.id)); await logAudit("DELETE_HOSPITAL", h.name); }} color="#dc2626">
                                    <Trash2 size={13} />
                                  </ActionBtn>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
                <div style={{ padding: "10px 20px", borderTop: "1px solid #f1f5f9" }}>
                  <span style={{ fontSize: 12, color: "#94a3b8" }}>{filteredH.length} hospital{filteredH.length !== 1 ? "s" : ""}</span>
                </div>
              </div>
            );
          })()}

          {/* ANALYTICS */}
          {activeTab === "analytics" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px,1fr))", gap: 20 }}>
              <div style={{ background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 14, padding: 24 }}>
                <p style={{ fontSize: 14, fontWeight: 700, margin: "0 0 20px", color: "#0f172a", display: "flex", alignItems: "center", gap: 8 }}>
                  <TrendingUp size={15} color="#0057B8" />User Distribution
                </p>
                {[
                  { label: "Patients", value: stats.patients, color: "#2563eb" },
                  { label: "Doctors", value: stats.doctors, color: "#16a34a" },
                  { label: "Labs", value: stats.labs, color: "#7c3aed" },
                  { label: "Hospitals", value: stats.hospitals, color: "#d97706" },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ marginBottom: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontSize: 13, color: "#374151", fontWeight: 500 }}>{label}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color }}>{value} ({stats.total ? Math.round((value / stats.total) * 100) : 0}%)</span>
                    </div>
                    <div style={{ height: 8, background: "#f1f5f9", borderRadius: 99, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${stats.total ? (value / stats.total) * 100 : 0}%`, background: color, borderRadius: 99, transition: "width 0.6s" }} />
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 14, padding: 24 }}>
                <p style={{ fontSize: 14, fontWeight: 700, margin: "0 0 20px", color: "#0f172a" }}>Platform Summary</p>
                {[
                  { label: "Total Users", value: stats.total, color: "#0057B8" },
                  { label: "Verified", value: stats.verified, color: "#16a34a" },
                  { label: "Suspended", value: stats.suspended, color: "#dc2626" },
                  { label: "Hospitals", value: hospitals.length, color: "#d97706" },
                  { label: "Audit Entries", value: auditLog.length, color: "#7c3aed" },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #f8fafc" }}>
                    <span style={{ fontSize: 13, color: "#64748b" }}>{label}</span>
                    <span style={{ fontSize: 22, fontWeight: 800, color }}>{value}</span>
                  </div>
                ))}
              </div>

              <div style={{ background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 14, padding: 24, gridColumn: "1 / -1" }}>
                <p style={{ fontSize: 14, fontWeight: 700, margin: "0 0 20px", color: "#0f172a" }}>Verification Status</p>
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                  {[
                    { label: "Verified", value: stats.verified, color: "#16a34a", bg: "#dcfce7", icon: CheckCircle2 },
                    { label: "Pending", value: stats.total - stats.verified - stats.suspended, color: "#d97706", bg: "#fef3c7", icon: AlertCircle },
                    { label: "Suspended", value: stats.suspended, color: "#dc2626", bg: "#fee2e2", icon: XCircle },
                  ].map(({ label, value, color, bg, icon: Icon }) => (
                    <div key={label} style={{ flex: 1, minWidth: 120, background: bg, borderRadius: 12, padding: 20, textAlign: "center" }}>
                      <Icon size={30} color={color} style={{ margin: "0 auto 8px", display: "block" }} />
                      <p style={{ fontSize: 30, fontWeight: 800, color, margin: 0 }}>{value}</p>
                      <p style={{ fontSize: 12, color: "#64748b", margin: "4px 0 0", fontWeight: 600 }}>{label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* AUDIT LOG */}
          {activeTab === "audit" && (
            <div style={{ background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 14, overflow: "hidden" }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", gap: 8 }}>
                <Clock size={15} color="#64748b" />
                <span style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>Audit Log</span>
              </div>
              {auditLog.length === 0 ? (
                <div style={{ padding: 40, textAlign: "center", color: "#94a3b8", fontSize: 14 }}>No audit entries yet.</div>
              ) : (
                auditLog.map(entry => (
                  <div key={entry.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 20px", borderBottom: "1px solid #f8fafc" }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: getAuditColor(entry.action), flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>
                        <span style={{ color: getAuditColor(entry.action) }}>{entry.action}</span>
                        {entry.targetEmail && <span style={{ color: "#64748b", fontWeight: 400 }}> → {entry.targetEmail}</span>}
                      </p>
                      <p style={{ fontSize: 12, color: "#94a3b8", margin: 0 }}>by {entry.adminEmail}</p>
                    </div>
                    <span style={{ fontSize: 11, color: "#cbd5e1", whiteSpace: "nowrap" }}>
                      {entry.timestamp?.toDate ? formatDate(entry.timestamp.toDate().toISOString()) : "—"}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}

      {/* Delete Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.delete_user_title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("admin.delete_user_desc")} — <strong>{deleteTarget?.firstName} {deleteTarget?.lastName}</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("admin.cancel")}</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={deleteUser}>{t("admin.delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* View User Dialog */}
      <Dialog open={!!viewTarget} onOpenChange={() => { setViewTarget(null); setResetSent(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{t("admin.user_details")}</DialogTitle></DialogHeader>
          {viewTarget && (
            <div>
              {/* Avatar + name */}
              <div style={{ background: "linear-gradient(135deg,#EFF6FF,#f0fdf4)", borderRadius: 12, padding: 20, textAlign: "center", marginBottom: 16 }}>
                <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#0057B8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 800, color: "#fff", margin: "0 auto 12px" }}>
                  {viewTarget.firstName?.[0]}{viewTarget.lastName?.[0]}
                </div>
                <p style={{ fontWeight: 800, fontSize: 18, margin: "0 0 2px", color: "#0f172a" }}>{viewTarget.firstName} {viewTarget.lastName}</p>
                <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 10px" }}>{viewTarget.email}</p>
                <div style={{ display: "flex", justifyContent: "center", gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 99, background: getRoleStyle(viewTarget.role).bg, color: getRoleStyle(viewTarget.role).color }}>{viewTarget.role}</span>
                  {(() => { const s = getStatusBadge(viewTarget); return <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 99, background: s.bg, color: s.color }}>{s.label}</span>; })()}
                </div>
              </div>

              {/* Info rows */}
              <div style={{ background: "#f8fafc", borderRadius: 10, padding: "4px 12px", marginBottom: 16 }}>
                {[
                  { label: t("admin.spitar_id"), value: viewTarget.spitarId, mono: true },
                  { label: "UID", value: viewTarget.uid, mono: true },
                  { label: t("admin.role"), value: viewTarget.role },
                  { label: t("admin.verify"), value: viewTarget.isVerified ? "✅ " + t("common.yes") : "❌ " + t("common.no") },
                  { label: t("admin.suspend"), value: viewTarget.isSuspended ? "⛔ " + t("common.yes") : "✅ " + t("common.no") },
                  { label: t("admin.joined"), value: formatDate(viewTarget.createdAt) },
                ].map(({ label, value, mono }) => (
                  <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: "1px solid #e2e8f0" }}>
                    <span style={{ fontSize: 13, color: "#64748b" }}>{label}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#0f172a", fontFamily: mono ? "monospace" : undefined, wordBreak: "break-all", textAlign: "right", maxWidth: "55%" }}>{value ?? "—"}</span>
                  </div>
                ))}
                {/* Password row */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0" }}>
                  <span style={{ fontSize: 13, color: "#64748b" }}>{t("admin.password")}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "monospace", color: "#0057B8", background: "#EFF6FF", padding: "2px 8px", borderRadius: 6 }}>
                    {viewTarget.passwordPlain ?? "—"}
                  </span>
                </div>
              </div>

              {/* Reset Password */}
              <div style={{ background: resetSent ? "#dcfce7" : "#fef3c7", borderRadius: 10, padding: 14, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, margin: "0 0 2px", color: resetSent ? "#15803d" : "#b45309" }}>
                    {resetSent ? `✅ ${t("admin.reset_sent")}` : `🔑 ${t("admin.reset_password")}`}
                  </p>
                  <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>
                    {resetSent ? `${t("admin.reset_link_sent_to")} ${viewTarget.email}` : t("admin.send_reset_link")}
                  </p>
                </div>
                {!resetSent && (
                  <button
                    onClick={() => sendReset(viewTarget.email)}
                    style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", background: "#0057B8", color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}
                  >
                    <Mail size={13} /> {t("admin.send_link")}
                  </button>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setViewTarget(null); setResetSent(false); }}>{t("admin.close")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Hospital Dialog */}
      <Dialog open={addHospitalOpen} onOpenChange={setAddHospitalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{t("admin.add_hospital")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>{t("admin.hospital_name")} *</label>
                <Input value={hospitalForm.name} onChange={e => setHospitalForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. CHU Ibn Rochd" />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>{t("admin.city")} *</label>
                <Input value={hospitalForm.city} onChange={e => setHospitalForm(p => ({ ...p, city: e.target.value }))} placeholder="e.g. Casablanca" />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>{t("admin.phone")}</label>
                <Input value={hospitalForm.phone} onChange={e => setHospitalForm(p => ({ ...p, phone: e.target.value }))} placeholder="+212 5XX XXX XXX" />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>{t("admin.type")}</label>
                <select value={hospitalForm.type} onChange={e => setHospitalForm(p => ({ ...p, type: e.target.value }))} style={{ width: "100%", height: 38, padding: "0 12px", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 13, background: "#fff" }}>
                  <option value="public">{t("admin.public")}</option>
                  <option value="private">{t("admin.private")}</option>
                  <option value="clinic">{t("admin.clinic")}</option>
                </select>
              </div>
            </div>

            <div style={{ background: "#f8fafc", borderRadius: 10, padding: 12, borderLeft: "3px solid #0057B8" }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#0057B8", margin: "0 0 8px" }}>🔐 {t("admin.login_account")}</p>
              <div style={{ display: "grid", gap: 8 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>Email</label>
                  <Input value={hospitalForm.email} onChange={e => setHospitalForm(p => ({ ...p, email: e.target.value }))} placeholder="auto: name.city@spitar.ma" />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>Password</label>
                  <Input value={hospitalForm.password} onChange={e => setHospitalForm(p => ({ ...p, password: e.target.value }))} placeholder="auto-generated if empty" />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddHospitalOpen(false)}>{t("admin.cancel")}</Button>
            <Button onClick={addHospital} disabled={saving || !hospitalForm.name || !hospitalForm.city}>
              {saving ? t("admin.creating_account") : t("admin.add_hospital")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

function ActionBtn({ children, onClick, title, color }: { children: React.ReactNode; onClick: () => void; title: string; color: string }) {
  return (
    <button
      title={title}
      onClick={onClick}
      style={{ width: 30, height: 30, borderRadius: 7, border: "1.5px solid #e2e8f0", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color, transition: "all 0.15s" }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = color; (e.currentTarget as HTMLElement).style.color = "#fff"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "#fff"; (e.currentTarget as HTMLElement).style.color = color; }}
    >
      {children}
    </button>
  );
}
