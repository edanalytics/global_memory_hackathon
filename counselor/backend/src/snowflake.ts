import snowflake from "snowflake-sdk";

let connection: snowflake.Connection | null = null;

export function getConnection(): Promise<snowflake.Connection> {
  if (connection) return Promise.resolve(connection);

  return new Promise((resolve, reject) => {
    const conn = snowflake.createConnection({
      account: process.env.SNOWFLAKE_ACCOUNT!,
      username: process.env.SNOWFLAKE_USERNAME!,
      password: process.env.SNOWFLAKE_PASSWORD!,
      database: process.env.SNOWFLAKE_DATABASE!,
      warehouse: process.env.SNOWFLAKE_WAREHOUSE!,
    });

    conn.connect((err) => {
      if (err) {
        console.error("Snowflake connection failed:", err.message);
        reject(err);
      } else {
        connection = conn;
        console.log("Connected to Snowflake");
        resolve(conn);
      }
    });
  });
}

export function query<T = any>(sql: string, binds: any[] = []): Promise<T[]> {
  return new Promise(async (resolve, reject) => {
    const conn = await getConnection();
    conn.execute({
      sqlText: sql,
      binds,
      complete: (err, _stmt, rows) => {
        if (err) reject(err);
        else resolve((rows || []) as T[]);
      },
    });
  });
}
