import { sql } from "drizzle-orm";
import { users } from "@shared/schema";
import { hashPassword } from "./password-utils";

/**
 * Fallback initialization using basic PostgreSQL connection
 * This is a simpler approach that might work better on Render
 */
export async function initializeDatabaseFallback() {
  try {
    console.log("🔄 Attempting fallback database initialization...");
    
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL environment variable is not set");
    }
    
    // Try using node-postgres directly for better Render compatibility
    const { Pool } = await import('pg');
    
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    
    // Add error handler to prevent crashes
    pool.on('error', (err) => {
      console.error('Unexpected database pool error:', err);
    });
    
    console.log("📡 Testing basic PostgreSQL connection...");
    const client = await pool.connect();
    
    // Test connection
    await client.query('SELECT 1');
    console.log("✅ Basic PostgreSQL connection successful");
    
    // Check if users table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      );
    `);
    
    if (!tableCheck.rows[0].exists) {
      console.log("❌ Users table does not exist");
      console.log("💡 Run 'npm run db:push' to create tables first");
      client.release();
      pool.end();
      return false;
    }
    
    // Check if any users exist
    const userCount = await client.query('SELECT COUNT(*) FROM users');
    const count = parseInt(userCount.rows[0].count);
    
    if (count === 0) {
      console.log("📝 No users found, creating super-admin with basic SQL...");
      
      const plainPassword = process.env.SUPER_ADMIN_PASSWORD || 'admin123';
      const hashedPassword = await hashPassword(plainPassword);
      
      await client.query(`
        INSERT INTO users (username, password, user_type, role, first_name, last_name, full_name, date_of_birth, email)
        VALUES ('admin', $1, 'super_admin', 'super_admin', 'Super', 'Admin', 'Super Admin', '1990-01-01', 'netonwabuisi83@gmail.com')
      `, [hashedPassword]);
      
      console.log("✅ Super-admin created successfully with bcrypt-hashed password");
      console.log("   Username: admin");
      console.log("   Password: [SECURED - bcrypt hashed]");
    } else {
      console.log(`✅ Found ${count} existing users, skipping super-admin creation`);
    }
    
    client.release();
    await pool.end();
    
    console.log("✅ Fallback database initialization complete");
    return true;
    
  } catch (error) {
    console.error("❌ Fallback database initialization failed:", error);
    return false;
  }
}