import { Router } from "express";
import { z } from "zod";
import { requireAuth, AuthedRequest } from "../middleware/requireAuth";
import { updateUserById, findUserById } from "../db/users";

const router = Router();

/**
 * On accepte uniquement ces champs (tout est optionnel)
 * - birth_date: "YYYY-MM-DD"
 * - gender: petit enum simple (tu pourras élargir après)
 */
const UpdateMeSchema = z.object({
  display_name: z.string().min(2).max(60).optional(),
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/).optional(),
  bio: z.string().max(500).optional(),
  website: z.string().url().max(200).optional().or(z.literal("")),
  location: z.string().max(80).optional(),
  gender: z.enum(["male", "female", "other", "prefer_not_to_say"]).optional(),
  birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  avatar_url: z
    .union([z.string().url().max(300), z.string().regex(/^\/uploads\/[A-Za-z0-9._-]+$/), z.literal("")])
    .optional(),
  cover_url: z
    .union([z.string().url().max(300), z.string().regex(/^\/uploads\/[A-Za-z0-9._-]+$/), z.literal("")])
    .optional(),
});

router.patch("/me", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = UpdateMeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ erreur: "Données invalides", details: parsed.error.flatten() });
  }

  const userId = req.user!.id;

  // on normalise quelques champs
  const data = { ...parsed.data } as any;
  if (typeof data.website === "string" && data.website.trim() === "") data.website = null;
  if (typeof data.avatar_url === "string" && data.avatar_url.trim() === "") data.avatar_url = null;
  if (typeof data.cover_url === "string" && data.cover_url.trim() === "") data.cover_url = null;

  const updated = await updateUserById(userId, data);
  const fresh = await findUserById(updated.id);

  res.json({ user: fresh });
});

export default router;
