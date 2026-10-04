/**
 * Regression tests for frontend origin resolution.
 *
 * `FRONTEND_BASE_URL` is also used as a CORS allowlist in some deployments
 * (`https://framebeauty.tn,https://www.framebeauty.tn`). When the whole list was
 * interpolated into links and OAuth redirects, the browser received
 * `https://framebeauty.tn,https://www.framebeauty.tn/auth/google/callback` and
 * failed with DNS_PROBE_FINISHED_NXDOMAIN. These tests pin the normalization to
 * the first entry so the regression cannot come back.
 */

const ENV_KEYS = ['NODE_ENV', 'FRONTEND_BASE_URL', 'GOOGLE_BASE_URL', 'MAGIC_LINK_BASE_URL', 'BACKEND_BASE_URL'] as const;

describe('frontend base URL resolution', () => {
  const saved: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};

  beforeEach(() => {
    ENV_KEYS.forEach(key => {
      saved[key] = process.env[key];
    });
    jest.resetModules();
  });

  afterEach(() => {
    ENV_KEYS.forEach(key => {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    });
  });

  const loadConfig = () => import('./index');

  it('keeps only the first entry of a comma-separated FRONTEND_BASE_URL', async () => {
    process.env.NODE_ENV = 'production';
    process.env.FRONTEND_BASE_URL = 'https://framebeauty.tn,https://www.framebeauty.tn';

    const config = await loadConfig();

    expect(config.FRONTEND_BASE_URL).toBe('https://framebeauty.tn');
    expect(config.FRONTEND_BASE_URL).not.toContain(',');
  });

  it('normalizes the GOOGLE_BASE_URL fallback as well', async () => {
    process.env.NODE_ENV = 'production';
    process.env.FRONTEND_BASE_URL = '';
    process.env.GOOGLE_BASE_URL = 'https://framebeauty.tn, https://www.framebeauty.tn';

    const config = await loadConfig();

    expect(config.FRONTEND_BASE_URL).toBe('https://framebeauty.tn');
  });

  it('normalizes and trims MAGIC_LINK_BASE_URL', async () => {
    process.env.NODE_ENV = 'production';
    process.env.FRONTEND_BASE_URL = 'https://framebeauty.tn';
    process.env.MAGIC_LINK_BASE_URL = ' https://framebeauty.tn , https://www.framebeauty.tn ';

    const config = await loadConfig();

    expect(config.MAGIC_LINK_BASE_URL).toBe('https://framebeauty.tn');
  });

  it('falls back to the normalized FRONTEND_BASE_URL for magic links', async () => {
    process.env.NODE_ENV = 'production';
    process.env.FRONTEND_BASE_URL = 'https://framebeauty.tn,https://www.framebeauty.tn';
    process.env.MAGIC_LINK_BASE_URL = '';

    const config = await loadConfig();

    expect(config.MAGIC_LINK_BASE_URL).toBe('https://framebeauty.tn');
  });

  it('leaves a single origin untouched', async () => {
    process.env.NODE_ENV = 'production';
    process.env.FRONTEND_BASE_URL = 'https://framebeauty.tn';
    process.env.MAGIC_LINK_BASE_URL = '';

    const config = await loadConfig();

    expect(config.FRONTEND_BASE_URL).toBe('https://framebeauty.tn');
    expect(config.MAGIC_LINK_BASE_URL).toBe('https://framebeauty.tn');
  });

  it('normalizes the development branch too', async () => {
    process.env.NODE_ENV = 'development';
    process.env.FRONTEND_BASE_URL = 'http://localhost:2111,http://192.168.1.10:2111';

    const config = await loadConfig();

    expect(config.FRONTEND_BASE_URL).not.toContain(',');
    expect(config.FRONTEND_BASE_URL).toMatch(/^http:\/\/[^:]+:2111$/);
  });
});
