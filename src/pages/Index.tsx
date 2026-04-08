import { LanguageProvider } from '@/hooks/useLanguage';
import { Header } from '@/components/layout/Header';
import { HeroSection } from '@/components/home/HeroSection';
import { PublicTestList } from '@/components/home/PublicTestList';

const Index = () => {
  return (
    <LanguageProvider>
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1">
          <HeroSection />
          <PublicTestList />
        </main>
        <footer className="border-t py-8">
          <div className="test-container text-center text-sm text-muted-foreground">
            <p>© 2026 TestHub. Barcha huquqlar himoyalangan.</p>
          </div>
        </footer>
      </div>
    </LanguageProvider>
  );
};

export default Index;
