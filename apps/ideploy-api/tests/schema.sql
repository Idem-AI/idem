--
-- PostgreSQL database dump
--


-- Dumped from database version 15.15
-- Dumped by pg_dump version 15.15

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: activity_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.activity_log (
    id bigint NOT NULL,
    log_name character varying(255),
    description text NOT NULL,
    subject_type character varying(255),
    subject_id bigint,
    causer_type character varying(255),
    causer_id bigint,
    properties jsonb,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    event character varying(255),
    batch_uuid uuid
);


--
-- Name: activity_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.activity_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: activity_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.activity_log_id_seq OWNED BY public.activity_log.id;


--
-- Name: additional_destinations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.additional_destinations (
    id bigint NOT NULL,
    application_id bigint NOT NULL,
    server_id bigint NOT NULL,
    status character varying(255) DEFAULT 'exited'::character varying NOT NULL,
    standalone_docker_id bigint NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: additional_destinations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.additional_destinations_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: additional_destinations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.additional_destinations_id_seq OWNED BY public.additional_destinations.id;


--
-- Name: analytics_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.analytics_configs (
    id bigint NOT NULL,
    application_id bigint NOT NULL,
    provider character varying(255) DEFAULT 'plausible'::character varying NOT NULL,
    enabled boolean DEFAULT false NOT NULL,
    site_id character varying(255),
    api_key text,
    api_url character varying(255),
    config json,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: analytics_configs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.analytics_configs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: analytics_configs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.analytics_configs_id_seq OWNED BY public.analytics_configs.id;


--
-- Name: application_deployment_queues; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.application_deployment_queues (
    id bigint NOT NULL,
    application_id character varying(255) NOT NULL,
    deployment_uuid character varying(255) NOT NULL,
    pull_request_id integer DEFAULT 0 NOT NULL,
    force_rebuild boolean DEFAULT false NOT NULL,
    commit character varying(255) DEFAULT 'HEAD'::character varying NOT NULL,
    status character varying(255) DEFAULT 'queued'::character varying NOT NULL,
    is_webhook boolean DEFAULT false NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    logs text,
    current_process_id character varying(255),
    restart_only boolean DEFAULT false NOT NULL,
    git_type character varying(255),
    server_id integer,
    application_name character varying(255),
    server_name character varying(255),
    deployment_url character varying(255),
    destination_id character varying(255),
    only_this_server boolean DEFAULT false NOT NULL,
    rollback boolean DEFAULT false NOT NULL,
    commit_message text,
    is_api boolean DEFAULT false NOT NULL,
    build_server_id integer,
    horizon_job_id character varying(255),
    horizon_job_worker character varying(255),
    finished_at timestamp(0) without time zone
);


--
-- Name: application_deployment_queues_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.application_deployment_queues_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: application_deployment_queues_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.application_deployment_queues_id_seq OWNED BY public.application_deployment_queues.id;


--
-- Name: application_previews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.application_previews (
    id bigint NOT NULL,
    uuid character varying(255) NOT NULL,
    pull_request_id integer NOT NULL,
    pull_request_html_url character varying(255) NOT NULL,
    pull_request_issue_comment_id character varying(255),
    fqdn text,
    status character varying(255) DEFAULT 'exited'::character varying NOT NULL,
    application_id bigint NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    git_type character varying(255),
    docker_compose_domains text,
    last_online_at timestamp(0) without time zone DEFAULT '2026-01-18 00:46:49'::timestamp without time zone NOT NULL,
    deleted_at timestamp(0) without time zone
);


--
-- Name: application_previews_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.application_previews_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: application_previews_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.application_previews_id_seq OWNED BY public.application_previews.id;


--
-- Name: application_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.application_settings (
    id bigint NOT NULL,
    is_static boolean DEFAULT false NOT NULL,
    is_git_submodules_enabled boolean DEFAULT true NOT NULL,
    is_git_lfs_enabled boolean DEFAULT true NOT NULL,
    is_auto_deploy_enabled boolean DEFAULT true NOT NULL,
    is_force_https_enabled boolean DEFAULT true NOT NULL,
    is_debug_enabled boolean DEFAULT false NOT NULL,
    is_preview_deployments_enabled boolean DEFAULT false NOT NULL,
    application_id bigint NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    is_log_drain_enabled boolean DEFAULT false NOT NULL,
    is_gpu_enabled boolean DEFAULT false NOT NULL,
    gpu_driver character varying(255) DEFAULT 'nvidia'::character varying NOT NULL,
    gpu_count character varying(255),
    gpu_device_ids character varying(255),
    gpu_options text,
    is_include_timestamps boolean DEFAULT false NOT NULL,
    is_swarm_only_worker_nodes boolean DEFAULT true NOT NULL,
    is_raw_compose_deployment_enabled boolean DEFAULT false NOT NULL,
    is_build_server_enabled boolean DEFAULT false NOT NULL,
    is_consistent_container_name_enabled boolean DEFAULT false NOT NULL,
    is_gzip_enabled boolean DEFAULT true NOT NULL,
    is_stripprefix_enabled boolean DEFAULT true NOT NULL,
    connect_to_docker_network boolean DEFAULT false NOT NULL,
    custom_internal_name character varying(255),
    is_container_label_escape_enabled boolean DEFAULT true NOT NULL,
    is_env_sorting_enabled boolean DEFAULT false NOT NULL,
    is_container_label_readonly_enabled boolean DEFAULT true NOT NULL,
    is_preserve_repository_enabled boolean DEFAULT false NOT NULL,
    disable_build_cache boolean DEFAULT false NOT NULL,
    is_spa boolean DEFAULT false NOT NULL,
    is_git_shallow_clone_enabled boolean DEFAULT true NOT NULL,
    is_pr_deployments_public_enabled boolean DEFAULT false NOT NULL,
    use_build_secrets boolean DEFAULT false NOT NULL
);


--
-- Name: application_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.application_settings_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: application_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.application_settings_id_seq OWNED BY public.application_settings.id;


--
-- Name: applications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.applications (
    id bigint NOT NULL,
    repository_project_id integer,
    uuid character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    fqdn text,
    config_hash character varying(255),
    git_repository character varying(255) NOT NULL,
    git_branch character varying(255) NOT NULL,
    git_commit_sha character varying(255) DEFAULT 'HEAD'::character varying NOT NULL,
    git_full_url character varying(255),
    docker_registry_image_name character varying(255),
    docker_registry_image_tag character varying(255),
    build_pack character varying(255) NOT NULL,
    static_image character varying(255) DEFAULT 'nginx:alpine'::character varying NOT NULL,
    install_command character varying(255),
    build_command character varying(255),
    start_command character varying(255),
    ports_exposes character varying(255) NOT NULL,
    ports_mappings character varying(255),
    base_directory character varying(255) DEFAULT '/'::character varying NOT NULL,
    publish_directory character varying(255),
    health_check_path character varying(255) DEFAULT '/'::character varying NOT NULL,
    health_check_port character varying(255),
    health_check_host character varying(255) DEFAULT 'localhost'::character varying NOT NULL,
    health_check_method character varying(255) DEFAULT 'GET'::character varying NOT NULL,
    health_check_return_code integer DEFAULT 200 NOT NULL,
    health_check_scheme character varying(255) DEFAULT 'http'::character varying NOT NULL,
    health_check_response_text character varying(255),
    health_check_interval integer DEFAULT 5 NOT NULL,
    health_check_timeout integer DEFAULT 5 NOT NULL,
    health_check_retries integer DEFAULT 10 NOT NULL,
    health_check_start_period integer DEFAULT 5 NOT NULL,
    limits_memory character varying(255) DEFAULT '0'::character varying NOT NULL,
    limits_memory_swap character varying(255) DEFAULT '0'::character varying NOT NULL,
    limits_memory_swappiness integer DEFAULT 60 NOT NULL,
    limits_memory_reservation character varying(255) DEFAULT '0'::character varying NOT NULL,
    limits_cpus character varying(255) DEFAULT '0'::character varying NOT NULL,
    limits_cpuset character varying(255),
    limits_cpu_shares integer DEFAULT 1024 NOT NULL,
    status character varying(255) DEFAULT 'exited'::character varying NOT NULL,
    preview_url_template character varying(255) DEFAULT '{{pr_id}}.{{domain}}'::character varying NOT NULL,
    destination_type character varying(255),
    destination_id bigint,
    source_type character varying(255),
    source_id bigint,
    private_key_id bigint,
    environment_id bigint NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    description character varying(255),
    dockerfile text,
    health_check_enabled boolean DEFAULT false NOT NULL,
    dockerfile_location character varying(255),
    custom_labels text,
    dockerfile_target_build character varying(255),
    manual_webhook_secret_github character varying(255),
    manual_webhook_secret_gitlab character varying(255),
    docker_compose_location character varying(255) DEFAULT '/docker-compose.yaml'::character varying,
    docker_compose text,
    docker_compose_raw text,
    docker_compose_domains text,
    deleted_at timestamp(0) without time zone,
    docker_compose_custom_start_command character varying(255),
    docker_compose_custom_build_command character varying(255),
    swarm_replicas integer DEFAULT 1 NOT NULL,
    swarm_placement_constraints text,
    manual_webhook_secret_bitbucket character varying(255),
    custom_docker_run_options text,
    post_deployment_command text,
    post_deployment_command_container character varying(255),
    pre_deployment_command text,
    pre_deployment_command_container character varying(255),
    watch_paths text,
    custom_healthcheck_found boolean DEFAULT false NOT NULL,
    manual_webhook_secret_gitea character varying(255),
    redirect character varying(255) DEFAULT 'both'::character varying NOT NULL,
    compose_parsing_version character varying(255) DEFAULT '1'::character varying NOT NULL,
    last_online_at timestamp(0) without time zone DEFAULT '2026-01-18 00:46:49'::timestamp without time zone NOT NULL,
    custom_nginx_configuration text,
    custom_network_aliases text,
    is_http_basic_auth_enabled boolean DEFAULT false NOT NULL,
    http_basic_auth_username character varying(255),
    http_basic_auth_password character varying(255),
    idem_deploy_on_managed boolean DEFAULT true NOT NULL,
    idem_assigned_server_id bigint,
    idem_server_strategy character varying(255) DEFAULT 'least_loaded'::character varying NOT NULL,
    buildpacks_builder character varying(255) DEFAULT 'paketobuildpacks/builder:base'::character varying,
    buildpacks_custom text,
    buildpacks_auto_detect boolean DEFAULT true NOT NULL,
    project_id bigint,
    CONSTRAINT applications_idem_server_strategy_check CHECK (((idem_server_strategy)::text = ANY ((ARRAY['least_loaded'::character varying, 'round_robin'::character varying, 'random'::character varying])::text[]))),
    CONSTRAINT applications_redirect_check CHECK (((redirect)::text = ANY ((ARRAY['www'::character varying, 'non-www'::character varying, 'both'::character varying])::text[])))
);


--
-- Name: COLUMN applications.idem_deploy_on_managed; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.applications.idem_deploy_on_managed IS 'True = deploy on IDEM managed servers, False = deploy on personal servers';


--
-- Name: COLUMN applications.idem_assigned_server_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.applications.idem_assigned_server_id IS 'ID of the IDEM managed server assigned to this application';


--
-- Name: COLUMN applications.idem_server_strategy; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.applications.idem_server_strategy IS 'Strategy for selecting IDEM managed server';


--
-- Name: COLUMN applications.buildpacks_builder; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.applications.buildpacks_builder IS 'Cloud Native Buildpacks builder: paketobuildpacks/builder:base, heroku/builder:22, etc.';


--
-- Name: COLUMN applications.buildpacks_custom; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.applications.buildpacks_custom IS 'Comma-separated list of custom buildpacks to use';


--
-- Name: COLUMN applications.buildpacks_auto_detect; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.applications.buildpacks_auto_detect IS 'Let buildpacks auto-detect the application type';


--
-- Name: applications_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.applications_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: applications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.applications_id_seq OWNED BY public.applications.id;


--
-- Name: cloud_init_scripts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cloud_init_scripts (
    id bigint NOT NULL,
    team_id bigint NOT NULL,
    name character varying(255) NOT NULL,
    script text NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: cloud_init_scripts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.cloud_init_scripts_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cloud_init_scripts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.cloud_init_scripts_id_seq OWNED BY public.cloud_init_scripts.id;


--
-- Name: cloud_provider_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cloud_provider_tokens (
    id bigint NOT NULL,
    team_id bigint NOT NULL,
    provider character varying(255) NOT NULL,
    token text NOT NULL,
    name character varying(255),
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: cloud_provider_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.cloud_provider_tokens_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cloud_provider_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.cloud_provider_tokens_id_seq OWNED BY public.cloud_provider_tokens.id;


--
-- Name: discord_notification_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.discord_notification_settings (
    id bigint NOT NULL,
    team_id bigint NOT NULL,
    discord_enabled boolean DEFAULT false NOT NULL,
    discord_webhook_url text,
    deployment_success_discord_notifications boolean DEFAULT false NOT NULL,
    deployment_failure_discord_notifications boolean DEFAULT true NOT NULL,
    status_change_discord_notifications boolean DEFAULT false NOT NULL,
    backup_success_discord_notifications boolean DEFAULT false NOT NULL,
    backup_failure_discord_notifications boolean DEFAULT true NOT NULL,
    scheduled_task_success_discord_notifications boolean DEFAULT false NOT NULL,
    scheduled_task_failure_discord_notifications boolean DEFAULT true NOT NULL,
    docker_cleanup_success_discord_notifications boolean DEFAULT false NOT NULL,
    docker_cleanup_failure_discord_notifications boolean DEFAULT true NOT NULL,
    server_disk_usage_discord_notifications boolean DEFAULT true NOT NULL,
    server_reachable_discord_notifications boolean DEFAULT false NOT NULL,
    server_unreachable_discord_notifications boolean DEFAULT true NOT NULL,
    discord_ping_enabled boolean DEFAULT true NOT NULL,
    server_patch_discord_notifications boolean DEFAULT true NOT NULL
);


--
-- Name: discord_notification_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.discord_notification_settings_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: discord_notification_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.discord_notification_settings_id_seq OWNED BY public.discord_notification_settings.id;


--
-- Name: docker_cleanup_executions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.docker_cleanup_executions (
    id bigint NOT NULL,
    uuid character varying(255) NOT NULL,
    status character varying(255) DEFAULT 'running'::character varying NOT NULL,
    message text,
    cleanup_log json,
    server_id bigint NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    finished_at timestamp(0) without time zone,
    CONSTRAINT docker_cleanup_executions_status_check CHECK (((status)::text = ANY ((ARRAY['success'::character varying, 'failed'::character varying, 'running'::character varying])::text[])))
);


--
-- Name: docker_cleanup_executions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.docker_cleanup_executions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: docker_cleanup_executions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.docker_cleanup_executions_id_seq OWNED BY public.docker_cleanup_executions.id;


--
-- Name: email_notification_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_notification_settings (
    id bigint NOT NULL,
    team_id bigint NOT NULL,
    smtp_enabled boolean DEFAULT false NOT NULL,
    smtp_from_address text,
    smtp_from_name text,
    smtp_recipients text,
    smtp_host text,
    smtp_port integer,
    smtp_encryption character varying(255),
    smtp_username text,
    smtp_password text,
    smtp_timeout integer,
    resend_enabled boolean DEFAULT false NOT NULL,
    resend_api_key text,
    use_instance_email_settings boolean DEFAULT false NOT NULL,
    deployment_success_email_notifications boolean DEFAULT false NOT NULL,
    deployment_failure_email_notifications boolean DEFAULT true NOT NULL,
    status_change_email_notifications boolean DEFAULT false NOT NULL,
    backup_success_email_notifications boolean DEFAULT false NOT NULL,
    backup_failure_email_notifications boolean DEFAULT true NOT NULL,
    scheduled_task_success_email_notifications boolean DEFAULT false NOT NULL,
    scheduled_task_failure_email_notifications boolean DEFAULT true NOT NULL,
    docker_cleanup_success_email_notifications boolean DEFAULT false NOT NULL,
    docker_cleanup_failure_email_notifications boolean DEFAULT true NOT NULL,
    server_disk_usage_email_notifications boolean DEFAULT true NOT NULL,
    server_reachable_email_notifications boolean DEFAULT false NOT NULL,
    server_unreachable_email_notifications boolean DEFAULT true NOT NULL,
    server_patch_email_notifications boolean DEFAULT true NOT NULL
);


--
-- Name: email_notification_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.email_notification_settings_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: email_notification_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.email_notification_settings_id_seq OWNED BY public.email_notification_settings.id;


--
-- Name: environment_variables; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.environment_variables (
    id bigint NOT NULL,
    key character varying(255) NOT NULL,
    value text,
    is_preview boolean DEFAULT false NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    is_shown_once boolean DEFAULT false NOT NULL,
    is_multiline boolean DEFAULT false NOT NULL,
    version character varying(255) DEFAULT '4.0.0-beta.239'::character varying NOT NULL,
    is_literal boolean DEFAULT false NOT NULL,
    uuid character varying(255) NOT NULL,
    "order" integer,
    is_required boolean DEFAULT false NOT NULL,
    is_shared boolean DEFAULT false NOT NULL,
    resourceable_type character varying(255),
    resourceable_id bigint,
    is_runtime boolean DEFAULT true NOT NULL,
    is_buildtime boolean DEFAULT true NOT NULL
);


--
-- Name: environment_variables_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.environment_variables_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: environment_variables_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.environment_variables_id_seq OWNED BY public.environment_variables.id;


--
-- Name: environments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.environments (
    id bigint NOT NULL,
    name character varying(255) NOT NULL,
    project_id bigint NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    description character varying(255),
    uuid character varying(255) NOT NULL
);


--
-- Name: environments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.environments_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: environments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.environments_id_seq OWNED BY public.environments.id;


--
-- Name: failed_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.failed_jobs (
    id bigint NOT NULL,
    uuid character varying(255) NOT NULL,
    connection text NOT NULL,
    queue text NOT NULL,
    payload text NOT NULL,
    exception text NOT NULL,
    failed_at timestamp(0) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: failed_jobs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.failed_jobs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: failed_jobs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.failed_jobs_id_seq OWNED BY public.failed_jobs.id;


--
-- Name: firewall_alerts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.firewall_alerts (
    id bigint NOT NULL,
    application_id bigint NOT NULL,
    alert_type character varying(100) NOT NULL,
    severity character varying(50) NOT NULL,
    ip_address inet NOT NULL,
    scenario character varying(255),
    message text,
    metadata json,
    status character varying(50) DEFAULT 'active'::character varying NOT NULL,
    resolved_at timestamp(0) without time zone,
    resolved_by bigint,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: firewall_alerts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.firewall_alerts_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: firewall_alerts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.firewall_alerts_id_seq OWNED BY public.firewall_alerts.id;


--
-- Name: firewall_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.firewall_configs (
    id bigint NOT NULL,
    application_id bigint NOT NULL,
    enabled boolean DEFAULT false NOT NULL,
    crowdsec_api_key text,
    crowdsec_lapi_url character varying(255),
    appsec_enabled boolean DEFAULT true NOT NULL,
    inband_enabled boolean DEFAULT true NOT NULL,
    outofband_enabled boolean DEFAULT false NOT NULL,
    default_remediation character varying(50) DEFAULT 'ban'::character varying NOT NULL,
    ban_duration integer DEFAULT 3600 NOT NULL,
    blocked_http_code integer DEFAULT 403 NOT NULL,
    passed_http_code integer DEFAULT 200 NOT NULL,
    total_requests bigint DEFAULT '0'::bigint NOT NULL,
    total_blocked bigint DEFAULT '0'::bigint NOT NULL,
    total_allowed bigint DEFAULT '0'::bigint NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    bot_protection_enabled boolean DEFAULT false NOT NULL,
    crowdsec_bouncer_key text,
    rate_limit_average integer,
    rate_limit_burst integer,
    rate_limit_period_seconds integer,
    concurrency_limit integer,
    rate_limit_template character varying(50)
);


--
-- Name: COLUMN firewall_configs.crowdsec_bouncer_key; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.firewall_configs.crowdsec_bouncer_key IS 'Read-only CrowdSec bouncer credential, emitted in the Traefik middleware label. Distinct from crowdsec_api_key, which manages decisions and must stay server-side.';


--
-- Name: COLUMN firewall_configs.rate_limit_average; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.firewall_configs.rate_limit_average IS 'Sustained requests per second per client address, enforced by Traefik''s native ratelimit middleware. NULL means no rate limit is configured.';


--
-- Name: COLUMN firewall_configs.rate_limit_burst; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.firewall_configs.rate_limit_burst IS 'Requests a client may send in a short spike above the average before being refused.';


--
-- Name: COLUMN firewall_configs.rate_limit_period_seconds; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.firewall_configs.rate_limit_period_seconds IS 'Window the average is computed over.';


--
-- Name: COLUMN firewall_configs.concurrency_limit; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.firewall_configs.concurrency_limit IS 'Simultaneous in-flight requests allowed per client address, enforced by Traefik''s native inflightreq middleware. NULL means uncapped.';


--
-- Name: COLUMN firewall_configs.rate_limit_template; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.firewall_configs.rate_limit_template IS 'Which named preset produced the current numbers, or ''custom''. Display only — enforcement reads the numeric columns, never this key.';


--
-- Name: firewall_configs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.firewall_configs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: firewall_configs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.firewall_configs_id_seq OWNED BY public.firewall_configs.id;


--
-- Name: firewall_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.firewall_rules (
    id bigint NOT NULL,
    firewall_config_id bigint NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    enabled boolean DEFAULT true NOT NULL,
    priority integer DEFAULT 100 NOT NULL,
    rule_type character varying(50) DEFAULT 'inband'::character varying NOT NULL,
    conditions json NOT NULL,
    logical_operator character varying(10) DEFAULT 'AND'::character varying NOT NULL,
    action character varying(50) DEFAULT 'block'::character varying NOT NULL,
    remediation_duration integer DEFAULT 3600 NOT NULL,
    generated_yaml text,
    match_count bigint DEFAULT '0'::bigint NOT NULL,
    last_match_at timestamp(0) without time zone,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    protection_mode character varying(20) DEFAULT 'hybrid'::character varying NOT NULL,
    capacity integer DEFAULT 1 NOT NULL,
    leakspeed character varying(20) DEFAULT '10s'::character varying NOT NULL
);


--
-- Name: firewall_rules_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.firewall_rules_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: firewall_rules_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.firewall_rules_id_seq OWNED BY public.firewall_rules.id;


--
-- Name: firewall_traffic_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.firewall_traffic_logs (
    id bigint NOT NULL,
    application_id bigint NOT NULL,
    ip_address inet NOT NULL,
    method character varying(10),
    uri text,
    host character varying(255),
    user_agent text,
    referer text,
    decision character varying(50),
    rule_id bigint,
    rule_name character varying(255),
    country_code character varying(2),
    asn integer,
    reverse_dns character varying(255),
    "timestamp" timestamp(0) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: firewall_traffic_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.firewall_traffic_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: firewall_traffic_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.firewall_traffic_logs_id_seq OWNED BY public.firewall_traffic_logs.id;


--
-- Name: github_apps; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.github_apps (
    id bigint NOT NULL,
    uuid character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    organization character varying(255),
    api_url character varying(255) NOT NULL,
    html_url character varying(255) NOT NULL,
    custom_user character varying(255) DEFAULT 'git'::character varying NOT NULL,
    custom_port integer DEFAULT 22 NOT NULL,
    app_id integer,
    installation_id integer,
    client_id character varying(255),
    client_secret text,
    webhook_secret text,
    is_system_wide boolean DEFAULT false NOT NULL,
    is_public boolean DEFAULT false NOT NULL,
    private_key_id bigint,
    team_id bigint NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    contents character varying(255),
    metadata character varying(255),
    pull_requests character varying(255),
    administration character varying(255)
);


--
-- Name: github_apps_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.github_apps_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: github_apps_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.github_apps_id_seq OWNED BY public.github_apps.id;


--
-- Name: gitlab_apps; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gitlab_apps (
    id bigint NOT NULL,
    uuid character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    organization character varying(255),
    api_url character varying(255) NOT NULL,
    html_url character varying(255) NOT NULL,
    custom_port integer DEFAULT 22 NOT NULL,
    custom_user character varying(255) DEFAULT 'git'::character varying NOT NULL,
    is_system_wide boolean DEFAULT false NOT NULL,
    is_public boolean DEFAULT false NOT NULL,
    app_id integer,
    app_secret character varying(255),
    oauth_id integer,
    group_name character varying(255),
    public_key text,
    webhook_token text,
    deploy_key_id integer,
    private_key_id bigint,
    team_id bigint NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: gitlab_apps_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.gitlab_apps_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: gitlab_apps_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.gitlab_apps_id_seq OWNED BY public.gitlab_apps.id;


--
-- Name: idem_quotas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.idem_quotas (
    id bigint NOT NULL,
    team_id bigint NOT NULL,
    plan_type character varying(255) DEFAULT 'free'::character varying NOT NULL,
    max_applications integer DEFAULT 3 NOT NULL,
    max_servers integer DEFAULT 1 NOT NULL,
    max_databases integer DEFAULT 2 NOT NULL,
    max_services integer DEFAULT 1 NOT NULL,
    unlimited_applications boolean DEFAULT false NOT NULL,
    unlimited_servers boolean DEFAULT false NOT NULL,
    used_applications integer DEFAULT 0 NOT NULL,
    used_servers integer DEFAULT 0 NOT NULL,
    used_databases integer DEFAULT 0 NOT NULL,
    used_services integer DEFAULT 0 NOT NULL,
    custom_domains boolean DEFAULT false NOT NULL,
    ssl_certificates boolean DEFAULT false NOT NULL,
    backup_enabled boolean DEFAULT false NOT NULL,
    firewall_enabled boolean DEFAULT false NOT NULL,
    analytics_enabled boolean DEFAULT false NOT NULL,
    last_sync_at timestamp(0) without time zone,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: idem_quotas_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.idem_quotas_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: idem_quotas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.idem_quotas_id_seq OWNED BY public.idem_quotas.id;


--
-- Name: idem_subscription_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.idem_subscription_plans (
    id bigint NOT NULL,
    name character varying(255) NOT NULL,
    display_name character varying(255) NOT NULL,
    price numeric(10,2) DEFAULT '0'::numeric NOT NULL,
    currency character varying(255) DEFAULT 'USD'::character varying NOT NULL,
    billing_period character varying(255) DEFAULT 'monthly'::character varying NOT NULL,
    app_limit integer DEFAULT 0 NOT NULL,
    server_limit integer DEFAULT 0 NOT NULL,
    features text,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    allows_region_selection boolean DEFAULT false NOT NULL,
    CONSTRAINT idem_subscription_plans_billing_period_check CHECK (((billing_period)::text = ANY ((ARRAY['monthly'::character varying, 'yearly'::character varying])::text[])))
);


--
-- Name: COLUMN idem_subscription_plans.app_limit; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.idem_subscription_plans.app_limit IS '0 = unlimited';


--
-- Name: COLUMN idem_subscription_plans.server_limit; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.idem_subscription_plans.server_limit IS '0 = unlimited';


--
-- Name: COLUMN idem_subscription_plans.features; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.idem_subscription_plans.features IS 'JSON array of features';


--
-- Name: COLUMN idem_subscription_plans.allows_region_selection; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.idem_subscription_plans.allows_region_selection IS 'When true, a workspace on this plan may pick its hosting region; otherwise the default region is used.';


--
-- Name: idem_subscription_plans_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.idem_subscription_plans_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: idem_subscription_plans_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.idem_subscription_plans_id_seq OWNED BY public.idem_subscription_plans.id;


--
-- Name: instance_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.instance_settings (
    id bigint NOT NULL,
    public_ipv4 character varying(255),
    public_ipv6 character varying(255),
    fqdn character varying(255),
    public_port_min integer DEFAULT 9000 NOT NULL,
    public_port_max integer DEFAULT 9100 NOT NULL,
    do_not_track boolean DEFAULT false NOT NULL,
    is_auto_update_enabled boolean DEFAULT true NOT NULL,
    is_registration_enabled boolean DEFAULT true NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    next_channel boolean DEFAULT false NOT NULL,
    smtp_enabled boolean DEFAULT false NOT NULL,
    smtp_from_address text,
    smtp_from_name text,
    smtp_recipients text,
    smtp_host text,
    smtp_port integer,
    smtp_encryption character varying(255),
    smtp_username text,
    smtp_password text,
    smtp_timeout integer,
    resend_enabled boolean DEFAULT false NOT NULL,
    resend_api_key text,
    is_dns_validation_enabled boolean DEFAULT true NOT NULL,
    custom_dns_servers character varying(255) DEFAULT '1.1.1.1'::character varying,
    instance_name character varying(255),
    is_api_enabled boolean DEFAULT false NOT NULL,
    allowed_ips text,
    auto_update_frequency character varying(255) DEFAULT '0 0 * * *'::character varying NOT NULL,
    update_check_frequency character varying(255) DEFAULT '0 * * * *'::character varying NOT NULL,
    new_version_available boolean DEFAULT false NOT NULL,
    instance_timezone character varying(255) DEFAULT 'UTC'::character varying NOT NULL,
    helper_version character varying(255) DEFAULT '1.0.0'::character varying NOT NULL,
    disable_two_step_confirmation boolean DEFAULT false NOT NULL,
    is_sponsorship_popup_enabled boolean DEFAULT true NOT NULL
);


--
-- Name: instance_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.instance_settings_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: instance_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.instance_settings_id_seq OWNED BY public.instance_settings.id;


--
-- Name: local_file_volumes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.local_file_volumes (
    id bigint NOT NULL,
    uuid character varying(255) NOT NULL,
    fs_path text NOT NULL,
    mount_path text,
    content text,
    resource_type character varying(255),
    resource_id bigint,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    is_directory boolean DEFAULT false NOT NULL,
    chown character varying(255),
    chmod character varying(255),
    is_based_on_git boolean DEFAULT false NOT NULL
);


--
-- Name: local_file_volumes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.local_file_volumes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: local_file_volumes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.local_file_volumes_id_seq OWNED BY public.local_file_volumes.id;


--
-- Name: local_persistent_volumes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.local_persistent_volumes (
    id bigint NOT NULL,
    name character varying(255) NOT NULL,
    mount_path character varying(255) NOT NULL,
    host_path character varying(255),
    container_id character varying(255),
    resource_type character varying(255),
    resource_id bigint,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: local_persistent_volumes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.local_persistent_volumes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: local_persistent_volumes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.local_persistent_volumes_id_seq OWNED BY public.local_persistent_volumes.id;


--
-- Name: migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.migrations (
    id integer NOT NULL,
    migration character varying(255) NOT NULL,
    batch integer NOT NULL
);


--
-- Name: migrations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.migrations_id_seq OWNED BY public.migrations.id;


--
-- Name: oauth_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.oauth_settings (
    id bigint NOT NULL,
    provider character varying(255) NOT NULL,
    enabled boolean DEFAULT false NOT NULL,
    client_id character varying(255),
    client_secret text,
    redirect_uri character varying(255),
    tenant character varying(255),
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    base_url character varying(255)
);


--
-- Name: oauth_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.oauth_settings_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: oauth_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.oauth_settings_id_seq OWNED BY public.oauth_settings.id;


--
-- Name: password_reset_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.password_reset_tokens (
    email character varying(255) NOT NULL,
    token character varying(255) NOT NULL,
    created_at timestamp(0) without time zone
);


--
-- Name: personal_access_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.personal_access_tokens (
    id bigint NOT NULL,
    tokenable_type character varying(255) NOT NULL,
    tokenable_id bigint NOT NULL,
    name character varying(255) NOT NULL,
    token character varying(64) NOT NULL,
    team_id character varying(255) NOT NULL,
    abilities text,
    last_used_at timestamp(0) without time zone,
    expires_at timestamp(0) without time zone,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: personal_access_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.personal_access_tokens_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: personal_access_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.personal_access_tokens_id_seq OWNED BY public.personal_access_tokens.id;


--
-- Name: pgmigrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pgmigrations (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    run_on timestamp without time zone NOT NULL
);


--
-- Name: pgmigrations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pgmigrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pgmigrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pgmigrations_id_seq OWNED BY public.pgmigrations.id;


--
-- Name: pipeline_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pipeline_configs (
    id bigint NOT NULL,
    application_id bigint NOT NULL,
    enabled boolean DEFAULT false NOT NULL,
    stages json,
    trigger_mode character varying(255) DEFAULT 'auto'::character varying NOT NULL,
    trigger_branches json,
    environment_vars json,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    auto_trigger_on_push boolean DEFAULT false NOT NULL,
    auto_trigger_on_pr boolean DEFAULT false NOT NULL,
    watch_paths json,
    config json
);


--
-- Name: pipeline_configs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pipeline_configs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pipeline_configs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pipeline_configs_id_seq OWNED BY public.pipeline_configs.id;


--
-- Name: pipeline_executions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pipeline_executions (
    id bigint NOT NULL,
    uuid uuid NOT NULL,
    pipeline_config_id bigint NOT NULL,
    application_id bigint NOT NULL,
    trigger_type character varying(255) DEFAULT 'push'::character varying NOT NULL,
    trigger_user character varying(255),
    commit_sha character varying(255),
    commit_message character varying(255),
    branch character varying(255),
    status character varying(255) DEFAULT 'pending'::character varying NOT NULL,
    stages_status json,
    started_at timestamp(0) without time zone,
    finished_at timestamp(0) without time zone,
    duration_seconds numeric(10,2),
    error_message text,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    source_path character varying(255)
);


--
-- Name: pipeline_executions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pipeline_executions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pipeline_executions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pipeline_executions_id_seq OWNED BY public.pipeline_executions.id;


--
-- Name: pipeline_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pipeline_jobs (
    id bigint NOT NULL,
    uuid uuid NOT NULL,
    pipeline_execution_id bigint NOT NULL,
    name character varying(255) NOT NULL,
    status character varying(255) DEFAULT 'pending'::character varying NOT NULL,
    "order" integer DEFAULT 0 NOT NULL,
    started_at timestamp(0) without time zone,
    finished_at timestamp(0) without time zone,
    duration_seconds numeric(10,2),
    logs text,
    metadata json,
    error_message text,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: pipeline_jobs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pipeline_jobs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pipeline_jobs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pipeline_jobs_id_seq OWNED BY public.pipeline_jobs.id;


--
-- Name: pipeline_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pipeline_logs (
    id bigint NOT NULL,
    pipeline_execution_id bigint NOT NULL,
    stage_id character varying(255) NOT NULL,
    stage_name character varying(255) NOT NULL,
    level character varying(255) DEFAULT 'info'::character varying NOT NULL,
    message text NOT NULL,
    metadata json,
    logged_at timestamp(0) without time zone NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: pipeline_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pipeline_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pipeline_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pipeline_logs_id_seq OWNED BY public.pipeline_logs.id;


--
-- Name: pipeline_notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pipeline_notifications (
    id bigint NOT NULL,
    pipeline_config_id bigint NOT NULL,
    channel character varying(255) NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    webhook_url character varying(255),
    email character varying(255),
    events json,
    config json,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: pipeline_notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pipeline_notifications_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pipeline_notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pipeline_notifications_id_seq OWNED BY public.pipeline_notifications.id;


--
-- Name: pipeline_scan_results; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pipeline_scan_results (
    id bigint NOT NULL,
    uuid uuid NOT NULL,
    pipeline_job_id bigint,
    pipeline_execution_id bigint NOT NULL,
    tool character varying(255) NOT NULL,
    status character varying(255) DEFAULT 'pending'::character varying NOT NULL,
    sonar_project_key character varying(255),
    sonar_task_id character varying(255),
    quality_gate_status character varying(255),
    bugs integer,
    vulnerabilities integer,
    code_smells integer,
    security_hotspots integer,
    coverage numeric(5,2),
    duplications numeric(5,2),
    sonar_dashboard_url character varying(255),
    critical_count integer,
    high_count integer,
    medium_count integer,
    low_count integer,
    vulnerabilities_detail json,
    secrets_found json,
    raw_data json,
    summary text,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: pipeline_scan_results_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pipeline_scan_results_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pipeline_scan_results_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pipeline_scan_results_id_seq OWNED BY public.pipeline_scan_results.id;


--
-- Name: pipeline_tool_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pipeline_tool_configs (
    id bigint NOT NULL,
    tool_name character varying(255) NOT NULL,
    type character varying(255) NOT NULL,
    application_id bigint,
    enabled boolean DEFAULT true NOT NULL,
    endpoint_url character varying(255),
    api_key character varying(255),
    config json,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: pipeline_tool_configs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pipeline_tool_configs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pipeline_tool_configs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pipeline_tool_configs_id_seq OWNED BY public.pipeline_tool_configs.id;


--
-- Name: private_keys; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.private_keys (
    id bigint NOT NULL,
    uuid character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    description character varying(255),
    private_key text NOT NULL,
    is_git_related boolean DEFAULT false NOT NULL,
    team_id bigint NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    fingerprint character varying(255)
);


--
-- Name: private_keys_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.private_keys_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: private_keys_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.private_keys_id_seq OWNED BY public.private_keys.id;


--
-- Name: project_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_settings (
    id bigint NOT NULL,
    project_id bigint NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: project_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.project_settings_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: project_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.project_settings_id_seq OWNED BY public.project_settings.id;


--
-- Name: projects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.projects (
    id bigint NOT NULL,
    uuid character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    description character varying(255),
    team_id bigint NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    deployment_type character varying(10) DEFAULT 'saas'::character varying NOT NULL,
    deployment_region character varying(10),
    assigned_server_id bigint
);


--
-- Name: projects_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.projects_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: projects_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.projects_id_seq OWNED BY public.projects.id;


--
-- Name: pushover_notification_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pushover_notification_settings (
    id bigint NOT NULL,
    team_id bigint NOT NULL,
    pushover_enabled boolean DEFAULT false NOT NULL,
    pushover_user_key text,
    pushover_api_token text,
    deployment_success_pushover_notifications boolean DEFAULT false NOT NULL,
    deployment_failure_pushover_notifications boolean DEFAULT true NOT NULL,
    status_change_pushover_notifications boolean DEFAULT false NOT NULL,
    backup_success_pushover_notifications boolean DEFAULT false NOT NULL,
    backup_failure_pushover_notifications boolean DEFAULT true NOT NULL,
    scheduled_task_success_pushover_notifications boolean DEFAULT false NOT NULL,
    scheduled_task_failure_pushover_notifications boolean DEFAULT true NOT NULL,
    docker_cleanup_success_pushover_notifications boolean DEFAULT false NOT NULL,
    docker_cleanup_failure_pushover_notifications boolean DEFAULT true NOT NULL,
    server_disk_usage_pushover_notifications boolean DEFAULT true NOT NULL,
    server_reachable_pushover_notifications boolean DEFAULT false NOT NULL,
    server_unreachable_pushover_notifications boolean DEFAULT true NOT NULL,
    server_patch_pushover_notifications boolean DEFAULT true NOT NULL
);


--
-- Name: pushover_notification_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pushover_notification_settings_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pushover_notification_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pushover_notification_settings_id_seq OWNED BY public.pushover_notification_settings.id;


--
-- Name: s3_storages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.s3_storages (
    id bigint NOT NULL,
    uuid character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    region character varying(255) DEFAULT 'us-east-1'::character varying NOT NULL,
    key text NOT NULL,
    secret text NOT NULL,
    bucket text NOT NULL,
    endpoint text,
    team_id bigint NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    is_usable boolean DEFAULT false NOT NULL,
    unusable_email_sent boolean DEFAULT false NOT NULL
);


--
-- Name: s3_storages_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.s3_storages_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: s3_storages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.s3_storages_id_seq OWNED BY public.s3_storages.id;


--
-- Name: scheduled_database_backup_executions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scheduled_database_backup_executions (
    id bigint NOT NULL,
    uuid character varying(255) NOT NULL,
    status character varying(255) DEFAULT 'running'::character varying NOT NULL,
    message text,
    size text,
    filename text,
    scheduled_database_backup_id bigint NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    database_name character varying(255),
    finished_at timestamp(0) without time zone,
    local_storage_deleted boolean DEFAULT false NOT NULL,
    s3_storage_deleted boolean DEFAULT false NOT NULL,
    s3_uploaded boolean,
    CONSTRAINT scheduled_database_backup_executions_status_check CHECK (((status)::text = ANY ((ARRAY['success'::character varying, 'failed'::character varying, 'running'::character varying])::text[])))
);


--
-- Name: scheduled_database_backup_executions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.scheduled_database_backup_executions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: scheduled_database_backup_executions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.scheduled_database_backup_executions_id_seq OWNED BY public.scheduled_database_backup_executions.id;


--
-- Name: scheduled_database_backups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scheduled_database_backups (
    id bigint NOT NULL,
    description text,
    uuid character varying(255) NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    save_s3 boolean DEFAULT true NOT NULL,
    frequency character varying(255) NOT NULL,
    database_backup_retention_amount_locally integer DEFAULT 0 NOT NULL,
    database_type character varying(255) NOT NULL,
    database_id bigint NOT NULL,
    s3_storage_id bigint,
    team_id bigint NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    databases_to_backup text,
    dump_all boolean DEFAULT false NOT NULL,
    database_backup_retention_days_locally integer DEFAULT 0 NOT NULL,
    database_backup_retention_max_storage_locally numeric(17,7) DEFAULT '0'::numeric NOT NULL,
    database_backup_retention_amount_s3 integer DEFAULT 0 NOT NULL,
    database_backup_retention_days_s3 integer DEFAULT 0 NOT NULL,
    database_backup_retention_max_storage_s3 numeric(17,7) DEFAULT '0'::numeric NOT NULL,
    timeout integer DEFAULT 3600 NOT NULL,
    disable_local_backup boolean DEFAULT false NOT NULL
);


--
-- Name: scheduled_database_backups_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.scheduled_database_backups_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: scheduled_database_backups_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.scheduled_database_backups_id_seq OWNED BY public.scheduled_database_backups.id;


--
-- Name: scheduled_task_executions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scheduled_task_executions (
    id bigint NOT NULL,
    uuid character varying(255) NOT NULL,
    status character varying(255) DEFAULT 'running'::character varying NOT NULL,
    message text,
    scheduled_task_id bigint NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    finished_at timestamp(0) without time zone,
    CONSTRAINT scheduled_task_executions_status_check CHECK (((status)::text = ANY ((ARRAY['success'::character varying, 'failed'::character varying, 'running'::character varying])::text[])))
);


--
-- Name: scheduled_task_executions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.scheduled_task_executions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: scheduled_task_executions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.scheduled_task_executions_id_seq OWNED BY public.scheduled_task_executions.id;


--
-- Name: scheduled_tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scheduled_tasks (
    id bigint NOT NULL,
    uuid character varying(255) NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    name character varying(255) NOT NULL,
    command character varying(255) NOT NULL,
    frequency character varying(255) NOT NULL,
    container character varying(255),
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    application_id bigint,
    service_id bigint,
    team_id bigint NOT NULL
);


--
-- Name: scheduled_tasks_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.scheduled_tasks_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: scheduled_tasks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.scheduled_tasks_id_seq OWNED BY public.scheduled_tasks.id;


--
-- Name: server_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.server_settings (
    id bigint NOT NULL,
    is_swarm_manager boolean DEFAULT false NOT NULL,
    is_jump_server boolean DEFAULT false NOT NULL,
    is_build_server boolean DEFAULT false NOT NULL,
    is_reachable boolean DEFAULT false NOT NULL,
    is_usable boolean DEFAULT false NOT NULL,
    server_id bigint NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    wildcard_domain character varying(255),
    is_cloudflare_tunnel boolean DEFAULT false NOT NULL,
    is_logdrain_newrelic_enabled boolean DEFAULT false NOT NULL,
    logdrain_newrelic_license_key character varying(255),
    logdrain_newrelic_base_uri character varying(255),
    is_logdrain_highlight_enabled boolean DEFAULT false NOT NULL,
    logdrain_highlight_project_id character varying(255),
    is_logdrain_axiom_enabled boolean DEFAULT false NOT NULL,
    logdrain_axiom_dataset_name character varying(255),
    logdrain_axiom_api_key character varying(255),
    is_swarm_worker boolean DEFAULT false NOT NULL,
    is_logdrain_custom_enabled boolean DEFAULT false NOT NULL,
    logdrain_custom_config text,
    logdrain_custom_config_parser text,
    concurrent_builds integer DEFAULT 2 NOT NULL,
    dynamic_timeout integer DEFAULT 3600 NOT NULL,
    force_disabled boolean DEFAULT false NOT NULL,
    is_metrics_enabled boolean DEFAULT false NOT NULL,
    generate_exact_labels boolean DEFAULT false NOT NULL,
    force_docker_cleanup boolean DEFAULT true NOT NULL,
    docker_cleanup_frequency character varying(255) DEFAULT '0 0 * * *'::character varying NOT NULL,
    docker_cleanup_threshold integer DEFAULT 80 NOT NULL,
    server_timezone character varying(255) DEFAULT 'UTC'::character varying NOT NULL,
    delete_unused_volumes boolean DEFAULT false NOT NULL,
    delete_unused_networks boolean DEFAULT false NOT NULL,
    is_sentinel_enabled boolean DEFAULT true NOT NULL,
    sentinel_token text,
    sentinel_metrics_refresh_rate_seconds integer DEFAULT 10 NOT NULL,
    sentinel_metrics_history_days integer DEFAULT 7 NOT NULL,
    sentinel_push_interval_seconds integer DEFAULT 60 NOT NULL,
    sentinel_custom_url character varying(255),
    server_disk_usage_notification_threshold integer DEFAULT 80 NOT NULL,
    is_sentinel_debug_enabled boolean DEFAULT false NOT NULL,
    server_disk_usage_check_frequency character varying(255) DEFAULT '0 23 * * *'::character varying NOT NULL,
    is_terminal_enabled boolean DEFAULT true NOT NULL
);


--
-- Name: server_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.server_settings_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: server_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.server_settings_id_seq OWNED BY public.server_settings.id;


--
-- Name: servers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.servers (
    id bigint NOT NULL,
    uuid character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    description character varying(255),
    ip character varying(255) NOT NULL,
    port integer DEFAULT 22 NOT NULL,
    "user" character varying(255) DEFAULT 'root'::character varying NOT NULL,
    team_id bigint NOT NULL,
    private_key_id bigint NOT NULL,
    proxy json,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    unreachable_notification_sent boolean DEFAULT false NOT NULL,
    unreachable_count integer DEFAULT 0 NOT NULL,
    high_disk_usage_notification_sent boolean DEFAULT false NOT NULL,
    log_drain_notification_sent boolean DEFAULT false NOT NULL,
    swarm_cluster integer,
    validation_logs text,
    sentinel_updated_at timestamp(0) without time zone DEFAULT '2026-01-18 00:46:49'::timestamp without time zone NOT NULL,
    deleted_at timestamp(0) without time zone,
    ip_previous character varying(255),
    hetzner_server_id bigint,
    cloud_provider_token_id bigint,
    hetzner_server_status character varying(255),
    is_validating boolean DEFAULT false NOT NULL,
    idem_managed boolean DEFAULT false NOT NULL,
    idem_load_score integer DEFAULT 0 NOT NULL,
    crowdsec_installed boolean DEFAULT false NOT NULL,
    crowdsec_available boolean DEFAULT false NOT NULL,
    crowdsec_lapi_url character varying(255),
    crowdsec_api_key text,
    crowdsec_bouncer_key text,
    traffic_logger_installed boolean DEFAULT false NOT NULL,
    traefik_logging_enabled boolean DEFAULT false NOT NULL,
    traffic_logger_url character varying(255),
    traffic_logger_token text,
    installation_validated boolean DEFAULT false NOT NULL,
    last_validation_at timestamp(0) without time zone,
    validation_details json,
    country character varying(255),
    country_code character varying(2),
    region character varying(255),
    city character varying(255),
    latitude numeric(10,8),
    longitude numeric(11,8),
    cpu_cores integer,
    ram_mb integer,
    disk_gb integer,
    max_applications integer DEFAULT 50 NOT NULL,
    current_applications integer DEFAULT 0 NOT NULL,
    is_available boolean DEFAULT true NOT NULL,
    load_score integer DEFAULT 0 NOT NULL,
    managed_by_idem boolean DEFAULT false NOT NULL
);


--
-- Name: COLUMN servers.idem_load_score; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.servers.idem_load_score IS 'Load score for server selection strategy';


--
-- Name: servers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.servers_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: servers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.servers_id_seq OWNED BY public.servers.id;


--
-- Name: service_applications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_applications (
    id bigint NOT NULL,
    uuid character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    human_name character varying(255),
    description text,
    fqdn text,
    ports text,
    exposes text,
    status character varying(255) DEFAULT 'exited'::character varying NOT NULL,
    service_id bigint NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    exclude_from_status boolean DEFAULT false NOT NULL,
    required_fqdn boolean DEFAULT false NOT NULL,
    image character varying(255),
    is_log_drain_enabled boolean DEFAULT false NOT NULL,
    is_include_timestamps boolean DEFAULT false NOT NULL,
    deleted_at timestamp(0) without time zone,
    is_gzip_enabled boolean DEFAULT true NOT NULL,
    is_stripprefix_enabled boolean DEFAULT true NOT NULL,
    last_online_at timestamp(0) without time zone DEFAULT '2026-01-18 00:46:49'::timestamp without time zone NOT NULL,
    is_migrated boolean DEFAULT false NOT NULL
);


--
-- Name: service_applications_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.service_applications_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: service_applications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.service_applications_id_seq OWNED BY public.service_applications.id;


--
-- Name: service_databases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_databases (
    id bigint NOT NULL,
    uuid character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    human_name character varying(255),
    description text,
    ports text,
    exposes text,
    status character varying(255) DEFAULT 'exited'::character varying NOT NULL,
    service_id bigint NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    exclude_from_status boolean DEFAULT false NOT NULL,
    image character varying(255),
    public_port integer,
    is_public boolean DEFAULT false NOT NULL,
    is_log_drain_enabled boolean DEFAULT false NOT NULL,
    is_include_timestamps boolean DEFAULT false NOT NULL,
    deleted_at timestamp(0) without time zone,
    is_gzip_enabled boolean DEFAULT true NOT NULL,
    is_stripprefix_enabled boolean DEFAULT true NOT NULL,
    last_online_at timestamp(0) without time zone DEFAULT '2026-01-18 00:46:49'::timestamp without time zone NOT NULL,
    is_migrated boolean DEFAULT false NOT NULL,
    custom_type character varying(255)
);


--
-- Name: service_databases_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.service_databases_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: service_databases_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.service_databases_id_seq OWNED BY public.service_databases.id;


--
-- Name: services; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.services (
    id bigint NOT NULL,
    uuid character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    environment_id bigint NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    server_id bigint,
    description text,
    docker_compose_raw text NOT NULL,
    docker_compose text,
    destination_type character varying(255),
    destination_id bigint,
    deleted_at timestamp(0) without time zone,
    connect_to_docker_network boolean DEFAULT false NOT NULL,
    config_hash character varying(255),
    service_type character varying(255),
    is_container_label_escape_enabled boolean DEFAULT true NOT NULL,
    compose_parsing_version character varying(255) DEFAULT '2'::character varying NOT NULL,
    project_id bigint
);


--
-- Name: services_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.services_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: services_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.services_id_seq OWNED BY public.services.id;


--
-- Name: sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sessions (
    id character varying(255) NOT NULL,
    user_id bigint,
    ip_address character varying(45),
    user_agent text,
    payload text NOT NULL,
    last_activity integer NOT NULL
);


--
-- Name: shared_environment_variables; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shared_environment_variables (
    id bigint NOT NULL,
    key character varying(255) NOT NULL,
    value text NOT NULL,
    is_shown_once boolean DEFAULT false NOT NULL,
    type character varying(255) DEFAULT 'team'::character varying NOT NULL,
    team_id bigint NOT NULL,
    project_id bigint,
    environment_id bigint,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    is_multiline boolean DEFAULT false NOT NULL,
    version character varying(255) DEFAULT '4.0.0-beta.239'::character varying NOT NULL,
    is_literal boolean DEFAULT false NOT NULL,
    CONSTRAINT shared_environment_variables_type_check CHECK (((type)::text = ANY ((ARRAY['team'::character varying, 'project'::character varying, 'environment'::character varying])::text[])))
);


--
-- Name: shared_environment_variables_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.shared_environment_variables_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: shared_environment_variables_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.shared_environment_variables_id_seq OWNED BY public.shared_environment_variables.id;


--
-- Name: slack_notification_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.slack_notification_settings (
    id bigint NOT NULL,
    team_id bigint NOT NULL,
    slack_enabled boolean DEFAULT false NOT NULL,
    slack_webhook_url text,
    deployment_success_slack_notifications boolean DEFAULT false NOT NULL,
    deployment_failure_slack_notifications boolean DEFAULT true NOT NULL,
    status_change_slack_notifications boolean DEFAULT false NOT NULL,
    backup_success_slack_notifications boolean DEFAULT false NOT NULL,
    backup_failure_slack_notifications boolean DEFAULT true NOT NULL,
    scheduled_task_success_slack_notifications boolean DEFAULT false NOT NULL,
    scheduled_task_failure_slack_notifications boolean DEFAULT true NOT NULL,
    docker_cleanup_success_slack_notifications boolean DEFAULT false NOT NULL,
    docker_cleanup_failure_slack_notifications boolean DEFAULT true NOT NULL,
    server_disk_usage_slack_notifications boolean DEFAULT true NOT NULL,
    server_reachable_slack_notifications boolean DEFAULT false NOT NULL,
    server_unreachable_slack_notifications boolean DEFAULT true NOT NULL,
    server_patch_slack_notifications boolean DEFAULT true NOT NULL
);


--
-- Name: slack_notification_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.slack_notification_settings_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: slack_notification_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.slack_notification_settings_id_seq OWNED BY public.slack_notification_settings.id;


--
-- Name: ssl_certificates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ssl_certificates (
    id bigint NOT NULL,
    ssl_certificate text NOT NULL,
    ssl_private_key text NOT NULL,
    configuration_dir text,
    mount_path text,
    resource_type character varying(255),
    resource_id bigint,
    server_id bigint NOT NULL,
    common_name text NOT NULL,
    subject_alternative_names json,
    valid_until timestamp(0) without time zone NOT NULL,
    is_ca_certificate boolean DEFAULT false NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: ssl_certificates_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ssl_certificates_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ssl_certificates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ssl_certificates_id_seq OWNED BY public.ssl_certificates.id;


--
-- Name: standalone_clickhouses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.standalone_clickhouses (
    id bigint NOT NULL,
    uuid character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    description character varying(255),
    clickhouse_admin_user character varying(255) DEFAULT 'default'::character varying NOT NULL,
    clickhouse_admin_password text NOT NULL,
    is_log_drain_enabled boolean DEFAULT false NOT NULL,
    is_include_timestamps boolean DEFAULT false NOT NULL,
    deleted_at timestamp(0) without time zone,
    status character varying(255) DEFAULT 'exited'::character varying NOT NULL,
    image character varying(255) DEFAULT 'bitnamilegacy/clickhouse'::character varying NOT NULL,
    is_public boolean DEFAULT false NOT NULL,
    public_port integer,
    ports_mappings text,
    limits_memory character varying(255) DEFAULT '0'::character varying NOT NULL,
    limits_memory_swap character varying(255) DEFAULT '0'::character varying NOT NULL,
    limits_memory_swappiness integer DEFAULT 60 NOT NULL,
    limits_memory_reservation character varying(255) DEFAULT '0'::character varying NOT NULL,
    limits_cpus character varying(255) DEFAULT '0'::character varying NOT NULL,
    limits_cpuset character varying(255),
    limits_cpu_shares integer DEFAULT 1024 NOT NULL,
    started_at timestamp(0) without time zone,
    destination_type character varying(255) NOT NULL,
    destination_id bigint NOT NULL,
    environment_id bigint,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    config_hash character varying(255),
    custom_docker_run_options text,
    last_online_at timestamp(0) without time zone DEFAULT '2026-01-18 00:46:49'::timestamp without time zone NOT NULL,
    project_id bigint
);


--
-- Name: standalone_clickhouses_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.standalone_clickhouses_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: standalone_clickhouses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.standalone_clickhouses_id_seq OWNED BY public.standalone_clickhouses.id;


--
-- Name: standalone_dockers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.standalone_dockers (
    id bigint NOT NULL,
    name character varying(255) NOT NULL,
    uuid character varying(255) NOT NULL,
    network character varying(255) NOT NULL,
    server_id bigint NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: standalone_dockers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.standalone_dockers_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: standalone_dockers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.standalone_dockers_id_seq OWNED BY public.standalone_dockers.id;


--
-- Name: standalone_dragonflies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.standalone_dragonflies (
    id bigint NOT NULL,
    uuid character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    description character varying(255),
    dragonfly_password text NOT NULL,
    is_log_drain_enabled boolean DEFAULT false NOT NULL,
    is_include_timestamps boolean DEFAULT false NOT NULL,
    deleted_at timestamp(0) without time zone,
    status character varying(255) DEFAULT 'exited'::character varying NOT NULL,
    image character varying(255) DEFAULT 'docker.dragonflydb.io/dragonflydb/dragonfly'::character varying NOT NULL,
    is_public boolean DEFAULT false NOT NULL,
    public_port integer,
    ports_mappings text,
    limits_memory character varying(255) DEFAULT '0'::character varying NOT NULL,
    limits_memory_swap character varying(255) DEFAULT '0'::character varying NOT NULL,
    limits_memory_swappiness integer DEFAULT 60 NOT NULL,
    limits_memory_reservation character varying(255) DEFAULT '0'::character varying NOT NULL,
    limits_cpus character varying(255) DEFAULT '0'::character varying NOT NULL,
    limits_cpuset character varying(255),
    limits_cpu_shares integer DEFAULT 1024 NOT NULL,
    started_at timestamp(0) without time zone,
    destination_type character varying(255) NOT NULL,
    destination_id bigint NOT NULL,
    environment_id bigint,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    config_hash character varying(255),
    custom_docker_run_options text,
    last_online_at timestamp(0) without time zone DEFAULT '2026-01-18 00:46:49'::timestamp without time zone NOT NULL,
    enable_ssl boolean DEFAULT false NOT NULL,
    project_id bigint
);


--
-- Name: standalone_dragonflies_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.standalone_dragonflies_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: standalone_dragonflies_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.standalone_dragonflies_id_seq OWNED BY public.standalone_dragonflies.id;


--
-- Name: standalone_keydbs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.standalone_keydbs (
    id bigint NOT NULL,
    uuid character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    description character varying(255),
    keydb_password text NOT NULL,
    keydb_conf text,
    is_log_drain_enabled boolean DEFAULT false NOT NULL,
    is_include_timestamps boolean DEFAULT false NOT NULL,
    deleted_at timestamp(0) without time zone,
    status character varying(255) DEFAULT 'exited'::character varying NOT NULL,
    image character varying(255) DEFAULT 'eqalpha/keydb:latest'::character varying NOT NULL,
    is_public boolean DEFAULT false NOT NULL,
    public_port integer,
    ports_mappings text,
    limits_memory character varying(255) DEFAULT '0'::character varying NOT NULL,
    limits_memory_swap character varying(255) DEFAULT '0'::character varying NOT NULL,
    limits_memory_swappiness integer DEFAULT 60 NOT NULL,
    limits_memory_reservation character varying(255) DEFAULT '0'::character varying NOT NULL,
    limits_cpus character varying(255) DEFAULT '0'::character varying NOT NULL,
    limits_cpuset character varying(255),
    limits_cpu_shares integer DEFAULT 1024 NOT NULL,
    started_at timestamp(0) without time zone,
    destination_type character varying(255) NOT NULL,
    destination_id bigint NOT NULL,
    environment_id bigint,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    config_hash character varying(255),
    custom_docker_run_options text,
    last_online_at timestamp(0) without time zone DEFAULT '2026-01-18 00:46:49'::timestamp without time zone NOT NULL,
    enable_ssl boolean DEFAULT false NOT NULL,
    project_id bigint
);


--
-- Name: standalone_keydbs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.standalone_keydbs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: standalone_keydbs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.standalone_keydbs_id_seq OWNED BY public.standalone_keydbs.id;


--
-- Name: standalone_mariadbs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.standalone_mariadbs (
    id bigint NOT NULL,
    uuid character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    description character varying(255),
    mariadb_root_password text NOT NULL,
    mariadb_user character varying(255) DEFAULT 'mariadb'::character varying NOT NULL,
    mariadb_password text NOT NULL,
    mariadb_database character varying(255) DEFAULT 'default'::character varying NOT NULL,
    mariadb_conf text,
    status character varying(255) DEFAULT 'exited'::character varying NOT NULL,
    image character varying(255) DEFAULT 'mariadb:11'::character varying NOT NULL,
    is_public boolean DEFAULT false NOT NULL,
    public_port integer,
    ports_mappings text,
    limits_memory character varying(255) DEFAULT '0'::character varying NOT NULL,
    limits_memory_swap character varying(255) DEFAULT '0'::character varying NOT NULL,
    limits_memory_swappiness integer DEFAULT 60 NOT NULL,
    limits_memory_reservation character varying(255) DEFAULT '0'::character varying NOT NULL,
    limits_cpus character varying(255) DEFAULT '0'::character varying NOT NULL,
    limits_cpuset character varying(255),
    limits_cpu_shares integer DEFAULT 1024 NOT NULL,
    started_at timestamp(0) without time zone,
    destination_type character varying(255) NOT NULL,
    destination_id bigint NOT NULL,
    environment_id bigint,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    is_log_drain_enabled boolean DEFAULT false NOT NULL,
    deleted_at timestamp(0) without time zone,
    config_hash character varying(255),
    custom_docker_run_options text,
    last_online_at timestamp(0) without time zone DEFAULT '2026-01-18 00:46:49'::timestamp without time zone NOT NULL,
    enable_ssl boolean DEFAULT false NOT NULL,
    project_id bigint
);


--
-- Name: standalone_mariadbs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.standalone_mariadbs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: standalone_mariadbs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.standalone_mariadbs_id_seq OWNED BY public.standalone_mariadbs.id;


--
-- Name: standalone_mongodbs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.standalone_mongodbs (
    id bigint NOT NULL,
    uuid character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    description character varying(255),
    mongo_conf text,
    mongo_initdb_root_username text DEFAULT 'root'::text NOT NULL,
    mongo_initdb_root_password text NOT NULL,
    mongo_initdb_database text DEFAULT 'default'::text NOT NULL,
    status character varying(255) DEFAULT 'exited'::character varying NOT NULL,
    image character varying(255) DEFAULT 'mongo:7'::character varying NOT NULL,
    is_public boolean DEFAULT false NOT NULL,
    public_port integer,
    ports_mappings text,
    limits_memory character varying(255) DEFAULT '0'::character varying NOT NULL,
    limits_memory_swap character varying(255) DEFAULT '0'::character varying NOT NULL,
    limits_memory_swappiness integer DEFAULT 60 NOT NULL,
    limits_memory_reservation character varying(255) DEFAULT '0'::character varying NOT NULL,
    limits_cpus character varying(255) DEFAULT '0'::character varying NOT NULL,
    limits_cpuset character varying(255),
    limits_cpu_shares integer DEFAULT 1024 NOT NULL,
    started_at timestamp(0) without time zone,
    destination_type character varying(255) NOT NULL,
    destination_id bigint NOT NULL,
    environment_id bigint,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    is_log_drain_enabled boolean DEFAULT false NOT NULL,
    is_include_timestamps boolean DEFAULT false NOT NULL,
    deleted_at timestamp(0) without time zone,
    config_hash character varying(255),
    custom_docker_run_options text,
    last_online_at timestamp(0) without time zone DEFAULT '2026-01-18 00:46:49'::timestamp without time zone NOT NULL,
    enable_ssl boolean DEFAULT false NOT NULL,
    ssl_mode character varying(255) DEFAULT 'require'::character varying NOT NULL,
    project_id bigint,
    CONSTRAINT standalone_mongodbs_ssl_mode_check CHECK (((ssl_mode)::text = ANY ((ARRAY['allow'::character varying, 'prefer'::character varying, 'require'::character varying, 'verify-full'::character varying])::text[])))
);


--
-- Name: standalone_mongodbs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.standalone_mongodbs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: standalone_mongodbs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.standalone_mongodbs_id_seq OWNED BY public.standalone_mongodbs.id;


--
-- Name: standalone_mysqls; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.standalone_mysqls (
    id bigint NOT NULL,
    uuid character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    description character varying(255),
    mysql_root_password text NOT NULL,
    mysql_user character varying(255) DEFAULT 'mysql'::character varying NOT NULL,
    mysql_password text NOT NULL,
    mysql_database character varying(255) DEFAULT 'default'::character varying NOT NULL,
    mysql_conf text,
    status character varying(255) DEFAULT 'exited'::character varying NOT NULL,
    image character varying(255) DEFAULT 'mysql:8'::character varying NOT NULL,
    is_public boolean DEFAULT false NOT NULL,
    public_port integer,
    ports_mappings text,
    limits_memory character varying(255) DEFAULT '0'::character varying NOT NULL,
    limits_memory_swap character varying(255) DEFAULT '0'::character varying NOT NULL,
    limits_memory_swappiness integer DEFAULT 60 NOT NULL,
    limits_memory_reservation character varying(255) DEFAULT '0'::character varying NOT NULL,
    limits_cpus character varying(255) DEFAULT '0'::character varying NOT NULL,
    limits_cpuset character varying(255),
    limits_cpu_shares integer DEFAULT 1024 NOT NULL,
    started_at timestamp(0) without time zone,
    destination_type character varying(255) NOT NULL,
    destination_id bigint NOT NULL,
    environment_id bigint,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    is_log_drain_enabled boolean DEFAULT false NOT NULL,
    is_include_timestamps boolean DEFAULT false NOT NULL,
    deleted_at timestamp(0) without time zone,
    config_hash character varying(255),
    custom_docker_run_options text,
    last_online_at timestamp(0) without time zone DEFAULT '2026-01-18 00:46:49'::timestamp without time zone NOT NULL,
    enable_ssl boolean DEFAULT false NOT NULL,
    ssl_mode character varying(255) DEFAULT 'REQUIRED'::character varying NOT NULL,
    project_id bigint,
    CONSTRAINT standalone_mysqls_ssl_mode_check CHECK (((ssl_mode)::text = ANY ((ARRAY['PREFERRED'::character varying, 'REQUIRED'::character varying, 'VERIFY_CA'::character varying, 'VERIFY_IDENTITY'::character varying])::text[])))
);


--
-- Name: standalone_mysqls_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.standalone_mysqls_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: standalone_mysqls_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.standalone_mysqls_id_seq OWNED BY public.standalone_mysqls.id;


--
-- Name: standalone_postgresqls; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.standalone_postgresqls (
    id bigint NOT NULL,
    uuid character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    description character varying(255),
    postgres_user character varying(255) DEFAULT 'postgres'::character varying NOT NULL,
    postgres_password text NOT NULL,
    postgres_db character varying(255) DEFAULT 'postgres'::character varying NOT NULL,
    postgres_initdb_args character varying(255),
    postgres_host_auth_method character varying(255),
    init_scripts json,
    status character varying(255) DEFAULT 'exited'::character varying NOT NULL,
    image character varying(255) DEFAULT 'postgres:16-alpine'::character varying NOT NULL,
    is_public boolean DEFAULT false NOT NULL,
    public_port integer,
    ports_mappings text,
    limits_memory character varying(255) DEFAULT '0'::character varying NOT NULL,
    limits_memory_swap character varying(255) DEFAULT '0'::character varying NOT NULL,
    limits_memory_swappiness integer DEFAULT 60 NOT NULL,
    limits_memory_reservation character varying(255) DEFAULT '0'::character varying NOT NULL,
    limits_cpus character varying(255) DEFAULT '0'::character varying NOT NULL,
    limits_cpuset character varying(255),
    limits_cpu_shares integer DEFAULT 1024 NOT NULL,
    started_at timestamp(0) without time zone,
    destination_type character varying(255) NOT NULL,
    destination_id bigint NOT NULL,
    environment_id bigint,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    postgres_conf text,
    is_log_drain_enabled boolean DEFAULT false NOT NULL,
    is_include_timestamps boolean DEFAULT false NOT NULL,
    deleted_at timestamp(0) without time zone,
    config_hash character varying(255),
    custom_docker_run_options text,
    last_online_at timestamp(0) without time zone DEFAULT '2026-01-18 00:46:49'::timestamp without time zone NOT NULL,
    enable_ssl boolean DEFAULT false NOT NULL,
    ssl_mode character varying(255) DEFAULT 'require'::character varying NOT NULL,
    project_id bigint,
    CONSTRAINT standalone_postgresqls_ssl_mode_check CHECK (((ssl_mode)::text = ANY ((ARRAY['allow'::character varying, 'prefer'::character varying, 'require'::character varying, 'verify-ca'::character varying, 'verify-full'::character varying])::text[])))
);


--
-- Name: standalone_postgresqls_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.standalone_postgresqls_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: standalone_postgresqls_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.standalone_postgresqls_id_seq OWNED BY public.standalone_postgresqls.id;


--
-- Name: standalone_redis; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.standalone_redis (
    id bigint NOT NULL,
    uuid character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    description character varying(255),
    redis_conf text,
    status character varying(255) DEFAULT 'exited'::character varying NOT NULL,
    image character varying(255) DEFAULT 'redis:7.2'::character varying NOT NULL,
    is_public boolean DEFAULT false NOT NULL,
    public_port integer,
    ports_mappings text,
    limits_memory character varying(255) DEFAULT '0'::character varying NOT NULL,
    limits_memory_swap character varying(255) DEFAULT '0'::character varying NOT NULL,
    limits_memory_swappiness integer DEFAULT 60 NOT NULL,
    limits_memory_reservation character varying(255) DEFAULT '0'::character varying NOT NULL,
    limits_cpus character varying(255) DEFAULT '0'::character varying NOT NULL,
    limits_cpuset character varying(255),
    limits_cpu_shares integer DEFAULT 1024 NOT NULL,
    started_at timestamp(0) without time zone,
    destination_type character varying(255) NOT NULL,
    destination_id bigint NOT NULL,
    environment_id bigint,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    is_log_drain_enabled boolean DEFAULT false NOT NULL,
    is_include_timestamps boolean DEFAULT false NOT NULL,
    deleted_at timestamp(0) without time zone,
    config_hash character varying(255),
    custom_docker_run_options text,
    last_online_at timestamp(0) without time zone DEFAULT '2026-01-18 00:46:49'::timestamp without time zone NOT NULL,
    enable_ssl boolean DEFAULT false NOT NULL,
    project_id bigint
);


--
-- Name: standalone_redis_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.standalone_redis_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: standalone_redis_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.standalone_redis_id_seq OWNED BY public.standalone_redis.id;


--
-- Name: subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscriptions (
    id bigint NOT NULL,
    team_id bigint NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    stripe_invoice_paid boolean DEFAULT false NOT NULL,
    stripe_subscription_id character varying(255),
    stripe_customer_id character varying(255),
    stripe_cancel_at_period_end boolean DEFAULT false NOT NULL,
    stripe_plan_id character varying(255),
    stripe_feedback character varying(255),
    stripe_comment text,
    stripe_trial_already_ended boolean DEFAULT false NOT NULL,
    stripe_past_due boolean DEFAULT false NOT NULL
);


--
-- Name: subscriptions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.subscriptions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: subscriptions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.subscriptions_id_seq OWNED BY public.subscriptions.id;


--
-- Name: swarm_dockers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.swarm_dockers (
    id bigint NOT NULL,
    name character varying(255) NOT NULL,
    uuid character varying(255) NOT NULL,
    server_id bigint NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    network character varying(255) NOT NULL
);


--
-- Name: swarm_dockers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.swarm_dockers_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: swarm_dockers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.swarm_dockers_id_seq OWNED BY public.swarm_dockers.id;


--
-- Name: taggables; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.taggables (
    tag_id bigint NOT NULL,
    taggable_id bigint NOT NULL,
    taggable_type character varying(255) NOT NULL
);


--
-- Name: tags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tags (
    id bigint NOT NULL,
    uuid character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    team_id bigint,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: tags_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tags_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tags_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tags_id_seq OWNED BY public.tags.id;


--
-- Name: team_invitations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.team_invitations (
    id bigint NOT NULL,
    uuid character varying(255) NOT NULL,
    team_id bigint NOT NULL,
    email character varying(255) NOT NULL,
    role character varying(255) DEFAULT 'member'::character varying NOT NULL,
    link text NOT NULL,
    via character varying(255) DEFAULT 'link'::character varying NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: team_invitations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.team_invitations_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: team_invitations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.team_invitations_id_seq OWNED BY public.team_invitations.id;


--
-- Name: team_user; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.team_user (
    id bigint NOT NULL,
    team_id bigint NOT NULL,
    user_id bigint NOT NULL,
    role character varying(255) DEFAULT 'member'::character varying NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: team_user_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.team_user_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: team_user_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.team_user_id_seq OWNED BY public.team_user.id;


--
-- Name: teams; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.teams (
    id bigint NOT NULL,
    name character varying(255) NOT NULL,
    description character varying(255),
    personal_team boolean DEFAULT false NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    show_boarding boolean DEFAULT false NOT NULL,
    custom_server_limit integer,
    idem_subscription_plan character varying(255) DEFAULT 'free'::character varying NOT NULL,
    idem_app_limit integer DEFAULT 2 NOT NULL,
    idem_server_limit integer DEFAULT 0 NOT NULL,
    idem_apps_count integer DEFAULT 0 NOT NULL,
    idem_servers_count integer DEFAULT 0 NOT NULL,
    idem_subscription_started_at timestamp(0) without time zone,
    idem_subscription_expires_at timestamp(0) without time zone,
    stripe_customer_id character varying(255),
    stripe_subscription_id character varying(255),
    idem_credits integer DEFAULT 0 NOT NULL,
    CONSTRAINT teams_idem_subscription_plan_check CHECK (((idem_subscription_plan)::text = ANY ((ARRAY['free'::character varying, 'basic'::character varying, 'pro'::character varying, 'enterprise'::character varying])::text[])))
);


--
-- Name: teams_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.teams_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: teams_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.teams_id_seq OWNED BY public.teams.id;


--
-- Name: telegram_notification_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.telegram_notification_settings (
    id bigint NOT NULL,
    team_id bigint NOT NULL,
    telegram_enabled boolean DEFAULT false NOT NULL,
    telegram_token text,
    telegram_chat_id text,
    deployment_success_telegram_notifications boolean DEFAULT false NOT NULL,
    deployment_failure_telegram_notifications boolean DEFAULT true NOT NULL,
    status_change_telegram_notifications boolean DEFAULT false NOT NULL,
    backup_success_telegram_notifications boolean DEFAULT false NOT NULL,
    backup_failure_telegram_notifications boolean DEFAULT true NOT NULL,
    scheduled_task_success_telegram_notifications boolean DEFAULT false NOT NULL,
    scheduled_task_failure_telegram_notifications boolean DEFAULT true NOT NULL,
    docker_cleanup_success_telegram_notifications boolean DEFAULT false NOT NULL,
    docker_cleanup_failure_telegram_notifications boolean DEFAULT true NOT NULL,
    server_disk_usage_telegram_notifications boolean DEFAULT true NOT NULL,
    server_reachable_telegram_notifications boolean DEFAULT false NOT NULL,
    server_unreachable_telegram_notifications boolean DEFAULT true NOT NULL,
    telegram_notifications_deployment_success_thread_id text,
    telegram_notifications_deployment_failure_thread_id text,
    telegram_notifications_status_change_thread_id text,
    telegram_notifications_backup_success_thread_id text,
    telegram_notifications_backup_failure_thread_id text,
    telegram_notifications_scheduled_task_success_thread_id text,
    telegram_notifications_scheduled_task_failure_thread_id text,
    telegram_notifications_docker_cleanup_success_thread_id text,
    telegram_notifications_docker_cleanup_failure_thread_id text,
    telegram_notifications_server_disk_usage_thread_id text,
    telegram_notifications_server_reachable_thread_id text,
    telegram_notifications_server_unreachable_thread_id text,
    server_patch_telegram_notifications boolean DEFAULT true NOT NULL,
    telegram_notifications_server_patch_thread_id character varying(255)
);


--
-- Name: telegram_notification_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.telegram_notification_settings_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: telegram_notification_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.telegram_notification_settings_id_seq OWNED BY public.telegram_notification_settings.id;


--
-- Name: telescope_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.telescope_entries (
    sequence bigint NOT NULL,
    uuid uuid NOT NULL,
    batch_id uuid NOT NULL,
    family_hash character varying(255),
    should_display_on_index boolean DEFAULT true NOT NULL,
    type character varying(20) NOT NULL,
    content text NOT NULL,
    created_at timestamp(0) without time zone
);


--
-- Name: telescope_entries_sequence_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.telescope_entries_sequence_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: telescope_entries_sequence_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.telescope_entries_sequence_seq OWNED BY public.telescope_entries.sequence;


--
-- Name: telescope_entries_tags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.telescope_entries_tags (
    entry_uuid uuid NOT NULL,
    tag character varying(255) NOT NULL
);


--
-- Name: telescope_monitoring; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.telescope_monitoring (
    tag character varying(255) NOT NULL
);


--
-- Name: user_changelog_reads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_changelog_reads (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    release_tag character varying(255) NOT NULL,
    read_at timestamp(0) without time zone NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: user_changelog_reads_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_changelog_reads_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: user_changelog_reads_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_changelog_reads_id_seq OWNED BY public.user_changelog_reads.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id bigint NOT NULL,
    name character varying(255) DEFAULT 'Anonymous'::character varying NOT NULL,
    email character varying(255) NOT NULL,
    email_verified_at timestamp(0) without time zone,
    password character varying(255),
    remember_token character varying(100),
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    two_factor_secret text,
    two_factor_recovery_codes text,
    two_factor_confirmed_at timestamp(0) without time zone,
    force_password_reset boolean DEFAULT false NOT NULL,
    marketing_emails boolean DEFAULT true NOT NULL,
    pending_email character varying(255),
    email_change_code character varying(6),
    email_change_code_expires_at timestamp(0) without time zone,
    idem_role character varying(255) DEFAULT 'member'::character varying NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    idem_uid character varying(255),
    photo_url character varying(255),
    CONSTRAINT users_idem_role_check CHECK (((idem_role)::text = ANY ((ARRAY['admin'::character varying, 'member'::character varying])::text[])))
);


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: webhook_notification_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.webhook_notification_settings (
    id bigint NOT NULL,
    team_id bigint NOT NULL,
    webhook_enabled boolean DEFAULT false NOT NULL,
    webhook_url text,
    deployment_success_webhook_notifications boolean DEFAULT false NOT NULL,
    deployment_failure_webhook_notifications boolean DEFAULT true NOT NULL,
    status_change_webhook_notifications boolean DEFAULT false NOT NULL,
    backup_success_webhook_notifications boolean DEFAULT false NOT NULL,
    backup_failure_webhook_notifications boolean DEFAULT true NOT NULL,
    scheduled_task_success_webhook_notifications boolean DEFAULT false NOT NULL,
    scheduled_task_failure_webhook_notifications boolean DEFAULT true NOT NULL,
    docker_cleanup_success_webhook_notifications boolean DEFAULT false NOT NULL,
    docker_cleanup_failure_webhook_notifications boolean DEFAULT true NOT NULL,
    server_disk_usage_webhook_notifications boolean DEFAULT true NOT NULL,
    server_reachable_webhook_notifications boolean DEFAULT false NOT NULL,
    server_unreachable_webhook_notifications boolean DEFAULT true NOT NULL,
    server_patch_webhook_notifications boolean DEFAULT false NOT NULL
);


--
-- Name: webhook_notification_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.webhook_notification_settings_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: webhook_notification_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.webhook_notification_settings_id_seq OWNED BY public.webhook_notification_settings.id;


--
-- Name: workspace_projects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workspace_projects (
    id bigint NOT NULL,
    uuid uuid NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    environment_id bigint NOT NULL,
    team_id bigint NOT NULL,
    created_at timestamp(0) without time zone DEFAULT now() NOT NULL,
    updated_at timestamp(0) without time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE workspace_projects; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.workspace_projects IS 'A named grouping of deployable resources within one workspace environment — "frontend", "backend", "database" — sitting between Environment and the resource tables.';


--
-- Name: workspace_projects_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.workspace_projects_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: workspace_projects_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.workspace_projects_id_seq OWNED BY public.workspace_projects.id;


--
-- Name: activity_log id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_log ALTER COLUMN id SET DEFAULT nextval('public.activity_log_id_seq'::regclass);


--
-- Name: additional_destinations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.additional_destinations ALTER COLUMN id SET DEFAULT nextval('public.additional_destinations_id_seq'::regclass);


--
-- Name: analytics_configs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analytics_configs ALTER COLUMN id SET DEFAULT nextval('public.analytics_configs_id_seq'::regclass);


--
-- Name: application_deployment_queues id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.application_deployment_queues ALTER COLUMN id SET DEFAULT nextval('public.application_deployment_queues_id_seq'::regclass);


--
-- Name: application_previews id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.application_previews ALTER COLUMN id SET DEFAULT nextval('public.application_previews_id_seq'::regclass);


--
-- Name: application_settings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.application_settings ALTER COLUMN id SET DEFAULT nextval('public.application_settings_id_seq'::regclass);


--
-- Name: applications id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.applications ALTER COLUMN id SET DEFAULT nextval('public.applications_id_seq'::regclass);


--
-- Name: cloud_init_scripts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cloud_init_scripts ALTER COLUMN id SET DEFAULT nextval('public.cloud_init_scripts_id_seq'::regclass);


--
-- Name: cloud_provider_tokens id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cloud_provider_tokens ALTER COLUMN id SET DEFAULT nextval('public.cloud_provider_tokens_id_seq'::regclass);


--
-- Name: discord_notification_settings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discord_notification_settings ALTER COLUMN id SET DEFAULT nextval('public.discord_notification_settings_id_seq'::regclass);


--
-- Name: docker_cleanup_executions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.docker_cleanup_executions ALTER COLUMN id SET DEFAULT nextval('public.docker_cleanup_executions_id_seq'::regclass);


--
-- Name: email_notification_settings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_notification_settings ALTER COLUMN id SET DEFAULT nextval('public.email_notification_settings_id_seq'::regclass);


--
-- Name: environment_variables id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.environment_variables ALTER COLUMN id SET DEFAULT nextval('public.environment_variables_id_seq'::regclass);


--
-- Name: environments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.environments ALTER COLUMN id SET DEFAULT nextval('public.environments_id_seq'::regclass);


--
-- Name: failed_jobs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.failed_jobs ALTER COLUMN id SET DEFAULT nextval('public.failed_jobs_id_seq'::regclass);


--
-- Name: firewall_alerts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.firewall_alerts ALTER COLUMN id SET DEFAULT nextval('public.firewall_alerts_id_seq'::regclass);


--
-- Name: firewall_configs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.firewall_configs ALTER COLUMN id SET DEFAULT nextval('public.firewall_configs_id_seq'::regclass);


--
-- Name: firewall_rules id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.firewall_rules ALTER COLUMN id SET DEFAULT nextval('public.firewall_rules_id_seq'::regclass);


--
-- Name: firewall_traffic_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.firewall_traffic_logs ALTER COLUMN id SET DEFAULT nextval('public.firewall_traffic_logs_id_seq'::regclass);


--
-- Name: github_apps id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.github_apps ALTER COLUMN id SET DEFAULT nextval('public.github_apps_id_seq'::regclass);


--
-- Name: gitlab_apps id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gitlab_apps ALTER COLUMN id SET DEFAULT nextval('public.gitlab_apps_id_seq'::regclass);


--
-- Name: idem_quotas id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.idem_quotas ALTER COLUMN id SET DEFAULT nextval('public.idem_quotas_id_seq'::regclass);


--
-- Name: idem_subscription_plans id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.idem_subscription_plans ALTER COLUMN id SET DEFAULT nextval('public.idem_subscription_plans_id_seq'::regclass);


--
-- Name: instance_settings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.instance_settings ALTER COLUMN id SET DEFAULT nextval('public.instance_settings_id_seq'::regclass);


--
-- Name: local_file_volumes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.local_file_volumes ALTER COLUMN id SET DEFAULT nextval('public.local_file_volumes_id_seq'::regclass);


--
-- Name: local_persistent_volumes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.local_persistent_volumes ALTER COLUMN id SET DEFAULT nextval('public.local_persistent_volumes_id_seq'::regclass);


--
-- Name: migrations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.migrations ALTER COLUMN id SET DEFAULT nextval('public.migrations_id_seq'::regclass);


--
-- Name: oauth_settings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.oauth_settings ALTER COLUMN id SET DEFAULT nextval('public.oauth_settings_id_seq'::regclass);


--
-- Name: personal_access_tokens id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personal_access_tokens ALTER COLUMN id SET DEFAULT nextval('public.personal_access_tokens_id_seq'::regclass);


--
-- Name: pgmigrations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pgmigrations ALTER COLUMN id SET DEFAULT nextval('public.pgmigrations_id_seq'::regclass);


--
-- Name: pipeline_configs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pipeline_configs ALTER COLUMN id SET DEFAULT nextval('public.pipeline_configs_id_seq'::regclass);


--
-- Name: pipeline_executions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pipeline_executions ALTER COLUMN id SET DEFAULT nextval('public.pipeline_executions_id_seq'::regclass);


--
-- Name: pipeline_jobs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pipeline_jobs ALTER COLUMN id SET DEFAULT nextval('public.pipeline_jobs_id_seq'::regclass);


--
-- Name: pipeline_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pipeline_logs ALTER COLUMN id SET DEFAULT nextval('public.pipeline_logs_id_seq'::regclass);


--
-- Name: pipeline_notifications id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pipeline_notifications ALTER COLUMN id SET DEFAULT nextval('public.pipeline_notifications_id_seq'::regclass);


--
-- Name: pipeline_scan_results id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pipeline_scan_results ALTER COLUMN id SET DEFAULT nextval('public.pipeline_scan_results_id_seq'::regclass);


--
-- Name: pipeline_tool_configs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pipeline_tool_configs ALTER COLUMN id SET DEFAULT nextval('public.pipeline_tool_configs_id_seq'::regclass);


--
-- Name: private_keys id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.private_keys ALTER COLUMN id SET DEFAULT nextval('public.private_keys_id_seq'::regclass);


--
-- Name: project_settings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_settings ALTER COLUMN id SET DEFAULT nextval('public.project_settings_id_seq'::regclass);


--
-- Name: projects id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects ALTER COLUMN id SET DEFAULT nextval('public.projects_id_seq'::regclass);


--
-- Name: pushover_notification_settings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pushover_notification_settings ALTER COLUMN id SET DEFAULT nextval('public.pushover_notification_settings_id_seq'::regclass);


--
-- Name: s3_storages id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.s3_storages ALTER COLUMN id SET DEFAULT nextval('public.s3_storages_id_seq'::regclass);


--
-- Name: scheduled_database_backup_executions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduled_database_backup_executions ALTER COLUMN id SET DEFAULT nextval('public.scheduled_database_backup_executions_id_seq'::regclass);


--
-- Name: scheduled_database_backups id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduled_database_backups ALTER COLUMN id SET DEFAULT nextval('public.scheduled_database_backups_id_seq'::regclass);


--
-- Name: scheduled_task_executions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduled_task_executions ALTER COLUMN id SET DEFAULT nextval('public.scheduled_task_executions_id_seq'::regclass);


--
-- Name: scheduled_tasks id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduled_tasks ALTER COLUMN id SET DEFAULT nextval('public.scheduled_tasks_id_seq'::regclass);


--
-- Name: server_settings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.server_settings ALTER COLUMN id SET DEFAULT nextval('public.server_settings_id_seq'::regclass);


--
-- Name: servers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.servers ALTER COLUMN id SET DEFAULT nextval('public.servers_id_seq'::regclass);


--
-- Name: service_applications id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_applications ALTER COLUMN id SET DEFAULT nextval('public.service_applications_id_seq'::regclass);


--
-- Name: service_databases id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_databases ALTER COLUMN id SET DEFAULT nextval('public.service_databases_id_seq'::regclass);


--
-- Name: services id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services ALTER COLUMN id SET DEFAULT nextval('public.services_id_seq'::regclass);


--
-- Name: shared_environment_variables id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shared_environment_variables ALTER COLUMN id SET DEFAULT nextval('public.shared_environment_variables_id_seq'::regclass);


--
-- Name: slack_notification_settings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.slack_notification_settings ALTER COLUMN id SET DEFAULT nextval('public.slack_notification_settings_id_seq'::regclass);


--
-- Name: ssl_certificates id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ssl_certificates ALTER COLUMN id SET DEFAULT nextval('public.ssl_certificates_id_seq'::regclass);


--
-- Name: standalone_clickhouses id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.standalone_clickhouses ALTER COLUMN id SET DEFAULT nextval('public.standalone_clickhouses_id_seq'::regclass);


--
-- Name: standalone_dockers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.standalone_dockers ALTER COLUMN id SET DEFAULT nextval('public.standalone_dockers_id_seq'::regclass);


--
-- Name: standalone_dragonflies id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.standalone_dragonflies ALTER COLUMN id SET DEFAULT nextval('public.standalone_dragonflies_id_seq'::regclass);


--
-- Name: standalone_keydbs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.standalone_keydbs ALTER COLUMN id SET DEFAULT nextval('public.standalone_keydbs_id_seq'::regclass);


--
-- Name: standalone_mariadbs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.standalone_mariadbs ALTER COLUMN id SET DEFAULT nextval('public.standalone_mariadbs_id_seq'::regclass);


--
-- Name: standalone_mongodbs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.standalone_mongodbs ALTER COLUMN id SET DEFAULT nextval('public.standalone_mongodbs_id_seq'::regclass);


--
-- Name: standalone_mysqls id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.standalone_mysqls ALTER COLUMN id SET DEFAULT nextval('public.standalone_mysqls_id_seq'::regclass);


--
-- Name: standalone_postgresqls id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.standalone_postgresqls ALTER COLUMN id SET DEFAULT nextval('public.standalone_postgresqls_id_seq'::regclass);


--
-- Name: standalone_redis id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.standalone_redis ALTER COLUMN id SET DEFAULT nextval('public.standalone_redis_id_seq'::regclass);


--
-- Name: subscriptions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions ALTER COLUMN id SET DEFAULT nextval('public.subscriptions_id_seq'::regclass);


--
-- Name: swarm_dockers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.swarm_dockers ALTER COLUMN id SET DEFAULT nextval('public.swarm_dockers_id_seq'::regclass);


--
-- Name: tags id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tags ALTER COLUMN id SET DEFAULT nextval('public.tags_id_seq'::regclass);


--
-- Name: team_invitations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_invitations ALTER COLUMN id SET DEFAULT nextval('public.team_invitations_id_seq'::regclass);


--
-- Name: team_user id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_user ALTER COLUMN id SET DEFAULT nextval('public.team_user_id_seq'::regclass);


--
-- Name: teams id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teams ALTER COLUMN id SET DEFAULT nextval('public.teams_id_seq'::regclass);


--
-- Name: telegram_notification_settings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.telegram_notification_settings ALTER COLUMN id SET DEFAULT nextval('public.telegram_notification_settings_id_seq'::regclass);


--
-- Name: telescope_entries sequence; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.telescope_entries ALTER COLUMN sequence SET DEFAULT nextval('public.telescope_entries_sequence_seq'::regclass);


--
-- Name: user_changelog_reads id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_changelog_reads ALTER COLUMN id SET DEFAULT nextval('public.user_changelog_reads_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: webhook_notification_settings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhook_notification_settings ALTER COLUMN id SET DEFAULT nextval('public.webhook_notification_settings_id_seq'::regclass);


--
-- Name: workspace_projects id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_projects ALTER COLUMN id SET DEFAULT nextval('public.workspace_projects_id_seq'::regclass);


--
-- Name: activity_log activity_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_log
    ADD CONSTRAINT activity_log_pkey PRIMARY KEY (id);


--
-- Name: additional_destinations additional_destinations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.additional_destinations
    ADD CONSTRAINT additional_destinations_pkey PRIMARY KEY (id);


--
-- Name: analytics_configs analytics_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analytics_configs
    ADD CONSTRAINT analytics_configs_pkey PRIMARY KEY (id);


--
-- Name: application_deployment_queues application_deployment_queues_deployment_uuid_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.application_deployment_queues
    ADD CONSTRAINT application_deployment_queues_deployment_uuid_unique UNIQUE (deployment_uuid);


--
-- Name: application_deployment_queues application_deployment_queues_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.application_deployment_queues
    ADD CONSTRAINT application_deployment_queues_pkey PRIMARY KEY (id);


--
-- Name: application_previews application_previews_fqdn_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.application_previews
    ADD CONSTRAINT application_previews_fqdn_unique UNIQUE (fqdn);


--
-- Name: application_previews application_previews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.application_previews
    ADD CONSTRAINT application_previews_pkey PRIMARY KEY (id);


--
-- Name: application_previews application_previews_uuid_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.application_previews
    ADD CONSTRAINT application_previews_uuid_unique UNIQUE (uuid);


--
-- Name: application_settings application_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.application_settings
    ADD CONSTRAINT application_settings_pkey PRIMARY KEY (id);


--
-- Name: applications applications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.applications
    ADD CONSTRAINT applications_pkey PRIMARY KEY (id);


--
-- Name: applications applications_uuid_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.applications
    ADD CONSTRAINT applications_uuid_unique UNIQUE (uuid);


--
-- Name: cloud_init_scripts cloud_init_scripts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cloud_init_scripts
    ADD CONSTRAINT cloud_init_scripts_pkey PRIMARY KEY (id);


--
-- Name: cloud_provider_tokens cloud_provider_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cloud_provider_tokens
    ADD CONSTRAINT cloud_provider_tokens_pkey PRIMARY KEY (id);


--
-- Name: discord_notification_settings discord_notification_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discord_notification_settings
    ADD CONSTRAINT discord_notification_settings_pkey PRIMARY KEY (id);


--
-- Name: discord_notification_settings discord_notification_settings_team_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discord_notification_settings
    ADD CONSTRAINT discord_notification_settings_team_id_unique UNIQUE (team_id);


--
-- Name: docker_cleanup_executions docker_cleanup_executions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.docker_cleanup_executions
    ADD CONSTRAINT docker_cleanup_executions_pkey PRIMARY KEY (id);


--
-- Name: docker_cleanup_executions docker_cleanup_executions_uuid_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.docker_cleanup_executions
    ADD CONSTRAINT docker_cleanup_executions_uuid_unique UNIQUE (uuid);


--
-- Name: email_notification_settings email_notification_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_notification_settings
    ADD CONSTRAINT email_notification_settings_pkey PRIMARY KEY (id);


--
-- Name: email_notification_settings email_notification_settings_team_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_notification_settings
    ADD CONSTRAINT email_notification_settings_team_id_unique UNIQUE (team_id);


--
-- Name: environment_variables environment_variables_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.environment_variables
    ADD CONSTRAINT environment_variables_pkey PRIMARY KEY (id);


--
-- Name: environments environments_name_project_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.environments
    ADD CONSTRAINT environments_name_project_id_unique UNIQUE (name, project_id);


--
-- Name: environments environments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.environments
    ADD CONSTRAINT environments_pkey PRIMARY KEY (id);


--
-- Name: environments environments_uuid_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.environments
    ADD CONSTRAINT environments_uuid_unique UNIQUE (uuid);


--
-- Name: failed_jobs failed_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.failed_jobs
    ADD CONSTRAINT failed_jobs_pkey PRIMARY KEY (id);


--
-- Name: failed_jobs failed_jobs_uuid_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.failed_jobs
    ADD CONSTRAINT failed_jobs_uuid_unique UNIQUE (uuid);


--
-- Name: firewall_alerts firewall_alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.firewall_alerts
    ADD CONSTRAINT firewall_alerts_pkey PRIMARY KEY (id);


--
-- Name: firewall_configs firewall_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.firewall_configs
    ADD CONSTRAINT firewall_configs_pkey PRIMARY KEY (id);


--
-- Name: firewall_rules firewall_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.firewall_rules
    ADD CONSTRAINT firewall_rules_pkey PRIMARY KEY (id);


--
-- Name: firewall_traffic_logs firewall_traffic_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.firewall_traffic_logs
    ADD CONSTRAINT firewall_traffic_logs_pkey PRIMARY KEY (id);


--
-- Name: github_apps github_apps_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.github_apps
    ADD CONSTRAINT github_apps_pkey PRIMARY KEY (id);


--
-- Name: github_apps github_apps_uuid_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.github_apps
    ADD CONSTRAINT github_apps_uuid_unique UNIQUE (uuid);


--
-- Name: gitlab_apps gitlab_apps_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gitlab_apps
    ADD CONSTRAINT gitlab_apps_pkey PRIMARY KEY (id);


--
-- Name: gitlab_apps gitlab_apps_uuid_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gitlab_apps
    ADD CONSTRAINT gitlab_apps_uuid_unique UNIQUE (uuid);


--
-- Name: idem_quotas idem_quotas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.idem_quotas
    ADD CONSTRAINT idem_quotas_pkey PRIMARY KEY (id);


--
-- Name: idem_subscription_plans idem_subscription_plans_name_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.idem_subscription_plans
    ADD CONSTRAINT idem_subscription_plans_name_unique UNIQUE (name);


--
-- Name: idem_subscription_plans idem_subscription_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.idem_subscription_plans
    ADD CONSTRAINT idem_subscription_plans_pkey PRIMARY KEY (id);


--
-- Name: instance_settings instance_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.instance_settings
    ADD CONSTRAINT instance_settings_pkey PRIMARY KEY (id);


--
-- Name: local_file_volumes local_file_volumes_mount_path_resource_id_resource_type_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.local_file_volumes
    ADD CONSTRAINT local_file_volumes_mount_path_resource_id_resource_type_unique UNIQUE (mount_path, resource_id, resource_type);


--
-- Name: local_file_volumes local_file_volumes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.local_file_volumes
    ADD CONSTRAINT local_file_volumes_pkey PRIMARY KEY (id);


--
-- Name: local_persistent_volumes local_persistent_volumes_name_resource_id_resource_type_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.local_persistent_volumes
    ADD CONSTRAINT local_persistent_volumes_name_resource_id_resource_type_unique UNIQUE (name, resource_id, resource_type);


--
-- Name: local_persistent_volumes local_persistent_volumes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.local_persistent_volumes
    ADD CONSTRAINT local_persistent_volumes_pkey PRIMARY KEY (id);


--
-- Name: migrations migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.migrations
    ADD CONSTRAINT migrations_pkey PRIMARY KEY (id);


--
-- Name: oauth_settings oauth_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.oauth_settings
    ADD CONSTRAINT oauth_settings_pkey PRIMARY KEY (id);


--
-- Name: oauth_settings oauth_settings_provider_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.oauth_settings
    ADD CONSTRAINT oauth_settings_provider_unique UNIQUE (provider);


--
-- Name: password_reset_tokens password_reset_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (email);


--
-- Name: personal_access_tokens personal_access_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personal_access_tokens
    ADD CONSTRAINT personal_access_tokens_pkey PRIMARY KEY (id);


--
-- Name: personal_access_tokens personal_access_tokens_token_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personal_access_tokens
    ADD CONSTRAINT personal_access_tokens_token_unique UNIQUE (token);


--
-- Name: pgmigrations pgmigrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pgmigrations
    ADD CONSTRAINT pgmigrations_pkey PRIMARY KEY (id);


--
-- Name: pipeline_configs pipeline_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pipeline_configs
    ADD CONSTRAINT pipeline_configs_pkey PRIMARY KEY (id);


--
-- Name: pipeline_executions pipeline_executions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pipeline_executions
    ADD CONSTRAINT pipeline_executions_pkey PRIMARY KEY (id);


--
-- Name: pipeline_executions pipeline_executions_uuid_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pipeline_executions
    ADD CONSTRAINT pipeline_executions_uuid_unique UNIQUE (uuid);


--
-- Name: pipeline_jobs pipeline_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pipeline_jobs
    ADD CONSTRAINT pipeline_jobs_pkey PRIMARY KEY (id);


--
-- Name: pipeline_jobs pipeline_jobs_uuid_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pipeline_jobs
    ADD CONSTRAINT pipeline_jobs_uuid_unique UNIQUE (uuid);


--
-- Name: pipeline_logs pipeline_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pipeline_logs
    ADD CONSTRAINT pipeline_logs_pkey PRIMARY KEY (id);


--
-- Name: pipeline_notifications pipeline_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pipeline_notifications
    ADD CONSTRAINT pipeline_notifications_pkey PRIMARY KEY (id);


--
-- Name: pipeline_scan_results pipeline_scan_results_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pipeline_scan_results
    ADD CONSTRAINT pipeline_scan_results_pkey PRIMARY KEY (id);


--
-- Name: pipeline_scan_results pipeline_scan_results_uuid_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pipeline_scan_results
    ADD CONSTRAINT pipeline_scan_results_uuid_unique UNIQUE (uuid);


--
-- Name: pipeline_tool_configs pipeline_tool_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pipeline_tool_configs
    ADD CONSTRAINT pipeline_tool_configs_pkey PRIMARY KEY (id);


--
-- Name: pipeline_tool_configs pipeline_tool_configs_tool_name_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pipeline_tool_configs
    ADD CONSTRAINT pipeline_tool_configs_tool_name_unique UNIQUE (tool_name);


--
-- Name: private_keys private_keys_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.private_keys
    ADD CONSTRAINT private_keys_pkey PRIMARY KEY (id);


--
-- Name: private_keys private_keys_uuid_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.private_keys
    ADD CONSTRAINT private_keys_uuid_unique UNIQUE (uuid);


--
-- Name: project_settings project_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_settings
    ADD CONSTRAINT project_settings_pkey PRIMARY KEY (id);


--
-- Name: projects projects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (id);


--
-- Name: projects projects_uuid_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_uuid_unique UNIQUE (uuid);


--
-- Name: pushover_notification_settings pushover_notification_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pushover_notification_settings
    ADD CONSTRAINT pushover_notification_settings_pkey PRIMARY KEY (id);


--
-- Name: pushover_notification_settings pushover_notification_settings_team_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pushover_notification_settings
    ADD CONSTRAINT pushover_notification_settings_team_id_unique UNIQUE (team_id);


--
-- Name: s3_storages s3_storages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.s3_storages
    ADD CONSTRAINT s3_storages_pkey PRIMARY KEY (id);


--
-- Name: s3_storages s3_storages_uuid_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.s3_storages
    ADD CONSTRAINT s3_storages_uuid_unique UNIQUE (uuid);


--
-- Name: scheduled_database_backup_executions scheduled_database_backup_executions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduled_database_backup_executions
    ADD CONSTRAINT scheduled_database_backup_executions_pkey PRIMARY KEY (id);


--
-- Name: scheduled_database_backup_executions scheduled_database_backup_executions_uuid_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduled_database_backup_executions
    ADD CONSTRAINT scheduled_database_backup_executions_uuid_unique UNIQUE (uuid);


--
-- Name: scheduled_database_backups scheduled_database_backups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduled_database_backups
    ADD CONSTRAINT scheduled_database_backups_pkey PRIMARY KEY (id);


--
-- Name: scheduled_database_backups scheduled_database_backups_uuid_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduled_database_backups
    ADD CONSTRAINT scheduled_database_backups_uuid_unique UNIQUE (uuid);


--
-- Name: scheduled_task_executions scheduled_task_executions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduled_task_executions
    ADD CONSTRAINT scheduled_task_executions_pkey PRIMARY KEY (id);


--
-- Name: scheduled_task_executions scheduled_task_executions_uuid_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduled_task_executions
    ADD CONSTRAINT scheduled_task_executions_uuid_unique UNIQUE (uuid);


--
-- Name: scheduled_tasks scheduled_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduled_tasks
    ADD CONSTRAINT scheduled_tasks_pkey PRIMARY KEY (id);


--
-- Name: scheduled_tasks scheduled_tasks_uuid_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduled_tasks
    ADD CONSTRAINT scheduled_tasks_uuid_unique UNIQUE (uuid);


--
-- Name: server_settings server_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.server_settings
    ADD CONSTRAINT server_settings_pkey PRIMARY KEY (id);


--
-- Name: servers servers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.servers
    ADD CONSTRAINT servers_pkey PRIMARY KEY (id);


--
-- Name: servers servers_uuid_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.servers
    ADD CONSTRAINT servers_uuid_unique UNIQUE (uuid);


--
-- Name: service_applications service_applications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_applications
    ADD CONSTRAINT service_applications_pkey PRIMARY KEY (id);


--
-- Name: service_applications service_applications_uuid_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_applications
    ADD CONSTRAINT service_applications_uuid_unique UNIQUE (uuid);


--
-- Name: service_databases service_databases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_databases
    ADD CONSTRAINT service_databases_pkey PRIMARY KEY (id);


--
-- Name: service_databases service_databases_uuid_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_databases
    ADD CONSTRAINT service_databases_uuid_unique UNIQUE (uuid);


--
-- Name: services services_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_pkey PRIMARY KEY (id);


--
-- Name: services services_uuid_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_uuid_unique UNIQUE (uuid);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: shared_environment_variables shared_environment_variables_key_environment_id_team_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shared_environment_variables
    ADD CONSTRAINT shared_environment_variables_key_environment_id_team_id_unique UNIQUE (key, environment_id, team_id);


--
-- Name: shared_environment_variables shared_environment_variables_key_project_id_team_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shared_environment_variables
    ADD CONSTRAINT shared_environment_variables_key_project_id_team_id_unique UNIQUE (key, project_id, team_id);


--
-- Name: shared_environment_variables shared_environment_variables_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shared_environment_variables
    ADD CONSTRAINT shared_environment_variables_pkey PRIMARY KEY (id);


--
-- Name: slack_notification_settings slack_notification_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.slack_notification_settings
    ADD CONSTRAINT slack_notification_settings_pkey PRIMARY KEY (id);


--
-- Name: slack_notification_settings slack_notification_settings_team_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.slack_notification_settings
    ADD CONSTRAINT slack_notification_settings_team_id_unique UNIQUE (team_id);


--
-- Name: ssl_certificates ssl_certificates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ssl_certificates
    ADD CONSTRAINT ssl_certificates_pkey PRIMARY KEY (id);


--
-- Name: standalone_clickhouses standalone_clickhouses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.standalone_clickhouses
    ADD CONSTRAINT standalone_clickhouses_pkey PRIMARY KEY (id);


--
-- Name: standalone_clickhouses standalone_clickhouses_uuid_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.standalone_clickhouses
    ADD CONSTRAINT standalone_clickhouses_uuid_unique UNIQUE (uuid);


--
-- Name: standalone_dockers standalone_dockers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.standalone_dockers
    ADD CONSTRAINT standalone_dockers_pkey PRIMARY KEY (id);


--
-- Name: standalone_dockers standalone_dockers_server_id_network_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.standalone_dockers
    ADD CONSTRAINT standalone_dockers_server_id_network_unique UNIQUE (server_id, network);


--
-- Name: standalone_dockers standalone_dockers_uuid_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.standalone_dockers
    ADD CONSTRAINT standalone_dockers_uuid_unique UNIQUE (uuid);


--
-- Name: standalone_dragonflies standalone_dragonflies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.standalone_dragonflies
    ADD CONSTRAINT standalone_dragonflies_pkey PRIMARY KEY (id);


--
-- Name: standalone_dragonflies standalone_dragonflies_uuid_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.standalone_dragonflies
    ADD CONSTRAINT standalone_dragonflies_uuid_unique UNIQUE (uuid);


--
-- Name: standalone_keydbs standalone_keydbs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.standalone_keydbs
    ADD CONSTRAINT standalone_keydbs_pkey PRIMARY KEY (id);


--
-- Name: standalone_keydbs standalone_keydbs_uuid_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.standalone_keydbs
    ADD CONSTRAINT standalone_keydbs_uuid_unique UNIQUE (uuid);


--
-- Name: standalone_mariadbs standalone_mariadbs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.standalone_mariadbs
    ADD CONSTRAINT standalone_mariadbs_pkey PRIMARY KEY (id);


--
-- Name: standalone_mariadbs standalone_mariadbs_uuid_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.standalone_mariadbs
    ADD CONSTRAINT standalone_mariadbs_uuid_unique UNIQUE (uuid);


--
-- Name: standalone_mongodbs standalone_mongodbs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.standalone_mongodbs
    ADD CONSTRAINT standalone_mongodbs_pkey PRIMARY KEY (id);


--
-- Name: standalone_mongodbs standalone_mongodbs_uuid_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.standalone_mongodbs
    ADD CONSTRAINT standalone_mongodbs_uuid_unique UNIQUE (uuid);


--
-- Name: standalone_mysqls standalone_mysqls_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.standalone_mysqls
    ADD CONSTRAINT standalone_mysqls_pkey PRIMARY KEY (id);


--
-- Name: standalone_mysqls standalone_mysqls_uuid_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.standalone_mysqls
    ADD CONSTRAINT standalone_mysqls_uuid_unique UNIQUE (uuid);


--
-- Name: standalone_postgresqls standalone_postgresqls_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.standalone_postgresqls
    ADD CONSTRAINT standalone_postgresqls_pkey PRIMARY KEY (id);


--
-- Name: standalone_postgresqls standalone_postgresqls_uuid_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.standalone_postgresqls
    ADD CONSTRAINT standalone_postgresqls_uuid_unique UNIQUE (uuid);


--
-- Name: standalone_redis standalone_redis_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.standalone_redis
    ADD CONSTRAINT standalone_redis_pkey PRIMARY KEY (id);


--
-- Name: standalone_redis standalone_redis_uuid_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.standalone_redis
    ADD CONSTRAINT standalone_redis_uuid_unique UNIQUE (uuid);


--
-- Name: subscriptions subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (id);


--
-- Name: swarm_dockers swarm_dockers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.swarm_dockers
    ADD CONSTRAINT swarm_dockers_pkey PRIMARY KEY (id);


--
-- Name: swarm_dockers swarm_dockers_server_id_network_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.swarm_dockers
    ADD CONSTRAINT swarm_dockers_server_id_network_unique UNIQUE (server_id, network);


--
-- Name: swarm_dockers swarm_dockers_uuid_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.swarm_dockers
    ADD CONSTRAINT swarm_dockers_uuid_unique UNIQUE (uuid);


--
-- Name: taggables taggable_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.taggables
    ADD CONSTRAINT taggable_unique UNIQUE (tag_id, taggable_id, taggable_type);


--
-- Name: tags tags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tags
    ADD CONSTRAINT tags_pkey PRIMARY KEY (id);


--
-- Name: tags tags_uuid_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tags
    ADD CONSTRAINT tags_uuid_unique UNIQUE (uuid);


--
-- Name: team_invitations team_invitations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_invitations
    ADD CONSTRAINT team_invitations_pkey PRIMARY KEY (id);


--
-- Name: team_invitations team_invitations_team_id_email_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_invitations
    ADD CONSTRAINT team_invitations_team_id_email_unique UNIQUE (team_id, email);


--
-- Name: team_invitations team_invitations_uuid_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_invitations
    ADD CONSTRAINT team_invitations_uuid_unique UNIQUE (uuid);


--
-- Name: team_user team_user_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_user
    ADD CONSTRAINT team_user_pkey PRIMARY KEY (id);


--
-- Name: team_user team_user_team_id_user_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_user
    ADD CONSTRAINT team_user_team_id_user_id_unique UNIQUE (team_id, user_id);


--
-- Name: teams teams_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_pkey PRIMARY KEY (id);


--
-- Name: telegram_notification_settings telegram_notification_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.telegram_notification_settings
    ADD CONSTRAINT telegram_notification_settings_pkey PRIMARY KEY (id);


--
-- Name: telegram_notification_settings telegram_notification_settings_team_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.telegram_notification_settings
    ADD CONSTRAINT telegram_notification_settings_team_id_unique UNIQUE (team_id);


--
-- Name: telescope_entries telescope_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.telescope_entries
    ADD CONSTRAINT telescope_entries_pkey PRIMARY KEY (sequence);


--
-- Name: telescope_entries_tags telescope_entries_tags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.telescope_entries_tags
    ADD CONSTRAINT telescope_entries_tags_pkey PRIMARY KEY (entry_uuid, tag);


--
-- Name: telescope_entries telescope_entries_uuid_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.telescope_entries
    ADD CONSTRAINT telescope_entries_uuid_unique UNIQUE (uuid);


--
-- Name: telescope_monitoring telescope_monitoring_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.telescope_monitoring
    ADD CONSTRAINT telescope_monitoring_pkey PRIMARY KEY (tag);


--
-- Name: user_changelog_reads user_changelog_reads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_changelog_reads
    ADD CONSTRAINT user_changelog_reads_pkey PRIMARY KEY (id);


--
-- Name: user_changelog_reads user_changelog_reads_user_id_release_tag_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_changelog_reads
    ADD CONSTRAINT user_changelog_reads_user_id_release_tag_unique UNIQUE (user_id, release_tag);


--
-- Name: users users_email_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_unique UNIQUE (email);


--
-- Name: users users_idem_uid_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_idem_uid_unique UNIQUE (idem_uid);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: webhook_notification_settings webhook_notification_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhook_notification_settings
    ADD CONSTRAINT webhook_notification_settings_pkey PRIMARY KEY (id);


--
-- Name: webhook_notification_settings webhook_notification_settings_team_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhook_notification_settings
    ADD CONSTRAINT webhook_notification_settings_team_id_unique UNIQUE (team_id);


--
-- Name: workspace_projects workspace_projects_environment_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_projects
    ADD CONSTRAINT workspace_projects_environment_id_name_key UNIQUE (environment_id, name);


--
-- Name: workspace_projects workspace_projects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_projects
    ADD CONSTRAINT workspace_projects_pkey PRIMARY KEY (id);


--
-- Name: workspace_projects workspace_projects_uuid_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_projects
    ADD CONSTRAINT workspace_projects_uuid_key UNIQUE (uuid);


--
-- Name: activity_log_log_name_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX activity_log_log_name_index ON public.activity_log USING btree (log_name);


--
-- Name: analytics_configs_application_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX analytics_configs_application_id_index ON public.analytics_configs USING btree (application_id);


--
-- Name: applications_destination_type_destination_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX applications_destination_type_destination_id_index ON public.applications USING btree (destination_type, destination_id);


--
-- Name: applications_idem_assigned_server_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX applications_idem_assigned_server_id_index ON public.applications USING btree (idem_assigned_server_id);


--
-- Name: applications_idem_deploy_on_managed_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX applications_idem_deploy_on_managed_index ON public.applications USING btree (idem_deploy_on_managed);


--
-- Name: applications_project_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX applications_project_id_idx ON public.applications USING btree (project_id);


--
-- Name: applications_source_type_source_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX applications_source_type_source_id_index ON public.applications USING btree (source_type, source_id);


--
-- Name: causer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX causer ON public.activity_log USING btree (causer_type, causer_id);


--
-- Name: cloud_init_scripts_team_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cloud_init_scripts_team_id_index ON public.cloud_init_scripts USING btree (team_id);


--
-- Name: cloud_provider_tokens_team_id_provider_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cloud_provider_tokens_team_id_provider_index ON public.cloud_provider_tokens USING btree (team_id, provider);


--
-- Name: environment_variables_resourceable_type_resourceable_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX environment_variables_resourceable_type_resourceable_id_index ON public.environment_variables USING btree (resourceable_type, resourceable_id);


--
-- Name: firewall_alerts_application_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX firewall_alerts_application_id_index ON public.firewall_alerts USING btree (application_id);


--
-- Name: firewall_alerts_ip_address_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX firewall_alerts_ip_address_index ON public.firewall_alerts USING btree (ip_address);


--
-- Name: firewall_alerts_severity_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX firewall_alerts_severity_index ON public.firewall_alerts USING btree (severity);


--
-- Name: firewall_alerts_status_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX firewall_alerts_status_index ON public.firewall_alerts USING btree (status);


--
-- Name: firewall_configs_application_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX firewall_configs_application_id_index ON public.firewall_configs USING btree (application_id);


--
-- Name: firewall_rules_enabled_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX firewall_rules_enabled_index ON public.firewall_rules USING btree (enabled);


--
-- Name: firewall_rules_firewall_config_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX firewall_rules_firewall_config_id_index ON public.firewall_rules USING btree (firewall_config_id);


--
-- Name: firewall_rules_priority_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX firewall_rules_priority_index ON public.firewall_rules USING btree (priority);


--
-- Name: firewall_rules_protection_mode_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX firewall_rules_protection_mode_index ON public.firewall_rules USING btree (protection_mode);


--
-- Name: firewall_traffic_logs_application_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX firewall_traffic_logs_application_id_index ON public.firewall_traffic_logs USING btree (application_id);


--
-- Name: firewall_traffic_logs_decision_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX firewall_traffic_logs_decision_index ON public.firewall_traffic_logs USING btree (decision);


--
-- Name: firewall_traffic_logs_ip_address_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX firewall_traffic_logs_ip_address_index ON public.firewall_traffic_logs USING btree (ip_address);


--
-- Name: firewall_traffic_logs_timestamp_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX firewall_traffic_logs_timestamp_index ON public.firewall_traffic_logs USING btree ("timestamp");


--
-- Name: idem_quotas_plan_type_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idem_quotas_plan_type_index ON public.idem_quotas USING btree (plan_type);


--
-- Name: idem_quotas_team_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idem_quotas_team_id_index ON public.idem_quotas USING btree (team_id);


--
-- Name: idx_activity_properties_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_properties_status ON public.activity_log USING btree (((properties ->> 'status'::text)));


--
-- Name: idx_activity_type_uuid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_type_uuid ON public.activity_log USING gin (properties jsonb_path_ops);


--
-- Name: idx_activity_type_uuid_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_type_uuid_created_at ON public.activity_log USING btree (((properties ->> 'type_uuid'::text)), created_at DESC);


--
-- Name: local_file_volumes_resource_type_resource_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX local_file_volumes_resource_type_resource_id_index ON public.local_file_volumes USING btree (resource_type, resource_id);


--
-- Name: local_persistent_volumes_resource_type_resource_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX local_persistent_volumes_resource_type_resource_id_index ON public.local_persistent_volumes USING btree (resource_type, resource_id);


--
-- Name: personal_access_tokens_tokenable_type_tokenable_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX personal_access_tokens_tokenable_type_tokenable_id_index ON public.personal_access_tokens USING btree (tokenable_type, tokenable_id);


--
-- Name: pipeline_configs_application_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pipeline_configs_application_id_index ON public.pipeline_configs USING btree (application_id);


--
-- Name: pipeline_executions_application_id_created_at_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pipeline_executions_application_id_created_at_index ON public.pipeline_executions USING btree (application_id, created_at);


--
-- Name: pipeline_executions_status_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pipeline_executions_status_index ON public.pipeline_executions USING btree (status);


--
-- Name: pipeline_jobs_pipeline_execution_id_order_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pipeline_jobs_pipeline_execution_id_order_index ON public.pipeline_jobs USING btree (pipeline_execution_id, "order");


--
-- Name: pipeline_jobs_status_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pipeline_jobs_status_index ON public.pipeline_jobs USING btree (status);


--
-- Name: pipeline_logs_pipeline_execution_id_logged_at_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pipeline_logs_pipeline_execution_id_logged_at_index ON public.pipeline_logs USING btree (pipeline_execution_id, logged_at);


--
-- Name: pipeline_logs_stage_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pipeline_logs_stage_id_index ON public.pipeline_logs USING btree (stage_id);


--
-- Name: pipeline_notifications_pipeline_config_id_channel_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pipeline_notifications_pipeline_config_id_channel_index ON public.pipeline_notifications USING btree (pipeline_config_id, channel);


--
-- Name: pipeline_scan_results_pipeline_execution_id_tool_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pipeline_scan_results_pipeline_execution_id_tool_index ON public.pipeline_scan_results USING btree (pipeline_execution_id, tool);


--
-- Name: pipeline_scan_results_pipeline_job_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pipeline_scan_results_pipeline_job_id_index ON public.pipeline_scan_results USING btree (pipeline_job_id);


--
-- Name: pipeline_tool_configs_tool_name_application_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pipeline_tool_configs_tool_name_application_id_index ON public.pipeline_tool_configs USING btree (tool_name, application_id);


--
-- Name: scheduled_database_backups_database_type_database_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scheduled_database_backups_database_type_database_id_index ON public.scheduled_database_backups USING btree (database_type, database_id);


--
-- Name: scheduled_db_backup_executions_backup_id_created_at_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scheduled_db_backup_executions_backup_id_created_at_index ON public.scheduled_database_backup_executions USING btree (scheduled_database_backup_id, created_at);


--
-- Name: scheduled_task_executions_task_id_created_at_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX scheduled_task_executions_task_id_created_at_index ON public.scheduled_task_executions USING btree (scheduled_task_id, created_at);


--
-- Name: servers_country_code_is_available_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX servers_country_code_is_available_index ON public.servers USING btree (country_code, is_available);


--
-- Name: servers_idem_managed_is_available_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX servers_idem_managed_is_available_index ON public.servers USING btree (idem_managed, is_available);


--
-- Name: servers_region_is_available_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX servers_region_is_available_index ON public.servers USING btree (region, is_available);


--
-- Name: services_destination_type_destination_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX services_destination_type_destination_id_index ON public.services USING btree (destination_type, destination_id);


--
-- Name: services_project_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX services_project_id_idx ON public.services USING btree (project_id);


--
-- Name: sessions_last_activity_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sessions_last_activity_index ON public.sessions USING btree (last_activity);


--
-- Name: sessions_user_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sessions_user_id_index ON public.sessions USING btree (user_id);


--
-- Name: standalone_clickhouses_destination_type_destination_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX standalone_clickhouses_destination_type_destination_id_index ON public.standalone_clickhouses USING btree (destination_type, destination_id);


--
-- Name: standalone_clickhouses_project_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX standalone_clickhouses_project_id_idx ON public.standalone_clickhouses USING btree (project_id);


--
-- Name: standalone_dragonflies_destination_type_destination_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX standalone_dragonflies_destination_type_destination_id_index ON public.standalone_dragonflies USING btree (destination_type, destination_id);


--
-- Name: standalone_dragonflies_project_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX standalone_dragonflies_project_id_idx ON public.standalone_dragonflies USING btree (project_id);


--
-- Name: standalone_keydbs_destination_type_destination_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX standalone_keydbs_destination_type_destination_id_index ON public.standalone_keydbs USING btree (destination_type, destination_id);


--
-- Name: standalone_keydbs_project_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX standalone_keydbs_project_id_idx ON public.standalone_keydbs USING btree (project_id);


--
-- Name: standalone_mariadbs_destination_type_destination_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX standalone_mariadbs_destination_type_destination_id_index ON public.standalone_mariadbs USING btree (destination_type, destination_id);


--
-- Name: standalone_mariadbs_project_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX standalone_mariadbs_project_id_idx ON public.standalone_mariadbs USING btree (project_id);


--
-- Name: standalone_mongodbs_destination_type_destination_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX standalone_mongodbs_destination_type_destination_id_index ON public.standalone_mongodbs USING btree (destination_type, destination_id);


--
-- Name: standalone_mongodbs_project_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX standalone_mongodbs_project_id_idx ON public.standalone_mongodbs USING btree (project_id);


--
-- Name: standalone_mysqls_destination_type_destination_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX standalone_mysqls_destination_type_destination_id_index ON public.standalone_mysqls USING btree (destination_type, destination_id);


--
-- Name: standalone_mysqls_project_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX standalone_mysqls_project_id_idx ON public.standalone_mysqls USING btree (project_id);


--
-- Name: standalone_postgresqls_destination_type_destination_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX standalone_postgresqls_destination_type_destination_id_index ON public.standalone_postgresqls USING btree (destination_type, destination_id);


--
-- Name: standalone_postgresqls_project_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX standalone_postgresqls_project_id_idx ON public.standalone_postgresqls USING btree (project_id);


--
-- Name: standalone_redis_destination_type_destination_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX standalone_redis_destination_type_destination_id_index ON public.standalone_redis USING btree (destination_type, destination_id);


--
-- Name: standalone_redis_project_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX standalone_redis_project_id_idx ON public.standalone_redis USING btree (project_id);


--
-- Name: subject; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX subject ON public.activity_log USING btree (subject_type, subject_id);


--
-- Name: telescope_entries_batch_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX telescope_entries_batch_id_index ON public.telescope_entries USING btree (batch_id);


--
-- Name: telescope_entries_created_at_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX telescope_entries_created_at_index ON public.telescope_entries USING btree (created_at);


--
-- Name: telescope_entries_family_hash_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX telescope_entries_family_hash_index ON public.telescope_entries USING btree (family_hash);


--
-- Name: telescope_entries_tags_tag_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX telescope_entries_tags_tag_index ON public.telescope_entries_tags USING btree (tag);


--
-- Name: telescope_entries_type_should_display_on_index_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX telescope_entries_type_should_display_on_index_index ON public.telescope_entries USING btree (type, should_display_on_index);


--
-- Name: user_changelog_reads_release_tag_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_changelog_reads_release_tag_index ON public.user_changelog_reads USING btree (release_tag);


--
-- Name: user_changelog_reads_user_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_changelog_reads_user_id_index ON public.user_changelog_reads USING btree (user_id);


--
-- Name: users_idem_uid_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX users_idem_uid_index ON public.users USING btree (idem_uid);


--
-- Name: workspace_projects_environment_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX workspace_projects_environment_id_idx ON public.workspace_projects USING btree (environment_id);


--
-- Name: workspace_projects_team_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX workspace_projects_team_id_idx ON public.workspace_projects USING btree (team_id);


--
-- Name: additional_destinations additional_destinations_application_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.additional_destinations
    ADD CONSTRAINT additional_destinations_application_id_foreign FOREIGN KEY (application_id) REFERENCES public.applications(id) ON DELETE CASCADE;


--
-- Name: additional_destinations additional_destinations_server_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.additional_destinations
    ADD CONSTRAINT additional_destinations_server_id_foreign FOREIGN KEY (server_id) REFERENCES public.servers(id) ON DELETE CASCADE;


--
-- Name: additional_destinations additional_destinations_standalone_docker_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.additional_destinations
    ADD CONSTRAINT additional_destinations_standalone_docker_id_foreign FOREIGN KEY (standalone_docker_id) REFERENCES public.standalone_dockers(id) ON DELETE CASCADE;


--
-- Name: analytics_configs analytics_configs_application_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analytics_configs
    ADD CONSTRAINT analytics_configs_application_id_foreign FOREIGN KEY (application_id) REFERENCES public.applications(id) ON DELETE CASCADE;


--
-- Name: applications applications_idem_assigned_server_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.applications
    ADD CONSTRAINT applications_idem_assigned_server_id_foreign FOREIGN KEY (idem_assigned_server_id) REFERENCES public.servers(id) ON DELETE SET NULL;


--
-- Name: applications applications_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.applications
    ADD CONSTRAINT applications_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.workspace_projects(id) ON DELETE SET NULL;


--
-- Name: cloud_init_scripts cloud_init_scripts_team_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cloud_init_scripts
    ADD CONSTRAINT cloud_init_scripts_team_id_foreign FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: cloud_provider_tokens cloud_provider_tokens_team_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cloud_provider_tokens
    ADD CONSTRAINT cloud_provider_tokens_team_id_foreign FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: discord_notification_settings discord_notification_settings_team_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discord_notification_settings
    ADD CONSTRAINT discord_notification_settings_team_id_foreign FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: email_notification_settings email_notification_settings_team_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_notification_settings
    ADD CONSTRAINT email_notification_settings_team_id_foreign FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: firewall_alerts firewall_alerts_application_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.firewall_alerts
    ADD CONSTRAINT firewall_alerts_application_id_foreign FOREIGN KEY (application_id) REFERENCES public.applications(id) ON DELETE CASCADE;


--
-- Name: firewall_alerts firewall_alerts_resolved_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.firewall_alerts
    ADD CONSTRAINT firewall_alerts_resolved_by_foreign FOREIGN KEY (resolved_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: firewall_configs firewall_configs_application_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.firewall_configs
    ADD CONSTRAINT firewall_configs_application_id_foreign FOREIGN KEY (application_id) REFERENCES public.applications(id) ON DELETE CASCADE;


--
-- Name: firewall_rules firewall_rules_firewall_config_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.firewall_rules
    ADD CONSTRAINT firewall_rules_firewall_config_id_foreign FOREIGN KEY (firewall_config_id) REFERENCES public.firewall_configs(id) ON DELETE CASCADE;


--
-- Name: firewall_traffic_logs firewall_traffic_logs_application_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.firewall_traffic_logs
    ADD CONSTRAINT firewall_traffic_logs_application_id_foreign FOREIGN KEY (application_id) REFERENCES public.applications(id) ON DELETE CASCADE;


--
-- Name: firewall_traffic_logs firewall_traffic_logs_rule_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.firewall_traffic_logs
    ADD CONSTRAINT firewall_traffic_logs_rule_id_foreign FOREIGN KEY (rule_id) REFERENCES public.firewall_rules(id) ON DELETE SET NULL;


--
-- Name: idem_quotas idem_quotas_team_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.idem_quotas
    ADD CONSTRAINT idem_quotas_team_id_foreign FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: pipeline_configs pipeline_configs_application_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pipeline_configs
    ADD CONSTRAINT pipeline_configs_application_id_foreign FOREIGN KEY (application_id) REFERENCES public.applications(id) ON DELETE CASCADE;


--
-- Name: pipeline_executions pipeline_executions_application_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pipeline_executions
    ADD CONSTRAINT pipeline_executions_application_id_foreign FOREIGN KEY (application_id) REFERENCES public.applications(id) ON DELETE CASCADE;


--
-- Name: pipeline_executions pipeline_executions_pipeline_config_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pipeline_executions
    ADD CONSTRAINT pipeline_executions_pipeline_config_id_foreign FOREIGN KEY (pipeline_config_id) REFERENCES public.pipeline_configs(id) ON DELETE CASCADE;


--
-- Name: pipeline_jobs pipeline_jobs_pipeline_execution_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pipeline_jobs
    ADD CONSTRAINT pipeline_jobs_pipeline_execution_id_foreign FOREIGN KEY (pipeline_execution_id) REFERENCES public.pipeline_executions(id) ON DELETE CASCADE;


--
-- Name: pipeline_logs pipeline_logs_pipeline_execution_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pipeline_logs
    ADD CONSTRAINT pipeline_logs_pipeline_execution_id_foreign FOREIGN KEY (pipeline_execution_id) REFERENCES public.pipeline_executions(id) ON DELETE CASCADE;


--
-- Name: pipeline_notifications pipeline_notifications_pipeline_config_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pipeline_notifications
    ADD CONSTRAINT pipeline_notifications_pipeline_config_id_foreign FOREIGN KEY (pipeline_config_id) REFERENCES public.pipeline_configs(id) ON DELETE CASCADE;


--
-- Name: pipeline_scan_results pipeline_scan_results_pipeline_execution_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pipeline_scan_results
    ADD CONSTRAINT pipeline_scan_results_pipeline_execution_id_foreign FOREIGN KEY (pipeline_execution_id) REFERENCES public.pipeline_executions(id) ON DELETE CASCADE;


--
-- Name: pipeline_scan_results pipeline_scan_results_pipeline_job_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pipeline_scan_results
    ADD CONSTRAINT pipeline_scan_results_pipeline_job_id_foreign FOREIGN KEY (pipeline_job_id) REFERENCES public.pipeline_jobs(id) ON DELETE CASCADE;


--
-- Name: pipeline_tool_configs pipeline_tool_configs_application_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pipeline_tool_configs
    ADD CONSTRAINT pipeline_tool_configs_application_id_foreign FOREIGN KEY (application_id) REFERENCES public.applications(id) ON DELETE CASCADE;


--
-- Name: projects projects_assigned_server_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_assigned_server_id_foreign FOREIGN KEY (assigned_server_id) REFERENCES public.servers(id) ON DELETE SET NULL;


--
-- Name: pushover_notification_settings pushover_notification_settings_team_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pushover_notification_settings
    ADD CONSTRAINT pushover_notification_settings_team_id_foreign FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: servers servers_cloud_provider_token_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.servers
    ADD CONSTRAINT servers_cloud_provider_token_id_foreign FOREIGN KEY (cloud_provider_token_id) REFERENCES public.cloud_provider_tokens(id) ON DELETE SET NULL;


--
-- Name: services services_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.workspace_projects(id) ON DELETE SET NULL;


--
-- Name: shared_environment_variables shared_environment_variables_environment_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shared_environment_variables
    ADD CONSTRAINT shared_environment_variables_environment_id_foreign FOREIGN KEY (environment_id) REFERENCES public.environments(id) ON DELETE CASCADE;


--
-- Name: shared_environment_variables shared_environment_variables_project_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shared_environment_variables
    ADD CONSTRAINT shared_environment_variables_project_id_foreign FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: shared_environment_variables shared_environment_variables_team_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shared_environment_variables
    ADD CONSTRAINT shared_environment_variables_team_id_foreign FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: slack_notification_settings slack_notification_settings_team_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.slack_notification_settings
    ADD CONSTRAINT slack_notification_settings_team_id_foreign FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: ssl_certificates ssl_certificates_server_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ssl_certificates
    ADD CONSTRAINT ssl_certificates_server_id_foreign FOREIGN KEY (server_id) REFERENCES public.servers(id);


--
-- Name: standalone_clickhouses standalone_clickhouses_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.standalone_clickhouses
    ADD CONSTRAINT standalone_clickhouses_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.workspace_projects(id) ON DELETE SET NULL;


--
-- Name: standalone_dragonflies standalone_dragonflies_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.standalone_dragonflies
    ADD CONSTRAINT standalone_dragonflies_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.workspace_projects(id) ON DELETE SET NULL;


--
-- Name: standalone_keydbs standalone_keydbs_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.standalone_keydbs
    ADD CONSTRAINT standalone_keydbs_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.workspace_projects(id) ON DELETE SET NULL;


--
-- Name: standalone_mariadbs standalone_mariadbs_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.standalone_mariadbs
    ADD CONSTRAINT standalone_mariadbs_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.workspace_projects(id) ON DELETE SET NULL;


--
-- Name: standalone_mongodbs standalone_mongodbs_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.standalone_mongodbs
    ADD CONSTRAINT standalone_mongodbs_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.workspace_projects(id) ON DELETE SET NULL;


--
-- Name: standalone_mysqls standalone_mysqls_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.standalone_mysqls
    ADD CONSTRAINT standalone_mysqls_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.workspace_projects(id) ON DELETE SET NULL;


--
-- Name: standalone_postgresqls standalone_postgresqls_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.standalone_postgresqls
    ADD CONSTRAINT standalone_postgresqls_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.workspace_projects(id) ON DELETE SET NULL;


--
-- Name: standalone_redis standalone_redis_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.standalone_redis
    ADD CONSTRAINT standalone_redis_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.workspace_projects(id) ON DELETE SET NULL;


--
-- Name: taggables taggables_tag_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.taggables
    ADD CONSTRAINT taggables_tag_id_foreign FOREIGN KEY (tag_id) REFERENCES public.tags(id) ON DELETE CASCADE;


--
-- Name: tags tags_team_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tags
    ADD CONSTRAINT tags_team_id_foreign FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: team_invitations team_invitations_team_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_invitations
    ADD CONSTRAINT team_invitations_team_id_foreign FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: telegram_notification_settings telegram_notification_settings_team_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.telegram_notification_settings
    ADD CONSTRAINT telegram_notification_settings_team_id_foreign FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: telescope_entries_tags telescope_entries_tags_entry_uuid_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.telescope_entries_tags
    ADD CONSTRAINT telescope_entries_tags_entry_uuid_foreign FOREIGN KEY (entry_uuid) REFERENCES public.telescope_entries(uuid) ON DELETE CASCADE;


--
-- Name: user_changelog_reads user_changelog_reads_user_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_changelog_reads
    ADD CONSTRAINT user_changelog_reads_user_id_foreign FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: webhook_notification_settings webhook_notification_settings_team_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhook_notification_settings
    ADD CONSTRAINT webhook_notification_settings_team_id_foreign FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: workspace_projects workspace_projects_environment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_projects
    ADD CONSTRAINT workspace_projects_environment_id_fkey FOREIGN KEY (environment_id) REFERENCES public.environments(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--


