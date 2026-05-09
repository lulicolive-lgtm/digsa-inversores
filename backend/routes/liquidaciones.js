const router = require('express').Router();
const supabase = require('../utils/supabase');
const { authMiddleware, adminOnly } = require('../middleware/auth');
const { generarPDFLiquidacion, generarPDFReporte } = require('../utils/generarPDF');
const { generarYSubirReporte } = require('../utils/generarReporte');

router.get('/', authMiddleware, async (req, res) => {
  let q = supabase.from('liquidaciones')
    .select('*, propiedades(nombre,direccion), usuarios(nombre,apellido)');
  if (req.user.rol !== 'admin') q = q.eq('usuario_id', req.user.id).eq('publicado', true);
  const { data } = await q.order('fecha', { ascending: false });
  res.json(data || []);
});

router.get('/todas', authMiddleware, adminOnly, async (req, res) => {
  const { data } = await supabase.from('liquidaciones')
    .select('*, propiedades(nombre), usuarios(nombre,apellido)')
    .order('fecha', { ascending: false });
  res.json(data || []);
});

router.post('/publicar/:propiedad_id', authMiddleware, adminOnly, async (req, res) => {
  const { propiedad_id } = req.params;
  try {
    await supabase.from('liquidaciones').update({ publicado: true }).eq('propiedad_id', propiedad_id).eq('publicado', false);
    await supabase.from('documentos').update({ publicado: true }).eq('propiedad_id', propiedad_id).eq('publicado', false);
    const { data: liqs } = await supabase.from('liquidaciones').select('usuario_id,total_retorno').eq('propiedad_id', propiedad_id);
    const { data: prop } = await supabase.from('propiedades').select('nombre').eq('id', propiedad_id).single();
    for (const l of (liqs || [])) {
      await supabase.from('notificaciones').insert([{ usuario_id: l.usuario_id, titulo: `Liquidación disponible: ${prop?.nombre}`, mensaje: `Tu liquidación está lista. Retorno total: €${Math.round(l.total_retorno).toLocaleString('es-ES')}`, tipo: 'liquidacion' }]);
    }
    res.json({ ok: true, publicadas: liqs?.length || 0 });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', authMiddleware, adminOnly, async (req, res) => {
  const { data, error } = await supabase.from('liquidaciones').update(req.body).eq('id', req.params.id).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

router.post('/generar', authMiddleware, adminOnly, async (req, res) => {
  const { propiedad_id, precio_venta, fecha, destino_ids = [] } = req.body;
  if (!propiedad_id || !precio_venta || !fecha)
    return res.status(400).json({ error: 'propiedad_id, precio_venta y fecha son requeridos' });

  const { data: prop } = await supabase.from('propiedades').select('*').eq('id', propiedad_id).single();
  if (!prop) return res.status(404).json({ error: 'Propiedad no encontrada' });

  const { data: parts } = await supabase.from('participaciones').select('*, usuarios(id,nombre,apellido,email)').eq('propiedad_id', propiedad_id).eq('activo', true);
  if (!parts?.length) return res.status(400).json({ error: 'No hay inversores asignados' });

  const precio_v = Number(precio_venta);
  const precio_c = Number(prop.precio_compra || 0);
  const util_bruta_piso = precio_v - precio_c;
  const resultados = [];

  for (const part of parts) {
    const user = part.usuarios;
    const aporte = Number(part.monto_invertido);
    const porcentaje = Number(part.porcentaje);
    const util_inv = util_bruta_piso * porcentaje;
    const fee = Math.max(0, util_inv) * 0.15;
    const imp = Math.max(0, util_inv - fee) * 0.25;
    const unet = util_inv - fee - imp;
    const total_retorno = aporte + unet;

    const { data: liq } = await supabase.from('liquidaciones').insert([{
      propiedad_id, usuario_id: user.id, fecha,
      precio_venta: precio_v, aporte_usuario: aporte, porcentaje,
      utilidad_bruta: util_inv, fee_exito_pct: 0.15, fee_exito_monto: fee,
      utilidad_neta: unet, total_retorno, publicado: false
    }]).select().single();

    try {
      const { data: todasLiqs } = await supabase.from('liquidaciones')
        .select('*, propiedades(nombre)')
        .eq('usuario_id', user.id)
        .order('fecha', { ascending: false });

      const liquidacionesParaPDF = (todasLiqs || []).map(l => ({
        piso: l.propiedades?.nombre || '—',
        aporte: Number(l.aporte_usuario),
        utilidad_bruta: Number(l.utilidad_bruta),
        fee: Number(l.fee_exito_monto),
        impuestos: Math.max(0, Number(l.utilidad_bruta) - Number(l.fee_exito_monto)) * 0.25,
        util_neta: Number(l.utilidad_neta),
        total: Number(l.total_retorno),
      }));

      const total_aporte = liquidacionesParaPDF.reduce((s,l) => s+l.aporte, 0);
      const total_retorno2 = liquidacionesParaPDF.reduce((s,l) => s+l.total, 0);
      const total_utilidad = liquidacionesParaPDF.reduce((s,l) => s+l.util_neta, 0);

      const pdfBuffer = await generarPDFLiquidacion({
        usuario: { nombre: user.nombre, apellido: user.apellido, email: user.email },
        propiedad: { nombre: prop.nombre }, fecha,
        liquidaciones: liquidacionesParaPDF,
        total_aporte, total_retorno: total_retorno2, total_utilidad,
      });

      const iniciales = (user.nombre[0] + user.apellido[0]).toUpperCase();
      const pisoSlug = prop.nombre.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20);
      const pdfPath = `liquidaciones/${pisoSlug}_${iniciales}_${fecha}.pdf`;

      const { error: uploadErr } = await supabase.storage.from('documentos').upload(pdfPath, pdfBuffer, { contentType: 'application/pdf', upsert: true });
      if (!uploadErr) {
        const { data: urlData } = supabase.storage.from('documentos').getPublicUrl(pdfPath);
        await supabase.from('liquidaciones').update({ pdf_url: urlData.publicUrl }).eq('id', liq.id);
        await supabase.from('documentos').insert([{ usuario_id: user.id, propiedad_id, nombre: `Liquidación ${prop.nombre} — ${iniciales}`, tipo: 'liquidacion', url: urlData.publicUrl, fecha, publicado: false }]);
      }
    } catch(pdfErr) {
      console.error('Error PDF liquidacion:', pdfErr.message);
    }

    try {
      await generarYSubirReporte(user.id, user, supabase);
    } catch(repErr) {
      console.error('Error reporte:', repErr.message);
    }

    resultados.push({ usuario_id: user.id, nombre: `${user.nombre} ${user.apellido}`, total_retorno, aporte });
  }

  await supabase.from('propiedades').update({ estado: 'vendido', precio_venta: precio_v, fecha_venta: fecha }).eq('id', propiedad_id);
  await supabase.from('participaciones').update({ activo: false }).eq('propiedad_id', propiedad_id);

  res.json({ ok: true, propiedad: prop.nombre, liquidaciones: resultados.length, resultados });
});

module.exports = router;
