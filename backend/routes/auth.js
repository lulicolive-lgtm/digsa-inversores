const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const supabase = require('../utils/supabase');
const { authMiddleware, adminOnly } = require('../middleware/auth');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email y contraseña requeridos' });

  const { data: user, error } = await supabase
    .from('usuarios')
    .select('*')
    .eq('email', email.toLowerCase().trim())
    .eq('activo', true)
    .single();

  if (error || !user) return res.status(401).json({ error: 'Email o contraseña incorrectos' });

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Email o contraseña incorrectos' });

  const token = jwt.sign(
    { id: user.id, email: user.email, rol: user.rol },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      nombre: user.nombre,
      apellido: user.apellido,
      rol: user.rol
    }
  });
});

// GET /api/auth/me
router.get('/me', authMiddleware, (req, res) => res.json({ user: req.user }));

// POST /api/auth/cambiar-password
router.post('/cambiar-password', authMiddleware, async (req, res) => {
  const { password_actual, password_nuevo } = req.body;
  if (!password_actual || !password_nuevo) return res.status(400).json({ error: 'Faltan campos' });
  if (password_nuevo.length < 8) return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });

  const { data: user } = await supabase.from('usuarios').select('password_hash').eq('id', req.user.id).single();
  const ok = await bcrypt.compare(password_actual, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Contraseña actual incorrecta' });

  const hash = await bcrypt.hash(password_nuevo, 10);
  await supabase.from('usuarios').update({ password_hash: hash }).eq('id', req.user.id);
  res.json({ ok: true });
});


router.post('/cambiar-password', authMiddleware, async (req, res) => {
  const { password_actual, password_nueva } = req.body;
  if (!password_actual || !password_nueva) return res.status(400).json({ error: 'Faltan datos' });
  if (password_nueva.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
  try {
    const { data: user } = await supabase.from('usuarios').select('id,nombre,apellido,email,password_hash').eq('id', req.user.id).single();
    const bcrypt = require('bcrypt');
    const ok = await bcrypt.compare(password_actual, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Contraseña actual incorrecta' });
    const hash = await bcrypt.hash(password_nueva, 10);
    await supabase.from('usuarios').update({ password_hash: hash }).eq('id', user.id);
    try {
      const { enviarCambioPassword } = require('../utils/email');
      await enviarCambioPassword(user.email, user.nombre + ' ' + user.apellido, password_nueva);
    } catch(e) { console.error('Error email:', e.message); }
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/admin/reset-password', authMiddleware, adminOnly, async (req, res) => {
  const { usuario_id, password_nueva } = req.body;
  if (!password_nueva || password_nueva.length < 6) return res.status(400).json({ error: 'Contraseña debe tener al menos 6 caracteres' });
  try {
    const { data: user } = await supabase.from('usuarios').select('id,nombre,apellido,email').eq('id', usuario_id).single();
    const bcrypt = require('bcrypt');
    const hash = await bcrypt.hash(password_nueva, 10);
    await supabase.from('usuarios').update({ password_hash: hash }).eq('id', usuario_id);
    try {
      const { enviarCambioPassword } = require('../utils/email');
      await enviarCambioPassword(user.email, user.nombre + ' ' + user.apellido, password_nueva);
    } catch(e) { console.error('Error email:', e.message); }
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});


const crypto = require('crypto');

router.post('/solicitar-reset', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email requerido' });
  try {
    const { data: user } = await supabase.from('usuarios').select('id,nombre,apellido,email').eq('email', email.toLowerCase()).single();
    if (!user) return res.json({ ok: true });
    const crypto2 = require('crypto');
    const token = crypto2.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000);
    await supabase.from('password_reset_tokens').insert([{ usuario_id: user.id, token, expires_at: expires.toISOString(), usado: false }]);
    const link = "https://digsa-inversores-production.up.railway.app?reset=" + token;
    const { enviarEmail } = require('../utils/email');
    await enviarEmail({ to: user.email, subject: 'Recuperar contraseña — DIGSA España', html: "<div style=\"font-family:Arial,sans-serif;max-width:500px\"><div style=\"background:#1a1a1a;padding:24px;text-align:center\"><h2 style=\"color:#fff;margin:0\">DIGSA España</h2></div><div style=\"padding:32px;background:#f9f9f9\"><p>Hola <strong>" + user.nombre + "</strong>,</p><p>Para restablecer tu contraseña hacé click en el siguiente link:</p><p style=\"text-align:center;margin:32px 0\"><a href=\"" + link + "\" style=\"background:#FF4D0F;color:#fff;padding:14px 28px;text-decoration:none;border-radius:6px;font-weight:700\">Restablecer contraseña</a></p><p style=\"color:#888;font-size:13px\">Expira en 1 hora.</p></div><div style=\"padding:16px;text-align:center;color:#aaa;font-size:12px\">Villanueva 27, Madrid · La Pampa 1517 3C, Buenos Aires</div></div>" });
    res.json({ ok: true });
  } catch(e) { console.error('Error reset:', e.message); res.json({ ok: true }); }
});

router.post('/confirmar-reset', async (req, res) => {
  const { token, password_nueva } = req.body;
  if (!token || !password_nueva) return res.status(400).json({ error: 'Faltan datos' });
  if (password_nueva.length < 6) return res.status(400).json({ error: 'Minimo 6 caracteres' });
  try {
    const { data: t } = await supabase.from('password_reset_tokens').select('*').eq('token', token).eq('usado', false).single();
    if (!t) return res.status(400).json({ error: 'Token invalido o expirado' });
    if (new Date(t.expires_at) < new Date()) return res.status(400).json({ error: 'Token expirado' });
    const bcrypt = require('bcrypt');
    const hash = await bcrypt.hash(password_nueva, 10);
    await supabase.from('usuarios').update({ password_hash: hash }).eq('id', t.usuario_id);
    await supabase.from('password_reset_tokens').update({ usado: true }).eq('id', t.id);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
