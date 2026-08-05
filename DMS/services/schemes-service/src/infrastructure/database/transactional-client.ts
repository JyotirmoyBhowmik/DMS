import { PostgresDatabaseClient, QueryResult } from '@dms/pkg-database';

export class TransactionalDbClient extends PostgresDatabaseClient {
  constructor(private conn: { query: (sql: string, params?: unknown[]) => Promise<any> }) {
    super();
  }

  override async query<T = unknown>(
    sql: string,
    params?: unknown[],
    _tenantId?: string,
  ): Promise<QueryResult<T>> {
    const res = await this.conn.query(sql, params);
    return {
      rows: (res.rows || []) as T[],
      rowCount: res.rowCount ?? (res.rows?.length || 0),
    };
  }
}
