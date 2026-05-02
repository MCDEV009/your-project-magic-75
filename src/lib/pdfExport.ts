import jsPDF from 'jspdf';

interface QStat {
  question_id: string;
  question_type: string;
  is_correct: boolean | null;
  points_earned: number;
  max_points: number;
  question_text?: string;
  order_index?: number;
}

interface ExportData {
  participantId: string;
  participantName: string;
  testTitle: string;
  totalScore: number;
  totalPoints: number;
  percentage: number;
  certificateLabel: string;
  certificateDesc: string;
  questionStats: QStat[];
  practiceContent?: string;
  generatedAt: Date;
}

function stripMarkdown(s: string): string {
  return s
    .replace(/```[\s\S]*?```/g, (m) => m.replace(/```/g, ''))
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\$\$([\s\S]*?)\$\$/g, '$1')
    .replace(/\$([^$]+)\$/g, '$1')
    .replace(/^#+\s*/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
}

export function exportResultsPdf(data: ExportData): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentW = pageW - margin * 2;
  let y = margin;

  const ensure = (needed: number) => {
    if (y + needed > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const addText = (text: string, opts: { size?: number; bold?: boolean; color?: [number, number, number]; gap?: number } = {}) => {
    const { size = 10, bold = false, color = [30, 30, 30], gap = 1.5 } = opts;
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(text, contentW);
    for (const line of lines) {
      ensure(size * 0.45 + gap);
      doc.text(line, margin, y);
      y += size * 0.45 + gap;
    }
  };

  const hr = () => {
    ensure(4);
    doc.setDrawColor(200);
    doc.line(margin, y, pageW - margin, y);
    y += 4;
  };

  // Header
  doc.setFillColor(99, 102, 241);
  doc.rect(0, 0, pageW, 18, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Milliy Sertifikat — Test Natijalari', margin, 12);
  y = 24;

  addText(data.testTitle, { size: 14, bold: true });
  addText(`Sana: ${data.generatedAt.toLocaleString('uz-UZ')}`, { size: 9, color: [100, 100, 100] });
  y += 2;
  hr();

  // Participant
  addText('Qatnashuvchi', { size: 12, bold: true });
  addText(`Ism: ${data.participantName}`, { size: 11 });
  addText(`ID: ${data.participantId}`, { size: 11, color: [80, 80, 80] });
  y += 2;
  hr();

  // Certificate level box
  ensure(24);
  doc.setFillColor(238, 242, 255);
  doc.setDrawColor(99, 102, 241);
  doc.roundedRect(margin, y, contentW, 22, 2, 2, 'FD');
  doc.setTextColor(60, 60, 80);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('SERTIFIKAT DARAJASI', margin + 3, y + 5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(50, 50, 100);
  doc.text(data.certificateLabel, margin + 3, y + 12);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 100);
  const descLines = doc.splitTextToSize(data.certificateDesc, contentW - 6);
  doc.text(descLines[0] || '', margin + 3, y + 18);
  y += 26;

  addText(`Umumiy ball: ${data.totalScore.toFixed(1)} / ${data.totalPoints.toFixed(1)}  (${data.percentage.toFixed(1)}%)`, {
    size: 11, bold: true,
  });
  y += 2;
  hr();

  // Per-question stats
  addText('Har bir savol foizi', { size: 12, bold: true });
  data.questionStats.forEach((q, i) => {
    const earned = Number(q.points_earned || 0);
    const max = Number(q.max_points || 1);
    const pct = max > 0 ? (earned / max) * 100 : 0;
    const typeLabel = q.question_type === 'written' ? 'Yozma' : 'Test';
    const text = q.question_text ? q.question_text.slice(0, 100) : '';
    ensure(10);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(30, 30, 30);
    doc.text(`#${i + 1} [${typeLabel}]`, margin, y);
    doc.setFont('helvetica', 'normal');
    doc.text(`${earned.toFixed(1)}/${max}  (${pct.toFixed(0)}%)`, pageW - margin - 35, y);
    y += 4;
    if (text) {
      doc.setTextColor(90, 90, 90);
      doc.setFontSize(8);
      const tl = doc.splitTextToSize(text, contentW);
      ensure(tl.length * 3.5);
      doc.text(tl, margin, y);
      y += tl.length * 3.5;
    }
    // Progress bar
    ensure(4);
    doc.setFillColor(230, 230, 230);
    doc.rect(margin, y, contentW, 1.5, 'F');
    const fillColor: [number, number, number] = pct >= 100 ? [34, 197, 94] : pct === 0 ? [239, 68, 68] : [234, 179, 8];
    doc.setFillColor(...fillColor);
    doc.rect(margin, y, (contentW * pct) / 100, 1.5, 'F');
    y += 4;
  });

  // Practice questions
  if (data.practiceContent && data.practiceContent.trim()) {
    doc.addPage();
    y = margin;
    addText("Mashq savollari (Al Xorazmiy)", { size: 14, bold: true });
    hr();
    const cleaned = stripMarkdown(data.practiceContent);
    addText(cleaned, { size: 10, gap: 1.8 });
  }

  // Footer page numbers
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`${p} / ${total}`, pageW - margin, pageH - 6, { align: 'right' });
    doc.text(`ID: ${data.participantId} — ${data.participantName}`, margin, pageH - 6);
  }

  const safeName = data.participantName.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30) || 'natija';
  doc.save(`${safeName}_${data.participantId}_natija.pdf`);
}