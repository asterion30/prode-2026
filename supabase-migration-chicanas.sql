-- ============================================================
-- MIGRACIÓN: Carga de Chicanas Optimizadas para Administrador
-- Ejecutar en el SQL Editor de Supabase (una sola vez)
-- ============================================================

-- 1. Crear tabla de chicanas customizadas
CREATE TABLE IF NOT EXISTS public.custom_chicanas (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  path text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.custom_chicanas ENABLE ROW LEVEL SECURITY;

-- Políticas de Seguridad para la tabla custom_chicanas
-- 1.Cualquiera puede leer las chicanas customizadas (Público)
CREATE POLICY "Cualquiera puede leer chicanas custom"
  ON public.custom_chicanas FOR SELECT
  USING (true);

-- 2. Solo el administrador (asterion30@gmail.com) puede insertar nuevas chicanas
CREATE POLICY "Solo admin puede insertar chicanas custom"
  ON public.custom_chicanas FOR INSERT
  WITH CHECK ( auth.jwt() ->> 'email' = 'asterion30@gmail.com' );

-- 3. Solo el administrador (asterion30@gmail.com) puede eliminar chicanas
CREATE POLICY "Solo admin puede eliminar chicanas custom"
  ON public.custom_chicanas FOR DELETE
  USING ( auth.jwt() ->> 'email' = 'asterion30@gmail.com' );

-- 2. Crear bucket 'chicanas' en storage (público, máx 2 MB por archivo, solo imágenes)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chicanas',
  'chicanas',
  true,
  2097152,  -- 2 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 2097152,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- Políticas de Storage para el bucket 'chicanas'
-- 1. Cualquiera puede leer las chicanas (Público)
CREATE POLICY "Chicanas de storage son publicas"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'chicanas');

-- 2. Solo el administrador puede subir imágenes
CREATE POLICY "Solo admin puede subir chicanas"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'chicanas'
    AND auth.jwt() ->> 'email' = 'asterion30@gmail.com'
  );

-- 3. Solo el administrador puede actualizar imágenes
CREATE POLICY "Solo admin puede actualizar chicanas"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'chicanas'
    AND auth.jwt() ->> 'email' = 'asterion30@gmail.com'
  );

-- 4. Solo el administrador puede eliminar imágenes
CREATE POLICY "Solo admin puede eliminar chicanas"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'chicanas'
    AND auth.jwt() ->> 'email' = 'asterion30@gmail.com'
  );

-- Habilitar Realtime para las chicanas
ALTER PUBLICATION supabase_realtime ADD TABLE public.custom_chicanas;
