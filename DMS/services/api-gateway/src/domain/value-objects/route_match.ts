import { Route } from '../entities/route.js';

/**
 * RouteMatch value object encapsulating a matched route and its extracted parameters.
 * Immutable — all properties are readonly.
 */
export class RouteMatch {
  readonly route: Route;
  readonly params: Readonly<Record<string, string>>;
  readonly wildcardPath: string | null;

  private constructor(props: {
    route: Route;
    params: Record<string, string>;
    wildcardPath: string | null;
  }) {
    this.route = props.route;
    this.params = Object.freeze({ ...props.params });
    this.wildcardPath = props.wildcardPath;
  }

  /**
   * Factory method to create a new RouteMatch.
   */
  static create(
    route: Route,
    params: Record<string, string> = {},
    wildcardPath: string | null = null,
  ): RouteMatch {
    return new RouteMatch({ route, params, wildcardPath });
  }

  /**
   * Builds the resolved target path by replacing param placeholders
   * in the route's targetPath with the extracted values.
   */
  resolveTargetPath(): string {
    let resolved = this.route.targetPath;
    for (const [key, value] of Object.entries(this.params)) {
      resolved = resolved.replace(`:${key}`, value);
    }
    if (this.wildcardPath !== null) {
      resolved = resolved.replace('*', this.wildcardPath);
    }
    return resolved;
  }
}
