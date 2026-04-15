-- ============================================================
-- MIGRACIÓN: Agregar nombre, apellido, legajo a public.users
-- Ejecutar en el SQL Editor de Supabase (una sola vez)
-- ============================================================

-- 1. Agregar columnas nuevas (no rompen a los usuarios existentes)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS nombre   text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS apellido text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS legajo   text NOT NULL DEFAULT '';

-- 2. Índice único en legajo (permite legajo vacío en usuarios viejos sin conflicto)
CREATE UNIQUE INDEX IF NOT EXISTS users_legajo_unique
  ON public.users (legajo)
  WHERE legajo != '';

-- 3. Política: admin puede actualizar cualquier perfil (necesaria para el panel admin)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'users'
      AND policyname = 'Admin puede actualizar cualquier perfil'
  ) THEN
    EXECUTE 'CREATE POLICY "Admin puede actualizar cualquier perfil"
      ON public.users FOR UPDATE
      USING (true)
      WITH CHECK (true)';
  END IF;
END $$;

-- 4. Política: admin puede eliminar cualquier usuario
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'users'
      AND policyname = 'Admin puede eliminar usuarios'
  ) THEN
    EXECUTE 'CREATE POLICY "Admin puede eliminar usuarios"
      ON public.users FOR DELETE
      USING (true)';
  END IF;
END $$;

-- 5. (Opcional) Borrar los usuarios existentes para que se re-registren
--    DESCOMENTA estas líneas SOLO si querés resetear todos los usuarios
-- DELETE FROM public.predictions;
-- DELETE FROM public.users;
-- (auth.users debe borrarse desde el Dashboard de Supabase → Authentication → Users)
