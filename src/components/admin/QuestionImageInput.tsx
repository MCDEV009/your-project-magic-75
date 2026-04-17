import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Image as ImageIcon, Upload, Loader2, X, Link as LinkIcon } from 'lucide-react';
import { toast } from 'sonner';

interface QuestionImageInputProps {
  value: string;
  onChange: (url: string) => void;
  label?: string;
}

export function QuestionImageInput({ value, onChange, label = "Rasm (ixtiyoriy)" }: QuestionImageInputProps) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error("Faqat rasm faylini yuklang");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Rasm hajmi 5MB dan oshmasin");
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'png';
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage
        .from('question-images')
        .upload(fileName, file, { cacheControl: '3600', upsert: false });

      if (error) throw error;

      const { data } = supabase.storage.from('question-images').getPublicUrl(fileName);
      onChange(data.publicUrl);
      toast.success("Rasm yuklandi");
    } catch (err: any) {
      console.error('Upload error:', err);
      toast.error(err.message || "Rasmni yuklashda xatolik");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2">
        <ImageIcon className="h-4 w-4" />
        {label}
      </Label>

      <Tabs defaultValue={value && !value.includes('question-images') ? 'url' : 'upload'} className="w-full">
        <TabsList className="grid w-full grid-cols-2 h-9">
          <TabsTrigger value="upload" className="gap-1.5 text-xs">
            <Upload className="h-3.5 w-3.5" /> Qurilmadan
          </TabsTrigger>
          <TabsTrigger value="url" className="gap-1.5 text-xs">
            <LinkIcon className="h-3.5 w-3.5" /> URL
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="mt-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileUpload(file);
            }}
          />
          <Button
            type="button"
            variant="outline"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="w-full gap-2"
          >
            {uploading ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Yuklanmoqda...</>
            ) : (
              <><Upload className="h-4 w-4" /> Qurilmadan rasm tanlang</>
            )}
          </Button>
          <p className="text-xs text-muted-foreground mt-1">PNG, JPG, WebP — maksimal 5MB</p>
        </TabsContent>

        <TabsContent value="url" className="mt-2">
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="https://..."
          />
        </TabsContent>
      </Tabs>

      {value && (
        <div className="relative inline-block mt-2">
          <img
            src={value}
            alt="Question preview"
            className="max-h-40 rounded border"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="absolute -top-2 -right-2 h-6 w-6"
            onClick={() => onChange('')}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
}
