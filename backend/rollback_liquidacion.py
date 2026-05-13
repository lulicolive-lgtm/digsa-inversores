"""
DIGSA — Rollback de liquidación
Uso: python3 rollback_liquidacion.py "Nombre del piso"
"""
import sys
from supabase import create_client

sb = create_client(
    'https://fsnrldagabycplhyujve.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzbnJsZGFnYWJ5Y3BsaHl1anZlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjYwNjgxOSwiZXhwIjoyMDkyMTgyODE5fQ.jgfBPm5wHK1xRxiE5UFmT8zhJfFzyeR5GKG4Xgtmxg0'
)

if len(sys.argv) < 2:
    print("Uso: python3 rollback_liquidacion.py 'Nombre del piso'")
    props = sb.table('propiedades').select('nombre,estado').execute().data
    for p in sorted(props, key=lambda x: x['estado']):
        print(f"  {p['estado']:>8} — {p['nombre']}")
    sys.exit(0)

nombre = sys.argv[1]
prop = sb.table('propiedades').select('*').ilike('nombre', f'%{nombre}%').execute().data
if not prop:
    print(f"❌ Piso no encontrado: {nombre}")
    sys.exit(1)

p = prop[0]
pid = p['id']
print(f"\nPiso: {p['nombre']} — estado: {p['estado']}")

liqs = sb.table('liquidaciones').select('id,publicado,usuario_id,usuarios(nombre,apellido)').eq('propiedad_id', pid).execute().data
docs = sb.table('documentos').select('id,nombre').eq('propiedad_id', pid).execute().data
parts = sb.table('participaciones').select('id,activo').eq('propiedad_id', pid).execute().data

# Buscar reportes generados en la misma fecha
from datetime import date
mes_año = date.today().strftime('%-m.%Y')
reportes = sb.table('documentos').select('id,nombre,usuario_id').ilike('nombre', f'%{mes_año}%').eq('tipo', 'reporte').execute().data
# Solo los de inversores que participaron en este piso
user_ids = list(set([l['usuario_id'] for l in liqs]))
reportes_piso = [r for r in reportes if r['usuario_id'] in user_ids]

print(f"\nSe va a revertir:")
print(f"  {len(liqs)} liquidaciones")
print(f"  {len(docs)} documentos de liquidación")
print(f"  {len(reportes_piso)} reportes generados ({mes_año})")
print(f"  {len(parts)} participaciones → se reactivarán")
print(f"  Piso → en_obra")

confirm = input("\nEscribí 'SI' para confirmar: ")
if confirm.strip().upper() != 'SI':
    print("Cancelado.")
    sys.exit(0)

sb.table('propiedades').update({'estado':'en_obra','precio_venta':p.get('precio_compra'),'fecha_venta':None}).eq('id',pid).execute()
print("✅ Piso → en_obra")

sb.table('liquidaciones').delete().eq('propiedad_id', pid).execute()
print(f"✅ {len(liqs)} liquidaciones borradas")

sb.table('participaciones').update({'activo':True}).eq('propiedad_id', pid).execute()
print(f"✅ Participaciones reactivadas")

if docs:
    sb.table('documentos').delete().eq('propiedad_id', pid).execute()
    print(f"✅ {len(docs)} documentos borrados")

if reportes_piso:
    for r in reportes_piso:
        sb.table('documentos').delete().eq('id', r['id']).execute()
    print(f"✅ {len(reportes_piso)} reportes borrados")

print(f"\n✅ ROLLBACK COMPLETO — {p['nombre']} restaurado")
