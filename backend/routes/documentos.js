const router = require('express').Router();
const multer = require('multer');
const supabase = require('../utils/supabase');
const { authMiddleware, adminOnly } = require('../middleware/auth');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// GET /api/documentos/todos — admin ve todos
router.get('/todos', authMiddleware, adminOnly, async (req, res) => {
  let query = supabase.from('documentos')
    .select('*, propiedades(nombre), usuarios(nombre,apellido)');
  if (req.query.usuario_id) query = query.eq('usuario_id', req.query.usuario_id);
  const { data } = await query.order('created_at', { ascending: false });
  res.json(data || []);
});

// GET /api/documentos — el inversor ve los suyos (solo publicados)
router.get('/', authMiddleware, async (req, res) => {
  let query = supabase.from('documentos')
    .select('*, propiedades(nombre), usuarios(nombre,apellido)');
  if (req.user.rol !== 'admin') {
    query = query.eq('usuario_id', req.user.id).eq('publicado', true);
  }
  if (req.query.usuario_id) query = query.eq('usuario_id', req.query.usuario_id);
  const { data } = await query.order('created_at', { ascending: false });
  res.json(data || []);
});

// POST /api/documentos — subir PDF manualmente (admin)
router.post('/', authMiddleware, adminOnly, upload.single('archivo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Se requiere un archivo' });

  const { usuario_id, propiedad_id, nombre, tipo, fecha } = req.body;
  if (!usuario_id || !nombre) return res.status(400).json({ error: 'usuario_id y nombre requeridos' });

  const ext = req.file.originalname.split('.').pop();
  const path = `manuales/${usuario_id}/${Date.now()}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from('documentos').upload(path, req.file.buffer, { contentType: req.file.mimetype, upsert: false });
  if (upErr) return res.status(500).json({ error: 'Error al subir archivo' });

  const { data: urlData } = supabase.storage.from('documentos').getPublicUrl(path);

  const { data, error } = await supabase.from('documentos').insert([{
    usuario_id, propiedad_id: propiedad_id || null,
    nombre, tipo: tipo || 'reporte',
    url: urlData.publicUrl, fecha: fecha || null
  }]).select().single();

  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data);
});

// DELETE /api/documentos/:id
router.delete('/:id', authMiddleware, adminOnly, async (req, res) => {
  await supabase.from('documentos').delete().eq('id', req.params.id);
  res.json({ ok: true });
});

module.exports = router;
