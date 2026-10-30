import React, { useState } from "react";
import { supabase } from "./supabase";

// Login / Sign-up screen shown when no one is signed in
export default function AuthScreen() {
  const [mode, setMode] = useState("signin"); // "signin" or "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null); // { type: "error" | "success", text }

  const isSignUp = mode === "signup";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        setMessage({ type: "success", text: "Account created! Check your email and tap the confirmation link, then sign in." });
        setMode("signin");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        // Signed in: the app switches to the dashboard automatically (next step)
      }
    } catch (err) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-md border border-slate-200 w-full max-w-md p-6 space-y-6">
        <div className="flex items-center gap-3">
          <img src="/favicon.svg" alt="Daily Report Tracker logo" className="w-12 h-12 rounded-xl" />
          <div>
            <h1 className="text-xl font-bold text-slate-900">Daily Report Tracker</h1>
            <p className="text-sm text-slate-600">{isSignUp ? "Create your account" : "Sign in to your account"}</p>
          </div>
        </div>

        {message && (
          <div className={`text-base rounded-xl p-3 border ${message.type === "error" ? "bg-red-50 border-red-200 text-red-800" : "bg-emerald-50 border-emerald-200 text-emerald-800"}`}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Email</label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-base focus:ring-2 focus:ring-teal-600 focus:bg-white"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Password</label>
            <input
              type="password"
              required
              minLength={6}
              autoComplete={isSignUp ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-base focus:ring-2 focus:ring-teal-600 focus:bg-white"
            />
            {isSignUp && <p className="text-sm text-slate-600 mt-1">At least 6 characters.</p>}
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full py-3 bg-teal-700 hover:bg-teal-800 disabled:opacity-60 text-white font-bold text-base rounded-xl transition shadow-md"
          >
            {busy ? "Please wait..." : isSignUp ? "Create Account" : "Sign In"}
          </button>
        </form>

        <p className="text-base text-slate-700 text-center">
          {isSignUp ? "Already have an account?" : "New here?"}{" "}
          <button
            type="button"
            onClick={() => { setMode(isSignUp ? "signin" : "signup"); setMessage(null); }}
            className="font-bold text-teal-800 hover:underline"
          >
            {isSignUp ? "Sign in" : "Create an account"}
          </button>
        </p>
      </div>
    </div>
  );
}