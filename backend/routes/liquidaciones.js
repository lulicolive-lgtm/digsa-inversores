const router = require('express').Router();
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const supabase = require('../utils/supabase');
const { authMiddleware, adminOnly } = require('../middleware/auth');
const { generarYSubirReporte } = require('../utils/generarReporte');

// ── GET /api/liquidaciones ───────────────────────────────────────────────────
router.get('/', authMiddleware, async (req, res) => {
  let query = supabase.from('liquidaciones')
    .select('*, propiedades(nombre,direccion), usuarios(nombre,apellido)');
  if (req.user.rol !== 'admin') query = query.eq('usuario_id', req.user.id);
  const { data } = await query.order('fecha', { ascending: false });
  res.json(data || []);
});

// ── POST /api/liquidaciones/generar ─────────────────────────────────────────
router.post('/generar', authMiddleware, adminOnly, async (req, res) => {
  const { propiedad_id, precio_venta, fecha, fee_exito_pct = 0.15, alquileres = 0, destino = '' } = req.body;
  if (!propiedad_id || !precio_venta || !fecha)
    return res.status(400).json({ error: 'propiedad_id, precio_venta y fecha son requeridos' });

  const { data: prop } = await supabase.from('propiedades').select('*').eq('id', propiedad_id).single();
  if (!prop) return res.status(404).json({ error: 'Propiedad no encontrada' });

  const { data: parts } = await supabase
    .from('participaciones')
    .select('*, usuarios(id,nombre,apellido,email)')
    .eq('propiedad_id', propiedad_id)
    .eq('activo', true);

  if (!parts?.length) return res.status(400).json({ error: 'No hay inversores asignados a esta propiedad' });

  const inversion_total = Number(prop.precio_compra || 0);
  const resultados = [];

  for (const part of parts) {
    const user = part.usuarios;
    const aporte = Number(part.monto_invertido);
    const porcentaje = Number(part.porcentaje);

    const ingresos_totales = Number(precio_venta) + Number(alquileres);
    const utilidad_bruta_piso = ingresos_totales - inversion_total;
    const utilidad_bruta_inv = utilidad_bruta_piso * porcentaje;
    const fee_monto = utilidad_bruta_inv > 0 ? utilidad_bruta_inv * Number(fee_exito_pct) : 0;
    const impuestos_monto = (utilidad_bruta_inv - fee_monto) * 0.25;
    const utilidad_neta = utilidad_bruta_inv - fee_monto - impuestos_monto;
    const total_retorno = aporte + utilidad_neta;
    const rentabilidad_pct = aporte > 0 ? utilidad_neta / aporte : 0;

    const { data: liq } = await supabase.from('liquidaciones').insert([{
      propiedad_id, usuario_id: user.id, fecha,
      precio_venta, aporte_usuario: aporte, porcentaje,
      utilidad_bruta: utilidad_bruta_inv, fee_exito_pct,
      fee_exito_monto: fee_monto, utilidad_neta, total_retorno
    }]).select().single();

    const pdfBuffer = await generarPDFDIGSA({
      prop, user, aporte, porcentaje, utilidad_bruta_inv,
      fee_monto, impuestos_monto, utilidad_neta, total_retorno,
      rentabilidad_pct, inversion_total,
      precio_venta: Number(precio_venta),
      alquileres: Number(alquileres),
      fee_exito_pct: Number(fee_exito_pct),
      fecha, destino
    });

    const pdfPath = `liquidaciones/${propiedad_id}/${user.id}_${fecha}.pdf`;
    const { error: uploadErr } = await supabase.storage
      .from('documentos').upload(pdfPath, pdfBuffer, { contentType: 'application/pdf', upsert: true });

    if (!uploadErr) {
      const { data: urlData } = supabase.storage.from('documentos').getPublicUrl(pdfPath);
      await supabase.from('liquidaciones').update({ pdf_url: urlData.publicUrl }).eq('id', liq.id);
      await supabase.from('documentos').insert([{
        usuario_id: user.id, propiedad_id,
        nombre: `Liquidación ${prop.nombre} - ${fecha}`,
        tipo: 'liquidacion', url: urlData.publicUrl, fecha
      }]);
    }

    await supabase.from('notificaciones').insert([{
      usuario_id: user.id,
      titulo: `Liquidación disponible: ${prop.nombre}`,
      mensaje: `Tu liquidación está lista. Retorno total: €${Math.round(total_retorno).toLocaleString('es-ES')}`,
      tipo: 'liquidacion'
    }]);

    resultados.push({ usuario: `${user.nombre} ${user.apellido}`, total_retorno });
  }

  await supabase.from('propiedades').update({
    estado: 'vendido', precio_venta, fecha_venta: fecha
  }).eq('id', propiedad_id);

  res.json({ ok: true, inversores_liquidados: resultados.length, resultados });
});

// ── GET /api/liquidaciones/:id/pdf ──────────────────────────────────────────
router.get('/:id/pdf', authMiddleware, async (req, res) => {
  const { data: liq } = await supabase
    .from('liquidaciones')
    .select('*, propiedades(*), usuarios(*)')
    .eq('id', req.params.id)
    .single();

  if (!liq) return res.status(404).json({ error: 'Liquidación no encontrada' });
  if (req.user.rol !== 'admin' && liq.usuario_id !== req.user.id)
    return res.status(403).json({ error: 'Sin acceso' });

  const buf = await generarPDFDIGSA({
    prop: liq.propiedades, user: liq.usuarios,
    aporte: liq.aporte_usuario, porcentaje: liq.porcentaje,
    utilidad_bruta_inv: liq.utilidad_bruta, fee_monto: liq.fee_exito_monto,
    impuestos_monto: 0, utilidad_neta: liq.utilidad_neta,
    total_retorno: liq.total_retorno,
    rentabilidad_pct: liq.aporte_usuario > 0 ? liq.utilidad_neta / liq.aporte_usuario : 0,
    inversion_total: liq.propiedades?.precio_compra || 0,
    precio_venta: liq.precio_venta, alquileres: 0,
    fee_exito_pct: liq.fee_exito_pct, fecha: liq.fecha, destino: ''
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="Liquidacion_${liq.propiedades?.nombre}_${liq.fecha}.pdf"`);
  res.send(buf);
});

// ════════════════════════════════════════════════════════════════════════════
//  GENERADOR PDF — DISEÑO DIGSA
// ════════════════════════════════════════════════════════════════════════════
function generarPDFDIGSA(p) {
  return new Promise((resolve, reject) => {
    const { prop, user, aporte, porcentaje, utilidad_bruta_inv, fee_monto,
            impuestos_monto, utilidad_neta, total_retorno, rentabilidad_pct,
            inversion_total, precio_venta, alquileres, fee_exito_pct, fecha, destino } = p;

    const AZUL  = '#006391';
    const AZUL2 = '#3C78D8';
    const GRIS  = '#F3F3F3';
    const AZUF  = '#EEF4FB';
    const ROJO  = '#CC0000';
    const W = 595.28, H = 841.89, ML = 42, MR = 42, CW = W - ML - MR;

    const fmtN = (n, d = 2) => {
      if (n == null) return '';
      const f = Math.abs(n).toFixed(d).replace(/\B(?=(\d{3})+(?!\d))/g, 'X').replace('.', ',').replace(/X/g, '.');
      return `€ ${n < 0 ? '-' : ''}${f}`;
    };
    const fmtP = p2 => `${(p2 * 100).toFixed(2).replace('.', ',')}%`;
    const fmtD = d2 => {
      if (!d2) return '';
      const dt = new Date(d2);
      const m = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
      return `${String(dt.getDate()).padStart(2,'0')}/${m[dt.getMonth()]}/${dt.getFullYear()}`;
    };

    const doc = new PDFDocument({ size: 'A4', margin: 0, autoFirstPage: true });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // ── HEADER ──────────────────────────────────────────────────────────────
    const HH = 200;
    const bgPath = path.join(__dirname, '../assets/bg_header.png');
    if (fs.existsSync(bgPath)) {
      try { doc.image(bgPath, 0, 0, { width: W, height: HH }); } catch(e) {}
    }
    doc.save().rect(0, 0, W, HH).fill(AZUL).opacity(0.8).restore();
    doc.opacity(1);

    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(26)
       .text('Liquidación de Inversiones', ML, 28);
    doc.font('Helvetica').fontSize(12)
       .text(fmtD(fecha), W - MR - 100, 35, { width: 100, align: 'right' });
    doc.moveTo(ML, 65).lineTo(W - MR, 65).strokeColor('#FFFFFF').lineWidth(0.4).stroke();

    doc.font('Helvetica-Bold').fontSize(22)
       .text(`${user.nombre} ${user.apellido}`, ML, 88);

    doc.font('Helvetica-Bold').fontSize(12)
       .text('Argentina', W - MR - 200, 105, { width: 200, align: 'right' });
    doc.font('Helvetica').fontSize(10)
       .text('La Pampa 1517 3 "C", Buenos Aires', W - MR - 200, 120, { width: 200, align: 'right' });
    doc.font('Helvetica-Bold').fontSize(12)
       .text('España', W - MR - 200, 145, { width: 200, align: 'right' });
    doc.font('Helvetica').fontSize(10)
       .text('Villanueva 27, Madrid', W - MR - 200, 160, { width: 200, align: 'right' });

    // ── BARRA ────────────────────────────────────────────────────────────────
    const BY = HH + 4;
    doc.rect(0, BY, W, 30).fill(AZUL2);
    doc.font('Helvetica-Bold').fontSize(13).fillColor('#FFFFFF')
       .text('LIQUIDACION POR VENTA', ML, BY + 9);

    // ── CABECERA TABLA ────────────────────────────────────────────────────────
    const HY = BY + 30 + 2, HH2 = 28, RH = 24;
    const COL = [ML, ML + 160, ML + 255, ML + 345, ML + 430];
    const LABS = ['Inmueble', 'Fecha de inicio', 'Fecha de venta', 'Participación', 'Inversión total'];

    doc.rect(ML, HY, CW, HH2).fill(AZUL2);
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#FFFFFF');
    LABS.forEach((l, i) => doc.text(l, COL[i] + 3, HY + 10, { width: (COL[i+1] || W-MR) - COL[i] - 6 }));

    // Fila piso
    const DY = HY + HH2;
    doc.rect(ML, DY, CW, RH).fill(AZUF);
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#000')
       .text((prop.nombre || '').toUpperCase(), COL[0]+3, DY+8, { width: 152 });
    doc.font('Helvetica').fontSize(8);
    doc.text(fmtD(prop.fecha_compra), COL[1]+3, DY+8);
    doc.text(fmtD(fecha), COL[2]+3, DY+8);
    doc.text(fmtN(aporte), COL[3]+3, DY+8, { width: 82, align: 'right' });
    doc.text(fmtN(inversion_total, 0), COL[4]+3, DY+8, { width: W-MR-COL[4]-6, align: 'right' });

    // ── FILAS DETALLE ─────────────────────────────────────────────────────────
    let Y = DY + RH + 8;
    const row = (label, pct2, amt, opts = {}) => {
      const { bold = false, bg = null, ac = '#000' } = opts;
      const rh = RH - 2;
      if (bg) doc.rect(ML, Y, CW, rh).fill(bg);
      const fn = bold ? 'Helvetica-Bold' : 'Helvetica';
      doc.font(fn).fontSize(9).fillColor('#000').text(label, ML+6, Y+7, { width: 260 });
      if (pct2) doc.font('Helvetica').fontSize(8).fillColor('#555').text(pct2, ML+250, Y+7, { width: 80, align: 'center' });
      if (amt != null) doc.font(fn).fontSize(9).fillColor(ac).text(amt, W-MR-130, Y+7, { width: 124, align: 'right' });
      doc.moveTo(ML, Y+rh).lineTo(W-MR, Y+rh).strokeColor('#E0E0E0').lineWidth(0.3).stroke();
      Y += rh;
    };

    const ingresos_totales = precio_venta + alquileres;
    const pct_part = inversion_total > 0 ? aporte / inversion_total : porcentaje;
    const imp = impuestos_monto || Math.max(0, utilidad_bruta_inv - fee_monto - utilidad_neta);

    row('PRECIO DE VENTA', null, fmtN(precio_venta, 0), { bold: true, bg: '#F7F7F7' });
    row('ALQUILERES', null, fmtN(alquileres, 0), { bold: true });
    row('INGRESOS TOTALES', null, fmtN(ingresos_totales, 0), { bold: true, bg: '#F7F7F7' });

    Y += 4;
    doc.moveTo(ML, Y).lineTo(W-MR, Y).strokeColor('#CCCCCC').lineWidth(0.5).stroke();
    Y += 4;

    row('APORTE', fmtP(pct_part), fmtN(aporte), { bold: true, bg: AZUF });
    row('UTILIDAD BRUTA', fmtP(aporte > 0 ? utilidad_bruta_inv/aporte : 0), fmtN(utilidad_bruta_inv));
    row('FEE DE ÉXITO', fmtP(fee_exito_pct), fmtN(-fee_monto), { bg: '#F7F7F7', ac: ROJO });
    row('IMPUESTOS', '25,00%', fmtN(-imp), { ac: ROJO });
    row('RENTABILIDAD NETA', fmtP(rentabilidad_pct), fmtN(utilidad_neta), { bold: true, bg: AZUF });
    row('RENTABILIDAD ANUAL', fmtP(rentabilidad_pct), null, { bold: true });

    // ── LIQUIDACIÓN TOTAL ─────────────────────────────────────────────────────
    Y += 4;
    doc.rect(ML, Y, CW, 32).fill(GRIS);
    doc.moveTo(ML, Y).lineTo(W-MR, Y).strokeColor(AZUL).lineWidth(1.5).stroke();
    doc.moveTo(ML, Y+32).lineTo(W-MR, Y+32).strokeColor(AZUL).lineWidth(1.5).stroke();
    doc.font('Helvetica-Bold').fontSize(13).fillColor(AZUL)
       .text('LIQUIDACIÓN', ML+6, Y+10);
    doc.text(fmtN(total_retorno), W-MR-136, Y+10, { width: 130, align: 'right' });
    Y += 32 + 20;

    // ── DESTINO ───────────────────────────────────────────────────────────────
    if (destino) {
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#333').text('DESTINO DE LOS FONDOS:', ML, Y);
      doc.font('Helvetica').fontSize(9).fillColor('#333').text(destino, ML + 165, Y);
      Y += 20;
    }

    // ── NOTA ─────────────────────────────────────────────────────────────────
    Y += 8;
    doc.font('Helvetica-Oblique').fontSize(7.5).fillColor('#888')
       .text('* La rentabilidad estimada es NETA (después de pagar impuestos y fee de éxito).', ML, Y);

    // ── PIE ───────────────────────────────────────────────────────────────────
    doc.rect(0, H-50, W, 50).fill(AZUL);
    doc.font('Helvetica').fontSize(8).fillColor('#FFFFFF');
    doc.text('DIGSA Real Estate · digsa.es', ML, H-33);
    doc.text(`Generado el ${fmtD(new Date())}`, W-MR-120, H-33, { width: 120, align: 'right' });

    doc.end();
  });
}

module.exports = router;
