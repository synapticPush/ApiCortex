import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const apiTelemetry = pgTable("api_telemetry", {
  time: timestamp("time", { withTimezone: true }).notNull(),
  orgId: uuid("org_id").notNull(),
  apiId: uuid("api_id"),
  endpoint: text("endpoint").notNull(),
  method: text("method").notNull(),
  status: integer("status").notNull(),
  latencyMs: integer("latency_ms").notNull(),
  requestSize: integer("request_size"),
  responseSize: integer("response_size"),
}, (table) => ({
  timeIdx: index("ix_api_telemetry_time").on(table.time),
  orgIdx: index("ix_api_telemetry_org_id").on(table.orgId),
  apiIdx: index("ix_api_telemetry_api_id").on(table.apiId),
}));
