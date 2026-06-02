import { useEffect, useState } from 'react';
import { useLanguage } from '@/hooks/useLanguage';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Test } from '@/types/test';
import { TestCard } from './TestCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

type TestWithMeta = Test & {
  question_count: number;
  price_uzs?: number;
  is_free?: boolean;
  purchased?: boolean;
};

export function PublicTestList() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [tests, setTests] = useState<TestWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    async function fetchTests() {
      const { data, error } = await supabase
        .from('tests')
        .select(`
          *,
          subjects (*),
          test_pricing (price_uzs, is_free)
        `)
        .in('visibility', ['public', 'paid'])
        .order('created_at', { ascending: false });

      if (!error && data) {
        // Fetch user's purchases if logged in
        let purchasedIds = new Set<string>();
        if (user) {
          const { data: purchases } = await supabase
            .from('test_purchases')
            .select('test_id')
            .eq('user_id', user.id);
          purchasedIds = new Set((purchases ?? []).map((p: any) => p.test_id));
        }
        // Get question counts for each test
        const testsWithCounts = await Promise.all(
          data.map(async (test) => {
            const { count } = await supabase
              .from('questions')
              .select('*', { count: 'exact', head: true })
              .eq('test_id', test.id);
            const pricing = Array.isArray((test as any).test_pricing)
              ? (test as any).test_pricing[0]
              : (test as any).test_pricing;
            return {
              ...test,
              question_count: count || 0,
              price_uzs: pricing?.price_uzs,
              is_free: pricing?.is_free,
              purchased: purchasedIds.has(test.id),
            };
          })
        );
        setTests(testsWithCounts as TestWithMeta[]);
      }
      setLoading(false);
    }

    fetchTests();
  }, [user?.id]);

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
              <TestCard
                key={test.id}
                test={test}
                questionCount={test.question_count}
                priceUzs={test.price_uzs}
                isFree={test.is_free}
                purchased={test.purchased}
              />
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
