const router = require('express').Router();
const supabase = require('../utils/supabase');
const { authMiddleware, adminOnly } = require('../middleware/auth');

// GET /api/aportes — el inversor ve los suyos; admin puede filtrar por usuario
router.get('/', authMiddleware, async (req, res) => {
  let query = supabase.from('aportes').select('*, propiedades(nombre), usuarios(nombre,apellido)');

  if (req.user.rol === 'admin') {
    if (req.query.usuario_id) query = query.eq('usuario_id', req.query.usuario_id);
    if (req.query.propiedad_id) query = query.eq('propiedad_id', req.query.propiedad_id);
  } else {
    query = query.eq('usuario_id', req.user.id);
  }

  const { data, error } = await query.order('fecha', { ascending: false });
  res.json(data || []);
});

// POST /api/aportes — registrar aporte (solo admin)
// Soporta dos modos:
//   Modo USD: se envía monto_usd + tipo_cambio  → monto_eur = monto_usd / tipo_cambio
//   Modo EUR: se envía solo monto_eur            → monto_usd y tipo_cambio quedan null
router.post('/', authMiddleware, adminOnly, async (req, res) => {
  const { usuario_id, propiedad_id, monto_usd, monto_eur, tipo_cambio, fecha, tipo, descripcion } = req.body;

  // Validación: necesitamos al menos usuario, fecha, y un monto (USD o EUR)
  if (!usuario_id || !fecha)
    return res.status(400).json({ error: 'usuario_id y fecha son requeridos' });
  if (!monto_usd && !monto_eur)
    return res.status(400).json({ error: 'Ingresá al menos monto_usd o monto_eur' });

  // Calcular tipo de cambio y montos
  let usd = monto_usd ? Number(monto_usd) : null;
  let eur = monto_eur ? Number(monto_eur) : null;
  let tc  = tipo_cambio ? Number(tipo_cambio) : null;

  // Si vienen los dos, calcular tipo de cambio
  if (usd && eur && !tc) tc = usd / eur;
  // Si viene USD + TC, calcular EUR
  if (usd && tc && !eur) eur = usd / tc;
  // Si viene solo EUR, no hay USD ni TC
  // (usd y tc quedan null — columnas deben ser nullable en Supabase)

  // Texto del mensaje de notificación según moneda
  const montoTexto = usd
    ? `$${Number(usd).toLocaleString('es-ES')} USD`
    : `€${Number(eur).toLocaleString('es-ES')} EUR`;

  const { data, error } = await supabase
    .from('aportes')
    .insert([{
      usuario_id,
      propiedad_id: propiedad_id || null,
      monto_usd:   usd,
      tipo_cambio: tc,
      monto_eur:   eur,
      fecha,
      tipo: tipo || 'aporte',
      descripcion
    }])
    .select('*, propiedades(nombre), usuarios(nombre,apellido)')
    .single();

  if (error) return res.status(400).json({ error: error.message });

  // Notificar al inversor
  await supabase.from('notificaciones').insert([{
    usuario_id,
    titulo: 'Nuevo aporte registrado',
    mensaje: `Se registró un aporte de ${montoTexto}${propiedad_id ? '' : ' (aporte general)'}`,
    tipo: 'aporte'
  }]);

  res.status(201).json(data);
});

// PUT /api/aportes/:id — editar aporte (admin)
router.put('/:id', authMiddleware, adminOnly, async (req, res) => {
  const { data, error } = await supabase
    .from('aportes').update(req.body).eq('id', req.params.id).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// DELETE /api/aportes/:id
router.delete('/:id', authMiddleware, adminOnly, async (req, res) => {
  await supabase.from('aportes').delete().eq('id', req.params.id);
  res.json({ ok: true });
});

module.exports = router;
