 import { Link, useNavigate } from 'react-router-dom';
 import { useLanguage } from '@/hooks/useLanguage';
 import { LanguageSelector } from '@/components/ui/LanguageSelector';
 import { ThemeToggle } from '@/components/ui/ThemeToggle';
 import { Button } from '@/components/ui/button';
 import { GraduationCap, LogIn, LogOut, User, LayoutDashboard } from 'lucide-react';
 import { useAuth } from '@/hooks/useAuth';

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
              <GraduationCap className="h-5 w-5 text-primary-foreground" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-lg tracking-tight leading-tight">Milliy Sertifikat</span>
              <span className="text-[10px] text-muted-foreground leading-tight">Mock Platform</span>
            </div>
          </Link>

          <div className="flex items-center gap-2">
             <ThemeToggle />
            <LanguageSelector />
            {user && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/dashboard')}
                className="gap-2"
              >
                <LayoutDashboard className="h-4 w-4" />
                <span className="hidden sm:inline">Kabinet</span>
              </Button>
            )}
            {user && (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-muted rounded-full text-sm">
                <User className="h-4 w-4" />
                <span className="truncate max-w-[120px]">{user.email}</span>
              </div>
            )}
            <Button
              variant={user ? "outline" : "default"}
              size="sm"
              onClick={handleAuth}
              className={user ? "gap-2" : "gap-2 gradient-primary border-0 shadow-soft hover:shadow-glow transition-shadow"}
            >
              {user ? (
                <>
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">{t('logout')}</span>
                </>
              ) : (
                <>
                  <LogIn className="h-4 w-4" />
                  <span className="hidden sm:inline">{t('login')}</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
