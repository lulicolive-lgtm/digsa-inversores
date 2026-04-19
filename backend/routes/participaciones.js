const router = require('express').Router();
const supabase = require('../utils/supabase');
const { authMiddleware, adminOnly } = require('../middleware/auth');

// GET /api/participaciones?propiedad_id=xxx — participantes de un piso (admin)
router.get('/', authMiddleware, adminOnly, async (req, res) => {
  let query = supabase
    .from('participaciones')
    .select('*, usuarios(id,nombre,apellido,email), propiedades(nombre,estado)');
  if (req.query.propiedad_id) query = query.eq('propiedad_id', req.query.propiedad_id);
  if (req.query.usuario_id) query = query.eq('usuario_id', req.query.usuario_id);
  const { data } = await query;
  res.json(data || []);
});

// POST /api/participaciones — asignar inversor a piso (admin)
router.post('/', authMiddleware, adminOnly, async (req, res) => {
  const { usuario_id, propiedad_id, porcentaje, monto_invertido, fecha_entrada, notas } = req.body;
  if (!usuario_id || !propiedad_id || !porcentaje || !monto_invertido || !fecha_entrada)
    return res.status(400).json({ error: 'Todos los campos son requeridos' });

  // Verificar que el total de porcentajes no supere 100%
  const { data: existentes } = await supabase
    .from('participaciones').select('porcentaje').eq('propiedad_id', propiedad_id).eq('activo', true);
  const totalActual = (existentes || []).reduce((s, p) => s + Number(p.porcentaje), 0);
  if (totalActual + Number(porcentaje) > 1.0001)
    return res.status(400).json({ error: `El total de participaciones superaría el 100% (actual: ${(totalActual*100).toFixed(2)}%)` });

  const { data, error } = await supabase
    .from('participaciones')
    .insert([{ usuario_id, propiedad_id, porcentaje, monto_invertido, fecha_entrada, notas }])
    .select('*, usuarios(nombre,apellido), propiedades(nombre)')
    .single();

  if (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'Este inversor ya tiene participación en esta propiedad' });
    return res.status(400).json({ error: error.message });
  }

  // Registrar aporte automáticamente
  await supabase.from('aportes').insert([{
    usuario_id, propiedad_id, monto_usd: monto_invertido,
    fecha: fecha_entrada, tipo: 'aporte',
    descripcion: `Inversión en ${data.propiedades?.nombre}`
  }]);

  res.status(201).json(data);
});

// PUT /api/participaciones/:id
router.put('/:id', authMiddleware, adminOnly, async (req, res) => {
  const { data, error } = await supabase
    .from('participaciones').update(req.body).eq('id', req.params.id).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// DELETE /api/participaciones/:id
router.delete('/:id', authMiddleware, adminOnly, async (req, res) => {
  await supabase.from('participaciones').update({ activo: false }).eq('id', req.params.id);
  res.json({ ok: true });
});

module.exports = router;
