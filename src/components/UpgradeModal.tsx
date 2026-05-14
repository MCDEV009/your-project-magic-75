import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Sparkles } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  reason?: string;
}
export function UpgradeModal({ open, onOpenChange, reason }: Props) {
  const navigate = useNavigate();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /> Limit tugadi</DialogTitle>
          <DialogDescription>
            {reason ?? "Joriy oy uchun bepul limitingiz tugadi. Premium tarifga o'ting va cheksiz foydalaning."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Yopish</Button>
          <Button onClick={() => { onOpenChange(false); navigate('/pricing'); }}>Tariflarni ko'rish</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}