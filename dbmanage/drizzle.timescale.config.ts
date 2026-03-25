import { existsSync } from "node:fs";
import { isAbsolute } from "node:path";
import { resolve } from "node:path";
import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

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

export default defineConfig({
  out: "./drizzle/timescale",
  schema: "./src/timescale/schema.ts",
  tablesFilter: ["api_telemetry"],
  dialect: "postgresql",
  dbCredentials: {
    url: timescaleUrl.toString(),
  },
  verbose: true,
  strict: true,
});
