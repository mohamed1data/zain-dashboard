"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase-client";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error || !data.session) {
      setError("البريد الإلكتروني أو كلمة المرور غير صحيحة");
      setLoading(false);
      return;
    }

    const role = data.user?.user_metadata?.role ?? "staff";
    router.refresh();
    router.push(role === "admin" ? "/admin" : "/staff");
  }

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center",
      justifyContent: "center",
      background: "linear-gradient(135deg, #f0fdf4 0%, #f8f9fa 50%, #eff6ff 100%)",
      padding: "20px",
    }}>
      <div style={{ width: "100%", maxWidth: "400px" }}>
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "#25D366", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M12 2C6.48 2 2 6.48 2 12c0 1.85.5 3.58 1.37 5.07L2 22l5.07-1.35C8.44 21.51 10.18 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2z" fill="white" opacity="0.9"/>
                <path d="M17 14.5c-.28-.14-1.65-.81-1.9-.9-.26-.09-.44-.14-.63.14-.19.28-.72.9-.88 1.08-.16.19-.33.21-.61.07-.28-.14-1.18-.44-2.25-1.39-.83-.74-1.39-1.66-1.56-1.94-.16-.28-.02-.43.12-.57.13-.13.28-.33.42-.5.14-.17.19-.28.28-.47.09-.19.05-.35-.02-.5-.07-.14-.63-1.52-.86-2.08-.23-.55-.46-.47-.63-.48-.16 0-.35-.02-.54-.02s-.49.07-.75.35c-.26.28-1 1-1 2.42s1.02 2.81 1.16 3c.14.19 2 3.06 4.86 4.29.68.29 1.21.47 1.62.6.68.21 1.3.18 1.79.11.55-.08 1.65-.67 1.88-1.33.23-.65.23-1.21.16-1.33-.07-.12-.26-.19-.54-.33z" fill="#25D366"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: "18px", fontWeight: "700", color: "#212529" }}>EMPIRE AI</div>
              <div style={{ fontSize: "12px", color: "#6c757d" }}>WhatsApp Bot Dashboard</div>
            </div>
          </div>
        </div>

        <div style={{ background: "white", borderRadius: "16px", border: "1px solid #e9ecef", padding: "32px", boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}>
          <h1 style={{ fontSize: "20px", fontWeight: "600", color: "#212529", marginBottom: "6px", textAlign: "center" }}>تسجيل الدخول</h1>
          <p style={{ fontSize: "13px", color: "#6c757d", textAlign: "center", marginBottom: "28px" }}>ادخل بياناتك للوصول للوحة التحكم</p>

          {error && (
            <div style={{ background: "#fee2e2", border: "1px solid #fecaca", borderRadius: "8px", padding: "10px 14px", color: "#991b1b", fontSize: "13px", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
              <span>⚠️</span> {error}
            </div>
          )}

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "500", color: "#374151", marginBottom: "6px" }}>البريد الإلكتروني</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="example@email.com"
                style={{ width: "100%", padding: "10px 14px", border: "1px solid #e9ecef", borderRadius: "8px", fontSize: "14px", color: "#212529", outline: "none", direction: "ltr", textAlign: "left" }}
                onFocus={e => e.target.style.borderColor = "#25D366"}
                onBlur={e => e.target.style.borderColor = "#e9ecef"}
              />
            </div>

            <div style={{ marginBottom: "24px" }}>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "500", color: "#374151", marginBottom: "6px" }}>كلمة المرور</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••"
                style={{ width: "100%", padding: "10px 14px", border: "1px solid #e9ecef", borderRadius: "8px", fontSize: "14px", color: "#212529", outline: "none", direction: "ltr" }}
                onFocus={e => e.target.style.borderColor = "#25D366"}
                onBlur={e => e.target.style.borderColor = "#e9ecef"}
              />
            </div>

            <button type="submit" disabled={loading}
              style={{ width: "100%", padding: "11px", background: loading ? "#86efac" : "#25D366", color: "white", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: "600", cursor: loading ? "not-allowed" : "pointer" }}>
              {loading ? "جاري الدخول..." : "دخول"}
            </button>
          </form>
        </div>

        <p style={{ textAlign: "center", marginTop: "20px", fontSize: "12px", color: "#adb5bd" }}>Powered by EMPIRE AI</p>
      </div>
    </div>
  );
}