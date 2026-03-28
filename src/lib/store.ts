// Supabase-backed data store for MediTrack
import { supabase } from "@/integrations/supabase/client";

export type MedType = 'tablet' | 'capsule' | 'syrup' | 'injection' | 'drops' | 'inhaler' | 'cream' | 'powder' | 'patch' | 'other';
export type MedSchedule = 'morning' | 'afternoon' | 'evening' | 'night';
export type FoodTiming = 'before' | 'after';

export interface Medication {
  id: string;
  name: string;
  dose: string;
  medType: MedType;
  schedule: MedSchedule;
  foodTiming: FoodTiming;
  time: string;
  startDate?: string;
  endDate?: string;
  stock: number;
  taken: boolean;
  takenAt?: string;
}

export interface Appointment {
  id: string;
  doctor: string;
  location: string;
  date: string;
  symptoms: string[];
  status: 'upcoming' | 'completed' | 'pending';
  rating?: number;
  notes?: string;
  doctorAdvice?: string;
  prescriptions?: string;
  followUpTests?: string;
  recordingUrl?: string;
}

export interface MedicalRecord {
  id: string;
  type: 'illness' | 'surgery' | 'vaccination' | 'allergy' | 'medication_log';
  category: 'general' | 'medication_log' | 'lab_test' | 'lab_scan' | 'prescription' | 'diagnosis' | 'doctor_visit';
  date?: string;
  description: string;
  attachmentUrl?: string;
}

export interface Report {
  id: string;
  title: string;
  date: string;
  originalText: string;
  simplifiedText: string;
}

export interface Todo {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  source: string;
  dueDate?: string;
  createdAt: string;
}

export interface AllergyEntry {
  name: string;
  severity: 'mild' | 'moderate' | 'severe';
}

export interface HistoryEntry {
  description: string;
  year?: string;
}

export interface UserProfile {
  name: string;
  email: string;
  age: string;
  gender: string;
  bloodGroup: string;
  location: string;
  phone: string;
  dateOfBirth: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  aadhaarId: string;
  organDonor: boolean;
  jehovahWitness: boolean;
  dnr: boolean;
  allergies: AllergyEntry[];
  chronicConditions: HistoryEntry[];
  pastSurgeries: HistoryEntry[];
  vaccinations: HistoryEntry[];
  familyHistory: HistoryEntry[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

// Helper to get current user id
async function getUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export const store = {
  getMeds: async (): Promise<Medication[]> => {
    const userId = await getUserId();
    if (!userId) return [];
    const { data } = await supabase.from('medications').select('*').eq('user_id', userId);
    return (data || []).map((m: any) => ({
      id: m.id, name: m.name, dose: m.dose, time: m.time,
      medType: (m.med_type || 'tablet') as MedType,
      schedule: (m.schedule || 'morning') as MedSchedule,
      foodTiming: (m.food_timing || 'after') as FoodTiming,
      startDate: m.start_date ?? undefined,
      endDate: m.end_date ?? undefined,
      stock: m.stock, taken: m.taken, takenAt: m.taken_at ?? undefined,
    }));
  },

  addMed: async (med: Omit<Medication, 'id'>): Promise<Medication | null> => {
    const userId = await getUserId();
    if (!userId) return null;
    const { data } = await supabase.from('medications').insert({
      user_id: userId, name: med.name, dose: med.dose, time: med.time,
      med_type: med.medType, schedule: med.schedule, food_timing: med.foodTiming,
      start_date: med.startDate ?? null, end_date: med.endDate ?? null,
      stock: med.stock, taken: med.taken, taken_at: med.takenAt ?? null,
    } as any).select().single();
    if (!data) return null;
    const d = data as any;
    return { id: d.id, name: d.name, dose: d.dose, time: d.time, medType: d.med_type, schedule: d.schedule, foodTiming: d.food_timing, startDate: d.start_date ?? undefined, endDate: d.end_date ?? undefined, stock: d.stock, taken: d.taken, takenAt: d.taken_at ?? undefined };
  },

  updateMed: async (id: string, updates: Partial<Medication>) => {
    const mapped: Record<string, unknown> = {};
    if (updates.name !== undefined) mapped.name = updates.name;
    if (updates.dose !== undefined) mapped.dose = updates.dose;
    if (updates.time !== undefined) mapped.time = updates.time;
    if (updates.stock !== undefined) mapped.stock = updates.stock;
    if (updates.taken !== undefined) mapped.taken = updates.taken;
    if (updates.takenAt !== undefined) mapped.taken_at = updates.takenAt;
    await supabase.from('medications').update(mapped).eq('id', id);
  },

  deleteMed: async (id: string) => {
    await supabase.from('medications').delete().eq('id', id);
  },

  getAppointments: async (): Promise<Appointment[]> => {
    const userId = await getUserId();
    if (!userId) return [];
    const { data } = await supabase.from('appointments').select('*').eq('user_id', userId).order('date', { ascending: true });
    return (data || []).map(a => ({
      id: a.id, doctor: a.doctor, location: a.location, date: a.date,
      symptoms: a.symptoms || [], status: a.status as 'upcoming' | 'completed' | 'pending',
      rating: a.rating ?? undefined, notes: a.notes ?? undefined,
      doctorAdvice: a.doctor_advice ?? undefined, prescriptions: a.prescriptions ?? undefined,
      followUpTests: a.follow_up_tests ?? undefined, recordingUrl: (a as any).recording_url ?? undefined,
    }));
  },

  addAppointment: async (appt: Omit<Appointment, 'id'>): Promise<Appointment | null> => {
    const userId = await getUserId();
    if (!userId) return null;
    const { data } = await supabase.from('appointments').insert({
      user_id: userId, doctor: appt.doctor, location: appt.location, date: appt.date,
      symptoms: appt.symptoms, status: appt.status,
    }).select().single();
    if (!data) return null;
    return { id: data.id, doctor: data.doctor, location: data.location, date: data.date, symptoms: data.symptoms || [], status: data.status as 'upcoming' | 'completed' | 'pending' };
  },

  updateAppointment: async (id: string, updates: Partial<Record<string, unknown>>) => {
    await supabase.from('appointments').update(updates).eq('id', id);
  },

  getRecords: async (): Promise<MedicalRecord[]> => {
    const userId = await getUserId();
    if (!userId) return [];
    const { data } = await supabase.from('medical_records').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    return (data || []).map(r => ({
      id: r.id, type: r.type as MedicalRecord['type'], category: ((r as any).category || 'general') as MedicalRecord['category'], date: r.date ?? undefined, description: r.description, attachmentUrl: (r as any).attachment_url ?? undefined,
    }));
  },

  addRecord: async (rec: Omit<MedicalRecord, 'id'>): Promise<MedicalRecord | null> => {
    const userId = await getUserId();
    if (!userId) return null;
    const { data } = await supabase.from('medical_records').insert({
      user_id: userId, type: rec.type, date: rec.date ?? null, description: rec.description,
      category: rec.category || 'general', attachment_url: rec.attachmentUrl ?? null,
    } as any).select().single();
    if (!data) return null;
    return { id: data.id, type: data.type as MedicalRecord['type'], category: ((data as any).category || 'general') as MedicalRecord['category'], date: data.date ?? undefined, description: data.description, attachmentUrl: (data as any).attachment_url ?? undefined };
  },

  getReports: async (): Promise<Report[]> => {
    const userId = await getUserId();
    if (!userId) return [];
    const { data } = await supabase.from('reports').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    return (data || []).map(r => ({
      id: r.id, title: r.title, date: r.date, originalText: r.original_text, simplifiedText: r.simplified_text,
    }));
  },

  addReport: async (rep: Omit<Report, 'id'>): Promise<Report | null> => {
    const userId = await getUserId();
    if (!userId) return null;
    const { data } = await supabase.from('reports').insert({
      user_id: userId, title: rep.title, date: rep.date, original_text: rep.originalText, simplified_text: rep.simplifiedText,
    }).select().single();
    if (!data) return null;
    return { id: data.id, title: data.title, date: data.date, originalText: data.original_text, simplifiedText: data.simplified_text };
  },

  getTodos: async (): Promise<Todo[]> => {
    const userId = await getUserId();
    if (!userId) return [];
    const { data } = await supabase.from('todos').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    return (data || []).map((t: any) => ({
      id: t.id, title: t.title, description: t.description || '',
      completed: t.completed, source: t.source || 'manual',
      dueDate: t.due_date ?? undefined, createdAt: t.created_at,
    }));
  },

  addTodo: async (todo: Omit<Todo, 'id' | 'createdAt'>): Promise<Todo | null> => {
    const userId = await getUserId();
    if (!userId) return null;
    const { data } = await supabase.from('todos').insert({
      user_id: userId, title: todo.title, description: todo.description || '',
      completed: todo.completed || false, source: todo.source || 'manual',
      due_date: todo.dueDate ?? null,
    } as any).select().single();
    if (!data) return null;
    const d = data as any;
    return { id: d.id, title: d.title, description: d.description || '', completed: d.completed, source: d.source || 'manual', dueDate: d.due_date ?? undefined, createdAt: d.created_at };
  },

  updateTodo: async (id: string, updates: Partial<{ title: string; description: string; completed: boolean; dueDate: string }>) => {
    const mapped: Record<string, unknown> = {};
    if (updates.title !== undefined) mapped.title = updates.title;
    if (updates.description !== undefined) mapped.description = updates.description;
    if (updates.completed !== undefined) mapped.completed = updates.completed;
    if (updates.dueDate !== undefined) mapped.due_date = updates.dueDate;
    await supabase.from('todos').update(mapped).eq('id', id);
  },

  deleteTodo: async (id: string) => {
    await supabase.from('todos').delete().eq('id', id);
  },

  getProfile: async (): Promise<UserProfile> => {
    const { data: { user } } = await supabase.auth.getUser();
    const empty: UserProfile = { name: '', email: '', age: '', gender: '', bloodGroup: '', location: '', phone: '', dateOfBirth: '', emergencyContactName: '', emergencyContactPhone: '', aadhaarId: '', organDonor: false, jehovahWitness: false, dnr: false, allergies: [], chronicConditions: [], pastSurgeries: [], vaccinations: [], familyHistory: [] };
    if (!user) return empty;
    const { data } = await supabase.from('profiles').select('*').eq('user_id', user.id).single();
    return {
      name: data?.name || user.user_metadata?.full_name || '',
      email: user.email || '',
      age: (data as any)?.age || '',
      gender: (data as any)?.gender || '',
      bloodGroup: (data as any)?.blood_group || '',
      location: (data as any)?.location || '',
      phone: (data as any)?.phone || '',
      dateOfBirth: (data as any)?.date_of_birth || '',
      emergencyContactName: (data as any)?.emergency_contact_name || '',
      emergencyContactPhone: (data as any)?.emergency_contact_phone || '',
      aadhaarId: (data as any)?.aadhaar_id || '',
      organDonor: (data as any)?.organ_donor ?? false,
      jehovahWitness: (data as any)?.jehovah_witness ?? false,
      dnr: (data as any)?.dnr ?? false,
      allergies: (data as any)?.allergies || [],
      chronicConditions: (data as any)?.chronic_conditions || [],
      pastSurgeries: (data as any)?.past_surgeries || [],
      vaccinations: (data as any)?.vaccinations || [],
      familyHistory: (data as any)?.family_history || [],
    };
  },

  setProfile: async (p: UserProfile) => {
    const userId = await getUserId();
    if (!userId) return;
    await supabase.from('profiles').update({
      name: p.name, age: p.age, gender: p.gender, blood_group: p.bloodGroup, location: p.location,
      phone: p.phone, date_of_birth: p.dateOfBirth,
      emergency_contact_name: p.emergencyContactName, emergency_contact_phone: p.emergencyContactPhone,
      aadhaar_id: p.aadhaarId, organ_donor: p.organDonor, jehovah_witness: p.jehovahWitness, dnr: p.dnr,
      allergies: p.allergies, chronic_conditions: p.chronicConditions,
      past_surgeries: p.pastSurgeries, vaccinations: p.vaccinations, family_history: p.familyHistory,
    } as any).eq('user_id', userId);
  },

  // Chat history stays in localStorage (not sensitive, session-scoped)
  getChatHistory: (): ChatMessage[] => {
    try {
      const v = localStorage.getItem('meditrack_chat');
      return v ? JSON.parse(v) : [];
    } catch { return []; }
  },
  setChatHistory: (c: ChatMessage[]) => {
    localStorage.setItem('meditrack_chat', JSON.stringify(c));
  },

  getLanguage: (): string => {
    try {
      const v = localStorage.getItem('meditrack_language');
      return v ? JSON.parse(v) : 'English';
    } catch { return 'English'; }
  },
  setLanguage: (l: string) => {
    localStorage.setItem('meditrack_language', JSON.stringify(l));
  },
};
