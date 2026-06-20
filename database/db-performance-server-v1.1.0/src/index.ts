#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { Pool, PoolConfig } from "pg";
import * as ibmdb from "ibm_db";
import mssql from "mssql";
import * as fs from "fs";
import * as path from "path";

// Configuration types
interface DatabaseConfig {
  name: string;
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean;
  poolSize?: number;
  schema?: string;
  options?: any;
}

interface ServerConfig {
  databases: {
    postgres?: {
      enabled: boolean;
      connections: DatabaseConfig[];
    };
    db2?: {
      enabled: boolean;
      connections: DatabaseConfig[];
    };
    mssql?: {
      enabled: boolean;
      connections: DatabaseConfig[];
    };
  };
  performance?: {
    queryTimeout?: number;
    slowQueryThreshold?: number;
    enableMetrics?: boolean;
  };
}

// Global configuration
let config: ServerConfig;
const postgresConnections = new Map<string, Pool>();
const db2Connections = new Map<string, ibmdb.Database>();
const mssqlPools = new Map<string, mssql.ConnectionPool>();

// Load configuration from file
function loadConfig(): ServerConfig {
  const configPath = process.env.DB_CONFIG_PATH || "./db-config.json";
  
  try {
    const configData = fs.readFileSync(configPath, "utf-8");
    return JSON.parse(configData);
  } catch (error) {
    console.error(`Failed to load config from ${configPath}:`, error);
    // Return default config
    return {
      databases: {
        postgres: { enabled: false, connections: [] },
        db2: { enabled: false, connections: [] },
        mssql: { enabled: false, connections: [] },
      },
      performance: {
        queryTimeout: 30000,
        slowQueryThreshold: 1000,
        enableMetrics: true,
      },
    };
  }
}

// Initialize PostgreSQL connections
function initializePostgresConnections() {
  if (!config.databases.postgres?.enabled) return;

  for (const dbConfig of config.databases.postgres.connections) {
    const poolConfig: PoolConfig = {
      host: dbConfig.host,
      port: dbConfig.port,
      database: dbConfig.database,
      user: dbConfig.user,
      password: dbConfig.password,
      max: dbConfig.poolSize || 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: config.performance?.queryTimeout || 30000,
    };

    if (dbConfig.ssl) {
      poolConfig.ssl = { rejectUnauthorized: false };
    }

    const pool = new Pool(poolConfig);
    postgresConnections.set(dbConfig.name, pool);
    console.error(`Initialized PostgreSQL connection: ${dbConfig.name}`);
  }
}

// Initialize DB2 connections
function initializeDB2Connections() {
  if (!config.databases.db2?.enabled) return;

  for (const dbConfig of config.databases.db2.connections) {
    try {
      const connStr = `DATABASE=${dbConfig.database};HOSTNAME=${dbConfig.host};PORT=${dbConfig.port};PROTOCOL=TCPIP;UID=${dbConfig.user};PWD=${dbConfig.password};`;
      const db = new ibmdb.Database();
      db.openSync(connStr);
      db2Connections.set(dbConfig.name, db);
      console.error(`Initialized DB2 connection: ${dbConfig.name}`);
    } catch (error) {
      console.error(`Failed to initialize DB2 connection ${dbConfig.name}:`, error);
    }
  }
}

// Initialize MS-SQL connections
async function initializeMSSQLConnections() {
  if (!config.databases.mssql?.enabled) return;

  for (const dbConfig of config.databases.mssql.connections) {
    try {
      const poolConfig: mssql.config = {
        server: dbConfig.host,
        port: dbConfig.port,
        database: dbConfig.database,
        user: dbConfig.user,
        password: dbConfig.password,
        options: {
          encrypt: dbConfig.options?.encrypt ?? true,
          trustServerCertificate: dbConfig.options?.trustServerCertificate ?? false,
          enableArithAbort: true,
        },
        pool: {
          max: dbConfig.poolSize || 10,
          min: 0,
          idleTimeoutMillis: 30000,
        },
        connectionTimeout: config.performance?.queryTimeout || 30000,
        requestTimeout: config.performance?.queryTimeout || 30000,
      };

      const pool = new mssql.ConnectionPool(poolConfig);
      await pool.connect();
      mssqlPools.set(dbConfig.name, pool);
      console.error(`Initialized MS-SQL connection: ${dbConfig.name}`);
    } catch (error) {
      console.error(`Failed to initialize MS-SQL connection ${dbConfig.name}:`, error);
    }
  }
}

// Helper function to execute MS-SQL queries
async function executeMSSQLQuery(connectionName: string, query: string): Promise<any> {
  const pool = mssqlPools.get(connectionName);
  if (!pool) {
    throw new Error(`MS-SQL connection '${connectionName}' not found`);
  }

  try {
    const result = await pool.request().query(query);
    return result.recordset;
  } catch (error) {
    console.error(`MS-SQL query error on ${connectionName}:`, error);
    throw error;
  }
}

// Helper function to execute DB2 queries
async function executeDB2Query(connectionName: string, query: string): Promise<any[]> {
  const db = db2Connections.get(connectionName);
  if (!db) {
    throw new Error(`DB2 connection '${connectionName}' not found`);
  }

  return new Promise((resolve, reject) => {
    db.query(query, (error: Error | null, result: any[]) => {
      if (error) {
        reject(error);
      } else {
        resolve(result);
      }
    });
  });
}

// PostgreSQL Performance Analysis Functions
async function analyzePostgresQueries(connectionName: string, limit: number = 10) {
  const pool = postgresConnections.get(connectionName);
  if (!pool) {
    throw new Error(`PostgreSQL connection '${connectionName}' not found`);
  }

  const query = `
    SELECT 
      query,
      calls,
      total_exec_time,
      mean_exec_time,
      max_exec_time,
      min_exec_time,
      stddev_exec_time,
      rows,
      100.0 * shared_blks_hit / NULLIF(shared_blks_hit + shared_blks_read, 0) AS cache_hit_ratio
    FROM pg_stat_statements
    ORDER BY total_exec_time DESC
    LIMIT $1;
  `;

  try {
    const result = await pool.query(query, [limit]);
    return {
      success: true,
      data: result.rows,
      rowCount: result.rowCount,
    };
  } catch (error: any) {
    if (error.message.includes('pg_stat_statements')) {
      return {
        success: false,
        error: 'pg_stat_statements extension not enabled. Run: CREATE EXTENSION pg_stat_statements;',
      };
    }
    throw error;
  }
}

async function checkPostgresConnections(connectionName: string) {
  const pool = postgresConnections.get(connectionName);
  if (!pool) {
    throw new Error(`PostgreSQL connection '${connectionName}' not found`);
  }

  const query = `
    SELECT 
      count(*) FILTER (WHERE state = 'active') AS active_connections,
      count(*) FILTER (WHERE state = 'idle') AS idle_connections,
      count(*) FILTER (WHERE state = 'idle in transaction') AS idle_in_transaction,
      count(*) FILTER (WHERE wait_event_type IS NOT NULL) AS waiting_connections,
      count(*) AS total_connections,
      max_conn.setting::int AS max_connections
    FROM pg_stat_activity
    CROSS JOIN (SELECT setting FROM pg_settings WHERE name = 'max_connections') AS max_conn
    WHERE pid != pg_backend_pid();
  `;

  const result = await pool.query(query);
  return {
    success: true,
    data: result.rows[0],
  };
}

async function getPostgresTableStats(connectionName: string, schemaName: string = 'public', limit: number = 20) {
  const pool = postgresConnections.get(connectionName);
  if (!pool) {
    throw new Error(`PostgreSQL connection '${connectionName}' not found`);
  }

  const query = `
    SELECT
      schemaname,
      relname as tablename,
      pg_size_pretty(pg_total_relation_size(schemaname||'.'||relname)) AS total_size,
      pg_size_pretty(pg_relation_size(schemaname||'.'||relname)) AS table_size,
      pg_size_pretty(pg_total_relation_size(schemaname||'.'||relname) - pg_relation_size(schemaname||'.'||relname)) AS indexes_size,
      n_live_tup AS live_tuples,
      n_dead_tup AS dead_tuples,
      ROUND(100.0 * n_dead_tup / NULLIF(n_live_tup + n_dead_tup, 0), 2) AS dead_tuple_percent,
      last_vacuum,
      last_autovacuum,
      last_analyze,
      last_autoanalyze,
      seq_scan AS sequential_scans,
      seq_tup_read AS sequential_tuples_read,
      idx_scan AS index_scans,
      idx_tup_fetch AS index_tuples_fetched,
      n_tup_ins AS inserts,
      n_tup_upd AS updates,
      n_tup_del AS deletes
    FROM pg_stat_user_tables
    WHERE schemaname = $1
    ORDER BY pg_total_relation_size(schemaname||'.'||relname) DESC
    LIMIT $2;
  `;

  const result = await pool.query(query, [schemaName, limit]);
  return {
    success: true,
    data: result.rows,
    rowCount: result.rowCount,
  };
}

async function checkPostgresLocks(connectionName: string) {
  const pool = postgresConnections.get(connectionName);
  if (!pool) {
    throw new Error(`PostgreSQL connection '${connectionName}' not found`);
  }

  const query = `
    SELECT 
      blocked_locks.pid AS blocked_pid,
      blocked_activity.usename AS blocked_user,
      blocking_locks.pid AS blocking_pid,
      blocking_activity.usename AS blocking_user,
      blocked_activity.query AS blocked_statement,
      blocking_activity.query AS blocking_statement,
      blocked_activity.application_name AS blocked_application,
      blocking_activity.application_name AS blocking_application,
      blocked_activity.wait_event_type AS blocked_wait_event_type,
      blocked_activity.wait_event AS blocked_wait_event
    FROM pg_catalog.pg_locks blocked_locks
    JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
    JOIN pg_catalog.pg_locks blocking_locks 
      ON blocking_locks.locktype = blocked_locks.locktype
      AND blocking_locks.database IS NOT DISTINCT FROM blocked_locks.database
      AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
      AND blocking_locks.page IS NOT DISTINCT FROM blocked_locks.page
      AND blocking_locks.tuple IS NOT DISTINCT FROM blocked_locks.tuple
      AND blocking_locks.virtualxid IS NOT DISTINCT FROM blocked_locks.virtualxid
      AND blocking_locks.transactionid IS NOT DISTINCT FROM blocked_locks.transactionid
      AND blocking_locks.classid IS NOT DISTINCT FROM blocked_locks.classid
      AND blocking_locks.objid IS NOT DISTINCT FROM blocked_locks.objid
      AND blocking_locks.objsubid IS NOT DISTINCT FROM blocked_locks.objsubid
      AND blocking_locks.pid != blocked_locks.pid
    JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
    WHERE NOT blocked_locks.granted;
  `;

  const result = await pool.query(query);
  return {
    success: true,
    data: result.rows,
    rowCount: result.rowCount || 0,
    hasBlockingQueries: (result.rowCount || 0) > 0,
  };
}

async function getPostgresCacheStats(connectionName: string) {
  const pool = postgresConnections.get(connectionName);
  if (!pool) {
    throw new Error(`PostgreSQL connection '${connectionName}' not found`);
  }

  const query = `
    SELECT 
      sum(heap_blks_read) AS heap_read,
      sum(heap_blks_hit) AS heap_hit,
      sum(heap_blks_hit) / NULLIF(sum(heap_blks_hit) + sum(heap_blks_read), 0) * 100 AS cache_hit_ratio,
      sum(idx_blks_read) AS idx_read,
      sum(idx_blks_hit) AS idx_hit,
      sum(idx_blks_hit) / NULLIF(sum(idx_blks_hit) + sum(idx_blks_read), 0) * 100 AS idx_cache_hit_ratio
    FROM pg_statio_user_tables;
  `;

  const result = await pool.query(query);
  return {
    success: true,
    data: result.rows[0],
  };
}

async function getPostgresIndexUsage(connectionName: string, schemaName: string = 'public', limit: number = 20) {
  const pool = postgresConnections.get(connectionName);
  if (!pool) {
    throw new Error(`PostgreSQL connection '${connectionName}' not found`);
  }

  const query = `
    SELECT
      schemaname,
      relname as tablename,
      indexrelname as indexname,
      idx_scan AS index_scans,
      idx_tup_read AS tuples_read,
      idx_tup_fetch AS tuples_fetched,
      pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
      ROUND(100.0 * idx_tup_fetch / NULLIF(idx_tup_read, 0), 2) AS fetch_efficiency_pct,
      CASE
        WHEN idx_scan = 0 THEN 'UNUSED'
        WHEN idx_scan < 1000 THEN 'RARELY USED'
        WHEN idx_scan < 100000 THEN 'MODERATELY USED'
        WHEN idx_scan < 1000000 THEN 'HEAVILY USED'
        ELSE 'VERY HEAVILY USED'
      END AS usage_status
    FROM pg_stat_user_indexes
    WHERE schemaname = $1
    ORDER BY idx_scan DESC, pg_relation_size(indexrelid) DESC
    LIMIT $2;
  `;

  const result = await pool.query(query, [schemaName, limit]);
  return {
    success: true,
    data: result.rows,
    rowCount: result.rowCount,
  };
}

async function getPostgresDatabaseSize(connectionName: string) {
  const pool = postgresConnections.get(connectionName);
  if (!pool) {
    throw new Error(`PostgreSQL connection '${connectionName}' not found`);
  }

  const query = `
    SELECT 
      pg_database.datname AS database_name,
      pg_size_pretty(pg_database_size(pg_database.datname)) AS size,
      pg_database_size(pg_database.datname) AS size_bytes
    FROM pg_database
    WHERE pg_database.datname = current_database();
  `;

  const result = await pool.query(query);
  return {
    success: true,
    data: result.rows[0],
  };
}

// DB2 Performance Analysis Functions
async function analyzeDB2Queries(connectionName: string, limit: number = 10) {
  try {
    const query = `
      SELECT
        STMT_TEXT,
        NUM_EXECUTIONS,
        TOTAL_CPU_TIME,
        TOTAL_CPU_TIME / NULLIF(NUM_EXECUTIONS, 0) AS AVG_CPU_TIME,
        ROWS_READ,
        POOL_DATA_L_READS + POOL_INDEX_L_READS AS LOGICAL_READS,
        POOL_DATA_P_READS + POOL_INDEX_P_READS AS PHYSICAL_READS
      FROM TABLE(MON_GET_PKG_CACHE_STMT(NULL, NULL, NULL, -2)) AS T
      WHERE NUM_EXECUTIONS > 0
      ORDER BY TOTAL_CPU_TIME DESC
      FETCH FIRST ${limit} ROWS ONLY
    `;
    
    const result = await executeDB2Query(connectionName, query);
    return {
      success: true,
      data: result,
      rowCount: result.length,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

async function checkDB2BufferPools(connectionName: string) {
  try {
    const query = `
      SELECT
        BP_NAME,
        BP_CUR_BUFFSZ AS CURRENT_SIZE,
        POOL_DATA_L_READS + POOL_INDEX_L_READS AS LOGICAL_READS,
        POOL_DATA_P_READS + POOL_INDEX_P_READS AS PHYSICAL_READS,
        CASE
          WHEN (POOL_DATA_L_READS + POOL_INDEX_L_READS) > 0
          THEN DECIMAL((1 - (FLOAT(POOL_DATA_P_READS + POOL_INDEX_P_READS) /
               FLOAT(POOL_DATA_L_READS + POOL_INDEX_L_READS))) * 100, 5, 2)
          ELSE 0
        END AS HIT_RATIO_PERCENT
      FROM TABLE(MON_GET_BUFFERPOOL(NULL, -2)) AS T
      ORDER BY BP_NAME
    `;
    
    const result = await executeDB2Query(connectionName, query);
    return {
      success: true,
      data: result,
      rowCount: result.length,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

async function getDB2TablespaceUsage(connectionName: string) {
  try {
    const query = `
      SELECT
        TBSP_NAME,
        TBSP_ID,
        TBSP_PAGE_SIZE,
        TBSP_TOTAL_PAGES,
        TBSP_USABLE_PAGES,
        TBSP_USED_PAGES,
        TBSP_FREE_PAGES,
        TBSP_PAGE_TOP,
        TBSP_PENDING_FREE_PAGES,
        (TBSP_TOTAL_PAGES * TBSP_PAGE_SIZE / 1024) AS TOTAL_SIZE_KB,
        (TBSP_USED_PAGES * TBSP_PAGE_SIZE / 1024) AS USED_SIZE_KB,
        (TBSP_FREE_PAGES * TBSP_PAGE_SIZE / 1024) AS FREE_SIZE_KB,
        CASE
          WHEN TBSP_USABLE_PAGES > 0
          THEN DECIMAL((FLOAT(TBSP_USED_PAGES) / FLOAT(TBSP_USABLE_PAGES)) * 100, 5, 2)
          ELSE 0
        END AS USED_PERCENT,
        CASE
          WHEN TBSP_TOTAL_PAGES > 0
          THEN DECIMAL((FLOAT(TBSP_PAGE_TOP) / FLOAT(TBSP_TOTAL_PAGES)) * 100, 5, 2)
          ELSE 0
        END AS HWM_PERCENT
      FROM TABLE(MON_GET_TABLESPACE('', -2)) AS T
      ORDER BY USED_PERCENT DESC
    `;
    
    const result = await executeDB2Query(connectionName, query);
    return {
      success: true,
      data: result,
      rowCount: result.length,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

async function checkDB2Locks(connectionName: string) {
  try {
    const query = `
      SELECT
        AGENT_ID,
        APPLICATION_HANDLE,
        LOCK_OBJECT_TYPE,
        LOCK_MODE,
        LOCK_STATUS,
        LOCK_WAIT_START_TIME,
        TABSCHEMA,
        TABNAME
      FROM TABLE(MON_GET_LOCKS(NULL, -2)) AS T
      WHERE LOCK_STATUS = 'W'
      ORDER BY LOCK_WAIT_START_TIME
    `;
    
    const result = await executeDB2Query(connectionName, query);
    return {
      success: true,
      data: result,
      rowCount: result.length,
      hasBlockingLocks: result.length > 0,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

async function getDB2ConnectionStats(connectionName: string) {
  try {
    const query = `
      SELECT
        APPLICATION_HANDLE,
        APPLICATION_NAME,
        APPLICATION_STATUS,
        CLIENT_HOSTNAME,
        CLIENT_IPADDR,
        TOTAL_CPU_TIME,
        ROWS_READ,
        ROWS_MODIFIED,
        TOTAL_WAIT_TIME
      FROM TABLE(MON_GET_CONNECTION(NULL, -2)) AS T
      WHERE APPLICATION_HANDLE > 0
      ORDER BY TOTAL_CPU_TIME DESC
    `;
    
    const result = await executeDB2Query(connectionName, query);
    return {
      success: true,
      data: result,
      rowCount: result.length,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

async function checkDB2TableStats(connectionName: string, schema: string = "DB2INST1") {
  try {
    const query = `
      SELECT 
        TABSCHEMA,
        TABNAME,
        CARD AS ROW_COUNT,
        NPAGES,
        FPAGES,
        OVERFLOW,
        STATS_TIME,
        CASE 
          WHEN NPAGES > 0 THEN DECIMAL((FLOAT(FPAGES) / FLOAT(NPAGES)) * 100, 5, 2)
          ELSE 0 
        END AS SPACE_UTIL_PCT,
        CASE
          WHEN OVERFLOW > 0 AND CARD > 0 THEN DECIMAL((FLOAT(OVERFLOW) / FLOAT(CARD)) * 100, 5, 2)
          ELSE 0
        END AS OVERFLOW_PCT,
        CASE
          WHEN STATS_TIME IS NULL THEN 'NEVER'
          WHEN DAYS(CURRENT TIMESTAMP) - DAYS(STATS_TIME) > 30 THEN 'OUTDATED'
          WHEN DAYS(CURRENT TIMESTAMP) - DAYS(STATS_TIME) > 7 THEN 'OLD'
          ELSE 'CURRENT'
        END AS STATS_STATUS,
        CASE
          WHEN STATS_TIME IS NULL THEN 1
          WHEN (NPAGES > 0 AND FPAGES * 100.0 / NULLIF(NPAGES, 0) < 70) THEN 1
          WHEN (OVERFLOW > 0 AND OVERFLOW * 100.0 / NULLIF(CARD, 0) > 10) THEN 1
          ELSE 0
        END AS NEEDS_REORG,
        CASE
          WHEN STATS_TIME IS NULL THEN 1
          WHEN DAYS(CURRENT TIMESTAMP) - DAYS(STATS_TIME) > 7 THEN 1
          ELSE 0
        END AS NEEDS_RUNSTATS
      FROM SYSCAT.TABLES
      WHERE TYPE = 'T'
        AND TABSCHEMA = '${schema.toUpperCase()}'
        AND NPAGES IS NOT NULL
      ORDER BY 
        NEEDS_REORG DESC,
        NEEDS_RUNSTATS DESC,
        NPAGES DESC
    `;
    
    const result = await executeDB2Query(connectionName, query);
    
    const needsReorg = result.filter((r: any) => r.NEEDS_REORG === 1);
    const needsRunstats = result.filter((r: any) => r.NEEDS_RUNSTATS === 1);
    
    return {
      success: true,
      data: result,
      rowCount: result.length,
      summary: {
        totalTables: result.length,
        needsReorg: needsReorg.length,
        needsRunstats: needsRunstats.length,
        tablesNeedingReorg: needsReorg.map((r: any) => ({
          table: `${r.TABSCHEMA}.${r.TABNAME}`,
          spaceUtil: r.SPACE_UTIL_PCT,
          overflow: r.OVERFLOW_PCT,
        })),
        tablesNeedingRunstats: needsRunstats.map((r: any) => ({
          table: `${r.TABSCHEMA}.${r.TABNAME}`,
          statsStatus: r.STATS_STATUS,
          lastStats: r.STATS_TIME,
        })),
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

// MS-SQL Performance Functions
async function analyzeMSSQLQueries(connectionName: string, limit: number = 10) {
  try {
    const query = `
      SELECT TOP ${limit}
        qs.execution_count,
        SUBSTRING(qt.text, (qs.statement_start_offset/2)+1,
          ((CASE qs.statement_end_offset
            WHEN -1 THEN DATALENGTH(qt.text)
            ELSE qs.statement_end_offset
          END - qs.statement_start_offset)/2) + 1) AS query_text,
        qs.total_worker_time / 1000 AS total_cpu_ms,
        qs.total_elapsed_time / 1000 AS total_elapsed_ms,
        qs.total_logical_reads,
        qs.total_logical_writes,
        qs.total_physical_reads,
        qs.last_execution_time,
        (qs.total_elapsed_time / 1000) / qs.execution_count AS avg_elapsed_ms,
        (qs.total_worker_time / 1000) / qs.execution_count AS avg_cpu_ms
      FROM sys.dm_exec_query_stats qs
      CROSS APPLY sys.dm_exec_sql_text(qs.sql_handle) qt
      ORDER BY qs.total_elapsed_time DESC
    `;

    const data = await executeMSSQLQuery(connectionName, query);
    return {
      success: true,
      data,
      rowCount: data.length,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

// Execute custom SQL query
async function executeCustomPostgresQuery(
  connectionName: string,
  query: string
) {
  const pool = postgresConnections.get(connectionName);
  if (!pool) {
    throw new Error(`PostgreSQL connection '${connectionName}' not found`);
  }

  try {
    const result = await pool.query(query);
    return {
      success: true,
      data: result.rows,
      rowCount: result.rowCount,
      fields: result.fields?.map(f => ({ name: f.name, dataType: f.dataTypeID })),
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
      detail: error.detail,
    };
  }
}

async function executeCustomDB2Query(connectionName: string, query: string) {
  try {
    const result = await executeDB2Query(connectionName, query);
    return {
      success: true,
      data: result,
      rowCount: result.length,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

async function executeCustomMSSQLQuery(connectionName: string, query: string) {
  try {
    const result = await executeMSSQLQuery(connectionName, query);
    return {
      success: true,
      data: result,
      rowCount: result.length,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}


async function checkMSSQLConnections(connectionName: string) {
  try {
    const query = `
      SELECT 
        DB_NAME(dbid) as database_name,
        COUNT(dbid) as connection_count,
        SUM(CASE WHEN status = 'sleeping' THEN 1 ELSE 0 END) as idle_connections,
        SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) as active_connections
      FROM sys.sysprocesses
      WHERE dbid > 0
      GROUP BY DB_NAME(dbid)
    `;

    const data = await executeMSSQLQuery(connectionName, query);
    return {
      success: true,
      data,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

async function getMSSQLTableStats(connectionName: string, schema: string = "dbo", limit: number = 20) {
  try {
    const query = `
      SELECT TOP ${limit}
        t.name AS table_name,
        s.name AS schema_name,
        p.rows AS row_count,
        SUM(a.total_pages) * 8 AS total_space_kb,
        SUM(a.used_pages) * 8 AS used_space_kb,
        (SUM(a.total_pages) - SUM(a.used_pages)) * 8 AS unused_space_kb,
        i.name AS index_name,
        i.type_desc AS index_type
      FROM sys.tables t
      INNER JOIN sys.indexes i ON t.object_id = i.object_id
      INNER JOIN sys.partitions p ON i.object_id = p.object_id AND i.index_id = p.index_id
      INNER JOIN sys.allocation_units a ON p.partition_id = a.container_id
      INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
      WHERE s.name = '${schema}'
      GROUP BY t.name, s.name, p.rows, i.name, i.type_desc
      ORDER BY SUM(a.total_pages) DESC
    `;

    const data = await executeMSSQLQuery(connectionName, query);
    return {
      success: true,
      data,
      rowCount: data.length,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

async function checkMSSQLLocks(connectionName: string) {
  try {
    const query = `
      SELECT 
        tl.request_session_id AS session_id,
        tl.resource_type,
        tl.resource_database_id,
        DB_NAME(tl.resource_database_id) AS database_name,
        tl.resource_description,
        tl.request_mode,
        tl.request_status,
        wt.blocking_session_id,
        wt.wait_duration_ms,
        wt.wait_type,
        s.login_name,
        s.host_name,
        s.program_name,
        SUBSTRING(qt.text, (er.statement_start_offset/2)+1,
          ((CASE er.statement_end_offset
            WHEN -1 THEN DATALENGTH(qt.text)
            ELSE er.statement_end_offset
          END - er.statement_start_offset)/2) + 1) AS query_text
      FROM sys.dm_tran_locks tl
      LEFT JOIN sys.dm_os_waiting_tasks wt ON tl.lock_owner_address = wt.resource_address
      LEFT JOIN sys.dm_exec_sessions s ON tl.request_session_id = s.session_id
      LEFT JOIN sys.dm_exec_requests er ON s.session_id = er.session_id
      OUTER APPLY sys.dm_exec_sql_text(er.sql_handle) qt
      WHERE tl.request_status = 'WAIT'
      ORDER BY wt.wait_duration_ms DESC
    `;

    const data = await executeMSSQLQuery(connectionName, query);
    const hasBlockingLocks = data.some((row: any) => row.blocking_session_id !== null);

    return {
      success: true,
      data,
      rowCount: data.length,
      hasBlockingLocks,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

async function getMSSQLCacheStats(connectionName: string) {
  try {
    const query = `
      SELECT 
        (a.cntr_value * 1.0 / b.cntr_value) * 100.0 AS buffer_cache_hit_ratio
      FROM sys.dm_os_performance_counters a
      JOIN (
        SELECT cntr_value, object_name
        FROM sys.dm_os_performance_counters
        WHERE counter_name = 'Buffer cache hit ratio base'
      ) b ON a.object_name = b.object_name
      WHERE a.counter_name = 'Buffer cache hit ratio'
    `;

    const data = await executeMSSQLQuery(connectionName, query);
    return {
      success: true,
      data,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

async function getMSSQLIndexUsage(connectionName: string, schema: string = "dbo", limit: number = 20) {
  try {
    const query = `
      SELECT TOP ${limit}
        OBJECT_NAME(s.object_id) AS table_name,
        i.name AS index_name,
        s.user_seeks,
        s.user_scans,
        s.user_lookups,
        s.user_updates,
        s.last_user_seek,
        s.last_user_scan,
        s.last_user_lookup
      FROM sys.dm_db_index_usage_stats s
      INNER JOIN sys.indexes i ON s.object_id = i.object_id AND s.index_id = i.index_id
      INNER JOIN sys.objects o ON i.object_id = o.object_id
      INNER JOIN sys.schemas sc ON o.schema_id = sc.schema_id
      WHERE s.database_id = DB_ID()
        AND sc.name = '${schema}'
        AND i.name IS NOT NULL
      ORDER BY s.user_seeks + s.user_scans + s.user_lookups DESC
    `;

    const data = await executeMSSQLQuery(connectionName, query);
    return {
      success: true,
      data,
      rowCount: data.length,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

async function getMSSQLDatabaseSize(connectionName: string) {
  try {
    const query = `
      SELECT 
        DB_NAME() AS database_name,
        SUM(CAST(FILEPROPERTY(name, 'SpaceUsed') AS bigint) * 8192) / 1024 / 1024 AS used_space_mb,
        SUM(size * 8192) / 1024 / 1024 AS allocated_space_mb,
        SUM(size * 8192) / 1024 / 1024 - SUM(CAST(FILEPROPERTY(name, 'SpaceUsed') AS bigint) * 8192) / 1024 / 1024 AS free_space_mb
      FROM sys.database_files
    `;

    const data = await executeMSSQLQuery(connectionName, query);
    return {
      success: true,
      data,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

// Create MCP Server
const server = new Server(
  {
    name: "db-performance-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define available tools
const tools: Tool[] = [
  // PostgreSQL Tools
  {
    name: "analyze_postgres_queries",
    description: "Analyze slow PostgreSQL queries using pg_stat_statements. Returns top queries by execution time with statistics.",
    inputSchema: {
      type: "object",
      properties: {
        connection: {
          type: "string",
          description: "PostgreSQL connection name from config",
        },
        limit: {
          type: "number",
          description: "Number of queries to return (default: 10)",
          default: 10,
        },
      },
      required: ["connection"],
    },
  },
  {
    name: "check_postgres_connections",
    description: "Monitor PostgreSQL connection pool status including active, idle, and waiting connections.",
    inputSchema: {
      type: "object",
      properties: {
        connection: {
          type: "string",
          description: "PostgreSQL connection name from config",
        },
      },
      required: ["connection"],
    },
  },
  {
    name: "get_postgres_table_stats",
    description: "Get PostgreSQL table statistics including sizes, tuple counts, and vacuum information.",
    inputSchema: {
      type: "object",
      properties: {
        connection: {
          type: "string",
          description: "PostgreSQL connection name from config",
        },
        schema: {
          type: "string",
          description: "Schema name (default: public)",
          default: "public",
        },
        limit: {
          type: "number",
          description: "Number of tables to return (default: 20)",
          default: 20,
        },
      },
      required: ["connection"],
    },
  },
  {
    name: "check_postgres_locks",
    description: "Identify blocking queries and lock contention in PostgreSQL.",
    inputSchema: {
      type: "object",
      properties: {
        connection: {
          type: "string",
          description: "PostgreSQL connection name from config",
        },
      },
      required: ["connection"],
    },
  },
  {
    name: "get_postgres_cache_stats",
    description: "Monitor PostgreSQL buffer cache hit ratios for tables and indexes.",
    inputSchema: {
      type: "object",
      properties: {
        connection: {
          type: "string",
          description: "PostgreSQL connection name from config",
        },
      },
      required: ["connection"],
    },
  },
  {
    name: "get_postgres_index_usage",
    description: "Analyze PostgreSQL index usage to identify unused or rarely used indexes.",
    inputSchema: {
      type: "object",
      properties: {
        connection: {
          type: "string",
          description: "PostgreSQL connection name from config",
        },
        schema: {
          type: "string",
          description: "Schema name (default: public)",
          default: "public",
        },
        limit: {
          type: "number",
          description: "Number of indexes to return (default: 20)",
          default: 20,
        },
      },
      required: ["connection"],
    },
  },
  {
    name: "get_postgres_database_size",
    description: "Get current PostgreSQL database size information.",
    inputSchema: {
      type: "object",
      properties: {
        connection: {
          type: "string",
          description: "PostgreSQL connection name from config",
        },
      },
      required: ["connection"],
    },
  },
  // DB2 Tools (Placeholders)
  {
    name: "analyze_db2_queries",
    description: "Analyze DB2 SQL statement performance (requires ibm_db package).",
    inputSchema: {
      type: "object",
      properties: {
        connection: {
          type: "string",
          description: "DB2 connection name from config",
        },
        limit: {
          type: "number",
          description: "Number of queries to return (default: 10)",
          default: 10,
        },
      },
      required: ["connection"],
    },
  },
  {
    name: "check_db2_bufferpools",
    description: "Monitor DB2 buffer pool statistics (requires ibm_db package).",
    inputSchema: {
      type: "object",
      properties: {
        connection: {
          type: "string",
          description: "DB2 connection name from config",
        },
      },
      required: ["connection"],
    },
  },
  {
    name: "get_db2_tablespace_usage",
    description: "Check DB2 tablespace utilization (requires ibm_db package).",
    inputSchema: {
      type: "object",
      properties: {
        connection: {
          type: "string",
          description: "DB2 connection name from config",
        },
      },
      required: ["connection"],
    },
  },
  {
    name: "check_db2_locks",
    description: "Monitor DB2 locks and deadlocks (requires ibm_db package).",
    inputSchema: {
      type: "object",
      properties: {
        connection: {
          type: "string",
          description: "DB2 connection name from config",
        },
      },
      required: ["connection"],
    },
  },
  {
    name: "get_db2_connection_stats",
    description: "Get DB2 application connection statistics (requires ibm_db package).",
    inputSchema: {
      type: "object",
      properties: {
        connection: {
          type: "string",
          description: "DB2 connection name from config",
        },
      },
      required: ["connection"],
    },
  },
  {
    name: "check_db2_table_stats",
    description: "Check DB2 table statistics to identify tables needing REORG or RUNSTATS.",
    inputSchema: {
      type: "object",
      properties: {
        connection: {
          type: "string",
          description: "DB2 connection name from config",
        },
        schema: {
          type: "string",
          description: "Schema name (default: DB2INST1)",
          default: "DB2INST1",
        },
      },
      required: ["connection"],
    },
  },
  // MS-SQL Tools
  {
    name: "analyze_mssql_queries",
    description: "Analyze slow MS-SQL queries using sys.dm_exec_query_stats. Returns top queries by execution time.",
    inputSchema: {
      type: "object",
      properties: {
        connection: {
          type: "string",
          description: "MS-SQL connection name from config",
        },
        limit: {
          type: "number",
          description: "Number of queries to return (default: 10)",
          default: 10,
        },
      },
      required: ["connection"],
    },
  },
  {
    name: "check_mssql_connections",
    description: "Monitor MS-SQL connection statistics by database.",
    inputSchema: {
      type: "object",
      properties: {
        connection: {
          type: "string",
          description: "MS-SQL connection name from config",
        },
      },
      required: ["connection"],
    },
  },
  {
    name: "get_mssql_table_stats",
    description: "Get MS-SQL table statistics including sizes and row counts.",
    inputSchema: {
      type: "object",
      properties: {
        connection: {
          type: "string",
          description: "MS-SQL connection name from config",
        },
        schema: {
          type: "string",
          description: "Schema name (default: dbo)",
          default: "dbo",
        },
        limit: {
          type: "number",
          description: "Number of tables to return (default: 20)",
          default: 20,
        },
      },
      required: ["connection"],
    },
  },
  {
    name: "check_mssql_locks",
    description: "Identify blocking queries and lock contention in MS-SQL.",
    inputSchema: {
      type: "object",
      properties: {
        connection: {
          type: "string",
          description: "MS-SQL connection name from config",
        },
      },
      required: ["connection"],
    },
  },
  {
    name: "get_mssql_cache_stats",
    description: "Monitor MS-SQL buffer cache hit ratios.",
    inputSchema: {
      type: "object",
      properties: {
        connection: {
          type: "string",
          description: "MS-SQL connection name from config",
        },
      },
      required: ["connection"],
    },
  },
  {
    name: "get_mssql_index_usage",
    description: "Analyze MS-SQL index usage to identify unused or rarely used indexes.",
    inputSchema: {
      type: "object",
      properties: {
        connection: {
          type: "string",
          description: "MS-SQL connection name from config",
        },
        schema: {
          type: "string",
          description: "Schema name (default: dbo)",
          default: "dbo",
        },
        limit: {
          type: "number",
          description: "Number of indexes to return (default: 20)",
          default: 20,
        },
      },
      required: ["connection"],
    },
  },
  {
    name: "get_mssql_database_size",
    description: "Get current MS-SQL database size information.",
    inputSchema: {
      type: "object",
      properties: {
        connection: {
          type: "string",
          description: "MS-SQL connection name from config",
        },
      },
      required: ["connection"],
    },
  },
    {
    name: "execute_postgres_query",
    description: "Execute a custom SQL query on PostgreSQL. Use for ad-hoc queries, filtering specific data, or complex analysis not covered by other tools.",
    inputSchema: {
      type: "object",
      properties: {
        connection: {
          type: "string",
          description: "PostgreSQL connection name from config",
        },
        query: {
          type: "string",
          description: "SQL query to execute (SELECT statements only recommended)",
        },
      },
      required: ["connection", "query"],
    },
  },
  {
    name: "execute_db2_query",
    description: "Execute a custom SQL query on DB2. Use for ad-hoc queries, filtering specific data, or complex analysis not covered by other tools.",
    inputSchema: {
      type: "object",
      properties: {
        connection: {
          type: "string",
          description: "DB2 connection name from config",
        },
        query: {
          type: "string",
          description: "SQL query to execute (SELECT statements only recommended)",
        },
      },
      required: ["connection", "query"],
    },
  },
  {
    name: "execute_mssql_query",
    description: "Execute a custom SQL query on MS-SQL. Use for ad-hoc queries, filtering specific data, or complex analysis not covered by other tools.",
    inputSchema: {
      type: "object",
      properties: {
        connection: {
          type: "string",
          description: "MS-SQL connection name from config",
        },
        query: {
          type: "string",
          description: "SQL query to execute (SELECT statements only recommended)",
        },
      },
      required: ["connection", "query"],
    },
  },

  {
    name: "list_connections",
    description: "List all configured database connections (PostgreSQL, DB2, and MS-SQL).",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
];

// Handle list tools request
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      // PostgreSQL Tools
      case "analyze_postgres_queries": {
        const { connection, limit = 10 } = args as { connection: string; limit?: number };
        const result = await analyzePostgresQueries(connection, limit);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "check_postgres_connections": {
        const { connection } = args as { connection: string };
        const result = await checkPostgresConnections(connection);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "get_postgres_table_stats": {
        const { connection, schema = "public", limit = 20 } = args as {
          connection: string;
          schema?: string;
          limit?: number;
        };
        const result = await getPostgresTableStats(connection, schema, limit);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "check_postgres_locks": {
        const { connection } = args as { connection: string };
        const result = await checkPostgresLocks(connection);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "get_postgres_cache_stats": {
        const { connection } = args as { connection: string };
        const result = await getPostgresCacheStats(connection);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "get_postgres_index_usage": {
        const { connection, schema = "public", limit = 20 } = args as {
          connection: string;
          schema?: string;
          limit?: number;
        };
        const result = await getPostgresIndexUsage(connection, schema, limit);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "get_postgres_database_size": {
        const { connection } = args as { connection: string };
        const result = await getPostgresDatabaseSize(connection);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      // DB2 Tools
      case "analyze_db2_queries": {
        const { connection, limit = 10 } = args as { connection: string; limit?: number };
        const result = await analyzeDB2Queries(connection, limit);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "check_db2_bufferpools": {
        const { connection } = args as { connection: string };
        const result = await checkDB2BufferPools(connection);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "get_db2_tablespace_usage": {
        const { connection } = args as { connection: string };
        const result = await getDB2TablespaceUsage(connection);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "check_db2_locks": {
        const { connection } = args as { connection: string };
        const result = await checkDB2Locks(connection);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "get_db2_connection_stats": {
        const { connection } = args as { connection: string };
        const result = await getDB2ConnectionStats(connection);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "check_db2_table_stats": {
        const { connection, schema = "DB2INST1" } = args as { connection: string; schema?: string };
        const result = await checkDB2TableStats(connection, schema);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      // MS-SQL Tools
      case "analyze_mssql_queries": {
        const { connection, limit = 10 } = args as { connection: string; limit?: number };
        const result = await analyzeMSSQLQueries(connection, limit);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "check_mssql_connections": {
        const { connection } = args as { connection: string };
        const result = await checkMSSQLConnections(connection);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "get_mssql_table_stats": {
        const { connection, schema = "dbo", limit = 20 } = args as {
          connection: string;
          schema?: string;
          limit?: number;
        };
        const result = await getMSSQLTableStats(connection, schema, limit);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "check_mssql_locks": {
        const { connection } = args as { connection: string };
        const result = await checkMSSQLLocks(connection);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "get_mssql_cache_stats": {
        const { connection } = args as { connection: string };
        const result = await getMSSQLCacheStats(connection);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "get_mssql_index_usage": {
        const { connection, schema = "dbo", limit = 20 } = args as {
          connection: string;
          schema?: string;
          limit?: number;
        };
        const result = await getMSSQLIndexUsage(connection, schema, limit);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "get_mssql_database_size": {
        const { connection } = args as { connection: string };
        const result = await getMSSQLDatabaseSize(connection);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "execute_postgres_query": {
        const { connection, query } = args as { connection: string; query: string };
        const result = await executeCustomPostgresQuery(connection, query);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "execute_db2_query": {
        const { connection, query } = args as { connection: string; query: string };
        const result = await executeCustomDB2Query(connection, query);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "execute_mssql_query": {
        const { connection, query } = args as { connection: string; query: string };
        const result = await executeCustomMSSQLQuery(connection, query);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "list_connections": {
        const connections = {
          postgres: config.databases.postgres?.enabled
            ? config.databases.postgres.connections.map((c) => ({
                name: c.name,
                host: c.host,
                port: c.port,
                database: c.database,
              }))
            : [],
          db2: config.databases.db2?.enabled
            ? config.databases.db2.connections.map((c) => ({
                name: c.name,
                host: c.host,
                port: c.port,
                database: c.database,
              }))
            : [],
          mssql: config.databases.mssql?.enabled
            ? config.databases.mssql.connections.map((c) => ({
                name: c.name,
                host: c.host,
                port: c.port,
                database: c.database,
              }))
            : [],
        };
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(connections, null, 2),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error: any) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

// Initialize and start server
async function main() {
  console.error("Loading configuration...");
  config = loadConfig();
  
  console.error("Initializing database connections...");
  initializePostgresConnections();
  initializeDB2Connections();
  await initializeMSSQLConnections();
  
  console.error("Starting DB Performance MCP Server...");
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("DB Performance MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

// Made with Bob
