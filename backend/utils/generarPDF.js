/**
 * DIGSA — Generador de PDFs
 * Usa imágenes originales como fondo y superpone datos
 */
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

const FONDOS = require('./pdfFondos');

const W = 595.28;  // A4 en puntos
const H = 841.89;
const MAR = 42;

// Colores
const BLANCO  = '#FFFFFF';
const NEGRO   = '#1A1A1A';
const NARANJA = '#FF4D0F';
const VERDE   = '#1A6B3C';
const GRIS    = '#F5F5F5';
const GRIS2   = '#E0E0E0';
const AZUL_HD = '#304c58';

const fmtEur = n => '€' + Number(n||0).toLocaleString('es-ES', {minimumFractionDigits:2});
const fmtPct = n => (Number(n||0)>=0?'+':'') + (Number(n||0)*100).toFixed(2)+'%';
const fmtDate = d => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('es-ES',{day:'2-digit',month:'long',year:'numeric'}); }
  catch { return String(d); }
};

// Convertir data URI a buffer
function dataUriToBuffer(dataUri) {
  const base64 = dataUri.split(',')[1];
  return Buffer.from(base64, 'base64');
}

// ── DIBUJAR FONDO ────────────────────────────────────────────────────────────
function drawBg(doc, key) {
  const buf = dataUriToBuffer(FONDOS[key]);
  doc.image(buf, 0, 0, { width: W, height: H });
}

// ── HEADER PÁGINAS INTERNAS ──────────────────────────────────────────────────
function drawInternalHeader(doc, titulo, nombre, fecha) {
  // Fondo oscuro del header original
  const buf = dataUriToBuffer(FONDOS['liq_interna']);
  // Solo mostrar la parte del header (top 15%)
  doc.image(buf, 0, 0, { width: W, height: H });
  // Cubrir el resto con blanco para datos limpios
  doc.rect(0, H*0.17, W, H*0.83).fill(BLANCO);
  
  // Texto en el header
  doc.fillColor(BLANCO).font('Helvetica-Bold').fontSize(11)
     .text(titulo, MAR, 22, {width: W/2});
  doc.fillColor('rgba(255,255,255,0.7)').font('Helvetica').fontSize(9)
     .text(nombre, MAR, 38);
  doc.fillColor(NARANJA).fontSize(8)
     .text(fecha, MAR, 52);
}

// ── FOOTER ───────────────────────────────────────────────────────────────────
function drawFooter(doc, pag, total) {
  const y = H - 30;
  doc.fillColor(AZUL_HD).rect(0, y, W, 30).fill();
  doc.fillColor('rgba(255,255,255,0.4)').font('Helvetica').fontSize(7)
     .text('digsa.es  ·  Villanueva 27, Madrid  ·  La Pampa 1517 3°C, Buenos Aires',
            MAR, y+8, {width: W-MAR*2, align:'center'});
  doc.fillColor('rgba(255,255,255,0.3)').fontSize(7)
     .text(`${pag}/${total}`, W-MAR-15, y+8);
}

// ── KPI ──────────────────────────────────────────────────────────────────────
function drawKPI(doc, x, y, w, h, label, valor, topColor=NEGRO) {
  doc.rect(x, y, w, h).fill(GRIS).stroke(GRIS2);
  doc.rect(x, y, w, 3).fill(topColor);
  doc.fillColor('#888').font('Helvetica').fontSize(6.5)
     .text(label.toUpperCase(), x+8, y+8, {width:w-16, characterSpacing:0.3});
  doc.fillColor(topColor).font('Helvetica-Bold').fontSize(13)
     .text(valor, x+8, y+19, {width:w-16});
}

// ── SECTION ──────────────────────────────────────────────────────────────────
function drawSection(doc, y, texto) {
  doc.rect(MAR, y, W-MAR*2, 18).fill(AZUL_HD);
  doc.fillColor(BLANCO).font('Helvetica-Bold').fontSize(7.5)
     .text(texto.toUpperCase(), MAR+8, y+5, {characterSpacing:0.5});
  return y+18;
}

// ── TABLE HEADER ─────────────────────────────────────────────────────────────
function drawTHead(doc, y, cols) {
  doc.rect(MAR, y, W-MAR*2, 16).fill('#2A2A2A');
  cols.forEach(c => {
    doc.fillColor(BLANCO).font('Helvetica-Bold').fontSize(7)
       .text(c.label, c.x+3, y+4, {width:c.w-6, align:c.align||'left'});
  });
  return y+16;
}

// ── TABLE ROW ────────────────────────────────────────────────────────────────
function drawTRow(doc, y, cols, vals, bg=null) {
  const rh = 15;
  if (bg) doc.rect(MAR, y, W-MAR*2, rh).fill(bg);
  doc.moveTo(MAR, y+rh).lineTo(W-MAR, y+rh).strokeColor(GRIS2).lineWidth(0.3).stroke();
  cols.forEach((c,i) => {
    const v = vals[i] !== undefined ? String(vals[i]) : '—';
    doc.fillColor(c.color||NEGRO).font(c.bold?'Helvetica-Bold':'Helvetica').fontSize(7.5)
       .text(v, c.x+3, y+3, {width:c.w-6, align:c.align||'left'});
  });
  return y+rh;
}

// ════════════════════════════════════════════════════════════════════════════
// LIQUIDACIÓN
// ════════════════════════════════════════════════════════════════════════════
async function generarPDFLiquidacion(data) {
  const { usuario, fecha, liquidaciones, total_aporte, total_retorno, total_utilidad } = data;
  const nombre = `${usuario.nombre} ${usuario.apellido}`;
  const ROWS = 11;
  const det_pages = Math.max(1, Math.ceil(liquidaciones.length / ROWS));
  const TOTAL = 1 + det_pages + 1;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({margin:0, size:'A4'});
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    let pg = 1;

    // ── Pág 1: Portada con fondo original ───────────────────────────────
    drawBg(doc, 'liq_p1');

    // Datos del inversor superpuestos (zona oscura ~35-50% altura)
    // Cuadro semitransparente para los datos
    doc.rect(MAR, 300, W-MAR*2, 120).fill('rgba(0,0,0,0.55)');
    doc.rect(MAR, 300, 4, 120).fill(NARANJA);

    doc.fillColor(BLANCO).font('Helvetica-Bold').fontSize(18)
       .text(nombre, MAR+14, 315, {width: W-MAR*2-18});
    doc.fillColor('rgba(255,255,255,0.65)').font('Helvetica').fontSize(10)
       .text(usuario.email, MAR+14, 340);
    doc.fillColor(NARANJA).fontSize(9)
       .text(`Fecha de liquidación: ${fmtDate(fecha)}`, MAR+14, 358);

    // KPIs en la portada
    const kw = (W-MAR*2-16)/3;
    const ky = 395;
    drawKPI(doc, MAR,         ky, kw, 55, 'Total aportado',  fmtEur(total_aporte),    NEGRO);
    drawKPI(doc, MAR+kw+8,    ky, kw, 55, 'Total retorno',   fmtEur(total_retorno),   VERDE);
    drawKPI(doc, MAR+kw*2+16, ky, kw, 55, 'Utilidad neta',   fmtEur(total_utilidad),  NARANJA);

    drawFooter(doc, pg, TOTAL);

    // ── Págs detalle ─────────────────────────────────────────────────────
    const COLS = [
      {x:MAR,      w:140, label:'Inmueble'},
      {x:MAR+140,  w:68,  label:'Aporte',       align:'right'},
      {x:MAR+208,  w:65,  label:'Util. bruta',  align:'right'},
      {x:MAR+273,  w:58,  label:'Fee 15%',      align:'right', color:NARANJA},
      {x:MAR+331,  w:58,  label:'Imp. 25%',     align:'right'},
      {x:MAR+389,  w:62,  label:'Util. neta',   align:'right', color:VERDE},
      {x:MAR+451,  w:W-MAR-455, label:'Liquidación', align:'right', bold:true},
    ];

    let y;
    for (let i = 0; i < liquidaciones.length; i++) {
      if (i % ROWS === 0) {
        if (i > 0) { drawFooter(doc, pg, TOTAL); }
        doc.addPage(); pg++;
        
        // Fondo de página interna
        const buf = dataUriToBuffer(FONDOS['liq_interna']);
        doc.image(buf, 0, 0, {width:W, height:H});
        doc.rect(0, H*0.168, W, H*0.832).fill(BLANCO);

        // Header info
        doc.fillColor(BLANCO).font('Helvetica-Bold').fontSize(11)
           .text('LIQUIDACIÓN DE INVERSIÓN', MAR, 20, {width:W/2});
        doc.fillColor('rgba(255,255,255,0.7)').font('Helvetica').fontSize(9)
           .text(nombre, MAR, 36);
        doc.fillColor(NARANJA).fontSize(8).text(fmtDate(fecha), MAR, 50);

        y = H*0.19;
        y = drawSection(doc, y, `Detalle por inmueble${i>0?' (continuación)':' — '+liquidaciones.length+' operaciones'}`);
        y = drawTHead(doc, y, COLS);
      }

      const l = liquidaciones[i];
      y = drawTRow(doc, y, COLS, [
        l.piso, fmtEur(l.aporte), fmtEur(l.utilidad_bruta),
        fmtEur(l.fee), fmtEur(l.impuestos), fmtEur(l.util_neta), fmtEur(l.total),
      ], (i%2===0) ? GRIS : BLANCO);
    }

    // Fila total
    doc.rect(MAR, y, W-MAR*2, 16).fill(AZUL_HD);
    doc.fillColor(BLANCO).font('Helvetica-Bold').fontSize(7.5)
       .text('TOTAL', MAR+3, y+4)
       .text(fmtEur(total_aporte),   MAR+143, y+4, {width:62, align:'right'})
       .text(fmtEur(total_utilidad), MAR+392, y+4, {width:56, align:'right'})
       .text(fmtEur(total_retorno),  MAR+454, y+4, {width:W-MAR-458, align:'right'});

    drawFooter(doc, pg, TOTAL);

    // ── Gracias ──────────────────────────────────────────────────────────
    doc.addPage(); pg++;
    drawBg(doc, 'liq_gracias');
    drawFooter(doc, pg, TOTAL);

    doc.end();
  });
}

// ════════════════════════════════════════════════════════════════════════════
// REPORTE
// ════════════════════════════════════════════════════════════════════════════
async function generarPDFReporte(data) {
  const { usuario, fecha, inversion_inicial, valor_actual, rentabilidad_total,
          tir, pisos_activos, inversiones_finalizadas, aportes, pendiente } = data;
  const nombre = `${usuario.nombre} ${usuario.apellido}`;
  const ROWS = 9;
  const hist_pages = Math.max(1, Math.ceil(inversiones_finalizadas.length / ROWS));
  const TOTAL = 1 + hist_pages + 1;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({margin:0, size:'A4'});
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    let pg = 1;

    // ── Pág 1: Portada con fondo original ───────────────────────────────
    drawBg(doc, 'rep_p1');

    // Datos del inversor
    doc.rect(MAR, 280, W-MAR*2, 130).fill('rgba(0,0,0,0.55)');
    doc.rect(MAR, 280, 4, 130).fill(NARANJA);

    doc.fillColor(BLANCO).font('Helvetica-Bold').fontSize(18)
       .text(nombre, MAR+14, 294, {width:W-MAR*2-18});
    doc.fillColor('rgba(255,255,255,0.65)').font('Helvetica').fontSize(10)
       .text(usuario.email, MAR+14, 318);
    doc.fillColor(NARANJA).fontSize(9)
       .text(`Fecha del reporte: ${fmtDate(fecha)}`, MAR+14, 336);

    // 4 KPIs
    const kw4 = (W-MAR*2-24)/4;
    const ky = 376;
    drawKPI(doc, MAR,           ky, kw4, 55, 'Inversión inicial',  fmtEur(inversion_inicial), NEGRO);
    drawKPI(doc, MAR+kw4+8,     ky, kw4, 55, 'Valor actual',       fmtEur(valor_actual),      VERDE);
    drawKPI(doc, MAR+kw4*2+16,  ky, kw4, 55, 'Rentabilidad total', fmtPct(rentabilidad_total),NARANJA);
    drawKPI(doc, MAR+kw4*3+24,  ky, kw4, 55, 'TIR anualizada',     fmtPct(tir||0),            '#1A2B6B');

    drawFooter(doc, pg, TOTAL);

    // ── Págs historial ───────────────────────────────────────────────────
    const CF_ACT = [
      {x:MAR,     w:150, label:'Inmueble'},
      {x:MAR+150, w:70,  label:'Costo est.',  align:'right'},
      {x:MAR+220, w:70,  label:'Venta est.',  align:'right'},
      {x:MAR+290, w:65,  label:'Aporte',      align:'right'},
      {x:MAR+355, w:72,  label:'Neto est.',   align:'right', color:VERDE},
      {x:MAR+427, w:W-MAR-431, label:'Rent.', align:'right', color:NARANJA},
    ];
    const CF_AP = [
      {x:MAR,     w:82,  label:'Fecha'},
      {x:MAR+82,  w:70,  label:'USD',  align:'right'},
      {x:MAR+152, w:70,  label:'EUR',  align:'right'},
      {x:MAR+222, w:W-MAR-226, label:'Descripción'},
    ];
    const CF_FIN = [
      {x:MAR,     w:125, label:'Inmueble'},
      {x:MAR+125, w:62,  label:'Inversión',   align:'right'},
      {x:MAR+187, w:62,  label:'Venta',       align:'right'},
      {x:MAR+249, w:58,  label:'Aporte',      align:'right'},
      {x:MAR+307, w:65,  label:'Liquidación', align:'right', color:VERDE},
      {x:MAR+372, w:48,  label:'Rent.',       align:'right', color:NARANJA},
      {x:MAR+420, w:W-MAR-424, label:'Destino'},
    ];

    let firstHistPage = true;
    let totAp = 0, totLiq = 0;
    let allRows = [];

    // Armar todas las filas en orden
    if (pisos_activos.length > 0) {
      allRows.push({type:'section', text:`Pisos en cartera (${pisos_activos.length})`});
      allRows.push({type:'thead', cols:CF_ACT});
      pisos_activos.forEach((p,i) => allRows.push({type:'row', cols:CF_ACT, bg:i%2===0?GRIS:BLANCO,
        vals:[p.nombre, fmtEur(p.costo), fmtEur(p.venta_est), fmtEur(p.aporte), fmtEur(p.neto_est), fmtPct(p.rent)]}));
      allRows.push({type:'spacer'});
    }
    if (pendiente > 0) {
      allRows.push({type:'pendiente', valor: fmtEur(pendiente)});
      allRows.push({type:'spacer'});
    }
    allRows.push({type:'section', text:`Aportes y retiros (${aportes.length})`});
    allRows.push({type:'thead', cols:CF_AP});
    aportes.forEach((a,i) => allRows.push({type:'row', cols:CF_AP, bg:i%2===0?GRIS:BLANCO,
      color: a.tipo==='retiro'?'#B52222':NEGRO,
      vals:[fmtDate(a.fecha), a.usd?fmtEur(a.usd):'—', fmtEur(a.eur), a.descripcion||'—']}));
    allRows.push({type:'spacer'});
    allRows.push({type:'section', text:`Inversiones finalizadas (${inversiones_finalizadas.length})`});
    allRows.push({type:'thead', cols:CF_FIN});
    inversiones_finalizadas.forEach((f,i) => {
      totAp += Number(f.aporte||0); totLiq += Number(f.liquidacion||0);
      allRows.push({type:'row', cols:CF_FIN, bg:i%2===0?GRIS:BLANCO,
        vals:[f.piso, fmtEur(f.inversion), fmtEur(f.venta), fmtEur(f.aporte), fmtEur(f.liquidacion), fmtPct(f.rent), f.destino||'—']});
    });
    allRows.push({type:'total-fin', totAp, totLiq});

    // Renderizar filas con paginación
    let y = 0;
    const initPage = () => {
      doc.addPage(); pg++;
      const buf = dataUriToBuffer(FONDOS['rep_interna']);
      doc.image(buf, 0, 0, {width:W, height:H});
      doc.rect(0, H*0.168, W, H*0.832).fill(BLANCO);
      doc.fillColor(BLANCO).font('Helvetica-Bold').fontSize(11)
         .text('REPORTE DE INVERSIÓN', MAR, 20, {width:W/2});
      doc.fillColor('rgba(255,255,255,0.7)').font('Helvetica').fontSize(9).text(nombre, MAR, 36);
      doc.fillColor(NARANJA).fontSize(8).text(fmtDate(fecha), MAR, 50);
      y = H*0.19;
    };
    initPage();

    const checkPage = (needed=15) => {
      if (y + needed > H - 45) { drawFooter(doc, pg, TOTAL); initPage(); }
    };

    for (const row of allRows) {
      if (row.type === 'section') { checkPage(22); y = drawSection(doc, y, row.text); }
      else if (row.type === 'thead') { checkPage(20); y = drawTHead(doc, y, row.cols); }
      else if (row.type === 'row') {
        checkPage(16);
        const savedColor = row.color;
        if (savedColor) row.cols = row.cols.map(c => ({...c, color:c.color||savedColor}));
        y = drawTRow(doc, y, row.cols, row.vals, row.bg);
      }
      else if (row.type === 'spacer') { y += 8; }
      else if (row.type === 'pendiente') {
        checkPage(22);
        doc.rect(MAR, y, W-MAR*2, 20).fill('#FFF5F0');
        doc.rect(MAR, y, 3, 20).fill(NARANJA);
        doc.fillColor(NARANJA).font('Helvetica-Bold').fontSize(8)
           .text('PENDIENTE DE INVERSIÓN', MAR+10, y+6, {continued:true});
        doc.fillColor(NEGRO).font('Helvetica').text(`   ${row.valor}`);
        y += 26;
      }
      else if (row.type === 'total-fin') {
        checkPage(18);
        doc.rect(MAR, y, W-MAR*2, 16).fill(AZUL_HD);
        doc.fillColor(BLANCO).font('Helvetica-Bold').fontSize(7.5)
           .text('TOTAL', MAR+3, y+4)
           .text(fmtEur(row.totAp),  MAR+252, y+4, {width:54, align:'right'})
           .text(fmtEur(row.totLiq), MAR+310, y+4, {width:61, align:'right'});
        y += 18;
      }
    }

    drawFooter(doc, pg, TOTAL);

    // ── Gracias ──────────────────────────────────────────────────────────
    doc.addPage(); pg++;
    drawBg(doc, 'rep_gracias');
    drawFooter(doc, pg, TOTAL);

    doc.end();
  });
}

module.exports = { generarPDFLiquidacion, generarPDFReporte };
