const router = require('express').Router();
const supabase = require('../utils/supabase');
const { authMiddleware } = require('../middleware/auth');

// GET /api/dashboard
router.get('/', authMiddleware, async (req, res) => {
  const uid = req.user.id;

  const [partRes, aportesRes, liqRes, notifRes] = await Promise.all([
    supabase.from('participaciones').select('*, propiedades(*)').eq('usuario_id', uid).eq('activo', true),
    supabase.from('aportes').select('*, propiedades(nombre)').eq('usuario_id', uid).order('fecha', { ascending: false }),
    supabase.from('liquidaciones').select('*, propiedades(nombre)').eq('usuario_id', uid).order('fecha', { ascending: false }),
    supabase.from('notificaciones').select('*').eq('usuario_id', uid).eq('leida', false).order('created_at', { ascending: false }).limit(10)
  ]);

  const participaciones = partRes.data || [];
  const aportes = aportesRes.data || [];
  const liquidaciones = liqRes.data || [];

  // RESUMEN EJECUTIVO — igual que el Excel
  // Inversión inicial = suma de aportes en EUR
  const inversion_inicial = aportes
    .filter(a => a.tipo === 'aporte')
    .reduce((s, a) => s + Number(a.monto_eur || a.monto_usd || 0), 0)
    - aportes
    .filter(a => a.tipo === 'retiro')
    .reduce((s, a) => s + Number(a.monto_eur || a.monto_usd || 0), 0);

  const retiros = aportes
    .filter(a => a.tipo === 'retiro')
    .reduce((s, a) => s + Number(a.monto_eur || a.monto_usd || 0), 0);

  // Valor actual = sum(neto estimado de pisos activos) + sum(liquidaciones)
  const total_retornado = liquidaciones.reduce((s, l) => s + Number(l.total_retorno || 0), 0);
  
  // Pisos activos: valor estimado (aporte × (venta_estimada/costo_estimado))
  const pisos_activos = participaciones.filter(p => p.propiedades?.estado !== 'vendido');
  const valor_en_cartera = pisos_activos.reduce((s, p) => {
    const prop = p.propiedades;
    if (prop?.precio_venta && prop?.precio_compra && prop.precio_compra > 0) {
      const neto_estimado = Number(p.monto_invertido) * (Number(prop.precio_venta) / Number(prop.precio_compra));
      return s + neto_estimado;
    }
    return s + Number(p.monto_invertido || 0);
  }, 0);

  const valor_actual = total_retornado + valor_en_cartera;
  
  // Pendiente de inversión
  const pendiente = aportes
    .filter(a => a.tipo === 'aporte' && !a.propiedad_id)
    .reduce((s, a) => s + Number(a.monto_eur || a.monto_usd || 0), 0);

  const rentabilidad_total = inversion_inicial > 0
    ? (valor_actual - inversion_inicial) / inversion_inicial
    : 0;

  // TIR aproximada (rentabilidad anualizada)
  const primer_aporte = aportes.filter(a => a.tipo === 'aporte').slice(-1)[0];
  let tir = 0;
  if (primer_aporte && inversion_inicial > 0) {
    const dias = (new Date() - new Date(primer_aporte.fecha)) / (1000 * 60 * 60 * 24);
    const anos = dias / 365;
    if (anos > 0) tir = Math.pow(1 + rentabilidad_total, 1 / anos) - 1;
  }

  res.json({
    resumen: {
      inversion_inicial,
      valor_actual,
      rentabilidad_total,
      tir,
      retiros,
      pendiente,
      propiedades_activas: pisos_activos.length,
      total_retornado
    },
    participaciones,
    aportes,
    liquidaciones,
    notificaciones: notifRes.data || []
  });
});

router.put('/notificaciones/:id/leida', authMiddleware, async (req, res) => {
  await supabase.from('notificaciones').update({ leida: true }).eq('id', req.params.id).eq('usuario_id', req.user.id);
  res.json({ ok: true });
});

module.exports = router;
