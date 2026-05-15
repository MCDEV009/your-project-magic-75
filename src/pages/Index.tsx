import { LanguageProvider } from '@/hooks/useLanguage';
import { Helmet } from 'react-helmet-async';
import { Header } from '@/components/layout/Header';
import { HeroSection } from '@/components/home/HeroSection';
import { PublicTestList } from '@/components/home/PublicTestList';

const Index = () => {
  return (
    <LanguageProvider>
      <Helmet>
        <title>Milliy Sertifikat — Online mock testlar va AI tahlil</title>
        <meta name="description" content="Milliy Sertifikat imtihoniga tayyorlanish uchun online mock testlar, Rasch model bo'yicha baholash va AI yordamida shaxsiy tahlil." />
        <link rel="canonical" href="https://msmocktest.lovable.app/" />
        <meta property="og:title" content="Milliy Sertifikat — Online mock testlar va AI tahlil" />
        <meta property="og:description" content="Milliy Sertifikat imtihoniga tayyorlanish uchun online mock testlar va AI tahlil." />
        <meta property="og:url" content="https://msmocktest.lovable.app/" />
        <meta property="og:type" content="website" />
      </Helmet>
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
