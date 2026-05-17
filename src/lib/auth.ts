import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./firebase";

export interface User {
  email: string;
  name: string;
  createdAt: string;
}

export function getUser(): User | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem("mf_user");
    return stored ? (JSON.parse(stored) as User) : null;
  } catch {
    return null;
  }
}

export async function signIn(
  email: string,
  password: string
): Promise<{ user: User } | { error: string }> {
  try {
    const snap = await getDoc(doc(db, "users", email.toLowerCase()));
    if (!snap.exists()) return { error: "No account found with that email." };
    const data = snap.data();
    if (data.password !== password) return { error: "Incorrect password." };
    const user: User = { email: data.email, name: data.name, createdAt: data.createdAt };
    localStorage.setItem("mf_user", JSON.stringify(user));
    return { user };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("permission") || msg.includes("PERMISSION_DENIED")) {
      return { error: "Access denied — update your Firestore security rules to allow reads." };
    }
    return { error: "Connection error. Check your internet and try again." };
  }
}

export async function signUp(
  name: string,
  email: string,
  password: string
): Promise<{ user: User } | { error: string }> {
  try {
    const ref = doc(db, "users", email.toLowerCase());
    const snap = await getDoc(ref);
    if (snap.exists()) return { error: "An account with this email already exists." };
    const user: User = {
      email: email.toLowerCase(),
      name: name.trim(),
      createdAt: new Date().toISOString(),
    };
    await setDoc(ref, {
      ...user,
      password,
      tasks: [],
      goals: [],
      decisions: [],
      focusDays: [],
      chatMessages: [],
      // onboarding intentionally omitted — dashboard detects absence and shows setup modal
    });
    localStorage.setItem("mf_user", JSON.stringify(user));
    return { user };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("permission") || msg.includes("PERMISSION_DENIED")) {
      return { error: "Access denied — update your Firestore security rules to allow writes." };
    }
    return { error: "Connection error. Check your internet and try again." };
  }
}

export function signOut(): void {
  localStorage.removeItem("mf_user");
}
