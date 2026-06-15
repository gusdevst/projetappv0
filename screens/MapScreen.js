// screens/MapScreen.js
// Affiche les photos géolocalisées sur une carte Leaflet.
// Multi-sélection : cliquer sur plusieurs clusters les sélectionne tous (toggle).
// Le CTA "Trier" lance le tri sur l'union de toutes les photos sélectionnées.

import { useState, useEffect, useMemo, useRef } from "react";
import { View, Text, ScrollView, TouchableOpacity, Image, StatusBar, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { C, S } from "../constants/theme";
import { usePhotoStore } from "../store/usePhotoStore";
import { loadPhotoLocation } from "../services/photoLibrary";

export function MapScreen({ navigation, route }) {
  const mode = route.params?.mode ?? "menage";
  const accent = mode === "album" ? C.album : C.accent;
  const libraryPhotos  = usePhotoStore((s) => s.libraryPhotos);
  const deleted        = usePhotoStore((s) => s.deleted);
  const addAlbumFilter = usePhotoStore((s) => s.addAlbumFilter);
  const [photosWithGeo, setPhotosWithGeo] = useState([]);
  const [loading, setLoading]             = useState(true);
  // Set de clés "lat_lng" des clusters sélectionnés
  const [selectedKeys, setSelectedKeys]   = useState(new Set());
  const webviewRef = useRef(null);

  const activePhotos = useMemo(() => {
    const ids = new Set(deleted.map((p) => p.id));
    return libraryPhotos.filter((p) => !ids.has(p.id));
  }, [libraryPhotos, deleted]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setSelectedKeys(new Set());
    (async () => {
      const enriched = await Promise.all(
        activePhotos.map(async (p) => {
          const loc = await loadPhotoLocation(p.id);
          return loc ? { ...p, lat: loc.lat, lng: loc.lng } : null;
        })
      );
      if (!cancelled) {
        setPhotosWithGeo(enriched.filter((p) => p !== null));
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [activePhotos]);

  // Clusters
  const clusters = useMemo(() => {
    const map = {};
    photosWithGeo.forEach((p) => {
      const key = `${p.lat.toFixed(1)}_${p.lng.toFixed(1)}`;
      if (!map[key]) map[key] = { key, lat: p.lat, lng: p.lng, photos: [] };
      map[key].photos.push(p);
    });
    return Object.values(map);
  }, [photosWithGeo]);

  const markers = clusters.map((c) => ({
    key: c.key, lat: c.lat, lng: c.lng,
    count: c.photos.length,
    label: `${c.lat.toFixed(2)}, ${c.lng.toFixed(2)}`,
  }));

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

  // Quand selectedKeys change → mettre à jour les couleurs dans la WebView
  useEffect(() => {
    if (!webviewRef.current) return;
    const js = `updateSelection(${JSON.stringify([...selectedKeys])}); true;`;
    webviewRef.current.injectJavaScript(js);
  }, [selectedKeys]);

  const toggleCluster = (key) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const html = `<!DOCTYPE html><html><head>
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
      var bg=isSelected?'linear-gradient(135deg,#5cb87a,#3a9a5c)':'linear-gradient(135deg,#f4845f,#e8637a)';
      var border=isSelected?'4px solid #fff':'3px solid #fff';
      var html='<div style="background:'+bg+';color:#fff;border-radius:50%;width:'+sz+'px;height:'+sz+'px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;border:'+border+';box-shadow:0 2px 8px rgba(0,0,0,.35);">'+(g.count>1?g.count:'📍')+'</div>';
      return L.divIcon({className:'',html:html,iconSize:[sz,sz],iconAnchor:[sz/2,sz/2]});
    }

    markers.forEach(function(g){
      var m=L.marker([g.lat,g.lng],{icon:makeIcon(g,false)}).addTo(map);
      m.bindTooltip('<b>'+g.label+'</b><br>'+g.count+' photo(s)',{direction:'top'});
      m.on('click',function(){
        window.ReactNativeWebView.postMessage(JSON.stringify({key:g.key}));
      });
      markerMap[g.key]=m;
    });

    function updateSelection(keys){
      selectedKeys=new Set(keys);
      Object.keys(markerMap).forEach(function(k){
        var g=markers.find(function(m){return m.key===k;});
        if(g) markerMap[k].setIcon(makeIcon(g,selectedKeys.has(k)));
      });
    }
  </script></body></html>`;

  const onMessage = (e) => {
    try {
      const data = JSON.parse(e.nativeEvent.data);
      if (data.key) toggleCluster(data.key);
    } catch {}
  };

  const selectionCount = selectedKeys.size;

  // Ajoute les lieux sélectionnés comme filtre combiné (mode album), puis revient.
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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar backgroundColor={C.bg} barStyle="dark-content" />

      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: S.pad, paddingBottom: 12 }}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{ backgroundColor: C.bgCard, borderRadius: S.radiusFull, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: C.border }}
        >
          <Text style={{ color: C.textMuted, fontSize: 16 }}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: "800", fontSize: 18, color: C.text }}>Tri par lieu</Text>
          <Text style={{ fontSize: 11, color: C.textMuted }}>
            {loading
              ? "Lecture des coordonnées GPS…"
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

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={accent} />
          <Text style={{ color: C.textMuted, marginTop: 12 }}>Analyse des coordonnées GPS…</Text>
        </View>
      ) : photosWithGeo.length === 0 ? (
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
            />
          </View>

          {/* Indication multi-sélection */}
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

            {/* Mode album : ajouter les lieux sélectionnés comme filtre combiné */}
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
