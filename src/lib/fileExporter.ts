
import type { ExamData, Product, ExamDocument, ExportableExamData } from '@/types';
import type { Timestamp } from 'firebase/firestore';
import * as XLSX from 'xlsx';

export function downloadTxtFile(examData: ExamData, products: Product[]) {
  let content = `EXAMEN PREVIO AGENCIA ACONIC - CustomsEX-p\n`;
  content += `===========================================\n\n`;
  content += `INFORMACIÓN GENERAL:\n`;
  content += `NE: ${examData.ne}\n`;
  content += `Referencia: ${examData.reference || 'N/A'}\n`;
  content += `Consignatario: ${examData.consignee}\n`;
  content += `Gestor: ${examData.manager}\n`;
  content += `Ubicación: ${examData.location}\n\n`;
  content += `PRODUCTOS:\n`;

  (Array.isArray(products) ? products : []).forEach((product, index) => {
    content += `\n--- Producto ${index + 1} ---\n`;
    content += `Número de Item: ${product.itemNumber || 'N/A'}\n`;
    content += `Numeración de Bultos: ${product.numberPackages || 'N/A'}\n`;
    content += `Cantidad de Bultos: ${product.quantityPackages || 0}\n`;
    content += `Cantidad de Unidades: ${product.quantityUnits || 0}\n`;
    content += `Descripción: ${product.description || 'N/A'}\n`;
    content += `Marca: ${product.brand || 'N/A'}\n`;
    content += `Modelo: ${product.model || 'N/A'}\n`;
    content += `Serie: ${product.serial || 'N/A'}\n`;
    content += `Origen: ${product.origin || 'N/A'}\n`;
    content += `Estado de Mercancía: ${product.packagingCondition || 'N/A'}\n`;
    content += `Unidad de Medida: ${product.unitMeasure || 'N/A'}\n`;
    content += `Peso: ${product.weight || 'N/A'}\n`;
    content += `Observación: ${product.observation || 'N/A'}\n`;
    
    const statuses = [];
    if (product.isConform) statuses.push("Conforme a factura");
    if (product.isExcess) statuses.push("Se encontró excedente");
    if (product.isMissing) statuses.push("Se encontró faltante");
    if (product.isFault) statuses.push("Se encontró avería");
    content += `Estado: ${statuses.length > 0 ? statuses.join(', ') : 'Sin estado específico'}\n`;
  });

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `CustomsEX-p_${examData.ne}_${new Date().toISOString().split('T')[0]}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadExcelFile(data: ExportableExamData) {
  const now = new Date();
  const fechaHoraExportacion = `${now.toLocaleString('es-NI', { dateStyle: 'long', timeStyle: 'short' })}`;

  const photoLinkUrl = `https://aconisani-my.sharepoint.com/:f:/g/personal/asuntos_juridicos_aconic_com_ni/Emrpj4Ss8bhDifpuYc8U_bwBj9r29FGcXxzfxu4PSh2tEQ?e=FhIPTt`;

  // --- Hoja 1: Detalles del Examen y Productos ---
  const examDetailsSheetData: (string | number | Date | null | undefined | XLSX.CellObject)[][] = [
    ['EXAMEN PREVIO AGENCIA ACONIC - CustomsEX-p'],
    [],
    ['INFORMACIÓN GENERAL DEL EXAMEN:'],
    ['NE:', data.ne],
    ['Referencia:', data.reference || 'N/A'],
    ['Consignatario:', data.consignee],
    ['Gestor del Examen:', data.manager],
    ['Ubicación Mercancía:', data.location],
    ['Fotos:', { v: 'Abrir Carpeta de Fotos', t: 's', l: { Target: photoLinkUrl, Tooltip: 'Ir a la carpeta de fotos en SharePoint' } }],
    [],
    ['PRODUCTOS:']
  ];

  const productHeaders = [
    'Número de Item', 'Numeración de Bultos', 'Cantidad de Bultos', 'Cantidad de Unidades',
    'Descripción', 'Marca', 'Modelo', 'Origen', 'Estado de Mercancía',
    'Peso', 'Unidad de Medida', 'Serie', 'Observación', 'Estado'
  ];
  
  const productRows = (Array.isArray(data.products) ? data.products : []).map(product => {
    let statusText = '';
    const statuses = [];
    if (product.isConform) statuses.push("Conforme");
    if (product.isExcess) statuses.push("Excedente");
    if (product.isMissing) statuses.push("Faltante");
    if (product.isFault) statuses.push("Avería");
    statusText = statuses.length > 0 ? statuses.join('/') : 'S/E';

    return [
      product.itemNumber || 'N/A',
      product.numberPackages || 'N/A',
      product.quantityPackages || 0,
      product.quantityUnits || 0,
      product.description || 'N/A',
      product.brand || 'N/A',
      product.model || 'N/A',
      product.origin || 'N/A',
      product.packagingCondition || 'N/A',
      product.weight || 'N/A',
      product.unitMeasure || 'N/A',
      product.serial || 'N/A',
      product.observation || 'N/A',
      statusText
    ];
  });

  const ws_exam_details_data = [...examDetailsSheetData, productHeaders, ...productRows];
  const ws_exam_details = XLSX.utils.aoa_to_sheet(ws_exam_details_data);

  // Ajustar anchos de columna para la hoja de detalles del examen
  const examColWidths = productHeaders.map((header, i) => ({
    wch: Math.max(
      header.length,
      ...(ws_exam_details_data.slice(examDetailsSheetData.length) as string[][]).map(row => row[i] ? String(row[i]).length : 0)
    ) + 2 
  }));
  
  const generalInfoLabels = examDetailsSheetData.slice(0, examDetailsSheetData.length - 2).map(row => String(row[0] || ''));
  const generalInfoValues = examDetailsSheetData.slice(0, examDetailsSheetData.length - 2).map(row => {
    const cellValue = row[1];
    if (typeof cellValue === 'object' && cellValue !== null && 'v' in cellValue) {
      return String((cellValue as XLSX.CellObject).v || '');
    }
    return String(cellValue || '');
  });

  if (examColWidths.length > 0) {
    examColWidths[0].wch = Math.max(examColWidths[0]?.wch || 0, ...generalInfoLabels.map(label => label.length + 2));
  }
  if (examColWidths.length > 1) {
    examColWidths[1].wch = Math.max(examColWidths[1]?.wch || 0, ...generalInfoValues.map(value => value.length + 5));
  }
  ws_exam_details['!cols'] = examColWidths;

  // --- Hoja 2: Detalles del Sistema ---
  const systemDetailsSheetData: (string | number | Date | null | undefined)[][] = [
    ['DETALLES DE SISTEMA DEL EXAMEN:']
  ];

  if (data.savedBy) {
    systemDetailsSheetData.push(['Guardado por (correo):', data.savedBy]);
  } else {
    systemDetailsSheetData.push(['Guardado por (correo):', 'N/A (No guardado en BD aún o dato no disponible)']);
  }

  const toLocaleStringSafe = (timestamp: Timestamp | Date | null | undefined) => {
    if (!timestamp) return 'N/A';
    const date = (timestamp as Timestamp)?.toDate ? (timestamp as Timestamp).toDate() : (timestamp as Date);
    if (date instanceof Date) {
      return date.toLocaleString('es-NI', { dateStyle: 'long', timeStyle: 'medium' });
    }
    return 'Fecha inválida';
  }

  systemDetailsSheetData.push(['Fecha y Hora de Inicio:', toLocaleStringSafe(data.createdAt)]);
  systemDetailsSheetData.push(['Fecha y Hora de Último Guardado:', toLocaleStringSafe(data.savedAt)]);
  systemDetailsSheetData.push(['Fecha y Hora de Finalización:', data.completedAt ? toLocaleStringSafe(data.completedAt) : 'Examen no finalizado']);
  systemDetailsSheetData.push(['Fecha y Hora de Exportación:', fechaHoraExportacion]);


  const ws_system_details = XLSX.utils.aoa_to_sheet(systemDetailsSheetData);
  
  // Ajustar anchos de columna para la hoja de detalles del sistema
  const systemColWidths = [
    { wch: Math.max(...systemDetailsSheetData.map(row => String(row[0]).length)) + 2 },
    { wch: Math.max(...systemDetailsSheetData.map(row => String(row[1]).length)) + 5 },
  ];
  ws_system_details['!cols'] = systemColWidths;


  // --- Crear y descargar el libro ---
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws_exam_details, `Examen ${data.ne}`);
  XLSX.utils.book_append_sheet(wb, ws_system_details, "Detalle de Sistema");
  
  XLSX.writeFile(wb, `CustomsEX-p_${data.ne}_${new Date().toISOString().split('T')[0]}.xlsx`);
}

export function downloadReportAsExcel(exams: ExamDocument[]) {
  const now = new Date();
  const fechaHoraExportacion = `${now.toLocaleString('es-NI', { dateStyle: 'long', timeStyle: 'short' })}`;
  
  const formatTimestamp = (ts: Timestamp | undefined | null): string => {
    if (!ts) return 'N/A';
    // Handle both old and new exam structures
    const date = (ts as Timestamp)?.toDate ? (ts as Timestamp).toDate() : (ts as any);
    if (date instanceof Date) {
        return date.toLocaleString('es-NI', { dateStyle: 'long', timeStyle: 'short' });
    }
    return 'Fecha inválida';
  };

  const reportHeaders = [
    'NE',
    'Consignatario',
    'Solicitado Por',
    'Asignado a',
    'Inicio de Previo',
    'Fin de Previo',
    'Cantidad de Productos',
    'Guardado Por'
  ];

  const reportRows = exams.map(exam => [
    exam.ne,
    exam.consignee,
    exam.requestedBy || 'N/A', // Handle old exams
    exam.assignedTo || exam.manager, // Handle old exams
    formatTimestamp(exam.createdAt || exam.lastUpdated), // Handle old exams
    formatTimestamp(exam.completedAt || exam.lastUpdated), // Handle old exams
    exam.products?.length || 0,
    exam.savedBy || 'N/A'
  ]);

  const ws_data = [
    ['REPORTE DE EXÁMENES PREVIOS - CustomsEX-p'],
    [`Generado el: ${fechaHoraExportacion}`],
    [],
    reportHeaders,
    ...reportRows
  ];

  const ws = XLSX.utils.aoa_to_sheet(ws_data);

  // Ajustar anchos de columna
  const colWidths = reportHeaders.map((header, i) => ({
    wch: Math.max(
      header.length,
      ...reportRows.map(row => String(row[i]).length)
    ) + 2
  }));
  ws['!cols'] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Reporte de Exámenes");

  XLSX.writeFile(wb, `Reporte_CustomsEX-p_${now.toISOString().split('T')[0]}.xlsx`);
}
