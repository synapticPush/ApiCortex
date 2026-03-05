import { existsSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { config } from "dotenv";
import { Client } from "pg";

config({ path: "../.env" });

if (!process.env.TIMESCALE_DATABASE) {
  throw new Error("TIMESCALE_DATABASE is not set in .env");
}

const certificatePath = process.env.TIMESCALE_CA_CERT_PATH || process.env.KAFKA_CA_CERT_PATH;

if (certificatePath) {
  const candidates = isAbsolute(certificatePath)
    ? [certificatePath]
    : [resolve(certificatePath), resolve("..", certificatePath)];
  const resolvedCertificatePath = candidates.find((candidate) => existsSync(candidate));
  if (!resolvedCertificatePath) {
    throw new Error(`CA certificate file does not exist. Tried: ${candidates.join(", ")}`);
  }
  process.env.NODE_EXTRA_CA_CERTS = resolvedCertificatePath;
}

const timescaleUrl = new URL(process.env.TIMESCALE_DATABASE);
const useLibpqCompat = (process.env.TIMESCALE_USE_LIBPQ_COMPAT || "false").toLowerCase() === "true";
const configuredSslMode = process.env.TIMESCALE_SSLMODE || (useLibpqCompat ? "require" : "verify-full");

timescaleUrl.searchParams.set("sslmode", configuredSslMode);
if (useLibpqCompat) {
  timescaleUrl.searchParams.set("uselibpqcompat", "true");
}

const client = new Client({ connectionString: timescaleUrl.toString() });
await client.connect();

try {
  const indexes = await client.query(
    "select indexname,indexdef from pg_indexes where schemaname='public' and tablename='api_telemetry' order by indexname"
  );
  const constraints = await client.query(
    "select conname, pg_get_constraintdef(oid) as definition from pg_constraint where conrelid='public.api_telemetry'::regclass order by conname"
  );
  console.log(JSON.stringify({ indexes: indexes.rows, constraints: constraints.rows }, null, 2));
} finally {
  await client.end();
}
