import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type CaregiverRole = "mom" | "dad" | "sibling" | "caregiver";

export type Profile = {
  id: string;
  preferred_name: string | null;
  child_name: string | null;
  caregiver_name: string | null;
  caregiver_role: CaregiverRole | null;
  email: string | null;
  lang: "en" | "fr";
  theme: "light" | "dark";
  calm: boolean;
  avatar_url: string | null;
  caregiver_objectives: string[] | null;
  onboarded: boolean;
  active_child_id: string | null;
};

type AuthCtx = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signUp: (email: string, password: string, opts: { caregiverName: string; caregiverRole: CaregiverRole; childName: string }) => Promise<{ error?: string }>;
  signIn: (email: string, password: string) => Promise<{ error?: string; mfaRequired?: boolean }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile: (patch: Partial<Profile>) => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async (uid: string) => {
    const { data } = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();
    if (data) setProfile(data as Profile);
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        setTimeout(() => loadProfile(sess.user.id), 0);
      } else {
        setProfile(null);
      }
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) loadProfile(session.user.id);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signUp: AuthCtx["signUp"] = async (email, password, opts) => {
    const { error } = await supabase.auth.signUp({
      email, password,
      options: {
        emailRedirectTo: `${window.location.origin}/today`,
        data: {
          child_name: opts.childName,
          preferred_name: opts.childName,
          caregiver_name: opts.caregiverName,
          caregiver_role: opts.caregiverRole,
        },
      },
    });
    return { error: error?.message };
  };

  const signIn: AuthCtx["signIn"] = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal && aal.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
      return { mfaRequired: true };
    }
    return {};
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    // Clear local UI caches (bot transcript, mood UI, etc.)
    if (typeof window !== "undefined") {
      try {
        sessionStorage.clear();
        // Targeted localStorage cleanup — keep theme/lang prefs.
        const keep = new Set(["kua:lang", "kua:theme", "kua:prefs"]);
        Object.keys(localStorage).forEach((k) => {
          if (k.startsWith("kua:chat") || k.startsWith("kua:mood")) localStorage.removeItem(k);
        });
        // Notify listeners of sign-out.
        window.dispatchEvent(new CustomEvent("kua:signout"));
        void keep;
      } catch {
        /* ignore */
      }
    }
  };

  const refreshProfile = async () => { if (user) await loadProfile(user.id); };

  const updateProfile = async (patch: Partial<Profile>) => {
    if (!user) return;
    const { data } = await supabase.from("profiles").update(patch).eq("id", user.id).select().maybeSingle();
    if (data) setProfile(data as Profile);
  };

  return (
    <Ctx.Provider value={{ session, user, profile, loading, signUp, signIn, signOut, refreshProfile, updateProfile }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be inside AuthProvider");
  return v;
}
