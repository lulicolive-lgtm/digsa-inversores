/**
 * Genera y sube el PDF de reporte actualizado para un inversor
 */
const { generarPDFReporte } = require('./generarPDF');
const supabaseClient = require('./supabase');

async function generarYSubirReporte(userId, usuario, sb = supabaseClient) {
  try {
    // Cargar todos los datos del inversor
    const [partRes, aportesRes, liqRes] = await Promise.all([
      sb.from('participaciones').select('*, propiedades(*)').eq('usuario_id', userId).eq('activo', true),
      sb.from('aportes').select('*').eq('usuario_id', userId).order('fecha'),
      sb.from('liquidaciones').select('*, propiedades(nombre,precio_compra,precio_venta)').eq('usuario_id', userId).order('fecha'),
    ]);

    const participaciones = partRes.data || [];
    const aportes         = aportesRes.data || [];
    const liquidaciones   = liqRes.data || [];

    // Calcular datos del reporte
    const inversion_inicial = aportes
      .filter(a => a.tipo === 'aporte')
      .reduce((s,a) => s + Number(a.monto_eur || a.monto_usd || 0), 0);

    const retiros = aportes
      .filter(a => a.tipo === 'retiro')
      .reduce((s,a) => s + Number(a.monto_eur || a.monto_usd || 0), 0);

    const pisos_activos_raw = participaciones.filter(p => p.propiedades?.estado !== 'vendido');
    const valor_en_cartera = pisos_activos_raw.reduce((s, p) => {
      const prop = p.propiedades;
      const aporte = Number(p.monto_invertido || 0);
      if (prop?.precio_venta && prop?.precio_compra && Number(prop.precio_compra) > 0) {
        const util = (Number(prop.precio_venta) - Number(prop.precio_compra)) * (aporte / Number(prop.precio_compra));
        const fee = Math.max(0, util) * 0.15;
        const imp = Math.max(0, util - fee) * 0.25;
        return s + aporte + util - fee - imp;
      }
      return s + aporte;
    }, 0);

    const en_pisos = pisos_activos_raw.reduce((s,p) => s + Number(p.monto_invertido||0), 0);
    const total_retornado = liquidaciones.reduce((s,l) => s + Number(l.total_retorno||0), 0);
    const aportes_pend = aportes.filter(a => a.tipo === 'pendiente').reduce((s,a) => s + Number(a.monto_eur||0), 0);
    const pendiente = aportes_pend + (extraPendiente || 0) > 0 ? aportes_pend + (extraPendiente || 0) : pisos_activos_raw.length === 0 ? Math.max(0, inversion_inicial + total_retornado - retiros - en_pisos) : 0;
    const valor_actual = valor_en_cartera + pendiente;
    const rentabilidad_total = inversion_inicial > 0 ? (valor_actual - inversion_inicial) / inversion_inicial : 0;

    // TIR
    const primer_aporte = aportes.filter(a => a.tipo === 'aporte').slice(-1)[0];
    let tir = 0;
    if (primer_aporte && inversion_inicial > 0) {
      const dias = (new Date() - new Date(primer_aporte.fecha)) / (1000 * 60 * 60 * 24);
      const anos = dias / 365;
      if (anos > 0) tir = Math.pow(1 + rentabilidad_total, 1 / anos) - 1;
    }

    // Pisos activos para el PDF
    const pisos_activos = pisos_activos_raw.map(p => {
      const prop = p.propiedades;
      const aporte = Number(p.monto_invertido || 0);
      const costo = Number(prop?.precio_compra || 0);
      const venta_est = Number(prop?.precio_venta || 0);
      let neto_est = aporte;
      let rent = 0;
      if (costo > 0 && venta_est > 0) {
        const util = (venta_est - costo) * (aporte / costo);
        const fee = Math.max(0, util) * 0.15;
        const imp = Math.max(0, util - fee) * 0.25;
        neto_est = aporte + util - fee - imp;
        rent = aporte > 0 ? (neto_est - aporte) / aporte : 0;
      }
      return { nombre: prop?.nombre || '—', costo, venta_est, aporte, neto_est, rent };
    });

    // Inversiones finalizadas
    const inversiones_finalizadas = liquidaciones.map(l => ({
      piso: l.propiedades?.nombre || '—',
      inversion: Number(l.propiedades?.precio_compra || 0),
      venta: Number(l.precio_venta || l.propiedades?.precio_venta || 0),
      aporte: Number(l.aporte_usuario || 0),
      liquidacion: Number(l.total_retorno || 0),
      rent: l.aporte_usuario > 0 ? (Number(l.total_retorno) - Number(l.aporte_usuario)) / Number(l.aporte_usuario) : 0,
      destino: '—',
    }));

    // Aportes para el PDF
    const aportesPDF = aportes.map(a => ({
      fecha: a.fecha,
      usd: a.monto_usd !== a.monto_eur ? a.monto_usd : null,
      eur: Number(a.monto_eur || a.monto_usd || 0),
      tipo: a.tipo,
      descripcion: a.descripcion || '—',
    }));

    const fecha = new Date().toISOString().split('T')[0];
    const mes_año = new Date().toLocaleDateString('es-ES', { month: 'numeric', year: 'numeric' }).replace('/', '.');

    const pdfBuffer = await generarPDFReporte({
      usuario: { nombre: usuario.nombre, apellido: usuario.apellido, email: usuario.email },
      fecha,
      inversion_inicial,
      valor_actual,
      rentabilidad_total,
      tir,
      pisos_activos,
      inversiones_finalizadas,
      aportes: aportesPDF,
      pendiente,
    });

    const iniciales = (usuario.nombre[0] + usuario.apellido[0]).toUpperCase();
    const pdfPath = `reportes/Reporte_${iniciales}_${mes_año.replace('.','_')}.pdf`;

    const { error: uploadErr } = await sb.storage
      .from('documentos').upload(pdfPath, pdfBuffer, { contentType: 'application/pdf', upsert: true });

    if (!uploadErr) {
      const { data: urlData } = sb.storage.from('documentos').getPublicUrl(pdfPath);
      // Actualizar o crear registro de documento
      const { data: docExist } = await sb.from('documentos')
        .select('id').eq('usuario_id', userId).eq('nombre', `Reporte de Inversión ${mes_año}`).single();
      if (docExist) {
        await sb.from('documentos').update({ url: urlData.publicUrl, fecha, publicado: false }).eq('id', docExist.id);
      } else {
        await sb.from('documentos').insert([{
          usuario_id: userId,
          nombre: `Reporte de Inversión ${mes_año}`,
          tipo: 'reporte',
          url: urlData.publicUrl,
          fecha,
          publicado: false,
        }]);
      }
    }

    return { ok: true };
  } catch(e) {
    console.error('generarYSubirReporte error:', e.message);
    return { ok: false, error: e.message };
  }
}

module.exports = { generarYSubirReporte };
