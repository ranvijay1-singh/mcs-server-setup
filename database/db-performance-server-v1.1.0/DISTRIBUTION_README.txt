DATABASE PERFORMANCE MCP SERVER - DISTRIBUTION PACKAGE
======================================================

Thank you for using the Database Performance MCP Server!

QUICK START:
-----------
1. Extract this archive
2. Read SHARING_GUIDE.md for complete setup instructions
3. Install dependencies: npm install
4. Configure your databases: cp db-config.example.json db-config.json
5. Edit db-config.json with your database credentials
6. Build the server: npm run build
7. Configure in Bob's MCP settings
8. Restart VS Code

IMPORTANT SECURITY NOTES:
------------------------
- NEVER commit db-config.json to version control
- Keep your database credentials secure
- Use read-only database users when possible
- Enable SSL/TLS for database connections

DOCUMENTATION:
-------------
- SHARING_GUIDE.md - Complete setup and sharing instructions
- README.md - Feature documentation and usage guide
- QUICKSTART.md - Quick setup guide
- DB2_SETUP_GUIDE.md - DB2-specific setup instructions
- MSSQL_SUPPORT.md - MS-SQL Server configuration
- AURORA_POSTGRES_SETUP.md - AWS Aurora PostgreSQL setup

SUPPORT:
--------
If you encounter issues:
1. Check the SHARING_GUIDE.md troubleshooting section
2. Verify all prerequisites are installed
3. Check database connectivity
4. Review Bob logs for errors

VERSION INFORMATION:
-------------------
Server Version: 1.1.0
Package Date: 2026-06-19 15:52:54
Node.js Required: v18+
Supported Databases: PostgreSQL, DB2, MS-SQL Server
