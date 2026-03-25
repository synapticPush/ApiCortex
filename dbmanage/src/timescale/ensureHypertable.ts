import { existsSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { config } from "dotenv";
import { Client } from "pg";

config({ path: "../.env", override: true });

if (!process.env.TIMESCALE_DATABASE) {
  throw new Error("TIMESCALE_DATABASE is not set in .env");
}

const certificatePath =
  process.env.TIMESCALE_CA_CERT_PATH || process.env.KAFKA_CA_CERT_PATH;
let hasCustomCa = false;

if (certificatePath) {
  const candidates = isAbsolute(certificatePath)
    ? [certificatePath]
    : [resolve(certificatePath), resolve("..", certificatePath)];
  const resolvedCertificatePath = candidates.find((candidate) =>
    existsSync(candidate),
  );
  if (!resolvedCertificatePath) {
    throw new Error(
      `CA certificate file does not exist. Tried: ${candidates.join(", ")}`,
    );
  }
  process.env.NODE_EXTRA_CA_CERTS = resolvedCertificatePath;
  hasCustomCa = true;
}

const timescaleUrl = new URL(process.env.TIMESCALE_DATABASE);
const useLibpqCompat = process.env.TIMESCALE_USE_LIBPQ_COMPAT
  ? process.env.TIMESCALE_USE_LIBPQ_COMPAT.toLowerCase() === "true"
  : !hasCustomCa;
const configuredSslMode =
  process.env.TIMESCALE_SSLMODE || (useLibpqCompat ? "require" : "verify-full");

timescaleUrl.searchParams.set("sslmode", configuredSslMode);
if (useLibpqCompat) {
  timescaleUrl.searchParams.set("uselibpqcompat", "true");
}

const client = new Client({ connectionString: timescaleUrl.toString() });

await client.connect();

try {
  await client.query("CREATE EXTENSION IF NOT EXISTS timescaledb");
  await client.query(
    "SELECT create_hypertable('api_telemetry', 'time', if_not_exists => TRUE, migrate_data => TRUE)",
  );
  await client.query(
    "CREATE INDEX IF NOT EXISTS ix_api_telemetry_org_time ON api_telemetry (org_id, time DESC)",
  );
  await client.query(
    "SELECT add_retention_policy('api_telemetry', INTERVAL '90 days', if_not_exists => TRUE)",
  );
} finally {
  await client.end();
}
