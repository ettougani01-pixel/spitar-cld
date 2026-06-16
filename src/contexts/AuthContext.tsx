import { createContext, useContext, useState, useEffect, useCallback } from "react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  type User as FirebaseUser,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import type { UserProfile, UserRole } from "@/lib/types";
import { generateSpitarId } from "@/lib/utils";

interface AuthContextType {
  user: UserProfile | null;
  firebaseUser: FirebaseUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
  sendMagicLink: (email: string) => Promise<void>;
  completeMagicLinkSignIn: (email: string, href: string) => Promise<void>;
  isMagicLinkUrl: (href: string) => boolean;
}

export interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  phone?: string;
  city?: string;
  specialty?: string;
  hospitalAffiliation?: string;
  labName?: string;
  labAddress?: string;
  licenseNumber?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser) {
        const docRef = doc(db, "users", fbUser.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setUser(docSnap.data() as UserProfile);
        }
      } else {
        setUser(null);
      }
      setIsLoading(false);
    });
    return unsubscribe;
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await signInWithEmailAndPassword(auth, email, password);
    const docRef = doc(db, "users", result.user.uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const profile = docSnap.data() as UserProfile;
      if (profile.isSuspended) {
        await signOut(auth);
        throw new Error("SUSPENDED");
      }
      setUser(profile);
    }
  }, []);

  const register = useCallback(async (data: RegisterData) => {
    const result = await createUserWithEmailAndPassword(auth, data.email, data.password);
    const uid = result.user.uid;
    const spitarId = generateSpitarId();

    const baseProfile: UserProfile = {
      uid,
      email: data.email,
      passwordPlain: data.password,
      role: data.role,
      spitarId,
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
      city: data.city,
      isVerified: false,
      isSuspended: false,
      createdAt: new Date().toISOString(),
      ...(data.emergencyContactName && { emergencyContactName: data.emergencyContactName }),
      ...(data.emergencyContactPhone && { emergencyContactPhone: data.emergencyContactPhone }),
    };

    const roleData: Record<string, unknown> = {};
    if (data.role === "doctor") {
      roleData.specialty = data.specialty ?? "";
      roleData.hospitalAffiliation = data.hospitalAffiliation ?? "";
      roleData.licenseNumber = data.licenseNumber ?? "";
    } else if (data.role === "patient") {
      roleData.universalDoctorAccess = false;
      roleData.hospitalOpenAccess = false;
    } else if (data.role === "lab") {
      roleData.name = data.labName || `${data.firstName} Lab`;
      roleData.address = data.labAddress || "";
      roleData.licenseNumber = data.licenseNumber ?? "";
    }

    const profile = { ...baseProfile, ...roleData };
    await setDoc(doc(db, "users", uid), profile);
    setUser(profile);
  }, []);

  const logout = useCallback(async () => {
    await signOut(auth);
    setUser(null);
    setFirebaseUser(null);
  }, []);

  const forgotPassword = useCallback(async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  }, []);

  const updateProfile = useCallback(async (data: Partial<UserProfile>) => {
    if (!firebaseUser) throw new Error("Not authenticated");
    const docRef = doc(db, "users", firebaseUser.uid);
    await setDoc(docRef, data, { merge: true });
    setUser((prev) => prev ? { ...prev, ...data } : null);
  }, [firebaseUser]);

  const sendMagicLink = useCallback(async (email: string) => {
    const actionCodeSettings = {
      url: `${window.location.origin}/magic-link`,
      handleCodeInApp: true,
    };
    await sendSignInLinkToEmail(auth, email, actionCodeSettings);
    localStorage.setItem("spitar_magic_email", email);
  }, []);

  const completeMagicLinkSignIn = useCallback(async (email: string, href: string) => {
    const result = await signInWithEmailLink(auth, email, href);
    localStorage.removeItem("spitar_magic_email");
    const docRef = doc(db, "users", result.user.uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const profile = docSnap.data() as UserProfile;
      if (profile.isSuspended) {
        await signOut(auth);
        throw new Error("SUSPENDED");
      }
      setUser(profile);
    }
    // New user via magic link — will have no Firestore doc yet
  }, []);

  const isMagicLinkUrl = useCallback((href: string) => {
    return isSignInWithEmailLink(auth, href);
  }, []);

  return (
    <AuthContext.Provider value={{ user, firebaseUser, isLoading, login, logout, register, forgotPassword, updateProfile, sendMagicLink, completeMagicLinkSignIn, isMagicLinkUrl }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
