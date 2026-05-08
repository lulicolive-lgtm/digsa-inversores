const router = require('express').Router();
const supabase = require('../utils/supabase');
const { authMiddleware, adminOnly } = require('../middleware/auth');

// GET /api/admin/estadisticas — panel de control admin
router.get('/estadisticas', authMiddleware, adminOnly, async (req, res) => {
  const [invRes, propRes, aportesRes, liqRes] = await Promise.all([
    supabase.from('usuarios').select('id', { count: 'exact' }).eq('rol', 'inversor').eq('activo', true),
    supabase.from('propiedades').select('id,estado,nombre', { count: 'exact' }),
    supabase.from('aportes').select('monto_usd,tipo').eq('tipo', 'aporte'),
    supabase.from('liquidaciones').select('total_retorno,utilidad_neta')
  ]);

  const propiedades = propRes.data || [];
  const aportes = aportesRes.data || [];
  const liquidaciones = liqRes.data || [];

  const total_capital = aportes.reduce((s, a) => s + Number(a.monto_usd), 0);
  const total_retornado = liquidaciones.reduce((s, l) => s + Number(l.total_retorno || 0), 0);
  const utilidad_total = liquidaciones.reduce((s, l) => s + Number(l.utilidad_neta || 0), 0);

  res.json({
    inversores_activos: invRes.count || 0,
    total_propiedades: propiedades.length,
    propiedades_por_estado: {
      en_obra: propiedades.filter(p => p.estado === 'en_obra').length,
      disponible: propiedades.filter(p => p.estado === 'disponible').length,
      reservado: propiedades.filter(p => p.estado === 'reservado').length,
      vendido: propiedades.filter(p => p.estado === 'vendido').length,
    },
    total_capital_gestionado: total_capital,
    total_retornado,
    utilidad_total,
    rentabilidad_promedio: total_capital > 0 ? (utilidad_total / total_capital * 100) : 0
  });
});

// GET /api/admin/actividad — últimas acciones
router.get('/actividad', authMiddleware, adminOnly, async (req, res) => {
  const [aportes, liq] = await Promise.all([
    supabase.from('aportes').select('*, usuarios(nombre,apellido), propiedades(nombre)')
      .order('created_at', { ascending: false }).limit(15),
    supabase.from('liquidaciones').select('*, usuarios(nombre,apellido), propiedades(nombre)')
      .order('created_at', { ascending: false }).limit(5)
  ]);

  res.json({
    ultimos_aportes: aportes.data || [],
    ultimas_liquidaciones: liq.data || []
  });
});

// GET /api/admin/resumen-inversores — datos completos para el panel de análisis
router.get('/resumen-inversores', authMiddleware, adminOnly, async (req, res) => {
  const [aportes, liqs, parts] = await Promise.all([
    supabase.from('aportes').select('usuario_id, monto_usd, monto_eur, tipo_cambio, tipo, fecha, propiedades(nombre)').order('fecha', { ascending: true }),
    supabase.from('liquidaciones').select('usuario_id, aporte_usuario, total_retorno, utilidad_neta, propiedades(nombre), fecha').order('fecha', { ascending: true }),
    supabase.from('participaciones').select('usuario_id, propiedad_id, monto_invertido, porcentaje, propiedades(nombre, estado, precio_compra)').eq('activo', true)
  ]);

  const aportes_normalizados = (aportes.data || []).map(a => {
    let monto = Number(a.monto_eur || 0);
    if (!monto && a.monto_usd) {
      monto = a.tipo_cambio ? Number(a.monto_usd) / Number(a.tipo_cambio) : Number(a.monto_usd);
    }
    return { ...a, monto_normalizado: monto };
  });

  res.json({
    aportes: aportes_normalizados,
    liquidaciones: liqs.data || [],
    participaciones: parts.data || []
  });
});

module.exports = router;

// GET /api/admin/proxima
router.get('/proxima', authMiddleware, async (req, res) => {
  const { data } = await supabase.from('configuracion').select('valor').eq('clave', 'proxima_inversion').single();
  res.json(data ? JSON.parse(data.valor) : {});
});

// POST /api/admin/proxima
router.post('/proxima', authMiddleware, adminOnly, async (req, res) => {
  const valor = JSON.stringify(req.body);
  const { data: existing } = await supabase.from('configuracion').select('id').eq('clave', 'proxima_inversion').single();
  if (existing) {
    await supabase.from('configuracion').update({ valor }).eq('clave', 'proxima_inversion');
  } else {
    await supabase.from('configuracion').insert([{ clave: 'proxima_inversion', valor }]);
  }
  res.json({ ok: true });
});
