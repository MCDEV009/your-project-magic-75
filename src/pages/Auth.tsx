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
