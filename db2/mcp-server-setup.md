# DB2 MCP Server Setup Guide for macOS

Complete step-by-step guide to configure the Database Performance MCP Server for DB2 on macOS.

## Table of Contents
- [Prerequisites](#prerequisites)
- [Step 1: Create Database Configuration File](#step-1-create-database-configuration-file)
- [Step 2: Configure DB2 Connection Details](#step-2-configure-db2-connection-details)
- [Step 3: Install ibm_db Package](#step-3-install-ibm_db-package)
- [Step 4: Build the MCP Server](#step-4-build-the-mcp-server)
- [Step 5: Create MCP Settings File](#step-5-create-mcp-settings-file)
- [Step 6: Add MCP Server Configuration](#step-6-add-mcp-server-configuration)
- [Step 7: Validate Configuration](#step-7-validate-configuration)
- [Step 8: Test DB2 Connection](#step-8-test-db2-connection)
- [Step 9: Restart Bob](#step-9-restart-bob)
- [Step 10: Verify MCP Server](#step-10-verify-mcp-server)
- [Complete Setup Checklist](#complete-setup-checklist)
- [Troubleshooting](#troubleshooting)

## Prerequisites

Before starting, ensure you have:

✅ **DB2 Client Installed**: Follow [DB2_CLIENT_INSTALL_MAC.md](DB2_CLIENT_INSTALL_MAC.md) first
✅ **Environment Variables Set**: DB2 environment variables configured
✅ **Node.js Installed**: Version 16 or higher
✅ **MCP Server Downloaded**: Database performance server code available

Verify prerequisites:
```bash
# Check DB2 client
db2level

# Check Node.js
node --version

# Check environment variables
echo $IBM_DB_HOME
echo $IBM_DB_LIB
```

---

## Step 1: Create Database Configuration File

Navigate to your MCP server directory and create the configuration file.

```bash
# Navigate to MCP server directory
cd ~/Documents/IBM\ Bob/MCP/db-performance-server

# Copy the example configuration
cp db-config.example.json db-config.json

# Verify file was created
ls -la db-config.json
```

**Expected Output:**
```
-rw-r--r--  1 username  staff  1234 Apr 14 14:30 db-config.json
```

---

## Step 2: Configure DB2 Connection Details

Edit the `db-config.json` file with your DB2 database information.

```bash
# Open the file in your preferred editor
nano db-config.json
# or
code db-config.json
# or
vim db-config.json
```

**Configuration Template:**
```json
{
  "databases": {
    "postgres": {
      "enabled": false,
      "connections": []
    },
    "db2": {
      "enabled": true,
      "connections": [
        {
          "name": "production-db2",
          "host": "your-db2-server.example.com",
          "port": 50000,
          "database": "MYDB",
          "user": "db2inst1",
          "password": "your_secure_password",
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

**Replace these values with your actual DB2 details:**
- `name`: A friendly name for this connection (e.g., "hvdb-production")
- `host`: Your DB2 server hostname or IP address
- `port`: DB2 port (usually 50000)
- `database`: Your database name
- `user`: Your DB2 username
- `password`: Your DB2 password
- `schema`: Default schema (optional)

**Example with real values:**
```json
{
  "databases": {
    "postgres": {
      "enabled": false,
      "connections": []
    },
    "db2": {
      "enabled": true,
      "connections": [
        {
          "name": "hvdb-production",
          "host": "secperf26.rtp.raleigh.ibm.com",
          "port": 50000,
          "database": "hvdb",
          "user": "db2inst1",
          "password": "MySecurePass123",
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

**Save the file** (Ctrl+O in nano, :wq in vim, Cmd+S in VS Code)

**Secure the configuration file:**
```bash
# Set restrictive permissions (only you can read/write)
chmod 600 db-config.json

# Verify permissions
ls -la db-config.json
# Should show: -rw------- (600)
```

---

## Step 3: Install ibm_db Package

Install the Node.js DB2 driver with proper environment variables.

```bash
# Ensure you're in the MCP server directory
cd ~/Documents/IBM\ Bob/MCP/db-performance-server

# Set environment variables (required for installation)
export IBM_DB_HOME=/opt/ibm/db2/dsdriver
export IBM_DB_LIB=/opt/ibm/db2/dsdriver/lib
export IBM_DB_INCLUDE=/opt/ibm/db2/dsdriver/include
export DYLD_LIBRARY_PATH=$IBM_DB_LIB:$DYLD_LIBRARY_PATH

# Install ibm_db package
npm install ibm_db
```

**Expected Output:**
```
> ibm_db@3.x.x install
> node installer/driverInstall.js

Downloading DB2 ODBC CLI Driver from IBM website...
...
ibm_db@3.x.x
added 1 package
```

**If installation fails**, see [Troubleshooting](#troubleshooting) section.

---

## Step 4: Build the MCP Server

Compile the TypeScript code to JavaScript.

```bash
# Build the server
npm run build
```

**Expected Output:**
```
> db-performance-server@1.0.0 build
> tsc

# No errors means success
```

**Verify build output:**
```bash
# Check that build directory was created
ls -la build/

# Should see index.js
ls -la build/index.js
```

---

## Step 5: Create MCP Settings File

Create the directory and file for Bob's MCP server configuration.

```bash
# Create settings directory if it doesn't exist
mkdir -p ~/.bob/settings

# Check if mcp_settings.json already exists
ls -la ~/.bob/settings/mcp_settings.json
```

**If file doesn't exist:**
```bash
# Create new mcp_settings.json
touch ~/.bob/settings/mcp_settings.json
```

**If file exists:**
You'll need to add to the existing configuration (see next step).

---

## Step 6: Add MCP Server Configuration

Add the database performance server to Bob's MCP settings.

### Option A: Creating New mcp_settings.json

If the file doesn't exist or is empty:

```bash
# Create new configuration
cat > ~/.bob/settings/mcp_settings.json << 'EOF'
{
  "mcpServers": {
    "db-performance": {
      "command": "node",
      "args": [
        "/Users/YOUR_USERNAME/Documents/IBM Bob/MCP/db-performance-server/build/index.js"
      ],
      "env": {
        "DB_CONFIG_PATH": "/Users/YOUR_USERNAME/Documents/IBM Bob/MCP/db-performance-server/db-config.json",
        "IBM_DB_HOME": "/opt/ibm/db2/dsdriver",
        "IBM_DB_LIB": "/opt/ibm/db2/dsdriver/lib",
        "DYLD_LIBRARY_PATH": "/opt/ibm/db2/dsdriver/lib"
      }
    }
  }
}
EOF
```

**IMPORTANT: Replace `YOUR_USERNAME` with your actual username!**

To find your username:
```bash
whoami
```

To get the full path automatically:
```bash
# Get current directory path
cd ~/Documents/IBM\ Bob/MCP/db-performance-server
pwd
# Copy this path and use it in the configuration
```

### Option B: Adding to Existing mcp_settings.json

If you already have other MCP servers configured:

```bash
# Edit the existing file
nano ~/.bob/settings/mcp_settings.json
```

Add the `db-performance` entry to the existing `mcpServers` object:

```json
{
  "mcpServers": {
    "existing-server-1": {
      "command": "...",
      "args": [...]
    },
    "existing-server-2": {
      "command": "...",
      "args": [...]
    },
    "db-performance": {
      "command": "node",
      "args": [
        "/Users/YOUR_USERNAME/Documents/IBM Bob/MCP/db-performance-server/build/index.js"
      ],
      "env": {
        "DB_CONFIG_PATH": "/Users/YOUR_USERNAME/Documents/IBM Bob/MCP/db-performance-server/db-config.json",
        "IBM_DB_HOME": "/opt/ibm/db2/dsdriver",
        "IBM_DB_LIB": "/opt/ibm/db2/dsdriver/lib",
        "DYLD_LIBRARY_PATH": "/opt/ibm/db2/dsdriver/lib"
      }
    }
  }
}
```

**Save the file** (Ctrl+O in nano, :wq in vim)

---

## Step 7: Validate Configuration

Verify that your JSON configuration is valid.

```bash
# Validate mcp_settings.json syntax
cat ~/.bob/settings/mcp_settings.json | python3 -m json.tool
```

**Expected Output:**
```json
{
  "mcpServers": {
    "db-performance": {
      ...
    }
  }
}
```

**If you see an error**, there's a syntax problem in your JSON. Common issues:
- Missing comma between entries
- Extra comma after last entry
- Mismatched brackets or braces
- Missing quotes around strings

**Validate db-config.json:**
```bash
cd ~/Documents/IBM\ Bob/MCP/db-performance-server
cat db-config.json | python3 -m json.tool
```

**Verify file paths exist:**
```bash
# Check build file exists
ls -la ~/Documents/IBM\ Bob/MCP/db-performance-server/build/index.js

# Check config file exists
ls -la ~/Documents/IBM\ Bob/MCP/db-performance-server/db-config.json

# Both should show file details, not "No such file or directory"
```

---

## Step 8: Test DB2 Connection

Test the connection before using it in Bob.

```bash
# Navigate to server directory
cd ~/Documents/IBM\ Bob/MCP/db-performance-server

# Create test script
cat > test-db2-connection.js << 'EOF'
const ibmdb = require('ibm_db');
const fs = require('fs');

console.log('=== DB2 Connection Test ===\n');

// Load configuration
let config;
try {
  config = JSON.parse(fs.readFileSync('db-config.json', 'utf8'));
  console.log('✓ Configuration file loaded');
} catch (err) {
  console.error('❌ Failed to load db-config.json:', err.message);
  process.exit(1);
}

// Get DB2 connection details
const db2Config = config.databases.db2.connections[0];
console.log('\nConnection Details:');
console.log('  Name:', db2Config.name);
console.log('  Host:', db2Config.host);
console.log('  Port:', db2Config.port);
console.log('  Database:', db2Config.database);
console.log('  User:', db2Config.user);

// Build connection string
const connStr = `DATABASE=${db2Config.database};HOSTNAME=${db2Config.host};PORT=${db2Config.port};PROTOCOL=TCPIP;UID=${db2Config.user};PWD=${db2Config.password};`;

console.log('\nConnecting to DB2...');

ibmdb.open(connStr, (err, conn) => {
  if (err) {
    console.error('\n❌ Connection failed:', err.message);
    console.error('\nTroubleshooting:');
    console.error('  1. Verify DB2 server is accessible');
    console.error('  2. Check hostname and port');
    console.error('  3. Verify username and password');
    console.error('  4. Ensure DB2 client is installed');
    process.exit(1);
  }
  
  console.log('✓ Connected to DB2 successfully!\n');
  
  console.log('Running test query...');
  conn.query('SELECT CURRENT TIMESTAMP FROM SYSIBM.SYSDUMMY1', (err, rows) => {
    if (err) {
      console.error('❌ Query failed:', err.message);
    } else {
      console.log('✓ Query executed successfully');
      console.log('Result:', rows);
    }
    
    conn.close(() => {
      console.log('\n✓ Connection closed');
      console.log('\n=== Test Complete ===');
      process.exit(0);
    });
  });
});
EOF

# Run the test
node test-db2-connection.js
```

**Expected Output:**
```
=== DB2 Connection Test ===

✓ Configuration file loaded

Connection Details:
  Name: hvdb-production
  Host: secperf26.rtp.raleigh.ibm.com
  Port: 50000
  Database: hvdb
  User: db2inst1

Connecting to DB2...
✓ Connected to DB2 successfully!

Running test query...
✓ Query executed successfully
Result: [ { '1': 2026-04-14-14:30:45.123456 } ]

✓ Connection closed

=== Test Complete ===
```

**If the test fails**, see [Troubleshooting](#troubleshooting) section.

---

## Step 9: Restart Bob

Restart Bob to load the new MCP server.

### Steps:
1. **Quit Bob completely**
   - On Mac: Bob → Quit Bob (Cmd+Q)
   - Don't just close the window - fully quit the application

2. **Wait a few seconds**

3. **Reopen Bob**
   - Launch Bob from Applications or Spotlight

4. **Wait for Bob to fully load**
   - MCP servers are loaded during startup

---

## Step 10: Verify MCP Server

Test that the MCP server is working in Bob.

### Test 1: List Connections

In Bob, type or say:
```
List all database connections
```

**Expected Response:**
```
Available database connections:

DB2 Connections:
- hvdb-production (hvdb @ secperf26.rtp.raleigh.ibm.com:50000)
```

### Test 2: Analyze Queries

Try a performance analysis command:
```
Analyze DB2 queries for hvdb-production
```

**Expected Response:**
Should show query performance data or indicate no slow queries found.

### Test 3: Check Buffer Pools

```
Check DB2 buffer pools for hvdb-production
```

**Expected Response:**
Should show buffer pool statistics.

---

## Complete Setup Checklist

Use this checklist to verify all steps are complete:

### Prerequisites
- [ ] DB2 client installed at `/opt/ibm/db2/dsdriver`
- [ ] `db2level` command works
- [ ] Environment variables set in shell profile
- [ ] Node.js version 16+ installed

### Configuration Files
- [ ] `db-config.json` created
- [ ] DB2 connection details added to `db-config.json`
- [ ] File permissions set to 600 on `db-config.json`
- [ ] JSON syntax validated

### Package Installation
- [ ] `ibm_db` package installed successfully
- [ ] No installation errors
- [ ] MCP server built (`npm run build`)
- [ ] `build/index.js` file exists

### MCP Settings
- [ ] `~/.bob/settings` directory exists
- [ ] `mcp_settings.json` created or updated
- [ ] `db-performance` server added to configuration
- [ ] Paths updated to match your system
- [ ] JSON syntax validated

### Testing
- [ ] Test connection script runs successfully
- [ ] No connection errors
- [ ] Test query executes

### Bob Integration
- [ ] Bob restarted
- [ ] "List all database connections" works
- [ ] Can run DB2 performance analysis commands

---

## Troubleshooting

### Issue 1: npm install ibm_db fails

**Error:** `gyp ERR! build error`

**Solution:**
```bash
# Ensure Xcode Command Line Tools installed
xcode-select --install

# Set environment variables
export IBM_DB_HOME=/opt/ibm/db2/dsdriver
export IBM_DB_LIB=/opt/ibm/db2/dsdriver/lib
export IBM_DB_INCLUDE=/opt/ibm/db2/dsdriver/include

# Clean and reinstall
rm -rf node_modules package-lock.json
npm install ibm_db
```

### Issue 2: Test connection fails

**Error:** `SQL30081N` or connection timeout

**Solution:**
```bash
# Test network connectivity
ping your-db2-server.example.com

# Test port
nc -zv your-db2-server.example.com 50000

# Verify credentials in db-config.json
cat db-config.json | grep -A 5 '"db2"'
```

### Issue 3: MCP server not appearing in Bob

**Solution:**
```bash
# Verify mcp_settings.json exists
cat ~/.bob/settings/mcp_settings.json

# Check paths are correct
ls -la ~/Documents/IBM\ Bob/MCP/db-performance-server/build/index.js

# Ensure Bob was fully restarted (quit and reopen)
```

### Issue 4: JSON syntax error

**Error:** `Expecting property name enclosed in double quotes`

**Solution:**
```bash
# Validate JSON
cat ~/.bob/settings/mcp_settings.json | python3 -m json.tool

# Common fixes:
# - Remove trailing commas
# - Ensure all strings have double quotes
# - Check bracket/brace matching
```

### Issue 5: "Cannot find module 'ibm_db'"

**Solution:**
```bash
cd ~/Documents/IBM\ Bob/MCP/db-performance-server

# Verify ibm_db is installed
ls -la node_modules/ibm_db

# If missing, reinstall
npm install ibm_db

# Rebuild
npm run build
```

### Issue 6: Permission denied on db-config.json

**Solution:**
```bash
# Fix permissions
chmod 600 ~/Documents/IBM\ Bob/MCP/db-performance-server/db-config.json

# Verify
ls -la ~/Documents/IBM\ Bob/MCP/db-performance-server/db-config.json
```

### Issue 7: Environment variables not set in MCP

**Solution:**

Ensure the `env` section is in your mcp_settings.json:
```json
{
  "mcpServers": {
    "db-performance": {
      "env": {
        "IBM_DB_HOME": "/opt/ibm/db2/dsdriver",
        "IBM_DB_LIB": "/opt/ibm/db2/dsdriver/lib",
        "DYLD_LIBRARY_PATH": "/opt/ibm/db2/dsdriver/lib"
      }
    }
  }
}
```

---

## Quick Reference

### File Locations
```
MCP Server:        ~/Documents/IBM Bob/MCP/db-performance-server/
DB Config:         ~/Documents/IBM Bob/MCP/db-performance-server/db-config.json
MCP Settings:      ~/.bob/settings/mcp_settings.json
DB2 Client:        /opt/ibm/db2/dsdriver
```

### Essential Commands
```bash
# Navigate to server
cd ~/Documents/IBM\ Bob/MCP/db-performance-server

# Install dependencies
npm install

# Build server
npm run build

# Test connection
node test-db2-connection.js

# Validate JSON
cat ~/.bob/settings/mcp_settings.json | python3 -m json.tool
```

### Environment Variables
```bash
export IBM_DB_HOME=/opt/ibm/db2/dsdriver
export IBM_DB_LIB=/opt/ibm/db2/dsdriver/lib
export IBM_DB_INCLUDE=/opt/ibm/db2/dsdriver/include
export DYLD_LIBRARY_PATH=$IBM_DB_LIB:$DYLD_LIBRARY_PATH
```

---

## Next Steps

After successful setup:

1. **Explore Available Tools**
   - List connections
   - Analyze slow queries
   - Check buffer pools
   - Monitor tablespace usage
   - Check for locks

2. **Add More Connections**
   - Edit `db-config.json`
   - Add additional DB2 databases
   - Rebuild: `npm run build`
   - Restart Bob

---
