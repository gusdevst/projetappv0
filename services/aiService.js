// services/aiService.js
// Toutes les fonctions qui appellent Claude API
// Avantage : si on change d'IA (Gemini, GPT...), on ne modifie que ce fichier

const CLAUDE_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-20250514";

async function callClaude(prompt) {
  const res = await fetch(CLAUDE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 600,
      messages: [{ role: "user", content: [{ type: "text", text: prompt }] }],
    }),
  });
  const data = await res.json();
  return data.content?.[0]?.text || "";
}

// Conseil IA : Garder / Supprimer / Imprimer
export async function getPhotoAdvice(photo, similarCount) {
  const prompt = `Photo à ${photo.location} en ${photo.year}, personnes: ${
    photo.faces?.join(", ") || "aucune"
  }. ${
    similarCount > 0 ? `${similarCount} photo(s) similaires existent.` : ""
  }
  Réponds en JSON uniquement sans markdown:
  {"decision":"Garder","score":7,"raison":"1 phrase","similaires":"info doublons"}`;

  try {
    const text = await callClaude(prompt);
    return JSON.parse(text.replace(/```json|```/g, "").trim());
  } catch {
    return {
      decision: "Garder",
      score: 7,
      raison: "Belle photo souvenir.",
      similaires:
        similarCount > 0
          ? `${similarCount} photos similaires détectées.`
          : "Aucun doublon.",
    };
  }
}

// Amélioration photo : retourne une description des corrections
export async function enhancePhoto(photo) {
  // Simulation locale (future : appel Vision API réel)
  await new Promise((r) => setTimeout(r, 1500));
  return "Luminosité +8%, contraste +12%, saturation +15% — couleurs réchauffées";
}