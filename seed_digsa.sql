-- ============================================================
-- SEED COMPLETO DIGSA · Generado desde Excel de inversores
-- ============================================================

-- 1. LIMPIAR tablas (orden por FK)
DELETE FROM documentos;
DELETE FROM liquidaciones;
DELETE FROM participaciones;
DELETE FROM aportes;
DELETE FROM propiedades;
DELETE FROM usuarios WHERE email != 'admin@digsa.es';

-- 2. INVERSORES (con iniciales como nombre/apellido)
INSERT INTO usuarios (nombre, apellido, email, password_hash, rol, activo) VALUES
('C', 'S', 'cs@digsa.es', crypt('cs2024', gen_salt('bf')), 'inversor', true),
('S', 'L', 'sl@digsa.es', crypt('sl2024', gen_salt('bf')), 'inversor', true),
('L', 'G', 'lg@digsa.es', crypt('lg2024', gen_salt('bf')), 'inversor', true),
('S', 'N', 'sn@digsa.es', crypt('sn2024', gen_salt('bf')), 'inversor', true),
('Y', 'I', 'yi@digsa.es', crypt('yi2024', gen_salt('bf')), 'inversor', true),
('F', 'S', 'fs@digsa.es', crypt('fs2024', gen_salt('bf')), 'inversor', true),
('S', 'B', 'sb@digsa.es', crypt('sb2024', gen_salt('bf')), 'inversor', true),
('D', 'E', 'de@digsa.es', crypt('de2024', gen_salt('bf')), 'inversor', true),
('R', 'G', 'rg@digsa.es', crypt('rg2024', gen_salt('bf')), 'inversor', true),
('L', 'S', 'ls@digsa.es', crypt('ls2024', gen_salt('bf')), 'inversor', true),
('P', 'S', 'ps@digsa.es', crypt('ps2024', gen_salt('bf')), 'inversor', true);

-- 3. PROPIEDADES
INSERT INTO propiedades (nombre, direccion, estado, tipo, precio_compra, precio_venta, fecha_compra, fecha_venta) VALUES
-- ACTIVAS
('Lagasca 58',           'Lagasca 58, Madrid',                   'en_obra',    'flipping', 1760136.00,  1950000.00,  '2024-01-01', NULL),
('Lagasca 80',           'Lagasca 80, Madrid',                   'disponible', 'flipping', 2025916.80,  2220000.00,  '2024-06-01', NULL),
('Hermosilla 131',       'Hermosilla 131, Madrid',               'en_obra',    'flipping',  799798.27,   900000.00,  '2024-03-01', NULL),
-- VENDIDAS
('Jardin de San Federico 15', 'Jardín de San Federico 15, Madrid','vendido',   'flipping', 1191294.73,  1360000.00,  '2023-01-01', '2024-10-01'),
('Ayala 154',            'Ayala 154, Madrid',                    'vendido',    'flipping',  795607.01,   870000.00,  '2023-01-01', '2024-10-01'),
('Ayala 78',             'Ayala 78, Madrid',                     'vendido',    'flipping',  449939.25,   480000.00,  '2023-06-01', '2025-03-01'),
('Ayala 134',            'Ayala 134, Madrid',                    'vendido',    'flipping', 1137598.04,  1350000.00,  '2022-06-01', '2024-09-01'),
('Don Ramon de la Cruz 98','Don Ramón de la Cruz 98, Madrid',    'vendido',    'flipping',  829588.81,   950000.00,  '2022-12-01', '2025-03-01'),
('Don Ramon de la Cruz 48','Don Ramón de la Cruz 48, Madrid',    'vendido',    'flipping',  226833.85,   245500.00,  '2022-06-01', '2023-06-01'),
('Alcala 146',           'Alcalá 146, Madrid',                   'vendido',    'flipping',  250336.55,   350000.00,  '2022-06-01', '2023-12-01'),
('Bailen 33',            'Bailén 33, Madrid',                    'vendido',    'flipping',  625142.87,   755000.00,  '2022-01-01', '2024-06-01'),
('Montesa 16 5C',        'Montesa 16 5°C, Madrid',               'vendido',    'flipping',  985452.36,  1200000.00,  '2021-07-01', '2022-07-01'),
('Madera 31',            'Madera 31, Madrid',                    'vendido',    'flipping',  208607.69,   270000.00,  '2022-06-01', '2024-03-01'),
('Villa 4 2 Dcha',       'Villa 4 2° Dcha, Madrid',              'vendido',    'flipping',  544673.45,   610000.00,  '2022-06-01', '2024-06-01'),
('Ayala 128 3',          'Ayala 128 3°, Madrid',                 'vendido',    'flipping', 1018271.47,  1158000.00,  '2021-07-01', '2023-12-01'),
('Diego de Leon 24',     'Diego de León 24 1°IZQ, Madrid',       'vendido',    'flipping',  751708.93,   850000.00,  '2021-05-01', '2022-06-01'),
('Costa Rica 28 2E',     'Costa Rica 28 2°E, Madrid',            'vendido',    'flipping',  422966.25,   467000.00,  '2021-05-01', '2022-06-01'),
('R. Dominicana 4 5B',   'República Dominicana 4 5°B, Madrid',   'vendido',    'flipping',  503511.35,   550000.00,  '2021-11-01', '2022-12-01'),
('Dr. Esquerdo 19 4 Dcha','Dr. Esquerdo 19 4° Dcha, Madrid',     'vendido',    'flipping',  473340.03,   543000.00,  '2021-11-01', '2023-06-01'),
('Rafael de Riego 23 Piso','Rafael de Riego 23 Piso, Madrid',    'vendido',    'flipping',  213753.16,   265000.00,  '2021-05-01', '2023-01-01'),
('Rafael de Riego 23 Local','Rafael de Riego 23 Local, Madrid',  'vendido',    'flipping',  100826.96,   100000.00,  '2021-05-01', '2024-09-01'),
('Gral. Pardinas 114 7', 'Gral. Pardiñas 114 7°, Madrid',        'vendido',    'flipping', 1113535.53,  1250000.00,  '2020-05-01', '2022-01-01');


-- ============================================================
-- 4. APORTES (datos reales de cada inversor desde Excel)
-- ============================================================
-- Usamos subconsultas para obtener el ID del usuario por email

-- CS
INSERT INTO aportes (usuario_id, propiedad_id, fecha, tipo, monto_usd, monto_eur, descripcion) VALUES
((SELECT id FROM usuarios WHERE email='cs@digsa.es'), NULL, '2024-11-25', 'aporte', NULL, 6000, 'JFS 15 / Ayala 154');

-- SL
INSERT INTO aportes (usuario_id, propiedad_id, fecha, tipo, monto_usd, monto_eur, descripcion) VALUES
((SELECT id FROM usuarios WHERE email='sl@digsa.es'), NULL, '2022-11-30', 'aporte', 99500,  92413.46, 'Calle de la Villa 4'),
((SELECT id FROM usuarios WHERE email='sl@digsa.es'), NULL, '2022-12-30', 'aporte', 42853.5, 38978.99, 'Calle Madera 31'),
((SELECT id FROM usuarios WHERE email='sl@digsa.es'), NULL, '2022-12-30', 'aporte', 42853.5, 38978.99, 'Alcala 146 / DRC 48 / Ayala 134'),
((SELECT id FROM usuarios WHERE email='sl@digsa.es'), NULL, '2022-12-30', 'aporte', 55000,  49034.74, 'Alcala 146 / DRC 48 / Ayala 134'),
((SELECT id FROM usuarios WHERE email='sl@digsa.es'), NULL, '2023-01-31', 'aporte', 99985,  89140.71, 'Alcala 146 / DRC 48 / Ayala 134'),
((SELECT id FROM usuarios WHERE email='sl@digsa.es'), NULL, '2024-09-25', 'aporte', 200000, 174464.02, 'JFS 15 / Ayala 154'),
((SELECT id FROM usuarios WHERE email='sl@digsa.es'), NULL, '2024-10-25', 'aporte', 203600, 181448.07, 'JFS 15 / Ayala 154'),
((SELECT id FROM usuarios WHERE email='sl@digsa.es'), NULL, '2025-09-15', 'aporte', 250000, 212372.70, 'Lagasca 58');

-- LG
INSERT INTO aportes (usuario_id, propiedad_id, fecha, tipo, monto_usd, monto_eur, descripcion) VALUES
((SELECT id FROM usuarios WHERE email='lg@digsa.es'), NULL, '2022-06-30', 'aporte', 106732, 101279.13, 'Bailen 33 / Montesa 16'),
((SELECT id FROM usuarios WHERE email='lg@digsa.es'), NULL, '2025-03-28', 'aporte', 80534.3, 72553.42, 'DRC98 / Lagasca 58 / Ayala 78');

-- SN
INSERT INTO aportes (usuario_id, propiedad_id, fecha, tipo, monto_usd, monto_eur, descripcion) VALUES
((SELECT id FROM usuarios WHERE email='sn@digsa.es'), NULL, '2021-05-31', 'aporte', 61982, 50000, 'Rafael de Riego 23 / Costa Rica 24 / Diego de Leon 24'),
((SELECT id FROM usuarios WHERE email='sn@digsa.es'), NULL, '2021-11-30', 'aporte', 35581, 30000, 'R. Dominicana 4 / Dr. Esquerdo 19 / Ayala 128'),
((SELECT id FROM usuarios WHERE email='sn@digsa.es'), NULL, '2022-11-30', 'aporte', 50000, 49716, 'Calle de la Villa 4'),
((SELECT id FROM usuarios WHERE email='sn@digsa.es'), NULL, '2025-04-03', 'aporte', 50000, 43859.65, 'DRC98 / Lagasca 58');

-- YI
INSERT INTO aportes (usuario_id, propiedad_id, fecha, tipo, monto_usd, monto_eur, descripcion) VALUES
((SELECT id FROM usuarios WHERE email='yi@digsa.es'), NULL, '2021-07-31', 'aporte', NULL, 12000, 'Bailen 33 / Montesa 16'),
((SELECT id FROM usuarios WHERE email='yi@digsa.es'), NULL, '2021-07-31', 'aporte', 1700, 1613.15, 'Bailen 33 / Montesa 16'),
((SELECT id FROM usuarios WHERE email='yi@digsa.es'), NULL, '2023-09-30', 'aporte', NULL, 1500, 'Alcala 146 / DRC 48 / Ayala 134'),
((SELECT id FROM usuarios WHERE email='yi@digsa.es'), NULL, '2024-11-01', 'aporte', 5000, 4347.83, 'JFS 15 / Ayala 154'),
((SELECT id FROM usuarios WHERE email='yi@digsa.es'), NULL, '2024-11-02', 'aporte', NULL, 2500, 'JFS 15 / Ayala 154'),
((SELECT id FROM usuarios WHERE email='yi@digsa.es'), NULL, '2025-03-05', 'retiro', 5830.21, 5434.45, 'Retiro'),
((SELECT id FROM usuarios WHERE email='yi@digsa.es'), NULL, '2025-04-03', 'retiro', 1000, 909.09, 'Retiro');

-- FS
INSERT INTO aportes (usuario_id, propiedad_id, fecha, tipo, monto_usd, monto_eur, descripcion) VALUES
((SELECT id FROM usuarios WHERE email='fs@digsa.es'), NULL, '2025-11-27', 'aporte', 100000, 84972.97, 'Lagasca 58 / Ayala 78');

-- SB
INSERT INTO aportes (usuario_id, propiedad_id, fecha, tipo, monto_usd, monto_eur, descripcion) VALUES
((SELECT id FROM usuarios WHERE email='sb@digsa.es'), NULL, '2021-05-31', 'aporte', 123964, 100000, 'Rafael de Riego 23 / Costa Rica 24 / Diego de Leon 24'),
((SELECT id FROM usuarios WHERE email='sb@digsa.es'), NULL, '2021-11-30', 'aporte', 118065, 99543.57, 'R. Dominicana 4 / Dr. Esquerdo 19 / Ayala 128'),
((SELECT id FROM usuarios WHERE email='sb@digsa.es'), NULL, '2022-06-30', 'retiro', NULL, 86508.93, 'Retiro - Costa Rica 24 / Diego de Leon 24'),
((SELECT id FROM usuarios WHERE email='sb@digsa.es'), NULL, '2023-01-31', 'retiro', NULL, 16418.24, 'Retiro - Rafael de Riego 23 Piso'),
((SELECT id FROM usuarios WHERE email='sb@digsa.es'), NULL, '2024-09-30', 'retiro', NULL, 7428.65, 'Retiro - Rafael de Riego 23 Local'),
((SELECT id FROM usuarios WHERE email='sb@digsa.es'), NULL, '2024-12-01', 'aporte', 150000, 137418.58, 'JFS 15 / Ayala 154');

-- DE
INSERT INTO aportes (usuario_id, propiedad_id, fecha, tipo, monto_usd, monto_eur, descripcion) VALUES
((SELECT id FROM usuarios WHERE email='de@digsa.es'), NULL, '2021-07-31', 'aporte', 55000, 52972.94, 'Bailen 33 / Montesa 16'),
((SELECT id FROM usuarios WHERE email='de@digsa.es'), NULL, '2025-08-26', 'retiro', 16053.91, 13721.29, 'Retiro');

-- RG
INSERT INTO aportes (usuario_id, propiedad_id, fecha, tipo, monto_usd, monto_eur, descripcion) VALUES
((SELECT id FROM usuarios WHERE email='rg@digsa.es'), NULL, '2020-05-31', 'aporte', 340000, 302032, 'Gral. Pardiñas 114'),
((SELECT id FROM usuarios WHERE email='rg@digsa.es'), NULL, '2021-05-31', 'aporte', 37001, 29518, 'Gral. Pardiñas 114'),
((SELECT id FROM usuarios WHERE email='rg@digsa.es'), NULL, '2022-01-31', 'retiro', 48229.26, 41518.47, 'Utilidad Gral. Pardiñas 114'),
((SELECT id FROM usuarios WHERE email='rg@digsa.es'), NULL, '2022-06-30', 'retiro', 3658.29, 3396.74, 'Utilidad R. Dominicana 4');

-- LS
INSERT INTO aportes (usuario_id, propiedad_id, fecha, tipo, monto_usd, monto_eur, descripcion) VALUES
((SELECT id FROM usuarios WHERE email='ls@digsa.es'), NULL, '2024-11-25', 'aporte', NULL, 4000, 'JFS 15 / Ayala 154'),
((SELECT id FROM usuarios WHERE email='ls@digsa.es'), NULL, '2025-03-20', 'aporte', NULL, 4500, 'Hermosilla 131'),
((SELECT id FROM usuarios WHERE email='ls@digsa.es'), NULL, '2025-06-18', 'aporte', NULL, 5500, 'Don Ramon de la Cruz 98'),
((SELECT id FROM usuarios WHERE email='ls@digsa.es'), NULL, '2025-11-05', 'aporte', NULL, 5700, 'Lagasca 58 / Ayala 78'),
((SELECT id FROM usuarios WHERE email='ls@digsa.es'), NULL, '2026-01-21', 'aporte', NULL, 3111, 'Lagasca 58');

-- PS
INSERT INTO aportes (usuario_id, propiedad_id, fecha, tipo, monto_usd, monto_eur, descripcion) VALUES
((SELECT id FROM usuarios WHERE email='ps@digsa.es'), NULL, '2021-11-30', 'aporte', 21802, 19362.34, 'R. Dominicana 4 / Dr. Esquerdo 19 / Ayala 128'),
((SELECT id FROM usuarios WHERE email='ps@digsa.es'), NULL, '2021-11-30', 'aporte', 1795.97, 1595, 'R. Dominicana 4 / Dr. Esquerdo 19 / Ayala 128'),
((SELECT id FROM usuarios WHERE email='ps@digsa.es'), NULL, '2022-12-30', 'aporte', 5900, 5363.64, 'Calle Madera 31'),
((SELECT id FROM usuarios WHERE email='ps@digsa.es'), NULL, '2022-12-30', 'aporte', 5900, 5363.64, 'Alcala 146 / DRC 48 / Ayala 134'),
((SELECT id FROM usuarios WHERE email='ps@digsa.es'), NULL, '2024-10-21', 'retiro', 3217.80, 3000, 'Retiro'),
((SELECT id FROM usuarios WHERE email='ps@digsa.es'), NULL, '2025-03-05', 'retiro', 39403.46, 36736.40, 'Retiro');


-- ============================================================
-- 5. PARTICIPACIONES en propiedades activas
--    (aporte real de cada inversor en cada piso activo)
-- ============================================================

-- CS — Lagasca 58 (€2.542,10) · Lagasca 80 (€3.938,61)
INSERT INTO participaciones (usuario_id, propiedad_id, porcentaje, monto_invertido) VALUES
((SELECT id FROM usuarios WHERE email='cs@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Lagasca 58'),    0.001443, 2542.10),
((SELECT id FROM usuarios WHERE email='cs@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Lagasca 80'),    0.001944, 3938.61);

-- SL — Hermosilla 131 (€98.594,05) · Lagasca 58 (€438.576,35) · Lagasca 80 (€442.958,92)
INSERT INTO participaciones (usuario_id, propiedad_id, porcentaje, monto_invertido) VALUES
((SELECT id FROM usuarios WHERE email='sl@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Hermosilla 131'), 0.123273, 98594.05),
((SELECT id FROM usuarios WHERE email='sl@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Lagasca 58'),    0.249167, 438576.35),
((SELECT id FROM usuarios WHERE email='sl@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Lagasca 80'),    0.218744, 442958.92);

-- LG — Hermosilla 131 (€51.652,50) · Lagasca 58 (€34.656,28) · Lagasca 80 (€124.132,85)
INSERT INTO participaciones (usuario_id, propiedad_id, porcentaje, monto_invertido) VALUES
((SELECT id FROM usuarios WHERE email='lg@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Hermosilla 131'), 0.064583, 51652.50),
((SELECT id FROM usuarios WHERE email='lg@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Lagasca 58'),    0.019690, 34656.28),
((SELECT id FROM usuarios WHERE email='lg@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Lagasca 80'),    0.061327, 124132.85);

-- SN — Hermosilla 131 (€39.803,90) · Lagasca 58 (€57.448,31) · Lagasca 80 (€123.997,83)
INSERT INTO participaciones (usuario_id, propiedad_id, porcentaje, monto_invertido) VALUES
((SELECT id FROM usuarios WHERE email='sn@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Hermosilla 131'), 0.049768, 39803.90),
((SELECT id FROM usuarios WHERE email='sn@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Lagasca 58'),    0.032638, 57448.31),
((SELECT id FROM usuarios WHERE email='sn@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Lagasca 80'),    0.061260, 123997.83);

-- YI — Hermosilla 131 (€5.289,01) · Lagasca 58 (€5.621,28) · Lagasca 80 (€9.798,93)
INSERT INTO participaciones (usuario_id, propiedad_id, porcentaje, monto_invertido) VALUES
((SELECT id FROM usuarios WHERE email='yi@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Hermosilla 131'), 0.006613, 5289.01),
((SELECT id FROM usuarios WHERE email='yi@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Lagasca 58'),    0.003194, 5621.28),
((SELECT id FROM usuarios WHERE email='yi@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Lagasca 80'),    0.004839, 9798.93);

-- FS — Lagasca 58 (€66.043,66) · Lagasca 80 (€19.735,54)
INSERT INTO participaciones (usuario_id, propiedad_id, porcentaje, monto_invertido) VALUES
((SELECT id FROM usuarios WHERE email='fs@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Lagasca 58'),    0.037522, 66043.66),
((SELECT id FROM usuarios WHERE email='fs@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Lagasca 80'),    0.009741, 19735.54);

-- SB — Hermosilla 131 (€38.196,74) · Lagasca 58 (€100.916,52) · Lagasca 80 (€146.435,15)
INSERT INTO participaciones (usuario_id, propiedad_id, porcentaje, monto_invertido) VALUES
((SELECT id FROM usuarios WHERE email='sb@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Hermosilla 131'), 0.047758, 38196.74),
((SELECT id FROM usuarios WHERE email='sb@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Lagasca 58'),    0.057337, 100916.52),
((SELECT id FROM usuarios WHERE email='sb@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Lagasca 80'),    0.072295, 146435.15);

-- DE — Hermosilla 131 (€26.876,62) · Lagasca 80 (€29.751,00)
INSERT INTO participaciones (usuario_id, propiedad_id, porcentaje, monto_invertido) VALUES
((SELECT id FROM usuarios WHERE email='de@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Hermosilla 131'), 0.033604, 26876.62),
((SELECT id FROM usuarios WHERE email='de@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Lagasca 80'),    0.014686, 29751.00);

-- RG — Hermosilla 131 (€147.227,70) · Lagasca 58 (€89.323,81) · Lagasca 80 (€221.274,32)
INSERT INTO participaciones (usuario_id, propiedad_id, porcentaje, monto_invertido) VALUES
((SELECT id FROM usuarios WHERE email='rg@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Hermosilla 131'), 0.184082, 147227.70),
((SELECT id FROM usuarios WHERE email='rg@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Lagasca 58'),    0.050749, 89323.81),
((SELECT id FROM usuarios WHERE email='rg@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Lagasca 80'),    0.109257, 221274.32);

-- LS — Hermosilla 131 (€4.500) · Lagasca 58 (€9.235,74) · Lagasca 80 (€9.958,74)
INSERT INTO participaciones (usuario_id, propiedad_id, porcentaje, monto_invertido) VALUES
((SELECT id FROM usuarios WHERE email='ls@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Hermosilla 131'), 0.005626, 4500.00),
((SELECT id FROM usuarios WHERE email='ls@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Lagasca 58'),    0.005247, 9235.74),
((SELECT id FROM usuarios WHERE email='ls@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Lagasca 80'),    0.004915, 9958.74);

-- PS — sin propiedades activas (retiro total)


-- ============================================================
-- 6. LIQUIDACIONES (inversiones finalizadas de cada inversor)
-- ============================================================

-- CS
INSERT INTO liquidaciones (usuario_id, propiedad_id, fecha, aporte_usuario, total_retorno, pdf_url) VALUES
((SELECT id FROM usuarios WHERE email='cs@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Jardin de San Federico 15'), '2024-10-01', 3000.00,    3270.84,  NULL),
((SELECT id FROM usuarios WHERE email='cs@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Ayala 154'),                 '2024-10-01', 3000.00,    3178.83,  NULL),
((SELECT id FROM usuarios WHERE email='cs@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Ayala 78'),                  '2025-03-01',  728.74,     759.78,  NULL);

-- SL
INSERT INTO liquidaciones (usuario_id, propiedad_id, fecha, aporte_usuario, total_retorno, pdf_url) VALUES
((SELECT id FROM usuarios WHERE email='sl@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Don Ramon de la Cruz 48'),   '2023-06-01', 25249.04,  26807.34, NULL),
((SELECT id FROM usuarios WHERE email='sl@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Villa 4 2 Dcha'),            '2024-06-01', 92412.00, 104097.27, NULL),
((SELECT id FROM usuarios WHERE email='sl@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Alcala 146'),                '2023-12-01', 27052.62,  33918.58, NULL),
((SELECT id FROM usuarios WHERE email='sl@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Madera 31'),                 '2024-03-01', 38978.99,  48430.39, NULL),
((SELECT id FROM usuarios WHERE email='sl@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Ayala 134'),                 '2024-09-01',155702.85, 174235.88, NULL),
((SELECT id FROM usuarios WHERE email='sl@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Jardin de San Federico 15'), '2024-10-01',291751.76, 318090.99, NULL),
((SELECT id FROM usuarios WHERE email='sl@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Don Ramon de la Cruz 98'),   '2025-03-01', 90234.34,  98583.75, NULL),
((SELECT id FROM usuarios WHERE email='sl@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Ayala 154'),                 '2024-10-01',201295.98, 213295.08, NULL),
((SELECT id FROM usuarios WHERE email='sl@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Ayala 78'),                  '2025-03-01',125725.22, 131080.08, NULL);

-- LG
INSERT INTO liquidaciones (usuario_id, propiedad_id, fecha, aporte_usuario, total_retorno, pdf_url) VALUES
((SELECT id FROM usuarios WHERE email='lg@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Montesa 16 5C'),             '2022-07-01', 61193.86,  70819.60, NULL),
((SELECT id FROM usuarios WHERE email='lg@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Don Ramon de la Cruz 48'),   '2023-06-01', 10089.91,  10619.22, NULL),
((SELECT id FROM usuarios WHERE email='lg@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Alcala 146'),                '2023-12-01',  8894.85,  11152.36, NULL),
((SELECT id FROM usuarios WHERE email='lg@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Bailen 33'),                 '2024-06-01', 40085.27,  46330.27, NULL),
((SELECT id FROM usuarios WHERE email='lg@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Ayala 134'),                 '2024-09-01', 62454.06,  69887.85, NULL),
((SELECT id FROM usuarios WHERE email='lg@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Jardin de San Federico 15'), '2024-10-01',  6599.20,   7194.97, NULL),
((SELECT id FROM usuarios WHERE email='lg@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Don Ramon de la Cruz 98'),   '2025-03-01', 99722.94, 108950.34, NULL),
((SELECT id FROM usuarios WHERE email='lg@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Ayala 154'),                 '2024-10-01',  4553.16,   4824.57, NULL),
((SELECT id FROM usuarios WHERE email='lg@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Ayala 78'),                  '2025-03-01',  9934.80,  10357.94, NULL);

-- SN
INSERT INTO liquidaciones (usuario_id, propiedad_id, fecha, aporte_usuario, total_retorno, pdf_url) VALUES
((SELECT id FROM usuarios WHERE email='sn@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Diego de Leon 24'),         '2022-06-01', 25237.75,  27622.00, NULL),
((SELECT id FROM usuarios WHERE email='sn@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Costa Rica 28 2E'),         '2022-06-01', 14200.60,  15268.73, NULL),
((SELECT id FROM usuarios WHERE email='sn@digsa.es'), (SELECT id FROM propiedades WHERE nombre='R. Dominicana 4 5B'),       '2022-12-01',  7571.13,   8076.19, NULL),
((SELECT id FROM usuarios WHERE email='sn@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Dr. Esquerdo 19 4 Dcha'),   '2023-06-01',  7117.46,   7874.24, NULL),
((SELECT id FROM usuarios WHERE email='sn@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Rafael de Riego 23 Piso'),  '2023-01-01',  6997.10,   8209.12, NULL),
((SELECT id FROM usuarios WHERE email='sn@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Montesa 16 5C'),            '2022-07-01', 31183.04,  36088.10, NULL),
((SELECT id FROM usuarios WHERE email='sn@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Ayala 128 3'),              '2023-12-01', 15311.41,  16829.42, NULL),
((SELECT id FROM usuarios WHERE email='sn@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Don Ramon de la Cruz 48'),  '2023-06-01',  8301.84,   8814.20, NULL),
((SELECT id FROM usuarios WHERE email='sn@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Villa 4 2 Dcha'),           '2024-06-01', 57721.49,  65020.23, NULL),
((SELECT id FROM usuarios WHERE email='sn@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Alcala 146'),               '2023-12-01',  8894.85,  11152.36, NULL),
((SELECT id FROM usuarios WHERE email='sn@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Bailen 33'),                '2024-06-01', 20426.57,  23608.88, NULL),
((SELECT id FROM usuarios WHERE email='sn@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Madera 31'),                '2024-03-01',  4185.51,   5200.39, NULL),
((SELECT id FROM usuarios WHERE email='sn@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Rafael de Riego 23 Local'), '2024-09-01',  3385.15,   4355.17, NULL),
((SELECT id FROM usuarios WHERE email='sn@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Ayala 134'),                '2024-09-01', 50916.81,  56977.35, NULL),
((SELECT id FROM usuarios WHERE email='sn@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Jardin de San Federico 15'),'2024-10-01', 44379.06,  48385.58, NULL),
((SELECT id FROM usuarios WHERE email='sn@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Don Ramon de la Cruz 98'),  '2025-03-01', 68083.29,  74383.06, NULL),
((SELECT id FROM usuarios WHERE email='sn@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Ayala 154'),                '2024-10-01', 30619.62,  32444.83, NULL),
((SELECT id FROM usuarios WHERE email='sn@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Ayala 78'),                 '2025-03-01', 16468.51,  17169.93, NULL);

-- YI
INSERT INTO liquidaciones (usuario_id, propiedad_id, fecha, aporte_usuario, total_retorno, pdf_url) VALUES
((SELECT id FROM usuarios WHERE email='yi@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Montesa 16 5C'),            '2022-07-01',  8225.20,   9519.02, NULL),
((SELECT id FROM usuarios WHERE email='yi@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Don Ramon de la Cruz 48'),  '2023-06-01',  1566.13,   1662.79, NULL),
((SELECT id FROM usuarios WHERE email='yi@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Alcala 146'),               '2023-12-01',  1678.00,   2103.88, NULL),
((SELECT id FROM usuarios WHERE email='yi@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Bailen 33'),                '2024-06-01',  5387.95,   6227.35, NULL),
((SELECT id FROM usuarios WHERE email='yi@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Ayala 134'),                '2024-09-01',  9605.99,  10749.38, NULL),
((SELECT id FROM usuarios WHERE email='yi@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Jardin de San Federico 15'),'2024-10-01',  5297.00,   5775.21, NULL),
((SELECT id FROM usuarios WHERE email='yi@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Don Ramon de la Cruz 98'),  '2025-03-01',  3886.67,   4246.30, NULL),
((SELECT id FROM usuarios WHERE email='yi@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Ayala 154'),                '2024-10-01',  3654.70,   3872.55, NULL),
((SELECT id FROM usuarios WHERE email='yi@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Ayala 78'),                 '2025-03-01',  1611.44,   1680.07, NULL);

-- FS
INSERT INTO liquidaciones (usuario_id, propiedad_id, fecha, aporte_usuario, total_retorno, pdf_url) VALUES
((SELECT id FROM usuarios WHERE email='fs@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Ayala 78'),                 '2025-03-01', 18929.31,  19735.54, NULL);

-- SB
INSERT INTO liquidaciones (usuario_id, propiedad_id, fecha, aporte_usuario, total_retorno, pdf_url) VALUES
((SELECT id FROM usuarios WHERE email='sb@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Diego de Leon 24'),         '2022-06-01', 50475.49,  55244.00, NULL),
((SELECT id FROM usuarios WHERE email='sb@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Costa Rica 28 2E'),         '2022-06-01', 28401.19,  30537.45, NULL),
((SELECT id FROM usuarios WHERE email='sb@digsa.es'), (SELECT id FROM propiedades WHERE nombre='R. Dominicana 4 5B'),       '2022-12-01', 25121.92,  26797.74, NULL),
((SELECT id FROM usuarios WHERE email='sb@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Dr. Esquerdo 19 4 Dcha'),   '2023-06-01', 23616.57,  26127.67, NULL),
((SELECT id FROM usuarios WHERE email='sb@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Rafael de Riego 23 Piso'),  '2023-01-01', 13994.20,  16418.24, NULL),
((SELECT id FROM usuarios WHERE email='sb@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Montesa 16 5C'),            '2022-07-01', 16750.73,  19385.60, NULL),
((SELECT id FROM usuarios WHERE email='sb@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Ayala 128 3'),              '2023-12-01', 50805.08,  55842.02, NULL),
((SELECT id FROM usuarios WHERE email='sb@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Don Ramon de la Cruz 48'),  '2023-06-01', 10674.28,  11333.07, NULL),
((SELECT id FROM usuarios WHERE email='sb@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Villa 4 2 Dcha'),           '2024-06-01', 26563.16,  29922.01, NULL),
((SELECT id FROM usuarios WHERE email='sb@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Alcala 146'),               '2023-12-01', 11436.76,  14339.41, NULL),
((SELECT id FROM usuarios WHERE email='sb@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Rafael de Riego 23 Local'), '2024-09-01',  6512.03,   7428.65, NULL),
((SELECT id FROM usuarios WHERE email='sb@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Bailen 33'),                '2024-06-01', 10972.62,  12682.08, NULL),
((SELECT id FROM usuarios WHERE email='sb@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Ayala 134'),                '2024-09-01', 65468.04,  73260.58, NULL),
((SELECT id FROM usuarios WHERE email='sb@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Jardin de San Federico 15'),'2024-10-01',107150.78, 116824.31, NULL),
((SELECT id FROM usuarios WHERE email='sb@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Don Ramon de la Cruz 98'),  '2025-03-01', 34724.31,  37937.36, NULL),
((SELECT id FROM usuarios WHERE email='sb@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Ayala 154'),                '2024-10-01', 73929.36,  78336.23, NULL),
((SELECT id FROM usuarios WHERE email='sb@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Ayala 78'),                 '2025-03-01', 28929.40,  30161.56, NULL);

-- DE
INSERT INTO liquidaciones (usuario_id, propiedad_id, fecha, aporte_usuario, total_retorno, pdf_url) VALUES
((SELECT id FROM usuarios WHERE email='de@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Montesa 16 5C'),            '2022-07-01', 32006.78,  37041.41, NULL),
((SELECT id FROM usuarios WHERE email='de@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Don Ramon de la Cruz 48'),  '2023-06-01',  5260.11,   5584.75, NULL),
((SELECT id FROM usuarios WHERE email='de@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Alcala 146'),               '2023-12-01',  5635.85,   7066.23, NULL),
((SELECT id FROM usuarios WHERE email='de@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Bailen 33'),                '2024-06-01', 20966.16,  24232.54, NULL),
((SELECT id FROM usuarios WHERE email='de@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Ayala 134'),                '2024-09-01', 32385.12,  36239.86, NULL),
((SELECT id FROM usuarios WHERE email='de@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Jardin de San Federico 15'),'2024-10-01',  4181.31,   4558.80, NULL),
((SELECT id FROM usuarios WHERE email='de@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Don Ramon de la Cruz 98'),  '2025-03-01', 24433.29,  26694.11, NULL),
((SELECT id FROM usuarios WHERE email='de@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Ayala 154'),                '2024-10-01',  2884.92,   3056.89, NULL);

-- RG
INSERT INTO liquidaciones (usuario_id, propiedad_id, fecha, aporte_usuario, total_retorno, pdf_url) VALUES
((SELECT id FROM usuarios WHERE email='rg@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Gral. Pardinas 114 7'),     '2022-01-01',331550.00, 373068.47, NULL),
((SELECT id FROM usuarios WHERE email='rg@digsa.es'), (SELECT id FROM propiedades WHERE nombre='R. Dominicana 4 5B'),       '2022-12-01', 43281.88,  46678.62, NULL),
((SELECT id FROM usuarios WHERE email='rg@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Dr. Esquerdo 19 4 Dcha'),   '2023-06-01', 39329.88,  44249.73, NULL),
((SELECT id FROM usuarios WHERE email='rg@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Montesa 16 5C'),            '2022-07-01',126314.26, 149689.68, NULL),
((SELECT id FROM usuarios WHERE email='rg@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Ayala 128 3'),              '2023-12-01', 83163.24,  92863.24, NULL),
((SELECT id FROM usuarios WHERE email='rg@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Don Ramon de la Cruz 48'),  '2023-06-01', 34327.62,  36446.23, NULL),
((SELECT id FROM usuarios WHERE email='rg@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Villa 4 2 Dcha'),           '2024-06-01', 44658.23,  50305.15, NULL),
((SELECT id FROM usuarios WHERE email='rg@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Alcala 146'),               '2023-12-01', 36779.70,  47761.69, NULL),
((SELECT id FROM usuarios WHERE email='rg@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Bailen 33'),                '2024-06-01', 82742.62,  95633.34, NULL),
((SELECT id FROM usuarios WHERE email='rg@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Ayala 134'),                '2024-09-01',210565.73, 240051.92, NULL),
((SELECT id FROM usuarios WHERE email='rg@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Jardin de San Federico 15'),'2024-10-01', 57432.47,  63532.45, NULL),
((SELECT id FROM usuarios WHERE email='rg@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Don Ramon de la Cruz 98'),  '2025-03-01',137060.04, 151980.29, NULL),
((SELECT id FROM usuarios WHERE email='rg@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Ayala 154'),                '2024-10-01', 39625.89,  42404.79, NULL),
((SELECT id FROM usuarios WHERE email='rg@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Ayala 78'),                 '2025-03-01', 25606.16,  26889.23, NULL);

-- LS
INSERT INTO liquidaciones (usuario_id, propiedad_id, fecha, aporte_usuario, total_retorno, pdf_url) VALUES
((SELECT id FROM usuarios WHERE email='ls@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Jardin de San Federico 15'),'2024-10-01',  2000.00,   2180.56, NULL),
((SELECT id FROM usuarios WHERE email='ls@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Don Ramon de la Cruz 98'),  '2025-03-01',  5500.00,   6008.92, NULL),
((SELECT id FROM usuarios WHERE email='ls@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Ayala 154'),                '2024-10-01',  2000.00,   2119.22, NULL),
((SELECT id FROM usuarios WHERE email='ls@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Ayala 78'),                 '2025-03-01',  1755.82,   1830.60, NULL);

-- PS
INSERT INTO liquidaciones (usuario_id, propiedad_id, fecha, aporte_usuario, total_retorno, pdf_url) VALUES
((SELECT id FROM usuarios WHERE email='ps@digsa.es'), (SELECT id FROM propiedades WHERE nombre='R. Dominicana 4 5B'),       '2022-12-01',  5289.00,   5641.82, NULL),
((SELECT id FROM usuarios WHERE email='ps@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Dr. Esquerdo 19 4 Dcha'),   '2023-06-01',  4972.08,   5500.75, NULL),
((SELECT id FROM usuarios WHERE email='ps@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Montesa 16 5C'),            '2022-07-01',  3440.31,   3981.47, NULL),
((SELECT id FROM usuarios WHERE email='ps@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Ayala 128 3'),              '2023-12-01', 10696.17,  11756.61, NULL),
((SELECT id FROM usuarios WHERE email='ps@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Don Ramon de la Cruz 48'),  '2023-06-01',  2964.07,   3147.01, NULL),
((SELECT id FROM usuarios WHERE email='ps@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Villa 4 2 Dcha'),           '2024-06-01',  5551.53,   6253.51, NULL),
((SELECT id FROM usuarios WHERE email='ps@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Alcala 146'),               '2023-12-01',  3175.80,   3981.82, NULL),
((SELECT id FROM usuarios WHERE email='ps@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Bailen 33'),                '2024-06-01',  2253.59,   2604.68, NULL),
((SELECT id FROM usuarios WHERE email='ps@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Madera 31'),                '2024-03-01',  5363.64,   6664.18, NULL),
((SELECT id FROM usuarios WHERE email='ps@digsa.es'), (SELECT id FROM propiedades WHERE nombre='Ayala 134'),                '2024-09-01', 18179.42,  20343.29, NULL);

