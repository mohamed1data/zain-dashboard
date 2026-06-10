"use client";
import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase-client";
import { useRouter } from "next/navigation";
import type { Customer, Conversation, Session, Appointment, DailyStat } from "@/lib/types";

type Tab = "overview" | "chats" | "appointments";

function initials(name: string) {
  if (!name) return "?";
  return name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();
}

function timeAgo(ts: string | null) {
  if (!ts) return "";
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
  if (diff < 1) return "الآن";
  if (diff < 60) return `${diff}د`;
  if (diff < 1440) return `${Math.floor(diff / 60)}س`;
  return `${Math.floor(diff / 1440)}ي`;
}

function formatTime(ts: string) {
  return new Date(ts).toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(ts: string) {
  return new Date(ts).toLocaleDateString("ar", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

const S = {
  layout: { display: "flex", height: "100vh", overflow: "hidden", background: "#f8f9fa" } as React.CSSProperties,
  sidebar: { width: "260px", minWidth: "260px", background: "white", borderLeft: "1px solid #e9ecef", display: "flex", flexDirection: "column" as const, overflow: "hidden" },
  main: { flex: 1, display: "flex", flexDirection: "column" as const, overflow: "hidden" },
  topbar: { height: "56px", background: "white", borderBottom: "1px solid #e9ecef", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px", flexShrink: 0 },
  content: { flex: 1, overflow: "auto", padding: "20px" },
  card: { background: "white", borderRadius: "12px", border: "1px solid #e9ecef", padding: "20px" },
  statCard: { background: "white", borderRadius: "12px", border: "1px solid #e9ecef", padding: "16px 20px" },
  badge: (color: string, bg: string) => ({ fontSize: "11px", padding: "3px 8px", borderRadius: "20px", background: bg, color, fontWeight: "500" as const }),
  btn: (primary?: boolean) => ({
    padding: "7px 14px", borderRadius: "7px", fontSize: "13px", fontWeight: "500" as const,
    border: primary ? "none" : "1px solid #e9ecef",
    background: primary ? "#25D366" : "white",
    color: primary ? "white" : "#374151",
    cursor: "pointer",
  }),
};

export default function AdminDashboard() {
  const router = useRouter();
  const supabase = createClient();

  const [tab, setTab] = useState<Tab>("overview");
  const [userEmail, setUserEmail] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [stats, setStats] = useState<DailyStat | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [messages, setMessages] = useState<Conversation[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);

  const loadAll = useCallback(async () => {
    const [custRes, convRes, sessRes, apptRes, statsRes] = await Promise.all([
      supabase.from("customers").select("*").order("last_message_at", { ascending: false }),
      supabase.from("conversations").select("*").order("timestamp", { ascending: false }).limit(200),
      supabase.from("sessions").select("*"),
      supabase.from("appointments").select("*").order("start_time", { ascending: false }).limit(50),
      supabase.from("daily_stats").select("*").order("day", { ascending: false }).limit(1).single(),
    ]);
    setCustomers(custRes.data ?? []);
    setConversations(convRes.data ?? []);
    setSessions(sessRes.data ?? []);
    setAppointments(apptRes.data ?? []);
    setStats(statsRes.data ?? null);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push("/login"); return; }
      setUserEmail(data.user.email ?? "");
    });
    loadAll();
    const interval = setInterval(loadAll, 30000);
    return () => clearInterval(interval);
  }, [loadAll, router, supabase]);

  async function loadMessages(phone: string) {
    const { data } = await supabase
      .from("conversations")
      .select("*")
      .eq("from_number", phone)
      .order("timestamp", { ascending: true })
      .limit(100);
    setMessages(data ?? []);
  }

  async function selectCustomer(c: Customer) {
    setSelectedCustomer(c);
    await loadMessages(c.phone);
  }

  function getSession(phone: string) {
    return sessions.find(s => s.session_id === phone);
  }

  function isBotActive(phone: string) {
    const s = getSession(phone);
    return s ? s.is_bot_active : true;
  }

  async function toggleBot(phone: string) {
    const current = isBotActive(phone);
    const existing = sessions.find(s => s.session_id === phone);
    if (existing) {
      await supabase.from("sessions").update({ is_bot_active: !current, updated_at: new Date().toISOString() }).eq("session_id", phone);
    } else {
      await supabase.from("sessions").insert({ session_id: phone, is_bot_active: false, updated_at: new Date().toISOString() });
    }
    setSessions(prev => existing
      ? prev.map(s => s.session_id === phone ? { ...s, is_bot_active: !current } : s)
      : [...prev, { id: Date.now(), session_id: phone, is_bot_active: false, human_agent: null, taken_at: null, auto_resume_at: null, updated_at: new Date().toISOString() }]
    );
  }

  async function sendReply() {
  if (!replyText.trim() || !selectedCustomer) return;
  setSendingReply(true);
  await supabase.from("conversations").insert({
    session_id: selectedCustomer.phone,
    from_number: selectedCustomer.phone,
    profile_name: selectedCustomer.name,
    user_message: null,
    bot_message: replyText.trim(),
    channel: "dashboard",
    escalated: false,
    timestamp: new Date().toISOString(),
  });
  setReplyText("");
  await loadMessages(selectedCustomer.phone);
  setSendingReply(false);
}

  async function logout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  const filteredCustomers = customers.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.phone?.includes(search)
  );

  const todayConvs = conversations.filter(c => {
    const d = new Date(c.timestamp);
    const today = new Date();
    return d.getDate() === today.getDate() && d.getMonth() === today.getMonth();
  });

  const escalatedToday = todayConvs.filter(c => c.escalated).length;
  const activeBots = sessions.filter(s => s.is_bot_active).length;
  const todayAppts = appointments.filter(a => {
    const d = new Date(a.start_time);
    const today = new Date();
    return d.getDate() === today.getDate() && d.getMonth() === today.getMonth();
  });

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", color: "#6c757d", fontSize: "14px" }}>
      جاري التحميل...
    </div>
  );

  return (
    <div style={S.layout}>
      {/* Sidebar */}
      <div style={S.sidebar}>
        {/* Brand */}
        <div style={{ padding: "16px", borderBottom: "1px solid #e9ecef", display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "#25D366", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M12 2C6.48 2 2 6.48 2 12c0 1.85.5 3.58 1.37 5.07L2 22l5.07-1.35C8.44 21.51 10.18 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2z" fill="white" opacity="0.9"/>
              <path d="M17 14.5c-.28-.14-1.65-.81-1.9-.9-.26-.09-.44-.14-.63.14-.19.28-.72.9-.88 1.08-.16.19-.33.21-.61.07-.28-.14-1.18-.44-2.25-1.39-.83-.74-1.39-1.66-1.56-1.94-.16-.28-.02-.43.12-.57.13-.13.28-.33.42-.5.14-.17.19-.28.28-.47.09-.19.05-.35-.02-.5-.07-.14-.63-1.52-.86-2.08-.23-.55-.46-.47-.63-.48-.16 0-.35-.02-.54-.02s-.49.07-.75.35c-.26.28-1 1-1 2.42s1.02 2.81 1.16 3c.14.19 2 3.06 4.86 4.29.68.29 1.21.47 1.62.6.68.21 1.3.18 1.79.11.55-.08 1.65-.67 1.88-1.33.23-.65.23-1.21.16-1.33-.07-.12-.26-.19-.54-.33z" fill="#25D366"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: "14px", fontWeight: "700", color: "#212529" }}>EMPIRE AI</div>
            <div style={{ fontSize: "11px", color: "#6c757d" }}>لوحة المدير</div>
          </div>
        </div>

        {/* Search */}
        <div style={{ padding: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "#f8f9fa", border: "1px solid #e9ecef", borderRadius: "8px", padding: "7px 10px" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6c757d" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث عن عميل..." style={{ border: "none", background: "transparent", fontSize: "13px", color: "#212529", outline: "none", flex: 1 }} />
          </div>
        </div>

        {/* Customers list */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {filteredCustomers.length === 0 ? (
            <div style={{ padding: "20px", textAlign: "center", color: "#adb5bd", fontSize: "13px" }}>مفيش عملاء</div>
          ) : filteredCustomers.map(c => {
            const active = isBotActive(c.phone);
            const isSelected = selectedCustomer?.id === c.id;
            return (
              <div
                key={c.id}
                onClick={() => { setTab("chats"); selectCustomer(c); }}
                style={{
                  padding: "11px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: "10px",
                  borderBottom: "1px solid #f1f3f5",
                  background: isSelected ? "#f0fdf4" : "transparent",
                  borderRight: isSelected ? "3px solid #25D366" : "3px solid transparent",
                  transition: "background 0.1s",
                }}
              >
                <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "#dbeafe", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: "600", color: "#1e40af", flexShrink: 0 }}>
                  {initials(c.name)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "13px", fontWeight: "500", color: "#212529", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name || "بدون اسم"}</div>
                  <div style={{ fontSize: "11px", color: "#6c757d", direction: "ltr", textAlign: "right" }}>{c.phone}</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "3px" }}>
                  <span style={{ fontSize: "10px", color: "#adb5bd" }}>{timeAgo(c.last_message_at)}</span>
                  <span style={S.badge(active ? "#166534" : "#854d0e", active ? "#dcfce7" : "#fef9c3")}>{active ? "شغال" : "موقوف"}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main */}
      <div style={S.main}>
        {/* Topbar */}
        <div style={S.topbar}>
          <div style={{ display: "flex", gap: "4px" }}>
            {(["overview", "chats", "appointments"] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  padding: "6px 14px", borderRadius: "7px", fontSize: "13px", fontWeight: "500",
                  border: "none", cursor: "pointer",
                  background: tab === t ? "#f0fdf4" : "transparent",
                  color: tab === t ? "#15803d" : "#6c757d",
                }}
              >
                {t === "overview" ? "نظرة عامة" : t === "chats" ? "المحادثات" : "الحجوزات"}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ fontSize: "12px", color: "#6c757d" }}>{userEmail}</span>
            <button onClick={logout} style={{ ...S.btn(), fontSize: "12px" }}>خروج</button>
          </div>
        </div>

        {/* OVERVIEW TAB */}
        {tab === "overview" && (
          <div style={S.content}>
            <div style={{ marginBottom: "20px" }}>
              <h2 style={{ fontSize: "18px", fontWeight: "600", color: "#212529", margin: 0 }}>نظرة عامة</h2>
              <p style={{ fontSize: "13px", color: "#6c757d", margin: "4px 0 0" }}>
                {new Date().toLocaleDateString("ar", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
              </p>
            </div>

            {/* Stats Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "20px" }}>
              {[
                { label: "إجمالي العملاء", value: customers.length, color: "#3b82f6", bg: "#dbeafe" },
                { label: "محادثات اليوم", value: todayConvs.length, color: "#25D366", bg: "#dcfce7" },
                { label: "حجوزات اليوم", value: todayAppts.length, color: "#f59e0b", bg: "#fef3c7" },
                { label: "تصعيدات اليوم", value: escalatedToday, color: "#ef4444", bg: "#fee2e2" },
              ].map(s => (
                <div key={s.label} style={S.statCard}>
                  <div style={{ fontSize: "28px", fontWeight: "700", color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: "12px", color: "#6c757d", marginTop: "4px" }}>{s.label}</div>
                </div>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              {/* Recent conversations */}
              <div style={S.card}>
                <h3 style={{ fontSize: "14px", fontWeight: "600", color: "#212529", margin: "0 0 14px" }}>آخر المحادثات</h3>
                {conversations.slice(0, 8).map(c => (
                  <div key={c.id} style={{ display: "flex", alignItems: "flex-start", gap: "10px", padding: "8px 0", borderBottom: "1px solid #f8f9fa" }}>
                    <div style={{ width: "30px", height: "30px", borderRadius: "50%", background: "#dbeafe", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: "600", color: "#1e40af", flexShrink: 0 }}>
                      {initials(c.profile_name ?? "")}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "12px", fontWeight: "500", color: "#212529" }}>{c.profile_name || c.from_number}</div>
                      <div style={{ fontSize: "11px", color: "#6c757d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {c.user_message || c.bot_message || "—"}
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "3px" }}>
                      <span style={{ fontSize: "10px", color: "#adb5bd" }}>{timeAgo(c.timestamp)}</span>
                      {c.escalated && <span style={S.badge("#991b1b", "#fee2e2")}>تصعيد</span>}
                    </div>
                  </div>
                ))}
              </div>

              {/* Upcoming appointments */}
              <div style={S.card}>
                <h3 style={{ fontSize: "14px", fontWeight: "600", color: "#212529", margin: "0 0 14px" }}>الحجوزات القادمة</h3>
                {appointments.filter(a => new Date(a.start_time) >= new Date()).slice(0, 6).length === 0 ? (
                  <div style={{ textAlign: "center", padding: "20px", color: "#adb5bd", fontSize: "13px" }}>مفيش حجوزات قادمة</div>
                ) : appointments.filter(a => new Date(a.start_time) >= new Date()).slice(0, 6).map(a => (
                  <div key={a.id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 0", borderBottom: "1px solid #f8f9fa" }}>
                    <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: "#fef3c7", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ fontSize: "13px", fontWeight: "700", color: "#92400e", lineHeight: 1 }}>{new Date(a.start_time).getDate()}</span>
                      <span style={{ fontSize: "9px", color: "#92400e" }}>{new Date(a.start_time).toLocaleString("ar", { month: "short" })}</span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "12px", fontWeight: "500", color: "#212529" }}>{a.customer_name}</div>
                      <div style={{ fontSize: "11px", color: "#6c757d" }}>{a.title} — {formatTime(a.start_time)}</div>
                    </div>
                    <span style={S.badge(
                      a.status === "confirmed" ? "#166534" : a.status === "cancelled" ? "#991b1b" : "#854d0e",
                      a.status === "confirmed" ? "#dcfce7" : a.status === "cancelled" ? "#fee2e2" : "#fef9c3"
                    )}>
                      {a.status === "confirmed" ? "مؤكد" : a.status === "cancelled" ? "ملغي" : "معلق"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* CHATS TAB */}
        {tab === "chats" && (
          <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
            {!selectedCustomer ? (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "10px", color: "#adb5bd" }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                <p style={{ fontSize: "13px" }}>اختار عميل من القائمة</p>
              </div>
            ) : (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                {/* Chat header */}
                <div style={{ padding: "12px 20px", background: "white", borderBottom: "1px solid #e9ecef", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{ width: "38px", height: "38px", borderRadius: "50%", background: "#dbeafe", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: "600", color: "#1e40af" }}>
                      {initials(selectedCustomer.name)}
                    </div>
                    <div>
                      <div style={{ fontSize: "14px", fontWeight: "600", color: "#212529" }}>{selectedCustomer.name}</div>
                      <div style={{ fontSize: "12px", color: "#6c757d", direction: "ltr" }}>{selectedCustomer.phone}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontSize: "13px", color: "#6c757d" }}>البوت:</span>
                    <button
                      onClick={() => toggleBot(selectedCustomer.phone)}
                      style={{
                        padding: "6px 14px", borderRadius: "7px", fontSize: "12px", fontWeight: "500",
                        border: "1px solid",
                        borderColor: isBotActive(selectedCustomer.phone) ? "#86efac" : "#fde047",
                        background: isBotActive(selectedCustomer.phone) ? "#dcfce7" : "#fef9c3",
                        color: isBotActive(selectedCustomer.phone) ? "#166534" : "#854d0e",
                        cursor: "pointer",
                      }}
                    >
                      {isBotActive(selectedCustomer.phone) ? "⏸ إيقاف البوت" : "▶ تشغيل البوت"}
                    </button>
                  </div>
                </div>

                {/* Messages */}
                <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: "8px" }}>
                  {messages.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "40px", color: "#adb5bd", fontSize: "13px" }}>مفيش رسائل بعد</div>
                  ) : messages.map(m => (
                    <div key={m.id}>
                      {m.user_message && (
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", marginBottom: "6px" }}>
                          <div style={{ maxWidth: "65%", padding: "9px 13px", background: "#f1f3f5", borderRadius: "12px 12px 12px 3px", fontSize: "13px", color: "#212529", lineHeight: 1.5 }}>
                            {m.user_message}
                          </div>
                          <span style={{ fontSize: "10px", color: "#adb5bd", marginTop: "3px", paddingRight: "4px" }}>{formatTime(m.timestamp)}</span>
                        </div>
                      )}
                      {m.bot_message && (
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", marginBottom: "6px" }}>
                          <div style={{ maxWidth: "65%", padding: "9px 13px", background: "#dcfce7", borderRadius: "12px 12px 3px 12px", fontSize: "13px", color: "#14532d", lineHeight: 1.5 }}>
                            {m.bot_message}
                          </div>
                          <span style={{ fontSize: "10px", color: "#adb5bd", marginTop: "3px", paddingLeft: "4px" }}>{formatTime(m.timestamp)}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Reply bar */}
                <div style={{ padding: "12px 20px", background: "white", borderTop: "1px solid #e9ecef", display: "flex", gap: "8px", alignItems: "center" }}>
                  {isBotActive(selectedCustomer.phone) ? (
                    <div style={{ flex: 1, padding: "10px 14px", background: "#f8f9fa", borderRadius: "8px", border: "1px solid #e9ecef", fontSize: "13px", color: "#adb5bd" }}>
                      أوقف البوت الأول عشان ترد...
                    </div>
                  ) : (
                    <>
                      <input
                        value={replyText}
                        onChange={e => setReplyText(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendReply()}
                        placeholder="اكتب ردك هنا..."
                        style={{ flex: 1, padding: "10px 14px", border: "1px solid #e9ecef", borderRadius: "8px", fontSize: "13px", color: "#212529", outline: "none" }}
                      />
                      <button
                        onClick={sendReply}
                        disabled={sendingReply || !replyText.trim()}
                        style={{ width: "38px", height: "38px", borderRadius: "50%", background: replyText.trim() ? "#25D366" : "#e9ecef", border: "none", cursor: replyText.trim() ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="m22 2-7 20-4-9-9-4 20-7z"/></svg>
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* APPOINTMENTS TAB */}
        {tab === "appointments" && (
          <div style={S.content}>
            <div style={{ marginBottom: "20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h2 style={{ fontSize: "18px", fontWeight: "600", color: "#212529", margin: 0 }}>الحجوزات</h2>
              <span style={S.badge("#1e40af", "#dbeafe")}>{appointments.length} حجز إجمالي</span>
            </div>
            <div style={S.card}>
              {appointments.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px", color: "#adb5bd", fontSize: "13px" }}>مفيش حجوزات بعد</div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid #f1f3f5" }}>
                      {["العميل", "الرقم", "الموعد", "العنوان", "الوقت", "الحالة"].map(h => (
                        <th key={h} style={{ padding: "10px 12px", textAlign: "right", fontSize: "12px", fontWeight: "600", color: "#6c757d" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {appointments.map(a => (
                      <tr key={a.id} style={{ borderBottom: "1px solid #f8f9fa" }}>
                        <td style={{ padding: "10px 12px", fontSize: "13px", fontWeight: "500", color: "#212529" }}>{a.customer_name}</td>
                        <td style={{ padding: "10px 12px", fontSize: "12px", color: "#6c757d", direction: "ltr" }}>{a.phone}</td>
                        <td style={{ padding: "10px 12px", fontSize: "12px", color: "#374151" }}>{formatDate(a.start_time)}</td>
                        <td style={{ padding: "10px 12px", fontSize: "12px", color: "#374151" }}>{a.title}</td>
                        <td style={{ padding: "10px 12px", fontSize: "12px", color: "#374151" }}>{formatTime(a.start_time)} — {formatTime(a.end_time)}</td>
                        <td style={{ padding: "10px 12px" }}>
                          <span style={S.badge(
                            a.status === "confirmed" ? "#166534" : a.status === "cancelled" ? "#991b1b" : "#854d0e",
                            a.status === "confirmed" ? "#dcfce7" : a.status === "cancelled" ? "#fee2e2" : "#fef9c3"
                          )}>
                            {a.status === "confirmed" ? "مؤكد" : a.status === "cancelled" ? "ملغي" : "معلق"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
