/**
 * Semantic Versioning comparison utilities for client & frontend apps.
 * Supports standard format: "1.0.0", "v1.0.0", "1.0", "1.0.0-beta.1"
 */
export class VersionUtils {
  /**
   * Parses version string into numeric tuple [major, minor, patch, build]
   */
  public static parseSemver(versionStr: string): [number, number, number] {
    if (!versionStr || typeof versionStr !== 'string') {
      return [0, 0, 0];
    }

    // Strip leading 'v' or 'V' and prerelease identifiers
    const clean = versionStr.trim().replace(/^[vV]/, '').split('-')[0].split('+')[0];
    const parts = clean.split('.').map((p) => {
      const parsed = parseInt(p, 10);
      return isNaN(parsed) ? 0 : parsed;
    });

    return [parts[0] || 0, parts[1] || 0, parts[2] || 0];
  }

  /**
   * Compares two semver strings (v1 vs v2):
   * - Returns -1 if v1 < v2 (v1 is older than v2)
   * - Returns  0 if v1 == v2
   * - Returns  1 if v1 > v2 (v1 is newer than v2)
   */
  public static compareSemver(v1: string, v2: string): number {
    const [maj1, min1, pat1] = this.parseSemver(v1);
    const [maj2, min2, pat2] = this.parseSemver(v2);

    if (maj1 !== maj2) return maj1 > maj2 ? 1 : -1;
    if (min1 !== min2) return min1 > min2 ? 1 : -1;
    if (pat1 !== pat2) return pat1 > pat2 ? 1 : -1;

    return 0;
  }

  /**
   * Determines whether client installed version is outdated compared to latest server release.
   */
  public static isOutdated(installedVersion: string, latestVersion: string): boolean {
    return this.compareSemver(installedVersion, latestVersion) < 0;
  }

  /**
   * Determines whether a forced update is mandatory (installed version is below minimum supported).
   */
  public static isForceUpdateRequired(
    installedVersion: string,
    minimumSupportedVersion: string
  ): boolean {
    return this.compareSemver(installedVersion, minimumSupportedVersion) < 0;
  }
}
