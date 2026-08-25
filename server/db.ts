import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from "postgres";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Create postgres connection with optimized settings for Neon serverless
export const queryClient = postgres(process.env.DATABASE_URL, {
  // Connection pool settings optimized for Neon
  max: 10, // Allow multiple connections for better concurrency
  idle_timeout: 20, // Close idle connections after 20 seconds (Neon will close anyway)
  max_lifetime: 60 * 10, // Rotate connections every 10 minutes to prevent stale connections
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
    application_name: 'yearbuk_app'
  }
});

export const db = drizzle(queryClient, { schema });

// Add process-level error handlers to prevent crashes from database connection terminations
process.on('uncaughtException', (err: Error) => {
  // Only handle database connection errors gracefully
  if (err.message?.includes('terminating connection') || 
      err.message?.includes('Connection terminated') ||
      err.message?.includes('ProcessInterrupts') ||
      (err as any).code === '57P01' ||
      (err as any).code === '57P03') {
    console.error('⚠️  Database client error (handled):', err.message);
    // Don't exit - let the app continue and reconnect on next query
  } else {
    // For other errors, log and exit as normal
    console.error('❌ Uncaught Exception:', err);
    process.exit(1);
  }
});

// Handle unhandled promise rejections from database connections
process.on('unhandledRejection', (reason: any) => {
  if (reason?.message?.includes('terminating connection') || 
      reason?.message?.includes('Connection terminated') ||
      reason?.code === '57P01' ||
      reason?.code === '57P03') {
    console.error('⚠️  Database client error (handled):', reason.message || reason);
    // Don't exit - connections will be re-established
  } else {
    console.error('❌ Unhandled Rejection:', reason);
    process.exit(1);
  }
});
