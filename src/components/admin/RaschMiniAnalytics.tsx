import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Calendar, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { toast } from 'sonner';

interface Row {
  test_id: string;
  title: string;
  attempts: number;
  unique_participants: number;
  avg_score: number;
  sunday_redemptions: number;
  is_sunday_free: boolean;
}

export function RaschMiniAnalytics() {
  const [rows, setRows] = useState<Row[] | null>(null);

  const downloadCsv = (filename: string, header: string[], data: (string | number)[][]) => {
    const esc = (v: any) => {
      const s = String(v ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [header.map(esc).join(','), ...data.map(r => r.map(esc).join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const exportStats = () => {
    if (!rows || rows.length === 0) { toast.error("Ma'lumot yo'q"); return; }
    downloadCsv(
      `rasch-stats-${new Date().toISOString().slice(0,10)}.csv`,
      ['test_id','title','attempts','unique_participants','avg_score','sunday_redemptions','is_sunday_free'],
      rows.map(r => [r.test_id, r.title, r.attempts, r.unique_participants, Number(r.avg_score).toFixed(2), r.sunday_redemptions, r.is_sunday_free ? 1 : 0]),
    );
  };

  const exportSundayLog = async () => {
    const { data, error } = await (supabase as any)
      .from('sunday_free_redemptions')
      .select('id, user_id, test_id, redeemed_at, weekday_tashkent')
      .order('redeemed_at', { ascending: false });
    if (error) { toast.error(error.message); return; }
    if (!data?.length) { toast.error("Yozuvlar yo'q"); return; }
    downloadCsv(
      `sunday-free-redemptions-${new Date().toISOString().slice(0,10)}.csv`,
      ['id','user_id','test_id','redeemed_at','weekday_tashkent'],
      data.map((r: any) => [r.id, r.user_id, r.test_id, r.redeemed_at, r.weekday_tashkent]),
    );
  };

  useEffect(() => {
    (async () => {
      const { data, error } = await (supabase.rpc as any)('admin_test_stats');
      if (!error) setRows((data || []) as Row[]);
      else setRows([]);
    })();
  }, []);

  const totalSunday = (rows || []).reduce((s, r) => s + (r.sunday_redemptions || 0), 0);
  const totalAttempts = (rows || []).reduce((s, r) => s + (r.attempts || 0), 0);
  const avgOfAvg = rows && rows.length
    ? rows.reduce((s, r) => s + Number(r.avg_score || 0), 0) / rows.length
    : 0;

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          Rasch & Yakshanba bepul — mini analitika
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={exportStats}>
            <Download className="h-3.5 w-3.5 mr-1" /> Rasch statistikani CSV
          </Button>
          <Button size="sm" variant="outline" onClick={exportSundayLog}>
            <Download className="h-3.5 w-3.5 mr-1" /> Yakshanba loglarni CSV
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border p-3">
            <div className="text-xs text-muted-foreground">Jami urinishlar</div>
            <div className="text-2xl font-bold">{totalAttempts}</div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-xs text-muted-foreground">O'rtacha Rasch ball</div>
            <div className="text-2xl font-bold">{avgOfAvg.toFixed(1)}</div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3 w-3" /> Yakshanba bepul ochilgan
            </div>
            <div className="text-2xl font-bold">{totalSunday}</div>
          </div>
        </div>

        {rows === null ? (
          <Skeleton className="h-32" />
        ) : rows.length === 0 ? (
          <div className="text-sm text-muted-foreground py-4 text-center">Ma'lumot yo'q</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Test</TableHead>
                <TableHead className="text-right">Urinishlar</TableHead>
                <TableHead className="text-right">Ishtirokchi</TableHead>
                <TableHead className="text-right">O'rtacha ball</TableHead>
                <TableHead className="text-right">Yakshanba</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.slice(0, 10).map(r => (
                <TableRow key={r.test_id}>
                  <TableCell className="font-medium flex items-center gap-2">
                    {r.title}
                    {r.is_sunday_free && (
                      <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
                        Yak. bepul
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{r.attempts}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.unique_participants}</TableCell>
                  <TableCell className="text-right tabular-nums">{Number(r.avg_score).toFixed(1)}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.sunday_redemptions}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}