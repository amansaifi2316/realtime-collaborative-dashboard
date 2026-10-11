import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { getNodesBounds, getViewportForBounds } from '@xyflow/react';

function cleanLatin1(str) {
  if (!str) return '';
  return String(str).replace(/[^\u0000-\u00FF]/g, '?');
}

function formatPdfDate(date = new Date()) {
  const day = String(date.getDate()).padStart(2, '0');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const mins = String(date.getMinutes()).padStart(2, '0');
  return `${day} ${month} ${year}, ${hours}:${mins}`;
}

function formatTime(ts) {
  if (!ts) return '00:00';
  const d = new Date(ts);
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${mins}`;
}

export async function exportRoomPdf({ roomId, nodes, users = [], chat = [] }) {
  if (!nodes || nodes.length === 0) {
    return false;
  }

  const viewportElem = document.querySelector('.react-flow__viewport');
  if (!viewportElem) {
    throw new Error('Canvas viewport element not found');
  }

  const imageWidth = 1600;
  const imageHeight = 1000;

  // Step 1: Calculate bounds and viewport transform
  const nodesBounds = getNodesBounds(nodes);
  const viewport = getViewportForBounds(
    nodesBounds,
    imageWidth,
    imageHeight,
    0.5,
    2,
    0.15
  );

  const imgData = await toPng(viewportElem, {
    backgroundColor: '#ffffff',
    width: imageWidth,
    height: imageHeight,
    style: {
      width: `${imageWidth}px`,
      height: `${imageHeight}px`,
      transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`
    }
  });

  // Step 2: Build PDF with jsPDF (A4, landscape)
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = 297;
  const pageHeight = 210;
  const leftMargin = 15;
  const rightMargin = 15;
  const contentWidth = pageWidth - leftMargin - rightMargin;

  // Page 1: Title, metadata, and chart image
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(28, 25, 23);
  doc.text('Flowroom', leftMargin, 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(120, 113, 108);
  const dateStr = formatPdfDate(new Date());
  doc.text(`Room ${cleanLatin1(roomId)}, ${dateStr}`, leftMargin, 25);

  const imgY = 28;
  const maxImgHeight = pageHeight - imgY - 12;
  let renderWidth = contentWidth;
  let renderHeight = (imageHeight / imageWidth) * renderWidth;
  if (renderHeight > maxImgHeight) {
    renderHeight = maxImgHeight;
    renderWidth = (imageWidth / imageHeight) * renderHeight;
  }
  const imgX = leftMargin + (contentWidth - renderWidth) / 2;

  doc.addImage(imgData, 'PNG', imgX, imgY, renderWidth, renderHeight);

  // Next page(s): Participants and Chat
  doc.addPage('a4', 'landscape');
  let currentY = 20;
  const bottomMargin = 15;

  const checkPageBreak = (neededHeight) => {
    if (currentY + neededHeight > pageHeight - bottomMargin) {
      doc.addPage('a4', 'landscape');
      currentY = 20;
    }
  };

  // Heading: Participants
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(28, 25, 23);
  doc.text('Participants', leftMargin, currentY);
  currentY += 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(28, 25, 23);

  const participantNames = users.length > 0
    ? users.map((u) => cleanLatin1(u.name || 'Guest')).join(', ')
    : 'None';
  const participantLines = doc.splitTextToSize(participantNames, contentWidth);
  doc.text(participantLines, leftMargin, currentY);
  currentY += participantLines.length * 5 + 8;

  // Heading: Chat
  checkPageBreak(12);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(28, 25, 23);
  doc.text('Chat', leftMargin, currentY);
  currentY += 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(28, 25, 23);

  if (!chat || chat.length === 0) {
    doc.text('No messages.', leftMargin, currentY);
    currentY += 6;
  } else {
    chat.forEach((msg) => {
      const timeStr = formatTime(msg.ts);
      const nameStr = cleanLatin1(msg.name || 'Guest');
      const textStr = cleanLatin1(msg.text || '');
      const lineStr = `[${timeStr}] ${nameStr}: ${textStr}`;
      const lines = doc.splitTextToSize(lineStr, contentWidth);
      checkPageBreak(lines.length * 5);
      doc.text(lines, leftMargin, currentY);
      currentY += lines.length * 5 + 1;
    });
  }

  // Save the PDF
  doc.save(`flowroom-${cleanLatin1(roomId)}.pdf`);
  return true;
}
