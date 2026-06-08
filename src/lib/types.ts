export type Customer = {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  plan: string | null;
  created_at: string;
  last_message_at: string | null;
};

export type Conversation = {
  id: number;
  message_id: string;
  session_id: string;
  from_number: string;
  profile_name: string | null;
  user_message: string | null;
  bot_message: string | null;
  channel: string | null;
  escalated: boolean;
  escalate_reason: string | null;
  timestamp: string;
};

export type Session = {
  id: number;
  session_id: string;
  is_bot_active: boolean;
  human_agent: string | null;
  taken_at: string | null;
  auto_resume_at: string | null;
  updated_at: string;
};

export type Appointment = {
  id: number;
  session_id: string;
  customer_name: string;
  phone: string;
  event_id: string;
  title: string;
  start_time: string;
  end_time: string;
  status: string;
  created_at: string;
};

export type DailyStat = {
  day: string;
  total_conversations: number;
  escalations: number;
  unique_users: number;
};
