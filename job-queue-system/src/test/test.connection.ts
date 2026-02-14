import { getPool } from "../db/connection";

async function test() {
  try {
    const client = await getPool().connect();

    console.log("Connected to database successfully");
    client.release();
    process.exit(0);
  } catch (err) {
    console.error("Connection failed:", err);
    process.exit(1);
  }
}

