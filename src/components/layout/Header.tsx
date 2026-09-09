 import { Link, useNavigate } from 'react-router-dom';
 import { useLanguage } from '@/hooks/useLanguage';
 import { LanguageSelector } from '@/components/ui/LanguageSelector';
 import { ThemeToggle } from '@/components/ui/ThemeToggle';
 import { Button } from '@/components/ui/button';
import { LogIn, LogOut, User, LayoutDashboard, Sparkles, Wallet as WalletIcon, Info } from 'lucide-react';
 import { useAuth } from '@/hooks/useAuth';

/** Custom mark: an open compass-triangle with an algebra crossbar — a nod to
    Al-Khwarizmi (father of algebra) rather than a generic stock icon. */
function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 3.5 L20 19.5 L4 19.5 Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
      <line x1="8.4" y1="14.5" x2="15.6" y2="14.5" stroke="hsl(var(--accent))" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="12" cy="3.5" r="1.1" fill="currentColor" />
    </svg>
  );
}

export function Header() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  const handleAuth = () => {
    if (user) {
      signOut();
      navigate('/');
    } else {
      navigate('/auth');
    }
  };

  return (
    <header className="sticky top-0 z-50 glass border-b">
      <div className="test-container">
        <div className="flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg gradient-primary shadow-soft group-hover:shadow-glow transition-shadow">
              <BrandMark className="h-5 w-5 text-primary-foreground" />
            </div>
            <div className="flex flex-col">
              <span className="font-serif text-lg font-bold leading-tight tracking-tight text-foreground">ALKHARAZMIY XYZ</span>
              <span className="text-[11px] leading-tight text-muted-foreground">Barcha milliy sertifikat fanlari</span>
            </div>
          </Link>

          <div className="flex items-center gap-1 sm:gap-2">
             <ThemeToggle />
            <LanguageSelector />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/pricing')}
              className="hidden sm:inline-flex gap-1.5"
            >
              <Sparkles className="h-4 w-4" />
              <span className="text-sm">Tariflar</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/about')}
              className="hidden sm:inline-flex gap-1.5"
            >
              <Info className="h-4 w-4" />
              <span className="text-sm">{t('about')}</span>
            </Button>
            {user && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/dashboard')}
                className="sm:gap-2 sm:w-auto sm:px-3"
              >
                <LayoutDashboard className="h-4 w-4" />
                <span className="hidden sm:inline text-sm">Kabinet</span>
              </Button>
            )}
            {user && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/wallet')}
                className="sm:gap-2 sm:w-auto sm:px-3"
                aria-label="Hamyon"
              >
                <WalletIcon className="h-4 w-4" />
                <span className="hidden sm:inline text-sm">Hamyon</span>
              </Button>
            )}
            {user && (
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-muted rounded-full text-sm">
                <User className="h-4 w-4" />
                <span className="truncate max-w-[120px]">{user.email}</span>
              </div>
            )}
            <Button
              variant={user ? "outline" : "default"}
              size="icon"
              onClick={handleAuth}
              className={user ? "sm:gap-2 sm:w-auto sm:px-3" : "sm:gap-2 sm:w-auto sm:px-3 gradient-primary border-0 shadow-soft hover:shadow-glow transition-shadow"}
            >
              {user ? (
                <>
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline text-sm">{t('logout')}</span>
                </>
              ) : (
                <>
                  <LogIn className="h-4 w-4" />
                  <span className="hidden sm:inline text-sm">{t('login')}</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
