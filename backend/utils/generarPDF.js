/**
 * DIGSA — Generador de PDFs
 * Liquidación y Reporte de Inversión
 */
const PDFDocument = require('pdfkit');

const W = 595.28;
const H = 841.89;
const MAR = 45;
const NEGRO   = '#1A1A1A';
const NARANJA = '#FF4D0F';
const BLANCO  = '#FFFFFF';
const GRIS    = '#F7F7F7';
const GRIS2   = '#E8E8E8';
const VERDE   = '#1A6B3C';
const NEGRO2  = '#2E2E2E';

const fmtEur = n => '€' + Number(n || 0).toLocaleString('es-ES', { minimumFractionDigits: 2 });
const fmtPct = n => (Number(n || 0) >= 0 ? '+' : '') + (Number(n || 0) * 100).toFixed(2) + '%';
const fmtDate = d => {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
  } catch { return d; }
};

// ── HEADER ──────────────────────────────────────────────────────────────────
function drawHeader(doc, titulo, nombre, fecha) {
  doc.rect(0, 0, W, 100).fill(NEGRO);
  doc.rect(0, 100, W, 3).fill(NARANJA);

  // Logo
  doc.fillColor(BLANCO).font('Helvetica-Bold').fontSize(22).text('DIGSA', MAR, 28);
  doc.fillColor(NARANJA).font('Helvetica').fontSize(7).text('E S P A Ñ A', MAR, 53, { characterSpacing: 2 });

  // Título + nombre + fecha
  doc.fillColor(BLANCO).font('Helvetica-Bold').fontSize(14)
     .text(titulo, 0, 22, { align: 'right', width: W - MAR });
  doc.fillColor('rgba(255,255,255,0.65)').font('Helvetica').fontSize(10)
     .text(nombre, 0, 42, { align: 'right', width: W - MAR });
  doc.fillColor(NARANJA).font('Helvetica').fontSize(9)
     .text(fecha, 0, 60, { align: 'right', width: W - MAR });
}

// ── FOOTER ──────────────────────────────────────────────────────────────────
function drawFooter(doc, pag, total) {
  const y = H - 42;
  doc.rect(0, y, W, 42).fill(NEGRO2);
  doc.fillColor('rgba(255,255,255,0.4)').font('Helvetica').fontSize(7.5)
     .text('Villanueva 27, Madrid  ·  La Pampa 1517 3°C, Buenos Aires  ·  digsa.es',
            MAR, y + 8, { width: W - MAR*2, align: 'center' });
  doc.fillColor('rgba(255,255,255,0.25)').fontSize(7)
     .text('Rentabilidad NETA después de fee de éxito (15%) e impuestos (25%)',
            MAR, y + 22, { width: W - MAR*2, align: 'center' });
  doc.fillColor('rgba(255,255,255,0.3)').fontSize(7)
     .text(`${pag} / ${total}`, W - MAR - 20, y + 8);
}

// ── KPI BOX ─────────────────────────────────────────────────────────────────
function drawKPI(doc, x, y, w, h, label, valor, color = NEGRO, bgColor = GRIS) {
  doc.rect(x, y, w, h).fill(bgColor);
  doc.rect(x, y, w, 3).fill(color);
  doc.fillColor('#888').font('Helvetica').fontSize(7)
     .text(label.toUpperCase(), x + 10, y + 10, { width: w - 20, characterSpacing: 0.3 });
  doc.fillColor(color).font('Helvetica-Bold').fontSize(15)
     .text(valor, x + 10, y + 22, { width: w - 20 });
}

// ── SECTION TITLE ────────────────────────────────────────────────────────────
function drawSection(doc, y, texto) {
  doc.rect(MAR, y, W - MAR*2, 20).fill(NEGRO);
  doc.fillColor(BLANCO).font('Helvetica-Bold').fontSize(8)
     .text(texto.toUpperCase(), MAR + 10, y + 6, { characterSpacing: 0.8 });
  return y + 20;
}

// ── TABLE ────────────────────────────────────────────────────────────────────
function drawTableHeader(doc, y, cols) {
  doc.rect(MAR, y, W - MAR*2, 18).fill('#333333');
  cols.forEach(col => {
    doc.fillColor(BLANCO).font('Helvetica-Bold').fontSize(7.5)
       .text(col.label, col.x + 3, y + 5, { width: col.w - 6, align: col.align || 'left' });
  });
  return y + 18;
}

function drawTableRow(doc, y, cols, vals, bg = null, textColor = NEGRO) {
  const h = 17;
  if (bg) doc.rect(MAR, y, W - MAR*2, h).fill(bg);
  else {
    doc.moveTo(MAR, y + h).lineTo(W - MAR, y + h).stroke(GRIS2);
  }
  cols.forEach((col, i) => {
    const v = vals[i] !== undefined ? String(vals[i]) : '—';
    const c = col.color || textColor;
    doc.fillColor(c).font(col.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8)
       .text(v, col.x + 3, y + 4, { width: col.w - 6, align: col.align || 'left' });
  });
  return y + h;
}

// ════════════════════════════════════════════════════════════════════════════
// PDF LIQUIDACIÓN
// ════════════════════════════════════════════════════════════════════════════
async function generarPDFLiquidacion(data) {
  const { usuario, propiedad, fecha, liquidaciones, total_aporte, total_retorno, total_utilidad } = data;
  const nombre_completo = `${usuario.nombre} ${usuario.apellido}`;
  const ROWS_PER_PAGE = 10;
  const detail_pages = Math.max(1, Math.ceil(liquidaciones.length / ROWS_PER_PAGE));
  const TOTAL_PAGES = 1 + detail_pages + 1;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 0, size: 'A4' });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    let page = 1;

    // ── Pág 1: Portada + KPIs + inicio tabla ─────────────────────────────
    drawHeader(doc, 'LIQUIDACIÓN DE INVERSIÓN', nombre_completo, fmtDate(fecha));

    let y = 118;

    // Info inversor
    doc.fillColor(NEGRO).font('Helvetica-Bold').fontSize(12)
       .text(nombre_completo, MAR, y);
    doc.fillColor('#666').font('Helvetica').fontSize(9)
       .text(usuario.email, MAR, y + 14);
    y += 38;

    // KPIs
    const kw = (W - MAR*2 - 20) / 3;
    drawKPI(doc, MAR,          y, kw, 60, 'Total aportado',   fmtEur(total_aporte),    NEGRO);
    drawKPI(doc, MAR+kw+10,    y, kw, 60, 'Total retorno',    fmtEur(total_retorno),   VERDE,   '#EBF5EF');
    drawKPI(doc, MAR+kw*2+20,  y, kw, 60, 'Utilidad neta',    fmtEur(total_utilidad),  NARANJA, '#FFF0EB');
    y += 74;

    // Tabla
    const COLS = [
      { x: MAR,       w: 145, label: 'Inmueble' },
      { x: MAR+145,   w: 72,  label: 'Aporte',       align: 'right' },
      { x: MAR+217,   w: 68,  label: 'Util. bruta',  align: 'right' },
      { x: MAR+285,   w: 60,  label: 'Fee 15%',      align: 'right', color: NARANJA },
      { x: MAR+345,   w: 60,  label: 'Imp. 25%',     align: 'right' },
      { x: MAR+405,   w: 65,  label: 'Util. neta',   align: 'right', color: VERDE },
      { x: MAR+470,   w: W-MAR-474, label: 'Liquidación', align: 'right', bold: true },
    ];

    y = drawSection(doc, y, `Detalle por inmueble — ${liquidaciones.length} operaciones`);
    y = drawTableHeader(doc, y, COLS);

    for (let i = 0; i < liquidaciones.length; i++) {
      if (y > H - 80) {
        drawFooter(doc, page, TOTAL_PAGES);
        doc.addPage();
        page++;
        drawHeader(doc, 'LIQUIDACIÓN DE INVERSIÓN', nombre_completo, fmtDate(fecha));
        y = 118;
        y = drawSection(doc, y, 'Detalle (continuación)');
        y = drawTableHeader(doc, y, COLS);
      }
      const l = liquidaciones[i];
      const bg = i % 2 === 0 ? GRIS : BLANCO;
      y = drawTableRow(doc, y, COLS, [
        l.piso,
        fmtEur(l.aporte),
        fmtEur(l.utilidad_bruta),
        fmtEur(l.fee),
        fmtEur(l.impuestos),
        fmtEur(l.util_neta),
        fmtEur(l.total),
      ], bg);
    }

    // Fila total
    doc.rect(MAR, y, W-MAR*2, 18).fill(NEGRO);
    doc.fillColor(BLANCO).font('Helvetica-Bold').fontSize(8)
       .text('TOTAL', MAR+3, y+5)
       .text(fmtEur(total_aporte),   MAR+148, y+5, { width: 66, align: 'right' })
       .text(fmtEur(total_utilidad), MAR+408, y+5, { width: 60, align: 'right' })
       .text(fmtEur(total_retorno),  MAR+473, y+5, { width: W-MAR-477, align: 'right' });
    y += 24;

    // Nota
    doc.rect(MAR, y, W-MAR*2, 28).fill(GRIS);
    doc.rect(MAR, y, 3, 28).fill(NARANJA);
    doc.fillColor('#777').font('Helvetica').fontSize(7.5)
       .text('La rentabilidad es NETA: fee de éxito 15% sobre utilidad bruta + impuestos 25% sobre utilidad neta. Montos en euros (€).',
              MAR+10, y+7, { width: W-MAR*2-20 });

    drawFooter(doc, page, TOTAL_PAGES);

    // ── Página final: Gracias ─────────────────────────────────────────────
    doc.addPage();
    page++;
    doc.rect(0, 0, W, H).fill(NEGRO);
    doc.rect(0, H*0.5 - 2, W, 4).fill(NARANJA);
    doc.fillColor(BLANCO).font('Helvetica-Bold').fontSize(38)
       .text('Muchas Gracias', 0, H*0.5 - 90, { align: 'center', width: W });
    doc.fillColor('rgba(255,255,255,0.55)').font('Helvetica').fontSize(13)
       .text(`${usuario.nombre}, gracias por confiar en DIGSA España.`, 0, H*0.5 - 35, { align: 'center', width: W });
    doc.fillColor(NARANJA).fontSize(10)
       .text('digsa.es', 0, H*0.5 + 30, { align: 'center', width: W });
    doc.fillColor('rgba(255,255,255,0.3)').fontSize(9)
       .text('Villanueva 27, Madrid  ·  La Pampa 1517 3°C, Buenos Aires', 0, H*0.5 + 48, { align: 'center', width: W });
    drawFooter(doc, page, TOTAL_PAGES);

    doc.end();
  });
}

// ════════════════════════════════════════════════════════════════════════════
// PDF REPORTE
// ════════════════════════════════════════════════════════════════════════════
async function generarPDFReporte(data) {
  const {
    usuario, fecha, inversion_inicial, valor_actual, rentabilidad_total, tir,
    pisos_activos, inversiones_finalizadas, aportes, pendiente
  } = data;
  const nombre_completo = `${usuario.nombre} ${usuario.apellido}`;
  const ROWS_PER_PAGE = 9;
  const pags_hist = Math.max(1, Math.ceil(inversiones_finalizadas.length / ROWS_PER_PAGE));
  const TOTAL_PAGES = 1 + pags_hist + 1;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 0, size: 'A4' });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    let page = 1;

    // ── Pág 1: Resumen ejecutivo ──────────────────────────────────────────
    drawHeader(doc, 'REPORTE DE INVERSIÓN', nombre_completo, fmtDate(fecha));
    let y = 118;

    // 4 KPIs
    const kw4 = (W - MAR*2 - 30) / 4;
    drawKPI(doc, MAR,             y, kw4, 60, 'Inversión inicial',   fmtEur(inversion_inicial), NEGRO);
    drawKPI(doc, MAR+kw4+10,      y, kw4, 60, 'Valor actual',        fmtEur(valor_actual),      VERDE,   '#EBF5EF');
    drawKPI(doc, MAR+kw4*2+20,    y, kw4, 60, 'Rentabilidad total',  fmtPct(rentabilidad_total),NARANJA, '#FFF0EB');
    drawKPI(doc, MAR+kw4*3+30,    y, kw4, 60, 'TIR anualizada',      fmtPct(tir || 0),          '#1A2B6B','#EBF0FA');
    y += 74;

    // Pisos activos
    if (pisos_activos.length > 0) {
      const CA = [
        { x: MAR,      w: 155, label: 'Inmueble' },
        { x: MAR+155,  w: 72,  label: 'Costo est.',  align: 'right' },
        { x: MAR+227,  w: 72,  label: 'Venta est.',  align: 'right' },
        { x: MAR+299,  w: 68,  label: 'Aporte',      align: 'right' },
        { x: MAR+367,  w: 75,  label: 'Neto est.',   align: 'right', color: VERDE },
        { x: MAR+442,  w: W-MAR-446, label: 'Rent.', align: 'right', color: NARANJA },
      ];
      y = drawSection(doc, y, 'Estado actual — Pisos en cartera');
      y = drawTableHeader(doc, y, CA);
      pisos_activos.forEach((p, i) => {
        y = drawTableRow(doc, y, CA, [
          p.nombre, fmtEur(p.costo), fmtEur(p.venta_est),
          fmtEur(p.aporte), fmtEur(p.neto_est), fmtPct(p.rent),
        ], i%2===0 ? GRIS : BLANCO);
      });
      y += 8;
    }

    // Pendiente
    if (pendiente > 0) {
      doc.rect(MAR, y, W-MAR*2, 22).fill('#FFF5F0');
      doc.rect(MAR, y, 3, 22).fill(NARANJA);
      doc.fillColor(NARANJA).font('Helvetica-Bold').fontSize(8.5)
         .text('PENDIENTE DE INVERSIÓN', MAR+10, y+7, { continued: true });
      doc.fillColor(NEGRO).font('Helvetica').fontSize(8.5)
         .text(`   ${fmtEur(pendiente)}`);
      y += 28;
    }

    drawFooter(doc, page, TOTAL_PAGES);

    // ── Pág 2+: Historial ─────────────────────────────────────────────────
    doc.addPage();
    page++;
    drawHeader(doc, 'REPORTE DE INVERSIÓN', nombre_completo, fmtDate(fecha));
    y = 118;

    // Aportes
    const CAP = [
      { x: MAR,      w: 85,  label: 'Fecha' },
      { x: MAR+85,   w: 72,  label: 'USD',  align: 'right' },
      { x: MAR+157,  w: 72,  label: 'EUR',  align: 'right' },
      { x: MAR+229,  w: W-MAR-233, label: 'Descripción' },
    ];
    y = drawSection(doc, y, 'Aportes y retiros');
    y = drawTableHeader(doc, y, CAP);
    aportes.forEach((a, i) => {
      const esRet = a.tipo === 'retiro';
      const color = esRet ? '#B52222' : NEGRO;
      y = drawTableRow(doc, y, CAP.map(c => ({...c, color})), [
        fmtDate(a.fecha),
        a.usd ? fmtEur(a.usd) : '—',
        fmtEur(a.eur),
        a.descripcion || '—',
      ], i%2===0 ? GRIS : BLANCO);
    });
    y += 12;

    // Inversiones finalizadas con paginación
    const CF = [
      { x: MAR,      w: 128, label: 'Inmueble' },
      { x: MAR+128,  w: 65,  label: 'Inversión',   align: 'right' },
      { x: MAR+193,  w: 65,  label: 'Venta',       align: 'right' },
      { x: MAR+258,  w: 62,  label: 'Aporte',      align: 'right' },
      { x: MAR+320,  w: 68,  label: 'Liquidación', align: 'right', color: VERDE },
      { x: MAR+388,  w: 50,  label: 'Rent.',       align: 'right', color: NARANJA },
      { x: MAR+438,  w: W-MAR-442, label: 'Destino' },
    ];

    y = drawSection(doc, y, `Inversiones finalizadas — ${inversiones_finalizadas.length} operaciones`);
    y = drawTableHeader(doc, y, CF);

    let totAp = 0, totLiq = 0;
    for (let i = 0; i < inversiones_finalizadas.length; i++) {
      if (y > H - 80) {
        drawFooter(doc, page, TOTAL_PAGES);
        doc.addPage();
        page++;
        drawHeader(doc, 'REPORTE DE INVERSIÓN', nombre_completo, fmtDate(fecha));
        y = 118;
        y = drawSection(doc, y, 'Inversiones finalizadas (continuación)');
        y = drawTableHeader(doc, y, CF);
      }
      const f = inversiones_finalizadas[i];
      totAp  += Number(f.aporte || 0);
      totLiq += Number(f.liquidacion || 0);
      y = drawTableRow(doc, y, CF, [
        f.piso, fmtEur(f.inversion), fmtEur(f.venta),
        fmtEur(f.aporte), fmtEur(f.liquidacion),
        fmtPct(f.rent), f.destino || '—',
      ], i%2===0 ? GRIS : BLANCO);
    }

    // Total fila
    doc.rect(MAR, y, W-MAR*2, 18).fill(NEGRO);
    doc.fillColor(BLANCO).font('Helvetica-Bold').fontSize(8)
       .text('TOTAL', MAR+3, y+5)
       .text(fmtEur(totAp),  MAR+261, y+5, { width: 56, align: 'right' })
       .text(fmtEur(totLiq), MAR+323, y+5, { width: 63, align: 'right' });
    y += 22;

    drawFooter(doc, page, TOTAL_PAGES);

    // ── Página final: Gracias ─────────────────────────────────────────────
    doc.addPage();
    page++;
    doc.rect(0, 0, W, H).fill(NEGRO);
    doc.rect(0, H*0.5 - 2, W, 4).fill(NARANJA);
    doc.fillColor(BLANCO).font('Helvetica-Bold').fontSize(38)
       .text('Muchas Gracias', 0, H*0.5 - 90, { align: 'center', width: W });
    doc.fillColor('rgba(255,255,255,0.55)').font('Helvetica').fontSize(13)
       .text(`${usuario.nombre}, gracias por confiar en DIGSA España.`, 0, H*0.5 - 35, { align: 'center', width: W });
    doc.fillColor(NARANJA).fontSize(10)
       .text('digsa.es', 0, H*0.5 + 30, { align: 'center', width: W });
    doc.fillColor('rgba(255,255,255,0.3)').fontSize(9)
       .text('Villanueva 27, Madrid  ·  La Pampa 1517 3°C, Buenos Aires', 0, H*0.5 + 48, { align: 'center', width: W });
    drawFooter(doc, page, TOTAL_PAGES);

    doc.end();
  });
}

module.exports = { generarPDFLiquidacion, generarPDFReporte };
