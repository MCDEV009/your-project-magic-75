import { LanguageProvider, useLanguage } from '@/hooks/useLanguage';
import { Header } from '@/components/layout/Header';
import { PublicTestList } from '@/components/home/PublicTestList';

function TestsPageContent() {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen flex flex-col">
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
