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

function imageFileFilter(_req: any, file: any, cb: any) {
  const ok = ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype);
  cb(ok ? null : new Error("Format image non supporte (jpg/png/webp)"), ok);
}

function socialFileFilter(_req: any, file: any, cb: any) {
  const ok = ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.mimetype);
  cb(ok ? null : new Error("Format non supporte (jpg/png/webp/gif)"), ok);
}

const upload = multer({
  storage,
  fileFilter: imageFileFilter,
  limits: { fileSize: 3 * 1024 * 1024 },
});

const uploadSocial = multer({
  storage,
  fileFilter: socialFileFilter,
  limits: { fileSize: 6 * 1024 * 1024 },
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

router.post("/social", requireAuth, uploadSocial.single("file"), async (req: AuthedRequest, res) => {
  const f = (req as any).file;
  if (!f) return res.status(400).json({ erreur: "Fichier manquant" });
  res.json({ url: `/uploads/${f.filename}` });
});

export default router;
