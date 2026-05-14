import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ShieldAlert, Home, ArrowLeft } from 'lucide-react';

export default function Forbidden() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="mx-auto w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center">
          <ShieldAlert className="h-10 w-10 text-destructive" />
        </div>
        <div>
          <h1 className="text-6xl font-bold text-destructive">403</h1>
          <h2 className="text-2xl font-semibold mt-2">Ruxsat berilmagan</h2>
          <p className="text-muted-foreground mt-2">
            Sizda bu sahifani ko'rish uchun yetarli huquq mavjud emas.
            Agar bu xato bo'lsa, administrator bilan bog'laning.
          </p>
        </div>
        <div className="flex gap-3 justify-center">
          <Button variant="outline" onClick={() => navigate(-1)} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Orqaga
          </Button>
          <Button onClick={() => navigate('/')} className="gap-2">
            <Home className="h-4 w-4" /> Bosh sahifa
          </Button>
        </div>
      </div>
    </div>
  );
}