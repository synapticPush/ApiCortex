import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: varchar("email", { length: 255 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    provider: varchar("provider", { length: 32 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    emailUnique: unique("uq_users_email").on(table.email),
    emailIdx: index("ix_users_email").on(table.email),
  }),
);

export const organizations = pgTable("organizations", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  plan: varchar("plan", { length: 32 }).notNull().default("free"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const memberships = pgTable(
  "memberships",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 32 }).notNull().default("owner"),
  },
  (table) => ({
    pk: primaryKey({
      columns: [table.userId, table.orgId],
      name: "pk_memberships",
    }),
  }),
);

export const organizationIngestKeys = pgTable("organization_ingest_keys", {
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" })
    .primaryKey(),
  keyHash: varchar("key_hash", { length: 128 }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const apis = pgTable(
  "apis",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    baseUrl: varchar("base_url", { length: 1024 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    orgIdx: index("ix_apis_org_id").on(table.orgId),
  }),
);

export const endpoints = pgTable(
  "endpoints",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    apiId: uuid("api_id")
      .notNull()
      .references(() => apis.id, { onDelete: "cascade" }),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    path: varchar("path", { length: 1024 }).notNull(),
    method: varchar("method", { length: 16 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    apiIdx: index("ix_endpoints_api_id").on(table.apiId),
    orgIdx: index("ix_endpoints_org_id").on(table.orgId),
    pathMethodUnique: unique("uq_endpoint_api_path_method").on(
      table.apiId,
      table.path,
      table.method,
    ),
  }),
);

export const openapiSpecs = pgTable(
  "openapi_specs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    apiId: uuid("api_id")
      .notNull()
      .references(() => apis.id, { onDelete: "cascade" }),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    version: varchar("version", { length: 64 }).notNull(),
    rawSpec: jsonb("raw_spec").notNull(),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    apiIdx: index("ix_openapi_specs_api_id").on(table.apiId),
    orgIdx: index("ix_openapi_specs_org_id").on(table.orgId),
    apiVersionUnique: unique("uq_openapi_api_version").on(
      table.apiId,
      table.version,
    ),
  }),
);

export const contracts = pgTable(
  "contracts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    endpointId: uuid("endpoint_id")
      .notNull()
      .references(() => endpoints.id, { onDelete: "cascade" }),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    schemaHash: varchar("schema_hash", { length: 128 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    endpointIdx: index("ix_contracts_endpoint_id").on(table.endpointId),
    orgIdx: index("ix_contracts_org_id").on(table.orgId),
  }),
);

export const featureFlags = pgTable(
  "feature_flags",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    plan: varchar("plan", { length: 32 }).notNull(),
    featureKey: varchar("feature_key", { length: 128 }).notNull(),
    enabled: boolean("enabled").notNull().default(false),
    limit: integer("limit"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    planIdx: index("ix_feature_flags_plan").on(table.plan),
    planFeatureUnique: unique("uq_feature_flag_plan_feature").on(
      table.plan,
      table.featureKey,
    ),
  }),
);

export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 64 }).notNull(),
    payload: jsonb("payload").notNull(),
    status: varchar("status", { length: 32 }).notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    runAt: timestamp("run_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    orgIdx: index("ix_jobs_org_id").on(table.orgId),
  }),
);
