import { z } from 'zod';

const ConfigSchema = z.object({
  db: z.object({
    host: z.string().default('localhost'),
    port: z.coerce.number().default(5432),
    user: z.string().default('user'),
    password: z.string().default('password'),
    database: z.string().default('dms'),
    ssl: z.boolean().default(false),
    timeoutMs: z.coerce.number().default(30000),
  }),
  rabbitmq: z.object({
    host: z.string().default('localhost'),
    port: z.coerce.number().default(5672),
    user: z.string().default('guest'),
    password: z.string().default('guest'),
    vhost: z.string().default(''),
  }),
  redis: z.object({
    host: z.string().default('localhost'),
    port: z.coerce.number().default(6379),
    password: z.string().optional(),
  }),
  vault: z.object({
    address: z.string().default('http://127.0.0.1:8200'),
    token: z.string().default(''),
    mountPath: z.string().default('secret'),
  }),
  endpoints: z.object({
    configServiceUrl: z.string().default('http://localhost:3000'),
    aiServiceUrl: z.string().default('http://localhost:8000'),
    gatewayUrl: z.string().default('http://localhost:3000'),
  }),
  security: z.object({
    jwtIssuer: z.string().default('dms-identity-service'),
    jwtAudience: z.string().default('dms-enterprise'),
    lockoutThreshold: z.coerce.number().default(5),
    lockoutDurationMinutes: z.coerce.number().default(15),
    rateLimitMaxRequests: z.coerce.number().default(10),
  }),
  logLevel: z.string().default('DEBUG'),
  seeds: z.object({
    seedMockData: z.boolean().default(true),
    tenantId: z.string().default('tenant-uuid-1111'),
    agentId: z.string().default('agent-uuid-2222'),
    outletLat: z.coerce.number().default(28.6139),
    outletLng: z.coerce.number().default(77.2090),
  }),
});

export type Config = z.infer<typeof ConfigSchema>;

function cleanObj(obj: any): any {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(cleanObj);
  }
  const cleaned: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined && value !== '') {
      cleaned[key] = cleanObj(value);
    }
  }
  return cleaned;
}

function redactConfig(config: Config) {
  const copy = JSON.parse(JSON.stringify(config));
  if (copy.db) copy.db.password = '[REDACTED]';
  if (copy.rabbitmq) copy.rabbitmq.password = '[REDACTED]';
  if (copy.redis) copy.redis.password = '[REDACTED]';
  if (copy.vault) copy.vault.token = '[REDACTED]';
  return copy;
}

function hideSecrets(config: Config): Config {
  const redacted = { ...config };
  
  Object.defineProperty(redacted, 'toJSON', {
    value: () => redactConfig(config),
    enumerable: false,
    configurable: true,
  });

  Object.defineProperty(redacted, 'toString', {
    value: () => JSON.stringify(redactConfig(config), null, 2),
    enumerable: false,
    configurable: true,
  });

  return redacted;
}

function propagateEnv(config: Config): void {
  process.env.PGHOST = config.db.host;
  process.env.PGPORT = String(config.db.port);
  process.env.PGUSER = config.db.user;
  process.env.PGPASSWORD = config.db.password;
  process.env.PGDATABASE = config.db.database;
}

export function loadConfigSync(): Config {
  const envConfig = {
    db: {
      host: process.env.DB_HOST || process.env.PGHOST,
      port: process.env.DB_PORT || process.env.PGPORT,
      user: process.env.DB_USER || process.env.PGUSER,
      password: process.env.DB_PASSWORD || process.env.PGPASSWORD,
      database: process.env.DB_NAME || process.env.PGDATABASE,
      ssl: process.env.DB_SSL === 'true',
      timeoutMs: process.env.DB_TIMEOUT,
    },
    rabbitmq: {
      host: process.env.RABBITMQ_HOST || process.env.TEST_BROKER_HOST,
      port: process.env.RABBITMQ_PORT || process.env.TEST_BROKER_PORT,
      user: process.env.RABBITMQ_USER || process.env.TEST_BROKER_USER,
      password: process.env.RABBITMQ_PASSWORD || process.env.TEST_BROKER_PASSWORD,
      vhost: process.env.RABBITMQ_VHOST,
    },
    redis: {
      host: process.env.REDIS_HOST,
      port: process.env.REDIS_PORT,
      password: process.env.REDIS_PASSWORD,
    },
    vault: {
      address: process.env.VAULT_ADDR,
      token: process.env.VAULT_TOKEN,
      mountPath: process.env.VAULT_MOUNT_PATH,
    },
    endpoints: {
      configServiceUrl: process.env.CONFIG_SERVICE_URL,
      aiServiceUrl: process.env.AI_SERVICE_URL,
      gatewayUrl: process.env.GATEWAY_URL,
    },
    security: {
      jwtIssuer: process.env.JWT_ISSUER,
      jwtAudience: process.env.JWT_AUDIENCE,
      lockoutThreshold: process.env.LOCKOUT_THRESHOLD,
      lockoutDurationMinutes: process.env.LOCKOUT_DURATION_MINUTES,
      rateLimitMaxRequests: process.env.RATE_LIMIT_MAX_REQUESTS,
    },
    logLevel: process.env.LOG_LEVEL,
    seeds: {
      seedMockData: process.env.SEED_MOCK_DATA !== 'false',
      tenantId: process.env.SEED_TENANT_ID,
      agentId: process.env.SEED_AGENT_ID,
      outletLat: process.env.SEED_OUTLET_LAT,
      outletLng: process.env.SEED_OUTLET_LNG,
    },
  };

  const cleanEnv = cleanObj(envConfig);

  const result = ConfigSchema.safeParse(cleanEnv);
  if (!result.success) {
    throw new Error(`Invalid configuration: ${result.error.message}`);
  }
  
  const config = result.data;
  propagateEnv(config);
  return hideSecrets(config);
}

export async function loadConfig(): Promise<Config> {
  const baseConfig = loadConfigSync();
  const vaultAddr = process.env.VAULT_ADDR || baseConfig.vault.address;
  const vaultToken = process.env.VAULT_TOKEN || baseConfig.vault.token;

  if (vaultAddr && vaultToken) {
    try {
      const mount = baseConfig.vault.mountPath || 'secret';
      
      // Load db credentials from Vault path 'secret/data/dms/database'
      const dbUrl = `${vaultAddr}/v1/${mount}/data/dms/database`;
      const dbResponse = await fetch(dbUrl, {
        method: 'GET',
        headers: { 'X-Vault-Token': vaultToken, 'Content-Type': 'application/json' },
      });
      if (dbResponse.ok) {
        const body = await dbResponse.json() as any;
        const dbData = body?.data?.data;
        if (dbData) {
          if (dbData.password) baseConfig.db.password = dbData.password;
          if (dbData.user) baseConfig.db.user = dbData.user;
        }
      }

      // Load broker credentials from Vault path 'secret/data/dms/rabbitmq'
      const rmUrl = `${vaultAddr}/v1/${mount}/data/dms/rabbitmq`;
      const rmResponse = await fetch(rmUrl, {
        method: 'GET',
        headers: { 'X-Vault-Token': vaultToken, 'Content-Type': 'application/json' },
      });
      if (rmResponse.ok) {
        const body = await rmResponse.json() as any;
        const rmData = body?.data?.data;
        if (rmData) {
          if (rmData.password) baseConfig.rabbitmq.password = rmData.password;
          if (rmData.user) baseConfig.rabbitmq.user = rmData.user;
        }
      }
    } catch (err) {
      // Ignore vault errors, fallback to env config
      console.warn(`[pkg-config] Failed to fetch secrets from Vault: ${String(err)}`);
    }
  }

  propagateEnv(baseConfig);
  return baseConfig;
}
