// screens/MapScreen.js
// Affiche les photos géolocalisées sur une carte Leaflet.
// Multi-sélection : cliquer sur plusieurs clusters les sélectionne tous (toggle).
// Le CTA "Trier" lance le tri sur l'union de toutes les photos sélectionnées.
//
// Chargement GPS :
//   1. Lecture instantanée du cache (AsyncStorage) → carte affichée immédiatement
//   2. Scan en arrière-plan des photos non-cachées par batches de 50
//   3. Mise à jour progressive de la carte au fil du scan
//   4. Sauvegarde du cache enrichi en fin de scan

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity, Image, StatusBar, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { C, S } from "../constants/theme";
import { usePhotoStore } from "../store/usePhotoStore";
import { loadPhotoLocation } from "../services/photoLibrary";
import { loadGpsCache, saveGpsCache } from "../services/gpsCache";
import BackButton from "../components/BackButton";

const SCAN_BATCH = 50;

export function MapScreen({ navigation, route }) {
  const mode = route.params?.mode ?? "menage";
  const accent = mode === "album" ? C.album : C.accent;
  const libraryPhotos  = usePhotoStore((s) => s.libraryPhotos);
  const deleted        = usePhotoStore((s) => s.deleted);
  const addAlbumFilter = usePhotoStore((s) => s.addAlbumFilter);

  const [photosWithGeo, setPhotosWithGeo] = useState([]);
  const [loading, setLoading]             = useState(true);
  // null = scan terminé ; {scanned, total} = scan en cours
  const [scanProgress, setScanProgress]   = useState(null);
  const [selectedKeys, setSelectedKeys]   = useState(new Set());
  const webviewRef = useRef(null);
  // Référence partagée avec la boucle de scan pour injecter les nouveaux marqueurs
  const pendingMarkersRef = useRef([]);

  const activePhotos = useMemo(() => {
    const ids = new Set(deleted.map((p) => p.id));
    return libraryPhotos.filter((p) => !ids.has(p.id));
  }, [libraryPhotos, deleted]);

  // ─── Chargement + scan en arrière-plan ──────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setSelectedKeys(new Set());
    setLoading(true);
    setScanProgress(null);
    pendingMarkersRef.current = [];

    (async () => {
      // Étape 1 : lecture instantanée du cache
      const cache = await loadGpsCache();

      if (cancelled) return;

      // Construire la liste des photos déjà connues avec GPS
      const known = [];
      const toScan = [];
      activePhotos.forEach((p) => {
        if (cache[p.id]) {
          known.push({ ...p, lat: cache[p.id].lat, lng: cache[p.id].lng });
        } else {
          toScan.push(p);
        }
      });

      setPhotosWithGeo(known);
      setLoading(false);

      if (toScan.length === 0) return; // tout est en cache

      // Étape 2 : scan arrière-plan des photos non-cachées
      setScanProgress({ scanned: 0, total: toScan.length });

      let newlyFound = 0;
      for (let i = 0; i < toScan.length; i += SCAN_BATCH) {
        if (cancelled) break;
        const chunk = toScan.slice(i, i + SCAN_BATCH);
        const enriched = await Promise.all(
          chunk.map(async (p) => {
            const loc = await loadPhotoLocation(p.id);
            if (loc) {
              cache[p.id] = { lat: loc.lat, lng: loc.lng };
              return { ...p, lat: loc.lat, lng: loc.lng };
            }
            return null;
          })
        );

        if (cancelled) break;

        const found = enriched.filter((p) => p !== null);
        if (found.length > 0) {
          newlyFound += found.length;
          setPhotosWithGeo((prev) => [...prev, ...found]);
          // Mémoriser pour injection JS une fois la WebView prête
          pendingMarkersRef.current.push(...found);
        }

        setScanProgress({ scanned: Math.min(i + SCAN_BATCH, toScan.length), total: toScan.length });
      }

      if (!cancelled) {
        setScanProgress(null);
        if (newlyFound > 0) {
          await saveGpsCache(cache);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [activePhotos]);

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

  // ─── Synchronisation carte / sélection ───────────────────────────────────
  useEffect(() => {
    if (!webviewRef.current) return;
    const js = `updateSelection(${JSON.stringify([...selectedKeys])}); true;`;
    webviewRef.current.injectJavaScript(js);
  }, [selectedKeys]);

  // Injection des nouveaux marqueurs trouvés pendant le scan
  const injectNewMarkers = useCallback(() => {
    if (!webviewRef.current || pendingMarkersRef.current.length === 0) return;
    // Recalculer les clusters depuis photosWithGeo n'est pas disponible ici,
    // donc on recalcule à partir des pendingMarkers
    const newClusters = {};
    pendingMarkersRef.current.forEach((p) => {
      const key = `${p.lat.toFixed(1)}_${p.lng.toFixed(1)}`;
      if (!newClusters[key]) newClusters[key] = { key, lat: p.lat, lng: p.lng, count: 0, label: `${p.lat.toFixed(2)}, ${p.lng.toFixed(2)}` };
      newClusters[key].count++;
    });
    pendingMarkersRef.current = [];
    const payload = JSON.stringify(Object.values(newClusters));
    webviewRef.current.injectJavaScript(`addOrUpdateMarkers(${payload}); true;`);
  }, []);

  const toggleCluster = (key) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // ─── HTML de la carte ────────────────────────────────────────────────────
  const html = useMemo(() => `<!DOCTYPE html><html><head>
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

    function addOrUpdateMarkers(newMarkers){
      newMarkers.forEach(function(g){
        var existing=markers.find(function(m){return m.key===g.key;});
        if(existing){
          existing.count+=g.count;
          markerMap[g.key].setIcon(makeIcon(existing,selectedKeys.has(g.key)));
          markerMap[g.key].getTooltip().setContent('<b>'+existing.label+'</b><br>'+existing.count+' photo(s)');
        } else {
          markers.push(g);
          addMarkerToMap(g);
        }
      });
    }

    function updateSelection(keys){
      selectedKeys=new Set(keys);
      Object.keys(markerMap).forEach(function(k){
        var g=markers.find(function(m){return m.key===k;});
        if(g) markerMap[k].setIcon(makeIcon(g,selectedKeys.has(k)));
      });
    }
  </script></body></html>`, [markers]);

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
      {scanProgress && (
        <View style={{ marginHorizontal: S.pad, marginBottom: 8, backgroundColor: C.bgCard, borderRadius: S.radius, padding: 10, flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: C.border }}>
          <ActivityIndicator size="small" color={accent} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 12, color: C.text, fontWeight: "600" }}>
              Analyse GPS en cours… {scanProgress.scanned}/{scanProgress.total}
            </Text>
            <View style={{ height: 3, backgroundColor: C.border, borderRadius: 2, marginTop: 4 }}>
              <View style={{ height: 3, backgroundColor: accent, borderRadius: 2, width: `${Math.round(scanProgress.scanned / scanProgress.total * 100)}%` }} />
            </View>
          </View>
          <Text style={{ fontSize: 11, color: C.textMuted }}>
            {Math.round(scanProgress.scanned / scanProgress.total * 100)}%
          </Text>
        </View>
      )}

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={accent} />
          <Text style={{ color: C.textMuted, marginTop: 12 }}>Chargement du cache GPS…</Text>
        </View>
      ) : photosWithGeo.length === 0 && !scanProgress ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32 }}>
          <Text style={{ fontSize: 56, marginBottom: 12 }}>🗺</Text>
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
          <View style={{ height: 300, marginHorizontal: S.pad, borderRadius: S.radius, overflow: "hidden", borderWidth: 1, borderColor: C.border }}>
            <WebView
              ref={webviewRef}
              source={{ html }}
              style={{ flex: 1 }}
              onMessage={onMessage}
              javaScriptEnabled
              onLoadEnd={injectNewMarkers}
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
                🔀 Trier {selectionCount > 0 ? `ces ${displayedPhotos.length}` : "toutes les"} photos
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
