const jwt = require('jsonwebtoken');
const supabase = require('../utils/supabase');

// Verifica JWT y adjunta usuario al request
async function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Token requerido' });

  const token = header.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { data: user, error } = await supabase
      .from('usuarios')
      .select('id, email, nombre, apellido, rol, activo')
      .eq('id', decoded.id)
      .single();

    if (error || !user || !user.activo) return res.status(401).json({ error: 'Sesión inválida' });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Token expirado o inválido' });
  }
}

// Solo admins
function adminOnly(req, res, next) {
  if (req.user?.rol !== 'admin') return res.status(403).json({ error: 'Acceso solo para administradores' });
  next();
}

module.exports = { authMiddleware, adminOnly };
