import { useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface LatexRendererProps {
  text: string;
  className?: string;
}

const LatexRenderer = ({ text, className }: LatexRendererProps) => {
  const rendered = useMemo(() => {
    if (!text) return '';
    // Replace $...$ with rendered KaTeX HTML
    return text.replace(/\$([^$]+)\$/g, (_, math) => {
      try {
        return katex.renderToString(math, {
          throwOnError: false,
          displayMode: false,
        });
      } catch {
        return math;
      }
    });
  }, [text]);

  return (
    <span
      className={className}
      dangerouslySetInnerHTML={{ __html: rendered }}
    />
  );
};

export default LatexRenderer;
