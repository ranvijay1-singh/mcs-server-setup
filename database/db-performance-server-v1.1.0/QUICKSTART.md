# Quick Start Guide - Database Performance MCP Server

## Your Configuration

Your MCP server has been configured with the following DB2 database:

- **Database**: hvdb
- **Host**: db_host
- **Port**: 50000
- **User**: db2inst1
- **Connection Name**: hvdb-production

## Getting Started

The MCP server is now installed and configured. After restarting Bob, you'll have access to database performance analysis tools.

## Available Commands

### List All Connections
```
List all database connections
```

### DB2 Performance Analysis

**Note**: DB2 tools currently require the `ibm_db` package. To enable full DB2 support:

```bash
cd /Users/ranvijaysingh/Documents/IBM\ Bob/MCP/db-performance-server
npm install ibm_db
npm run build
```

Once `ibm_db` is installed, you can use:

#### Analyze Slow Queries
```
Analyze DB2 queries for hvdb-production
```

#### Check Buffer Pools
```
Check DB2 buffer pools for hvdb-production
```

#### Monitor Tablespace Usage
```
Get DB2 tablespace usage for hvdb-production
```

#### Check for Locks
```
Check DB2 locks for hvdb-production
```

#### Connection Statistics
```
Get DB2 connection stats for hvdb-production
```

## Adding PostgreSQL Support

To add PostgreSQL databases, edit the configuration file:

```bash
nano /Users/ranvijaysingh/Documents/IBM\ Bob/MCP/db-performance-server/db-config.json
```

Add PostgreSQL connections:

```json
{
  "databases": {
    "postgres": {
      "enabled": true,
      "connections": [
        {
          "name": "my-postgres",
          "host": "localhost",
          "port": 5432,
          "database": "mydb",
          "user": "postgres",
          "password": "password",
          "ssl": false,
          "poolSize": 10
        }
      ]
    },
    "db2": {
      "enabled": true,
      "connections": [...]
    }
  }
}
```

Then rebuild:
```bash
cd /Users/ranvijaysingh/Documents/IBM\ Bob/MCP/db-performance-server
npm run build
```

## PostgreSQL Setup (if using PostgreSQL)

Enable the pg_stat_statements extension:

```sql
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
```

Add to postgresql.conf:
```
shared_preload_libraries = 'pg_stat_statements'
pg_stat_statements.track = all
```

Restart PostgreSQL.

## Troubleshooting

### Server Not Showing Up

1. Check if the server is configured:
```bash
cat ~/.bob/settings/mcp_settings.json
```

2. Restart Bob to reload MCP servers

### DB2 Connection Issues

1. Verify network connectivity:
```bash
ping db_host
```

2. Test DB2 port:
```bash
nc -zv db_host 50000
```

3. Check credentials in config file

### Installing ibm_db Package

The `ibm_db` package requires DB2 client libraries. If installation fails:

1. Install DB2 client on your Mac
2. Set environment variables:
```bash
export IBM_DB_HOME=/path/to/db2/client
export LD_LIBRARY_PATH=$IBM_DB_HOME/lib
```

3. Try installing again:
```bash
npm install ibm_db
```

## Security Notes

- The `db-config.json` file contains sensitive credentials
- File permissions are set to protect the config
- Never commit `db-config.json` to version control
- Use read-only database users when possible

## Next Steps

1. Restart Bob to load the MCP server
2. Install `ibm_db` package for full DB2 support
3. Try the "List all database connections" command
4. Explore available performance analysis tools

## Support

For detailed documentation, see:
- README.md - Complete documentation
- db-config.example.json - Configuration examples

For issues:
- Check server logs in Bob's console
- Verify database connectivity
- Ensure credentials are correct
