const router = require('express').Router();
const supabase = require('../utils/supabase');
const { authMiddleware } = require('../middleware/auth');

router.get('/', authMiddleware, async (req, res) => {
  const uid = req.user.id;

  const [partRes, aportesRes, liqRes, notifRes, reporteRes, pendientesRes] = await Promise.all([
    supabase.from('participaciones').select('*, propiedades(*)').eq('usuario_id', uid).eq('activo', true),
    supabase.from('aportes').select('*, propiedades(nombre)').eq('usuario_id', uid).order('fecha', { ascending: false }),
    supabase.from('liquidaciones').select('*, propiedades(nombre)').eq('usuario_id', uid).eq('publicado', true).order('fecha', { ascending: false }),
    supabase.from('notificaciones').select('*').eq('usuario_id', uid).eq('leida', false).order('created_at', { ascending: false }).limit(10),
    supabase.from('documentos').select('metadata,fecha').eq('usuario_id', uid).eq('tipo', 'reporte').eq('publicado', true).order('fecha', { ascending: false }).limit(1),
    supabase.from('pendientes_inversion').select('monto_eur').eq('usuario_id', uid).eq('asignado', false)
  ]);

  const participaciones = partRes.data || [];
  const aportes        = aportesRes.data || [];
  const liquidaciones  = liqRes.data || [];

  // Inversión inicial = suma aportes positivos - retiros de capital
  // retiro_capital = retiro real de dinero propio (ej: SB)
  // retiro = cobro de ganancias (ej: PS) → no resta inversión inicial
  const inversion_inicial = aportes.reduce((s, a) => {
    if (a.tipo === 'aporte') return s + Number(a.monto_eur || a.monto_usd || 0);
    if (a.tipo === 'retiro_capital') return s - Number(a.monto_eur || a.monto_usd || 0);
    return s;
  }, 0);

  const retiros = aportes
    .filter(a => a.tipo === 'retiro' || a.tipo === 'retiro_capital')
    .reduce((s, a) => s + Number(a.monto_eur || a.monto_usd || 0), 0);

  const total_retornado = liquidaciones.reduce((s, l) => s + Number(l.total_retorno || 0), 0);

  // Pisos activos con neto estimado (fórmula Excel)
  const pisos_activos = participaciones.filter(p => p.propiedades?.estado !== 'vendido');
  const valor_en_cartera = pisos_activos.reduce((s, p) => {
    const prop   = p.propiedades;
    const aporte = Number(p.monto_invertido || 0);
    if (prop?.precio_venta && prop?.precio_compra && Number(prop.precio_compra) > 0) {
      const util_inv = (Number(prop.precio_venta) - Number(prop.precio_compra)) * (aporte / Number(prop.precio_compra));
      const fee = Math.max(0, util_inv) * 0.15;
      const imp = Math.max(0, util_inv - fee) * 0.25;
      return s + aporte + util_inv - fee - imp;
    }
    return s + aporte;
  }, 0);

  // Pendiente = aportes tipo 'pendiente' (registrados al liquidar sin destino)
  // Si no hay → 0 si tiene pisos, retorno disponible si no tiene pisos
  const pendientes_rows = (pendientesRes && pendientesRes.data) || [];
  const aportes_pendiente = pendientes_rows.reduce((s, p) => s + Number(p.monto_eur || 0), 0);

  const pendiente = aportes_pendiente > 0
    ? aportes_pendiente
    : pisos_activos.length === 0
      ? Math.max(0, inversion_inicial + total_retornado - retiros)
      : 0;

  // Valor actual = netos pisos activos + pendiente (igual que Excel)
  const valor_actual = valor_en_cartera + pendiente;

  const rentabilidad_total = inversion_inicial > 0
    ? (valor_actual - inversion_inicial) / inversion_inicial
    : 0;

  const primer_aporte = aportes.filter(a => a.tipo === 'aporte').slice(-1)[0];
  let tir = 0;
  if (primer_aporte && inversion_inicial > 0) {
    const dias = (new Date() - new Date(primer_aporte.fecha)) / (1000 * 60 * 60 * 24);
    const anos = dias / 365;
    if (anos > 0) tir = Math.pow(1 + rentabilidad_total, 1 / anos) - 1;
  }

  // Si hay reporte generado con metadata, usar esos KPIs
  let resumenFinal = { inversion_inicial, valor_actual, rentabilidad_total, tir, retiros, pendiente, propiedades_activas: pisos_activos.length, total_retornado };
  const ultimoReporte = reporteRes?.data?.[0];
  if (ultimoReporte?.metadata) {
    try {
      const meta = JSON.parse(ultimoReporte.metadata);
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
