-- Up Migration
-- The CrowdSec machine login written by the proxy's setup. Assumed to be
-- "localhost" until now, which fails to authenticate whenever CrowdSec picked
-- another name. NULL (servers set up before this) still means "localhost".
ALTER TABLE servers ADD COLUMN IF NOT EXISTS crowdsec_machine_id varchar(255);

-- Down Migration
ALTER TABLE servers DROP COLUMN IF EXISTS crowdsec_machine_id;
