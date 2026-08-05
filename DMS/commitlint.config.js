module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      2,
      'always',
      [
        'platform',
        'pkg-crypto',
        'pkg-events',
        'pkg-http',
        'pkg-rbac',
        'pkg-logger',
        'pkg-validation',
        'pkg-database',
        'pkg-testing',
        'pkg-ui-shared',
        'pkg-config-client',
        'dms-core-service',
        'sfa-service',
        'sync-service',
        'audit-service',
        'identity-service',
        'notification-service',
        'forecasting-service',
        'recommendation-service',
        'api-gateway',
        'ai-gateway-service',
        'config-service',
        'file-service',
        'report-service',
        'web-admin',
        'mobile-rn',
        'mobile-flutter',
        'infra',
        'deps',
        'release'
      ]
    ]
  }
};
