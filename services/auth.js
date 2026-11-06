// services/auth.js
// Actions de compte (Supabase). Pas d'UI ici : les écrans appellent ces fonctions.
// Chaque fonction renvoie { ok: true, ... } ou { ok: false, message } avec un message en français.
import { supabase } from "./supabase";
import { forgetSyncedUser } from "./progressSync";

// Traduit les erreurs Supabase en phrases claires.
function frenchError(error) {
  const msg = (error?.message || "").toLowerCase();
  if (msg.includes("invalid login credentials")) return "E-mail ou mot de passe incorrect.";
  if (msg.includes("email not confirmed")) return "Confirme d'abord ton e-mail (regarde ta boîte mail).";
  if (msg.includes("already registered") || msg.includes("already been registered"))
    return "Un compte existe déjà avec cet e-mail. Connecte-toi plutôt.";
  if (msg.includes("password") && msg.includes("characters")) return "Le mot de passe doit faire 8 caractères minimum.";
  if (msg.includes("valid email") || msg.includes("invalid email")) return "Cet e-mail n'a pas l'air valide.";
  if (msg.includes("rate limit") || msg.includes("too many")) return "Trop d'essais. Réessaie dans quelques minutes.";
  if (msg.includes("network") || msg.includes("fetch")) return "Pas de connexion internet. Réessaie.";
  return "Oups, quelque chose s'est mal passé. Réessaie.";
}

export const PASSWORD_MIN = 8;

export async function signIn(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) return { ok: false, message: frenchError(error) };
  return { ok: true };
}

// Crée le compte. Si Supabase demande de confirmer l'e-mail : needsConfirm = true.
export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
  if (error) return { ok: false, message: frenchError(error) };
  // Supabase ne renvoie pas d'erreur si l'e-mail existe déjà (anti-fuite) : identities est vide.
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    return { ok: false, message: "Un compte existe déjà avec cet e-mail. Connecte-toi plutôt." };
  }
  return { ok: true, needsConfirm: !data.session };
}

export async function resendConfirmation(email) {
  const { error } = await supabase.auth.resend({ type: "signup", email: email.trim() });
  if (error) return { ok: false, message: frenchError(error) };
  return { ok: true };
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) return { ok: false, message: frenchError(error) };
  return { ok: true };
}

// Supprime le compte côté serveur (fonction SQL `delete_my_account`, à créer dans Supabase),
// puis ferme la session sur le téléphone. Les photos du téléphone ne sont jamais touchées.
export async function deleteAccount() {
  const { error } = await supabase.rpc("delete_my_account");
  if (error) return { ok: false, message: "Impossible de supprimer le compte pour le moment. Réessaie plus tard." };
  await forgetSyncedUser();
  await supabase.auth.signOut().catch(() => {});
  return { ok: true };
}
