import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Trophy, Medal } from 'lucide-react';

interface StudentRanking {
  id: string;
  participant_id: string;
  full_name: string;
  total_tests: number;
  total_score: number;
  avg_score: number;
  best_score: number;
  grade: string;
  last_test_at: string;
}

export function StudentRankingsTable() {
  const [rankings, setRankings] = useState<StudentRanking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRankings();

    const channel = supabase
      .channel('rankings-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'student_rankings' }, () => {
        fetchRankings();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchRankings = async () => {
    const { data } = await supabase
      .from('student_rankings')
      .select('*')
      .order('avg_score', { ascending: false })
      .limit(50);

    if (data) setRankings(data as StudentRanking[]);
    setLoading(false);
  };

  const getRankIcon = (index: number) => {
    if (index === 0) return <Trophy className="h-4 w-4 text-yellow-500" />;
    if (index === 1) return <Medal className="h-4 w-4 text-gray-400" />;
    if (index === 2) return <Medal className="h-4 w-4 text-amber-700" />;
    return <span className="text-sm text-muted-foreground font-mono w-4 text-center">{index + 1}</span>;
  };

  const getGradeColor = (score: number) => {
    if (score >= 80) return 'bg-green-500/10 text-green-600 border-green-500/20';
    if (score >= 60) return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20';
    return 'bg-red-500/10 text-red-600 border-red-500/20';
  };

  return (
    <Card className="shadow-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Trophy className="h-5 w-5 text-primary" />
          Talabalar reytingi
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-12" />)}
          </div>
        ) : rankings.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Trophy className="h-12 w-12 mx-auto mb-2 opacity-30" />
            <p>Hali reyting ma'lumotlari yo'q</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Ism</TableHead>
                  <TableHead>Testlar</TableHead>
                  <TableHead>O'rtacha</TableHead>
                  <TableHead>Eng yaxshi</TableHead>
                  <TableHead>Oxirgi test</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rankings.map((r, i) => (
                  <TableRow key={r.id}>
                    <TableCell>{getRankIcon(i)}</TableCell>
                    <TableCell className="font-medium">{r.full_name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{r.total_tests}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={getGradeColor(r.avg_score)}>
                        {r.avg_score.toFixed(1)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm font-mono">{r.best_score.toFixed(1)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.last_test_at ? new Date(r.last_test_at).toLocaleDateString('uz-UZ') : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
