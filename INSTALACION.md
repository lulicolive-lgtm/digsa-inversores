# DIGSA · Portal de Inversores
## Guía de instalación completa — paso a paso

---

## QUÉ VAS A TENER AL FINAL

- Una web en internet con tu dominio (ej: `inversores.digsa.es`)
- Base de datos real donde podés ver y editar todo desde un panel visual
- Portal para inversores: cada uno entra con su mail y ve solo sus datos
- Panel de admin: vos y tu jefe pueden cargar pisos, inversores, aportes y generar PDFs automáticamente
- Costo: **GRATIS** (hasta escalar mucho)

---

## PASO 1 — Crear la base de datos en Supabase (15 minutos)

Supabase es como tener una base de datos con un Excel visual encima. Tu jefe va a poder ver y editar datos desde ahí también.

### 1.1 Crear cuenta
1. Ir a **https://supabase.com**
2. Clic en **Start your project** → Registrarse con Google o email
3. Clic en **New project**
4. Completar:
   - **Name:** `digsa-inversores`
   - **Database Password:** elegí una contraseña segura y **GUARDALA** (la vas a necesitar)
   - **Region:** `West EU (Ireland)` — el más cercano a Madrid
5. Clic en **Create new project** — tarda ~2 minutos

### 1.2 Crear las tablas
1. En el menú izquierdo ir a **SQL Editor**
2. Clic en **New query**
3. Copiar TODO el contenido del archivo `backend/schema.sql`
4. Pegarlo en el editor
5. Clic en **Run** (o Ctrl+Enter)
6. Deberías ver: `Success. No rows returned`

### 1.3 Crear el bucket de archivos (para PDFs)
1. En el menú izquierdo ir a **Storage**
2. Clic en **New bucket**
3. Name: `documentos`
4. Marcar **Public bucket** ✓
5. Clic en **Save**

### 1.4 Obtener las claves de la API
1. Ir a **Settings** (ícono de engranaje, abajo a la izquierda)
2. Ir a **API**
3. Copiar y guardar en un archivo de texto:
   - **Project URL** → esto va en `SUPABASE_URL`
   - **service_role** key (la segunda, más larga) → esto va en `SUPABASE_SERVICE_KEY`
   
   ⚠️ NO uses la `anon` key, usá la `service_role`

---

## PASO 2 — Subir el código a GitHub (10 minutos)

Railway necesita que el código esté en GitHub para desplegarlo.

### 2.1 Crear cuenta en GitHub
- Ir a **https://github.com** → Sign up (si no tenés cuenta)

### 2.2 Crear repositorio
1. Clic en **+** arriba a la derecha → **New repository**
2. Name: `digsa-inversores`
3. Visibility: **Private** ✓ (para que nadie más lo vea)
4. Clic en **Create repository**

### 2.3 Subir el código
En tu computadora, abrí una terminal (en Windows: buscar "PowerShell" o "cmd"):

```bash
# Instalar Git si no lo tenés: https://git-scm.com/downloads

# Ir a la carpeta del proyecto
cd ruta/a/digsa

# Inicializar y subir
git init
git add .
git commit -m "Portal DIGSA inversores - versión inicial"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/digsa-inversores.git
git push -u origin main
```

Reemplazá `TU_USUARIO` con tu nombre de usuario de GitHub.

---

## PASO 3 — Deployar en Railway (10 minutos)

Railway es el hosting. Se conecta a GitHub y cada vez que actualizás el código, se actualiza automáticamente la web.

### 3.1 Crear cuenta
1. Ir a **https://railway.app**
2. Clic en **Login with GitHub** — usar la misma cuenta de GitHub

### 3.2 Crear proyecto
1. Clic en **New Project**
2. Seleccionar **Deploy from GitHub repo**
3. Buscar y seleccionar `digsa-inversores`
4. Railway va a detectar automáticamente que es Node.js

### 3.3 Configurar las variables de entorno
Antes de que funcione, tenés que darle las claves de Supabase:

1. Clic en tu proyecto en Railway
2. Clic en el servicio (el cuadrado que aparece)
3. Ir a la pestaña **Variables**
4. Clic en **New Variable** y agregar una por una:

```
SUPABASE_URL          = https://xxxxxxxx.supabase.co   (la que copiaste antes)
SUPABASE_SERVICE_KEY  = eyJhbGci...                    (la service_role key)
JWT_SECRET            = (generá una cadena larga random, ej: MiClaveSecreta2024DigsaInversoresPortal!)
NODE_ENV              = production
FRONTEND_URL          = *
PORT                  = 3001
```

5. Clic en **Deploy** — Railway va a construir y deployar (~3 minutos)

### 3.4 Obtener la URL de tu app
1. Una vez deployado, ir a la pestaña **Settings** del servicio
2. En **Networking** → **Public Networking** → clic en **Generate Domain**
3. Te da algo como: `digsa-inversores-production.up.railway.app`
4. Entrá a esa URL — deberías ver el portal de DIGSA

---

## PASO 4 — Primer login y configurar admin (5 minutos)

### 4.1 Cambiar la contraseña del admin
El admin por defecto es:
- **Email:** `admin@digsa.es`  
- **Contraseña:** `Admin1234!`

**⚠️ Cambiarla inmediatamente:**
1. Entrar con esas credenciales
2. La funcionalidad de cambio de contraseña está en el menú de usuario

O cambiarla directo en Supabase:
1. Ir a **Supabase → Table Editor → usuarios**
2. Ver la fila del admin
3. Para generar un hash nuevo: ir a **SQL Editor** y ejecutar:
```sql
-- Para cambiar la contraseña del admin a "TuNuevaContraseña":
UPDATE usuarios 
SET password_hash = crypt('TuNuevaContraseña', gen_salt('bf'))
WHERE email = 'admin@digsa.es';
```

### 4.2 Crear el usuario de tu jefe
1. Entrar al portal como admin
2. Ir al panel **Admin** (solo visible para admins)
3. Tab **Inversores** → **+ Nuevo inversor**
4. Completar los datos y asignarle el rol admin desde Supabase:
```sql
UPDATE usuarios SET rol = 'admin' WHERE email = 'jefe@digsa.es';
```

---

## PASO 5 — Conectar dominio propio (opcional, 15 minutos)

Si tienen el dominio `digsa.es` y quieren que el portal sea `inversores.digsa.es`:

### En Railway:
1. Ir a tu servicio → **Settings** → **Networking**
2. Clic en **+ Custom Domain**
3. Escribir: `inversores.digsa.es`
4. Railway te va a dar un valor CNAME (algo como `xxxxxxx.railway.app`)

### En tu proveedor de dominio (donde compraron digsa.es):
1. Entrar al panel de DNS
2. Agregar un registro:
   - **Tipo:** CNAME
   - **Nombre/Host:** `inversores`
   - **Valor:** el CNAME que te dio Railway
   - **TTL:** 3600
3. Guardar — tarda entre 5 minutos y 1 hora en propagarse

---

## CÓMO USAR EL PANEL DE ADMIN

### Agregar un inversor nuevo:
Admin → Inversores → **+ Nuevo inversor** → completar nombre, email, contraseña → Guardar

### Agregar un piso nuevo:
Admin → Propiedades → **+ Nueva propiedad** → completar datos → agregar los inversores con sus porcentajes → Guardar

### Registrar un aporte:
Admin → Aportes → **+ Registrar aporte** → seleccionar inversor, monto, fecha → Registrar

### Liquidar un piso (generar PDFs automáticos):
Admin → **Liquidar piso** → seleccionar el piso → cargar precio de venta final → **Generar liquidaciones**

El sistema va a:
1. Calcular la ganancia proporcional de cada inversor
2. Generar un PDF individual para cada uno
3. Subirlo al portal de cada inversor
4. Enviar notificación a cada uno

---

## PANEL VISUAL DE SUPABASE (para tu jefe)

Tu jefe puede entrar directamente a **https://supabase.com** → su proyecto → **Table Editor** y ver todas las tablas como si fuera un Excel:
- `usuarios` — todos los inversores
- `propiedades` — todos los pisos
- `aportes` — historial de transferencias
- `participaciones` — quién tiene qué % en cada piso
- `liquidaciones` — liquidaciones generadas

Puede editar celdas directamente, filtrar, ordenar, exportar a CSV, etc.

---

## ACTUALIZAR EL CÓDIGO EN EL FUTURO

Cada vez que hagamos cambios al código, solo hay que:

```bash
git add .
git commit -m "descripción del cambio"
git push
```

Railway lo detecta automáticamente y redeploya en ~2 minutos. Sin tocar nada más.

---

## COSTOS

| Servicio | Plan gratuito incluye | Cuándo pagar |
|----------|----------------------|--------------|
| Supabase | 500MB DB, 1GB storage, 50k usuarios | Si superan 500MB de datos |
| Railway  | $5 crédito/mes gratis | Si la app usa más de $5/mes de recursos |
| GitHub   | Repositorios privados ilimitados | Nunca (gratis) |

Con 10-15 inversores y algunos cientos de documentos, **se mantiene en el plan gratuito** fácilmente.

---

## SOPORTE

Si algo no funciona en la instalación, los errores más comunes son:

1. **"Invalid API key"** → revisá que estés usando la `service_role` key de Supabase, no la `anon`
2. **"Cannot find module"** → falta correr `cd backend && npm install`
3. **La web carga pero no deja logear** → verificá que el SQL del schema.sql se ejecutó correctamente en Supabase
4. **PDFs no se generan** → verificar que el bucket `documentos` en Supabase Storage esté creado y sea público

---

*Guía generada para DIGSA Portal de Inversores · Abril 2025*
