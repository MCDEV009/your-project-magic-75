import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LanguageProvider, useLanguage } from '@/hooks/useLanguage';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Mail, Lock, User, Loader2, AlertTriangle, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';
import { lovable } from '@/integrations/lovable';

const emailSchema = z.string().email('Noto\'g\'ri email formati');
const passwordSchema = z.string().min(6, 'Parol kamida 6 ta belgidan iborat bo\'lishi kerak');

function AuthContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();
  const { user, isAdmin, loading: authLoading } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  // Check for admin-required redirect
  const state = location.state as { adminRequired?: boolean; notAuthorized?: boolean } | null;
  const adminRequired = state?.adminRequired;
  const notAuthorized = state?.notAuthorized;

  // Redirect if already logged in
  useEffect(() => {
    if (!authLoading && user) {
      if (adminRequired && isAdmin) {
        navigate('/urecheater');
      } else if (!adminRequired) {
        navigate('/dashboard');
      }
    }
  }, [user, isAdmin, authLoading, adminRequired, navigate]);

  const validateInputs = () => {
    const newErrors: { email?: string; password?: string } = {};
    
    const emailResult = emailSchema.safeParse(email);
    if (!emailResult.success) {
      newErrors.email = emailResult.error.errors[0].message;
    }
    
    const passwordResult = passwordSchema.safeParse(password);
    if (!passwordResult.success) {
      newErrors.password = passwordResult.error.errors[0].message;
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validateInputs()) return;
    
    setLoading(true);
    
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password
    });
    
    if (error) {
      if (error.message.includes('Invalid login')) {
        toast.error('Email yoki parol noto\'g\'ri');
      } else if (error.message.includes('Email not confirmed')) {
        toast.error('Emailingizni tasdiqlang');
      } else {
        toast.error(error.message);
      }
      setLoading(false);
    } else {
      toast.success('Muvaffaqiyatli kirdingiz!');
      // Redirect will happen via useEffect
    }
  };

  const handleSignup = async () => {
    if (!validateInputs()) return;
    if (!fullName.trim()) {
      toast.error('Iltimos, ismingizni kiriting');
      return;
    }
    
    setLoading(true);
    
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName.trim()
        }
      }
    });
    
    if (error) {
      if (error.message.includes('already registered')) {
        toast.error('Bu email allaqachon ro\'yxatdan o\'tgan');
      } else {
        toast.error(error.message);
      }
    } else {
      toast.success('Ro\'yxatdan o\'tdingiz! Emailingizni tasdiqlang.');
    }
    
    setLoading(false);
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth('google', {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        toast.error(result.error.message || 'Google orqali kirishda xatolik');
        setLoading(false);
        return;
      }
      if (result.redirected) return;
    } catch (e: any) {
      toast.error(e?.message || 'Google orqali kirishda xatolik');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 flex items-center justify-center p-4">
        <Card className="max-w-md w-full shadow-elevated">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">{t('login')}</CardTitle>
            <CardDescription>
              {adminRequired ? 'Admin paneliga kirish uchun' : 'Hisobingizga kiring yoki ro\'yxatdan o\'ting'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {notAuthorized && (
              <Alert variant="destructive">
                <ShieldAlert className="h-4 w-4" />
                <AlertDescription>
                  Faqat administratorlar uchun. Sizda admin huquqlari yo'q.
                </AlertDescription>
              </Alert>
            )}
            
            {adminRequired && !notAuthorized && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Admin paneliga kirish uchun tizimga kiring.
                </AlertDescription>
              </Alert>
            )}
            
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="login">Kirish</TabsTrigger>
                <TabsTrigger value="signup">Ro'yxatdan o'tish</TabsTrigger>
              </TabsList>
              
              <TabsContent value="login" className="space-y-4">
                <div className="space-y-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleGoogleLogin}
                    disabled={loading}
                    className="w-full gap-2"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                    Google orqali kirish
                  </Button>
                </div>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">yoki email bilan</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-email" className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Email
                  </Label>
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="email@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={errors.email ? 'border-destructive' : ''}
                    onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                  />
                  {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="login-password" className="flex items-center gap-2">
                    <Lock className="h-4 w-4" />
                    Parol
                  </Label>
                  <Input
                    id="login-password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={errors.password ? 'border-destructive' : ''}
                    onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                  />
                  {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
                </div>
                
                <Button 
                  onClick={handleLogin}
                  disabled={loading}
                  className="w-full gradient-primary border-0 shadow-soft hover:shadow-glow transition-shadow"
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t('login')}
                </Button>
              </TabsContent>
              
              <TabsContent value="signup" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-name" className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    To'liq ism
                  </Label>
                  <Input
                    id="signup-name"
                    type="text"
                    placeholder="Ism Familiya"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="signup-email" className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Email
                  </Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="email@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={errors.email ? 'border-destructive' : ''}
                  />
                  {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="signup-password" className="flex items-center gap-2">
                    <Lock className="h-4 w-4" />
                    Parol
                  </Label>
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={errors.password ? 'border-destructive' : ''}
                  />
                  {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
                </div>
                
                <Button 
                  onClick={handleSignup}
                  disabled={loading}
                  className="w-full gradient-primary border-0 shadow-soft hover:shadow-glow transition-shadow"
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Ro'yxatdan o'tish
                </Button>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

export default function Auth() {
  return (
    <LanguageProvider>
      <AuthContent />
    </LanguageProvider>
  );
}
