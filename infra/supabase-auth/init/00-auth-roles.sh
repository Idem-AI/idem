#!/bin/sh
# Rôles et schéma attendus par le serveur d'authentification Supabase (GoTrue).
#
# On n'héberge que le module d'authentification : ni PostgREST ni Kong.
# GoTrue crée lui-même ses tables au démarrage (migrations) dans le schéma
# `auth`, avec le rôle `supabase_auth_admin`. Les rôles `anon`,
# `authenticated` et `service_role` sont cités par certaines migrations ; ils
# n'ouvrent aucune connexion (NOLOGIN).
set -eu

: "${AUTH_ADMIN_PASSWORD:?AUTH_ADMIN_PASSWORD manquant}"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -v auth_admin_password="$AUTH_ADMIN_PASSWORD" <<'SQL'
SELECT 'CREATE ROLE anon NOLOGIN NOINHERIT'
  WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') \gexec
SELECT 'CREATE ROLE authenticated NOLOGIN NOINHERIT'
  WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') \gexec
SELECT 'CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS'
  WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') \gexec
SELECT format('CREATE ROLE supabase_auth_admin NOINHERIT CREATEROLE LOGIN PASSWORD %L', :'auth_admin_password')
  WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_auth_admin') \gexec

CREATE SCHEMA IF NOT EXISTS auth AUTHORIZATION supabase_auth_admin;
SELECT format('GRANT CREATE ON DATABASE %I TO supabase_auth_admin', current_database()) \gexec
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
ALTER ROLE supabase_auth_admin SET search_path = auth;
SQL
