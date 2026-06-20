# MS-SQL Support Documentation

## Overview
The db-performance MCP server now supports Microsoft SQL Server (MS-SQL) in addition to PostgreSQL and DB2.

## Configuration

Add MS-SQL connections to your `db-config.json`:

```json
{
  "databases": {
    "mssql": {
      "enabled": true,
      "connections": [
        {
          "name": "mssql-production",
          "host": "sql-server.example.com",
          "port": 1433,
          "database": "your_database",
          "user": "your_user",
          "password": "your_password",
          "options": {
            "encrypt": true,
            "trustServerCertificate": false
          }
        }
      ]
    }
  }
}
```

## Available MS-SQL Tools

### 1. analyze_mssql_queries
Analyze slow MS-SQL queries using `sys.dm_exec_query_stats`.

**Parameters:**
- `connection` (required): MS-SQL connection name
- `limit` (optional): Number of queries to return (default: 10)

**Returns:** Top queries by execution time with statistics including CPU time, elapsed time, reads, writes, and execution counts.

### 2. check_mssql_connections
Monitor MS-SQL connection statistics by database.

**Parameters:**
- `connection` (required): MS-SQL connection name

**Returns:** Connection counts grouped by database, showing idle and active connections.

### 3. get_mssql_table_stats
Get MS-SQL table statistics including sizes and row counts.

**Parameters:**
- `connection` (required): MS-SQL connection name
- `schema` (optional): Schema name (default: "dbo")
- `limit` (optional): Number of tables to return (default: 20)

**Returns:** Table statistics including row counts, space usage, and index information.

### 4. check_mssql_locks
Identify blocking queries and lock contention in MS-SQL.

**Parameters:**
- `connection` (required): MS-SQL connection name

**Returns:** Lock information including blocking sessions, wait times, and associated queries.

### 5. get_mssql_cache_stats
Monitor MS-SQL buffer cache hit ratios.

**Parameters:**
- `connection` (required): MS-SQL connection name

**Returns:** Buffer cache hit ratio percentage.

### 6. get_mssql_index_usage
Analyze MS-SQL index usage to identify unused or rarely used indexes.

**Parameters:**
- `connection` (required): MS-SQL connection name
- `schema` (optional): Schema name (default: "dbo")
- `limit` (optional): Number of indexes to return (default: 20)

**Returns:** Index usage statistics including seeks, scans, lookups, and updates.

### 7. get_mssql_database_size
Get current MS-SQL database size information.

**Parameters:**
- `connection` (required): MS-SQL connection name

**Returns:** Database size information including used space, allocated space, and free space in MB.

## Connection Options

### encrypt
- **Type:** boolean
- **Default:** true
- **Description:** Enable TLS/SSL encryption for the connection

### trustServerCertificate
- **Type:** boolean
- **Default:** false
- **Description:** Trust self-signed certificates (use with caution in production)

## Example Usage

```javascript
// Analyze slow queries
{
  "tool": "analyze_mssql_queries",
  "arguments": {
    "connection": "mssql-production",
    "limit": 10
  }
}

// Check table statistics
{
  "tool": "get_mssql_table_stats",
  "arguments": {
    "connection": "mssql-production",
    "schema": "dbo",
    "limit": 20
  }
}

// Monitor locks
{
  "tool": "check_mssql_locks",
  "arguments": {
    "connection": "mssql-production"
  }
}
```

## Requirements

- Node.js 14+
- `mssql` npm package (automatically installed)
- Network access to MS-SQL server
- Valid MS-SQL credentials with appropriate permissions

## Permissions Required

The MS-SQL user needs the following permissions:
- `VIEW SERVER STATE` - For DMV queries
- `VIEW DATABASE STATE` - For database-specific queries
- `SELECT` on system views

## Troubleshooting

### Connection Issues
- Verify firewall allows port 1433 (or your custom port)
- Check if TCP/IP is enabled in SQL Server Configuration Manager
- Ensure SQL Server Browser service is running (for named instances)

### Authentication Issues
- Verify SQL Server authentication mode (Windows or Mixed)
- Check user credentials and permissions
- For Windows authentication, use domain\username format

### SSL/TLS Issues
- Set `trustServerCertificate: true` for self-signed certificates (development only)
- Install proper SSL certificates for production environments

## Version History

- **v1.1.0** - Added MS-SQL support with 7 performance monitoring tools