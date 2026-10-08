import { resolvePostgresConnection } from '../database/pg-connection';

export default () => {
  const connection = resolvePostgresConnection();

  return {
    database: {
      url: connection.url,
      host: connection.host,
      port: connection.port,
      username: connection.username,
      password: connection.password,
      name: connection.database,
      ssl: connection.ssl,
    },
  };
};
