const router = require('express').Router();
const supabase = require('../utils/supabase');
const { authMiddleware } = require('../middleware/auth');

// GET /api/dashboard — resumen del inversor logueado
router.get('/', authMiddleware, async (req, res) => {
  const uid = req.user.id;

  const [partRes, aportesRes, liqRes, notifRes] = await Promise.all([
    // Participaciones activas con detalle de propiedad
    supabase.from('participaciones')
      .select('*, propiedades(*)')
      .eq('usuario_id', uid)
      .eq('activo', true),

    // Historial de aportes
    supabase.from('aportes')
      .select('*, propiedades(nombre)')
      .eq('usuario_id', uid)
      .order('fecha', { ascending: false }),

    // Liquidaciones
    supabase.from('liquidaciones')
      .select('*, propiedades(nombre)')
      .eq('usuario_id', uid)
      .order('fecha', { ascending: false }),

    // Notificaciones no leídas
    supabase.from('notificaciones')
      .select('*')
      .eq('usuario_id', uid)
      .eq('leida', false)
      .order('created_at', { ascending: false })
      .limit(10)
  ]);

  const participaciones = partRes.data || [];
  const aportes = aportesRes.data || [];
  const liquidaciones = liqRes.data || [];

  // Calcular métricas resumen
  const total_invertido = aportes
    .filter(a => a.tipo === 'aporte')
    .reduce((s, a) => s + Number(a.monto_usd), 0);

  const total_retornado = liquidaciones
    .reduce((s, l) => s + Number(l.total_retorno || 0), 0);

  const rentabilidad_total = total_invertido > 0
    ? ((total_retornado - total_invertido) / total_invertido) * 100
    : 0;

  const propiedades_activas = participaciones.filter(
    p => p.propiedades?.estado !== 'vendido'
  ).length;

  res.json({
    resumen: {
      total_invertido,
      total_retornado,
      rentabilidad_total: Math.round(rentabilidad_total * 100) / 100,
      propiedades_activas,
      liquidaciones_pendientes: liquidaciones.filter(l => !l.enviado_email).length
    },
    participaciones,
    aportes,
    liquidaciones,
    notificaciones: notifRes.data || []
  });
});

// PUT /api/dashboard/notificaciones/:id/leida
router.put('/notificaciones/:id/leida', authMiddleware, async (req, res) => {
  await supabase.from('notificaciones')
    .update({ leida: true })
    .eq('id', req.params.id)
    .eq('usuario_id', req.user.id);
  res.json({ ok: true });
});

module.exports = router;
