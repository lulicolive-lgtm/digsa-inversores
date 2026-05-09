/**
 * DIGSA — Generador de PDFs de Liquidación y Reporte
 * Usa PDFKit para generar PDFs con diseño profesional
 */
const PDFDocument = require('pdfkit');

// Colores DIGSA
const NEGRO   = '#1A1A1A';
const NARANJA = '#FF4D0F';
const BLANCO  = '#FFFFFF';
const GRIS    = '#F5F5F5';
const GRIS2   = '#E0E0E0';
const VERDE   = '#1A6B3C';
const AZUL_OSC= '#1A2B3C';

const W = 595.28; // A4 width
const H = 841.89; // A4 height
const MAR = 45;   // margen

const fmt = n => '€' + Number(n).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtPct = n => (n >= 0 ? '+' : '') + (Number(n) * 100).toFixed(2) + '%';
const fmtDate = d => {
  if (!d) return '—';
  const date = new Date(d);
  return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
};

// ─── HELPERS ────────────────────────────────────────────────────────────────

function headerPage(doc, titulo, subtitulo, fecha) {
  // Fondo negro header
  doc.rect(0, 0, W, 110).fill(NEGRO);
  // Línea naranja
  doc.rect(0, 110, W, 4).fill(NARANJA);
  
  // Logo texto DIGSA
  doc.fillColor(BLANCO).fontSize(22).font('Helvetica-Bold')
     .text('DIGSA', MAR, 28, { continued: false });
  doc.fillColor(NARANJA).fontSize(8).font('Helvetica')
     .text('ESPAÑA', MAR, 52, { characterSpacing: 3 });

  // Título derecha
  doc.fillColor(BLANCO).fontSize(16).font('Helvetica-Bold')
     .text(titulo, W/2, 25, { width: W/2 - MAR, align: 'right' });
  doc.fillColor('rgba(255,255,255,0.6)').fontSize(10).font('Helvetica')
     .text(subtitulo, W/2, 48, { width: W/2 - MAR, align: 'right' });
  if (fecha) {
    doc.fillColor(NARANJA).fontSize(9)
       .text(fecha, W/2, 68, { width: W/2 - MAR, align: 'right' });
  }
}

function footerPage(doc, pageNum, totalPages) {
  const y = H - 45;
  doc.rect(0, y - 8, W, 53).fill(NEGRO);
  doc.fillColor('rgba(255,255,255,0.4)').fontSize(8).font('Helvetica')
     .text('Villanueva 27, Madrid  ·  La Pampa 1517 3°C, Buenos Aires  ·  digsa.es', 
            MAR, y + 4, { width: W - MAR*2, align: 'center' });
  doc.fillColor('rgba(255,255,255,0.3)').fontSize(7)
     .text(`Pág. ${pageNum} / ${totalPages}`, W - MAR - 40, y + 4);
  doc.fillColor('rgba(255,255,255,0.2)').fontSize(7)
     .text('La rentabilidad estimada es NETA (después de fee de éxito e impuestos)', 
            MAR, y + 18, { width: W - MAR*2, align: 'center' });
}

function kpiBox(doc, x, y, w, h, label, valor, color = NEGRO) {
  doc.rect(x, y, w, h).fill(GRIS).stroke(GRIS2);
  doc.rect(x, y, w, 3).fill(color);
  doc.fillColor(NEGRO).fontSize(7).font('Helvetica')
     .text(label.toUpperCase(), x + 10, y + 10, { width: w - 20, characterSpacing: 0.5 });
  doc.fillColor(color).fontSize(16).font('Helvetica-Bold')
     .text(valor, x + 10, y + 22, { width: w - 20 });
}

function sectionTitle(doc, y, texto) {
  doc.rect(MAR, y, W - MAR*2, 22).fill(NEGRO);
  doc.fillColor(BLANCO).fontSize(9).font('Helvetica-Bold')
     .text(texto.toUpperCase(), MAR + 10, y + 7, { characterSpacing: 1 });
  return y + 22;
}

function tableHeader(doc, y, cols) {
  // cols: [{x, w, label, align}]
  doc.rect(MAR, y, W - MAR*2, 20).fill('#2A2A2A');
  cols.forEach(col => {
    doc.fillColor(BLANCO).fontSize(8).font('Helvetica-Bold')
       .text(col.label, col.x + 4, y + 6, { width: col.w - 8, align: col.align || 'left' });
  });
  return y + 20;
}

function tableRow(doc, y, cols, values, bgColor = null) {
  if (bgColor) doc.rect(MAR, y, W - MAR*2, 18).fill(bgColor);
  else doc.rect(MAR, y, W - MAR*2, 0.5).fill(GRIS2);
  cols.forEach((col, i) => {
    const val = values[i] || '—';
    const color = col.color || NEGRO;
    doc.fillColor(color).fontSize(8).font(col.bold ? 'Helvetica-Bold' : 'Helvetica')
       .text(String(val), col.x + 4, y + 5, { width: col.w - 8, align: col.align || 'left' });
  });
  return y + 18;
}

// ─── GENERADOR DE LIQUIDACIÓN ────────────────────────────────────────────────

async function generarPDFLiquidacion(data) {
  const {
    usuario,          // { nombre, apellido, email }
    propiedad,        // { nombre, direccion }
    fecha,            // fecha de liquidación
    liquidaciones,    // [{ piso, aporte, utilidad_bruta, fee, impuestos, util_neta, total }]
    total_aporte,     // total aportado
    total_retorno,    // total retorno
    total_utilidad,   // total utilidad neta
  } = data;

  const TOTAL_PAGES = Math.ceil(liquidaciones.length / 6) + 2; // páginas de detalle + portada + gracias

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 0, size: 'A4' });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    let currentPage = 1;

    // ── PÁGINA 1: PORTADA + RESUMEN ─────────────────────────────────────
    headerPage(doc,
      'LIQUIDACIÓN DE INVERSIÓN',
      `${usuario.nombre} ${usuario.apellido}`,
      fmtDate(fecha)
    );

    // Datos del inversor
    let y = 130;
    doc.fillColor(NEGRO).fontSize(11).font('Helvetica-Bold')
       .text(`${usuario.nombre} ${usuario.apellido}`, MAR, y);
    doc.fillColor('#666').fontSize(9).font('Helvetica')
       .text(usuario.email, MAR, y + 14);

    y += 45;

    // KPIs resumen
    const kpiW = (W - MAR*2 - 20) / 3;
    kpiBox(doc, MAR,          y, kpiW, 65, 'Total aportado',      fmt(total_aporte), NEGRO);
    kpiBox(doc, MAR+kpiW+10,  y, kpiW, 65, 'Total retorno',       fmt(total_retorno), VERDE);
    kpiBox(doc, MAR+kpiW*2+20,y, kpiW, 65, 'Utilidad neta total', fmt(total_utilidad), NARANJA);

    y += 80;

    // Tabla de liquidaciones (6 por página)
    const COLS_LIQ = [
      { x: MAR,       w: 150, label: 'Inmueble' },
      { x: MAR+150,   w: 80,  label: 'Aporte', align: 'right' },
      { x: MAR+230,   w: 80,  label: 'Util. bruta', align: 'right' },
      { x: MAR+310,   w: 65,  label: 'Fee 15%', align: 'right' },
      { x: MAR+375,   w: 65,  label: 'Imp. 25%', align: 'right' },
      { x: MAR+440,   w: 65,  label: 'Util. neta', align: 'right' },
      { x: MAR+505,   w: W-MAR-505, label: 'Liquidación', align: 'right' },
    ];

    y = sectionTitle(doc, y, `Detalle por inmueble — ${liquidaciones.length} operaciones`);
    y = tableHeader(doc, y, COLS_LIQ);

    for (let i = 0; i < liquidaciones.length; i++) {
      // Nueva página si no entra
      if (y > H - 120) {
        footerPage(doc, currentPage, TOTAL_PAGES);
        doc.addPage();
        currentPage++;
        headerPage(doc, 'LIQUIDACIÓN DE INVERSIÓN', `${usuario.nombre} ${usuario.apellido}`, fmtDate(fecha));
        y = 130;
        y = sectionTitle(doc, y, `Detalle por inmueble (continuación)`);
        y = tableHeader(doc, y, COLS_LIQ);
      }

      const l = liquidaciones[i];
      const bg = i % 2 === 0 ? GRIS : BLANCO;
      y = tableRow(doc, y, COLS_LIQ, [
        l.piso,
        fmt(l.aporte),
        fmt(l.utilidad_bruta),
        fmt(l.fee),
        fmt(l.impuestos),
        fmt(l.util_neta),
        fmt(l.total),
      ], bg);
    }

    // Fila total
    y = tableRow(doc, y, COLS_LIQ, [
      'TOTAL',
      fmt(total_aporte),
      '',
      '',
      '',
      fmt(total_utilidad),
      fmt(total_retorno),
    ], '#1A1A1A');
    // Texto total en blanco
    doc.fillColor(BLANCO).fontSize(8).font('Helvetica-Bold')
       .text('TOTAL', MAR + 4, y - 13, { width: 140 })
       .text(fmt(total_retorno), MAR + 505 + 4, y - 13, { width: W-MAR-509, align: 'right' });

    y += 20;

    // Nota legal
    doc.rect(MAR, y, W-MAR*2, 35).fill(GRIS);
    doc.fillColor('#888').fontSize(7.5).font('Helvetica')
       .text('* La rentabilidad es NETA, calculada después de descontar el fee de éxito (15% sobre la utilidad bruta) e impuestos (25% sobre la utilidad neta). Los montos expresados en euros (€).', 
              MAR+10, y+8, { width: W-MAR*2-20 });

    footerPage(doc, currentPage, TOTAL_PAGES);

    // ── PÁGINA FINAL: GRACIAS ────────────────────────────────────────────
    doc.addPage();
    currentPage++;

    doc.rect(0, 0, W, H).fill(NEGRO);
    doc.rect(0, H/2 - 2, W, 4).fill(NARANJA);

    doc.fillColor(BLANCO).fontSize(36).font('Helvetica-Bold')
       .text('Muchas Gracias', 0, H/2 - 80, { align: 'center', width: W });
    doc.fillColor('rgba(255,255,255,0.5)').fontSize(13).font('Helvetica')
       .text(`${usuario.nombre}, gracias por confiar en DIGSA.`, 0, H/2 - 30, { align: 'center', width: W });
    doc.fillColor('rgba(255,255,255,0.3)').fontSize(10)
       .text('digsa.es  ·  Villanueva 27, Madrid  ·  La Pampa 1517 3°C, Buenos Aires', 
              0, H/2 + 40, { align: 'center', width: W });

    footerPage(doc, currentPage, TOTAL_PAGES);
    doc.end();
  });
}

// ─── GENERADOR DE REPORTE ────────────────────────────────────────────────────

async function generarPDFReporte(data) {
  const {
    usuario,          // { nombre, apellido, email }
    fecha,            // fecha del reporte
    inversion_inicial,
    valor_actual,
    rentabilidad_total,
    tir,
    pisos_activos,    // [{ nombre, costo, venta_est, aporte, neto_est, rent }]
    inversiones_finalizadas, // [{ piso, inversion, venta, aporte, liquidacion, rent, destino }]
    aportes,          // [{ fecha, usd, eur, descripcion }]
    pendiente,
  } = data;

  const FILAS_POR_PAG = 8;
  const totalFinalizadas = inversiones_finalizadas.length;
  const paginasHistorico = Math.ceil(totalFinalizadas / FILAS_POR_PAG);
  const TOTAL_PAGES = 1 + Math.max(1, paginasHistorico) + 1; // portada + historico + gracias

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 0, size: 'A4' });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    let currentPage = 1;

    // ── PÁGINA 1: RESUMEN EJECUTIVO ─────────────────────────────────────
    headerPage(doc, 'REPORTE DE INVERSIÓN', `${usuario.nombre} ${usuario.apellido}`, fmtDate(fecha));

    let y = 130;

    // KPIs — 4 en fila
    const kpiW4 = (W - MAR*2 - 30) / 4;
    kpiBox(doc, MAR,              y, kpiW4, 65, 'Inversión inicial',   fmt(inversion_inicial), NEGRO);
    kpiBox(doc, MAR+kpiW4+10,     y, kpiW4, 65, 'Valor actual',         fmt(valor_actual), VERDE);
    kpiBox(doc, MAR+kpiW4*2+20,   y, kpiW4, 65, 'Rentabilidad total',   fmtPct(rentabilidad_total), NARANJA);
    kpiBox(doc, MAR+kpiW4*3+30,   y, kpiW4, 65, 'TIR anualizada',       fmtPct(tir || 0), '#1A2B6B');
    y += 80;

    // Pisos activos
    if (pisos_activos.length > 0) {
      const COLS_ACT = [
        { x: MAR,     w: 160, label: 'Inmueble' },
        { x: MAR+160, w: 75,  label: 'Costo est.', align: 'right' },
        { x: MAR+235, w: 75,  label: 'Venta est.', align: 'right' },
        { x: MAR+310, w: 70,  label: 'Aporte', align: 'right' },
        { x: MAR+380, w: 80,  label: 'Neto est.', align: 'right', color: VERDE },
        { x: MAR+460, w: W-MAR-464, label: 'Rent.', align: 'right', color: NARANJA },
      ];
      y = sectionTitle(doc, y, 'Estado de inversión — pisos activos');
      y = tableHeader(doc, y, COLS_ACT);
      pisos_activos.forEach((p, i) => {
        y = tableRow(doc, y, COLS_ACT, [
          p.nombre, fmt(p.costo), fmt(p.venta_est),
          fmt(p.aporte), fmt(p.neto_est), fmtPct(p.rent),
        ], i%2===0 ? GRIS : BLANCO);
      });
      y += 8;
    }

    // Pendiente
    if (pendiente > 0) {
      doc.rect(MAR, y, W-MAR*2, 24).fill('#FFF0EB');
      doc.rect(MAR, y, 4, 24).fill(NARANJA);
      doc.fillColor(NARANJA).fontSize(9).font('Helvetica-Bold')
         .text('PENDIENTE DE INVERSIÓN:', MAR+12, y+8, { continued: true });
      doc.fillColor(NEGRO).font('Helvetica')
         .text('  ' + fmt(pendiente));
      y += 30;
    }

    footerPage(doc, currentPage, TOTAL_PAGES);

    // ── PÁGINAS DE HISTÓRICO ─────────────────────────────────────────────
    doc.addPage();
    currentPage++;
    headerPage(doc, 'REPORTE DE INVERSIÓN', `${usuario.nombre} ${usuario.apellido}`, fmtDate(fecha));
    y = 130;

    // Aportes y retiros
    const COLS_AP = [
      { x: MAR,     w: 80,  label: 'Fecha' },
      { x: MAR+80,  w: 75,  label: 'USD', align: 'right' },
      { x: MAR+155, w: 75,  label: 'EUR', align: 'right' },
      { x: MAR+230, w: W-MAR-234, label: 'Descripción' },
    ];
    y = sectionTitle(doc, y, 'Aportes y retiros');
    y = tableHeader(doc, y, COLS_AP);
    aportes.forEach((a, i) => {
      const bg = i%2===0 ? GRIS : BLANCO;
      const color = a.tipo === 'retiro' ? '#B52222' : NEGRO;
      y = tableRow(doc, y, COLS_AP.map(c => ({...c, color})), [
        fmtDate(a.fecha),
        a.usd ? fmt(a.usd) : '—',
        fmt(a.eur),
        a.descripcion || '—',
      ], bg);
    });
    y += 12;

    // Inversiones finalizadas — con paginación
    const COLS_FIN = [
      { x: MAR,     w: 130, label: 'Inmueble' },
      { x: MAR+130, w: 65,  label: 'Inversión', align: 'right' },
      { x: MAR+195, w: 65,  label: 'Venta', align: 'right' },
      { x: MAR+260, w: 60,  label: 'Aporte', align: 'right' },
      { x: MAR+320, w: 65,  label: 'Liquidación', align: 'right', color: VERDE },
      { x: MAR+385, w: 50,  label: 'Rent.', align: 'right', color: NARANJA },
      { x: MAR+435, w: W-MAR-439, label: 'Destino' },
    ];

    y = sectionTitle(doc, y, `Inversiones finalizadas (${totalFinalizadas})`);
    y = tableHeader(doc, y, COLS_FIN);

    let totalAporte = 0, totalLiq = 0;
    for (let i = 0; i < inversiones_finalizadas.length; i++) {
      // Nueva página si no entra
      if (y > H - 120) {
        footerPage(doc, currentPage, TOTAL_PAGES);
        doc.addPage();
        currentPage++;
        headerPage(doc, 'REPORTE DE INVERSIÓN', `${usuario.nombre} ${usuario.apellido}`, fmtDate(fecha));
        y = 130;
        y = sectionTitle(doc, y, 'Inversiones finalizadas (continuación)');
        y = tableHeader(doc, y, COLS_FIN);
      }

      const f = inversiones_finalizadas[i];
      totalAporte += f.aporte || 0;
      totalLiq    += f.liquidacion || 0;
      y = tableRow(doc, y, COLS_FIN, [
        f.piso, fmt(f.inversion), fmt(f.venta),
        fmt(f.aporte), fmt(f.liquidacion), fmtPct(f.rent),
        f.destino || '—',
      ], i%2===0 ? GRIS : BLANCO);
    }

    // Total row
    doc.rect(MAR, y, W-MAR*2, 20).fill(NEGRO);
    doc.fillColor(BLANCO).fontSize(8).font('Helvetica-Bold')
       .text('TOTAL', MAR+4, y+6)
       .text(fmt(totalAporte), MAR+264, y+6, { width: 56, align: 'right' })
       .text(fmt(totalLiq),    MAR+324, y+6, { width: 61, align: 'right' });
    y += 24;

    footerPage(doc, currentPage, TOTAL_PAGES);

    // ── PÁGINA FINAL: GRACIAS ────────────────────────────────────────────
    doc.addPage();
    currentPage++;
    doc.rect(0, 0, W, H).fill(NEGRO);
    doc.rect(0, H/2 - 2, W, 4).fill(NARANJA);
    doc.fillColor(BLANCO).fontSize(36).font('Helvetica-Bold')
       .text('Muchas Gracias', 0, H/2 - 80, { align: 'center', width: W });
    doc.fillColor('rgba(255,255,255,0.5)').fontSize(13).font('Helvetica')
       .text(`${usuario.nombre}, gracias por confiar en DIGSA.`, 0, H/2 - 30, { align: 'center', width: W });
    doc.fillColor('rgba(255,255,255,0.3)').fontSize(10)
       .text('digsa.es  ·  Villanueva 27, Madrid  ·  La Pampa 1517 3°C, Buenos Aires',
              0, H/2 + 40, { align: 'center', width: W });
    footerPage(doc, currentPage, TOTAL_PAGES);

    doc.end();
  });
}

module.exports = { generarPDFLiquidacion, generarPDFReporte };
