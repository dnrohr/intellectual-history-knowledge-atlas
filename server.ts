import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { normalizeAuthorityIdentifiers } from "./src/authorityIdentifiers";
import { inferWikidataEntityType } from "./src/wikidataMapping";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const allowedOrigins = new Set(
  [process.env.APP_URL, ...(process.env.CORS_ALLOWED_ORIGINS || "").split(",")]
    .map((origin) => origin?.trim().replace(/\/+$/, ""))
    .filter((origin): origin is string => Boolean(origin))
);

app.use(express.json());
app.use("/api", (req, res, next) => {
  const origin = req.get("Origin")?.replace(/\/+$/, "");
  if (origin && allowedOrigins.has(origin)) {
    res.set("Access-Control-Allow-Origin", origin);
    res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type");
    res.set("Vary", "Origin");
  }
  if (req.method === "OPTIONS") {
    res.sendStatus(origin && allowedOrigins.has(origin) ? 204 : 403);
    return;
  }
  next();
});

// Main health route
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

const getEnglishValue = (claim: any) => claim?.mainsnak?.datavalue?.value;
const parseWikidataYear = (timeValue?: string) => {
  if (!timeValue) return null;
  const match = timeValue.match(/[+-](\d{4,})/);
  if (!match) return null;
  const year = Number(match[1]);
  return timeValue.startsWith("-") ? -year : year;
};

const claimIds = (claims: Record<string, any[]>, property: string, limit = 8) =>
  (claims[property] || [])
    .slice(0, limit)
    .map((claim: any) => getEnglishValue(claim)?.id)
    .filter(Boolean);

const claimStringValues = (claims: Record<string, any[]>, property: string, limit = 8) =>
  (claims[property] || [])
    .slice(0, limit)
    .map((claim: any) => getEnglishValue(claim))
    .filter((value: any) => typeof value === "string" && value.trim().length > 0);

const getEntityLabels = async (ids: string[]) => {
  const uniqueIds = Array.from(new Set(ids)).filter(Boolean);
  if (uniqueIds.length === 0) return new Map<string, string>();

  const labelUrl = new URL("https://www.wikidata.org/w/api.php");
  labelUrl.searchParams.set("action", "wbgetentities");
  labelUrl.searchParams.set("ids", uniqueIds.slice(0, 50).join("|"));
  labelUrl.searchParams.set("languages", "en");
  labelUrl.searchParams.set("props", "labels");
  labelUrl.searchParams.set("format", "json");
  labelUrl.searchParams.set("origin", "*");

  const response = await fetch(labelUrl, {
    headers: { "User-Agent": "IntellectualHistoryAtlas/0.1 (local research app)" },
  });
  const json = await response.json();
  return new Map(
    uniqueIds.map((id) => [id, json.entities?.[id]?.labels?.en?.value || id])
  );
};

const inferField = (text: string) => {
  const value = text.toLowerCase();
  if (value.includes("mathematician") || value.includes("mathematics")) return "Mathematics";
  if (value.includes("logician")) return "Logic";
  if (value.includes("computer") || value.includes("programmer") || value.includes("software")) return "Computing";
  if (value.includes("physicist") || value.includes("physics")) return "Physics";
  if (value.includes("astronomer") || value.includes("astronomy")) return "Astronomy";
  if (value.includes("cosmologist") || value.includes("cosmology")) return "Cosmology";
  if (value.includes("chemist") || value.includes("chemistry")) return "Chemistry";
  if (value.includes("biologist") || value.includes("naturalist") || value.includes("biology")) return "Biology";
  if (value.includes("engineer") || value.includes("inventor")) return "Engineering";
  if (value.includes("economist")) return "Economics";
  if (value.includes("historian")) return "History";
  if (value.includes("psychologist")) return "Psychology";
  if (value.includes("linguist")) return "Linguistics";
  if (value.includes("writer") || value.includes("poet") || value.includes("novelist")) return "Literature";
  if (value.includes("composer") || value.includes("music")) return "Music";
  if (value.includes("political") || value.includes("sociologist")) return "Political Thought";
  return "Philosophy";
};

const inferEra = (birth: number | null) => {
  if (birth === null) return null;
  if (birth < 500) return "Ancient";
  if (birth < 1400) return "Medieval";
  if (birth < 1600) return "Renaissance";
  if (birth < 1800) return "Enlightenment";
  if (birth < 1900) return "19th Century";
  if (birth < 1945) return "Modernism";
  if (birth < 1980) return "Postwar";
  return "Contemporary";
};

app.get("/api/import/wikidata/search", async (req, res) => {
  const query = String(req.query.q || "").trim();
  if (!query) {
    res.status(400).json({ error: "Missing query" });
    return;
  }

  try {
    const searchUrl = new URL("https://www.wikidata.org/w/api.php");
    searchUrl.searchParams.set("action", "wbsearchentities");
    searchUrl.searchParams.set("search", query);
    searchUrl.searchParams.set("language", "en");
    searchUrl.searchParams.set("format", "json");
    searchUrl.searchParams.set("limit", "6");
    searchUrl.searchParams.set("origin", "*");

    const searchResponse = await fetch(searchUrl, {
      headers: { "User-Agent": "IntellectualHistoryAtlas/0.1 (local research app)" },
    });
    const searchJson = await searchResponse.json();
    const ids = (searchJson.search || []).map((item: any) => item.id).filter(Boolean);

    if (ids.length === 0) {
      res.json({ candidates: [] });
      return;
    }

    const entityUrl = new URL("https://www.wikidata.org/w/api.php");
    entityUrl.searchParams.set("action", "wbgetentities");
    entityUrl.searchParams.set("ids", ids.join("|"));
    entityUrl.searchParams.set("languages", "en");
    entityUrl.searchParams.set("props", "labels|descriptions|claims|sitelinks");
    entityUrl.searchParams.set("format", "json");
    entityUrl.searchParams.set("origin", "*");

    const entityResponse = await fetch(entityUrl, {
      headers: { "User-Agent": "IntellectualHistoryAtlas/0.1 (local research app)" },
    });
    const entityJson = await entityResponse.json();

    const labelIds: string[] = [];
    ids.forEach((id: string) => {
      const claims = entityJson.entities?.[id]?.claims || {};
      labelIds.push(
        ...claimIds(claims, "P106"),
        ...claimIds(claims, "P31", 4),
        ...claimIds(claims, "P101"),
        ...claimIds(claims, "P27", 3),
        ...claimIds(claims, "P135", 4),
        ...claimIds(claims, "P800", 6),
        ...claimIds(claims, "P166", 6),
        ...claimIds(claims, "P184", 6),
        ...claimIds(claims, "P185", 6),
        ...claimIds(claims, "P802", 6),
        ...claimIds(claims, "P737", 8),
        ...claimIds(claims, "P108", 6),
        ...claimIds(claims, "P69", 6),
        ...claimIds(claims, "P463", 6)
      );
    });
    const labels = await getEntityLabels(labelIds);

    const candidates = ids.map((id: string) => {
      const entity = entityJson.entities?.[id];
      const claims = entity?.claims || {};
      const birth = parseWikidataYear(getEnglishValue(claims.P569?.[0])?.time);
      const death = parseWikidataYear(getEnglishValue(claims.P570?.[0])?.time);
      const instanceOf = claimIds(claims, "P31", 4).map((claimId) => labels.get(claimId) || claimId);
      const occupations = claimIds(claims, "P106").map((claimId) => labels.get(claimId) || claimId);
      const fieldsOfWork = claimIds(claims, "P101").map((claimId) => labels.get(claimId) || claimId);
      const countries = claimIds(claims, "P27", 3).map((claimId) => labels.get(claimId) || claimId);
      const movements = claimIds(claims, "P135", 4).map((claimId) => labels.get(claimId) || claimId);
      const notableWorks = claimIds(claims, "P800", 6).map((claimId) => labels.get(claimId) || claimId);
      const awards = claimIds(claims, "P166", 6).map((claimId) => labels.get(claimId) || claimId);
      const advisors = claimIds(claims, "P184", 6).map((claimId) => labels.get(claimId) || claimId);
      const doctoralStudents = claimIds(claims, "P185", 6).map((claimId) => labels.get(claimId) || claimId);
      const students = claimIds(claims, "P802", 6).map((claimId) => labels.get(claimId) || claimId);
      const influencedBy = claimIds(claims, "P737", 8).map((claimId) => labels.get(claimId) || claimId);
      const employers = claimIds(claims, "P108", 6).map((claimId) => labels.get(claimId) || claimId);
      const educatedAt = claimIds(claims, "P69", 6).map((claimId) => labels.get(claimId) || claimId);
      const memberOf = claimIds(claims, "P463", 6).map((claimId) => labels.get(claimId) || claimId);
      const authorityIds = normalizeAuthorityIdentifiers({
        viaf: claimStringValues(claims, "P214", 4),
        loc: claimStringValues(claims, "P244", 4),
      });
      const text = [
        entity?.descriptions?.en?.value || "",
        ...occupations,
        ...fieldsOfWork,
      ].join(" ");
      const inferredField = inferField(text);
      const entityType = inferWikidataEntityType({
        description: entity?.descriptions?.en?.value || "",
        instanceOf,
        hasBirthDate: birth !== null,
      });
      return {
        id,
        entityType,
        name: entity?.labels?.en?.value || id,
        description: entity?.descriptions?.en?.value || "",
        birth,
        death,
        fields: [inferredField],
        topics: fieldsOfWork.length > 0 ? fieldsOfWork : occupations.slice(0, 4),
        region: countries.join("/") || null,
        era: inferEra(birth),
        movement: movements[0] || null,
        works: notableWorks,
        institutions: Array.from(new Set([...employers, ...educatedAt, ...memberOf])),
        movements,
        concepts: fieldsOfWork,
        awards,
        occupations,
        fieldsOfWork,
        advisors,
        students: [...doctoralStudents, ...students],
        influencedBy,
        employers,
        educatedAt,
        memberOf,
        authorityIds,
        wikidataClaims: {
          instanceOf,
          occupations,
          fieldsOfWork,
          notableWorks,
          movements,
          awards,
          employers,
          educatedAt,
          memberOf,
          advisors,
          students: [...doctoralStudents, ...students],
          influencedBy,
          viaf: authorityIds.viaf,
          loc: authorityIds.loc,
        },
        sourceUrl: `https://www.wikidata.org/wiki/${id}`,
        wikipediaUrl: entity?.sitelinks?.enwiki?.title
          ? `https://en.wikipedia.org/wiki/${encodeURIComponent(entity.sitelinks.enwiki.title.replaceAll(" ", "_"))}`
          : null,
      };
    });

    res.json({ candidates });
  } catch (error) {
    res.status(502).json({ error: "Wikidata lookup failed" });
  }
});

// Serve assets
async function setupVite() {
  if (process.env.NODE_ENV !== "production") {
    const viteInstance = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(viteInstance.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Knowledge Atlas backend running on http://localhost:${PORT}`);
  });
}

setupVite();
