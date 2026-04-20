/**
 * DIGSA — Generador de Reporte de Inversión
 * Replica exactamente el formato de los reportes Excel/PDF existentes.
 * Se llama automáticamente al registrar un aporte o liquidar un piso.
 */

const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const supabase = require('./supabase');

// ── COLORES ──────────────────────────────────────────────────────────────────
const AZUL       = '#006391';
const AZUL2      = '#3C78D8';
const GRIS_FONDO = '#F5F5F5';
const BLANCO     = '#FFFFFF';
const NEGRO      = '#1A1A1A';
const GRIS_TEXT  = '#555555';

// ── HELPERS ──────────────────────────────────────────────────────────────────
const fmtN = (n, d = 2) => {
  if (n == null || isNaN(n)) return '—';
  const f = Math.abs(Number(n)).toFixed(d)
    .replace(/\B(?=(\d{3})+(?!\d))/g, 'X')
    .replace('.', ',')
    .replace(/X/g, '.');
  return `${n < 0 ? '-' : ''}${f} €`;
};
const fmtP = p => `${(Number(p) * 100).toFixed(2).replace('.', ',')}%`;
const fmtD = d => {
  if (!d) return '';
  const dt = new Date(d);
  const m = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  return `${m[dt.getMonth()]}/${dt.getFullYear()}`;
};

// ── OBTENER DATOS DEL INVERSOR ────────────────────────────────────────────────
async function obtenerDatosInversor(usuario_id) {
  // Datos del usuario
  const { data: user } = await supabase
    .from('usuarios').select('*').eq('id', usuario_id).single();

  // Aportes
  const { data: aportes } = await supabase
    .from('aportes')
    .select('*, propiedades(nombre)')
    .eq('usuario_id', usuario_id)
    .order('fecha', { ascending: true });

  // Participaciones activas (pisos en obra)
  const { data: partsActivas } = await supabase
    .from('participaciones')
    .select('*, propiedades(*)')
    .eq('usuario_id', usuario_id)
    .eq('activo', true);

  // Liquidaciones (pisos vendidos)
  const { data: liquidaciones } = await supabase
    .from('liquidaciones')
    .select('*, propiedades(nombre, direccion, precio_compra, precio_venta)')
    .eq('usuario_id', usuario_id)
    .order('fecha', { ascending: true });

  return { user, aportes: aportes || [], partsActivas: partsActivas || [], liquidaciones: liquidaciones || [] };
}

// ── CALCULAR RESUMEN ──────────────────────────────────────────────────────────
function calcularResumen(aportes, partsActivas, liquidaciones) {
  // Inversión inicial = suma de aportes positivos
  const inversion_inicial = aportes
    .filter(a => a.tipo === 'aporte' || !a.tipo)
    .reduce((s, a) => s + Number(a.monto_eur || 0), 0);

  // Valor actual = pisos activos (neto estimado) + liquidaciones pendientes + pendiente sin asignar
  const valor_pisos_activos = partsActivas.reduce((s, p) => {
    const prop = p.propiedades;
    const venta_est = Number(prop?.precio_venta_estimado || prop?.precio_compra * 1.15 || 0);
    const costo = Number(prop?.precio_compra || 0) + Number(prop?.gastos_compra || 0);
    const utilidad_bruta = (venta_est - costo) * Number(p.porcentaje);
    const fee = utilidad_bruta > 0 ? utilidad_bruta * 0.15 : 0;
    const impuestos = (utilidad_bruta - fee) * 0.25;
    return s + Number(p.monto_invertido) + utilidad_bruta - fee - impuestos;
  }, 0);

  const valor_liquidaciones = liquidaciones.reduce((s, l) => s + Number(l.total_retorno || 0), 0);
  const pendiente = liquidaciones.reduce((s, l) => {
    // Si hay liquidación sin destino, el dinero está pendiente
    return s + Number(l.total_retorno || 0);
  }, 0) - partsActivas.reduce((s, p) => s + Number(p.monto_invertido), 0);

  const valor_actual = valor_pisos_activos + (pendiente > 0 ? pendiente : 0);
  const rentabilidad_total = inversion_inicial > 0 ? (valor_actual - inversion_inicial) / inversion_inicial : 0;

  return { inversion_inicial, valor_actual, rentabilidad_total };
}

// ── GENERAR PDF ───────────────────────────────────────────────────────────────
function generarPDF(datos) {
  return new Promise((resolve, reject) => {
    const { user, aportes, partsActivas, liquidaciones } = datos;
    const resumen = calcularResumen(aportes, partsActivas, liquidaciones);

    const W = 595.28, H = 841.89, ML = 40, MR = 40, CW = W - ML - MR;
    const doc = new PDFDocument({ size: 'A4', margin: 0, autoFirstPage: true });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // ── HEADER ──────────────────────────────────────────────────────────────
    const HH = 120;
    const bgPath = path.join(__dirname, '../assets/bg_header.png');
    if (fs.existsSync(bgPath)) {
      try { doc.image(bgPath, 0, 0, { width: W, height: HH }); } catch(e) {}
    }
    doc.save().rect(0, 0, W, HH).fill(AZUL).opacity(0.85).restore();
    doc.opacity(1);

    // Logo DIGSA (texto)
    doc.fillColor(BLANCO).font('Helvetica-Bold').fontSize(22)
       .text('DIGSA', ML, 20);
    doc.font('Helvetica').fontSize(8).fillColor('rgba(255,255,255,0.7)')
       .text('DESARROLLOS', ML, 44);

    // Título reporte
    doc.font('Helvetica').fontSize(11).fillColor(BLANCO)
       .text('Historial de Inversión', ML, 65);
    doc.font('Helvetica-Bold').fontSize(18).fillColor(BLANCO)
       .text(`${user.nombre} ${user.apellido}`, ML, 80);

    // Fecha (derecha)
    const fechaHoy = fmtD(new Date());
    doc.font('Helvetica').fontSize(10).fillColor(BLANCO)
       .text(fechaHoy, W - MR - 100, 35, { width: 100, align: 'right' });

    // Direcciones (derecha)
    doc.font('Helvetica-Bold').fontSize(9).fillColor(BLANCO)
       .text('Argentina', W - MR - 180, 60, { width: 180, align: 'right' });
    doc.font('Helvetica').fontSize(8).fillColor(BLANCO)
       .text('La Pampa 1517 3 "C", Buenos Aires', W - MR - 180, 72, { width: 180, align: 'right' });
    doc.font('Helvetica-Bold').fontSize(9)
       .text('España', W - MR - 180, 88, { width: 180, align: 'right' });
    doc.font('Helvetica').fontSize(8)
       .text('Villanueva 27, Madrid', W - MR - 180, 100, { width: 180, align: 'right' });

    let Y = HH + 12;

    // ── RESUMEN EJECUTIVO ────────────────────────────────────────────────────
    doc.rect(ML, Y, CW, 24).fill(AZUL2);
    doc.font('Helvetica-Bold').fontSize(11).fillColor(BLANCO)
       .text('RESUMEN EJECUTIVO', ML, Y + 7, { width: CW, align: 'center' });
    Y += 24;

    // 4 columnas de resumen
    const cols = [
      { label: 'INVERSION INICIAL:', value: fmtN(resumen.inversion_inicial) },
      { label: 'VALOR ACTUAL:', value: fmtN(resumen.valor_actual) },
      { label: 'RENTABILIDAD TOTAL:', value: fmtP(resumen.rentabilidad_total) },
      { label: 'TASA INTERNA DE RETORNO (TIR):', value: fmtP(resumen.rentabilidad_total / 3) },
    ];
    const cw4 = CW / 4;
    doc.rect(ML, Y, CW, 48).fill(GRIS_FONDO);
    cols.forEach((col, i) => {
      const x = ML + i * cw4;
      doc.font('Helvetica').fontSize(7).fillColor(GRIS_TEXT)
         .text(col.label, x + 6, Y + 8, { width: cw4 - 8 });
      doc.font('Helvetica-Bold').fontSize(13).fillColor(AZUL)
         .text(col.value, x + 6, Y + 20, { width: cw4 - 8 });
    });
    Y += 48 + 10;

    // ── ESTADO DE INVERSION (pisos activos) ──────────────────────────────────
    if (partsActivas.length > 0) {
      doc.rect(ML, Y, CW, 22).fill(AZUL2);
      doc.font('Helvetica-Bold').fontSize(11).fillColor(BLANCO)
         .text('ESTADO DE INVERSION', ML, Y + 6, { width: CW, align: 'center' });
      Y += 22;

      // Cabecera tabla
      const COLS = [ML, ML+150, ML+255, ML+340, ML+415, ML+490];
      const LABS = ['Inmueble', 'Costo estimado', 'Venta estimada', 'Aporte', 'Neto estimado', 'Rentabilidad'];
      doc.rect(ML, Y, CW, 20).fill('#2B6A8A');
      doc.font('Helvetica-Bold').fontSize(8).fillColor(BLANCO);
      LABS.forEach((l, i) => {
        doc.text(l, COLS[i] + 3, Y + 6, { width: (COLS[i+1] || W-MR) - COLS[i] - 6 });
      });
      Y += 20;

      partsActivas.forEach((part, idx) => {
        const prop = part.propiedades;
        const venta_est = Number(prop?.precio_venta_estimado || 0) || Number(prop?.precio_compra || 0) * 1.15;
        const costo = Number(prop?.precio_compra || 0) + Number(prop?.gastos_compra || 0);
        const utilidad = (venta_est - costo) * Number(part.porcentaje);
        const fee = utilidad > 0 ? utilidad * 0.15 : 0;
        const imp = (utilidad - fee) * 0.25;
        const neto = Number(part.monto_invertido) + utilidad - fee - imp;
        const rent = part.monto_invertido > 0 ? (neto - part.monto_invertido) / part.monto_invertido : 0;

        const bg = idx % 2 === 0 ? BLANCO : GRIS_FONDO;
        doc.rect(ML, Y, CW, 20).fill(bg);
        doc.font('Helvetica').fontSize(8).fillColor(NEGRO);
        doc.text((prop?.nombre || '').toUpperCase(), COLS[0]+3, Y+6, { width: 144 });
        doc.text(fmtN(costo, 0), COLS[1]+3, Y+6, { width: 100, align: 'right' });
        doc.text(fmtN(venta_est, 0), COLS[2]+3, Y+6, { width: 80, align: 'right' });
        doc.text(fmtN(part.monto_invertido), COLS[3]+3, Y+6, { width: 72, align: 'right' });
        doc.text(fmtN(neto), COLS[4]+3, Y+6, { width: 72, align: 'right' });
        doc.font('Helvetica-Bold').fillColor(AZUL)
           .text(fmtP(rent), COLS[5]+3, Y+6, { width: 60, align: 'right' });
        Y += 20;
      });
      Y += 8;
    }

    // ── APORTES Y RETIROS ────────────────────────────────────────────────────
    if (aportes.length > 0) {
      doc.rect(ML, Y, CW, 22).fill(AZUL2);
      doc.font('Helvetica-Bold').fontSize(11).fillColor(BLANCO)
         .text('APORTES Y RETIROS', ML, Y + 6, { width: CW, align: 'center' });
      Y += 22;

      const ACOLS = [ML, ML+100, ML+220, ML+340];
      const ALABS = ['Fecha', 'u$s', '€', 'Inmuebles'];
      doc.rect(ML, Y, CW, 20).fill('#2B6A8A');
      doc.font('Helvetica-Bold').fontSize(8).fillColor(BLANCO);
      ALABS.forEach((l, i) => {
        doc.text(l, ACOLS[i]+3, Y+6, { width: (ACOLS[i+1] || W-MR) - ACOLS[i] - 6 });
      });
      Y += 20;

      let total_usd = 0, total_eur = 0;
      aportes.forEach((a, idx) => {
        const bg = idx % 2 === 0 ? BLANCO : GRIS_FONDO;
        doc.rect(ML, Y, CW, 20).fill(bg);
        doc.font('Helvetica').fontSize(8).fillColor(NEGRO);
        doc.text(fmtD(a.fecha), ACOLS[0]+3, Y+6, { width: 94 });
        if (a.monto_usd) doc.text(`u$s ${Number(a.monto_usd).toLocaleString('es-ES')}`, ACOLS[1]+3, Y+6, { width: 116 });
        if (a.monto_eur) doc.text(fmtN(a.monto_eur), ACOLS[2]+3, Y+6, { width: 116 });
        if (a.propiedades?.nombre) doc.text(a.propiedades.nombre, ACOLS[3]+3, Y+6, { width: W-MR-ACOLS[3]-6 });
        total_usd += Number(a.monto_usd || 0);
        total_eur += Number(a.monto_eur || 0);
        Y += 20;
      });

      // Total aportes
      doc.rect(ML, Y, CW, 22).fill('#E8EEF2');
      doc.font('Helvetica-Bold').fontSize(9).fillColor(NEGRO);
      doc.text('TOTAL', ACOLS[0]+3, Y+7);
      doc.text(fmtN(total_eur), ACOLS[2]+3, Y+7, { width: 116 });
      Y += 22 + 8;
    }

    // ── INVERSIONES FINALIZADAS ──────────────────────────────────────────────
    if (liquidaciones.length > 0) {
      doc.rect(ML, Y, CW, 22).fill(AZUL2);
      doc.font('Helvetica-Bold').fontSize(11).fillColor(BLANCO)
         .text('INVERSION FINALIZADAS', ML, Y + 6, { width: CW, align: 'center' });
      Y += 22;

      const LCOLS = [ML, ML+120, ML+200, ML+275, ML+355, ML+415, ML+455];
      const LLABS = ['Inmueble', 'Inversión', 'Venta', 'Aporte', 'Liquidacion', 'Rent.', 'Destino'];
      doc.rect(ML, Y, CW, 20).fill('#2B6A8A');
      doc.font('Helvetica-Bold').fontSize(7).fillColor(BLANCO);
      LLABS.forEach((l, i) => {
        doc.text(l, LCOLS[i]+3, Y+6, { width: (LCOLS[i+1] || W-MR) - LCOLS[i] - 6 });
      });
      Y += 20;

      let tot_aporte = 0, tot_liq = 0;
      liquidaciones.forEach((l, idx) => {
        const rent = l.aporte_usuario > 0 ? l.utilidad_neta / l.aporte_usuario : 0;
        const bg = idx % 2 === 0 ? BLANCO : GRIS_FONDO;
        doc.rect(ML, Y, CW, 20).fill(bg);
        doc.font('Helvetica').fontSize(7).fillColor(NEGRO);
        doc.text((l.propiedades?.nombre || '').toUpperCase(), LCOLS[0]+3, Y+6, { width: 116 });
        doc.text(fmtN(l.propiedades?.precio_compra, 0), LCOLS[1]+3, Y+6, { width: 76, align: 'right' });
        doc.text(fmtN(l.precio_venta, 0), LCOLS[2]+3, Y+6, { width: 72, align: 'right' });
        doc.text(fmtN(l.aporte_usuario), LCOLS[3]+3, Y+6, { width: 76, align: 'right' });
        doc.text(fmtN(l.total_retorno), LCOLS[4]+3, Y+6, { width: 56, align: 'right' });
        doc.font('Helvetica-Bold').fillColor(rent >= 0 ? AZUL : '#CC0000')
           .text(fmtP(rent), LCOLS[5]+3, Y+6, { width: 36, align: 'right' });
        tot_aporte += Number(l.aporte_usuario || 0);
        tot_liq += Number(l.total_retorno || 0);
        Y += 20;
      });

      // Total finalizadas
      doc.rect(ML, Y, CW, 22).fill('#E8EEF2');
      doc.font('Helvetica-Bold').fontSize(9).fillColor(NEGRO);
      doc.text('TOTAL', LCOLS[0]+3, Y+7);
      doc.text(fmtN(tot_aporte), LCOLS[3]+3, Y+7, { width: 76, align: 'right' });
      doc.text(fmtN(tot_liq), LCOLS[4]+3, Y+7, { width: 56, align: 'right' });
      Y += 22 + 8;
    }

    // ── PENDIENTE Y TOTAL ────────────────────────────────────────────────────
    const pendiente = liquidaciones.reduce((s, l) => s + Number(l.total_retorno || 0), 0)
      - partsActivas.reduce((s, p) => s + Number(p.monto_invertido || 0), 0);

    doc.rect(ML, Y, CW, 24).fill('#E8EEF2');
    doc.font('Helvetica-Bold').fontSize(10).fillColor(NEGRO);
    doc.text('PENDIENTE DE INVERSION', ML+6, Y+8);
    doc.text(fmtN(Math.max(0, pendiente)), W-MR-130, Y+8, { width: 124, align: 'right' });
    Y += 24 + 2;

    doc.rect(ML, Y, CW, 24).fill('#D0DCE8');
    doc.font('Helvetica-Bold').fontSize(11).fillColor(AZUL);
    doc.text('TOTAL', ML+6, Y+7);
    doc.text(fmtN(resumen.valor_actual), W-MR-130, Y+7, { width: 124, align: 'right' });
    Y += 24 + 10;

    // ── NOTA FINAL ────────────────────────────────────────────────────────────
    doc.font('Helvetica-Oblique').fontSize(7.5).fillColor('#888')
       .text('* la rentabilidad estimada es NETA (despues de pagar impuestos y fee de exito).', ML, Y);

    // ── PIE ───────────────────────────────────────────────────────────────────
    doc.rect(0, H-45, W, 45).fill(AZUL);
    doc.font('Helvetica').fontSize(8).fillColor(BLANCO);
    doc.text('DIGSA Real Estate · digsa.es', ML, H-28);
    doc.text(`Generado el ${fmtD(new Date())}`, W-MR-120, H-28, { width: 120, align: 'right' });

    doc.end();
  });
}

// ── FUNCIÓN PRINCIPAL — llamar desde otros módulos ───────────────────────────
async function generarYSubirReporte(usuario_id) {
  try {
    const datos = await obtenerDatosInversor(usuario_id);
    if (!datos.user) return null;

    const pdfBuffer = await generarPDF(datos);
    const fechaStr = new Date().toISOString().slice(0, 10);
    const pdfPath = `reportes/${usuario_id}/reporte_${fechaStr}.pdf`;

    const { error } = await supabase.storage
      .from('documentos')
      .upload(pdfPath, pdfBuffer, { contentType: 'application/pdf', upsert: true });

    if (error) throw error;

    const { data: urlData } = supabase.storage.from('documentos').getPublicUrl(pdfPath);

    // Guardar en tabla documentos
    await supabase.from('documentos').insert([{
      usuario_id,
      nombre: `Reporte de Inversión ${fechaStr}`,
      tipo: 'reporte',
      url: urlData.publicUrl,
      fecha: fechaStr,
    }]);

    // Notificar
    await supabase.from('notificaciones').insert([{
      usuario_id,
      titulo: 'Reporte actualizado',
      mensaje: 'Tu reporte de inversión fue actualizado con los últimos movimientos.',
      tipo: 'reporte',
    }]);

    console.log(`✅ Reporte generado para usuario ${usuario_id}`);
    return urlData.publicUrl;

  } catch(e) {
    console.error(`❌ Error generando reporte para ${usuario_id}:`, e.message);
    return null;
  }
}

module.exports = { generarYSubirReporte };
