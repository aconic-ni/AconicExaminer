import type { ExamData, Product } from '@/types';
import * as XLSX from 'xlsx';

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

export function downloadExcelFile(examData: ExamData, products: Product[]) {
  const now = new Date();
  const fechaHora = `${now.toLocaleDateString('es-NI')} ${now.toLocaleTimeString('es-NI')}`;
  
  const excelDataHeader = [
    ['EXAMEN PREVIO AGENCIA ACONIC - CustomsEX-p'],
    [],
    ['INFORMACIÓN GENERAL:'],
    [],
    [`Fecha y hora de generación: ${fechaHora}`],
    ['NE:', examData.ne],
    ['Referencia:', examData.reference || 'N/A'],
    ['Gestor:', examData.manager],
    ['Ubicación:', examData.location],
    [],
    ['PRODUCTOS:'],
  ];

  const productHeaders = [
    'Número de Item', 'Numeración de Bultos', 'Cantidad de Bultos', 'Cantidad de Unidades',
    'Descripción', 'Marca', 'Modelo', 'Origen', 'Estado de Mercancía',
    'Peso', 'Unidad de Medida', 'Serie', 'Observación', 'Estado'
  ];
  
  const productRows = products.map(product => {
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

  // Auto-size columns (basic implementation)
  const colWidths = productHeaders.map((_, i) => ({
    wch: Math.max(
      ...excelData.map(row => row[i] ? String(row[i]).length : 0),
      productHeaders[i].length // Ensure header is also considered
    )
  }));
  // Add a bit more padding to NE, Ref, Gestor, Ubicacion in header
  if (excelData[5] && excelData[5][1]) colWidths[1] = { wch: Math.max(colWidths[1]?.wch || 0, String(excelData[5][1]).length + 5) };
  if (excelData[6] && excelData[6][1]) colWidths[1] = { wch: Math.max(colWidths[1]?.wch || 0, String(excelData[6][1]).length + 5) };
  if (excelData[7] && excelData[7][1]) colWidths[1] = { wch: Math.max(colWidths[1]?.wch || 0, String(excelData[7][1]).length + 5) };
  if (excelData[8] && excelData[8][1]) colWidths[1] = { wch: Math.max(colWidths[1]?.wch || 0, String(excelData[8][1]).length + 5) };


  ws['!cols'] = colWidths;
  
  XLSX.utils.book_append_sheet(wb, ws, `Examen ${examData.ne}`);
  XLSX.writeFile(wb, `CustomsEX-p_${examData.ne}_${new Date().toISOString().split('T')[0]}.xlsx`);
}
