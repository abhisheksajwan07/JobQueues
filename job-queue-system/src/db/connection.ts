import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const query = (text: string, params?: any[]) => {
  return pool.query(text, params);
};

export const getPool = (): Pool => {
  return pool;
};
const testConnection = async () => {
  try {
    const client = await getPool().connect();
    console.log("Connected to database successfully");
    client.release();
  } catch (err) {
    console.error("Error connecting to database:", err);
  }
};
if (require.main === module) {
  testConnection();
}
