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
router.post('/', authMiddleware, adminOnly, async (req, res) => {
  const { usuario_id, propiedad_id, monto_usd, monto_eur, tipo_cambio, fecha, tipo, descripcion } = req.body;
  if (!usuario_id || !fecha)
    return res.status(400).json({ error: 'usuario_id y fecha son requeridos' });

  // Calcular tipo de cambio y montos correctamente
  let tc = tipo_cambio ? Number(tipo_cambio) : null;
  let eur_final = monto_eur ? Number(monto_eur) : null;
  let usd_final = monto_usd ? Number(monto_usd) : null;
  
  // Si tiene ambos, calcular TC
  if (usd_final && eur_final && !tc) tc = usd_final / eur_final;
  // Si solo tiene USD y TC, calcular EUR
  if (usd_final && tc && !eur_final) eur_final = usd_final / tc;
  // Si solo tiene EUR, usar como USD también
  if (eur_final && !usd_final) usd_final = eur_final;

  const { data, error } = await supabase
    .from('aportes')
    .insert([{ usuario_id, propiedad_id: propiedad_id || null, monto_usd: usd_final, tipo_cambio: tc, monto_eur: eur_final, fecha, tipo: tipo || 'aporte', descripcion }])
    .select('*, propiedades(nombre), usuarios(nombre,apellido)')
    .single();

  if (error) return res.status(400).json({ error: error.message });

  // Si es un aporte a un piso, descontar del pendiente de inversión
  if (propiedad_id && tipo === 'aporte' && eur_final > 0) {
    try {
      const { data: pendientes } = await supabase.from('pendientes_inversion')
        .select('id,monto_eur').eq('usuario_id', usuario_id).eq('asignado', false)
        .order('fecha', { ascending: true });
      
      let restante = Number(eur_final);
      for (const pend of (pendientes || [])) {
        if (restante <= 0) break;
        const monto_pend = Number(pend.monto_eur);
        if (monto_pend <= restante) {
          await supabase.from('pendientes_inversion').update({ asignado: true }).eq('id', pend.id);
          restante -= monto_pend;
        } else {
          await supabase.from('pendientes_inversion').update({ monto_eur: monto_pend - restante }).eq('id', pend.id);
          restante = 0;
        }
      }
    } catch(e) { console.error('Error descontando pendiente:', e.message); }
  }

  // Notificar al inversor
  await supabase.from('notificaciones').insert([{
    usuario_id,
    titulo: 'Nuevo aporte registrado',
    mensaje: `Se registró un aporte de $${Number(monto_usd).toLocaleString('es-ES')} USD${propiedad_id ? '' : ' (aporte general)'}`,
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
