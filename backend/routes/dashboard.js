const router = require('express').Router();
const supabase = require('../utils/supabase');
const { authMiddleware } = require('../middleware/auth');

router.get('/', authMiddleware, async (req, res) => {
  const uid = req.user.id;
  const [partRes, aportesRes, liqRes, notifRes, reporteRes] = await Promise.all([
    supabase.from('participaciones').select('*, propiedades(*)').eq('usuario_id', uid).eq('activo', true),
    supabase.from('aportes').select('*, propiedades(nombre)').eq('usuario_id', uid).order('fecha', { ascending: false }),
    supabase.from('liquidaciones').select('*, propiedades(nombre)').eq('usuario_id', uid).eq('publicado', true).order('fecha', { ascending: false }),
    supabase.from('notificaciones').select('*').eq('usuario_id', uid).eq('leida', false).order('created_at', { ascending: false }).limit(10),
    supabase.from('documentos').select('metadata,fecha').eq('usuario_id', uid).eq('tipo', 'reporte').eq('publicado', true).order('fecha', { ascending: false }).limit(1)
  ]);
  const participaciones = partRes.data || [];
  const aportes = aportesRes.data || [];
  const liquidaciones = liqRes.data || [];
  const inversion_inicial = aportes.filter(a=>a.tipo==='aporte').reduce((s,a)=>s+Number(a.monto_eur||a.monto_usd||0),0);
  const retiros = aportes.filter(a => a.tipo === 'retiro').reduce((s, a) => s + Number(a.monto_eur || a.monto_usd || 0), 0);
  const total_retornado = liquidaciones.reduce((s, l) => s + Number(l.total_retorno || 0), 0);
  const pisos_activos = participaciones.filter(p => p.propiedades?.estado !== 'vendido');
  const valor_en_cartera = pisos_activos.reduce((s, p) => {
    const prop = p.propiedades;
    const aporte = Number(p.monto_invertido || 0);
    if (prop?.precio_venta && prop?.precio_compra && Number(prop.precio_compra) > 0) {
      const util_inv = (Number(prop.precio_venta) - Number(prop.precio_compra)) * (aporte / Number(prop.precio_compra));
      const fee = Math.max(0, util_inv) * 0.15;
      const imp = Math.max(0, util_inv - fee) * 0.25;
      return s + aporte + util_inv - fee - imp;
    }
    return s + aporte;
  }, 0);
  const en_pisos = pisos_activos.reduce((s, p) => s + Number(p.monto_invertido || 0), 0);
  const aportes_pendiente = aportes.filter(a => a.tipo === 'pendiente').reduce((s, a) => s + Number(a.monto_eur || 0), 0);
  const pendiente = aportes_pendiente > 0 ? aportes_pendiente : (en_pisos === 0 ? Math.max(0, inversion_inicial + total_retornado - retiros) : 0);
  const valor_actual = valor_en_cartera + pendiente;
  const rentabilidad_total = inversion_inicial > 0 ? (valor_actual - inversion_inicial) / inversion_inicial : 0;
  const primer_aporte = aportes.filter(a => a.tipo === 'aporte').slice(-1)[0];
  let tir = 0;
  if (primer_aporte && inversion_inicial > 0) {
    const dias = (new Date() - new Date(primer_aporte.fecha)) / (1000 * 60 * 60 * 24);
    const anos = dias / 365;
    if (anos > 0) tir = Math.pow(1 + rentabilidad_total, 1 / anos) - 1;
  }
  let resumenFinal = { inversion_inicial, valor_actual, rentabilidad_total, tir, retiros, pendiente, propiedades_activas: pisos_activos.length, total_retornado };
  if (reporteRes?.data?.[0]?.metadata) {
    try {
      const meta = JSON.parse(reporteRes.data[0].metadata);
      resumenFinal = { ...resumenFinal, ...meta, retiros, propiedades_activas: pisos_activos.length };
    } catch(e) {}
  }
  res.json({ resumen: resumenFinal, participaciones, aportes, liquidaciones, notificaciones: notifRes.data || [] });
});

router.put('/notificaciones/:id/leida', authMiddleware, async (req, res) => {
  await supabase.from('notificaciones').update({ leida: true }).eq('id', req.params.id).eq('usuario_id', req.user.id);
  res.json({ ok: true });
});

module.exports = router;
