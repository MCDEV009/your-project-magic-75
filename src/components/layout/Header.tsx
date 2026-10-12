 import { Link, NavLink, useNavigate } from 'react-router-dom';
 import { useLanguage } from '@/hooks/useLanguage';
 import { LanguageSelector } from '@/components/ui/LanguageSelector';
 import { ThemeToggle } from '@/components/ui/ThemeToggle';
 import { Button } from '@/components/ui/button';
import { LogIn, LogOut, LayoutDashboard, Wallet as WalletIcon } from 'lucide-react';
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
    <header className="site-header sticky top-0 z-50 border-b">
      <div className="test-container">
        <div className="flex min-h-20 flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-accent/50 text-accent">
              <BrandMark className="h-6 w-6" />
            </div>
            <div className="flex flex-col">
              <span className="font-serif text-xs sm:text-sm font-semibold leading-tight text-foreground">ALKHARAZMIY XYZ</span>
              <span className="text-[11px] leading-tight text-muted-foreground">Barcha milliy sertifikat fanlari</span>
            </div>
          </Link>

          <div className="flex items-center gap-1 sm:gap-2">
             <ThemeToggle />
            <LanguageSelector />
            {user && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/dashboard')}
                 aria-label="Kabinet"
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
            <Button
              variant={user ? "outline" : "default"}
              size="icon"
              onClick={handleAuth}
               aria-label={user ? t('logout') : t('login')}
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
          <nav aria-label="Asosiy navigatsiya" className="order-last flex w-full items-center gap-1 overflow-x-auto border-t border-border/60 pt-2 lg:order-none lg:w-auto lg:border-0 lg:pt-0">
            {[
              { to: '/', label: 'Bosh sahifa' },
              { to: '/tests', label: t('publicTests') },
              { to: '/live', label: 'Live imtihon' },
              { to: '/pricing', label: 'Tariflar' },
              { to: '/about', label: t('about') },
            ].map((item) => <Button key={item.to} asChild variant="ghost" size="sm" className="shrink-0 rounded-none text-muted-foreground"><NavLink end={item.to === '/'} to={item.to} className="site-nav-link">{item.label}</NavLink></Button>)}
          </nav>
        </div>
      </div>
    </header>
  );
}
