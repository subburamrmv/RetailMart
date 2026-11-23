import React, { useState } from "react";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
} from "firebase/auth";
import { ArrowRight, Check, Mail, ShieldCheck, Sparkles } from "lucide-react";
import { auth, googleProvider } from "../lib/firebase";
import { useStore } from "../context/StoreContext";
import { RetailMateLogo } from "../components/BrandLogo";
import { Button, FieldLabel, TextInput } from "../components/ui/Primitives";

export function AuthPage() {
  const { enterSampleMode, showToast } = useStore();
  const [mode, setMode] = useState<"google" | "email">("google");
  const [emailAction, setEmailAction] = useState<"login" | "register" | "reset">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [infoMsg, setInfoMsg] = useState("");

  const handleGoogleSignIn = async () => {
    setBusy(true);
    setErrorMsg("");
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Google Sign-In failed.";
      setErrorMsg(msg);
    } finally {
      setBusy(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrorMsg("");
    setInfoMsg("");
    try {
      if (emailAction === "reset") {
        await sendPasswordResetEmail(auth, email.trim());
        setInfoMsg("Password reset instructions sent to your email.");
      } else if (emailAction === "register") {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        if (name.trim()) {
          await updateProfile(cred.user, { displayName: name.trim() });
        }
        await sendEmailVerification(cred.user);
        showToast("Account created. Please check your inbox to verify your email.", "warning");
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Authentication failed.";
      if (raw.includes("operation-not-allowed")) {
        setErrorMsg(
          "Email/Password sign-in is not enabled in the Firebase Console yet. Enable it under Firebase Console → Authentication → Sign-in method, or use Google Sign-In below."
        );
      } else {
        setErrorMsg(raw);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F8F6] flex flex-col lg:flex-row">
      {/* Left Brand Context Panel */}
      <div className="lg:w-[46%] bg-[#17263C] text-white p-8 lg:p-14 flex flex-col justify-between">
        <div>
          <RetailMateLogo surface="dark" size="lg" showTagline />

          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mt-10 leading-tight max-w-md text-balance">
            Your entire business. One intelligent, simple dashboard.
          </h1>
          <p className="text-sm sm:text-base text-white/75 mt-4 max-w-md leading-relaxed">
            Built for grocery, clothing, stationery, electronics, hardware, and general retail shops. Replace paper registers and scattered spreadsheets with clear daily numbers.
          </p>

          <div className="mt-8 space-y-3 text-sm text-white/85">
            <div className="flex items-center gap-2.5">
              <Check className="w-4 h-4 text-[#147D75] shrink-0" />
              <span>Automatic stock updates on every sale, return, and purchase</span>
            </div>
            <div className="flex items-center gap-2.5">
              <Check className="w-4 h-4 text-[#147D75] shrink-0" />
              <span>Cash, UPI, card, and customer credit tracking in one place</span>
            </div>
            <div className="flex items-center gap-2.5">
              <Check className="w-4 h-4 text-[#147D75] shrink-0" />
              <span>Plain-language profit calculations and AI business answers</span>
            </div>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-white/15 flex items-center gap-2 text-xs text-white/65">
          <ShieldCheck className="w-4 h-4 text-[#147D75] shrink-0" />
          <span>Multi-business isolation with audited financial & stock ledgers</span>
        </div>
      </div>

      {/* Right Sign-In Card */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md bg-white border border-[#E6EAE9] rounded-xl p-6 sm:p-8">
          <div className="mb-5 lg:hidden">
            <RetailMateLogo surface="light" size="md" showTagline />
          </div>
          <h2 className="text-xl font-bold text-[#17263C]">Sign in to RetailMate</h2>
          <p className="text-xs text-[#758195] mt-1">
            Access your store records or try the interactive sample store first.
          </p>

          {/* Segmented Switch */}
          <div className="grid grid-cols-2 gap-1 p-1 bg-[#F7F8F6] border border-[#E6EAE9] rounded-lg mt-5">
            <button
              type="button"
              onClick={() => {
                setMode("google");
                setErrorMsg("");
              }}
              className={`py-2 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                mode === "google" ? "bg-white text-[#17263C] shadow-xs" : "text-[#758195]"
              }`}
            >
              Google Account
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("email");
                setErrorMsg("");
              }}
              className={`py-2 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                mode === "email" ? "bg-white text-[#17263C] shadow-xs" : "text-[#758195]"
              }`}
            >
              Email & Password
            </button>
          </div>

          {errorMsg && (
            <div className="mt-4 p-3 rounded-lg bg-[#C84C4C]/10 border border-[#C84C4C]/25 text-xs text-[#C84C4C] leading-relaxed">
              {errorMsg}
            </div>
          )}
          {infoMsg && (
            <div className="mt-4 p-3 rounded-lg bg-[#21865B]/10 border border-[#21865B]/25 text-xs text-[#21865B] leading-relaxed">
              {infoMsg}
            </div>
          )}

          {mode === "google" ? (
            <div className="mt-6 space-y-3">
              <Button
                variant="primary"
                size="lg"
                className="w-full"
                onClick={handleGoogleSignIn}
                disabled={busy}
              >
                {busy ? "Signing in..." : "Continue with Google"}
                <ArrowRight className="w-4 h-4" />
              </Button>
              <p className="text-[11px] text-[#758195] text-center">
                Recommended for instant setup with verified email security.
              </p>
            </div>
          ) : (
            <form onSubmit={handleEmailSubmit} className="mt-5 space-y-3.5">
              <div className="flex items-center gap-3 text-xs border-b border-[#E6EAE9] pb-2">
                <button
                  type="button"
                  onClick={() => setEmailAction("login")}
                  className={`font-medium cursor-pointer ${emailAction === "login" ? "text-[#147D75]" : "text-[#758195]"}`}
                >
                  Login
                </button>
                <span className="text-[#E6EAE9]">·</span>
                <button
                  type="button"
                  onClick={() => setEmailAction("register")}
                  className={`font-medium cursor-pointer ${emailAction === "register" ? "text-[#147D75]" : "text-[#758195]"}`}
                >
                  Register
                </button>
                <span className="text-[#E6EAE9]">·</span>
                <button
                  type="button"
                  onClick={() => setEmailAction("reset")}
                  className={`font-medium cursor-pointer ${emailAction === "reset" ? "text-[#147D75]" : "text-[#758195]"}`}
                >
                  Forgot Password
                </button>
              </div>

              {emailAction === "register" && (
                <div>
                  <FieldLabel label="Owner Name" required />
                  <TextInput
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Subramanian"
                    required
                  />
                </div>
              )}

              <div>
                <FieldLabel label="Email Address" required />
                <TextInput
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@yourshop.com"
                  required
                />
              </div>

              {emailAction !== "reset" && (
                <div>
                  <FieldLabel label="Password" required />
                  <TextInput
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    minLength={6}
                    required
                  />
                </div>
              )}

              <Button type="submit" variant="primary" size="lg" className="w-full" disabled={busy}>
                <Mail className="w-4 h-4" />
                {busy
                  ? "Please wait..."
                  : emailAction === "register"
                  ? "Create Account"
                  : emailAction === "reset"
                  ? "Send Reset Email"
                  : "Sign In"}
              </Button>
            </form>
          )}

          <div className="mt-6 pt-5 border-t border-[#E6EAE9] space-y-3">
            <Button
              type="button"
              variant="secondary"
              size="md"
              className="w-full"
              onClick={enterSampleMode}
            >
              <Sparkles className="w-4 h-4 text-[#147D75]" />
              Explore Sample Store (No Sign-In Needed)
            </Button>
            <p className="text-[11px] text-[#758195] text-center leading-relaxed">
              Sample mode uses isolated practice data so you can test billing, inventory, and reports safely.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
