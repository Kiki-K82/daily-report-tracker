import React, { useState } from "react";
import { supabase } from "./supabase";

// Login / Sign-up / Forgot-password screen shown when no one is signed in
export default function AuthScreen() {
  const [mode, setMode] = useState("signin"); // "signin", "signup", or "forgot"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null); // { type: "error" | "success", text }

  const isSignUp = mode === "signup";
  const isForgot = mode === "forgot";

  const switchMode = (newMode) => {
    setMode(newMode);
    setMessage(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      if (isForgot) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin,
        });
        if (error) throw error;
        setMessage({
          type: "success",
          text: "If an account exists for that email, a password reset link is on its way. Check your inbox (and spam).",
        });
      } else if (isSignUp) {
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
      }
    } catch (err) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setBusy(false);
    }
  };

  const subtitle = isForgot ? "Reset your password" : isSignUp ? "Create your account" : "Sign in to your account";
  const buttonLabel = isForgot ? "Send Reset Link" : isSignUp ? "Create Account" : "Sign In";

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-md border border-slate-200 w-full max-w-md p-6 space-y-6">
        <div className="flex items-center gap-3">
          <img src="/favicon.svg" alt="Daily Report Tracker logo" className="w-12 h-12 rounded-xl" />
          <div>
            <h1 className="text-xl font-bold text-slate-900">Daily Report Tracker</h1>
            <p className="text-sm text-slate-600">{subtitle}</p>
          </div>
        </div>

        {message && (
          <div className={`text-base rounded-xl p-3 border ${message.type === "error" ? "bg-red-50 border-red-200 text-red-800" : "bg-emerald-50 border-emerald-200 text-emerald-800"}`}>
            {message.text}
          </div>
        )}

        {isForgot && (
          <p className="text-base text-slate-700">
            Enter the email you signed up with, and we'll send you a link to set a new password.
          </p>
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

          {!isForgot && (
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
              {!isSignUp && (
                <button
                  type="button"
                  onClick={() => switchMode("forgot")}
                  className="mt-2 text-sm font-semibold text-teal-800 hover:underline"
                >
                  Forgot password?
                </button>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full py-3 bg-teal-700 hover:bg-teal-800 disabled:opacity-60 text-white font-bold text-base rounded-xl transition shadow-md"
          >
            {busy ? "Please wait..." : buttonLabel}
          </button>
        </form>

        <p className="text-base text-slate-700 text-center">
          {isForgot ? (
            <button type="button" onClick={() => switchMode("signin")} className="font-bold text-teal-800 hover:underline">
              Back to sign in
            </button>
          ) : (
            <>
              {isSignUp ? "Already have an account?" : "New here?"}{" "}
              <button
                type="button"
                onClick={() => switchMode(isSignUp ? "signin" : "signup")}
                className="font-bold text-teal-800 hover:underline"
              >
                {isSignUp ? "Sign in" : "Create an account"}
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}

// Screen shown after tapping the password-reset link in the email
export function SetNewPasswordScreen({ onDone }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("The two passwords don't match.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    onDone();
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-md border border-slate-200 w-full max-w-md p-6 space-y-6">
        <div className="flex items-center gap-3">
          <img src="/favicon.svg" alt="Daily Report Tracker logo" className="w-12 h-12 rounded-xl" />
          <div>
            <h1 className="text-xl font-bold text-slate-900">Daily Report Tracker</h1>
            <p className="text-sm text-slate-600">Set a new password</p>
          </div>
        </div>

        {error && (
          <div className="text-base rounded-xl p-3 border bg-red-50 border-red-200 text-red-800">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">New password</label>
            <input
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-base focus:ring-2 focus:ring-teal-600 focus:bg-white"
            />
            <p className="text-sm text-slate-600 mt-1">At least 6 characters.</p>
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Confirm new password</label>
            <input
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-base focus:ring-2 focus:ring-teal-600 focus:bg-white"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="w-full py-3 bg-teal-700 hover:bg-teal-800 disabled:opacity-60 text-white font-bold text-base rounded-xl transition shadow-md"
          >
            {busy ? "Saving..." : "Save New Password"}
          </button>
        </form>
      </div>
    </div>
  );
}