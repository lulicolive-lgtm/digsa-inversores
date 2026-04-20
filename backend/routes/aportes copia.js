const router = require('express').Router();
const supabase = require('../utils/supabase');
const { authMiddleware, adminOnly } = require('../middleware/auth');
const { generarYSubirReporte } = require('../utils/generarReporte');

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
router.post('/', authMiddleware, adminOnly, async (req, res) => {
  const { usuario_id, propiedad_id, monto_usd, tipo_cambio, fecha, tipo, descripcion } = req.body;
  if (!usuario_id || !monto_usd || !fecha)
    return res.status(400).json({ error: 'usuario_id, monto_usd y fecha son requeridos' });

  const monto_eur = tipo_cambio ? monto_usd / tipo_cambio : null;

  const { data, error } = await supabase
    .from('aportes')
    .insert([{ usuario_id, propiedad_id: propiedad_id || null, monto_usd, tipo_cambio, monto_eur, fecha, tipo: tipo || 'aporte', descripcion }])
    .select('*, propiedades(nombre), usuarios(nombre,apellido)')
    .single();

  if (error) return res.status(400).json({ error: error.message });

  // Notificar al inversor
  await supabase.from('notificaciones').insert([{
    usuario_id,
    titulo: 'Nuevo aporte registrado',
    mensaje: `Se registró un aporte de $${Number(monto_usd).toLocaleString('es-ES')} USD${propiedad_id ? '' : ' (aporte general)'}`,
    tipo: 'aporte'
  }]);

  // Generar reporte actualizado del inversor
  generarYSubirReporte(usuario_id).catch(console.error);

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
