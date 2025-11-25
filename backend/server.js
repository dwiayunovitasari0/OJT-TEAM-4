import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import http from "http";
import { Server } from "socket.io";
import authRoutes from "./routes/auth.js";
import testRoutes from "./routes/test.js";

dotenv.config();
const app = express();

// === CORS ===
app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  })
);

// === Middleware JSON ===
app.use(express.json());

// === Serving file upload ===
app.use("/uploads", express.static("uploads"));

// === Routes utama ===
app.use("/api/auth", authRoutes);
app.use("/api/test", testRoutes);

// === Root test endpoint ===
app.get("/", (req, res) => {
  res.send("Backend berjalan...");
});

// === Jalankan server dengan Socket.IO ===
const PORT = process.env.PORT || 5000;
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "http://localhost:3000" },
});

// Simpan user yang online
const onlineUsers = {}; // { userId: socketId }

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // User join setelah login
  socket.on("join", (userId) => {
    onlineUsers[userId] = socket.id;
    console.log("User joined:", userId);
  });

  socket.on("disconnect", () => {
    for (const [key, value] of Object.entries(onlineUsers)) {
      if (value === socket.id) delete onlineUsers[key];
    }
  });
});

// Middleware supaya route bisa akses io
app.use((req, res, next) => {
  req.io = io;
  req.onlineUsers = onlineUsers;
  next();
});

server.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});

