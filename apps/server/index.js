import express from "express";
import logger from "morgan";
import dotenv from "dotenv";
import { createClient } from "@libsql/client";

import { Server } from "socket.io";
import { createServer } from "node:http";
dotenv.config();
const port = process.env.PORT ?? 3000;

const app = express();
const server = createServer(app);
const io = new Server(server, {
  connectionStateRecovery: {
    maxDisconnectionDuration: 1000,
  },
});

const db = createClient({
  url: "libsql://polished-elasti-girl-polgubau.turso.io",
  authToken: process.env.LIBSQL_AUTH_TOKEN,
});

await db.execute(`
CREATE TABLE IF NOT EXISTS messages (
  id INTERGER PRIMARY KEY AUTOINCREMENT,
  content TEXT,
   )
`);

io.on("connection", async (socket) => {
  console.log("a user connected");

  socket.on("disconnect", () => {
    console.log("user disconnected");
  });

  socket.on("chat message", async (msg) => {
    let result;
    try {
      result = await db.execute({
        sql: `  INSERT INTO messages (content) VALUES (':content')`,
        args: {
          content: msg,
        },
      });
    } catch (error) {
      console.error(error);
    }

    io.emit("chat message", msg, result.lastInsertRowid.toString());
  });

  console.log(socket.handshake.auth);

  if (!socket.recovered) {
    try {
      const result = await db.execute({
        sql: `SELECT id, content FROM messages ORDER BY id DESC LIMIT 10 WHERE id > ?`,
        args: [socket.handshake.auth.serverOffset ?? 0],
      });
      for (const row of result.rows) {
        io.emit("chat message", row.content, row.id.toString());
      }
    } catch (error) {
      console.error(error);
    }
  }
});

app.use(logger("dev"));

app.get("/", (req, res) => {
  res.sendFile(process.cwd() + "/apps/client/index.html");
});

server.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});
