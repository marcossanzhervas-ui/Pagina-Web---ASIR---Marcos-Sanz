-- =====================================================
-- LUMA / USUARIOS Y ROLES
-- Ejecútalo DESPUÉS de supabase.sql (SQL Editor > New query).
-- Se puede ejecutar varias veces sin romper nada.
-- =====================================================

-- 1) TABLA DE PERFILES (una fila por usuario registrado) -------------
create table if not exists public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    created_at timestamptz not null default now(),
    email text,
    nombre text not null default '',
    role text not null default 'usuario' check (role in ('usuario', 'admin'))
);

alter table public.profiles enable row level security;

-- 2) FUNCIÓN is_admin() ------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
    select exists (
        select 1 from public.profiles
        where id = auth.uid() and role = 'admin'
    );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- 3) TRIGGER: al registrarse alguien, se crea su perfil como 'usuario' --
-- El rol SIEMPRE es 'usuario', ignorando lo que envíe el navegador.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.profiles (id, email, nombre, role)
    values (
        new.id,
        new.email,
        coalesce(new.raw_user_meta_data->>'nombre', ''),
        'usuario'
    )
    on conflict (id) do nothing;
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- 4) Perfiles para los usuarios que ya existían (quedan como 'usuario') --
insert into public.profiles (id, email, role)
select id, email, 'usuario' from auth.users
on conflict (id) do nothing;

-- 5) POLÍTICAS Y PERMISOS DE profiles ----------------------------------
drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin" on public.profiles
for select to authenticated
using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- Permisos mínimos: un usuario solo puede cambiar su nombre, NUNCA su rol.
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (nombre) on public.profiles to authenticated;

-- 6) AHORA SOLO EL ADMIN PUEDE LEER LOS DATOS PRIVADOS -----------------
drop policy if exists "visitas_authenticated_select" on public.visitas;
drop policy if exists "visitas_admin_select" on public.visitas;
create policy "visitas_admin_select" on public.visitas
for select to authenticated using (public.is_admin());

drop policy if exists "catalogo_admin_all" on public.catalogo;
create policy "catalogo_admin_all" on public.catalogo
for all to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "pedidos_admin_select" on public.pedidos;
create policy "pedidos_admin_select" on public.pedidos
for select to authenticated using (public.is_admin());

drop policy if exists "pedidos_admin_update" on public.pedidos;
create policy "pedidos_admin_update" on public.pedidos
for update to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "pedido_items_admin_select" on public.pedido_items;
create policy "pedido_items_admin_select" on public.pedido_items
for select to authenticated using (public.is_admin());

-- 7) CONVIÉRTETE EN ADMIN -----------------------------------------------
-- CAMBIA el email por el de TU usuario y ejecuta esta línea.
update public.profiles
set role = 'admin'
where email = 'TU_EMAIL_ADMIN@correo.com';
