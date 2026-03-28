import { useState, useEffect } from "react";
import { Pill, CalendarDays, Check, Plus, Clock, ListTodo, Trash2, CheckCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { store, type Medication, type Appointment, type UserProfile, type Todo } from "@/lib/store";
import { logMedTaken, logMedUntaken } from "@/lib/sync";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { QRBadge, QRModal } from "@/components/HealthQRCode";

const Dashboard = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [meds, setMeds] = useState<Medication[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState('');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [newTodo, setNewTodo] = useState('');

  useEffect(() => {
    Promise.all([store.getMeds(), store.getAppointments(), store.getProfile(), store.getTodos()]).then(([m, a, p, td]) => {
      setMeds(m);
      setAppointments(a.filter(ap => ap.status === 'upcoming'));
      setUserName(p.name || '');
      setProfile(p);
      setTodos(td);
      setLoading(false);
    });
  }, []);

  const nextVisit = appointments[0];

  const toggleMed = async (id: string) => {
    const med = meds.find(m => m.id === id);
    if (!med) return;
    const newTaken = !med.taken;
    const now = new Date();
    const updates = {
      taken: newTaken,
      takenAt: newTaken ? now.toLocaleTimeString() : undefined,
      stock: newTaken ? med.stock - 1 : med.stock + 1,
    };
    const updatedMed = { ...med, ...updates };
    setMeds(prev => prev.map(m => m.id === id ? updatedMed : m));
    await store.updateMed(id, updates);

    if (newTaken) {
      await logMedTaken(updatedMed);
      toast({ title: `✓ ${med.name}`, description: t("sync_med_logged") });
    } else {
      await logMedUntaken(updatedMed);
      toast({ title: `↩ ${med.name}`, description: t("sync_med_unlogged") });
    }
  };

  const addTodo = async () => {
    if (!newTodo.trim()) return;
    const result = await store.addTodo({ title: newTodo.trim(), description: '', completed: false, source: 'manual' });
    if (result) {
      setTodos(prev => [result, ...prev]);
      setNewTodo('');
      toast({ title: "To-do added" });
    }
  };

  const toggleTodo = async (id: string) => {
    const todo = todos.find(t => t.id === id);
    if (!todo) return;
    const newCompleted = !todo.completed;
    setTodos(prev => prev.map(t => t.id === id ? { ...t, completed: newCompleted } : t));
    await store.updateTodo(id, { completed: newCompleted });
  };

  const deleteTodo = async (id: string) => {
    setTodos(prev => prev.filter(t => t.id !== id));
    await store.deleteTodo(id);
  };

  if (loading) {
    return <div className="p-8 max-w-5xl"><p className="text-muted-foreground">{t("loading")}</p></div>;
  }

  const incompleteTodos = todos.filter(t => !t.completed);
  const completedTodos = todos.filter(t => t.completed);

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-8">
        <div className="animate-fade-up">
          <h1 className="text-2xl font-bold text-foreground">
            {userName ? `${t("dash_greeting")}, ${userName}! 👋` : t("dash_title")}
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">{t("dash_subtitle")}</p>
        </div>
        {profile && <QRBadge profile={profile} onClick={() => setQrOpen(true)} />}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 animate-fade-up" style={{ animationDelay: '0.1s' }}>
        {/* Today's Meds */}
        <div className="meditrack-card border-l-4 border-l-primary">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-foreground">{t("dash_todays_meds")}</h2>
            <Pill className="w-5 h-5 text-primary" />
          </div>
          <div className="space-y-3">
            {meds.filter(m => !m.taken).length === 0 && meds.length > 0 && (
              <p className="text-sm text-primary py-4 text-center font-medium">{t("dash_all_taken")}</p>
            )}
            {meds.length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">{t("dash_no_meds")}</p>
            )}
            {meds.filter(m => !m.taken).map(med => (
              <div key={med.id} className="flex items-center justify-between p-3 rounded-xl border border-border bg-background transition-all">
                <div>
                  <p className="font-semibold text-sm text-foreground">{med.name}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                    {med.dose} · {t(`med_type_${med.medType}`)} · {t(`med_sched_${med.schedule}`)} · {t(`med_food_${med.foodTiming}`)}
                  </p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Clock className="w-3 h-3" /> <span className="text-primary font-medium">{med.time}</span>
                  </p>
                </div>
                <button
                  onClick={() => toggleMed(med.id)}
                  className="w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-90 border border-border hover:bg-accent"
                  aria-label={t("dash_mark_taken", { name: med.name })}
                >
                  <Plus className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Next Visit */}
        <div className="meditrack-card border-l-4 border-l-[hsl(220,60%,60%)]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-foreground">{t("dash_next_visit")}</h2>
            <CalendarDays className="w-5 h-5 text-[hsl(220,60%,60%)]" />
          </div>
          {nextVisit ? (
            <>
              <div className="p-3 rounded-xl bg-accent/50 border border-border mb-4">
                <p className="font-semibold text-foreground">{nextVisit.doctor}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1">
                  <Clock className="w-3 h-3" />
                  <span className="text-primary font-medium">
                    {new Date(nextVisit.date).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })} {new Date(nextVisit.date).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </p>
              </div>
              <Button className="w-full rounded-xl h-12 font-semibold" onClick={() => navigate('/appointments')} aria-label={t("dash_prepare")}>
                {t("dash_prepare")}
              </Button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{t("dash_no_visits")}</p>
          )}
        </div>
      </div>

      {/* To-Do Section */}
      <div className="meditrack-card border-l-4 border-l-amber-500 mt-6 animate-fade-up" style={{ animationDelay: '0.2s' }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-foreground flex items-center gap-2">
            <ListTodo className="w-5 h-5 text-amber-500" /> To-Do
          </h2>
          <span className="text-xs text-muted-foreground">{incompleteTodos.length} pending</span>
        </div>

        {/* Add new todo */}
        <div className="flex gap-2 mb-4">
          <Input
            placeholder="Add a task — e.g. Buy medicines, Get blood test done..."
            value={newTodo}
            onChange={e => setNewTodo(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addTodo()}
            className="rounded-xl flex-1"
          />
          <Button size="sm" className="rounded-xl" onClick={addTodo} disabled={!newTodo.trim()}>
            <Plus className="w-4 h-4" />
          </Button>
        </div>

        {/* Incomplete todos */}
        <div className="space-y-2">
          {incompleteTodos.length === 0 && completedTodos.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">No tasks yet. Add one above or let AI add tasks from your appointments!</p>
          )}
          {incompleteTodos.map(todo => (
            <div key={todo.id} className="flex items-center gap-3 p-2.5 rounded-xl border border-border bg-background group">
              <button onClick={() => toggleTodo(todo.id)} className="w-5 h-5 rounded-full border-2 border-amber-500 flex items-center justify-center flex-shrink-0 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors">
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground truncate">{todo.title}</p>
                {todo.description && <p className="text-xs text-muted-foreground truncate">{todo.description}</p>}
                <div className="flex items-center gap-2 mt-0.5">
                  {todo.source !== 'manual' && (
                    <span className="text-[10px] bg-accent text-muted-foreground px-1.5 py-0.5 rounded">AI</span>
                  )}
                  {todo.dueDate && (
                    <span className="text-[10px] text-muted-foreground">{todo.dueDate}</span>
                  )}
                </div>
              </div>
              <button onClick={() => deleteTodo(todo.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>

        {/* Completed todos (collapsible) */}
        {completedTodos.length > 0 && (
          <details className="mt-3">
            <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
              {completedTodos.length} completed
            </summary>
            <div className="space-y-1.5 mt-2">
              {completedTodos.map(todo => (
                <div key={todo.id} className="flex items-center gap-3 p-2 rounded-lg group">
                  <button onClick={() => toggleTodo(todo.id)} className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="w-3.5 h-3.5 text-primary" />
                  </button>
                  <p className="text-sm text-muted-foreground line-through flex-1 truncate">{todo.title}</p>
                  <button onClick={() => deleteTodo(todo.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>

      {profile && <QRModal profile={profile} open={qrOpen} onClose={() => setQrOpen(false)} />}
    </div>
  );
};

export default Dashboard;
