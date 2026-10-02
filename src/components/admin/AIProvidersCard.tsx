import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Bot, Trash2, Zap, CheckCircle2, GraduationCap, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { getFunctionErrorMessage } from '@/lib/functionError';

interface Provider { id: string; name: string; base_url: string; model: string; is_active: boolean }
interface Job { id: string; provider_id: string | null; base_model: string; fine_tuned_model: string | null; status: string; examples_count: number; error: string | null; created_at: string }

const PRESETS = [
  { name: 'OpenAI', base_url: 'https://api.openai.com/v1', model: 'gpt-4o-mini-2024-07-18' },
  { name: 'Groq', base_url: 'https://api.groq.com/openai/v1', model: 'openai/gpt-oss-120b' },
  { name: 'Gemini', base_url: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-2.5-flash' },
  { name: 'OpenRouter', base_url: 'https://openrouter.ai/api/v1', model: 'openai/gpt-4o-mini' },
  { name: 'DeepSeek', base_url: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  { name: 'Together', base_url: 'https://api.together.xyz/v1', model: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Reference' },
];

async function callAdmin(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('ai-admin', { body });
  if (error) throw new Error(await getFunctionErrorMessage(error));
  if (data?.error) throw new Error(data.error);
  return data;
}

export function AIProvidersCard() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [subjects, setSubjects] = useState<{ id: string; name_uz: string }[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', base_url: '', model: '', api_key: '' });
  const [ft, setFt] = useState({ provider_id: '', base_model: '', subject_id: '' });

  const load = useCallback(async () => {
    const [p, j, s] = await Promise.all([
      supabase.from('ai_providers').select('id,name,base_url,model,is_active').order('created_at'),
      supabase.from('ai_finetune_jobs').select('*').order('created_at', { ascending: false }).limit(20),
      supabase.from('subjects').select('id,name_uz').order('name_uz'),
    ]);
    setProviders((p.data ?? []) as Provider[]);
    setJobs((j.data ?? []) as Job[]);
    setSubjects(s.data ?? []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const add = async () => {
    if (!form.name || !form.base_url || !form.model || !form.api_key) return toast.error("Barcha maydonlarni to'ldiring");
    setBusy('add');
    const { error } = await supabase.from('ai_providers').insert(form);
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success("Provayder qo'shildi");
    setForm({ name: '', base_url: '', model: '', api_key: '' });
    load();
  };

  const activate = async (p: Provider | null) => {
    setBusy(p?.id ?? 'default');
    await supabase.from('ai_providers').update({ is_active: false }).eq('is_active', true);
    if (p) {
      const { error } = await supabase.from('ai_providers').update({ is_active: true }).eq('id', p.id);
      if (error) toast.error(error.message);
    }
    setBusy(null);
    toast.success(p ? `${p.name} faollashtirildi` : 'Standart AI ishlatiladi');
    load();
  };

  const remove = async (p: Provider) => {
    if (!window.confirm(`${p.name} o'chirilsinmi?`)) return;
    await supabase.from('ai_providers').delete().eq('id', p.id);
    load();
  };

  const updateModel = async (p: Provider, model: string) => {
    if (!model || model === p.model) return;
    const { error } = await supabase.from('ai_providers').update({ model }).eq('id', p.id);
    if (error) toast.error(error.message); else { toast.success('Model yangilandi'); load(); }
  };

  const test = async (p: Provider) => {
    setBusy(p.id);
    try {
      const r = await callAdmin({ action: 'test', provider_id: p.id });
      r.ok ? toast.success(`Ishlayapti (${r.ms} ms): ${r.reply}`) : toast.error(`Xato ${r.status}: ${r.error}`);
    } catch (e: any) { toast.error(e.message); }
    setBusy(null);
  };

  const startFt = async () => {
    if (!ft.provider_id) return toast.error('Provayderni tanlang');
    setBusy('ft');
    try {
      const r = await callAdmin({ action: 'finetune_start', provider_id: ft.provider_id, base_model: ft.base_model || undefined, subject_id: ft.subject_id || undefined });
      toast.success(`O'qitish boshlandi: ${r.job.examples_count} ta namuna`);
      load();
    } catch (e: any) { toast.error(e.message); }
    setBusy(null);
  };

  const jobAction = async (j: Job, action: 'finetune_status' | 'finetune_apply') => {
    setBusy(j.id);
    try {
      await callAdmin({ action, job_id: j.id });
      toast.success(action === 'finetune_apply' ? "O'qitilgan model provayderga o'rnatildi" : 'Holat yangilandi');
      load();
    } catch (e: any) { toast.error(e.message); }
    setBusy(null);
  };

  const anyActive = providers.some((p) => p.is_active);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2"><Bot className="h-6 w-6 text-primary" /> AI provayderlar va o'qitish</h1>

      <Card>
        <CardHeader><CardTitle className="text-base">Provayderlar</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div><p className="font-semibold">Standart AI</p><p className="text-xs text-muted-foreground">Hech biri faol bo'lmasa ishlatiladi</p></div>
            {!anyActive ? <Badge>Faol</Badge> : <Button size="sm" variant="outline" onClick={() => activate(null)}>Faollashtirish</Button>}
          </div>
          {providers.map((p) => (
            <div key={p.id} className="rounded-lg border p-3 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold">{p.name} {p.is_active && <Badge className="ml-1">Faol</Badge>}</p>
                  <p className="text-xs text-muted-foreground truncate">{p.base_url}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => test(p)} disabled={busy === p.id}>
                    {busy === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4 mr-1" />} Sinash
                  </Button>
                  {!p.is_active && <Button size="sm" onClick={() => activate(p)}><CheckCircle2 className="h-4 w-4 mr-1" /> Faollashtirish</Button>}
                  <Button size="sm" variant="ghost" onClick={() => remove(p)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-xs shrink-0">Model</Label>
                <Input defaultValue={p.model} className="h-8 text-sm" onBlur={(e) => updateModel(p, e.target.value.trim())} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Yangi provayder qo'shish</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((pr) => (
              <Button key={pr.name} size="sm" variant="outline" onClick={() => setForm((f) => ({ ...f, ...pr }))}>{pr.name}</Button>
            ))}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div><Label>Nomi</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Model</Label><Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} /></div>
            <div className="md:col-span-2"><Label>API manzili (OpenAI-mos)</Label><Input value={form.base_url} onChange={(e) => setForm({ ...form, base_url: e.target.value })} placeholder="https://api.example.com/v1" /></div>
            <div className="md:col-span-2"><Label>API kalit</Label><Input type="password" value={form.api_key} onChange={(e) => setForm({ ...form, api_key: e.target.value })} /></div>
          </div>
          <Button onClick={add} disabled={busy === 'add'}>{busy === 'add' ? <Loader2 className="h-4 w-4 animate-spin" /> : "Qo'shish"}</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><GraduationCap className="h-4 w-4 text-primary" /> AI ni o'qitish (fine-tune)</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Savollar bazasidagi savollar namunaga aylantirilib, provayderga yuboriladi va sizning modelingiz o'qitiladi.
            Bu OpenAI va Together kabi o'qitishni qo'llaydigan provayderlarda ishlaydi (pullik, odatda 10 daqiqadan bir necha soatgacha). Kamida 10 ta savol kerak.
          </p>
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <Label>Provayder</Label>
              <select className="w-full h-10 rounded-md border bg-background px-3 text-sm" value={ft.provider_id} onChange={(e) => setFt({ ...ft, provider_id: e.target.value })}>
                <option value="">Tanlang</option>
                {providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <Label>Fan</Label>
              <select className="w-full h-10 rounded-md border bg-background px-3 text-sm" value={ft.subject_id} onChange={(e) => setFt({ ...ft, subject_id: e.target.value })}>
                <option value="">Barcha fanlar</option>
                {subjects.map((s) => <option key={s.id} value={s.id}>{s.name_uz}</option>)}
              </select>
            </div>
            <div><Label>Asosiy model (ixtiyoriy)</Label><Input value={ft.base_model} onChange={(e) => setFt({ ...ft, base_model: e.target.value })} placeholder="gpt-4o-mini-2024-07-18" /></div>
          </div>
          <Button onClick={startFt} disabled={busy === 'ft'}>{busy === 'ft' ? <Loader2 className="h-4 w-4 animate-spin" /> : "O'qitishni boshlash"}</Button>

          {jobs.length > 0 && (
            <div className="space-y-2">
              {jobs.map((j) => (
                <div key={j.id} className="rounded-lg border p-3 text-sm space-y-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{j.base_model} · {j.examples_count} namuna</span>
                    <Badge variant={j.status === 'succeeded' ? 'default' : j.status === 'failed' ? 'destructive' : 'outline'}>{j.status}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{new Date(j.created_at).toLocaleString('uz-UZ')}</p>
                  {j.fine_tuned_model && <p className="text-xs font-mono break-all">{j.fine_tuned_model}</p>}
                  {j.error && <p className="text-xs text-destructive">{j.error}</p>}
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" variant="outline" onClick={() => jobAction(j, 'finetune_status')} disabled={busy === j.id}><RefreshCw className="h-4 w-4 mr-1" /> Holatni tekshirish</Button>
                    {j.fine_tuned_model && <Button size="sm" onClick={() => jobAction(j, 'finetune_apply')} disabled={busy === j.id}>Modelni ishlatish</Button>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
