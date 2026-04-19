import fs from 'fs';
import path from 'path';
import YAML from 'yamljs';

// Resolve to project root's swagger/ dir (works from both src/ and dist/)
const SWAGGER_DIR = path.join(__dirname, '..', '..', 'swagger');

/** Path-only YAML files (everything except base.yaml). */
const PATH_FILES = [
  'auth',
  'currentUser',
  'admin',
  'adminServices',
  'loungeVisitorProfile',
  'agents',
  'lounge',
  'loungeServices',
  'catalogServices',
  'serviceCategories',
  'serviceSuggestions',
  'bookings',
  'queues',
  'notifications',
  'ratings',
  'likes',
  'follows',
  'clientVisitorProfile',
  'posts',
  'reels',
  'comments',
  'feed',
  'reports',
];

/**
 * Merge `swagger/base.yaml` with each domain-specific paths file
 * and return a complete OpenAPI 3.0 document object.
 */
export function buildSwaggerDocument(): Record<string, any> {
  const base = YAML.load(path.join(SWAGGER_DIR, 'base.yaml'));

  for (const name of PATH_FILES) {
    const filePath = path.join(SWAGGER_DIR, `${name}.yaml`);
    if (!fs.existsSync(filePath)) continue;
    const paths: Record<string, any> = YAML.load(filePath);
    Object.assign(base.paths, paths);
  }

  return base;
}
