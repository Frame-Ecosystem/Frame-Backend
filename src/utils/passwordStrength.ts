import zxcvbn from 'zxcvbn';

export type PasswordStrengthLevel = 'weak' | 'medium' | 'strong';

/**
 * Compute password strength using zxcvbn.
 * Maps the raw numeric score (0-4) to a human-readable enum:
 *   0-1 → weak
 *   2   → medium
 *   3-4 → strong
 */
export function computePasswordStrength(password: string): PasswordStrengthLevel {
  const result = zxcvbn(password);
  const score = result.score; // 0-4

  if (score <= 1) return 'weak';
  if (score === 2) return 'medium';
  return 'strong';
}
