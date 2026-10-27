// screens/MapScreen.js
// Affiche les photos géolocalisées sur une carte Leaflet.
// Multi-sélection : cliquer sur plusieurs clusters les sélectionne tous (toggle).
// Le CTA "Trier" lance le tri sur l'union de toutes les photos sélectionnées.
//
// Chargement GPS :
//   L'état du scan (geoPhotos, geoScanStatus, geoScanProgress) vit dans le
//   store (voir store/usePhotoStore.js → scanGeo), pas dans ce composant.
//   Ça permet de quitter puis revenir sur cet écran sans tout recharger :
//   au retour, les données sont déjà en mémoire.
//   1. Ce composant déclenche scanGeo() seulement si le scan n'a jamais démarré.
//   2. scanGeo() lit le cache (services/gpsCache.js), ne scanne que les photos
//      jamais vues (cache négatif), et met à jour geoPhotos par batches.
//   3. Ce composant se contente d'afficher geoPhotos, filtré des photos supprimées.

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity, StatusBar, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { C, S } from "../constants/theme";
import { usePhotoStore } from "../store/usePhotoStore";
import BackButton from "../components/BackButton";

export function MapScreen({ navigation, route }) {
  const mode = route.params?.mode ?? "menage";
  const accent = mode === "album" ? C.album : C.accent;
  const libraryPhotos  = usePhotoStore((s) => s.libraryPhotos);
  const deleted        = usePhotoStore((s) => s.deleted);
  const addAlbumFilter = usePhotoStore((s) => s.addAlbumFilter);
  const geoPhotos       = usePhotoStore((s) => s.geoPhotos);
  const geoScanStatus   = usePhotoStore((s) => s.geoScanStatus);
  const geoScanProgress = usePhotoStore((s) => s.geoScanProgress);
  const scanGeo         = usePhotoStore((s) => s.scanGeo);

  const [selectedKeys, setSelectedKeys] = useState(new Set());
  const webviewRef = useRef(null);
  // La WebView est-elle prête à recevoir des commandes JS ?
  const mapReadyRef = useRef(false);
  // Minuterie de regroupement des mises à jour (une toutes les 800 ms max).
  const redrawTimerRef = useRef(null);

  const activePhotos = useMemo(() => {
    const ids = new Set(deleted.map((p) => p.id));
    return libraryPhotos.filter((p) => !ids.has(p.id));
  }, [libraryPhotos, deleted]);

  // Photos géolocalisées encore actives (exclut celles supprimées depuis le scan)
  const photosWithGeo = useMemo(() => {
    const activeIds = new Set(activePhotos.map((p) => p.id));
    return geoPhotos.filter((p) => activeIds.has(p.id));
  }, [geoPhotos, activePhotos]);

  // Chargement "plein écran" tant qu'aucune photo géolocalisée n'est encore
  // disponible. On attend d'avoir au moins un résultat (ou la fin du scan)
  // avant de monter la carte (WebView) : la monter dès le début du scan la
  // ferait démarrer en même temps que la 1re salve d'appels GPS natifs, ce qui
  // double la charge mémoire au pire moment sur une grosse photothèque.
  const loading = geoScanStatus === "idle" || (geoScanStatus === "scanning" && geoPhotos.length === 0);

  // ─── Déclenchement du scan (une seule fois, si jamais lancé) ────────────
  useEffect(() => {
    if (geoScanStatus === "idle") {
      scanGeo();
    }
    // Ne dépend volontairement que du montage : on ne relance jamais
    // automatiquement un scan déjà démarré ou terminé en revenant sur l'écran.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Clusters ────────────────────────────────────────────────────────────
  const clusters = useMemo(() => {
    const map = {};
    photosWithGeo.forEach((p) => {
      const key = `${p.lat.toFixed(1)}_${p.lng.toFixed(1)}`;
      if (!map[key]) map[key] = { key, lat: p.lat, lng: p.lng, photos: [] };
      map[key].photos.push(p);
    });
    return Object.values(map);
  }, [photosWithGeo]);

  const markers = useMemo(() => clusters.map((c) => ({
    key: c.key, lat: c.lat, lng: c.lng,
    count: c.photos.length,
    label: `${c.lat.toFixed(2)}, ${c.lng.toFixed(2)}`,
  })), [clusters]);

  // Photos affichées = union de tous les clusters sélectionnés (ou tous si aucun)
  const displayedPhotos = useMemo(() => {
    if (selectedKeys.size === 0) return photosWithGeo;
    const selected = clusters.filter((c) => selectedKeys.has(c.key));
    const seen = new Set();
    const result = [];
    selected.forEach((c) => c.photos.forEach((p) => {
      if (!seen.has(p.id)) { seen.add(p.id); result.push(p); }
    }));
    return result;
  }, [selectedKeys, clusters, photosWithGeo]);

  // ─── Mises à jour de la carte SANS la recharger ──────────────────────────
  // Avant : le HTML dépendait des marqueurs → à chaque lot de 20 photos scannées
  // (toutes les ~30 ms), la WebView rechargeait toute la carte. Des centaines de
  // rechargements = mémoire qui explose = crash. Maintenant : la page est créée
  // UNE fois, puis on lui envoie la liste à jour, au plus toutes les 800 ms.
  const latestRef = useRef({ markers: [], selected: [] });
  latestRef.current = { markers, selected: [...selectedKeys] };

  const pushToMap = useCallback(() => {
    if (!mapReadyRef.current || !webviewRef.current) return;
    const { markers: m, selected } = latestRef.current;
    webviewRef.current.injectJavaScript(
      `if (window.setMarkers) { setMarkers(${JSON.stringify(m)}); updateSelection(${JSON.stringify(selected)}); } true;`
    );
  }, []);

  // Nouveaux lieux trouvés pendant le scan → mise à jour regroupée.
  useEffect(() => {
    if (redrawTimerRef.current) return;
    redrawTimerRef.current = setTimeout(() => {
      redrawTimerRef.current = null;
      pushToMap();
    }, 800);
  }, [markers, pushToMap]);

  // Sélection → immédiat (c'est l'utilisateur qui touche).
  useEffect(() => {
    if (!mapReadyRef.current || !webviewRef.current) return;
    webviewRef.current.injectJavaScript(`if (window.updateSelection) updateSelection(${JSON.stringify([...selectedKeys])}); true;`);
  }, [selectedKeys]);

  // Nettoyage de la minuterie en quittant l'écran.
  useEffect(() => () => { if (redrawTimerRef.current) clearTimeout(redrawTimerRef.current); }, []);

  const onMapLoaded = () => {
    mapReadyRef.current = true;
    pushToMap();
  };

  const toggleCluster = (key) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // ─── HTML de la carte ────────────────────────────────────────────────────
  // Créé UNE seule fois (au premier affichage de la carte) puis jamais modifié.
  const htmlRef = useRef(null);
  if (!htmlRef.current && !loading) htmlRef.current = buildMapHtml(markers);
  const html = htmlRef.current;
  // Même objet à chaque rendu → la WebView ne recharge jamais la page.
  const webSource = useMemo(() => ({ html }), [html]);
  function buildMapHtml(markers) { return `<!DOCTYPE html><html><head>
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"/>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"></script>
    <style>body,html,#map{margin:0;padding:0;height:100%;width:100%;}</style>
  </head><body><div id="map"></div>
  <script>
    var markers=${JSON.stringify(markers)};
    var selectedKeys=new Set();
    var markerMap={};
    var center=markers.length?[markers[0].lat,markers[0].lng]:[46.5,4.5];
    var map=L.map('map',{center:center,zoom:markers.length?6:4});
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

    function makeIcon(g,isSelected){
      var sz=g.count>1?38:30;
      var bg=isSelected?'linear-gradient(135deg,#2e7d52,#1e5e3a)':'linear-gradient(135deg,#2e4d7a,#4a6d9e)';
      var border=isSelected?'4px solid #fff':'3px solid #fff';
      var html='<div style="background:'+bg+';color:#fff;border-radius:50%;width:'+sz+'px;height:'+sz+'px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;border:'+border+';box-shadow:0 2px 8px rgba(0,0,0,.35);">'+(g.count>1?g.count:'📍')+'</div>';
      return L.divIcon({className:'',html:html,iconSize:[sz,sz],iconAnchor:[sz/2,sz/2]});
    }

    function addMarkerToMap(g){
      var m=L.marker([g.lat,g.lng],{icon:makeIcon(g,false)}).addTo(map);
      m.bindTooltip('<b>'+g.label+'</b><br>'+g.count+' photo(s)',{direction:'top'});
      m.on('click',function(){
        window.ReactNativeWebView.postMessage(JSON.stringify({key:g.key}));
      });
      markerMap[g.key]=m;
    }

    markers.forEach(addMarkerToMap);

    function setMarkers(list){
      Object.keys(markerMap).forEach(function(k){ map.removeLayer(markerMap[k]); });
      markerMap={};
      markers=list;
      markers.forEach(addMarkerToMap);
    }

    function updateSelection(keys){
      selectedKeys=new Set(keys);
      Object.keys(markerMap).forEach(function(k){
        var g=markers.find(function(m){return m.key===k;});
        if(g) markerMap[k].setIcon(makeIcon(g,selectedKeys.has(k)));
      });
    }
  </script></body></html>`; }

  const onMessage = (e) => {
    try {
      const data = JSON.parse(e.nativeEvent.data);
      if (data.key) toggleCluster(data.key);
    } catch {}
  };

  const selectionCount = selectedKeys.size;

  function addAsFilter() {
    if (displayedPhotos.length === 0) return;
    const label = selectionCount > 0
      ? `${selectionCount} lieu${selectionCount > 1 ? "x" : ""}`
      : "Tous les lieux";
    addAlbumFilter({
      id: `lieu-${[...selectedKeys].sort().join("|") || "all"}`,
      type: "lieu",
      label,
      photoIds: displayedPhotos.map((p) => p.id),
    });
    navigation.goBack();
  }

  // ─── Rendu ───────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar backgroundColor={C.bg} barStyle="dark-content" />

      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: S.pad, paddingBottom: 12 }}>
        <BackButton mode={mode} onPress={() => navigation.goBack()} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: "800", fontSize: 18, color: C.text }}>Tri par lieu</Text>
          <Text style={{ fontSize: 11, color: C.textMuted }}>
            {loading
              ? "Chargement du cache GPS…"
              : selectionCount > 0
              ? `${selectionCount} lieu${selectionCount > 1 ? "x" : ""} sélectionné${selectionCount > 1 ? "s" : ""} · ${displayedPhotos.length} photos`
              : `${photosWithGeo.length} photo(s) géolocalisée(s)`}
          </Text>
        </View>
        {selectionCount > 0 && (
          <TouchableOpacity
            onPress={() => setSelectedKeys(new Set())}
            style={{ backgroundColor: C.bgCard, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: C.border }}
          >
            <Text style={{ fontSize: 12, color: C.textMuted }}>Tout désélectionner</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Bandeau de progression du scan arrière-plan */}
      {geoScanProgress && (
        <View style={{ marginHorizontal: S.pad, marginBottom: 8, backgroundColor: C.bgCard, borderRadius: S.radius, padding: 10, flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: C.border }}>
          <ActivityIndicator size="small" color={accent} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 12, color: C.text, fontWeight: "600" }}>
              Analyse GPS en cours… {geoScanProgress.scanned}/{geoScanProgress.total}
            </Text>
            <View style={{ height: 3, backgroundColor: C.border, borderRadius: 2, marginTop: 4 }}>
              <View style={{ height: 3, backgroundColor: accent, borderRadius: 2, width: `${Math.round(geoScanProgress.scanned / geoScanProgress.total * 100)}%` }} />
            </View>
          </View>
          <Text style={{ fontSize: 11, color: C.textMuted }}>
            {Math.round(geoScanProgress.scanned / geoScanProgress.total * 100)}%
          </Text>
        </View>
      )}

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={accent} />
          <Text style={{ color: C.textMuted, marginTop: 12 }}>Chargement du cache GPS…</Text>
        </View>
      ) : photosWithGeo.length === 0 && !geoScanProgress ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32 }}>
          <Text style={{ fontSize: 56, marginBottom: 12 }}>🌍</Text>
          <Text style={{ fontSize: 16, fontWeight: "700", color: C.text, textAlign: "center" }}>
            Aucune photo géolocalisée
          </Text>
          <Text style={{ fontSize: 13, color: C.textMuted, textAlign: "center", marginTop: 8 }}>
            Aucune de tes photos ne contient de coordonnées GPS. Le tri par lieu sera disponible quand tu auras des photos géolocalisées.
          </Text>
        </View>
      ) : (
        <>
          {/* Carte */}
          {/* La carte prend toute la place disponible : plus facile de zoomer et de toucher les lieux */}
          <View style={{ flex: 1, minHeight: 380, marginHorizontal: S.pad, borderRadius: S.radius, overflow: "hidden", borderWidth: 1, borderColor: C.border }}>
            <WebView
              ref={webviewRef}
              source={webSource}
              style={{ flex: 1 }}
              onMessage={onMessage}
              javaScriptEnabled
              onLoadEnd={onMapLoaded}
            />
          </View>

          {selectionCount === 0 && (
            <Text style={{ fontSize: 11, color: C.textMuted, textAlign: "center", marginTop: 8, fontStyle: "italic" }}>
              Appuie sur un ou plusieurs lieux pour les sélectionner
            </Text>
          )}

          {/* Aperçu photos */}
          <View style={{ padding: S.pad, paddingTop: 12 }}>
            {displayedPhotos.length > 0 && (
              <>
                <Text style={{ fontWeight: "700", fontSize: 14, color: C.text, marginBottom: 10 }}>
                  {selectionCount > 0
                    ? `${displayedPhotos.length} photo(s) dans ${selectionCount} lieu${selectionCount > 1 ? "x" : ""}`
                    : `${displayedPhotos.length} photos visibles`}
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                  <View style={{ flexDirection: "row", gap: 6 }}>
                    {displayedPhotos.slice(0, 10).map((p) => (
                      <Image key={p.id} source={{ uri: p.url }} style={{ width: 56, height: 56, borderRadius: 10 }} />
                    ))}
                  </View>
                </ScrollView>
              </>
            )}

            <TouchableOpacity
              onPress={() => navigation.navigate("TriMode", {
                preQueue: displayedPhotos,
                ...(mode === "album" ? { skipToAlbum: true } : { skipToMenage: true }),
              })}
              disabled={displayedPhotos.length === 0}
              style={{
                backgroundColor: accent, borderRadius: S.radius, padding: 16,
                alignItems: "center", elevation: 4,
                opacity: displayedPhotos.length === 0 ? 0.4 : 1,
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "800", fontSize: 15 }}>
                🧹 Trier {selectionCount > 0 ? `ces ${displayedPhotos.length}` : "toutes les"} photos
              </Text>
            </TouchableOpacity>

            {mode === "album" && displayedPhotos.length > 0 && (
              <TouchableOpacity
                onPress={addAsFilter}
                style={{ marginTop: 8, borderRadius: S.radius, padding: 14, alignItems: "center", borderWidth: 1.5, borderColor: accent }}
              >
                <Text style={{ color: accent, fontWeight: "800", fontSize: 14 }}>➕ Ajouter comme filtre</Text>
              </TouchableOpacity>
            )}
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

export default MapScreen;
