import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { SpitarLogoMark } from "@/components/SpitarLogoMark";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";

export default function MagicLinkLanding() {
  const { isMagicLinkUrl, completeMagicLinkSignIn, user } = useAuth();
  const navigate = useNavigate();

  const [status, setStatus] = useState<"checking" | "need_email" | "signing_in" | "done" | "error">("checking");
  const [email, setEmail] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (user) { navigate("/dashboard"); return; }
    if (!isMagicLinkUrl(window.location.href)) {
      navigate("/login");
      return;
    }
    const saved = localStorage.getItem("spitar_magic_email");
    if (saved) {
      signIn(saved);
    } else {
      setStatus("need_email");
    }
  }, []);

  const signIn = async (emailToUse: string) => {
    setStatus("signing_in");
    try {
      await completeMagicLinkSignIn(emailToUse, window.location.href);
      setStatus("done");
      setTimeout(() => navigate("/dashboard"), 1500);
    } catch (err: any) {
      setErrorMsg(err.message === "SUSPENDED"
        ? "Your account has been suspended. Contact support."
        : "Link is invalid or expired. Please request a new one.");
      setStatus("error");
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center space-y-6">
        <SpitarLogoMark size={56} className="mx-auto" />
        <h1 className="text-xl font-bold">SPITAR CLD</h1>

        {status === "checking" || status === "signing_in" ? (
          <div className="space-y-3">
            <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
            <p className="text-muted-foreground text-sm">Signing you in…</p>
          </div>
        ) : status === "done" ? (
          <div className="space-y-3">
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" />
            <p className="font-semibold text-green-700">Signed in! Redirecting…</p>
          </div>
        ) : status === "error" ? (
          <div className="space-y-4">
            <AlertCircle className="w-10 h-10 text-destructive mx-auto" />
            <p className="text-sm text-destructive">{errorMsg}</p>
            <Button variant="outline" onClick={() => navigate("/login")} className="w-full">
              Back to Login
            </Button>
          </div>
        ) : (
          // need_email — device changed since sending the link
          <div className="space-y-4 text-left">
            <p className="text-sm text-muted-foreground text-center">
              Please confirm your email address to complete sign-in.
            </p>
            <div className="space-y-2">
              <Label>Email address</Label>
              <Input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoFocus
              />
            </div>
            <Button
              className="w-full"
              disabled={!email}
              onClick={() => signIn(email)}
            >
              Confirm & Sign In
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
