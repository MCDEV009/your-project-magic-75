import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BarChart3, HelpCircle } from 'lucide-react';

interface QuestionStat {
  id: string;
  question_id: string;
  test_id: string;
  total_attempts: number;
  correct_count: number;
  incorrect_count: number;
  skipped_count: number;
  difficulty_score: number;
  question_text: string;
  test_name: string;
}

export function QuestionAnalyticsTable() {
  const [stats, setStats] = useState<QuestionStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [tests, setTests] = useState<{ id: string; title_uz: string }[]>([]);
  const [selectedTest, setSelectedTest] = useState<string>('all');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [{ data: analyticsData }, { data: testsData }] = await Promise.all([
      supabase.from('question_analytics').select('*').order('difficulty_score', { ascending: false }),
      supabase.from('tests').select('id, title_uz').order('created_at', { ascending: false }),
    ]);

    if (testsData) setTests(testsData);

    if (analyticsData && analyticsData.length > 0) {
      // Fetch question texts
      const qIds = analyticsData.map((a: any) => a.question_id);
      const { data: questions } = await supabase
        .from('questions')
        .select('id, question_text_uz, test_id')
        .in('id', qIds);

      const qMap = new Map((questions || []).map((q: any) => [q.id, q]));
      const tMap = new Map((testsData || []).map((t: any) => [t.id, t.title_uz]));

      const mapped: QuestionStat[] = analyticsData.map((a: any) => {
        const q = qMap.get(a.question_id);
        return {
          ...a,
          question_text: q?.question_text_uz?.substring(0, 80) || 'N/A',
          test_name: tMap.get(a.test_id) || 'N/A',
        };
      });
      setStats(mapped);
    }
    setLoading(false);
  };

  const getDifficultyBadge = (score: number) => {
    if (score >= 0.7) return <Badge variant="destructive">Qiyin</Badge>;
    if (score >= 0.4) return <Badge variant="secondary">O'rta</Badge>;
    return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Oson</Badge>;
  };

  const filtered = selectedTest === 'all' ? stats : stats.filter(s => s.test_id === selectedTest);

  return (
    <Card className="shadow-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <HelpCircle className="h-5 w-5 text-primary" />
            Savollar statistikasi
          </CardTitle>
          <Select value={selectedTest} onValueChange={setSelectedTest}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Barcha testlar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Barcha testlar</SelectItem>
              {tests.map(t => (
                <SelectItem key={t.id} value={t.id}>{t.title_uz}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-12" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <BarChart3 className="h-12 w-12 mx-auto mb-2 opacity-30" />
            <p>Hali statistika yo'q</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Savol</TableHead>
                  <TableHead>Urinishlar</TableHead>
                  <TableHead>To'g'ri</TableHead>
                  <TableHead>Noto'g'ri</TableHead>
                  <TableHead>Qiyinlik</TableHead>
                  <TableHead>Daraja</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(stat => {
                  const correctPct = stat.total_attempts > 0 ? (stat.correct_count / stat.total_attempts) * 100 : 0;
                  return (
                    <TableRow key={stat.id}>
                      <TableCell className="max-w-[250px]">
                        <div className="truncate text-sm">{stat.question_text}</div>
                        <div className="text-xs text-muted-foreground truncate">{stat.test_name}</div>
                      </TableCell>
                      <TableCell>{stat.total_attempts}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-green-600">{stat.correct_count}</span>
                          <Progress value={correctPct} className="w-16 h-1.5" />
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-destructive">{stat.incorrect_count}</TableCell>
                      <TableCell>
                        <span className="text-sm font-mono">{(stat.difficulty_score * 100).toFixed(0)}%</span>
                      </TableCell>
                      <TableCell>{getDifficultyBadge(stat.difficulty_score)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
