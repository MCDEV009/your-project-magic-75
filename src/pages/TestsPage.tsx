import { LanguageProvider, useLanguage } from '@/hooks/useLanguage';
import { Helmet } from 'react-helmet-async';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Header } from '@/components/layout/Header';
import { PublicTestList } from '@/components/home/PublicTestList';

function TestsPageContent() {
  const { t } = useLanguage();
  const [testNames, setTestNames] = useState<string[]>([]);

  useEffect(() => {
    supabase
      .from('tests')
      .select('title_uz')
      .eq('visibility', 'public')
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data }) => {
        if (data) setTestNames(data.map((t: any) => t.title_uz).filter(Boolean));
      });
  }, []);

  const itemListLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Milliy Sertifikat mock testlari',
    itemListElement: testNames.map((name, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name,
    })),
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Helmet>
        <title>Mock testlar ro'yxati — Milliy Sertifikat</title>
        <meta name="description" content="Milliy Sertifikat platformasidagi barcha ochiq mock testlar ro'yxati. Imtihonga tayyorlaning va AI tahlilini oling." />
        <link rel="canonical" href="https://msmocktest.lovable.app/tests" />
        <meta property="og:title" content="Mock testlar ro'yxati — Milliy Sertifikat" />
        <meta property="og:description" content="Barcha ochiq Milliy Sertifikat mock testlari bir joyda." />
        <meta property="og:url" content="https://msmocktest.lovable.app/tests" />
        <meta property="og:type" content="website" />
        {testNames.length > 0 && (
          <script type="application/ld+json">{JSON.stringify(itemListLd)}</script>
        )}
      </Helmet>
      <Header />
      <main className="flex-1">
        <section className="py-12">
          <div className="test-container">
            <h1 className="text-3xl font-bold mb-2">{t('publicTests')}</h1>
            <p className="text-muted-foreground mb-8">
              Barcha mavjud testlar ro'yxati
            </p>
          </div>
        </section>
        <PublicTestList />
      </main>
    </div>
  );
}

export default function TestsPage() {
  return (
    <LanguageProvider>
      <TestsPageContent />
    </LanguageProvider>
  );
}
