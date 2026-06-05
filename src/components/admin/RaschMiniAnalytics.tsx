import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Calendar, BarChart3 } from 'lucide-react';

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