# Database Performance MCP Server

An MCP (Model Context Protocol) server for analyzing database performance for PostgreSQL and DB2 databases.

## Features

### PostgreSQL Performance Analysis
- **Query Analysis**: Analyze slow queries using pg_stat_statements
- **Connection Monitoring**: Track active, idle, and waiting connections
- **Table Statistics**: Monitor table sizes, tuple counts, and vacuum status
- **Lock Analysis**: Identify blocking queries and lock contention
- **Cache Statistics**: Monitor buffer cache hit ratios
- **Index Usage**: Identify unused or rarely used indexes
- **Database Size**: Track database growth

### DB2 Performance Analysis (Requires ibm_db package)
- **Query Performance**: Analyze SQL statement execution
- **Buffer Pool Statistics**: Monitor buffer pool efficiency
- **Tablespace Usage**: Track tablespace utilization
- **Lock Monitoring**: Detect locks and deadlocks
- **Connection Statistics**: Monitor application connections

## Installation

1. Navigate to the server directory:
```bash
cd /Users/ranvijaysingh/Documents/IBM\ Bob/MCP/db-performance-server
```

2. Install dependencies:
```bash
npm install
```

3. Build the server:
```bash
npm run build
```

## Configuration

### 1. Create Database Configuration File

Copy the example configuration:
```bash
cp db-config.example.json db-config.json
```

Edit `db-config.json` with your database connection details:

```json
{
  "databases": {
    "postgres": {
      "enabled": true,
      "connections": [
        {
          "name": "my-postgres-db",
          "host": "localhost",
          "port": 5432,
          "database": "mydb",
          "user": "dbuser",
          "password": "dbpassword",
          "ssl": false,
          "poolSize": 10
        }
      ]
    },
    "db2": {
      "enabled": false,
      "connections": [
        {
          "name": "my-db2-db",
          "host": "localhost",
          "port": 50000,
          "database": "MYDB",
          "user": "db2user",
          "password": "db2password",
          "schema": "MYSCHEMA"
        }
      ]
    }
  },
  "performance": {
    "queryTimeout": 30000,
    "slowQueryThreshold": 1000,
    "enableMetrics": true
  }
}
```

### 2. PostgreSQL Setup

For query analysis, enable the `pg_stat_statements` extension:

```sql
-- Connect to your database as superuser
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Verify installation
SELECT * FROM pg_stat_statements LIMIT 1;
```

Add to `postgresql.conf`:
```
shared_preload_libraries = 'pg_stat_statements'
pg_stat_statements.track = all
```

Restart PostgreSQL after configuration changes.

### 3. Configure MCP Settings

To make the database performance server available in Bob, you need to add it to Bob's MCP settings file.

#### Step 1: Locate or Create MCP Settings File

The MCP settings file is located at `~/.bob/settings/mcp_settings.json`. If it doesn't exist, you'll need to create it.

```bash
# Create the settings directory if it doesn't exist
mkdir -p ~/.bob/settings

# Check if the file exists
ls -la ~/.bob/settings/mcp_settings.json
```

#### Step 2: Create or Edit mcp_settings.json

If the file doesn't exist, create it with the following content:

```bash
# Create new mcp_settings.json file
cat > ~/.bob/settings/mcp_settings.json << 'EOF'
{
  "mcpServers": {
    "db-performance": {
      "command": "node",
      "args": [
        "/Users/ranvijaysingh/Documents/IBM Bob/MCP/db-performance-server/build/index.js"
      ],
      "env": {
        "DB_CONFIG_PATH": "/Users/ranvijaysingh/Documents/IBM Bob/MCP/db-performance-server/db-config.json"
      }
    }
  }
}
EOF
```

If the file already exists and has other MCP servers configured, you need to add the `db-performance` server to the existing `mcpServers` object:

```bash
# Edit existing file
nano ~/.bob/settings/mcp_settings.json
```

Add the `db-performance` entry to the `mcpServers` object:

```json
{
  "mcpServers": {
    "existing-server": {
      "command": "...",
      "args": [...]
    },
    "db-performance": {
      "command": "node",
      "args": [
        "/Users/ranvijaysingh/Documents/IBM Bob/MCP/db-performance-server/build/index.js"
      ],
      "env": {
        "DB_CONFIG_PATH": "/Users/ranvijaysingh/Documents/IBM Bob/MCP/db-performance-server/db-config.json"
      }
    }
  }
}
```

#### Step 3: Verify MCP Settings

Verify the JSON syntax is correct:

```bash
# Check if the JSON is valid
cat ~/.bob/settings/mcp_settings.json | python3 -m json.tool
```

If the command succeeds without errors, your JSON is valid.

#### Step 4: Update Paths (if needed)

**Important**: Update the paths in the configuration to match your actual installation directory:

- Replace `/Users/ranvijaysingh/Documents/IBM Bob/MCP/db-performance-server/` with your actual server directory path
- Ensure the `build/index.js` file exists at the specified location
- Ensure the `db-config.json` file exists at the specified location

To find your actual paths:

```bash
# Get the full path to the server directory
cd /path/to/db-performance-server
pwd

# Verify build file exists
ls -la build/index.js

# Verify config file exists
ls -la db-config.json
```

#### Step 5: Restart Bob

After updating the MCP settings, restart Bob to load the new server:

1. Quit Bob completely
2. Reopen Bob
3. The db-performance MCP server should now be available

#### Verification

To verify the server is loaded correctly:

1. In Bob, try the command: "List all database connections"
2. Check Bob's console/logs for any MCP server errors
3. The server should respond with your configured database connections

## Available Tools

### PostgreSQL Tools

#### analyze_postgres_queries
Analyze slow queries using pg_stat_statements.

**Parameters:**
- `connection` (required): Connection name from config
- `limit` (optional): Number of queries to return (default: 10)

**Example:**
```
Use analyze_postgres_queries on my-postgres-db to show top 20 slow queries
```

#### check_postgres_connections
Monitor connection pool status.

**Parameters:**
- `connection` (required): Connection name from config

**Example:**
```
Check postgres connections for my-postgres-db
```

#### get_postgres_table_stats
Get table statistics including sizes and vacuum info.

**Parameters:**
- `connection` (required): Connection name from config
- `schema` (optional): Schema name (default: public)
- `limit` (optional): Number of tables (default: 20)

**Example:**
```
Show table statistics for my-postgres-db in public schema
```

#### check_postgres_locks
Identify blocking queries and lock contention.

**Parameters:**
- `connection` (required): Connection name from config

**Example:**
```
Check for blocking queries in my-postgres-db
```

#### get_postgres_cache_stats
Monitor buffer cache hit ratios.

**Parameters:**
- `connection` (required): Connection name from config

**Example:**
```
Show cache statistics for my-postgres-db
```

#### get_postgres_index_usage
Analyze index usage to find unused indexes.

**Parameters:**
- `connection` (required): Connection name from config
- `schema` (optional): Schema name (default: public)
- `limit` (optional): Number of indexes (default: 20)

**Example:**
```
Find unused indexes in my-postgres-db
```

#### get_postgres_database_size
Get current database size.

**Parameters:**
- `connection` (required): Connection name from config

**Example:**
```
Show database size for my-postgres-db
```

### DB2 Tools

#### analyze_db2_queries
Analyze DB2 SQL statement performance.

**Note:** Requires `ibm_db` package installation.

**Parameters:**
- `connection` (required): Connection name from config
- `limit` (optional): Number of queries (default: 10)

#### check_db2_bufferpools
Monitor DB2 buffer pool statistics.

**Parameters:**
- `connection` (required): Connection name from config

#### get_db2_tablespace_usage
Check DB2 tablespace utilization.

**Parameters:**
- `connection` (required): Connection name from config

#### check_db2_locks
Monitor DB2 locks and deadlocks.

**Parameters:**
- `connection` (required): Connection name from config

#### get_db2_connection_stats
Get DB2 application connection statistics.

**Parameters:**
- `connection` (required): Connection name from config

### General Tools

#### list_connections
List all configured database connections.

**Example:**
```
List all database connections
```

## DB2 Support

DB2 support requires the `ibm_db` package, which has native dependencies. To enable DB2 support:

1. Install DB2 client libraries on your system
2. Install the ibm_db package:
```bash
npm install ibm_db
```

3. Update your `db-config.json` to enable DB2:
```json
{
  "databases": {
    "db2": {
      "enabled": true,
      "connections": [...]
    }
  }
}
```

## Troubleshooting

### PostgreSQL Connection Issues

1. **Connection refused**: Check if PostgreSQL is running and accessible
2. **Authentication failed**: Verify username and password in config
3. **SSL errors**: Set `ssl: false` for local connections or configure SSL properly

### pg_stat_statements Not Available

If you get an error about pg_stat_statements:

1. Install the extension: `CREATE EXTENSION pg_stat_statements;`
2. Add to postgresql.conf: `shared_preload_libraries = 'pg_stat_statements'`
3. Restart PostgreSQL

### Permission Errors

Ensure your database user has appropriate permissions:

```sql
-- For PostgreSQL
GRANT pg_monitor TO your_user;
GRANT SELECT ON ALL TABLES IN SCHEMA pg_catalog TO your_user;
```

## Security Considerations

1. **Credentials**: Store `db-config.json` securely and never commit it to version control
2. **Permissions**: Use read-only database users when possible
3. **Network**: Use SSL for remote database connections
4. **Access**: Restrict file permissions on config files:
   ```bash
   chmod 600 db-config.json
   ```

## Development

### Build
```bash
npm run build
```

### Watch Mode
```bash
npm run watch
```

### Project Structure
```
db-performance-server/
├── src/
│   └── index.ts          # Main server implementation
├── build/                # Compiled JavaScript
├── db-config.json        # Your database configuration (not in git)
├── db-config.example.json # Example configuration
├── package.json
├── tsconfig.json
└── README.md
```

## License

ISC

## Support

For issues or questions, please refer to the MCP documentation or contact your system administrator.