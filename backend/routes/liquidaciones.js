const router = require('express').Router();
const PDFDocument = require('pdfkit');
const supabase = require('../utils/supabase');
const { authMiddleware, adminOnly } = require('../middleware/auth');

// GET /api/liquidaciones — el inversor ve las suyas
router.get('/', authMiddleware, async (req, res) => {
  let query = supabase.from('liquidaciones')
    .select('*, propiedades(nombre,direccion), usuarios(nombre,apellido)');
  if (req.user.rol !== 'admin') query = query.eq('usuario_id', req.user.id);
  const { data } = await query.order('fecha', { ascending: false });
  res.json(data || []);
});

// POST /api/liquidaciones/generar — generar liquidaciones para TODOS los inversores de un piso
// El admin carga los datos del piso y el sistema crea una liquidación por cada inversor
router.post('/generar', authMiddleware, adminOnly, async (req, res) => {
  const { propiedad_id, precio_venta, fecha, fee_exito_pct = 0.15 } = req.body;
  if (!propiedad_id || !precio_venta || !fecha)
    return res.status(400).json({ error: 'propiedad_id, precio_venta y fecha son requeridos' });

  // 1. Obtener datos del piso
  const { data: prop } = await supabase.from('propiedades').select('*').eq('id', propiedad_id).single();
  if (!prop) return res.status(404).json({ error: 'Propiedad no encontrada' });

  // 2. Obtener todos los participantes
  const { data: parts } = await supabase
    .from('participaciones')
    .select('*, usuarios(id,nombre,apellido,email)')
    .eq('propiedad_id', propiedad_id)
    .eq('activo', true);

  if (!parts?.length) return res.status(400).json({ error: 'No hay inversores asignados a esta propiedad' });

  const costo_total = Number(prop.precio_compra || 0) + Number(prop.gastos_compra || 0);
  const resultados = [];

  for (const part of parts) {
    const aporte = Number(part.monto_invertido);
    const porcentaje = Number(part.porcentaje);
    const ingresos_brutos = Number(precio_venta) * porcentaje;
    const utilidad_bruta = ingresos_brutos - aporte;
    const fee_monto = utilidad_bruta > 0 ? utilidad_bruta * Number(fee_exito_pct) : 0;
    const utilidad_neta = utilidad_bruta - fee_monto;
    const total_retorno = aporte + utilidad_neta;

    // 3. Insertar liquidación
    const { data: liq } = await supabase.from('liquidaciones').insert([{
      propiedad_id, usuario_id: part.usuarios.id, fecha,
      precio_venta, aporte_usuario: aporte, porcentaje,
      utilidad_bruta, fee_exito_pct, fee_exito_monto: fee_monto,
      utilidad_neta, total_retorno
    }]).select().single();

    // 4. Generar PDF en memoria y subir a Supabase Storage
    const pdfBuffer = await generarPDF({ prop, user: part.usuarios, liq: { ...liq, aporte, porcentaje, utilidad_bruta, fee_monto, utilidad_neta, total_retorno }, fecha, precio_venta, fee_exito_pct });
    const pdfPath = `liquidaciones/${propiedad_id}/${part.usuarios.id}_${fecha}.pdf`;
    const { error: uploadErr } = await supabase.storage
      .from('documentos').upload(pdfPath, pdfBuffer, { contentType: 'application/pdf', upsert: true });

    if (!uploadErr) {
      const { data: urlData } = supabase.storage.from('documentos').getPublicUrl(pdfPath);
      await supabase.from('liquidaciones').update({ pdf_url: urlData.publicUrl }).eq('id', liq.id);
      // Crear documento descargable para el inversor
      await supabase.from('documentos').insert([{
        usuario_id: part.usuarios.id, propiedad_id,
        nombre: `Liquidación ${prop.nombre} - ${fecha}`,
        tipo: 'liquidacion', url: urlData.publicUrl, fecha
      }]);
      liq.pdf_url = urlData.publicUrl;
    }

    // 5. Notificar al inversor
    await supabase.from('notificaciones').insert([{
      usuario_id: part.usuarios.id,
      titulo: `Liquidación disponible: ${prop.nombre}`,
      mensaje: `Tu liquidación está lista. Retorno total: $${Math.round(total_retorno).toLocaleString('es-ES')} USD`,
      tipo: 'liquidacion'
    }]);

    resultados.push({ usuario: part.usuarios, ...liq });
  }

  // Actualizar estado del piso a vendido
  await supabase.from('propiedades').update({ estado: 'vendido', precio_venta, fecha_venta: fecha }).eq('id', propiedad_id);

  res.json({ ok: true, liquidaciones_generadas: resultados.length, resultados });
});

// GET /api/liquidaciones/:id/pdf — descargar PDF
router.get('/:id/pdf', authMiddleware, async (req, res) => {
  const { data: liq } = await supabase.from('liquidaciones')
    .select('*, propiedades(*), usuarios(nombre,apellido)')
    .eq('id', req.params.id).single();

  if (!liq) return res.status(404).json({ error: 'No encontrada' });
  if (req.user.rol !== 'admin' && liq.usuario_id !== req.user.id)
    return res.status(403).json({ error: 'Acceso denegado' });

  if (liq.pdf_url) return res.redirect(liq.pdf_url);
  res.status(404).json({ error: 'PDF no disponible' });
});

// ── Generador de PDF con pdfkit ──────────────────────────────
function generarPDF({ prop, user, liq, fecha, precio_venta, fee_exito_pct }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 60, size: 'A4' });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const fmt = n => `$${Number(n).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const pct = n => `${(Number(n) * 100).toFixed(4)}%`;

    // Header
    doc.fontSize(24).font('Helvetica-Bold').text('DIGSA', 60, 60);
    doc.fontSize(10).font('Helvetica').fillColor('#666').text('digsa.es  ·  Inversiones Inmobiliarias  ·  Madrid', 60, 88);
    doc.moveTo(60, 105).lineTo(535, 105).strokeColor('#B8943F').lineWidth(1.5).stroke();

    doc.fillColor('#000').font('Helvetica-Bold').fontSize(18).text('Liquidación de Inversión', 60, 120);
    doc.font('Helvetica').fontSize(11).fillColor('#444');
    doc.text(`Propiedad: ${prop.nombre}`, 60, 148);
    doc.text(`Dirección: ${prop.direccion}`, 60, 163);
    doc.text(`Fecha de liquidación: ${fecha}`, 60, 178);

    // Inversor
    doc.moveTo(60, 205).lineTo(535, 205).strokeColor('#ddd').lineWidth(0.5).stroke();
    doc.font('Helvetica-Bold').fontSize(12).fillColor('#B8943F').text('INVERSOR', 60, 215);
    doc.font('Helvetica').fontSize(11).fillColor('#000');
    doc.text(`${user.nombre} ${user.apellido}`, 60, 232);
    doc.text(`Participación: ${pct(liq.porcentaje)}`, 60, 247);

    // Tabla de resultados
    doc.moveTo(60, 275).lineTo(535, 275).strokeColor('#ddd').lineWidth(0.5).stroke();
    doc.font('Helvetica-Bold').fontSize(12).fillColor('#B8943F').text('DETALLE FINANCIERO', 60, 285);

    const filas = [
      ['Precio de venta del inmueble', fmt(precio_venta)],
      ['Tu aporte inicial', fmt(liq.aporte)],
      ['Tu participación en la venta', fmt(Number(precio_venta) * Number(liq.porcentaje))],
      ['Utilidad bruta', fmt(liq.utilidad_bruta)],
      [`Fee de éxito (${(fee_exito_pct * 100).toFixed(0)}%)`, `- ${fmt(liq.fee_monto)}`],
      ['Utilidad neta', fmt(liq.utilidad_neta)],
    ];

    let y = 308;
    doc.font('Helvetica').fontSize(10).fillColor('#000');
    for (const [label, val] of filas) {
      doc.text(label, 60, y);
      doc.text(val, 400, y, { align: 'right', width: 135 });
      doc.moveTo(60, y + 14).lineTo(535, y + 14).strokeColor('#f0f0f0').lineWidth(0.5).stroke();
      y += 22;
    }

    // Total
    doc.rect(60, y + 5, 475, 32).fill('#1A1814');
    doc.font('Helvetica-Bold').fontSize(13).fillColor('#FFFFFF');
    doc.text('TOTAL RETORNO', 70, y + 13);
    doc.text(fmt(liq.total_retorno), 400, y + 13, { align: 'right', width: 125 });

    // Rentabilidad
    const rent = liq.aporte > 0 ? ((liq.total_retorno - liq.aporte) / liq.aporte * 100).toFixed(2) : 0;
    doc.fillColor('#000').font('Helvetica').fontSize(10);
    doc.text(`Rentabilidad neta: ${rent}%`, 60, y + 50);

    // Footer
    doc.moveTo(60, 730).lineTo(535, 730).strokeColor('#ddd').lineWidth(0.5).stroke();
    doc.fontSize(8).fillColor('#999').text('Este documento es confidencial y ha sido generado automáticamente por el sistema de DIGSA.', 60, 740, { align: 'center', width: 475 });
    doc.text('digsa.es  ·  Dorrego 1789 Of. 203, Buenos Aires  ·  Madrid', 60, 752, { align: 'center', width: 475 });

    doc.end();
  });
}

module.exports = router;
