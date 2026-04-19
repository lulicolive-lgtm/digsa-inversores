const router = require('express').Router();
const bcrypt = require('bcryptjs');
const supabase = require('../utils/supabase');
const { authMiddleware, adminOnly } = require('../middleware/auth');

// GET /api/inversores — lista todos los inversores (solo admin)
router.get('/', authMiddleware, adminOnly, async (req, res) => {
  const { data, error } = await supabase
    .from('usuarios')
    .select('id, email, nombre, apellido, telefono, rol, activo, created_at')
    .order('apellido');
  res.json(data || []);
});

// GET /api/inversores/:id — detalle de un inversor (admin)
router.get('/:id', authMiddleware, adminOnly, async (req, res) => {
  const uid = req.params.id;
  const [userRes, partRes, aportesRes, liqRes] = await Promise.all([
    supabase.from('usuarios').select('id,email,nombre,apellido,telefono,rol,activo,created_at').eq('id', uid).single(),
    supabase.from('participaciones').select('*, propiedades(nombre,estado)').eq('usuario_id', uid),
    supabase.from('aportes').select('*, propiedades(nombre)').eq('usuario_id', uid).order('fecha', { ascending: false }),
    supabase.from('liquidaciones').select('*, propiedades(nombre)').eq('usuario_id', uid).order('fecha', { ascending: false })
  ]);

  if (!userRes.data) return res.status(404).json({ error: 'Inversor no encontrado' });

  const aportes = aportesRes.data || [];
  const total_invertido = aportes.filter(a => a.tipo === 'aporte').reduce((s, a) => s + Number(a.monto_usd), 0);
  const total_retornado = (liqRes.data || []).reduce((s, l) => s + Number(l.total_retorno || 0), 0);

  res.json({
    ...userRes.data,
    participaciones: partRes.data || [],
    aportes,
    liquidaciones: liqRes.data || [],
    resumen: { total_invertido, total_retornado }
  });
});

// POST /api/inversores — crear nuevo inversor (admin)
router.post('/', authMiddleware, adminOnly, async (req, res) => {
  const { email, nombre, apellido, telefono, password } = req.body;
  if (!email || !nombre || !apellido || !password)
    return res.status(400).json({ error: 'Email, nombre, apellido y contraseña son requeridos' });

  const hash = await bcrypt.hash(password, 10);
  const { data, error } = await supabase
    .from('usuarios')
    .insert([{ email: email.toLowerCase().trim(), password_hash: hash, nombre, apellido, telefono, rol: 'inversor' }])
    .select('id, email, nombre, apellido, telefono, rol, activo, created_at')
    .single();

  if (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'Ya existe un usuario con ese email' });
    return res.status(400).json({ error: error.message });
  }

  res.status(201).json(data);
});

// PUT /api/inversores/:id — editar inversor (admin)
router.put('/:id', authMiddleware, adminOnly, async (req, res) => {
  const { password, ...campos } = req.body;
  if (password) {
    if (password.length < 8) return res.status(400).json({ error: 'Mínimo 8 caracteres' });
    campos.password_hash = await bcrypt.hash(password, 10);
  }
  const { data, error } = await supabase
    .from('usuarios')
    .update(campos)
    .eq('id', req.params.id)
    .select('id, email, nombre, apellido, telefono, rol, activo')
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// DELETE (desactivar) /api/inversores/:id
router.delete('/:id', authMiddleware, adminOnly, async (req, res) => {
  await supabase.from('usuarios').update({ activo: false }).eq('id', req.params.id);
  res.json({ ok: true });
});

module.exports = router;
