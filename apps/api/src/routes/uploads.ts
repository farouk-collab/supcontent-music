import { Router } from "express";
import multer from "multer";
import { requireAuth, AuthedRequest } from "../middleware/requireAuth";
import { isSupportedImageMime, storeUploadedImage } from "../services/mediaStorage";

const router = Router();

function imageFileFilter(_req: any, file: any, cb: any) {
  const ok = isSupportedImageMime(file.mimetype, false);
  cb(ok ? null : new Error("Format image non supporte (jpg/png/webp)"), ok);
}

function socialFileFilter(_req: any, file: any, cb: any) {
  const ok = isSupportedImageMime(file.mimetype, true);
  cb(ok ? null : new Error("Format non supporte (jpg/png/webp/gif)"), ok);
}

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: imageFileFilter,
  limits: { fileSize: 3 * 1024 * 1024 },
});

const uploadSocial = multer({
  storage: multer.memoryStorage(),
  fileFilter: socialFileFilter,
  limits: { fileSize: 6 * 1024 * 1024 },
});

router.post("/avatar", requireAuth, upload.single("file"), async (req: AuthedRequest, res) => {
  const f = (req as any).file as Express.Multer.File | undefined;
  if (!f) return res.status(400).json({ erreur: "Fichier manquant" });
  const stored = await storeUploadedImage({
    buffer: f.buffer,
    mime: f.mimetype,
    purpose: "avatar",
    userId: req.user!.id,
  });
  res.json({ url: stored.url });
});

router.post("/cover", requireAuth, upload.single("file"), async (req: AuthedRequest, res) => {
  const f = (req as any).file as Express.Multer.File | undefined;
  if (!f) return res.status(400).json({ erreur: "Fichier manquant" });
  const stored = await storeUploadedImage({
    buffer: f.buffer,
    mime: f.mimetype,
    purpose: "cover",
    userId: req.user!.id,
  });
  res.json({ url: stored.url });
});

router.post("/social", requireAuth, uploadSocial.single("file"), async (req: AuthedRequest, res) => {
  const f = (req as any).file as Express.Multer.File | undefined;
  if (!f) return res.status(400).json({ erreur: "Fichier manquant" });
  const stored = await storeUploadedImage({
    buffer: f.buffer,
    mime: f.mimetype,
    purpose: "social",
    userId: req.user!.id,
  });
  res.json({ url: stored.url });
});

export default router;
