import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { QRCodeSVG } from "qrcode.react";
import { addDoc, collection, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { QrCode, RefreshCw, Download, Printer, Clock, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

const QR_DURATION_MS = 15 * 60 * 1000; // 15 minutes

interface QrToken {
  id: string;
  patientId: string;
  expiresAt: number;
  used: boolean;
}

export default function QrAccess() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [token, setToken] = useState<QrToken | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [generating, setGenerating] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const qrRef = useRef<HTMLDivElement>(null);

  const generateToken = async () => {
    if (!user) return;
    setGenerating(true);
    try {
      const expiresAt = Date.now() + QR_DURATION_MS;
      const ref = await addDoc(collection(db, "qr_access_tokens"), {
        patientId: user.uid,
        patientName: `${user.firstName} ${user.lastName}`,
        patientSpitarId: user.spitarId,
        expiresAt,
        used: false,
        createdAt: new Date().toISOString(),
      });
      const newToken: QrToken = { id: ref.id, patientId: user.uid, expiresAt, used: false };
      setToken(newToken);
      setSecondsLeft(Math.floor(QR_DURATION_MS / 1000));
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    if (intervalRef.current) clearInterval(intervalRef.current);

    intervalRef.current = setInterval(() => {
      const remaining = Math.max(0, Math.floor((token.expiresAt - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining === 0) {
        clearInterval(intervalRef.current!);
        setToken(null);
      }
    }, 1000);

    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [token]);

  const downloadQr = () => {
    if (!qrRef.current) return;
    const svg = qrRef.current.querySelector("svg");
    if (!svg) return;
    const data = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([data], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `spitar-qr-${user?.spitarId}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const printQr = () => {
    if (!qrRef.current) return;
    const svg = qrRef.current.querySelector("svg");
    if (!svg) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <html><head><title>SPITAR QR - ${user?.spitarId}</title></head>
      <body style="display:flex;flex-direction:column;align-items:center;padding:40px;font-family:sans-serif">
        <h2 style="color:#0057B8">SPITAR Emergency Access</h2>
        <p style="color:#666">${user?.firstName} ${user?.lastName} · ${user?.spitarId}</p>
        ${svg.outerHTML}
        <p style="color:#e74c3c;font-size:12px;margin-top:16px">Valid for 15 minutes · Single use only</p>
      </body></html>
    `);
    win.document.close();
    win.print();
  };

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const progress = token ? (secondsLeft / (QR_DURATION_MS / 1000)) * 100 : 0;

  const qrUrl = token
    ? `${window.location.origin}/qr-scan/${token.id}`
    : "";

  if (user?.role !== "patient") {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
          <p className="text-muted-foreground">QR Access is only available for patients.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-md mx-auto px-4 py-8">
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
            <QrCode className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">{t("dashboard.qr_access") || "Emergency QR Access"}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Generate a one-time QR code for emergency medical access
          </p>
        </div>

        {!token ? (
          <Card>
            <CardContent className="p-6 text-center space-y-4">
              <div className="w-40 h-40 rounded-xl border-2 border-dashed border-border flex items-center justify-center mx-auto">
                <QrCode className="w-16 h-16 text-muted-foreground/30" />
              </div>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  This QR code allows any doctor or hospital to access your medical file for <strong>15 minutes</strong>.
                </p>
                <div className="flex items-center gap-2 justify-center text-xs text-muted-foreground">
                  <ShieldCheck className="w-3.5 h-3.5 text-green-500" />
                  Single-use · Time-limited · Logged
                </div>
              </div>
              <Button onClick={generateToken} disabled={generating} className="w-full gap-2">
                <QrCode className="w-4 h-4" />
                Generate QR Code
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="text-center pb-3">
              <CardTitle className="text-base">
                {user.firstName} {user.lastName}
              </CardTitle>
              <CardDescription>{user.spitarId}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* QR Code */}
              <div ref={qrRef} className="flex justify-center p-4 bg-white rounded-xl border">
                <QRCodeSVG
                  value={qrUrl}
                  size={200}
                  level="H"
                  includeMargin
                  imageSettings={{
                    src: "/favicon.ico",
                    width: 32,
                    height: 32,
                    excavate: true,
                  }}
                />
              </div>

              {/* Countdown */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Clock className="w-3.5 h-3.5" />
                    Expires in
                  </div>
                  <span className={cn(
                    "font-mono font-bold tabular-nums",
                    secondsLeft < 60 ? "text-destructive" : secondsLeft < 180 ? "text-amber-500" : "text-green-600",
                  )}>
                    {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-1000",
                      progress > 33 ? "bg-green-500" : progress > 10 ? "bg-amber-500" : "bg-destructive",
                    )}
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="grid grid-cols-3 gap-2">
                <Button variant="outline" size="sm" onClick={downloadQr} className="gap-1.5">
                  <Download className="w-3.5 h-3.5" />
                  Save
                </Button>
                <Button variant="outline" size="sm" onClick={printQr} className="gap-1.5">
                  <Printer className="w-3.5 h-3.5" />
                  Print
                </Button>
                <Button variant="outline" size="sm" onClick={generateToken} disabled={generating} className="gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5" />
                  New
                </Button>
              </div>

              <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
                ⚠️ This QR grants full access to your medical records. Only share in emergencies.
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
