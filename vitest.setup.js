// Inject dummy secrets into process.env for all tests to pass
process.env.PLATFORM_KEK_SECRET = 'dummy-platform-kek-secret-for-testing';
process.env.LEGACY_PLATFORM_KEK_SECRET = 'dummy-legacy-kek-secret-for-testing';
