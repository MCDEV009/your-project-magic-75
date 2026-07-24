import { LanguageProvider, useLanguage } from '@/hooks/useLanguage';
import { Helmet } from 'react-helmet-async';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  GraduationCap,
  FileQuestion,
  PenLine,
  BrainCircuit,
  Users,
  Clock,
  ShieldCheck,
  ArrowRight,
  Target,
  BarChart3,
  Globe,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

function AboutContent() {
  const { t } = useLanguage();
  const navigate = useNavigate();

  const features = [
    {
      icon: FileQuestion,
      title: 'Haqiqiy imtihon formati',
      description:
        'Har bir test 35 ta yopiq savoldan va 10 ta ochiq yozma savoldan iborat — Milliy Sertifikat imtihonining to\'liq analogi.',
    },
    {
      icon: BrainCircuit,
      title: 'Sun\'iy intellekt yordami',
      description:
        'Yozma javoblarni AI baholaydi, kuchli va zaif tomonlaringizni aniqlaydi va shaxsiy tavsiyalar beradi.',
    },
    {
      icon: BarChart3,
      title: 'Rasch modeli asosida baholash',
      description:
        'Savollarning qiyinlik darajasi inobatga olinib, har bir to\'g\'ri javob uchun mos ball beriladi.',
    },
    {
      icon: Globe,
      title: 'Ko\'p tillilik',
      description:
        'Platforma o\'zbek, rus, ingliz va qoraqalpoq tillarida ishlaydi — barcha foydalanuvchilar uchun qulay.',
    },
    {
      icon: Users,
      title: 'Jonli mock imtihonlar',
      description:
        'Bir vaqtda minglab ishtirokchilar bilan jonli sessiyalarda raqobat qiling va natijalarni real vaqtda kuzating.',
    },
    {
      icon: ShieldCheck,
      title: 'Xavfsiz va shaffof',
      description:
        'Test materiallari va foydalanuvchi ma\'lumotlari zamonaviy RLS va autentifikatsiya bilan himoyalangan.',
    },
  ];

  const steps = [
    {
      number: '01',
      title: 'Ro\'yxatdan o\'ting',
      description: 'Email orqali tez va bepul akkaunt yarating.',
    },
    {
      number: '02',
      title: 'Test tanlang',
      description: 'Ochiq testlar ro\'yxatidan yoki 5 xonali yopiq kod orqali testni toping.',
    },
    {
      number: '03',
      title: 'Topshiring va tahlil qiling',
      description: 'Testni yakunlang, natijalarni ko\'ring va AI tahlili bilan o\'z ustingizda ishlang.',
    },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <Helmet>
        <title>Loyiha haqida — Milliy Sertifikat</title>
        <meta
          name="description"
          content="Milliy Sertifikat mock test platformasi haqida: imtihon formati, AI tahlil, Rasch baholash, jonli testlar va ko'p tilli qo'llab-quvvatlash."
        />
        <link rel="canonical" href="https://msmocktest.lovable.app/about" />
        <meta property="og:title" content="Loyiha haqida — Milliy Sertifikat" />
        <meta
          property="og:description"
          content="Milliy Sertifikat imtihoniga tayyorlanish uchun online mock testlar, AI tahlil va Rasch modeli."
        />
        <meta property="og:url" content="https://msmocktest.lovable.app/about" />
        <meta property="og:type" content="website" />
      </Helmet>

      <Header />

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden py-20 lg:py-28">
          <div className="absolute inset-0 -z-10">
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
            <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
          </div>

          <div className="test-container">
            <div className="mx-auto max-w-3xl text-center animate-fade-in">
              <Badge variant="secondary" className="mb-6 gap-1.5 px-4 py-1.5 text-sm">
                <GraduationCap className="h-4 w-4" />
                Milliy Sertifikat Mock Platformasi
              </Badge>

              <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl mb-6 text-balance">
                Platforma <span className="gradient-text">haqida</span>
              </h1>

              <p className="text-xl text-muted-foreground mb-10 text-balance max-w-2xl mx-auto">
                Bu loyiha O\'zbekiston Milliy Sertifikat imtihoniga tayyorlanayotgan abituriyentlar va
                til bilish darajasini oshirmoqchi bo\'lgan barcha uchun yaratilgan.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button
                  size="lg"
                  onClick={() => navigate('/tests')}
                  className="gradient-primary border-0 shadow-soft hover:shadow-glow transition-all text-lg px-8 h-14"
                >
                  {t('publicTests')}
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => navigate('/pricing')}
                  className="text-lg px-8 h-14"
                >
                  Tariflar
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Mission */}
        <section className="py-16 lg:py-24 border-y bg-muted/30">
          <div className="test-container">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="text-3xl font-bold mb-4">Maqsadimiz</h2>
                <p className="text-lg text-muted-foreground text-balance mb-6">
                  Har bir foydalanuvchiga haqiqiy imtihon sharoitini yaratib, uning bilim darajasini
                  obyektiv baholash va o\'sish yo\'nalishlarini aniq ko\'rsatish.
                </p>
                <ul className="space-y-4">
                  <li className="flex items-start gap-3">
                    <Target className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                    <span>Imtihon formatiga maksimal yaqin test tajribasi</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Clock className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                    <span>Vaqt chegaralari bilan real imtihon mashqi</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <BrainCircuit className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                    <span>AI yordamida shaxsiy o\'quv rejasi</span>
                  </li>
                </ul>
              </div>
              <Card className="p-8 gradient-card shadow-card border">
                <div className="grid grid-cols-2 gap-6 text-center">
                  <div>
                    <div className="text-3xl font-extrabold gradient-text">35+10</div>
                    <div className="text-sm text-muted-foreground mt-1">savol formati</div>
                  </div>
                  <div>
                    <div className="text-3xl font-extrabold gradient-text">4</div>
                    <div className="text-sm text-muted-foreground mt-1">til</div>
                  </div>
                  <div>
                    <div className="text-3xl font-extrabold gradient-text">AI</div>
                    <div className="text-sm text-muted-foreground mt-1">tahlil</div>
                  </div>
                  <div>
                    <div className="text-3xl font-extrabold gradient-text">24/7</div>
                    <div className="text-sm text-muted-foreground mt-1">mavjudlik</div>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="py-16 lg:py-24">
          <div className="test-container">
            <div className="text-center max-w-2xl mx-auto mb-12">
              <h2 className="text-3xl font-bold mb-4">Nimalarni taklif qilamiz?</h2>
              <p className="text-muted-foreground">
                Platforma imtihonga tayyorlanishning barcha bosqichlarini qamrab oladi.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.map((feature) => (
                <Card
                  key={feature.title}
                  className="p-6 gradient-card shadow-card border hover:shadow-elevated transition-shadow"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg gradient-primary mb-4">
                    <feature.icon className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="py-16 lg:py-24 bg-muted/30 border-y">
          <div className="test-container">
            <div className="text-center max-w-2xl mx-auto mb-12">
              <h2 className="text-3xl font-bold mb-4">Qanday ishlaydi?</h2>
              <p className="text-muted-foreground">
                Faqat 3 qadamda o\'z bilimingizni sinab ko\'ring.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {steps.map((step) => (
                <div key={step.number} className="relative">
                  <div className="text-5xl font-extrabold text-muted/40 mb-4">{step.number}</div>
                  <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
                  <p className="text-muted-foreground">{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20">
          <div className="test-container">
            <Card className="p-8 lg:p-12 text-center gradient-card shadow-elevated border overflow-hidden relative">
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-accent/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

              <div className="relative">
                <h2 className="text-3xl font-bold mb-4">Boshlashga tayyormisiz?</h2>
                <p className="text-muted-foreground max-w-xl mx-auto mb-8">
                  Bugun ochiq testlardan birini ishlab ko\'ring va imtihonga tayyorgarlikni yangi
                  darajaga olib chiqing.
                </p>
                <Button
                  size="lg"
                  onClick={() => navigate('/tests')}
                  className="gradient-primary border-0 shadow-soft hover:shadow-glow transition-all text-lg px-8 h-14"
                >
                  Testlarni ko\'rish
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </div>
            </Card>
          </div>
        </section>
      </main>

      <footer className="border-t py-8">
        <div className="test-container text-center text-sm text-muted-foreground">
          <p>© 2026 TestHub. Barcha huquqlar himoyalangan.</p>
        </div>
      </footer>
    </div>
  );
}

export default function About() {
  return (
    <LanguageProvider>
      <AboutContent />
    </LanguageProvider>
  );
}
