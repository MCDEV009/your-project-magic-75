import { useEffect, useState } from 'react';
import { useLanguage } from '@/hooks/useLanguage';
import { supabase } from '@/integrations/supabase/client';
import { Test } from '@/types/test';
import { TestCard } from './TestCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

export function PublicTestList() {
  const { t } = useLanguage();
  const [tests, setTests] = useState<(Test & { question_count: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    async function fetchTests() {
      const { data, error } = await supabase
        .from('tests')
        .select(`
          *,
          subjects (*)
        `)
        .eq('visibility', 'public')
        .order('created_at', { ascending: false });

      if (!error && data) {
        // Get question counts for each test
        const testsWithCounts = await Promise.all(
          data.map(async (test) => {
            const { count } = await supabase
              .from('questions')
              .select('*', { count: 'exact', head: true })
              .eq('test_id', test.id);
            return { ...test, question_count: count || 0 };
          })
        );
        setTests(testsWithCounts as (Test & { question_count: number })[]);
      }
      setLoading(false);
    }

    fetchTests();
  }, []);

  const filteredTests = tests.filter((test) =>
    test.title_uz.toLowerCase().includes(searchQuery.toLowerCase()) ||
    test.title_ru?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    test.title_en?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <section className="py-16 bg-muted/30">
      <div className="test-container">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <h2 className="text-2xl font-bold">{t('publicTests')}</h2>
          <div className="relative max-w-xs w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Qidirish..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {loading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-48 rounded-xl" />
            ))}
          </div>
        ) : filteredTests.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredTests.map((test) => (
              <TestCard key={test.id} test={test} questionCount={test.question_count} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <p>{t('noTestsAvailable')}</p>
          </div>
        )}
      </div>
    </section>
  );
}
