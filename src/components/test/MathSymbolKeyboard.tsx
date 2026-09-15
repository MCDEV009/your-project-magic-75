import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Keyboard, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export type SymbolGroupKey = 'asosiy' | 'yunon' | 'matematika' | 'fizika';

const GROUPS: { key: SymbolGroupKey; label: string; symbols: string[] }[] = [
  {
    key: 'asosiy',
    label: 'Asosiy',
    symbols: ['+', '−', '×', '÷', '±', '∓', '=', '≠', '≈', '<', '>', '≤', '≥', '(', ')', '[', ']', '{', '}', '%', '‰', '·'],
  },
  {
    key: 'matematika',
    label: 'Matematika',
    symbols: ['√', '∛', '²', '³', 'ⁿ', '₁', '₂', '₃', '½', '⅓', '¼', '∞', 'π', '∑', '∏', '∫', '∂', '∆', '∇', '°', '∠', '⊥', '∥', '△', '⇒', '⇔', '∈', '∉', '⊂', '∪', '∩', '∀', '∃', '→', 'log', 'ln', 'sin', 'cos', 'tan', 'ctg', '!', '|x|'],
  },
  {
    key: 'yunon',
    label: 'Yunon',
    symbols: ['α', 'β', 'γ', 'δ', 'ε', 'ζ', 'η', 'θ', 'λ', 'μ', 'ν', 'ξ', 'ρ', 'σ', 'τ', 'φ', 'χ', 'ψ', 'ω', 'Γ', 'Δ', 'Θ', 'Λ', 'Σ', 'Φ', 'Ψ', 'Ω'],
  },
  {
    key: 'fizika',
    label: 'Fizika',
    symbols: ['°C', 'K', 'm/s', 'm/s²', 'kg', 'N', 'J', 'W', 'Pa', 'Hz', 'A', 'V', 'Ω', 'C', 'T', 'Wb', 'mol', 'eV', 'ħ', 'λ', 'ν', 'ρ', 'η', 'μ₀', 'ε₀', '×10⁻', '×10', '⃗'],
  },
];

interface MathSymbolKeyboardProps {
  onInsert: (symbol: string) => void;
  disabled?: boolean;
}

export function MathSymbolKeyboard({ onInsert, disabled = false }: MathSymbolKeyboardProps) {
  const [open, setOpen] = useState(false);
  const [group, setGroup] = useState<SymbolGroupKey>('asosiy');

  const active = GROUPS.find((g) => g.key === group)!;

  return (
    <div className="rounded-lg border bg-card/50">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground disabled:opacity-50"
      >
        <span className="flex items-center gap-2">
          <Keyboard className="h-4 w-4" />
          Maxsus belgilar
        </span>
        <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="space-y-2 border-t p-2">
          <div className="flex flex-wrap gap-1">
            {GROUPS.map((g) => (
              <Button
                key={g.key}
                type="button"
                size="sm"
                variant={g.key === group ? 'default' : 'outline'}
                className="h-7 px-2 text-xs"
                onClick={() => setGroup(g.key)}
                disabled={disabled}
              >
                {g.label}
              </Button>
            ))}
          </div>

          <div className="flex flex-wrap gap-1">
            {active.symbols.map((s) => (
              <Button
                key={s}
                type="button"
                variant="outline"
                size="sm"
                className="h-9 min-w-9 px-2 font-mono text-sm"
                disabled={disabled}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onInsert(s)}
              >
                {s}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default MathSymbolKeyboard;
