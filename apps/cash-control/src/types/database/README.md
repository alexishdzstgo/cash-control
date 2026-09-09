# Tipos de PostgreSQL

No hay tipos de tablas escritos a mano en Fase 1. Después de aplicar la migración
con Supabase CLI local, desde apps/cash-control:

```sh
supabase gen types typescript --local --schema public > src/types/database/database.types.ts
```

Alternativa futura: `--project-id <project-ref>` para el proyecto conectado.
Antes de conectar consultas en Fase 2, generar y versionar el archivo e importar
`Database` en los tres factories: `createBrowserClient<Database>`,
`createServerClient<Database>` y `createClient<Database>` (Admin).
No generar/exportar los tipos de `private` para uso del navegador.
