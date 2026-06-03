import jsPDF from 'jspdf';

export interface AttemptSummary {
  participantName: string;
  participantId: string;
  testTitle: string;
  status: string;
  startedAt: Date;
  finishedAt: Date | null;
  score: number;
  mcqScore: number;
  writtenScore: number;
  totalQuestions: number;
  correctAnswers: number;
  durationMinutes: number;
  testFormat?: string;
  paid?: boolean;
  paidAmount?: number;
  paidAt?: Date | null;
}

export function exportAttemptSummaryPdf(data: AttemptSummary): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 15;
  const contentW = pageW - margin * 2;
  let y = margin;

  // Header band
  doc.setFillColor(99, 102, 241);
  doc.rect(0, 0, pageW, 22, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Milliy Sertifikat — Test Hisoboti', margin, 14);
  y = 30;

  doc.setTextColor(20, 20, 20);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  const titleLines = doc.splitTextToSize(data.testTitle, contentW);
  doc.text(titleLines, margin, y);
  y += titleLines.length * 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(110, 110, 110);
  doc.text(`Yaratilgan: ${new Date().toLocaleString('uz-UZ')}`, margin, y);
  y += 8;

  // Participant
  doc.setDrawColor(220);
  doc.line(margin, y, pageW - margin, y);
  y += 6;
  doc.setTextColor(20, 20, 20);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Qatnashuvchi', margin, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(`Ism: ${data.participantName}`, margin, y); y += 5;
  doc.text(`ID: ${data.participantId}`, margin, y); y += 8;

  // Score box
  const pct = Math.max(0, Math.min(100, Math.round(data.score)));
  doc.setFillColor(238, 242, 255);
  doc.setDrawColor(99, 102, 241);
  doc.roundedRect(margin, y, contentW, 26, 2, 2, 'FD');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 110);
  doc.text('UMUMIY NATIJA', margin + 4, y + 6);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(50, 50, 100);
  doc.text(`${pct}%`, margin + 4, y + 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(60, 60, 90);
  const right = pageW - margin - 4;
  doc.text(`MCQ: ${Math.round(data.mcqScore)}`, right, y + 8, { align: 'right' });
  doc.text(`Yozma: ${Math.round(data.writtenScore)}`, right, y + 14, { align: 'right' });
  doc.text(`To'g'ri: ${data.correctAnswers}/${data.totalQuestions}`, right, y + 20, { align: 'right' });
  y += 32;

  // Test metadata
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(20, 20, 20);
  doc.text('Test ma\'lumotlari', margin, y); y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(`Status: ${data.status === 'finished' ? 'Yakunlangan' : 'Jarayonda'}`, margin, y); y += 5;
  doc.text(`Davomiyligi: ${data.durationMinutes} daqiqa`, margin, y); y += 5;
  doc.text(`Boshlanishi: ${data.startedAt.toLocaleString('uz-UZ')}`, margin, y); y += 5;
  if (data.finishedAt) {
    doc.text(`Yakuni: ${data.finishedAt.toLocaleString('uz-UZ')}`, margin, y); y += 5;
  }
  if (data.testFormat) {
    doc.text(`Format: ${data.testFormat === 'milliy_sertifikat' ? 'Milliy Sertifikat' : 'Standart'}`, margin, y); y += 5;
  }

  if (data.paid) {
    y += 3;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(34, 120, 60);
    doc.text('To\'lov holati: To\'langan', margin, y); y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
    if (typeof data.paidAmount === 'number') {
      doc.text(`Summa: ${new Intl.NumberFormat('uz-UZ').format(data.paidAmount)} so'm`, margin, y); y += 5;
    }
    if (data.paidAt) {
      doc.text(`To'lov sanasi: ${data.paidAt.toLocaleString('uz-UZ')}`, margin, y); y += 5;
    }
  }

  // Footer
  const pageH = doc.internal.pageSize.getHeight();
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text(`ID: ${data.participantId} — ${data.participantName}`, margin, pageH - 8);
  doc.text('msmocktest.lovable.app', pageW - margin, pageH - 8, { align: 'right' });

  const safeName = data.participantName.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30) || 'natija';
  doc.save(`${safeName}_${data.participantId}_hisobot.pdf`);
}