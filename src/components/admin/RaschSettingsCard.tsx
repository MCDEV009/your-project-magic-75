import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Sliders, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export function RaschSettingsCard() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ prior_mean: 0.5, prior_strength: 4, p_min: 0.05, p_max: 0.95 });

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any).from('rasch_settings').select('*').eq('id', true).maybeSingle();
      if (data) setForm({
        prior_mean: Number(data.prior_mean),
        prior_strength: Number(data.prior_strength),
        p_min: Number(data.p_min),
        p_max: Number(data.p_max),
      });
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    if (form.p_min < 0 || form.p_max > 1 || form.p_min >= form.p_max) {
      toast.error("p_min < p_max bo'lishi va [0,1] oraliqda bo'lishi shart");
      return;
    }
    if (form.prior_strength <= 0 || form.prior_mean < 0 || form.prior_mean > 1) {
      toast.error('prior_mean ∈ [0,1], prior_strength > 0');
      return;
    }
    setSaving(true);
    const { error } = await (supabase as any).from('rasch_settings').update({
      ...form, updated_at: new Date().toISOString(),
    }).eq('id', true);
    setSaving(false);
    if (error) toast.error(error.message); else toast.success('Saqlandi');
  };

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Sliders className="h-5 w-5 text-primary" />
          Rasch / Bayes shrinkage sozlamalari
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          p = (correct + prior_mean × prior_strength) / (total + prior_strength), clamp [p_min … p_max]
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>prior_mean</Label>
            <Input type="number" step="0.01" min={0} max={1} value={form.prior_mean}
              onChange={(e) => setForm(f => ({ ...f, prior_mean: Number(e.target.value) }))} disabled={loading} />
          </div>
          <div className="space-y-1">
            <Label>prior_strength</Label>
            <Input type="number" step="1" min={0.1} value={form.prior_strength}
              onChange={(e) => setForm(f => ({ ...f, prior_strength: Number(e.target.value) }))} disabled={loading} />
          </div>
          <div className="space-y-1">
            <Label>p_min</Label>
            <Input type="number" step="0.01" min={0} max={1} value={form.p_min}
              onChange={(e) => setForm(f => ({ ...f, p_min: Number(e.target.value) }))} disabled={loading} />
          </div>
          <div className="space-y-1">
            <Label>p_max</Label>
            <Input type="number" step="0.01" min={0} max={1} value={form.p_max}
              onChange={(e) => setForm(f => ({ ...f, p_max: Number(e.target.value) }))} disabled={loading} />
          </div>
        </div>
        <Button onClick={save} disabled={saving || loading}>
          {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Saqlash
        </Button>
      </CardContent>
    </Card>
  );
}