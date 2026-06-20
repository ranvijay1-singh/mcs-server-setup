# DB2 MCP Server Setup Guide

Complete guide for creating and hosting a DB2 Model Context Protocol (MCP) server for database performance monitoring and analysis.

## Table of Contents
- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Installation Steps](#installation-steps)
- [Configuration](#configuration)
- [Available DB2 Tools](#available-db2-tools)
- [Hosting Options](#hosting-options)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)
- [Security Best Practices](#security-best-practices)

## Overview

The DB2 MCP Server provides a standardized interface for monitoring and analyzing DB2 database performance through the Model Context Protocol. It enables AI assistants and automation tools to interact with DB2 databases for performance analysis.

### Key Features
- **Query Performance Analysis**: Identify slow-running SQL statements
- **Buffer Pool Monitoring**: Track memory efficiency and hit ratios
- **Tablespace Management**: Monitor space utilization
- **Lock Detection**: Identify blocking queries and deadlocks
- **Connection Monitoring**: Track active connections and pool health
- **Table Maintenance**: Identify tables needing REORG or RUNSTATS

## Prerequisites

### System Requirements
- **Node.js**: Version 18.0 or higher
- **npm**: Version 8.0 or higher
- **Operating System**: macOS, Linux, or Windows

### DB2 Requirements
- **DB2 Client Libraries**: Must be installed on the system
- **DB2 Instance**: Access to a DB2 database instance
- **Database Credentials**: User account with monitoring privileges
- **Network Access**: Connectivity to DB2 server (default port: 50000)

### Required Permissions
Your DB2 user needs the following privileges:
```sql
-- Monitor privileges
GRANT DBADM ON DATABASE TO USER your_user;
-- Or minimum required:
GRANT SELECT ON SYSIBMADM.MON_DB_SUMMARY TO USER your_user;
GRANT SELECT ON SYSIBMADM.SNAPDB TO USER your_user;
GRANT SELECT ON SYSIBMADM.TBSP_UTILIZATION TO USER your_user;
GRANT SELECT ON SYSIBMADM.APPLICATIONS TO USER your_user;
GRANT SELECT ON SYSCAT.TABLES TO USER your_user;
```

## DB2 Client Installation

Before installing the MCP server, you must install the IBM DB2 client libraries. The `ibm_db` npm package requires these native libraries to connect to DB2 databases.

### Option 1: IBM Data Server Driver Package (Recommended)

The IBM Data Server Driver Package is a lightweight client that provides the necessary libraries without requiring a full DB2 installation.

#### macOS Installation

1. **Download IBM Data Server Driver**
   ```bash
   # Visit IBM's website to download the driver
   # https://www.ibm.com/support/pages/download-initial-version-115-clients-and-drivers
   
   # Or use direct download (requires IBM ID)
   # Download: ibm_data_server_driver_package_linuxx64_v11.5.tar.gz (for macOS use Linux x64)
   ```

2. **Extract and Install**
   ```bash
   # Extract the package
   tar -xzf ibm_data_server_driver_package_linuxx64_v11.5.tar.gz
   
   # Move to installation directory
   sudo mv dsdriver /opt/ibm/db2/dsdriver
   
   # Set permissions
   sudo chmod -R 755 /opt/ibm/db2/dsdriver
   ```

3. **Set Environment Variables**
   ```bash
   # Add to ~/.bash_profile or ~/.zshrc
   export IBM_DB_HOME=/opt/ibm/db2/dsdriver
   export IBM_DB_LIB=/opt/ibm/db2/dsdriver/lib
   export IBM_DB_INCLUDE=/opt/ibm/db2/dsdriver/include
   export DYLD_LIBRARY_PATH=$IBM_DB_LIB:$DYLD_LIBRARY_PATH
   export PATH=$IBM_DB_HOME/bin:$PATH
   
   # Reload shell configuration
   source ~/.bash_profile  # or source ~/.zshrc
   ```

4. **Verify Installation**
   ```bash
   # Check if db2level command works
   db2level
   
   # Should output DB2 version information
   ```

#### Linux Installation

1. **Download IBM Data Server Driver**
   ```bash
   # Download from IBM website
   wget https://public.dhe.ibm.com/ibmdl/export/pub/software/data/db2/drivers/odbc_cli/linuxx64_odbc_cli.tar.gz
   
   # Or download the full driver package
   # https://www.ibm.com/support/pages/download-initial-version-115-clients-and-drivers
   ```

2. **Extract and Install**
   ```bash
   # Extract
   tar -xzf linuxx64_odbc_cli.tar.gz
   
   # Move to installation directory
   sudo mkdir -p /opt/ibm/db2
   sudo mv clidriver /opt/ibm/db2/
   
   # Set permissions
   sudo chmod -R 755 /opt/ibm/db2/clidriver
   ```

3. **Set Environment Variables**
   ```bash
   # Add to ~/.bashrc or ~/.profile
   export IBM_DB_HOME=/opt/ibm/db2/clidriver
   export IBM_DB_LIB=/opt/ibm/db2/clidriver/lib
   export IBM_DB_INCLUDE=/opt/ibm/db2/clidriver/include
   export LD_LIBRARY_PATH=$IBM_DB_LIB:$LD_LIBRARY_PATH
   export PATH=$IBM_DB_HOME/bin:$PATH
   
   # Reload configuration
   source ~/.bashrc
   ```

4. **Install Required System Libraries**
   ```bash
   # Ubuntu/Debian
   sudo apt-get update
   sudo apt-get install -y libaio1 libpam0g libstdc++6
   
   # RHEL/CentOS
   sudo yum install -y libaio pam
   
   # Fedora
   sudo dnf install -y libaio pam
   ```

5. **Verify Installation**
   ```bash
   # Test db2level
   db2level
   
   # Check library path
   echo $LD_LIBRARY_PATH
   ```

#### Windows Installation

1. **Download IBM Data Server Driver**
   - Visit: https://www.ibm.com/support/pages/download-initial-version-115-clients-and-drivers
   - Download: `v11.5.9_ntx64_dsdriver_EN.exe`

2. **Run Installer**
   ```powershell
   # Run the downloaded installer
   # Follow the installation wizard
   # Default installation path: C:\Program Files\IBM\IBM DATA SERVER DRIVER
   ```

3. **Set Environment Variables**
   ```powershell
   # Open PowerShell as Administrator
   
   # Set system environment variables
   [System.Environment]::SetEnvironmentVariable("IBM_DB_HOME", "C:\Program Files\IBM\IBM DATA SERVER DRIVER", "Machine")
   [System.Environment]::SetEnvironmentVariable("IBM_DB_LIB", "C:\Program Files\IBM\IBM DATA SERVER DRIVER\bin", "Machine")
   [System.Environment]::SetEnvironmentVariable("IBM_DB_INCLUDE", "C:\Program Files\IBM\IBM DATA SERVER DRIVER\include", "Machine")
   
   # Add to PATH
   $path = [System.Environment]::GetEnvironmentVariable("Path", "Machine")
   $newPath = $path + ";C:\Program Files\IBM\IBM DATA SERVER DRIVER\bin"
   [System.Environment]::SetEnvironmentVariable("Path", $newPath, "Machine")
   
   # Restart PowerShell to apply changes
   ```

4. **Verify Installation**
   ```powershell
   # Check db2level
   db2level
   
   # Should display DB2 version information
   ```

### Option 2: Full DB2 Client Installation

If you need full DB2 client functionality, install the complete DB2 client.

#### Download DB2 Client

1. Visit IBM Fix Central: https://www.ibm.com/support/fixcentral/
2. Select:
   - Product: DB2
   - Platform: Your OS
   - Version: 11.5 (or your DB2 server version)
3. Download the appropriate client package

#### Installation Steps

**Linux/macOS:**
```bash
# Extract the package
tar -xzf DB2_Client_11.5_Linux_x86-64.tar.gz

# Run installer
cd client
sudo ./db2_install

# Follow prompts:
# - Select "CLIENT" installation type
# - Choose installation directory (default: /opt/ibm/db2/V11.5)
# - Accept license

# Create DB2 instance (if needed)
sudo /opt/ibm/db2/V11.5/instance/db2icrt -u db2inst1 db2inst1
```

**Windows:**
```powershell
# Run the installer executable
# setup.exe

# Follow the installation wizard:
# 1. Select "Install a Product"
# 2. Choose "DB2 Client"
# 3. Select installation directory
# 4. Configure instance (optional)
# 5. Complete installation
```

### Option 3: Using Docker (Development Only)

For development and testing, you can use a Docker container with DB2 client pre-installed.

```dockerfile
FROM node:18

# Install DB2 client dependencies
RUN apt-get update && apt-get install -y \
    wget \
    libaio1 \
    libpam0g \
    libstdc++6 \
    && rm -rf /var/lib/apt/lists/*

# Download and install DB2 driver
RUN wget https://public.dhe.ibm.com/ibmdl/export/pub/software/data/db2/drivers/odbc_cli/linuxx64_odbc_cli.tar.gz \
    && tar -xzf linuxx64_odbc_cli.tar.gz \
    && mv clidriver /opt/ibm/db2/ \
    && rm linuxx64_odbc_cli.tar.gz

# Set environment variables
ENV IBM_DB_HOME=/opt/ibm/db2/clidriver
ENV IBM_DB_LIB=/opt/ibm/db2/clidriver/lib
ENV IBM_DB_INCLUDE=/opt/ibm/db2/clidriver/include
ENV LD_LIBRARY_PATH=$IBM_DB_LIB:$LD_LIBRARY_PATH
ENV PATH=$IBM_DB_HOME/bin:$PATH

WORKDIR /app
```

### Verify DB2 Client Installation

After installation, verify the DB2 client is properly configured:

```bash
# Check DB2 version
db2level

# Expected output:
# DB11.5.9.0, s2309201300, DYN2309201300AMD64, Fix Pack 0

# Test connection to DB2 server
db2 connect to SAMPLE user db2inst1

# If successful, you'll see:
# Database Connection Information
# Database server        = DB2/LINUXX8664 11.5.9.0
# SQL authorization ID   = DB2INST1
# Local database alias   = SAMPLE

# Disconnect
db2 disconnect SAMPLE
```

### Common Installation Issues

#### Issue 1: Library Not Found
```bash
# Error: libdb2.so.1: cannot open shared object file

# Solution: Update library cache (Linux)
sudo ldconfig

# Or add library path
export LD_LIBRARY_PATH=/opt/ibm/db2/clidriver/lib:$LD_LIBRARY_PATH
```

#### Issue 2: Permission Denied
```bash
# Error: Permission denied accessing DB2 files

# Solution: Fix permissions
sudo chmod -R 755 /opt/ibm/db2/clidriver
sudo chown -R $USER:$USER /opt/ibm/db2/clidriver
```

#### Issue 3: db2level Command Not Found
```bash
# Error: db2level: command not found

# Solution: Add DB2 bin to PATH
export PATH=/opt/ibm/db2/clidriver/bin:$PATH

# Make permanent by adding to ~/.bashrc or ~/.zshrc
echo 'export PATH=/opt/ibm/db2/clidriver/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
```

#### Issue 4: Architecture Mismatch (macOS)
```bash
# Error: Mach-O file, but is an incompatible architecture

# Solution: Install Rosetta 2 for Apple Silicon Macs
softwareupdate --install-rosetta

# Or use x86_64 architecture
arch -x86_64 npm install ibm_db
```

### Post-Installation Configuration

#### Configure DB2 Client for Remote Connections

1. **Catalog the remote database:**
```bash
# Catalog the node (server)
db2 catalog tcpip node MYNODE remote db2server.example.com server 50000

# Catalog the database
db2 catalog database PRODDB as PRODDB at node MYNODE

# Test connection
db2 connect to PRODDB user db2inst1
```

2. **Configure SSL (if required):**
```bash
# Set SSL keystore location
db2 update dbm cfg using SSL_CLNT_KEYDB /path/to/keystore.kdb

# Set SSL certificate label
db2 update dbm cfg using SSL_CLNT_STASH /path/to/keystore.sth
```

3. **Test connectivity:**
```bash
# Test with db2cli
db2cli validate -dsn PRODDB -connect -user db2inst1 -passwd yourpassword
```

## Installation Steps

### Step 1: Create Project Directory
```bash
# Create a new directory for your MCP server
mkdir db2-mcp-server
cd db2-mcp-server

# Initialize npm project
npm init -y
```

### Step 2: Install Dependencies
```bash
# Install MCP SDK and DB2 driver
npm install @modelcontextprotocol/sdk ibm_db zod

# Install development dependencies
npm install --save-dev typescript @types/node
```

**Note**: The `ibm_db` package requires native compilation. Ensure you have:
- Python 2.7 or 3.x
- C++ compiler (gcc/g++ on Linux, Xcode on macOS, Visual Studio on Windows)
- DB2 client libraries installed and accessible

### Step 3: Configure TypeScript
Create `tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "./build",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "build"]
}
```

### Step 4: Update package.json
Add scripts to `package.json`:
```json
{
  "name": "db2-mcp-server",
  "version": "1.0.0",
  "description": "MCP server for DB2 database performance monitoring",
  "type": "module",
  "main": "build/index.js",
  "bin": {
    "db2-mcp-server": "build/index.js"
  },
  "scripts": {
    "build": "tsc && node -e \"require('fs').chmodSync('build/index.js', '755')\"",
    "watch": "tsc --watch",
    "prepare": "npm run build"
  },
  "keywords": ["mcp", "db2", "database", "performance", "monitoring"],
  "license": "ISC",
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.4",
    "ibm_db": "^4.0.0",
    "zod": "^3.24.1"
  },
  "devDependencies": {
    "@types/node": "^22.10.2",
    "typescript": "^5.7.2"
  }
}
```

### Step 5: Create Source Directory
```bash
mkdir src
```

### Step 6: Implement MCP Server
Create `src/index.ts` with the following structure:

```typescript
#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import * as ibmdb from 'ibm_db';
import { readFileSync } from 'fs';
import { z } from 'zod';

// Configuration schema
const ConfigSchema = z.object({
  databases: z.object({
    db2: z.object({
      enabled: z.boolean(),
      connections: z.array(z.object({
        name: z.string(),
        host: z.string(),
        port: z.number(),
        database: z.string(),
        user: z.string(),
        password: z.string(),
        schema: z.string().optional(),
      })),
    }),
  }),
});

// Load configuration
const configPath = process.env.DB_CONFIG_PATH || './db-config.json';
const config = ConfigSchema.parse(JSON.parse(readFileSync(configPath, 'utf-8')));

// DB2 connection helper
function getDB2ConnectionString(conn: any): string {
  return `DATABASE=${conn.database};HOSTNAME=${conn.host};PORT=${conn.port};PROTOCOL=TCPIP;UID=${conn.user};PWD=${conn.password};`;
}

// Initialize MCP server
const server = new Server(
  {
    name: 'db2-performance-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Register DB2 tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'analyze_db2_queries',
        description: 'Analyze DB2 SQL statement performance to identify slow queries',
        inputSchema: {
          type: 'object',
          properties: {
            connection: {
              type: 'string',
              description: 'DB2 connection name from config',
            },
            limit: {
              type: 'number',
              description: 'Number of queries to return (default: 10)',
              default: 10,
            },
          },
          required: ['connection'],
        },
      },
      {
        name: 'check_db2_bufferpools',
        description: 'Monitor DB2 buffer pool statistics and efficiency',
        inputSchema: {
          type: 'object',
          properties: {
            connection: {
              type: 'string',
              description: 'DB2 connection name from config',
            },
          },
          required: ['connection'],
        },
      },
      {
        name: 'get_db2_tablespace_usage',
        description: 'Check DB2 tablespace utilization to prevent space issues',
        inputSchema: {
          type: 'object',
          properties: {
            connection: {
              type: 'string',
              description: 'DB2 connection name from config',
            },
          },
          required: ['connection'],
        },
      },
      {
        name: 'check_db2_locks',
        description: 'Monitor DB2 locks and deadlocks to identify concurrency issues',
        inputSchema: {
          type: 'object',
          properties: {
            connection: {
              type: 'string',
              description: 'DB2 connection name from config',
            },
          },
          required: ['connection'],
        },
      },
      {
        name: 'get_db2_connection_stats',
        description: 'Retrieve DB2 application connection statistics',
        inputSchema: {
          type: 'object',
          properties: {
            connection: {
              type: 'string',
              description: 'DB2 connection name from config',
            },
          },
          required: ['connection'],
        },
      },
      {
        name: 'check_db2_table_stats',
        description: 'Identify DB2 tables needing maintenance (REORG or RUNSTATS)',
        inputSchema: {
          type: 'object',
          properties: {
            connection: {
              type: 'string',
              description: 'DB2 connection name from config',
            },
            schema: {
              type: 'string',
              description: 'Schema name (default: DB2INST1)',
              default: 'DB2INST1',
            },
          },
          required: ['connection'],
        },
      },
    ],
  };
});

// Tool execution handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  // Find connection
  const conn = config.databases.db2.connections.find(
    (c) => c.name === args.connection
  );
  
  if (!conn) {
    throw new Error(`Connection '${args.connection}' not found`);
  }
  
  const connStr = getDB2ConnectionString(conn);
  
  try {
    switch (name) {
      case 'analyze_db2_queries':
        return await analyzeDB2Queries(connStr, args.limit || 10);
      case 'check_db2_bufferpools':
        return await checkDB2BufferPools(connStr);
      case 'get_db2_tablespace_usage':
        return await getDB2TablespaceUsage(connStr);
      case 'check_db2_locks':
        return await checkDB2Locks(connStr);
      case 'get_db2_connection_stats':
        return await getDB2ConnectionStats(connStr);
      case 'check_db2_table_stats':
        return await checkDB2TableStats(connStr, args.schema || 'DB2INST1');
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error.message}`,
        },
      ],
    };
  }
});

// Implement tool functions (examples)
async function analyzeDB2Queries(connStr: string, limit: number) {
  return new Promise((resolve, reject) => {
    ibmdb.open(connStr, (err, conn) => {
      if (err) return reject(err);
      
      const query = `
        SELECT 
          STMT_TEXT,
          NUM_EXECUTIONS,
          TOTAL_CPU_TIME,
          TOTAL_CPU_TIME / NULLIF(NUM_EXECUTIONS, 0) as AVG_CPU_TIME,
          ROWS_READ,
          ROWS_WRITTEN
        FROM SYSIBMADM.MON_DB_SUMMARY
        WHERE NUM_EXECUTIONS > 0
        ORDER BY TOTAL_CPU_TIME DESC
        FETCH FIRST ${limit} ROWS ONLY
      `;
      
      conn.query(query, (err, rows) => {
        conn.close();
        if (err) return reject(err);
        
        resolve({
          content: [
            {
              type: 'text',
              text: JSON.stringify(rows, null, 2),
            },
          ],
        });
      });
    });
  });
}

async function checkDB2BufferPools(connStr: string) {
  // Implementation similar to analyzeDB2Queries
  // Query buffer pool statistics
}

async function getDB2TablespaceUsage(connStr: string) {
  // Implementation for tablespace usage
}

async function checkDB2Locks(connStr: string) {
  // Implementation for lock monitoring
}

async function getDB2ConnectionStats(connStr: string) {
  // Implementation for connection statistics
}

async function checkDB2TableStats(connStr: string, schema: string) {
  // Implementation for table statistics
}

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('DB2 MCP server running on stdio');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
```

### Step 7: Build the Server
```bash
npm run build
```

## Configuration

### Create Database Configuration File

Create `db-config.json`:
```json
{
  "databases": {
    "db2": {
      "enabled": true,
      "connections": [
        {
          "name": "production-db2",
          "host": "db2server.example.com",
          "port": 50000,
          "database": "PRODDB",
          "user": "db2inst1",
          "password": "your-secure-password",
          "schema": "DB2INST1"
        },
        {
          "name": "test-db2",
          "host": "localhost",
          "port": 50000,
          "database": "TESTDB",
          "user": "db2inst1",
          "password": "test-password",
          "schema": "DB2INST1"
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

### Secure Configuration File
```bash
# Set restrictive permissions
chmod 600 db-config.json

# Add to .gitignore
echo "db-config.json" >> .gitignore
```

## Available DB2 Tools

### 1. analyze_db2_queries
Identifies slow-running SQL statements.

**Usage:**
```
Analyze DB2 queries for production-db2 showing top 20
```

**Returns:**
- Statement text
- Execution count
- Total/average CPU time
- Rows read/written

### 2. check_db2_bufferpools
Monitors buffer pool efficiency.

**Usage:**
```
Check DB2 buffer pools for production-db2
```

**Returns:**
- Buffer pool name
- Hit ratio
- Physical reads
- Logical reads

### 3. get_db2_tablespace_usage
Tracks tablespace capacity.

**Usage:**
```
Get DB2 tablespace usage for production-db2
```

**Returns:**
- Tablespace name
- Total size
- Used space
- Free space percentage

### 4. check_db2_locks
Detects locks and deadlocks.

**Usage:**
```
Check DB2 locks for production-db2
```

**Returns:**
- Lock holder
- Lock waiter
- Lock type
- Duration

### 5. get_db2_connection_stats
Monitors active connections.

**Usage:**
```
Get DB2 connection stats for production-db2
```

**Returns:**
- Active connections
- Idle connections
- Connection pool status

### 6. check_db2_table_stats
Identifies tables needing maintenance.

**Usage:**
```
Check DB2 table stats for production-db2 in schema DB2INST1
```

**Returns:**
- Tables needing REORG
- Tables needing RUNSTATS
- Fragmentation levels

## Hosting Options

### Option 1: Local Stdio (Recommended for Development)

Configure in `~/.bob/settings/mcp_settings.json`:
```json
{
  "mcpServers": {
    "db2-performance": {
      "command": "node",
      "args": [
        "/path/to/db2-mcp-server/build/index.js"
      ],
      "env": {
        "DB_CONFIG_PATH": "/path/to/db2-mcp-server/db-config.json"
      }
    }
  }
}
```

**Pros:**
- Simple setup
- No network configuration
- Direct process communication

**Cons:**
- Single user only
- Runs on local machine

### Option 2: Remote HTTP/SSE (Production)

For multi-user or remote access:

1. **Create HTTP wrapper:**
```typescript
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import express from 'express';

const app = express();
const port = 3000;

app.post('/mcp', async (req, res) => {
  const transport = new SSEServerTransport('/mcp', res);
  await server.connect(transport);
});

app.listen(port, () => {
  console.log(`MCP server listening on port ${port}`);
});
```

2. **Configure client:**
```json
{
  "mcpServers": {
    "db2-performance": {
      "url": "https://your-server.com/mcp",
      "transport": "sse"
    }
  }
}
```

**Pros:**
- Multi-user support
- Remote access
- Centralized deployment

**Cons:**
- Requires web server
- Network security considerations
- More complex setup

### Option 3: Docker Container

Create `Dockerfile`:
```dockerfile
FROM node:18-alpine

WORKDIR /app

# Install DB2 client libraries
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

CMD ["node", "build/index.js"]
```

Build and run:
```bash
docker build -t db2-mcp-server .
docker run -v /path/to/db-config.json:/app/db-config.json db2-mcp-server
```

## Testing

### Test Connection
```bash
# Test DB2 connectivity
db2 connect to PRODDB user db2inst1

# Verify permissions
db2 "SELECT * FROM SYSIBMADM.MON_DB_SUMMARY FETCH FIRST 1 ROW ONLY"
```

### Test MCP Server
```bash
# Run server in test mode
node build/index.js

# In another terminal, send test request
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node build/index.js
```

### Integration Test
Use the MCP server through Bob or another MCP client:
```
List all database connections
Analyze DB2 queries for production-db2
```

## Troubleshooting

### ibm_db Installation Fails

**Problem:** Native module compilation errors

**Solutions:**
```bash
# Install build tools (macOS)
xcode-select --install

# Install build tools (Linux)
sudo apt-get install python3 build-essential

# Set DB2 environment
export IBM_DB_HOME=/opt/ibm/db2/V11.5
export LD_LIBRARY_PATH=$IBM_DB_HOME/lib:$LD_LIBRARY_PATH

# Retry installation
npm install ibm_db
```

### Connection Timeout

**Problem:** Cannot connect to DB2 server

**Solutions:**
```bash
# Test network connectivity
ping db2server.example.com
nc -zv db2server.example.com 50000

# Check firewall rules
# Verify DB2 is listening
db2 get dbm cfg | grep SVCENAME

# Test with db2 CLI
db2 connect to PRODDB user db2inst1
```

### Permission Denied

**Problem:** User lacks monitoring privileges

**Solution:**
```sql
-- Grant required permissions
GRANT DBADM ON DATABASE TO USER db2inst1;

-- Or minimum required
GRANT SELECT ON SYSIBMADM.MON_DB_SUMMARY TO USER db2inst1;
GRANT SELECT ON SYSIBMADM.SNAPDB TO USER db2inst1;
GRANT SELECT ON SYSIBMADM.TBSP_UTILIZATION TO USER db2inst1;
```

### Server Not Responding

**Problem:** MCP server doesn't respond to requests

**Solutions:**
```bash
# Check server logs
tail -f ~/.bob/logs/mcp-server.log

# Verify configuration
cat ~/.bob/settings/mcp_settings.json

# Restart Bob
# Kill and restart the application

# Test server directly
node build/index.js
```

## Security Best Practices

### 1. Credential Management
```bash
# Never commit credentials
echo "db-config.json" >> .gitignore

# Use environment variables
export DB2_PASSWORD="secure-password"

# Or use secrets management
# - AWS Secrets Manager
# - HashiCorp Vault
# - Azure Key Vault
```

### 2. File Permissions
```bash
# Restrict config file access
chmod 600 db-config.json
chown your-user:your-group db-config.json
```

### 3. Network Security
- Use SSL/TLS for remote connections
- Implement firewall rules
- Use VPN for production access
- Enable DB2 SSL: `SECURITY SSL`

### 4. Database User Permissions
```sql
-- Create read-only monitoring user
CREATE USER db2monitor;
GRANT CONNECT ON DATABASE TO USER db2monitor;
GRANT SELECT ON SYSIBMADM.MON_DB_SUMMARY TO USER db2monitor;
-- Grant only required monitoring views
```

### 5. Audit Logging
```sql
-- Enable DB2 audit
UPDATE DBM CFG USING AUDIT_BUF_SZ 1000;
AUDIT DATABASE USING POLICY MONITORING;
```

## Advanced Configuration

### Connection Pooling
```json
{
  "databases": {
    "db2": {
      "pooling": {
        "enabled": true,
        "min": 2,
        "max": 10,
        "idleTimeout": 30000
      }
    }
  }
}
```

### Query Timeout
```json
{
  "performance": {
    "queryTimeout": 30000,
    "slowQueryThreshold": 1000,
    "maxRetries": 3
  }
}
```

### Monitoring Intervals
```json
{
  "monitoring": {
    "enabled": true,
    "interval": 60000,
    "metrics": ["queries", "locks", "connections"]
  }
}
```

## Maintenance

### Regular Tasks
```bash
# Update dependencies
npm update

# Rebuild server
npm run build

# Check for security vulnerabilities
npm audit
npm audit fix

# Update DB2 client
# Follow IBM DB2 client update procedures
```

### Monitoring
```bash
# Monitor server logs
tail -f logs/mcp-server.log

# Check resource usage
ps aux | grep node
top -p $(pgrep -f db2-mcp-server)

# Monitor DB2 connections
db2 list applications
```

## Support and Resources

### Documentation
- [MCP SDK Documentation](https://github.com/modelcontextprotocol/sdk)
- [IBM DB2 Documentation](https://www.ibm.com/docs/en/db2)
- [ibm_db Package](https://github.com/ibmdb/node-ibm_db)

### Community
- MCP Discord Server
- IBM DB2 Community Forums
- Stack Overflow: `[db2]` `[mcp]` tags

### Troubleshooting Checklist
- [ ] DB2 client libraries installed
- [ ] Network connectivity verified
- [ ] Database credentials correct
- [ ] User has required permissions
- [ ] Configuration file valid JSON
- [ ] Server built successfully
- [ ] MCP settings configured
- [ ] Bob/client restarted

## License

ISC

---

**Created:** 2026-04-14  
**Version:** 1.0.0  
**Maintainer:** Your Team