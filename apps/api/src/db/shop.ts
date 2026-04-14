import { randomUUID } from "crypto";
import { pool } from "../connections";

const SEEDED_PRODUCTS = [
  {
    id: "aaaaaaa1-1111-4111-8111-111111111111",
    type: "Beat",
    title: "Afro Sunset Beat",
    creatorName: "Ayo.wav",
    creatorUsername: "ayo.wav",
    verified: true,
    price: 35,
    license: "Licence standard",
    bpm: 102,
    genre: "Afro",
    rating: 4.9,
    sales: 128,
    description: "Beat afro chaleureux pour topline, freestyle ou single melodique.",
    tag: "Best seller",
  },
  {
    id: "aaaaaaa2-2222-4222-8222-222222222222",
    type: "Sample Pack",
    title: "Midnight Perc Pack",
    creatorName: "Nina Beats",
    creatorUsername: "nina.beats",
    verified: true,
    price: 22,
    license: "Royalty-free",
    bpm: 120,
    genre: "Percussions",
    rating: 4.8,
    sales: 94,
    description: "Pack de percussions, textures et loops pour prods afro et pop.",
    tag: "Nouveau",
  },
  {
    id: "aaaaaaa3-3333-4333-8333-333333333333",
    type: "Loop Kit",
    title: "Soul Keys Loops",
    creatorName: "Tems Daily",
    creatorUsername: "temsdaily",
    verified: false,
    price: 18,
    license: "Royalty-free",
    bpm: 96,
    genre: "Soul",
    rating: 4.6,
    sales: 61,
    description: "Loops de claviers et nappes soul prets a sampler ou arranger.",
    tag: "Createur suivi",
  },
  {
    id: "aaaaaaa4-4444-4444-8444-444444444444",
    type: "Beat",
    title: "Club Runner",
    creatorName: "DJ Nova",
    creatorUsername: "djnova",
    verified: false,
    price: 40,
    license: "Exclusive possible",
    bpm: 128,
    genre: "House",
    rating: 4.7,
    sales: 73,
    description: "Beat club energique pour performance live, reel ou teaser artiste.",
    tag: "Live ready",
  },
  {
    id: "aaaaaaa5-5555-4555-8555-555555555555",
    type: "Vocal Pack",
    title: "Ambient Vox Cuts",
    creatorName: "Luna Mix",
    creatorUsername: "luna.mix",
    verified: true,
    price: 27,
    license: "Royalty-free",
    bpm: 110,
    genre: "Ambient",
    rating: 4.5,
    sales: 45,
    description: "Textures vocales decoupees pour intros, drops et refrains aeriens.",
    tag: "Creatif",
  },
  {
    id: "aaaaaaa6-6666-4666-8666-666666666666",
    type: "Sample Pack",
    title: "Rap Drill Essentials",
    creatorName: "Daxwritz",
    creatorUsername: "daxwritz",
    verified: false,
    price: 25,
    license: "Royalty-free",
    bpm: 142,
    genre: "Rap",
    rating: 4.4,
    sales: 39,
    description: "808, hats, snares et textures pretes pour prods drill et trap.",
    tag: "Rap pack",
  },
];

export async function ensureShopTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS shop_products (
      id UUID PRIMARY KEY,
      creator_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      creator_name TEXT NOT NULL,
      creator_username TEXT NOT NULL,
      verified BOOLEAN NOT NULL DEFAULT FALSE,
      price NUMERIC(10,2) NOT NULL CHECK (price > 0),
      license TEXT NOT NULL DEFAULT '',
      bpm INT NOT NULL DEFAULT 0,
      genre TEXT NOT NULL DEFAULT '',
      rating NUMERIC(3,2) NOT NULL DEFAULT 5,
      sales_count INT NOT NULL DEFAULT 0,
      description TEXT NOT NULL DEFAULT '',
      tag TEXT NOT NULL DEFAULT '',
      preview_label TEXT NOT NULL DEFAULT '',
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS shop_cart_items (
      id UUID PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      product_id UUID NOT NULL REFERENCES shop_products(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS shop_favorites (
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      product_id UUID NOT NULL REFERENCES shop_products(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, product_id)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS shop_orders (
      id UUID PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      total_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
      item_count INT NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'paid',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS shop_order_items (
      id UUID PRIMARY KEY,
      order_id UUID NOT NULL REFERENCES shop_orders(id) ON DELETE CASCADE,
      product_id UUID NOT NULL REFERENCES shop_products(id) ON DELETE CASCADE,
      unit_price NUMERIC(10,2) NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_shop_products_active ON shop_products(is_active, created_at DESC)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_shop_cart_items_user ON shop_cart_items(user_id, created_at DESC)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_shop_favorites_user ON shop_favorites(user_id, created_at DESC)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_shop_orders_user ON shop_orders(user_id, created_at DESC)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_shop_order_items_order ON shop_order_items(order_id, created_at DESC)`);

  const usernames = Array.from(new Set(SEEDED_PRODUCTS.map((product) => product.creatorUsername.toLowerCase())));
  const usersRes = await pool.query(
    `SELECT id, username FROM users WHERE LOWER(username) = ANY($1::text[])`,
    [usernames]
  );
  const userLookup = new Map<string, string>();
  usersRes.rows.forEach((row) => {
    userLookup.set(String(row.username || "").toLowerCase(), String(row.id || ""));
  });

  for (const product of SEEDED_PRODUCTS) {
    const creatorUserId = userLookup.get(product.creatorUsername.toLowerCase()) || null;
    await pool.query(
      `
        INSERT INTO shop_products (
          id, creator_user_id, type, title, creator_name, creator_username, verified,
          price, license, bpm, genre, rating, sales_count, description, tag, preview_label, is_active, updated_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11, $12, $13, $14, $15, $16, TRUE, NOW()
        )
        ON CONFLICT (id)
        DO UPDATE SET
          creator_user_id = COALESCE(EXCLUDED.creator_user_id, shop_products.creator_user_id),
          type = EXCLUDED.type,
          title = EXCLUDED.title,
          creator_name = EXCLUDED.creator_name,
          creator_username = EXCLUDED.creator_username,
          verified = EXCLUDED.verified,
          price = EXCLUDED.price,
          license = EXCLUDED.license,
          bpm = EXCLUDED.bpm,
          genre = EXCLUDED.genre,
          rating = EXCLUDED.rating,
          sales_count = EXCLUDED.sales_count,
          description = EXCLUDED.description,
          tag = EXCLUDED.tag,
          preview_label = EXCLUDED.preview_label,
          is_active = TRUE,
          updated_at = NOW()
      `,
      [
        product.id,
        creatorUserId,
        product.type,
        product.title,
        product.creatorName,
        product.creatorUsername,
        product.verified,
        product.price,
        product.license,
        product.bpm,
        product.genre,
        product.rating,
        product.sales,
        product.description,
        product.tag,
        `Extrait ${product.title}`,
      ]
    );
  }
}

export function makeShopCartItemId() {
  return randomUUID();
}

export function makeShopEntityId() {
  return randomUUID();
}
