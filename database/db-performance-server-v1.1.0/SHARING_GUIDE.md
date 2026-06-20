# Database Performance MCP Server - Sharing Guide

This guide explains how to share the Database Performance MCP Server with colleagues.

## 📦 What to Share

Share the entire `db-performance-server` directory, which includes:
- Source code (`src/`)
- Configuration files (`package.json`, `tsconfig.json`)
- Documentation (`README.md`, setup guides)
- Example configuration (`db-config.example.json`)

## 🚫 What NOT to Share

**IMPORTANT**: Never share these files as they contain sensitive credentials:
- `db-config.json` (contains actual database passwords)
- `node_modules/` (can be regenerated)
- `build/` (can be regenerated)
- Any `.log` files

## 📋 Prerequisites for Your Colleague

Your colleague needs to have installed:
1. **Node.js** (v18 or higher) - [Download](https://nodejs.org/)
2. **npm** (comes with Node.js)
3. **Git** (optional, for version control)

### Optional Database Clients (based on what they'll use):
- **PostgreSQL**: No additional client needed (uses `pg` npm package)
- **DB2**: Requires IBM DB2 client libraries - see `DB2_CLIENT_INSTALL_MAC.md`
- **MS-SQL**: No additional client needed (uses `mssql` npm package)

## 📤 Method 1: Share via Git Repository (Recommended)

### Step 1: Prepare the Repository
```bash
cd /Users/ranvijaysingh/Documents/IBM\ Bob/MCP/db-performance-server

# Ensure .gitignore is properly configured (already done)
# This prevents sharing sensitive files

# Initialize git if not already done
git init

# Add files
git add .

# Commit
git commit -m "Initial commit of DB Performance MCP Server"
```

### Step 2: Push to Remote Repository
```bash
# Option A: GitHub
git remote add origin https://github.com/yourusername/db-performance-server.git
git push -u origin main

# Option B: GitLab
git remote add origin https://gitlab.com/yourusername/db-performance-server.git
git push -u origin main

# Option C: Internal Git Server
git remote add origin git@your-company-server.com:db-performance-server.git
git push -u origin main
```

### Step 3: Share Repository URL
Send your colleague the repository URL and the setup instructions below.

## 📤 Method 2: Share via Compressed Archive

### Step 1: Create Distribution Package
```bash
cd /Users/ranvijaysingh/Documents/IBM\ Bob/MCP/db-performance-server

# Run the distribution script
./create-distribution.sh
```

This creates `db-performance-server-dist.tar.gz` with:
- All source code
- Documentation
- Example configurations
- No sensitive data
- No build artifacts

### Step 2: Share the Archive
Send `db-performance-server-dist.tar.gz` to your colleague via:
- Email (if file size permits)
- Shared drive
- File transfer service (WeTransfer, Dropbox, etc.)
- Internal file sharing system

## 📥 Setup Instructions for Your Colleague

Share these instructions with your colleague:

### 1. Extract/Clone the Server

**If using Git:**
```bash
git clone <repository-url>
cd db-performance-server
```

**If using archive:**
```bash
tar -xzf db-performance-server-dist.tar.gz
cd db-performance-server
```

### 2. Install Dependencies
```bash
npm install
```

**Note**: If using DB2, they need to install IBM DB2 client first. See `DB2_CLIENT_INSTALL_MAC.md` for instructions.

### 3. Configure Database Connections

Create their own configuration file:
```bash
cp db-config.example.json db-config.json
```

Edit `db-config.json` with their database credentials:
```json
{
  "databases": {
    "postgres": {
      "enabled": true,
      "connections": [
        {
          "name": "my-database",
          "host": "their-db-host",
          "port": 5432,
          "database": "their-db-name",
          "user": "their-username",
          "password": "their-password",
          "ssl": false
        }
      ]
    }
  }
}
```

### 4. Build the Server
```bash
npm run build
```

This compiles TypeScript to JavaScript and makes the server executable.

### 5. Configure in Bob (VS Code Extension)

Add to Bob's MCP settings (`~/.bob/settings/mcp_settings.json`):

```json
{
  "mcpServers": {
    "db-performance": {
      "command": "/opt/homebrew/bin/node",
      "args": [
        "/path/to/db-performance-server/build/index.js"
      ],
      "disabled": false
    }
  }
}
```

**Important**: Replace `/path/to/db-performance-server` with the actual path on their system.

### 6. Restart VS Code

Restart VS Code to load the MCP server.

### 7. Verify Installation

In Bob chat, try:
```
List available database connections
```

The server should respond with configured connections.

## 🔧 Troubleshooting

### Issue: "Cannot find module 'ibm_db'"
**Solution**: DB2 client libraries not installed. See `DB2_CLIENT_INSTALL_MAC.md`.

### Issue: "ECONNREFUSED" when connecting to database
**Solution**: 
- Verify database host/port in `db-config.json`
- Check network connectivity
- Ensure database is running
- Verify firewall rules

### Issue: "Permission denied" when running build
**Solution**:
```bash
chmod +x build/index.js
```

### Issue: Server not appearing in Bob
**Solution**:
- Verify path in `mcp_settings.json` is correct
- Check that `build/index.js` exists
- Restart VS Code
- Check Bob logs for errors

## 🔐 Security Best Practices

1. **Never commit `db-config.json`** to version control
2. **Use environment variables** for sensitive data in production
3. **Restrict database user permissions** to read-only if possible
4. **Use SSL/TLS** for database connections when available
5. **Regularly rotate** database passwords
6. **Review access logs** periodically

## 📚 Additional Resources

- `README.md` - Full feature documentation
- `QUICKSTART.md` - Quick setup guide
- `DB2_SETUP_GUIDE.md` - DB2-specific setup
- `MSSQL_SUPPORT.md` - MS-SQL configuration
- `AURORA_POSTGRES_SETUP.md` - AWS Aurora setup

## 🆘 Support

If your colleague encounters issues:
1. Check the troubleshooting section above
2. Review the relevant setup guide
3. Verify all prerequisites are installed
4. Check database connectivity independently
5. Review Bob logs for error messages

## 📝 Version Information

- **Server Version**: 1.1.0
- **Node.js Required**: v18+
- **Supported Databases**: PostgreSQL, DB2, MS-SQL Server

---

**Last Updated**: 2026-06-19