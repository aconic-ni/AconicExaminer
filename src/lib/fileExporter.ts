
import type { ExamData, Product, ExamDocument } from '@/types';
import type { Timestamp } from 'firebase/firestore';
import * as XLSX from 'xlsx';

// Interface for data passed to downloadExcelFile
// It accommodates both PreviewScreen (without savedAt/savedBy) and DatabasePage (with them)
interface ExportableExamData extends ExamData {
  products: Product[];
  savedAt?: Timestamp | Date; // Date is for flexibility if ever needed, Firestore uses Timestamp
  savedBy?: string | null;
}


export function downloadTxtFile(examData: ExamData, products: Product[]) {
  let content = `EXAMEN PREVIO AGENCIA ACONIC - CustomsEX-p\n`;
  content += `===========================================\n\n`;
  content += `INFORMACIÓN GENERAL:\n`;
  content += `NE: ${examData.ne}\n`;
  content += `Referencia: ${examData.reference || 'N/A'}\n`;
  content += `Gestor: ${examData.manager}\n`;
  content += `Ubicación: ${examData.location}\n\n`;
  content += `PRODUCTOS:\n`;

  products.forEach((product, index) => {
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
  const fechaHoraExportacion = `${now.toLocaleDateString('es-NI', {dateStyle: 'long', timeStyle: 'short'})}`;
  
  const excelDataHeader = [
    ['EXAMEN PREVIO AGENCIA ACONIC - CustomsEX-p'],
    [],
    ['INFORMACIÓN GENERAL DEL EXAMEN:'],
    ['NE:', data.ne],
    ['Referencia:', data.reference || 'N/A'],
    ['Gestor del Examen:', data.manager],
    ['Ubicación Mercancía:', data.location],
  ];

  // Add savedAt and savedBy if they exist (for exports from DatabasePage)
  if (data.savedAt || data.savedBy) {
    excelDataHeader.push([], ['DETALLES DE GUARDADO EN SISTEMA:']);
    if (data.savedBy) {
      excelDataHeader.push(['Guardado por (correo):', data.savedBy || 'N/A']);
    }
    if (data.savedAt) {
      const savedDate = data.savedAt instanceof Date ? data.savedAt : (data.savedAt as Timestamp).toDate();
      excelDataHeader.push(['Fecha y Hora de Guardado:', savedDate.toLocaleString('es-NI', { dateStyle: 'long', timeStyle: 'medium' })]);
    }
  }
  
  excelDataHeader.push(
    ['Fecha y Hora de Exportación:', fechaHoraExportacion],
    [],
    ['PRODUCTOS:']
  );


  const productHeaders = [
    'Número de Item', 'Numeración de Bultos', 'Cantidad de Bultos', 'Cantidad de Unidades',
    'Descripción', 'Marca', 'Modelo', 'Origen', 'Estado de Mercancía',
    'Peso', 'Unidad de Medida', 'Serie', 'Observación', 'Estado'
  ];
  
  const productRows = (data.products || []).map(product => { // Ensure data.products is an array
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

  const excelData = [...excelDataHeader, productHeaders, ...productRows];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(excelData);

  const colWidths = productHeaders.map((header, i) => ({
    wch: Math.max(
      header.length,
      ...excelData.map(row => row[i] ? String(row[i]).length : 0)
    ) + 2 
  }));
  
  if (colWidths.length > 0) { // Ensure colWidths is not empty
    colWidths[0].wch = Math.max(colWidths[0].wch || 0, ...excelDataHeader.filter(row => row.length > 0 && row[0]).map(row => String(row[0]).length + 2));
  }
  if (colWidths.length > 1) { // Ensure colWidths has at least 2 elements
    colWidths[1].wch = Math.max(colWidths[1]?.wch || 0, ...excelDataHeader.filter(row => row.length > 1 && row[1]).map(row => String(row[1]).length + 5));
  }


  ws['!cols'] = colWidths;
  
  XLSX.utils.book_append_sheet(wb, ws, `Examen ${data.ne}`);
  XLSX.writeFile(wb, `CustomsEX-p_${data.ne}_${new Date().toISOString().split('T')[0]}.xlsx`);
}
