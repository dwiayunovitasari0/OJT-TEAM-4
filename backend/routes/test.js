import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { pool } from "../db.js";
import jwt from "jsonwebtoken";

const router = express.Router();

// === Upload Setup ===
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = "uploads";
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

// === Middleware verifikasi JWT ===
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader)
    return res.status(401).json({ message: "Token tidak ditemukan" });

  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ message: "Token tidak valid" });
    req.user = decoded;
    next();
  });
};

// === [POST] Pengajuan Test ===
router.post("/submit", verifyToken, upload.single("dokumen"), async (req, res) => {
  try {
    const {
      service_type,
      company_name,
      details,
      alat_jenis,
      alat_merk,
      alat_tipe,
      alat_serial,
      alat_kapasitas,
      lokasi_pemeriksaan,
    } = req.body;

    const user_id = req.user.id;
    const filePath = req.file ? req.file.filename : null;

    const sql = `
      INSERT INTO test_submissions
      (user_id, service_type, company_name, details, dokumen_path, alat_jenis, alat_merk, alat_tipe, alat_serial, alat_kapasitas, lokasi_pemeriksaan, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `;
    await pool.query(sql, [
      user_id,
      service_type,
      company_name,
      details,
      filePath,
      alat_jenis,
      alat_merk,
      alat_tipe,
      alat_serial,
      alat_kapasitas,
      lokasi_pemeriksaan,
    ]);

    res.json({ message: "Pengajuan berhasil dikirim!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Gagal menyimpan pengajuan" });
  }
});

// === [GET] Pengajuan user sendiri ===
router.get("/my-submissions", verifyToken, async (req, res) => {
  try {
    const user_id = req.user.id;
    const sql = `SELECT * FROM test_submissions WHERE user_id = ? ORDER BY created_at DESC`;
    const [results] = await pool.query(sql, [user_id]);
    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Gagal mengambil data pengajuan" });
  }
});

// === [GET] Semua pengajuan (khusus ahli/admin) ===
router.get("/all", verifyToken, async (req, res) => {
  try {
    const [userRows] = await pool.query("SELECT role FROM users WHERE id = ?", [req.user.id]);
    if (!userRows.length || userRows[0].role !== "ahli") {
      return res.status(403).json({ message: "Akses ditolak. Hanya ahli yang dapat melihat data ini." });
    }

    const [results] = await pool.query(`
      SELECT t.*, u.name AS user_name 
      FROM test_submissions t 
      JOIN users u ON t.user_id = u.id 
      ORDER BY t.created_at DESC
    `);
    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Gagal mengambil data semua pengajuan" });
  }
});

// === [PATCH] Edit pengajuan ===
router.patch("/edit/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query("SELECT * FROM test_submissions WHERE id = ?", [id]);
    if (!rows.length) return res.status(404).json({ message: "Pengajuan tidak ditemukan" });

    const data = rows[0];

    // Cek hak akses: pemilik atau ahli
    if (req.user.id !== data.user_id) {
      const [userRows] = await pool.query("SELECT role FROM users WHERE id = ?", [req.user.id]);
      if (!userRows.length || userRows[0].role !== "ahli") {
        return res.status(403).json({ message: "Akses ditolak" });
      }
    }

    await pool.query(
      `UPDATE test_submissions SET 
        service_type = ?, 
        company_name = ?, 
        details = ?, 
        alat_jenis = ?, 
        alat_merk = ?, 
        alat_tipe = ?, 
        alat_serial = ?, 
        alat_kapasitas = ?, 
        lokasi_pemeriksaan = ?
      WHERE id = ?`,
      [
        req.body.service_type || data.service_type,
        req.body.company_name || data.company_name,
        req.body.details || data.details,
        req.body.alat_jenis || data.alat_jenis,
        req.body.alat_merk || data.alat_merk,
        req.body.alat_tipe || data.alat_tipe,
        req.body.alat_serial || data.alat_serial,
        req.body.alat_kapasitas || data.alat_kapasitas,
        req.body.lokasi_pemeriksaan || data.lokasi_pemeriksaan,
        id,
      ]
    );

    res.json({ message: "Pengajuan berhasil diupdate" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Gagal mengupdate pengajuan" });
  }
});

// === [PATCH] Update status (tanpa sertifikat) ===
router.patch("/update-status/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // Status baru tanpa sertifikat
    const allowedStatus = ["approved_admin", "rejected", "menunggu_jadwal", "terjadwal", "selesai_layak", "selesai_tidak_layak"];
    if (!allowedStatus.includes(status)) {
      return res.status(400).json({ message: "Status tidak valid" });
    }

    // cek role
    const [users] = await pool.query("SELECT role FROM users WHERE id = ?", [req.user.id]);
    if (!users.length || users[0].role !== "ahli") {
      return res.status(403).json({ message: "Hanya ahli yang dapat melakukan ini" });
    }

    await pool.query("UPDATE test_submissions SET status = ? WHERE id = ?", [status, id]);

    res.json({ message: `Status berhasil diubah menjadi ${status}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Gagal mengubah status" });
  }
});

// === [DELETE] Hapus pengajuan ===
router.delete("/delete/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await pool.query("SELECT * FROM test_submissions WHERE id = ?", [id]);
    if (!rows.length) return res.status(404).json({ message: "Pengajuan tidak ditemukan" });

    const data = rows[0];

    if (req.user.id !== data.user_id) {
      const [userRows] = await pool.query("SELECT role FROM users WHERE id = ?", [req.user.id]);
      if (!userRows.length || userRows[0].role !== "ahli") {
        return res.status(403).json({ message: "Akses ditolak" });
      }
    }

    await pool.query("DELETE FROM test_submissions WHERE id = ?", [id]);
    res.json({ message: "Pengajuan berhasil dihapus" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Gagal menghapus pengajuan" });
  }
});

export default router;
