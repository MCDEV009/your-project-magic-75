import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/hooks/useLanguage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowRight, Lock } from 'lucide-react';
import { RaschSurface } from './RaschSurface';

export function HeroSection() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [testCode, setTestCode] = useState('');

  const handlePrivateTest = () => {
    if (testCode.length === 5) {
      navigate(`/enter/${testCode}`);
    }
  };

  return (
    <section className="home-hero relative isolate overflow-hidden border-b py-12 lg:py-16">
      <RaschSurface />

      <div className="test-container">
        <div className="relative z-10 grid gap-10 lg:grid-cols-[1.35fr_0.65fr] lg:items-end">
          <div>
            <p className="mb-5 flex items-center gap-2 text-sm font-medium text-accent">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              Milliy Sertifikat imtihoniga tayyorgarlik
            </p>

            <h1 className="max-w-2xl text-3xl leading-tight sm:text-5xl">
              Milliy Sertifikat
            </h1>

            <p className="mt-4 max-w-lg text-xl font-medium text-foreground">
              Imtihon kunidan oldin, imtihon kabi mashq qiling.
            </p>
            <p className="mt-4 max-w-lg text-base leading-relaxed text-muted-foreground">
              Barcha milliy sertifikat fanlari bo‘yicha mock testlar.
              Yozma javoblar uchun AI baholash va Rasch modeli asosida natijalar.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" onClick={() => navigate('/tests')} className="h-12 px-6">
                {t('publicTests')}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button size="lg" variant="outline" onClick={() => navigate('/live')} className="h-12 px-6">
                Live imtihon <ArrowRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Structured like an exam cover sheet, not an icon badge row */}
            <dl className="mt-10 grid max-w-lg grid-cols-3 divide-x divide-border border-y">
              <div className="py-4 pr-4">
                <dt className="text-xs text-muted-foreground">Savollar</dt>
                <dd className="mt-1 font-serif text-2xl text-warning">35 + 10</dd>
              </div>
              <div className="py-4 px-4">
                <dt className="text-xs text-muted-foreground">Fanlar</dt>
                <dd className="mt-1 font-serif text-2xl text-warning">12</dd>
              </div>
              <div className="py-4 pl-4">
                <dt className="text-xs text-muted-foreground">Baholash</dt>
                <dd className="mt-1 font-serif text-2xl text-accent">AI</dd>
              </div>
            </dl>
          </div>

          {/* Private test code entry — framed as an access panel, not a floating card */}
          <form className="rounded-lg border bg-card/90 p-5 backdrop-blur-md" onSubmit={(event) => { event.preventDefault(); handlePrivateTest(); }}>
            <div className="mb-4 flex items-center gap-2 text-muted-foreground">
              <Lock className="h-4 w-4" />
              <span className="text-sm font-medium">{t('privateTest')}</span>
            </div>
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder={t('enterTestCode5')}
                value={testCode}
                onChange={(e) => setTestCode(e.target.value.replace(/\D/g, '').slice(0, 5))}
                className="text-center text-lg font-mono tracking-widest"
                maxLength={5}
                aria-label={t('enterTestCode5')}
              />
              <Button type="submit" disabled={testCode.length !== 5} aria-label={t('privateTest')}>
                <ArrowRight className="h-5 w-5" />
              </Button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
