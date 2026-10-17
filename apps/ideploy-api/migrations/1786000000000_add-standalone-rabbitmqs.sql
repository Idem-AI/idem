-- Up Migration
-- RabbitMQ beside the databases: a message broker deployed and managed like
-- them (credentials, console, network, named volume). Its own table, with the
-- columns every engine table has, so each query listing them treats it alike.
CREATE TABLE IF NOT EXISTS standalone_rabbitmqs (
  id bigserial PRIMARY KEY,
  uuid varchar(255) NOT NULL UNIQUE,
  name varchar(255) NOT NULL,
  description varchar(255),
  rabbitmq_user varchar(255) NOT NULL DEFAULT 'rabbitmq',
  rabbitmq_password text NOT NULL,
  is_log_drain_enabled boolean NOT NULL DEFAULT false,
  is_include_timestamps boolean NOT NULL DEFAULT false,
  deleted_at timestamp(0) without time zone,
  status varchar(255) NOT NULL DEFAULT 'exited',
  image varchar(255) NOT NULL DEFAULT 'rabbitmq:4-management',
  is_public boolean NOT NULL DEFAULT false,
  public_port integer,
  ports_mappings text,
  limits_memory varchar(255) NOT NULL DEFAULT '0',
  limits_memory_swap varchar(255) NOT NULL DEFAULT '0',
  limits_memory_swappiness integer NOT NULL DEFAULT 60,
  limits_memory_reservation varchar(255) NOT NULL DEFAULT '0',
  limits_cpus varchar(255) NOT NULL DEFAULT '0',
  limits_cpuset varchar(255),
  limits_cpu_shares integer NOT NULL DEFAULT 1024,
  started_at timestamp(0) without time zone,
  destination_type varchar(255) NOT NULL,
  destination_id bigint NOT NULL,
  environment_id bigint,
  created_at timestamp(0) without time zone,
  updated_at timestamp(0) without time zone,
  config_hash varchar(255),
  custom_docker_run_options text,
  last_online_at timestamp(0) without time zone NOT NULL DEFAULT now(),
  enable_ssl boolean NOT NULL DEFAULT false,
  project_id bigint
);

-- Down Migration
DROP TABLE IF EXISTS standalone_rabbitmqs;
