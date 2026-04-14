# DB2 Client Installation Guide for macOS

Complete guide for installing IBM DB2 client libraries on macOS, required for connecting to DB2 databases from the MCP server.

## Table of Contents
- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Installation Methods](#installation-methods)
- [Post-Installation Configuration](#post-installation-configuration)
- [Verification](#verification)
- [Troubleshooting](#troubleshooting)

## Overview

The IBM DB2 client provides the necessary libraries and tools to connect to DB2 database servers. The `ibm_db` npm package requires these native libraries to function properly.

### What You'll Install
- DB2 client libraries (libdb2.dylib)
- DB2 CLI driver
- DB2 command-line tools (db2, db2level, etc.)
- Header files for native module compilation

## Prerequisites

### Development Tools
```bash
# Install Xcode Command Line Tools (required for compilation)
xcode-select --install

# For Apple Silicon Macs, install Rosetta 2
softwareupdate --install-rosetta
```

### Check Your System
```bash
# Check macOS version
sw_vers

# Check architecture
uname -m
# x86_64 = Intel
# arm64 = Apple Silicon

# Check available disk space
df -h /
```

## Installation Methods

### Method 1: IBM Data Server Driver Package (Recommended)

The IBM Data Server Driver Package is a lightweight client that provides all necessary libraries without requiring a full DB2 installation.

#### Step 1: Download the Driver

**Option A: Direct Download from IBM**
1. Visit IBM Support: https://www.ibm.com/support/pages/download-initial-version-115-clients-and-drivers
2. Sign in with your IBM ID (free registration)
3. Download: **IBM Data Server Driver Package (DS Driver)** for macOS
   - File: `ibm_data_server_driver_package_macos_v11.5.tar.gz`
   - Size: ~400 MB

**Option B: Using wget/curl (if you have direct link)**
```bash
# Create download directory
mkdir -p ~/Downloads/db2-client
cd ~/Downloads/db2-client

# Download (replace URL with actual download link from IBM)
curl -O https://public.dhe.ibm.com/ibmdl/export/pub/software/data/db2/drivers/odbc_cli/macos64_odbc_cli.tar.gz
```

#### Step 2: Extract the Package

```bash
# Navigate to download directory
cd ~/Downloads/db2-client

# Extract the driver package
tar -xzf ibm_data_server_driver_package_macos_v11.5.tar.gz

# You should now have a 'dsdriver' directory
ls -la dsdriver/
```

#### Step 3: Install to System Location

```bash
# Create IBM directory structure
sudo mkdir -p /opt/ibm/db2

# Move driver to installation directory
sudo mv dsdriver /opt/ibm/db2/

# Set proper ownership
sudo chown -R $(whoami):staff /opt/ibm/db2/dsdriver

# Set permissions
sudo chmod -R 755 /opt/ibm/db2/dsdriver
```

#### Step 4: Configure Environment Variables

**For Bash (default on older macOS):**
```bash
# Edit ~/.bash_profile
nano ~/.bash_profile

# Add these lines:
export IBM_DB_HOME=/opt/ibm/db2/dsdriver
export IBM_DB_LIB=/opt/ibm/db2/dsdriver/lib
export IBM_DB_INCLUDE=/opt/ibm/db2/dsdriver/include
export DYLD_LIBRARY_PATH=$IBM_DB_LIB:$DYLD_LIBRARY_PATH
export PATH=$IBM_DB_HOME/bin:$PATH

# Save and reload
source ~/.bash_profile
```

**For Zsh (default on macOS Catalina+):**
```bash
# Edit ~/.zshrc
nano ~/.zshrc

# Add these lines:
export IBM_DB_HOME=/opt/ibm/db2/dsdriver
export IBM_DB_LIB=/opt/ibm/db2/dsdriver/lib
export IBM_DB_INCLUDE=/opt/ibm/db2/dsdriver/include
export DYLD_LIBRARY_PATH=$IBM_DB_LIB:$DYLD_LIBRARY_PATH
export PATH=$IBM_DB_HOME/bin:$PATH

# Save and reload
source ~/.zshrc
```

**Make it permanent for all shells:**
```bash
# Create a profile.d style script
sudo mkdir -p /etc/profile.d
sudo nano /etc/profile.d/db2.sh

# Add:
export IBM_DB_HOME=/opt/ibm/db2/dsdriver
export IBM_DB_LIB=/opt/ibm/db2/dsdriver/lib
export IBM_DB_INCLUDE=/opt/ibm/db2/dsdriver/include
export DYLD_LIBRARY_PATH=$IBM_DB_LIB:$DYLD_LIBRARY_PATH
export PATH=$IBM_DB_HOME/bin:$PATH

# Save and make executable
sudo chmod +x /etc/profile.d/db2.sh
```

#### Step 5: Verify Installation

```bash
# Check DB2 version
db2level

# Expected output:
# DB11.5.9.0, s2309201300, DYN2309201300AMD64, Fix Pack 0

# Check library path
echo $DYLD_LIBRARY_PATH
# Should include: /opt/ibm/db2/dsdriver/lib

# List installed libraries
ls -la $IBM_DB_LIB/
# Should see: libdb2.dylib, libdb2.a, etc.

# Check if db2 command is available
which db2
# Should output: /opt/ibm/db2/dsdriver/bin/db2
```

## Post-Installation Configuration

### Configure Database Connections

#### Catalog Remote Database

```bash
# Catalog the TCP/IP node (DB2 server)
db2 catalog tcpip node MYNODE remote db2server.example.com server 50000

# Catalog the database
db2 catalog database PRODDB as PRODDB at node MYNODE

# List cataloged databases
db2 list db directory

# Test connection
db2 connect to PRODDB user db2inst1
# Enter password when prompted

# Disconnect
db2 disconnect PRODDB
```

#### Configure SSL/TLS (if required)

```bash
# Create keystore directory
mkdir -p ~/.db2/ssl

# Import server certificate
# (Obtain certificate from your DB2 administrator)
gsk8capicmd_64 -cert -add -db ~/.db2/ssl/client.kdb -pw password -label db2cert -file server.crt

# Configure DB2 to use SSL
db2 update dbm cfg using SSL_CLNT_KEYDB ~/.db2/ssl/client.kdb
db2 update dbm cfg using SSL_CLNT_STASH ~/.db2/ssl/client.sth

# Catalog database with SSL
db2 catalog database PRODDB as PRODDB at node MYNODE authentication SERVER_ENCRYPT
```

### Configure for Node.js Development

```bash
# Verify npm can find DB2 libraries
npm config set IBM_DB_HOME /opt/ibm/db2/dsdriver

# Test installation with a simple script
cat > test-db2.js << 'EOF'
const ibmdb = require('ibm_db');
console.log('IBM DB2 driver loaded successfully!');
console.log('Version:', ibmdb.version);
EOF

node test-db2.js
```

## Verification

### Complete Verification Checklist

```bash
# 1. Check DB2 version
db2level
# ✓ Should display version information

# 2. Verify environment variables
echo $IBM_DB_HOME
echo $IBM_DB_LIB
echo $DYLD_LIBRARY_PATH
# ✓ All should show correct paths

# 3. Check library files exist
ls -la $IBM_DB_LIB/libdb2.dylib
# ✓ Should show the library file

# 4. Test db2 command
which db2
db2 "SELECT 1 FROM SYSIBM.SYSDUMMY1"
# ✓ Should execute successfully

# 5. Test connection to remote database
db2 connect to PRODDB user db2inst1
# ✓ Should connect successfully

# 6. Test with Node.js
cd /path/to/your/mcp-server
npm install ibm_db
node -e "console.log(require('ibm_db').version)"
# ✓ Should print version number
```

### Test Connection Script

Create `test-connection.js`:
```javascript
const ibmdb = require('ibm_db');

const connStr = 'DATABASE=PRODDB;HOSTNAME=db2server.example.com;PORT=50000;PROTOCOL=TCPIP;UID=db2inst1;PWD=password;';

ibmdb.open(connStr, (err, conn) => {
  if (err) {
    console.error('Connection failed:', err);
    return;
  }
  
  console.log('✓ Connected to DB2 successfully!');
  
  conn.query('SELECT CURRENT TIMESTAMP FROM SYSIBM.SYSDUMMY1', (err, rows) => {
    if (err) {
      console.error('Query failed:', err);
    } else {
      console.log('✓ Query executed successfully:', rows);
    }
    
    conn.close(() => {
      console.log('✓ Connection closed');
    });
  });
});
```

Run test:
```bash
node test-connection.js
```

## Troubleshooting

### Issue 1: "db2level: command not found"

**Cause**: DB2 bin directory not in PATH

**Solution**:
```bash
# Add to PATH
export PATH=/opt/ibm/db2/dsdriver/bin:$PATH

# Make permanent
echo 'export PATH=/opt/ibm/db2/dsdriver/bin:$PATH' >> ~/.zshrc
source ~/.zshrc

# Verify
which db2level
```

### Issue 2: "dyld: Library not loaded: libdb2.dylib"

**Cause**: DYLD_LIBRARY_PATH not set correctly

**Solution**:
```bash
# Set library path
export DYLD_LIBRARY_PATH=/opt/ibm/db2/dsdriver/lib:$DYLD_LIBRARY_PATH

# Make permanent
echo 'export DYLD_LIBRARY_PATH=/opt/ibm/db2/dsdriver/lib:$DYLD_LIBRARY_PATH' >> ~/.zshrc
source ~/.zshrc

# Verify
echo $DYLD_LIBRARY_PATH
ls -la $DYLD_LIBRARY_PATH/libdb2.dylib
```

### Issue 3: "npm install ibm_db" fails

**Cause**: Missing build tools or environment variables

**Solution**:
```bash
# Install Xcode Command Line Tools
xcode-select --install

# Set environment variables before npm install
export IBM_DB_HOME=/opt/ibm/db2/dsdriver
export IBM_DB_LIB=/opt/ibm/db2/dsdriver/lib
export IBM_DB_INCLUDE=/opt/ibm/db2/dsdriver/include

# Clean and reinstall
rm -rf node_modules package-lock.json
npm install ibm_db

# If still fails, try with verbose logging
npm install ibm_db --verbose
```

### Issue 4: Apple Silicon (M1/M2) Compatibility

**Cause**: DB2 client may not have native ARM64 support

**Solution**:
```bash
# Install Rosetta 2 (if not already installed)
softwareupdate --install-rosetta

# Use x86_64 architecture for Node.js
arch -x86_64 /bin/bash

# Install Node.js x86_64 version
arch -x86_64 brew install node@18

# Install ibm_db with x86_64 architecture
arch -x86_64 npm install ibm_db

# Run your application with x86_64
arch -x86_64 node your-app.js
```

### Issue 5: "SQL1042C" - Unexpected system error

**Cause**: Incorrect library path or corrupted installation

**Solution**:
```bash
# Verify library integrity
otool -L /opt/ibm/db2/dsdriver/lib/libdb2.dylib

# Reinstall if corrupted
sudo rm -rf /opt/ibm/db2/dsdriver
# Re-extract and install from downloaded package

# Update library cache
sudo update_dyld_shared_cache
```

### Issue 6: Connection timeout to remote DB2

**Cause**: Network/firewall issues

**Solution**:
```bash
# Test network connectivity
ping db2server.example.com

# Test port connectivity
nc -zv db2server.example.com 50000

# Check firewall rules
sudo pfctl -s rules | grep 50000

# Test with telnet
telnet db2server.example.com 50000

# If connection works but DB2 fails, check credentials
db2 connect to PRODDB user db2inst1
```

### Issue 7: "SQL30081N" - Communication error

**Cause**: DB2 server not accessible or wrong connection parameters

**Solution**:
```bash
# Verify cataloged database
db2 list db directory

# Uncatalog and recatalog
db2 uncatalog database PRODDB
db2 uncatalog node MYNODE

# Recatalog with correct parameters
db2 catalog tcpip node MYNODE remote db2server.example.com server 50000
db2 catalog database PRODDB as PRODDB at node MYNODE

# Test connection
db2 connect to PRODDB user db2inst1
```

### Issue 8: Permission denied errors

**Cause**: Incorrect file permissions

**Solution**:
```bash
# Fix ownership
sudo chown -R $(whoami):staff /opt/ibm/db2/dsdriver

# Fix permissions
sudo chmod -R 755 /opt/ibm/db2/dsdriver

# Verify
ls -la /opt/ibm/db2/dsdriver
```

### Environment Variables
```bash
IBM_DB_HOME=/opt/ibm/db2/dsdriver
IBM_DB_LIB=/opt/ibm/db2/dsdriver/lib
IBM_DB_INCLUDE=/opt/ibm/db2/dsdriver/include
DYLD_LIBRARY_PATH=$IBM_DB_LIB:$DYLD_LIBRARY_PATH
PATH=$IBM_DB_HOME/bin:$PATH
```

## Configuring MCP Server for DB2

After installing the DB2 client, you need to configure the MCP server to use it for database performance analysis.

### Step 1: Create Database Configuration File

Navigate to your MCP server directory and create the database configuration:

```bash
# Navigate to MCP server directory
cd /path/to/db-performance-server

# Copy example configuration
cp db-config.example.json db-config.json

# Edit the configuration
nano db-config.json
```

### Step 2: Configure DB2 Connection

Edit `db-config.json` to add your DB2 database details:

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
          "host": "db2server.example.com",
          "port": 50000,
          "database": "MYDB",
          "user": "db2inst1",
          "password": "your_password_here",
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

**Configuration Parameters:**
- `name`: Friendly name for the connection (used in MCP commands)
- `host`: DB2 server hostname or IP address
- `port`: DB2 server port (default: 50000)
- `database`: Database name
- `user`: DB2 username
- `password`: DB2 password
- `schema`: Default schema to use (optional)

**Security Note:** Protect your configuration file:
```bash
chmod 600 db-config.json
```

### Step 3: Install ibm_db Package

With the DB2 client installed, you can now install the Node.js DB2 driver:

```bash
# Ensure environment variables are set
export IBM_DB_HOME=/opt/ibm/db2/dsdriver
export IBM_DB_LIB=/opt/ibm/db2/dsdriver/lib
export IBM_DB_INCLUDE=/opt/ibm/db2/dsdriver/include

# Install ibm_db package
npm install ibm_db

# Build the MCP server
npm run build
```

### Step 4: Create MCP Settings File

Create or update Bob's MCP settings to register the database performance server:

```bash
# Create settings directory if it doesn't exist
mkdir -p ~/.bob/settings

# Create or edit mcp_settings.json
nano ~/.bob/settings/mcp_settings.json
```

Add the following configuration (adjust paths to match your installation):

```json
{
  "mcpServers": {
    "db-performance": {
      "command": "node",
      "args": [
        "/path/to/db-performance-server/build/index.js"
      ],
      "env": {
        "DB_CONFIG_PATH": "/path/to/db-performance-server/db-config.json",
        "IBM_DB_HOME": "/opt/ibm/db2/dsdriver",
        "IBM_DB_LIB": "/opt/ibm/db2/dsdriver/lib",
        "DYLD_LIBRARY_PATH": "/opt/ibm/db2/dsdriver/lib"
      }
    }
  }
}
```

**Important:** Replace `/path/to/db-performance-server` with your actual server directory path.

To find your actual path:
```bash
cd /path/to/db-performance-server
pwd
```

### Step 5: Verify MCP Configuration

Validate the JSON syntax:

```bash
# Check JSON is valid
cat ~/.bob/settings/mcp_settings.json | python3 -m json.tool
```

If no errors appear, your JSON is valid.

### Step 6: Test DB2 Connection

Before restarting Bob, test the DB2 connection:

```bash
# Navigate to server directory
cd /path/to/db-performance-server

# Create test script
cat > test-db2-connection.js << 'EOF'
const ibmdb = require('ibm_db');
const fs = require('fs');

// Load config
const config = JSON.parse(fs.readFileSync('db-config.json', 'utf8'));
const db2Config = config.databases.db2.connections[0];

// Build connection string
const connStr = `DATABASE=${db2Config.database};HOSTNAME=${db2Config.host};PORT=${db2Config.port};PROTOCOL=TCPIP;UID=${db2Config.user};PWD=${db2Config.password};`;

console.log('Testing DB2 connection...');
console.log('Host:', db2Config.host);
console.log('Database:', db2Config.database);

ibmdb.open(connStr, (err, conn) => {
  if (err) {
    console.error('❌ Connection failed:', err.message);
    process.exit(1);
  }
  
  console.log('✓ Connected to DB2 successfully!');
  
  conn.query('SELECT CURRENT TIMESTAMP FROM SYSIBM.SYSDUMMY1', (err, rows) => {
    if (err) {
      console.error('❌ Query failed:', err.message);
    } else {
      console.log('✓ Query executed successfully');
      console.log('Result:', rows);
    }
    
    conn.close(() => {
      console.log('✓ Connection closed');
      process.exit(0);
    });
  });
});
EOF

# Run test
node test-db2-connection.js
```

Expected output:
```
Testing DB2 connection...
Host: db2server.example.com
Database: MYDB
✓ Connected to DB2 successfully!
✓ Query executed successfully
Result: [ { '1': 2026-04-14 14:20:30.123456 } ]
✓ Connection closed
```

### Step 7: Restart Bob

After configuration is complete:

1. **Quit Bob completely** (not just close the window)
2. **Reopen Bob**
3. The db-performance MCP server should now be loaded

### Step 8: Verify MCP Server in Bob

Test the MCP server in Bob:

```
List all database connections
```

Expected response should show your configured DB2 connection(s).

Try a performance analysis command:
```
Analyze DB2 queries for production-db2
```

## Complete Setup Checklist

Use this checklist to ensure everything is configured correctly:

- [ ] DB2 client installed at `/opt/ibm/db2/dsdriver`
- [ ] Environment variables set in shell profile
- [ ] `db2level` command works
- [ ] `db-config.json` created with DB2 connection details
- [ ] `ibm_db` npm package installed successfully
- [ ] MCP server built (`npm run build` completed)
- [ ] `~/.bob/settings/mcp_settings.json` created/updated
- [ ] JSON syntax validated
- [ ] Test connection script runs successfully
- [ ] Bob restarted
- [ ] MCP server appears in Bob
- [ ] "List all database connections" command works

## Quick Reference

### File Locations
```
DB2 Client:        /opt/ibm/db2/dsdriver
MCP Server:        /path/to/db-performance-server
DB Config:         /path/to/db-performance-server/db-config.json
MCP Settings:      ~/.bob/settings/mcp_settings.json
```

### Essential Commands
```bash
# Check DB2 installation
db2level

# Test DB2 connection
db2 connect to MYDB user db2inst1

# Rebuild MCP server
cd /path/to/db-performance-server
npm run build

# Validate MCP settings
cat ~/.bob/settings/mcp_settings.json | python3 -m json.tool

# Test Node.js DB2 driver
node -e "console.log(require('ibm_db').version)"
```

### Environment Variables (for reference)
```bash
export IBM_DB_HOME=/opt/ibm/db2/dsdriver
export IBM_DB_LIB=/opt/ibm/db2/dsdriver/lib
export IBM_DB_INCLUDE=/opt/ibm/db2/dsdriver/include
export DYLD_LIBRARY_PATH=$IBM_DB_LIB:$DYLD_LIBRARY_PATH
export PATH=$IBM_DB_HOME/bin:$PATH
```

## Troubleshooting MCP Configuration

### MCP Server Not Appearing in Bob

**Check MCP settings file:**
```bash
cat ~/.bob/settings/mcp_settings.json
```

**Verify paths are correct:**
```bash
ls -la /path/to/db-performance-server/build/index.js
ls -la /path/to/db-performance-server/db-config.json
```

**Check Bob's console for errors** (usually in Bob's developer tools or logs)

### "Cannot find module 'ibm_db'" Error

**Reinstall ibm_db:**
```bash
cd /path/to/db-performance-server
rm -rf node_modules/ibm_db
npm install ibm_db
npm run build
```

### Connection Fails in MCP but Works in Test Script

**Ensure environment variables are in MCP settings:**
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
