// services/addressSearch.js
// Recherche d'adresse « en tapant » (France) : API publique de la Base Adresse Nationale
// (Géoplateforme de l'IGN, gratuite, sans clé). Le texte tapé part vers ce service d'État.
// Hors de France ou adresse inconnue : l'utilisateur garde la saisie manuelle (voir AddressInput).

const URL_BASE = "https://data.geopf.fr/geocodage/search";
export const MIN_CHARS = 3;     // l'API refuse moins de 3 caractères
const TIMEOUT_MS = 6000;

// Renvoie jusqu'à 5 suggestions : [{ id, label }] (ex. « 12 Rue de Lille 59100 Roubaix »).
// Lève une erreur si le service est injoignable (l'appelant propose alors la saisie manuelle).
export async function searchAddress(query, signal) {
  const q = query.trim();
  if (q.length < MIN_CHARS) return [];

  // Coupe-circuit : si le réseau traîne, on abandonne au bout de 6 s.
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), TIMEOUT_MS);
  signal?.addEventListener?.("abort", () => timeout.abort());
  try {
    const res = await fetch(`${URL_BASE}?q=${encodeURIComponent(q)}&limit=5&autocomplete=1`, { signal: timeout.signal });
    if (!res.ok) throw new Error(`Recherche d'adresse : erreur ${res.status}`);
    const json = await res.json();
    const seen = new Set();
    return (json.features ?? [])
      .map((f) => ({ id: f.properties?.id ?? f.properties?.label, label: f.properties?.label }))
      .filter((s) => s.label && !seen.has(s.label) && seen.add(s.label));
  } finally {
    clearTimeout(timer);
  }
}
