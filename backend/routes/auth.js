import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { pool } from "../db.js";
import dotenv from "dotenv";
dotenv.config();

const router = express.Router();

// REGISTER
router.post("/register", async (req, res) => {
  try {
    console.log("REQ BODY:", req.body);
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ message: "Semua field wajib diisi" });

    const [rows] = await pool.query("SELECT id FROM users WHERE email = ?", [email]);
    if (rows.length) return res.status(400).json({ message: "Email sudah terdaftar" });

    const hashed = bcrypt.hashSync(password, 8);

    // 🔹 Default role = "user"
    await pool.query("INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)", [
      name,
      email,
      hashed,
      "user",
    ]);

    res.json({ message: "Registrasi berhasil" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// LOGIN
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const [rows] = await pool.query("SELECT * FROM users WHERE email = ?", [email]);
    if (!rows.length) return res.status(404).json({ message: "User tidak ditemukan" });

    const user = rows[0];
    const isValid = bcrypt.compareSync(password, user.password);
    if (!isValid) return res.status(401).json({ message: "Password salah" });

    // 🔹 Tambahkan role ke token
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({
      message: "Login berhasil",
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
