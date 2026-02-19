import { Router } from "express";
import multer from "multer";
import path from "path";
import crypto from "crypto";
import { requireAuth, AuthedRequest } from "../middleware/requireAuth";

const router = Router();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, path.join(__dirname, "../../uploads")),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const name = crypto.randomBytes(12).toString("hex");
    cb(null, `${name}${ext}`);
  },
});

function fileFilter(_req: any, file: any, cb: any) {
  const ok = ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype);
  cb(ok ? null : new Error("Format image non supporté (jpg/png/webp)"), ok);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 3 * 1024 * 1024 }, // 3MB
});

router.post("/avatar", requireAuth, upload.single("file"), async (req: AuthedRequest, res) => {
  const f = (req as any).file;
  if (!f) return res.status(400).json({ erreur: "Fichier manquant" });
  res.json({ url: `/uploads/${f.filename}` });
});

router.post("/cover", requireAuth, upload.single("file"), async (req: AuthedRequest, res) => {
  const f = (req as any).file;
  if (!f) return res.status(400).json({ erreur: "Fichier manquant" });
  res.json({ url: `/uploads/${f.filename}` });
});

export default router;
