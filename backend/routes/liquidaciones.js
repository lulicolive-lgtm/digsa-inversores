const router = require('express').Router();
const supabase = require('../utils/supabase');
const { authMiddleware, adminOnly } = require('../middleware/auth');
const { generarPDFLiquidacion } = require('../utils/generarPDF');
const { generarYSubirReporte } = require('../utils/generarReporte');

router.get('/', authMiddleware, async (req, res) => {
  let q = supabase.from('liquidaciones').select('*, propiedades(nombre,direccion), usuarios(nombre,apellido)');
  if (req.user.rol !== 'admin') q = q.eq('usuario_id', req.user.id).eq('publicado', true);
  const { data } = await q.order('fecha', { ascending: false });
  res.json(data || []);
});

router.get('/todas', authMiddleware, adminOnly, async (req, res) => {
  const { data } = await supabase.from('liquidaciones').select('*, propiedades(nombre), usuarios(nombre,apellido)').order('fecha', { ascending: false });
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
      await supabase.from('notificaciones').insert([{ usuario_id: l.usuario_id, titulo: 'Liquidacion disponible: ' + (prop ? prop.nombre : ''), mensaje: 'Tu liquidacion esta lista. Retorno: EUR ' + Math.round(l.total_retorno).toLocaleString('es-ES'), tipo: 'liquidacion' }]);
    }
    res.json({ ok: true, publicadas: liqs ? liqs.length : 0 });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', authMiddleware, adminOnly, async (req, res) => {
  const { data, error } = await supabase.from('liquidaciones').update(req.body).eq('id', req.params.id).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

router.get('/pendientes', authMiddleware, adminOnly, async (req, res) => {
  const { data } = await supabase.from('pendientes_inversion').select('*, usuarios(nombre,apellido,email), propiedades_origen:propiedad_origen_id(nombre)').eq('asignado', false).order('fecha', { ascending: false });
  res.json(data || []);
});

router.post('/pendientes/asignar', authMiddleware, adminOnly, async (req, res) => {
  const { pendiente_id, usuario_id, propiedad_id, monto, fecha } = req.body;
  try {
    const { data: prop } = await supabase.from('propiedades').select('precio_compra').eq('id', propiedad_id).single();
    const pct = prop && prop.precio_compra > 0 ? monto / Number(prop.precio_compra) : 0;
    const { data: partExist } = await supabase.from('participaciones').select('id,monto_invertido,porcentaje').eq('usuario_id', usuario_id).eq('propiedad_id', propiedad_id).eq('activo', true).single();
    if (partExist) {
      await supabase.from('participaciones').update({ monto_invertido: Number(partExist.monto_invertido) + monto, porcentaje: Number(partExist.porcentaje) + pct }).eq('id', partExist.id);
    } else {
      await supabase.from('participaciones').insert([{ usuario_id, propiedad_id, monto_invertido: monto, porcentaje: pct, fecha_entrada: fecha, activo: true }]);
    }
    await supabase.from('aportes').insert([{ usuario_id, propiedad_id, monto_eur: monto, monto_usd: monto, fecha, tipo: 'reinversion', descripcion: 'Reinversion desde pendiente' }]);
    const { data: pend } = await supabase.from('pendientes_inversion').select('monto_eur').eq('id', pendiente_id).single();
    const resto = Number(pend ? pend.monto_eur : 0) - monto;
    if (resto < 0.01) {
      await supabase.from('pendientes_inversion').update({ asignado: true }).eq('id', pendiente_id);
    } else {
      await supabase.from('pendientes_inversion').update({ monto_eur: resto }).eq('id', pendiente_id);
    }
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/generar', authMiddleware, adminOnly, async (req, res) => {
  const { propiedad_id, precio_venta, fecha } = req.body;
  const destino_ids = req.body.destino_ids || [];
  const destino_pcts = req.body.destino_pcts || {};
  const fee_pct = Number(req.body.fee_exito_pct || 0.15);
  const imp_pct = Number(req.body.imp_pct || 0.25);

  if (!propiedad_id || !precio_venta || !fecha) return res.status(400).json({ error: 'Faltan datos' });

  const { data: prop } = await supabase.from('propiedades').select('*').eq('id', propiedad_id).single();
  if (!prop) return res.status(404).json({ error: 'Propiedad no encontrada' });

  const { data: parts } = await supabase.from('participaciones').select('*, usuarios(id,nombre,apellido,email)').eq('propiedad_id', propiedad_id).eq('activo', true);
  if (!parts || !parts.length) return res.status(400).json({ error: 'No hay inversores asignados' });

  const precio_v = Number(precio_venta);
  const precio_c = Number(prop.precio_compra || 0);
  const util_bruta_piso = precio_v - precio_c;
  const resultados = [];

  for (const part of parts) {
    const user = part.usuarios;
    const aporte = Number(part.monto_invertido);
    const porcentaje = Number(part.porcentaje);
    const util_inv = util_bruta_piso * porcentaje;
    const fee = Math.max(0, util_inv) * fee_pct;
    const imp = Math.max(0, util_inv - fee) * imp_pct;
    const unet = util_inv - fee - imp;
    const total_retorno = aporte + unet;

    const { data: liq } = await supabase.from('liquidaciones').insert([{
      propiedad_id, usuario_id: user.id, fecha,
      precio_venta: precio_v, aporte_usuario: aporte, porcentaje,
      utilidad_bruta: util_inv, fee_exito_pct: fee_pct, fee_exito_monto: fee,
      utilidad_neta: unet, total_retorno, publicado: false
    }]).select().single();

    try {
      const { data: todasLiqs } = await supabase.from('liquidaciones').select('*, propiedades(nombre)').eq('usuario_id', user.id).eq('propiedad_id', propiedad_id).order('fecha', { ascending: false });
      const liquidacionesParaPDF = (todasLiqs || []).map(l => {
        const ap = Number(l.aporte_usuario);
        const un = Number(l.utilidad_neta);
        return { piso: l.propiedades ? l.propiedades.nombre : '?', aporte: ap, utilidad_bruta: Number(l.utilidad_bruta), fee: Number(l.fee_exito_monto), impuestos: Math.max(0, Number(l.utilidad_bruta) - Number(l.fee_exito_monto)) * imp_pct, util_neta: un, total: Number(l.total_retorno), fecha_venta: l.fecha, precio_venta_piso: Number(l.precio_venta||0), porcentaje: Number(l.porcentaje||0), tir_anual: ap > 0 ? (un / ap) * 100 : 0 };
      });
      const total_aporte = liquidacionesParaPDF.reduce((s,l) => s+l.aporte, 0);
      const total_retorno2 = liquidacionesParaPDF.reduce((s,l) => s+l.total, 0);
      const total_utilidad = liquidacionesParaPDF.reduce((s,l) => s+l.util_neta, 0);
      const pdfBuffer = await generarPDFLiquidacion({ usuario: { nombre: user.nombre, apellido: user.apellido, email: user.email }, propiedad: { nombre: prop.nombre }, fecha, liquidaciones: liquidacionesParaPDF, total_aporte, total_retorno: total_retorno2, total_utilidad });
      const iniciales = (user.nombre[0] + user.apellido[0]).toUpperCase();
      const pisoSlug = prop.nombre.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20);
      const pdfPath = 'liquidaciones/' + pisoSlug + '_' + iniciales + '_' + fecha + '.pdf';
      const { error: uploadErr } = await supabase.storage.from('documentos').upload(pdfPath, pdfBuffer, { contentType: 'application/pdf', upsert: true });
      if (!uploadErr) {
        const { data: urlData } = supabase.storage.from('documentos').getPublicUrl(pdfPath);
        await supabase.from('liquidaciones').update({ pdf_url: urlData.publicUrl }).eq('id', liq.id);
        await supabase.from('documentos').insert([{ usuario_id: user.id, propiedad_id, nombre: 'Liquidacion ' + prop.nombre + ' -- ' + iniciales, tipo: 'liquidacion', url: urlData.publicUrl, fecha, publicado: false }]);
      }
    } catch(pdfErr) { console.error('Error PDF liquidacion:', pdfErr.message); }

    resultados.push({ usuario_id: user.id, nombre: user.nombre + ' ' + user.apellido, total_retorno, aporte, user });
  }

  await supabase.from('propiedades').update({ estado: 'vendido', precio_venta: precio_v, fecha_venta: fecha }).eq('id', propiedad_id);
  await supabase.from('participaciones').update({ activo: false }).eq('propiedad_id', propiedad_id);

  const total_pct_asignado = Object.values(destino_pcts).reduce((s, v) => s + Number(v), 0);
  const sinDestino = !destino_ids || destino_ids.length === 0;
  const pct_pendiente = sinDestino ? 1 : Math.max(0, 1 - total_pct_asignado);

  if (pct_pendiente > 0.001) {
    for (const res of resultados) {
      const monto_pend = Math.round(res.total_retorno * pct_pendiente * 100) / 100;
      await supabase.from('pendientes_inversion').insert([{ usuario_id: res.usuario_id, propiedad_origen_id: propiedad_id, monto_eur: monto_pend, fecha, descripcion: 'Liquidacion ' + prop.nombre + ' -- pendiente de reinversion', asignado: false }]);
    }
  }

  if (!sinDestino) {
    try {
      const { data: propsDest } = await supabase.from('propiedades').select('id,nombre,precio_compra').in('id', destino_ids);
      const totalCosto = (propsDest||[]).reduce((s,p) => s + Number(p.precio_compra||0), 0);
      for (const res of resultados) {
        for (const propDest of (propsDest||[])) {
          const prop_costo = Number(propDest.precio_compra || 0);
          const prop_pct = destino_pcts[propDest.id] ? destino_pcts[propDest.id] : (totalCosto > 0 ? prop_costo / totalCosto : 1 / propsDest.length);
          const monto = Math.round(res.total_retorno * prop_pct * 100) / 100;
          const pct_nuevo = prop_costo > 0 ? monto / prop_costo : 0;
          await supabase.from('aportes').insert([{ usuario_id: res.usuario_id, propiedad_id: propDest.id, monto_eur: monto, monto_usd: monto, fecha, tipo: 'aporte', descripcion: 'Reinversion de ' + prop.nombre }]);
          const { data: partExist } = await supabase.from('participaciones').select('id,monto_invertido,porcentaje').eq('usuario_id', res.usuario_id).eq('propiedad_id', propDest.id).eq('activo', true).single();
          if (partExist) {
            await supabase.from('participaciones').update({ monto_invertido: Number(partExist.monto_invertido) + monto, porcentaje: Number(partExist.porcentaje) + pct_nuevo }).eq('id', partExist.id);
          } else {
            await supabase.from('participaciones').insert([{ usuario_id: res.usuario_id, propiedad_id: propDest.id, monto_invertido: monto, porcentaje: pct_nuevo, fecha_entrada: fecha, activo: true }]);
          }
        }
      }
    } catch(reinvErr) { console.error('Error reinversion:', reinvErr.message); }
  }

  for (const res of resultados) {
    try {
      const extraPendiente = pct_pendiente > 0.001 ? res.total_retorno * pct_pendiente : 0;
      console.log('REPORTE: generando para', res.user.email, 'extraPendiente=', extraPendiente);
      await generarYSubirReporte(res.usuario_id, res.user, supabase, extraPendiente);
      console.log('REPORTE: OK para', res.user.email);
    } catch(repErr) { console.error('REPORTE ERROR:', repErr.message); }
  }

  res.json({ ok: true, propiedad: prop.nombre, liquidaciones: resultados.length, resultados });
});

router.get('/:id/pdf', authMiddleware, async (req, res) => {
  const { data: liq } = await supabase.from('liquidaciones').select('*, propiedades(*), usuarios(id,nombre,apellido,email)').eq('id', req.params.id).single();
  if (!liq) return res.status(404).json({ error: 'No encontrada' });
  if (req.user.rol !== 'admin' && liq.usuario_id !== req.user.id) return res.status(403).json({ error: 'Sin acceso' });
  if (liq.pdf_url) return res.redirect(liq.pdf_url);
  res.status(404).json({ error: 'PDF no disponible' });
});

module.exports = router;