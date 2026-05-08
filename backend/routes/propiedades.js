const router = require('express').Router();
const supabase = require('../utils/supabase');
const { authMiddleware, adminOnly } = require('../middleware/auth');

router.get('/', authMiddleware, async (req, res) => {
  if (req.user.rol === 'admin') {
    const { data } = await supabase.from('propiedades').select('*').order('created_at', { ascending: false });
    return res.json(data || []);
  }

  const { data: partsActivas } = await supabase
    .from('participaciones')
    .select('porcentaje, monto_invertido, fecha_entrada, activo, propiedades(*)')
    .eq('usuario_id', req.user.id);

  const propMap = new Map();
  (partsActivas || []).forEach(p => {
    if (!p.propiedades) return;
    const pid = p.propiedades.id;
    if (!propMap.has(pid) || p.activo) {
      propMap.set(pid, {
        ...p.propiedades,
        mi_porcentaje: p.porcentaje,
        mi_inversion: p.monto_invertido,
        mi_entrada: p.fecha_entrada,
        activo: p.activo
      });
    }
  });

  res.json(Array.from(propMap.values()));
});

router.get('/:id', authMiddleware, async (req, res) => {
  const { data, error } = await supabase.from('propiedades').select('*').eq('id', req.params.id).single();
  if (error || !data) return res.status(404).json({ error: 'No encontrada' });
  if (req.user.rol === 'admin') {
    const { data: parts } = await supabase.from('participaciones').select('*, usuarios(id,nombre,apellido,email)').eq('propiedad_id', req.params.id);
    return res.json({ ...data, participaciones: parts || [] });
  }
  res.json(data);
});

router.post('/', authMiddleware, adminOnly, async (req, res) => {
  const { data, error } = await supabase.from('propiedades').insert([req.body]).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data);
});

router.put('/:id', authMiddleware, adminOnly, async (req, res) => {
  const { data, error } = await supabase.from('propiedades').update(req.body).eq('id', req.params.id).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

router.delete('/:id', authMiddleware, adminOnly, async (req, res) => {
  const { error } = await supabase.from('propiedades').delete().eq('id', req.params.id);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ ok: true });
});

module.exports = router;
