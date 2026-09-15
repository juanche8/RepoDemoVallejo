alter table if exists public.analytics_sync_status
  add column if not exists last_successful_date date;

comment on column public.analytics_sync_status.last_successful_date is
  'Último date_to persistido exitosamente; no se modifica ante intentos fallidos.';
