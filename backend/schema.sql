-- ═══════════════════════════════════════════════════════════
--  DIGSA · Inversores — Schema Supabase
--  Ejecutar en: Supabase → SQL Editor → New query
-- ═══════════════════════════════════════════════════════════

-- ── USUARIOS (inversores + admins) ──────────────────────────
CREATE TABLE usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  nombre TEXT NOT NULL,
  apellido TEXT NOT NULL,
  telefono TEXT,
  rol TEXT NOT NULL DEFAULT 'inversor' CHECK (rol IN ('inversor', 'admin')),
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ── PROPIEDADES (pisos) ──────────────────────────────────────
CREATE TABLE propiedades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,                         -- "Ayala 85", "DRC 48"
  direccion TEXT NOT NULL,
  ciudad TEXT DEFAULT 'Madrid',
  descripcion TEXT,
  fecha_compra DATE,
  precio_compra NUMERIC(12,2),
  gastos_compra NUMERIC(12,2) DEFAULT 0,
  gastos_operativos_pct NUMERIC(5,4) DEFAULT 0.02,
  precio_venta NUMERIC(12,2),
  fecha_venta DATE,
  estado TEXT DEFAULT 'en_obra' CHECK (estado IN ('en_obra','disponible','reservado','vendido')),
  tipo TEXT DEFAULT 'flipping' CHECK (tipo IN ('flipping','renta','mixto')),
  renta_mensual NUMERIC(10,2),                 -- si genera alquiler
  imagen_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ── PAQUETES DE INVERSIÓN ────────────────────────────────────
-- Agrupa propiedades en un pool (ej: Paquete 1, Paquete 2)
CREATE TABLE paquetes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  descripcion TEXT,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Propiedades dentro de un paquete
CREATE TABLE paquete_propiedades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paquete_id UUID REFERENCES paquetes(id) ON DELETE CASCADE,
  propiedad_id UUID REFERENCES propiedades(id) ON DELETE CASCADE,
  UNIQUE(paquete_id, propiedad_id)
);

-- ── PARTICIPACIONES ──────────────────────────────────────────
-- Cuánto % tiene cada inversor en cada propiedad (o paquete)
CREATE TABLE participaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID REFERENCES usuarios(id) ON DELETE CASCADE,
  propiedad_id UUID REFERENCES propiedades(id) ON DELETE CASCADE,
  porcentaje NUMERIC(8,6) NOT NULL,            -- 0.031694 = 3.1694%
  monto_invertido NUMERIC(12,2) NOT NULL,      -- en USD
  fecha_entrada DATE NOT NULL,
  activo BOOLEAN DEFAULT true,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(usuario_id, propiedad_id)
);

-- ── APORTES ─────────────────────────────────────────────────
-- Historial de transferencias de cada inversor
CREATE TABLE aportes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID REFERENCES usuarios(id) ON DELETE CASCADE,
  propiedad_id UUID REFERENCES propiedades(id),  -- NULL si es aporte general
  monto_usd NUMERIC(12,2) NOT NULL,
  tipo_cambio NUMERIC(8,4),                    -- USD/EUR al momento del aporte
  monto_eur NUMERIC(12,2),
  fecha DATE NOT NULL,
  tipo TEXT DEFAULT 'aporte' CHECK (tipo IN ('aporte','retiro','liquidacion','renta')),
  descripcion TEXT,
  comprobante_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── LIQUIDACIONES ────────────────────────────────────────────
-- Cuando se vende un piso, se registra la liquidación
CREATE TABLE liquidaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  propiedad_id UUID REFERENCES propiedades(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES usuarios(id) ON DELETE CASCADE,
  fecha DATE NOT NULL,
  precio_venta NUMERIC(12,2) NOT NULL,
  aporte_usuario NUMERIC(12,2) NOT NULL,
  porcentaje NUMERIC(8,6) NOT NULL,
  utilidad_bruta NUMERIC(12,2),
  fee_exito_pct NUMERIC(5,4) DEFAULT 0.15,
  fee_exito_monto NUMERIC(12,2),
  utilidad_neta NUMERIC(12,2),
  total_retorno NUMERIC(12,2),
  pdf_url TEXT,                                -- URL del PDF generado
  enviado_email BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── DOCUMENTOS ──────────────────────────────────────────────
-- PDFs subidos manualmente por admin (reportes históricos)
CREATE TABLE documentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID REFERENCES usuarios(id) ON DELETE CASCADE,
  propiedad_id UUID REFERENCES propiedades(id),
  nombre TEXT NOT NULL,
  tipo TEXT DEFAULT 'reporte' CHECK (tipo IN ('reporte','liquidacion','contrato','otro')),
  url TEXT NOT NULL,                           -- URL en Supabase Storage
  fecha DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── NOTIFICACIONES ───────────────────────────────────────────
CREATE TABLE notificaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID REFERENCES usuarios(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  mensaje TEXT NOT NULL,
  leida BOOLEAN DEFAULT false,
  tipo TEXT DEFAULT 'info' CHECK (tipo IN ('info','liquidacion','aporte','alerta')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── TRIGGERS: updated_at automático ─────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_usuarios_updated BEFORE UPDATE ON usuarios
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_propiedades_updated BEFORE UPDATE ON propiedades
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── DATOS INICIALES ──────────────────────────────────────────
-- Admin por defecto (cambiar contraseña al primer login)
-- Password: Admin1234! (hash bcrypt)
INSERT INTO usuarios (email, password_hash, nombre, apellido, rol) VALUES
('admin@digsa.es', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.utrXa/q2a', 'Admin', 'DIGSA', 'admin');

-- Propiedades reales de los archivos
INSERT INTO propiedades (nombre, direccion, estado, tipo, fecha_compra, precio_compra, precio_venta, fecha_venta) VALUES
('Alcalá 146',    'Alcalá 146, Madrid',           'vendido',    'flipping', '2022-01-01', 218385,   280000, '2023-12-01'),
('DRC 48',        'Don Ramón de la Cruz 48, Madrid','vendido',   'flipping', '2021-01-01', 205000,   245500, '2023-01-01'),
('Ayala 78',      'Ayala 78, Madrid',              'vendido',    'flipping', '2022-01-01', NULL,     NULL,   NULL),
('Ayala 85',      'Ayala 85, Madrid',              'en_obra',    'flipping', '2023-01-01', NULL,     NULL,   NULL),
('Ayala 134',     'Ayala 134, Madrid',             'en_obra',    'flipping', '2023-01-01', 1063982,  1200000,NULL),
('Ayala 154',     'Ayala 154, Madrid',             'en_obra',    'flipping', '2023-01-01', NULL,     NULL,   NULL),
('Villa 4',       'Villa 4, Madrid',               'reservado',  'mixto',    '2022-01-01', 516990,   590000, NULL),
('Jardín San Federico 15','Jardín San Federico 15','vendido',    'flipping', '2023-01-01', NULL,     NULL,   NULL),
('Hermosilla 131','Hermosilla 131, Madrid',        'en_obra',    'flipping', '2023-01-01', NULL,     NULL,   NULL),
('Lagasca 58',    'Lagasca 58, Madrid',            'en_obra',    'flipping', '2023-01-01', NULL,     NULL,   NULL),
('Lagasca 80',    'Lagasca 80, Madrid',            'en_obra',    'flipping', '2023-01-01', NULL,     NULL,   NULL);

-- ── ROW LEVEL SECURITY (RLS) ─────────────────────────────────
-- Los inversores solo ven sus propios datos
ALTER TABLE participaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE aportes ENABLE ROW LEVEL SECURITY;
ALTER TABLE liquidaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE notificaciones ENABLE ROW LEVEL SECURITY;

-- Nota: La app usa Service Role Key en el backend, 
-- por lo que el backend tiene acceso total.
-- El RLS protege accesos directos desde el cliente.
