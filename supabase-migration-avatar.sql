-- ============================================================
-- MIGRACIÓN: Avatar upload para usuarios
-- Ejecutar en el SQL Editor de Supabase (una sola vez)
-- ============================================================

-- 1. Agregar columna avatar_url a la tabla users
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS avatar_url text DEFAULT NULL;

-- 2. Crear bucket 'avatars' (público, máx 150 KB por archivo, solo imágenes)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  153600,  -- 150 KB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 153600,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- 3. Políticas de Storage

-- Cualquiera puede leer avatares (es público)
CREATE POLICY "Avatares son públicos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

-- Solo el propio usuario puede subir su avatar
-- El archivo debe llamarse {user_id}.webp
CREATE POLICY "Usuario puede subir su propio avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid()::text = SPLIT_PART(name, '.', 1)
  );

-- Solo el propio usuario puede actualizar su avatar
CREATE POLICY "Usuario puede actualizar su propio avatar"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = SPLIT_PART(name, '.', 1)
  );

-- Solo el propio usuario puede eliminar su avatar
CREATE POLICY "Usuario puede eliminar su propio avatar"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = SPLIT_PART(name, '.', 1)
  );
