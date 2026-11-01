(() => {
  'use strict';

  function create({ meetingCode, startedAt, headers, rows, metrics = [], anonymized = false }) {
    const doc = new window.jspdf.jsPDF({ orientation: headers.length > 7 ? 'landscape' : 'portrait' });
    const width = doc.internal.pageSize.getWidth();
    const height = doc.internal.pageSize.getHeight();
    const margin = 17;
    const inner = width - margin * 2;
    const ink = [36, 33, 26];
    const muted = [116, 110, 94];
    const line = [229, 225, 214];
    const yellow = [244, 211, 94];
    const date = new Date(startedAt);
    const dateLabel = Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    const meta = `${meetingCode || 'Unknown meeting'}  /  ${dateLabel}`;
    const text = (value, x, y, size = 9, color = ink, weight = 'normal', options = {}) => {
      doc.setFont('helvetica', weight);
      doc.setFontSize(size);
      doc.setTextColor(...color);
      doc.text(String(value), x, y, options);
    };
    doc.setProperties({ title: `NerdMeet | ${meetingCode || 'Meeting report'}`, subject: 'Meeting attendance and participation', creator: 'NerdMeet' });
    doc.setFillColor(...yellow);
    doc.rect(0, 0, width, 3, 'F');
    doc.roundedRect(margin, 14, 7, 7, 2, 2, 'F');
    text('NerdMeet', margin + 10, 19.5, 12, ink, 'bold');
    text('MEETING REPORT', width - margin, 19.5, 8, muted, 'normal', { align: 'right' });
    text('Time together, at a glance.', margin, 37, 24, ink);
    text(meta, margin, 46, 10, muted);
    if (anonymized) text('Names anonymized', width - margin, 46, 8, muted, 'normal', { align: 'right' });
    let y = 56;
    if (metrics.length) {
      const gap = 4;
      const cellWidth = (inner - gap * (metrics.length - 1)) / metrics.length;
      metrics.forEach(({ label, value }, i) => {
        const x = margin + i * (cellWidth + gap);
        doc.setFillColor(248, 246, 239);
        doc.roundedRect(x, y, cellWidth, 27, 2, 2, 'F');
        const valueText = String(value);
        const size = Math.min(21, (cellWidth - 12) / Math.max(1, doc.getTextWidth(valueText)) * doc.getFontSize());
        text(valueText, x + 6, y + 12, size, ink);
        text(label.toUpperCase(), x + 6, y + 21, 7, muted);
      });
      y += 39;
    } else {
      y += 5;
    }
    text('Participation', margin, y, 12, ink, 'bold');
    text(`${rows.length} participant${rows.length === 1 ? '' : 's'}`, width - margin, y, 8, muted, 'normal', { align: 'right' });
    const tableTop = y + 6;
    doc.autoTable({
      startY: tableTop,
      margin: { left: margin, right: margin, top: 30, bottom: 24 },
      head: [headers],
      body: rows,
      theme: 'plain',
      showHead: 'everyPage',
      rowPageBreak: 'avoid',
      styles: { font: 'helvetica', fontSize: 8.5, textColor: ink, cellPadding: { top: 4, right: 3, bottom: 4, left: 3 }, overflow: 'linebreak', valign: 'middle', halign: 'right', lineWidth: 0 },
      headStyles: { fillColor: yellow, textColor: ink, fontStyle: 'bold', fontSize: 8, halign: 'right' },
      alternateRowStyles: { fillColor: [248, 247, 242] },
      columnStyles: { 0: { halign: 'left', cellWidth: headers.length > 1 ? inner * .26 : inner, fontStyle: 'bold' } },
      didParseCell(data) {
        if (data.section === 'head' && data.column.index === 0) data.cell.styles.halign = 'left';
      }
    });
    const pages = doc.getNumberOfPages();
    for (let page = 1; page <= pages; page++) {
      doc.setPage(page);
      if (page > 1) {
        doc.setFillColor(...yellow);
        doc.rect(0, 0, width, 3, 'F');
        text('NerdMeet', margin, 17, 11, ink, 'bold');
        text(meta, width - margin, 17, 8, muted, 'normal', { align: 'right' });
      }
      doc.setDrawColor(...line);
      doc.setLineWidth(.25);
      doc.line(margin, height - 18, width - margin, height - 18);
      text('NERDMEET  /  Attendance & participation', margin, height - 11, 7, muted);
      text(`${page} / ${pages}`, width - margin, height - 11, 8, muted, 'normal', { align: 'right' });
    }
    return doc;
  }

  window.NerdMeetPDF = { create };
})();
