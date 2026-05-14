import { useState } from 'react';
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

const PLANS = [
  {
    id: 'free' as const,
    name: 'Free',
    price: 0,
    icon: Zap,
    perks: [
      'Oyiga 5 ta mock test',
      "10 ta AI tahlil so'rovi",
      '3 ta rasm yuklash',
      'Asosiy natija ko\'rinishi',
    ],
  },
  {
    id: 'pro' as const,
    name: 'Pro',
    price: 49000,
    icon: Sparkles,
    highlight: true,
    perks: [
      'Oyiga 30 ta mock test',
      "100 ta AI tahlil so'rovi",
      '30 ta rasm yuklash',
      "Batafsil AI tahlil va PDF eksport",
      "Mashq savollari yaratish",
    ],
  },
  {
    id: 'premium' as const,
    name: 'Premium',
    price: 99000,
    icon: Crown,
    perks: [
      'Cheksiz mock testlar',
      "Cheksiz AI tahlil",
      "Cheksiz rasm yuklash",
      "Ustuvor qo'llab-quvvatlash",
      "Custom test yaratish",
      'Barcha pulli testlarga kirish',
    ],
  },
];

export default function Pricing() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [comingSoon, setComingSoon] = useState<{ plan: string; price: number } | null>(null);

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
      <Header />
      <main className="flex-1 container mx-auto px-4 py-12">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold mb-3">Tariflar</h1>
          <p className="text-muted-foreground">O'zingizga mos rejani tanlang. Istalgan vaqtda o'zgartirishingiz mumkin.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {PLANS.map((p) => {
            const Icon = p.icon;
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
                      {p.price === 0 ? 'Bepul' : `${p.price.toLocaleString('uz-UZ')} so'm`}
                    </span>
                    {p.price > 0 && <span className="text-muted-foreground">/oy</span>}
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
                    onClick={() => handleSelect(p.id, p.price)}
                    className="w-full"
                    variant={p.highlight ? 'default' : 'outline'}
                  >
                    {p.price === 0 ? 'Joriy reja' : "Tanlash"}
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