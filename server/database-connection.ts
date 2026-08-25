import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";
import * as schema from "@shared/schema";

/**
 * Create a robust database connection that works with PostgreSQL
 * Optimized for Neon serverless with proper connection pooling
 */
export function createDatabaseConnection() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  let connectionString = process.env.DATABASE_URL;
  
  // Log connection attempt (without revealing credentials)
  const urlParts = connectionString.split('@');
  const safeUrl = urlParts.length > 1 ? `***@${urlParts[1]}` : 'DATABASE_URL_SET';
  console.log(`📡 Attempting connection to: ${safeUrl}`);
  
  try {
    // Use the same optimized settings as server/db.ts for consistency
    const queryClient = postgres(connectionString, {
      // Connection pool settings optimized for Neon
      max: 10, // Allow multiple connections for better concurrency
      idle_timeout: 20, // Close idle connections after 20 seconds
      max_lifetime: 60 * 10, // Rotate connections every 10 minutes
      connect_timeout: 10,
      
      // Neon-specific optimizations
      prepare: false, // Disable prepared statements (not needed for Neon)
      
      // Handle connection lifecycle events
      onnotice: () => {}, // Suppress notices
      onclose: () => {
        console.log('🔌 Database connection closed - will reconnect on next query');
      },
      
      // Handle connection errors gracefully
      onparameter: () => {}, // Suppress parameter notices
      
      connection: {
        application_name: 'yearbuk_init'
      }
    });
    
    const db = drizzle(queryClient, { schema });
    return db;
  } catch (error) {
    console.error("❌ Failed to create database connection:", error);
    throw error;
  }
}

/**
 * Test database connectivity with better error reporting
 */
export async function testDatabaseConnection() {
  try {
    const db = createDatabaseConnection();
    
    // Simple connectivity test
    console.log("🔍 Testing database connectivity...");
    await db.execute(sql`SELECT 1 as test`);
    console.log("✅ Database connection test successful");
    
    return db;
  } catch (error) {
    console.error("❌ Database connection test failed:");
    
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      
      if (error.message.includes('ECONNREFUSED')) {
        console.error("💡 Connection refused - this usually means:");
        console.error("   1. Database service is not running");
        console.error("   2. Incorrect DATABASE_URL format");
        console.error("   3. Network/firewall blocking connection");
      }
      
      if (error.message.includes('fetch failed')) {
        console.error("💡 Fetch failed - this might mean:");
        console.error("   1. DATABASE_URL format is incorrect");
        console.error("   2. SSL/TLS configuration issue");
        console.error("   3. Network connectivity problem");
      }
    }
    
    throw error;
  }
}