import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { History, ChevronDown, ChevronUp, Brain } from 'lucide-react';

interface AnalysisRecord {
  id: string;
  analysis_type: string;
  analysis_result: any;
  model_used: string;
  created_at: string;
  test_name?: string;
}

export function AIAnalysisHistory() {
  const [records, setRecords] = useState<AnalysisRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    const { data } = await supabase
      .from('ai_analysis_history')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);

    if (data) {
      // Fetch test names
      const testIds = [...new Set(data.filter((d: any) => d.test_id).map((d: any) => d.test_id))];
      let testMap = new Map();
      if (testIds.length > 0) {
        const { data: tests } = await supabase.from('tests').select('id, title_uz').in('id', testIds);
        testMap = new Map((tests || []).map((t: any) => [t.id, t.title_uz]));
      }

      setRecords(data.map((d: any) => ({
        ...d,
        test_name: d.test_id ? testMap.get(d.test_id) || 'N/A' : undefined,
      })));
    }
    setLoading(false);
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'dashboard': return <Badge variant="default">Dashboard</Badge>;
      case 'attempt': return <Badge variant="secondary">Natija tahlili</Badge>;
      default: return <Badge variant="outline">{type}</Badge>;
    }
  };

  return (
    <Card className="shadow-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <History className="h-5 w-5 text-primary" />
          AI Tahlil tarixi
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}
          </div>
        ) : records.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Brain className="h-12 w-12 mx-auto mb-2 opacity-30" />
            <p>Hali AI tahlil tarixi yo'q</p>
          </div>
        ) : (
          <div className="space-y-2">
            {records.map(record => (
              <div key={record.id} className="border rounded-lg overflow-hidden">
                <button
                  onClick={() => setExpandedId(expandedId === record.id ? null : record.id)}
                  className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    {getTypeBadge(record.analysis_type)}
                    {record.test_name && (
                      <span className="text-sm text-muted-foreground">{record.test_name}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {new Date(record.created_at).toLocaleString('uz-UZ')}
                    </span>
                    {expandedId === record.id ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </div>
                </button>
                {expandedId === record.id && (
                  <div className="px-3 pb-3 border-t bg-muted/30">
                    <pre className="text-xs overflow-auto max-h-60 p-2 mt-2 rounded bg-background">
                      {JSON.stringify(record.analysis_result, null, 2)}
                    </pre>
                    <div className="mt-2 text-xs text-muted-foreground">
                      Model: {record.model_used}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
