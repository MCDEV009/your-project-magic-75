import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, Sparkles, Crown, Zap } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { LanguageProvider } from '@/hooks/useLanguage';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const PLANS = [
  {
    id: 'free' as const,
    name: 'Free',
    price: 0,
    yearlyPrice: 0,
    icon: Zap,
    perks: [
      'Oyiga 1 ta mock test',
      "10 ta AI tahlil so'rovi",
      '3 ta rasm yuklash',
      'Asosiy natija ko\'rinishi',
    ],
  },
  {
    id: 'pro' as const,
    name: 'Pro',
    price: 24000,
    yearlyPrice: 240000,
    icon: Sparkles,
    highlight: true,
    perks: [
      'Oyiga 5 ta mock test',
      "100 ta AI tahlil so'rovi",
      '30 ta rasm yuklash',
      "Batafsil AI tahlil",
    ],
  },
  {
    id: 'premium' as const,
    name: 'Premium',
    price: 95000,
    yearlyPrice: 950000,
    icon: Crown,
    perks: [
      'Oyiga 25 ta mock test',
      "Oyiga 250 ta AI tahlil so'rovi",
      "Oyiga 50 ta rasm yuklash",
      "AI Test tahlili",
      "Mashq testlariga kirish",
      "Shaxsiy statistika va progress kuzatuvi",
      "PDF natijalarni eksport qilish",
    ],
  },
];

function PricingContent() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [comingSoon, setComingSoon] = useState<{ plan: string; price: number } | null>(null);
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly');

  const handleSelect = async (planId: 'free' | 'pro' | 'premium', price: number) => {
    if (!user) {
      toast.info("Iltimos, avval tizimga kiring");
      navigate('/auth');
      return;
    }
    if (planId === 'free') {
      toast.success('Siz Free tarifdan foydalanmoqdasiz');
      return;
    }
    // Record pending payment
    await (supabase.from('plan_payments') as any).insert({
      user_id: user.id,
      plan: planId,
      amount: price,
      currency: 'UZS',
      status: 'pending',
      provider: 'coming_soon',
    });
    setComingSoon({ plan: planId, price });
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Helmet>
        <title>Tariflar — Milliy Sertifikat</title>
        <meta name="description" content="Milliy Sertifikat tariflari: Free, Pro va Premium. Oylik mock testlar, AI tahlil va rasm yuklash limitlari bilan o'zingizga mos rejani tanlang." />
        <link rel="canonical" href="https://msmocktest.lovable.app/pricing" />
        <meta property="og:title" content="Tariflar — Milliy Sertifikat" />
        <meta property="og:description" content="Free, Pro va Premium rejalar. Mock testlar va AI tahlil uchun." />
        <meta property="og:url" content="https://msmocktest.lovable.app/pricing" />
        <meta property="og:type" content="website" />
        <script type="application/ld+json">{JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          itemListElement: PLANS.map((p, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            item: {
              '@type': 'Product',
              name: `Milliy Sertifikat ${p.name}`,
              description: p.perks.join('. '),
              offers: {
                '@type': 'Offer',
                price: p.price,
                priceCurrency: 'UZS',
                availability: 'https://schema.org/PreOrder',
                url: 'https://msmocktest.lovable.app/pricing',
              },
            },
          })),
        })}</script>
      </Helmet>
      <Header />
      <main className="flex-1 container mx-auto px-4 py-12">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold mb-3">Tariflar</h1>
          <p className="text-muted-foreground">O'zingizga mos rejani tanlang. Istalgan vaqtda o'zgartirishingiz mumkin.</p>
          <div className="mt-6 flex justify-center">
            <Tabs value={billing} onValueChange={(v) => setBilling(v as 'monthly' | 'yearly')}>
              <TabsList>
                <TabsTrigger value="monthly">Oylik</TabsTrigger>
                <TabsTrigger value="yearly">Yillik <Badge variant="secondary" className="ml-2">2 oy bepul</Badge></TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {PLANS.map((p) => {
            const Icon = p.icon;
            const displayPrice = billing === 'yearly' ? p.yearlyPrice : p.price;
            const periodLabel = billing === 'yearly' ? '/yil' : '/oy';
            return (
              <Card key={p.id} className={p.highlight ? 'border-primary shadow-elevated relative' : 'shadow-card'}>
                {p.highlight && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">Eng mashhur</Badge>
                )}
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Icon className="h-5 w-5 text-primary" />
                    <CardTitle>{p.name}</CardTitle>
                  </div>
                  <CardDescription>
                    <span className="text-3xl font-bold text-foreground">
                      {displayPrice === 0 ? 'Bepul' : `${displayPrice.toLocaleString('uz-UZ')} so'm`}
                    </span>
                    {displayPrice > 0 && <span className="text-muted-foreground">{periodLabel}</span>}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-2">
                    {p.perks.map((perk) => (
                      <li key={perk} className="flex items-start gap-2 text-sm">
                        <Check className="h-4 w-4 text-success mt-0.5 shrink-0" />
                        <span>{perk}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    onClick={() => handleSelect(p.id, displayPrice)}
                    className="w-full"
                    variant={p.highlight ? 'default' : 'outline'}
                  >
                    {displayPrice === 0 ? 'Joriy reja' : "Tanlash"}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <p className="text-center text-sm text-muted-foreground mt-10">
          Yopiq testlar o'rniga endi <strong>pulli testlar</strong> mavjud — har bir mock atigi <strong>10 000 so'm</strong>.
        </p>

        <Dialog open={!!comingSoon} onOpenChange={(v) => !v && setComingSoon(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>To'lov tizimi tez orada</DialogTitle>
              <DialogDescription>
                <strong>{comingSoon?.plan?.toUpperCase()}</strong> rejasi ({comingSoon?.price.toLocaleString('uz-UZ')} so'm) uchun
                so'rovingiz qabul qilindi. To'lov usuli (Click / Payme / Uzum)
                tez orada qo'shiladi. Tayyor bo'lganda sizga xabar beramiz.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={() => setComingSoon(null)}>Tushundim</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}

export default function Pricing() {
  return (
    <LanguageProvider>
      <PricingContent />
    </LanguageProvider>
  );
}