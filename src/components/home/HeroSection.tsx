import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/hooks/useLanguage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowRight, Lock } from 'lucide-react';

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
    <section className="relative overflow-hidden border-b py-16 lg:py-24">
      {/* Quiet graph-paper texture — the one deliberate motif, used once */}
      <div className="grid-paper absolute inset-0 -z-10 [mask-image:linear-gradient(to_bottom,black,transparent)]" />

      <div className="test-container">
        <div className="grid gap-12 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
          <div>
            <p className="mb-3 text-sm font-medium text-muted-foreground">
              Milliy Sertifikat imtihoniga tayyorgarlik
            </p>

            <h1 className="max-w-xl text-4xl leading-tight sm:text-5xl">
              Imtihon kunidan oldin, imtihon kabi mashq qiling
            </h1>

            <p className="mt-6 max-w-lg text-lg text-muted-foreground">
              Har bir mock test — 35 ta yopiq savol va 10 ta yozma savol — Milliy Sertifikat
              imtihonining aniq nusxasi. Barcha umumta'lim fanlari bo'yicha: matematika,
              fizika, kimyo, biologiya, tarix, geografiya, ona tili va adabiyot, huquqshunoslik,
              boshlang'ich ta'lim, musiqa madaniyati va chet tili. Yozma javoblaringizni AI baholaydi.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" onClick={() => navigate('/tests')} className="h-12 px-6">
                {t('publicTests')}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>

            {/* Structured like an exam cover sheet, not an icon badge row */}
            <dl className="mt-10 grid max-w-lg grid-cols-3 divide-x divide-border border-y">
              <div className="py-4 pr-4">
                <dt className="text-xs text-muted-foreground">Savollar</dt>
                <dd className="mt-1 font-serif text-2xl text-foreground">35 + 10</dd>
              </div>
              <div className="py-4 px-4">
                <dt className="text-xs text-muted-foreground">Fanlar</dt>
                <dd className="mt-1 font-serif text-2xl text-foreground">12</dd>
              </div>
              <div className="py-4 pl-4">
                <dt className="text-xs text-muted-foreground">Baholash</dt>
                <dd className="mt-1 font-serif text-2xl text-foreground">AI</dd>
              </div>
            </dl>
          </div>

          {/* Private test code entry — framed as an access panel, not a floating card */}
          <div className="border bg-card p-6 shadow-card">
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
              />
              <Button onClick={handlePrivateTest} disabled={testCode.length !== 5}>
                <ArrowRight className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
