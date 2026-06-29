// Proxy serverless (Vercel) pour API.Bible — version « app entière sur Vercel ».
// Servi sur la MÊME origine que l'app (/api/bible/...), donc pas de CORS à gérer côté
// navigateur et la clé n'est JAMAIS exposée au client.
//
// Variables d'environnement (Vercel → Settings → Environment Variables) :
//   API_BIBLE_KEY   (obligatoire)  ta clé API.Bible
//   ALLOWED_ORIGIN  (optionnel)    origine autorisée pour le CORS (défaut : même origine)

export default async function handler(req, res) {
  const origin = process.env.ALLOWED_ORIGIN;
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  }

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Méthode non autorisée" });

  const key = process.env.API_BIBLE_KEY;
  if (!key) return res.status(500).json({ error: "API_BIBLE_KEY non configurée sur le serveur" });

  const segments = Array.isArray(req.query.path) ? req.query.path : [req.query.path].filter(Boolean);
  const path = segments.join("/");
  const qs = req.url.includes("?") ? req.url.slice(req.url.indexOf("?") + 1) : "";
  const target = `https://api.scripture.api.bible/v1/${path}${qs ? "?" + qs : ""}`;

  try {
    const r = await fetch(target, { headers: { "api-key": key } });
    const body = await r.text();
    res.setHeader("Content-Type", r.headers.get("content-type") || "application/json");
    // Cache CDN court : limite la consommation de quota sans stocker côté client.
    res.setHeader("Cache-Control", "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400");
    return res.status(r.status).send(body);
  } catch (e) {
    return res.status(502).json({ error: "Erreur amont API.Bible", detail: String(e) });
  }
}
