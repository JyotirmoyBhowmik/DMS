/**
 * ApiVersion value object that parses and compares API version strings.
 * Supports format 'v{major}' (e.g., 'v1', 'v2').
 */
export class ApiVersion {
  readonly major: number;

  private constructor(major: number) {
    this.major = major;
  }

  /**
   * Parses a version string like 'v1' or 'v2' into an ApiVersion.
   * @throws Error if the format is invalid.
   */
  static parse(version: string): ApiVersion {
    const match = /^v(\d+)$/.exec(version.toLowerCase());
    if (!match || !match[1]) {
      throw new Error(
        `Invalid API version format: '${version}'. Expected format 'v{major}' (e.g., 'v1', 'v2').`,
      );
    }
    const major = parseInt(match[1], 10);
    if (major < 1) {
      throw new Error(`API version major number must be >= 1, got ${major}.`);
    }
    return new ApiVersion(major);
  }

  /**
   * Creates an ApiVersion from a major version number.
   */
  static fromMajor(major: number): ApiVersion {
    if (!Number.isInteger(major) || major < 1) {
      throw new Error(`API version major number must be a positive integer, got ${major}.`);
    }
    return new ApiVersion(major);
  }

  /**
   * Checks equality with another ApiVersion.
   */
  equals(other: ApiVersion): boolean {
    return this.major === other.major;
  }

  /**
   * Checks whether this version is newer than another.
   */
  isNewerThan(other: ApiVersion): boolean {
    return this.major > other.major;
  }

  /**
   * Checks whether this version is older than another.
   */
  isOlderThan(other: ApiVersion): boolean {
    return this.major < other.major;
  }

  /**
   * Returns the string representation (e.g., 'v1').
   */
  toString(): string {
    return `v${this.major}`;
  }
}
