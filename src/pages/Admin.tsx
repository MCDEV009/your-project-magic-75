import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LanguageProvider, useLanguage } from '@/hooks/useLanguage';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Test, Subject, Question } from '@/types/test';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  LayoutDashboard, 
  FileQuestion, 
  BarChart3, 
  Settings, 
  Plus, 
  Edit, 
  Trash2, 
  Copy, 
  Eye, 
  LogOut,
  Users,
  ClipboardList,
  TrendingUp,
  Lock,
  Globe,
  Download,
  Upload,
  BookOpen,
  ChevronLeft,
   ChevronRight,
   Moon,
   Sun
} from 'lucide-react';
import { toast } from 'sonner';
 import { useTheme } from 'next-themes';
import { AIAnalyticsDashboard } from '@/components/admin/AIAnalyticsDashboard';
import { QuestionAnalyticsTable } from '@/components/admin/QuestionAnalyticsTable';
import { StudentRankingsTable } from '@/components/admin/StudentRankingsTable';
import { AIAnalysisHistory } from '@/components/admin/AIAnalysisHistory';

function AdminContent() {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const { user, signOut, loading: authLoading } = useAuth();
   const { theme, setTheme } = useTheme();
  
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'tests' | 'analytics' | 'settings'>('dashboard');
  
  // Tests state
  const [tests, setTests] = useState<(Test & { question_count: number; attempt_count: number })[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [testsLoading, setTestsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const testsPerPage = 10;
  
  // Dialog states
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [questionDialogOpen, setQuestionDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedTest, setSelectedTest] = useState<Test | null>(null);
  const [testToDelete, setTestToDelete] = useState<Test | null>(null);
  
  // Test form
  const [testForm, setTestForm] = useState({
    title_uz: '',
    title_ru: '',
    title_en: '',
    description_uz: '',
    subject_id: '',
    visibility: 'public' as 'public' | 'private',
    duration_minutes: 150,
    allow_retry: false,
    randomize_questions: true,
    randomize_options: true,
    negative_marking: false,
    test_format: 'standard' as 'standard' | 'milliy_sertifikat',
    scheduled_start: ''
  });
  
  // Questions state
  const [questions, setQuestions] = useState<Question[]>([]);
  const [questionForm, setQuestionForm] = useState({
    question_text_uz: '',
    question_text_ru: '',
    options: ['', '', '', ''],
    correct_option: 0,
    image_url: ''
  });
  
  // Analytics state
  const [analytics, setAnalytics] = useState({
    totalTests: 0,
    totalParticipants: 0,
    averageScore: 0,
    successRate: 0
  });

  // Fetch data
  useEffect(() => {
    if (!user) return;
    
    async function fetchData() {
      setTestsLoading(true);
      
      // Fetch subjects
      const { data: subjectsData } = await supabase
        .from('subjects')
        .select('*')
        .order('name_uz');
      
      if (subjectsData) {
        setSubjects(subjectsData as Subject[]);
      }
      
      // Fetch tests with counts
      const { data: testsData } = await supabase
        .from('tests')
        .select('*, subjects(*)')
        .order('created_at', { ascending: false });
      
      if (testsData) {
        const testsWithCounts = await Promise.all(
          testsData.map(async (test) => {
            const { count: questionCount } = await supabase
              .from('questions')
              .select('*', { count: 'exact', head: true })
              .eq('test_id', test.id);
            
            const { count: attemptCount } = await supabase
              .from('test_attempts')
              .select('*', { count: 'exact', head: true })
              .eq('test_id', test.id);
            
            return {
              ...test,
              question_count: questionCount || 0,
              attempt_count: attemptCount || 0
            };
          })
        );
        setTests(testsWithCounts as (Test & { question_count: number; attempt_count: number })[]);
      }
      
      // Fetch analytics
      const { count: totalTests } = await supabase
        .from('tests')
        .select('*', { count: 'exact', head: true });
      
      const { count: totalParticipants } = await supabase
        .from('test_participants')
        .select('*', { count: 'exact', head: true });
      
      const { data: attemptsData } = await supabase
        .from('test_attempts')
        .select('score, total_questions, mcq_score, written_score')
        .eq('status', 'finished');
      
      let avgScore = 0;
      let successRate = 0;
      if (attemptsData && attemptsData.length > 0) {
        // Each attempt's percentage: score is raw points, total_questions is question count
        // We need to compute per-attempt percentage properly
        const percentages = attemptsData.map(a => {
          const total = a.total_questions || 0;
          const score = a.score || 0;
          return total > 0 ? (score / total) * 100 : 0;
        });
        avgScore = Math.round(percentages.reduce((acc, p) => acc + p, 0) / percentages.length);
        const passed = percentages.filter(p => p >= 60).length;
        successRate = Math.round((passed / attemptsData.length) * 100);
      }
      
      setAnalytics({
        totalTests: totalTests || 0,
        totalParticipants: totalParticipants || 0,
        averageScore: avgScore,
        successRate
      });
      
      setTestsLoading(false);
    }
    
    fetchData();
  }, [user]);

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  const handleCreateTest = async () => {
    if (!testForm.title_uz.trim()) {
      toast.error('Test nomini kiriting');
      return;
    }
    
    const { data, error } = await supabase
      .from('tests')
      .insert({
        ...testForm,
        subject_id: testForm.subject_id || null,
        scheduled_start: testForm.scheduled_start || null,
        created_by: user?.id
      })
      .select()
      .single();
    
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Test yaratildi');
      setTestDialogOpen(false);
      setTestForm({
        title_uz: '',
        title_ru: '',
        title_en: '',
        description_uz: '',
        subject_id: '',
        visibility: 'public',
        duration_minutes: 150,
        allow_retry: false,
        randomize_questions: true,
        randomize_options: true,
        negative_marking: false,
        test_format: 'standard',
        scheduled_start: ''
      });
      // Refresh tests
      window.location.reload();
    }
  };

  const handleDuplicateTest = async (test: Test) => {
    const { data: questionsData } = await supabase
      .from('questions')
      .select('*')
      .eq('test_id', test.id);
    
    const { data: newTest, error: testError } = await supabase
      .from('tests')
      .insert({
        title_uz: `${test.title_uz} (nusxa)`,
        title_ru: test.title_ru ? `${test.title_ru} (копия)` : null,
        title_en: test.title_en ? `${test.title_en} (copy)` : null,
        description_uz: test.description_uz,
        subject_id: test.subject_id,
        visibility: test.visibility,
        duration_minutes: test.duration_minutes,
        allow_retry: test.allow_retry,
        randomize_questions: test.randomize_questions,
        randomize_options: test.randomize_options,
        negative_marking: test.negative_marking,
        created_by: user?.id
      })
      .select()
      .single();
    
    if (testError || !newTest) {
      toast.error('Nusxalashda xatolik');
      return;
    }
    
    if (questionsData && questionsData.length > 0) {
      const newQuestions = questionsData.map((q) => ({
        test_id: newTest.id,
        question_text_uz: q.question_text_uz,
        question_text_ru: q.question_text_ru,
        question_text_en: q.question_text_en,
        image_url: q.image_url,
        options: q.options,
        correct_option: q.correct_option,
        points: q.points,
        order_index: q.order_index
      }));
      
      await supabase.from('questions').insert(newQuestions);
    }
    
    toast.success('Test nusxalandi');
    window.location.reload();
  };

  const handleDeleteTest = async () => {
    if (!testToDelete) return;
    
    const { error } = await supabase
      .from('tests')
      .delete()
      .eq('id', testToDelete.id);
    
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Test o\'chirildi');
      setTests(tests.filter(t => t.id !== testToDelete.id));
    }
    
    setDeleteDialogOpen(false);
    setTestToDelete(null);
  };

  const handleExportResults = async (testId: string) => {
    const { data: attempts } = await supabase
      .from('test_attempts')
      .select('*, test_participants(*)')
      .eq('test_id', testId)
      .eq('status', 'finished');
    
    if (!attempts || attempts.length === 0) {
      toast.error('Natijalar topilmadi');
      return;
    }
    
    const csvContent = [
      ['ID', 'Ism', 'Ball', 'To\'g\'ri javoblar', 'Jami savollar', 'Foiz', 'Sana'].join(','),
      ...attempts.map(a => [
        a.participant_id,
        (a.test_participants as { full_name: string })?.full_name || '',
        a.score,
        a.correct_answers,
        a.total_questions,
        a.total_questions > 0 ? Math.round((a.correct_answers / a.total_questions) * 100) : 0,
        new Date(a.finished_at || '').toLocaleString()
      ].join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `test_results_${testId}.csv`;
    link.click();
    
    toast.success('Natijalar yuklandi');
  };

  const handleImportQuestions = async (testId: string, jsonContent: string) => {
    try {
      const questionsData = JSON.parse(jsonContent);
      
      if (!Array.isArray(questionsData)) {
        throw new Error('JSON array bo\'lishi kerak');
      }
      
      const formattedQuestions = questionsData.map((q: { question: string; options: string[]; correct: number }, i: number) => ({
        test_id: testId,
        question_text_uz: q.question,
        options: q.options,
        correct_option: q.correct,
        points: 1,
        order_index: i
      }));
      
      const { error } = await supabase
        .from('questions')
        .insert(formattedQuestions);
      
      if (error) throw error;
      
      toast.success(`${formattedQuestions.length} ta savol qo'shildi`);
    } catch (error) {
      toast.error('JSON format noto\'g\'ri');
    }
  };

  // Pagination
  const totalPages = Math.ceil(tests.length / testsPerPage);
  const paginatedTests = tests.slice(
    (currentPage - 1) * testsPerPage,
    currentPage * testsPerPage
  );

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">{t('loading')}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 bg-sidebar border-r flex flex-col">
        <div className="p-4 border-b">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg gradient-primary">
              <BookOpen className="h-5 w-5 text-primary-foreground" />
            </div>
             <span className="font-bold text-sidebar-foreground">TestHub Admin</span>
          </div>
        </div>
        
        <nav className="flex-1 p-4 space-y-1">
           {/* Theme Toggle */}
           <button
             onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
             className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-sidebar-foreground hover:bg-sidebar-accent/50 mb-2"
           >
             {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
             {theme === 'dark' ? t('lightMode') : t('darkMode')}
           </button>
           
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors
              ${activeTab === 'dashboard' ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-sidebar-foreground hover:bg-sidebar-accent/50'}
            `}
          >
            <LayoutDashboard className="h-4 w-4" />
            {t('dashboard')}
          </button>
          
          <button
            onClick={() => setActiveTab('tests')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors
              ${activeTab === 'tests' ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-sidebar-foreground hover:bg-sidebar-accent/50'}
            `}
          >
            <FileQuestion className="h-4 w-4" />
            {t('manageTests')}
          </button>
          
          <button
            onClick={() => setActiveTab('analytics')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors
              ${activeTab === 'analytics' ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-sidebar-foreground hover:bg-sidebar-accent/50'}
            `}
          >
            <BarChart3 className="h-4 w-4" />
            {t('analytics')}
          </button>
        </nav>
        
        <div className="p-4 border-t">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
              <Users className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.email}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleLogout} className="w-full gap-2">
            <LogOut className="h-4 w-4" />
            {t('logout')}
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="p-8">
          {/* Dashboard */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6 animate-fade-in">
              <h1 className="text-2xl font-bold">{t('dashboard')}</h1>
              
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card className="shadow-card">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-lg bg-primary/10">
                        <ClipboardList className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{analytics.totalTests}</p>
                        <p className="text-sm text-muted-foreground">{t('totalTests')}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="shadow-card">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-lg bg-accent/10">
                        <Users className="h-6 w-6 text-accent" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{analytics.totalParticipants}</p>
                        <p className="text-sm text-muted-foreground">{t('totalParticipants')}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="shadow-card">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-lg bg-success/10">
                        <TrendingUp className="h-6 w-6 text-success" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{analytics.averageScore}%</p>
                        <p className="text-sm text-muted-foreground">{t('averageScore')}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="shadow-card">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-lg bg-warning/10">
                        <BarChart3 className="h-6 w-6 text-warning" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{analytics.successRate}%</p>
                        <p className="text-sm text-muted-foreground">{t('successRate')}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
              
              <Card className="shadow-card">
                <CardHeader>
                  <CardTitle className="text-lg">So'nggi testlar</CardTitle>
                </CardHeader>
                <CardContent>
                  {testsLoading ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map(i => <Skeleton key={i} className="h-12" />)}
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Test nomi</TableHead>
                          <TableHead>Savollar</TableHead>
                          <TableHead>Ishtirokchilar</TableHead>
                          <TableHead>Holat</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tests.slice(0, 5).map(test => (
                          <TableRow key={test.id}>
                            <TableCell className="font-medium">{test.title_uz}</TableCell>
                            <TableCell>{test.question_count}</TableCell>
                            <TableCell>{test.attempt_count}</TableCell>
                            <TableCell>
                              <Badge variant={test.visibility === 'public' ? 'default' : 'secondary'}>
                                {test.visibility === 'public' ? <Globe className="h-3 w-3 mr-1" /> : <Lock className="h-3 w-3 mr-1" />}
                                {test.visibility === 'public' ? t('public') : t('private')}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Tests management */}
          {activeTab === 'tests' && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">{t('manageTests')}</h1>
                <Dialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="gap-2 gradient-primary border-0">
                      <Plus className="h-4 w-4" />
                      {t('createTest')}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>{t('createTest')}</DialogTitle>
                      <DialogDescription>Yangi test yaratish</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>{t('testTitle')} (O'zbekcha) *</Label>
                          <Input
                            value={testForm.title_uz}
                            onChange={(e) => setTestForm({ ...testForm, title_uz: e.target.value })}
                            placeholder="Test nomi"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>{t('testTitle')} (Ruscha)</Label>
                          <Input
                            value={testForm.title_ru}
                            onChange={(e) => setTestForm({ ...testForm, title_ru: e.target.value })}
                            placeholder="Название теста"
                          />
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Tavsif</Label>
                        <Textarea
                          value={testForm.description_uz}
                          onChange={(e) => setTestForm({ ...testForm, description_uz: e.target.value })}
                          placeholder="Test haqida qisqacha..."
                        />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>{t('subject')}</Label>
                          <Select
                            value={testForm.subject_id}
                            onValueChange={(value) => setTestForm({ ...testForm, subject_id: value })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Fan tanlang" />
                            </SelectTrigger>
                            <SelectContent>
                              {subjects.map(subject => (
                                <SelectItem key={subject.id} value={subject.id}>
                                  {subject.name_uz}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div className="space-y-2">
                          <Label>{t('duration')}</Label>
                          <Input
                            type="number"
                            value={testForm.duration_minutes}
                            onChange={(e) => setTestForm({ ...testForm, duration_minutes: parseInt(e.target.value) || 30 })}
                            min={1}
                          />
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label>{t('visibility')}</Label>
                        <Select
                          value={testForm.visibility}
                          onValueChange={(value: 'public' | 'private') => setTestForm({ ...testForm, visibility: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="public">
                              <div className="flex items-center gap-2">
                                <Globe className="h-4 w-4" />
                                {t('public')}
                              </div>
                            </SelectItem>
                            <SelectItem value="private">
                              <div className="flex items-center gap-2">
                                <Lock className="h-4 w-4" />
                                {t('private')}
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Test formati</Label>
                        <Select
                          value={testForm.test_format}
                          onValueChange={(value: 'standard' | 'milliy_sertifikat') => setTestForm({ ...testForm, test_format: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="standard">
                              Oddiy test
                            </SelectItem>
                            <SelectItem value="milliy_sertifikat">
                              Milliy Sertifikat (35 test + 10 yozma)
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          Milliy Sertifikat formatida 35 ta test savoli va 10 ta yozma savol bo'ladi
                        </p>
                      </div>

                      {/* Scheduled start time */}
                      <div className="space-y-2">
                        <Label>Boshlanish vaqti (jadval)</Label>
                        <Input
                          type="datetime-local"
                          value={testForm.scheduled_start}
                          onChange={(e) => setTestForm({ ...testForm, scheduled_start: e.target.value })}
                        />
                        <p className="text-xs text-muted-foreground">
                          Test aniq vaqtda boshlanadi. Ishtirokchilar 30 daqiqa oldin ro'yxatdan o'tishlari shart.
                        </p>
                      </div>
                      
                      <div className="space-y-4 pt-4 border-t">
                        <h4 className="font-medium">Sozlamalar</h4>
                        <div className="flex items-center justify-between">
                          <Label>Qayta topshirishga ruxsat</Label>
                          <Switch
                            checked={testForm.allow_retry}
                            onCheckedChange={(checked) => setTestForm({ ...testForm, allow_retry: checked })}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label>Savollarni aralashtirish</Label>
                          <Switch
                            checked={testForm.randomize_questions}
                            onCheckedChange={(checked) => setTestForm({ ...testForm, randomize_questions: checked })}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label>Javoblarni aralashtirish</Label>
                          <Switch
                            checked={testForm.randomize_options}
                            onCheckedChange={(checked) => setTestForm({ ...testForm, randomize_options: checked })}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label>Manfiy baho (noto'g'ri javoblar uchun)</Label>
                          <Switch
                            checked={testForm.negative_marking}
                            onCheckedChange={(checked) => setTestForm({ ...testForm, negative_marking: checked })}
                          />
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setTestDialogOpen(false)}>
                        {t('cancel')}
                      </Button>
                      <Button onClick={handleCreateTest} className="gradient-primary border-0">
                        {t('save')}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
              
              <Card className="shadow-card">
                <CardContent className="pt-6">
                  {testsLoading ? (
                    <div className="space-y-3">
                      {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-16" />)}
                    </div>
                  ) : (
                    <>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Test nomi</TableHead>
                            <TableHead>Fan</TableHead>
                            <TableHead>Savollar</TableHead>
                            <TableHead>Ishtirokchilar</TableHead>
                            <TableHead>Holat</TableHead>
                            <TableHead>Kod</TableHead>
                            <TableHead className="text-right">Amallar</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paginatedTests.map(test => {
                            const subjectName = test.subjects ? test.subjects.name_uz : '-';
                            
                            return (
                              <TableRow key={test.id}>
                                <TableCell className="font-medium max-w-[200px] truncate">
                                  {test.title_uz}
                                </TableCell>
                                <TableCell>{subjectName}</TableCell>
                                <TableCell>{test.question_count}</TableCell>
                                <TableCell>{test.attempt_count}</TableCell>
                                <TableCell>
                                  <Badge variant={test.visibility === 'public' ? 'default' : 'secondary'}>
                                    {test.visibility === 'public' ? t('public') : t('private')}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  {test.test_code && (
                                    <code className="px-2 py-0.5 bg-muted rounded text-xs font-mono">
                                      {test.test_code}
                                    </code>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center justify-end gap-1">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => navigate(`/urecheater/test/${test.id}`)}
                                      title="Savollarni tahrirlash"
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleDuplicateTest(test)}
                                      title="Nusxalash"
                                    >
                                      <Copy className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleExportResults(test.id)}
                                      title="Natijalarni yuklab olish"
                                    >
                                      <Download className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => {
                                        setTestToDelete(test);
                                        setDeleteDialogOpen(true);
                                      }}
                                      className="text-destructive hover:text-destructive"
                                      title="O'chirish"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                      
                      {totalPages > 1 && (
                        <div className="flex items-center justify-between pt-4 border-t mt-4">
                          <p className="text-sm text-muted-foreground">
                            {((currentPage - 1) * testsPerPage) + 1}-{Math.min(currentPage * testsPerPage, tests.length)} / {tests.length}
                          </p>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                              disabled={currentPage === 1}
                            >
                              <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                              disabled={currentPage === totalPages}
                            >
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Analytics */}
          {activeTab === 'analytics' && (
            <div className="space-y-6 animate-fade-in">
              <h1 className="text-2xl font-bold">{t('analytics')}</h1>
              
              {/* AI Analytics Dashboard */}
              <AIAnalyticsDashboard />

              {/* Question Analytics */}
              <QuestionAnalyticsTable />

              {/* Student Rankings */}
              <StudentRankingsTable />

              <div className="grid gap-6 lg:grid-cols-2">
                <Card className="shadow-card">
                  <CardHeader>
                    <CardTitle className="text-lg">Fanlar bo'yicha statistika</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {subjects.map(subject => {
                        const subjectTests = tests.filter(t => t.subject_id === subject.id);
                        const totalAttempts = subjectTests.reduce((acc, t) => acc + t.attempt_count, 0);
                        
                        return (
                          <div key={subject.id} className="flex items-center justify-between">
                            <span>{subject.name_uz}</span>
                            <div className="flex items-center gap-3">
                              <Badge variant="outline">{subjectTests.length} test</Badge>
                              <Badge variant="secondary">{totalAttempts} ishtirokchi</Badge>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="shadow-card">
                  <CardHeader>
                    <CardTitle className="text-lg">Umumiy ko'rsatkichlar</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Jami testlar</span>
                        <span className="font-bold text-xl">{analytics.totalTests}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Jami ishtirokchilar</span>
                        <span className="font-bold text-xl">{analytics.totalParticipants}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">O'rtacha ball</span>
                        <span className="font-bold text-xl">{analytics.averageScore}%</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Muvaffaqiyat darajasi</span>
                        <span className="font-bold text-xl text-success">{analytics.successRate}%</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* AI Analysis History */}
              <AIAnalysisHistory />
            </div>
          )}
        </div>
      </main>

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Testni o'chirish</AlertDialogTitle>
            <AlertDialogDescription>
              "{testToDelete?.title_uz}" testini o'chirishni tasdiqlaysizmi? 
              Bu amalni qaytarib bo'lmaydi.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteTest}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function Admin() {
  return (
    <LanguageProvider>
      <AdminContent />
    </LanguageProvider>
  );
}
