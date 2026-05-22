// ─────────────────────────────────────────────
// screens/MapScreen.js
// ─────────────────────────────────────────────
// Affiche les photos géolocalisées de la photothèque sur une carte Leaflet.
// Les coordonnées GPS ne sont pas dans le payload de base de MediaLibrary —
// il faut les fetcher individuellement via loadPhotoLocation. On le fait au mount.
//
// Limites MVP : pas de reverse geocoding (donc pas de nom de ville).
// Les photos sont groupées par "cluster" simple (arrondi des coordonnées).

import { useState, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity, Image, StatusBar, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { C, S } from "../constants/theme";
import { usePhotoStore } from "../store/usePhotoStore";
import { loadPhotoLocation } from "../services/photoLibrary";

export function MapScreen({ navigation }) {
  const libraryPhotos = usePhotoStore((s) => s.libraryPhotos);
  const [photosWithGeo, setPhotosWithGeo] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCluster, setSelectedCluster] = useState(null);

  // Charge les coordonnées GPS pour chaque photo (en parallèle).
  // Sur 500 photos, ~1-3 secondes selon le téléphone.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const enriched = await Promise.all(
        libraryPhotos.map(async (p) => {
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
  }, [libraryPhotos]);

  // Cluster naïf : on arrondit lat/lng à 0.1° (~10km) et on regroupe
  const clusters = {};
  photosWithGeo.forEach((p) => {
    const key = `${p.lat.toFixed(1)},${p.lng.toFixed(1)}`;
    if (!clusters[key]) clusters[key] = { lat: p.lat, lng: p.lng, photos: [] };
    clusters[key].photos.push(p);
  });
  const markers = Object.values(clusters).map((c) => ({
    lat: c.lat,
    lng: c.lng,
    count: c.photos.length,
    label: `${c.lat.toFixed(2)}, ${c.lng.toFixed(2)}`,
  }));

  const displayedPhotos = selectedCluster
    ? photosWithGeo.filter(
        (p) =>
          p.lat.toFixed(1) === selectedCluster.lat.toFixed(1) &&
          p.lng.toFixed(1) === selectedCluster.lng.toFixed(1)
      )
    : photosWithGeo;

  const html = `<!DOCTYPE html><html><head>
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"/>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"></script>
    <style>body,html,#map{margin:0;padding:0;height:100%;width:100%;}</style>
  </head><body><div id="map"></div>
  <script>
    var markers=${JSON.stringify(markers)};
    var center=markers.length?[markers[0].lat,markers[0].lng]:[46.5,4.5];
    var map=L.map('map',{center:center,zoom:markers.length?6:4});
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
    markers.forEach(function(g){
      var sz=g.count>1?38:30;
      var icon=L.divIcon({className:'',html:'<div style="background:linear-gradient(135deg,#f4845f,#e8637a);color:#fff;border-radius:50%;width:'+sz+'px;height:'+sz+'px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.3);">'+(g.count>1?g.count:'📍')+'</div>',iconSize:[sz,sz],iconAnchor:[sz/2,sz/2]});
      var m=L.marker([g.lat,g.lng],{icon:icon}).addTo(map);
      m.bindTooltip('<b>'+g.label+'</b><br>'+g.count+' photo(s)',{direction:'top'});
      m.on('click',function(){window.ReactNativeWebView.postMessage(JSON.stringify({lat:g.lat,lng:g.lng}));});
    });
  </script></body></html>`;

  const onMessage = (e) => {
    const data = JSON.parse(e.nativeEvent.data);
    setSelectedCluster(data);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar backgroundColor={C.bg} barStyle="dark-content" />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: S.pad, paddingBottom: 12 }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ backgroundColor: C.bgCard, borderRadius: S.radiusFull, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: C.border }}>
          <Text style={{ color: C.textMuted, fontSize: 16 }}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: "800", fontSize: 18, color: C.text }}>Tri par lieu</Text>
          <Text style={{ fontSize: 11, color: C.textMuted }}>
            {loading
              ? "Lecture des données de localisation…"
              : selectedCluster
              ? `📍 Cluster sélectionné`
              : `${photosWithGeo.length} photo(s) avec localisation`}
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={C.accent} />
          <Text style={{ color: C.textMuted, marginTop: 12 }}>Analyse des coordonnées GPS…</Text>
        </View>
      ) : photosWithGeo.length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32 }}>
          <Text style={{ fontSize: 56, marginBottom: 12 }}>🗺</Text>
          <Text style={{ fontSize: 16, fontWeight: "700", color: C.text, textAlign: "center" }}>
            Aucune photo géolocalisée
          </Text>
          <Text style={{ fontSize: 13, color: C.textMuted, textAlign: "center", marginTop: 8 }}>
            Aucune de tes photos ne contient de coordonnées GPS dans ses métadonnées. Le tri par lieu sera disponible quand tu auras des photos géolocalisées.
          </Text>
        </View>
      ) : (
        <>
          <View style={{ height: 300, marginHorizontal: S.pad, borderRadius: S.radius, overflow: "hidden", borderWidth: 1, borderColor: C.border }}>
            <WebView source={{ html }} style={{ flex: 1 }} onMessage={onMessage} javaScriptEnabled />
          </View>
          <View style={{ padding: S.pad, paddingTop: 14 }}>
            <Text style={{ fontWeight: "700", fontSize: 14, color: C.text, marginBottom: 10 }}>
              {selectedCluster ? `${displayedPhotos.length} photo(s) dans ce lieu` : `${displayedPhotos.length} photos visibles`}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
              <View style={{ flexDirection: "row", gap: 6 }}>
                {displayedPhotos.slice(0, 8).map((p) => (
                  <Image key={p.id} source={{ uri: p.url }} style={{ width: 56, height: 56, borderRadius: 10 }} />
                ))}
              </View>
            </ScrollView>
            <TouchableOpacity
              onPress={() => navigation.navigate("Swipe", { queue: displayedPhotos })}
              style={{ backgroundColor: C.accent, borderRadius: S.radius, padding: 16, alignItems: "center", elevation: 4 }}
            >
              <Text style={{ color: "#fff", fontWeight: "800", fontSize: 15 }}>🔀 Trier ces {displayedPhotos.length} photos</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

export default MapScreen;
