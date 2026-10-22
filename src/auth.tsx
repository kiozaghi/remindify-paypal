import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
} from "react";
import { api } from "./lib/api";
import type { AuthConfig, AuthUser } from "./types";

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  config: AuthConfig;
  login: (email: string, password: string) => Promise<AuthUser>;
  signup: (name: string, email: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  startGoogle: () => void;
  connectWallet: () => Promise<AuthUser>;
  refresh: () => Promise<void>;
};

const AuthCtx = createContext<AuthContextValue | null>(null);

const DEFAULT_CONFIG: AuthConfig = { email: true, google: false, wallet: true };

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<AuthConfig>(DEFAULT_CONFIG);

  const refresh = useCallback(async () => {
    try {
      const session = await api.authSession();
      setUser(session.user);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    Promise.allSettled([api.authSession(), api.authConfig()]).then(([session, authConfig]) => {
      if (!alive) return;
      if (session.status === "fulfilled") setUser(session.value.user);
      if (authConfig.status === "fulfilled") setConfig(authConfig.value);
      setLoading(false);
    });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const onUnauthorized = () => setUser(null);
    window.addEventListener("remindify:unauthorized", onUnauthorized);
    return () => window.removeEventListener("remindify:unauthorized", onUnauthorized);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await api.authLogin({ email, password });
    setUser(result.user);
    return result.user;
  }, []);

  const signup = useCallback(async (name: string, email: string, password: string) => {
    const result = await api.authSignup({ name, email, password });
    setUser(result.user);
    return result.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.authLogout();
    } finally {
      setUser(null);
    }
  }, []);

  const startGoogle = useCallback(() => {
    window.location.assign("/api/auth/google");
  }, []);

  const connectWallet = useCallback(async () => {
    const ethereum = window.ethereum;
    if (!ethereum) {
      throw new Error("No browser wallet found. Install MetaMask, or continue with email.");
    }
    const accounts = await ethereum.request({ method: "eth_requestAccounts" });
    const address = Array.isArray(accounts) ? accounts[0] : null;
    if (!address) throw new Error("Your wallet didn't return an account.");
    const challenge = await api.walletChallenge(address);
    let signature: string;
    try {
      signature = await ethereum.request({
        method: "personal_sign",
        params: [challenge.message, address],
      });
    } catch {
      throw new Error("Signature cancelled. Nothing was shared or charged.");
    }
    const result = await api.walletVerify({
      address,
      nonce: challenge.nonce,
      signature,
    });
    setUser(result.user);
    return result.user;
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user, loading, config, login, signup, logout, startGoogle, connectWallet, refresh,
  }), [user, loading, config, login, signup, logout, startGoogle, connectWallet, refresh]);

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth outside AuthProvider");
  return ctx;
}
