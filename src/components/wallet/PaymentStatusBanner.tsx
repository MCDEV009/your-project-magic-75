import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CheckCircle2, Clock, XCircle, X, RotateCcw } from 'lucide-react';
import { format } from 'date-fns';
import { usePaymentNotifications, type PaymentNotice } from '@/hooks/usePaymentNotifications';

const money = (n: number, c = 'UZS') =>
  new Intl.NumberFormat('uz-UZ').format(Number(n || 0)) + ' ' + c;

const providerLabel = (p: string) =>
  p === 'manual' ? 'Karta orqali' : p === 'payme' ? 'Payme' : p === 'click' ? 'Click' : p;

function Row({ notice, onDismiss }: { notice: PaymentNotice; onDismiss: (n: PaymentNotice) => void }) {
  const map = {
    pending: {
      Icon: Clock,
      tone: 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400',
      title: 'To\u2018lov tasdiqlanishi kutilmoqda',
      desc: 'Admin tasdiqlaganidan so\u2018ng balans avtomatik yangilanadi.',
    },
    paid: {
      Icon: CheckCircle2,
      tone: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
      title: 'To\u2018lov tasdiqlandi',
      desc: 'Mablag\u2018 balansingizga qo\u2018shildi.',
    },
    failed: {
      Icon: XCircle,
      tone: 'border-destructive/40 bg-destructive/10 text-destructive',
      title: 'To\u2018lov rad etildi',
      desc: 'Iltimos, to\u2018lovni qayta yuboring yoki admin bilan bog\u2018laning.',
    },
    cancelled: {
      Icon: XCircle,
      tone: 'border-destructive/40 bg-destructive/10 text-destructive',
      title: 'To\u2018lov bekor qilindi',
      desc: 'So\u2018rovingiz bekor qilindi.',
    },
    refunded: {
      Icon: RotateCcw,
      tone: 'border-sky-500/40 bg-sky-500/10 text-sky-600 dark:text-sky-400',
      title: 'To\u2018lov qaytarildi',
      desc: 'Mablag\u2018 hisobingizdan yechildi.',
    },
  } as const;

  const cfg = map[notice.status];
  const Icon = cfg.Icon;

  return (
    <Card className={`flex items-start gap-3 p-3 sm:p-4 border ${cfg.tone}`}>
      <Icon className={`h-5 w-5 mt-0.5 shrink-0 ${notice.status === 'pending' ? 'animate-pulse' : ''}`} />
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm text-foreground">
          {cfg.title} — {money(notice.amount, notice.currency)}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{cfg.desc}</p>
        <p className="text-[11px] text-muted-foreground mt-1">
          {providerLabel(notice.provider)} • {format(new Date(notice.paid_at ?? notice.created_at), 'dd.MM.yyyy HH:mm')}
        </p>
      </div>
      <Button
        variant="ghost" size="icon" className="h-7 w-7 shrink-0"
        aria-label="Yopish" onClick={() => onDismiss(notice)}
      >
        <X className="h-4 w-4" />
      </Button>
    </Card>
  );
}

export function PaymentStatusBanner() {
  const { pending, resolved, dismiss } = usePaymentNotifications();
  const notices = [...pending, ...resolved];
  if (notices.length === 0) return null;

  return (
    <div className="space-y-2">
      {notices.map((n) => (
        <Row key={n.id} notice={n} onDismiss={(x) => dismiss(x.id, x.status)} />
      ))}
    </div>
  );
}
