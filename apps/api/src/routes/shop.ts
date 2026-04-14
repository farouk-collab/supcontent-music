import { Router } from "express";
import { pool } from "../connections";
import { requireAuth, type AuthedRequest } from "../middleware/requireAuth";
import { makeShopCartItemId, makeShopEntityId } from "../db/shop";

const router = Router();

function isUuid(value: string) {
  return /^[0-9a-fA-F-]{36}$/.test(value);
}

function mapProduct(row: any) {
  return {
    id: String(row.id || ""),
    type: String(row.type || ""),
    title: String(row.title || ""),
    creator: String(row.creator_name || ""),
    creator_username: String(row.creator_username || ""),
    creator_user_id: row.creator_user_id ? String(row.creator_user_id) : null,
    verified: Boolean(row.verified),
    price: Number(row.price || 0),
    license: String(row.license || ""),
    bpm: Number(row.bpm || 0),
    genre: String(row.genre || ""),
    rating: Number(row.rating || 0),
    sales: Number(row.sales_count || 0),
    description: String(row.description || ""),
    tag: String(row.tag || ""),
    previewLabel: String(row.preview_label || ""),
    created_at: row.created_at,
  };
}

async function readProducts() {
  const result = await pool.query(
    `
      SELECT *
      FROM shop_products
      WHERE is_active = TRUE
      ORDER BY created_at DESC, sales_count DESC, title ASC
    `
  );
  return result.rows.map(mapProduct);
}

async function readFavoriteIds(userId: string) {
  const result = await pool.query(
    `
      SELECT product_id
      FROM shop_favorites
      WHERE user_id = $1
      ORDER BY created_at DESC
    `,
    [userId]
  );
  return result.rows.map((row) => String(row.product_id || ""));
}

async function readCart(userId: string) {
  const result = await pool.query(
    `
      SELECT
        sci.id AS cart_item_id,
        sci.created_at AS cart_created_at,
        sp.*
      FROM shop_cart_items sci
      JOIN shop_products sp ON sp.id = sci.product_id
      WHERE sci.user_id = $1
      ORDER BY sci.created_at DESC
    `,
    [userId]
  );

  return result.rows.map((row) => ({
    cart_item_id: String(row.cart_item_id || ""),
    created_at: row.cart_created_at,
    product: mapProduct(row),
  }));
}

router.get("/products", async (_req, res) => {
  const products = await readProducts();
  return res.json({
    generated_at: new Date().toISOString(),
    products,
  });
});

router.get("/favorites", requireAuth, async (req: AuthedRequest, res) => {
  const userId = String(req.user?.id || "");
  const favorites = await readFavoriteIds(userId);
  return res.json({ product_ids: favorites });
});

router.get("/spotlight", async (_req, res) => {
  const result = await pool.query(
    `
      SELECT
        creator_name,
        creator_username,
        creator_user_id,
        MAX(verified) AS verified,
        COUNT(*)::int AS product_count,
        COALESCE(SUM(sales_count), 0)::int AS total_sales,
        MAX(genre) AS featured_genre
      FROM shop_products
      WHERE is_active = TRUE
      GROUP BY creator_name, creator_username, creator_user_id
      ORDER BY total_sales DESC, product_count DESC, creator_name ASC
      LIMIT 6
    `
  );

  const creators = result.rows.map((row: any, index: number) => ({
    id: String(row.creator_user_id || row.creator_username || `creator-${index}`),
    creator_user_id: row.creator_user_id ? String(row.creator_user_id) : null,
    name: String(row.creator_name || ""),
    username: String(row.creator_username || ""),
    speciality: `${String(row.featured_genre || "Music")} - ${Number(row.product_count || 0)} produit(s)`,
    followers: `${Number(row.total_sales || 0)} ventes`,
    verified: Boolean(row.verified),
  }));

  return res.json({
    generated_at: new Date().toISOString(),
    creators,
  });
});

router.get("/cart", requireAuth, async (req: AuthedRequest, res) => {
  const userId = String(req.user?.id || "");
  const items = await readCart(userId);
  const total = items.reduce((sum, item) => sum + Number(item.product.price || 0), 0);
  return res.json({
    items,
    total,
  });
});

router.post("/products", requireAuth, async (req: AuthedRequest, res) => {
  const userId = String(req.user?.id || "");
  const title = String(req.body?.title || "").trim();
  const type = String(req.body?.type || "").trim() || "Beat";
  const genre = String(req.body?.genre || "").trim();
  const description = String(req.body?.description || "").trim();
  const license = String(req.body?.license || "").trim() || "Licence standard";
  const price = Number(req.body?.price);
  const bpm = Number(req.body?.bpm);

  if (!title || !genre || !description || !price || !bpm) {
    return res.status(400).json({ erreur: "champs_produit_invalides" });
  }

  const userRes = await pool.query(
    `SELECT display_name, username FROM users WHERE id = $1 LIMIT 1`,
    [userId]
  );
  const user = userRes.rows[0];
  const creatorName = String(user?.display_name || user?.username || "Createur");
  const creatorUsername = String(user?.username || creatorName).trim();

  const productId = makeShopCartItemId();
  const insertRes = await pool.query(
    `
      INSERT INTO shop_products (
        id, creator_user_id, type, title, creator_name, creator_username, verified,
        price, license, bpm, genre, rating, sales_count, description, tag, preview_label, is_active
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, FALSE,
        $7, $8, $9, $10, 5, 0, $11, 'Nouveau createur', $12, TRUE
      )
      RETURNING *
    `,
    [productId, userId, type, title, creatorName, creatorUsername, price, license, bpm, genre, description, `Extrait ${title}`]
  );

  return res.status(201).json({
    product: mapProduct(insertRes.rows[0]),
  });
});

router.post("/favorites/:productId", requireAuth, async (req: AuthedRequest, res) => {
  const userId = String(req.user?.id || "");
  const productId = String(req.params.productId || "");
  if (!isUuid(productId)) return res.status(400).json({ erreur: "product_id_invalide" });

  await pool.query(
    `
      INSERT INTO shop_favorites (user_id, product_id, created_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (user_id, product_id) DO NOTHING
    `,
    [userId, productId]
  );

  return res.status(201).json({ ok: true, product_id: productId });
});

router.delete("/favorites/:productId", requireAuth, async (req: AuthedRequest, res) => {
  const userId = String(req.user?.id || "");
  const productId = String(req.params.productId || "");
  if (!isUuid(productId)) return res.status(400).json({ erreur: "product_id_invalide" });

  await pool.query(
    `DELETE FROM shop_favorites WHERE user_id = $1 AND product_id = $2`,
    [userId, productId]
  );

  return res.json({ ok: true, product_id: productId });
});

router.post("/cart/items", requireAuth, async (req: AuthedRequest, res) => {
  const userId = String(req.user?.id || "");
  const productId = String(req.body?.productId || "");
  if (!isUuid(productId)) return res.status(400).json({ erreur: "product_id_invalide" });

  const productRes = await pool.query(
    `SELECT * FROM shop_products WHERE id = $1 AND is_active = TRUE LIMIT 1`,
    [productId]
  );
  const product = productRes.rows[0];
  if (!product) return res.status(404).json({ erreur: "produit_introuvable" });

  const cartItemId = makeShopCartItemId();
  await pool.query(
    `
      INSERT INTO shop_cart_items (id, user_id, product_id, created_at)
      VALUES ($1, $2, $3, NOW())
    `,
    [cartItemId, userId, productId]
  );

  const items = await readCart(userId);
  const total = items.reduce((sum, item) => sum + Number(item.product.price || 0), 0);
  return res.status(201).json({
    cart_item_id: cartItemId,
    product: mapProduct(product),
    items,
    total,
  });
});

router.delete("/cart/items/:cartItemId", requireAuth, async (req: AuthedRequest, res) => {
  const userId = String(req.user?.id || "");
  const cartItemId = String(req.params.cartItemId || "");
  if (!isUuid(cartItemId)) return res.status(400).json({ erreur: "cart_item_id_invalide" });

  const deleteRes = await pool.query(
    `
      DELETE FROM shop_cart_items
      WHERE id = $1 AND user_id = $2
      RETURNING id
    `,
    [cartItemId, userId]
  );
  if (!deleteRes.rows[0]) return res.status(404).json({ erreur: "article_panier_introuvable" });

  const items = await readCart(userId);
  const total = items.reduce((sum, item) => sum + Number(item.product.price || 0), 0);
  return res.json({
    ok: true,
    items,
    total,
  });
});

router.post("/checkout", requireAuth, async (req: AuthedRequest, res) => {
  const userId = String(req.user?.id || "");
  const cartRows = await pool.query(
    `
      SELECT sci.id AS cart_item_id, sp.id AS product_id, sp.price
      FROM shop_cart_items sci
      JOIN shop_products sp ON sp.id = sci.product_id
      WHERE sci.user_id = $1
      ORDER BY sci.created_at ASC
    `,
    [userId]
  );

  if (!cartRows.rows.length) {
    return res.status(400).json({ erreur: "panier_vide" });
  }

  const totalAmount = cartRows.rows.reduce((sum: number, row: any) => sum + Number(row.price || 0), 0);
  const orderId = makeShopEntityId();

  await pool.query("BEGIN");
  try {
    await pool.query(
      `
        INSERT INTO shop_orders (id, user_id, total_amount, item_count, status, created_at)
        VALUES ($1, $2, $3, $4, 'paid', NOW())
      `,
      [orderId, userId, totalAmount, cartRows.rows.length]
    );

    for (const row of cartRows.rows) {
      await pool.query(
        `
          INSERT INTO shop_order_items (id, order_id, product_id, unit_price, created_at)
          VALUES ($1, $2, $3, $4, NOW())
        `,
        [makeShopEntityId(), orderId, String(row.product_id || ""), Number(row.price || 0)]
      );
    }

    await pool.query(
      `
        UPDATE shop_products sp
        SET sales_count = sp.sales_count + src.sales_delta,
            updated_at = NOW()
        FROM (
          SELECT product_id, COUNT(*)::int AS sales_delta
          FROM shop_cart_items
          WHERE user_id = $1
          GROUP BY product_id
        ) src
        WHERE sp.id = src.product_id
      `,
      [userId]
    );

    await pool.query(`DELETE FROM shop_cart_items WHERE user_id = $1`, [userId]);
    await pool.query("COMMIT");
  } catch (error) {
    await pool.query("ROLLBACK");
    throw error;
  }

  return res.status(201).json({
    ok: true,
    order: {
      id: orderId,
      total_amount: totalAmount,
      item_count: cartRows.rows.length,
      status: "paid",
    },
  });
});

export default router;
