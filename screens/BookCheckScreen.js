// screens/BookCheckScreen.js
// « Vérifier ton livre » : contrôles avant impression (maquette : maquette-livre-verification.html).
// Ouvert avec navigation.navigate("BookCheck", { albumId }).
// 3 vues : "summary" (contrôles) · "lowQuality" (photos à vérifier) · "next" (après « Continuer »).
// Les règles sont dans services/bookCheck.js ; l'écran ne fait que les afficher.

import { useMemo, useState } from "react";
import { View, ScrollView, TouchableOpacity, StatusBar } from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import Text from "../components/AppText";
import BackButton from "../components/BackButton";
import { BookCover } from "../components/book/BookPage";
import { useBookFonts } from "../components/book/bookFonts";
import { SHADOW } from "../components/home/ui";
import { C, S } from "../constants/theme";
import { usePhotoStore } from "../store/usePhotoStore";
import * as Sharing from "expo-sharing";
import { PrintPageRenderer } from "../components/book/PrintPageRenderer";
import { useBookPdf } from "../hooks/useBookPdf";
import { checkBook } from "../services/bookCheck";
import { pageRatio } from "../services/photoBook";

// Une ligne de contrôle : pastille ✓ (ok) ou ! (alerte), texte, lien « Voir ›».
function CheckRow({ ok, title, sub, onSee, first }) {
  return (
    <View style={{
      flexDirection: "row", alignItems: "flex-start", gap: 10,
      paddingTop: first ? 0 : 11, paddingBottom: 11,
      borderTopWidth: first ? 0 : 1, borderTopColor: C.border,
    }}>
      <View style={{
        width: 24, height: 24, borderRadius: 12, marginTop: 1,
        backgroundColor: ok ? C.sage : C.albumSoft, alignItems: "center", justifyContent: "center",
      }}>
        <Text style={{ fontSize: 13, fontWeight: "800", color: ok ? C.accent : C.album }}>{ok ? "✓" : "!"}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 13.5, color: C.text, lineHeight: 18 }}>{title}</Text>
        {!!sub && <Text style={{ fontSize: 11.5, color: C.textMid, marginTop: 2, lineHeight: 16 }}>{sub}</Text>}
      </View>
      {onSee && (
        <TouchableOpacity onPress={onSee} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={{ fontSize: 12.5, fontWeight: "700", color: C.album }}>Voir ›</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;

export function BookCheckScreen({ navigation, route }) {
  const albumId = route?.params?.albumId;
  const album   = usePhotoStore((s) => s.albums.find((a) => a.id === albumId));
  const printed = usePhotoStore((s) => s.printed);
  const book    = usePhotoStore((s) => s.books[albumId]);
  useBookFonts();

  const [view, setView] = useState("summary");
  // PDF d'essai (outil de développement : visible seulement en __DEV__).
  const pdf = useBookPdf(book, useMemo(() => Object.fromEntries(printed.map((p) => [p.id, p.url])), [printed]));
  const sharePdf = async () => {
    try {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(pdf.state.result.uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf", dialogTitle: "Livre photo (PDF d'essai)" });
      }
    } catch (e) { /* feuille de partage fermée : rien à faire */ }
  };

  const urlById   = useMemo(() => Object.fromEntries(printed.map((p) => [p.id, p.url])), [printed]);
  const photoById = useMemo(() => Object.fromEntries(printed.map((p) => [p.id, p])), [printed]);
  const albumIds  = useMemo(() => (album ? album.photoIds.filter((id) => urlById[id]) : []), [album, urlById]);
  const res = useMemo(() => (book ? checkBook(book, albumIds, photoById) : null), [book, albumIds, photoById]);

  if (!album || !book || !res) return <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} />;

  const goEditor = (pageIndex) => navigation.navigate("BookPageEditor", { albumId, pageIndex });
  const back = () => (view === "summary" ? navigation.goBack() : setView("summary"));
  const headSub = view === "summary" ? "Livre photo" : "Vérifier ton livre";
  const headTitle = view === "summary" ? "Vérifier ton livre"
    : view === "lowQuality" ? plural(res.lowQuality.length, "photo à vérifier", "photos à vérifier")
    : "Et maintenant ?";

  const Header = (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 }}>
      <BackButton accentColor={C.album} onPress={back} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 11.5, color: C.textMuted }}>{headSub}</Text>
        <Text numberOfLines={1} style={{ fontSize: 19, fontWeight: "600", color: C.text }}>{headTitle}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar backgroundColor={C.bg} barStyle="dark-content" />
      {/* Rendu hors écran des pages pour le PDF d'essai (jamais visible) */}
      {__DEV__ && <PrintPageRenderer {...pdf.rendererProps} />}
      <ScrollView contentContainerStyle={{ padding: S.pad, paddingTop: 8, paddingBottom: 40 }}>
        {Header}

        {/* ── Vue 1 : contrôles ─────────────────────────────────────────── */}
        {view === "summary" && (
          <>
            <View style={{ backgroundColor: C.bgCard, borderRadius: 18, padding: 14, flexDirection: "row", alignItems: "center", gap: 14, ...SHADOW }}>
              <BookCover cover={book.cover} size={book.orientation === "landscape" ? 120 : 90} ratio={pageRatio(book)} urlById={urlById} />
              <View style={{ flex: 1 }}>
                <Text numberOfLines={2} style={{ fontSize: 16, fontWeight: "600", color: C.text }}>{book.cover.title || album.name}</Text>
                <Text style={{ fontSize: 12.5, color: C.textMid, lineHeight: 19, marginTop: 4 }}>
                  {book.format} pages · {book.orientation === "landscape" ? "horizontal" : "vertical"}{"\n"}21 × 28 cm · {plural(albumIds.length, "photo", "photos")}
                </Text>
              </View>
            </View>

            <Text style={{ fontSize: 11, fontWeight: "700", letterSpacing: 1, color: C.textMuted, marginTop: 20, marginBottom: 8, marginLeft: 4 }}>CONTRÔLES</Text>
            <View style={{ backgroundColor: C.bgCard, borderRadius: 18, padding: 14, ...SHADOW }}>
              <CheckRow first ok={res.coverOk}
                title={res.coverOk ? "Couverture prête" : "Il manque la photo de couverture"}
                sub={res.coverOk ? "Photo et titre choisis" : "Choisis-en une dans l'éditeur."}
                onSee={res.coverOk ? null : () => navigation.goBack()} />
              {!res.pagesOk && (
                <CheckRow ok={false}
                  title={`${book.format} pages : trop peu pour l'impression`}
                  sub="L'imprimeur demande 30 pages minimum. Choisis un autre format dans l'éditeur."
                  onSee={() => navigation.goBack()} />
              )}
              <CheckRow ok={res.emptyPages.length === 0}
                title={res.emptyPages.length === 0 ? "Aucune page vide" : plural(res.emptyPages.length, "page vide", "pages vides")}
                sub={res.emptyPages.length ? "Elles seront imprimées blanches." : null}
                onSee={res.emptyPages.length ? () => goEditor(res.emptyPages[0]) : null} />
              <CheckRow ok={res.lowQuality.length === 0}
                title={res.lowQuality.length === 0 ? "Photos de bonne qualité" : plural(res.lowQuality.length, "photo de faible qualité", "photos de faible qualité")}
                sub={res.lowQuality.length ? "Trop petites pour cette taille : elles risquent d'être floues." : null}
                onSee={res.lowQuality.length ? () => setView("lowQuality") : null} />
              <CheckRow ok={res.unplaced === 0}
                title={res.unplaced === 0 ? "Toutes les photos de l'album sont dans le livre" : `${plural(res.unplaced, "photo de l'album n'est", "photos de l'album ne sont")} pas dans le livre`}
                sub={res.unplaced ? "Tu peux les ajouter depuis l'éditeur (Compléter automatiquement)." : null} />
            </View>

            <TouchableOpacity
              onPress={() => setView("next")}
              style={{ height: 52, borderRadius: S.radiusFull, backgroundColor: C.album, alignItems: "center", justifyContent: "center", marginTop: 18, elevation: 3 }}
            >
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Continuer</Text>
            </TouchableOpacity>
            {(res.emptyPages.length > 0 || res.lowQuality.length > 0 || !res.coverOk) && (
              <Text style={{ fontSize: 11.5, color: C.textMuted, textAlign: "center", marginTop: 10 }}>
                Tu peux continuer malgré les alertes, ou les corriger d'abord.
              </Text>
            )}
          </>
        )}

        {/* ── Vue 2 : photos de faible qualité ─────────────────────────── */}
        {view === "lowQuality" && (
          <>
            <Text style={{ fontSize: 13, color: C.textMid, lineHeight: 19, marginBottom: 14 }}>
              Ces photos sont petites ou compressées. Sur une page, elles risquent d'être floues. Tu peux les garder, les changer ou les retirer.
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {res.lowQuality.map((q) => (
                <TouchableOpacity
                  key={`${q.photoId}-${q.pageIndex}`}
                  onPress={() => goEditor(q.pageIndex)}
                  style={{ width: "31.5%", aspectRatio: 1, borderRadius: 10, overflow: "hidden", backgroundColor: C.bgMuted }}
                >
                  <Image source={{ uri: urlById[q.photoId] }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                  <View style={{ position: "absolute", right: 4, top: 4, width: 18, height: 18, borderRadius: 9, backgroundColor: C.album, alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ color: "#fff", fontSize: 11, fontWeight: "800" }}>!</Text>
                  </View>
                  <Text style={{ position: "absolute", left: 6, bottom: 4, fontSize: 10, fontWeight: "700", color: "#fff", textShadowColor: "rgba(0,0,0,0.5)", textShadowRadius: 2 }}>
                    p. {q.pageIndex + 1}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={{ fontSize: 11.5, color: C.textMuted, marginTop: 14 }}>Touche une photo pour ouvrir sa page dans l'éditeur.</Text>
          </>
        )}

        {/* ── Vue 3 : après « Continuer » ──────────────────────────────── */}
        {view === "next" && (
          <>
            {/* PDF d'essai : outil de développement (jamais visible dans une version publiée) */}
            {__DEV__ && (
              <View style={{ backgroundColor: C.bgCard, borderRadius: 18, padding: 16, ...SHADOW }}>
                {pdf.state.phase === "working" ? (
                  <>
                    <Text style={{ fontSize: 15, fontWeight: "600", color: C.text }}>📄 Fabrication du PDF…</Text>
                    <View style={{ height: 10, backgroundColor: C.bgMuted, borderRadius: 6, overflow: "hidden", marginTop: 12 }}>
                      <View style={{ width: `${Math.round((pdf.state.done / Math.max(1, pdf.state.total)) * 100)}%`, height: "100%", backgroundColor: C.album, borderRadius: 6 }} />
                    </View>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
                      <Text style={{ fontSize: 12, color: C.textMuted }}>Page {Math.min(pdf.state.done + 1, pdf.state.total)} sur {pdf.state.total}</Text>
                      <Text style={{ fontSize: 12, color: C.textMuted }}>{Math.round((pdf.state.done / Math.max(1, pdf.state.total)) * 100)} %</Text>
                    </View>
                    {!!pdf.state.step && <Text style={{ fontSize: 12, color: C.album, marginTop: 8 }}>{pdf.state.step}</Text>}
                    <Text style={{ fontSize: 12.5, color: C.textMid, marginTop: 12 }}>Garde l'app ouverte et l'écran allumé.</Text>
                    <TouchableOpacity onPress={pdf.cancel}
                      style={{ height: 46, borderRadius: S.radiusFull, borderWidth: 1.5, borderColor: C.border, alignItems: "center", justifyContent: "center", marginTop: 12 }}>
                      <Text style={{ color: C.textMid, fontWeight: "700", fontSize: 14.5 }}>Annuler</Text>
                    </TouchableOpacity>
                  </>
                ) : pdf.state.phase === "done" ? (
                  <>
                    <Text style={{ fontSize: 15, fontWeight: "600", color: C.text, textAlign: "center" }}>PDF prêt ✓</Text>
                    <Text style={{ fontSize: 12.5, color: C.textMid, textAlign: "center", marginTop: 4, marginBottom: 14 }}>
                      {book.cover.title || album.name} · {pdf.state.result.pages} pages · 21 × 28 cm · {pdf.state.result.sizeMo} Mo
                    </Text>
                    {pdf.state.slowPages > 0 && (
                      <Text style={{ fontSize: 12, color: C.album, textAlign: "center", marginBottom: 12 }}>
                        ⚠ {pdf.state.slowPages} page{pdf.state.slowPages > 1 ? "s" : ""} dessinée{pdf.state.slowPages > 1 ? "s" : ""} avant la fin du chargement des photos : vérifie-les.
                      </Text>
                    )}
                    <TouchableOpacity onPress={sharePdf}
                      style={{ height: 46, borderRadius: S.radiusFull, backgroundColor: C.album, alignItems: "center", justifyContent: "center", elevation: 3 }}>
                      <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14.5 }}>Ouvrir / Partager</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => { pdf.reset(); pdf.start(); }}
                      style={{ height: 46, borderRadius: S.radiusFull, borderWidth: 1.5, borderColor: C.border, alignItems: "center", justifyContent: "center", marginTop: 8 }}>
                      <Text style={{ color: C.textMid, fontWeight: "700", fontSize: 14.5 }}>Le refaire</Text>
                    </TouchableOpacity>
                    <Text style={{ fontSize: 11.5, color: C.textMuted, lineHeight: 16, marginTop: 12 }}>
                      Ce PDF est un essai : page 1 = couverture à plat (4ᵉ, dos, face), puis une page blanche, les pages intérieures et une page blanche de fin.
                    </Text>
                  </>
                ) : (
                  <>
                    <Text style={{ fontSize: 15, fontWeight: "600", color: C.text }}>📄 Créer un PDF d'essai</Text>
                    <Text style={{ fontSize: 12.5, color: C.textMid, lineHeight: 18, marginTop: 4, marginBottom: 12 }}>
                      La couverture à plat (dimensions demandées à Gelato) et chaque page (21 × 28 cm, fond perdu de 4 mm) sont dessinées à la taille d'impression, puis assemblées en un PDF que tu peux regarder et partager. Aucune photo n'est envoyée nulle part.
                    </Text>
                    {pdf.state.phase === "error" && (
                      <Text style={{ fontSize: 12, color: C.red, marginBottom: 10 }}>Échec : {pdf.state.error}</Text>
                    )}
                    {pdf.state.phase === "cancelled" && (
                      <Text style={{ fontSize: 12, color: C.textMuted, marginBottom: 10 }}>Annulé.</Text>
                    )}
                    <TouchableOpacity onPress={pdf.start}
                      style={{ height: 46, borderRadius: S.radiusFull, backgroundColor: C.album, alignItems: "center", justifyContent: "center", elevation: 3 }}>
                      <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14.5 }}>Créer le PDF</Text>
                    </TouchableOpacity>
                    <Text style={{ fontSize: 12, color: C.textMuted, marginTop: 10 }}>
                      ≈ {pdf.totalPages} pages · ça prend un moment, garde l'app ouverte.
                    </Text>
                  </>
                )}
              </View>
            )}
            <View style={{ backgroundColor: C.bgCard, borderRadius: 18, padding: 16, marginTop: 12, opacity: 0.75, ...SHADOW }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ fontSize: 15, fontWeight: "600", color: C.text }}>🛒 Commander ce livre</Text>
                <Text style={{ fontSize: 10, fontWeight: "700", letterSpacing: 0.8, color: C.album }}>BIENTÔT</Text>
              </View>
              <Text style={{ fontSize: 12.5, color: C.textMid, lineHeight: 18, marginTop: 4 }}>
                Impression et livraison chez un partenaire. Il faudra un compte et ton accord pour envoyer les photos.
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
