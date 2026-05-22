
// ─────────────────────────────────────────────
// screens/MapScreen.js
// ─────────────────────────────────────────────
import { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, Image, StatusBar } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { C, S } from "../constants/theme";
import { PHOTOS } from "../data/mockData";

export function MapScreen({ navigation }) {
  const [selectedPhotos, setSelectedPhotos] = useState(PHOTOS);
  const [selectedCity, setSelectedCity] = useState(null);

  const cityGroups = {};
  PHOTOS.forEach(p => { if (!cityGroups[p.city]) cityGroups[p.city] = { lat: p.lat, lng: p.lng, city: p.city, count: 0 }; cityGroups[p.city].count++; });
  const markers = Object.values(cityGroups);

  const html = `<!DOCTYPE html><html><head>
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"/>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"></script>
    <style>body,html,#map{margin:0;padding:0;height:100%;width:100%;}</style>
  </head><body><div id="map"></div>
  <script>
    var map=L.map('map',{center:[46.5,4.5],zoom:5});
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
    ${JSON.stringify(markers)}.forEach(function(g){
      var sz=g.count>1?38:30;
      var icon=L.divIcon({className:'',html:'<div style="background:linear-gradient(135deg,#f4845f,#e8637a);color:#fff;border-radius:50%;width:'+sz+'px;height:'+sz+'px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.3);">'+(g.count>1?g.count:'📍')+'</div>',iconSize:[sz,sz],iconAnchor:[sz/2,sz/2]});
      var m=L.marker([g.lat,g.lng],{icon:icon}).addTo(map);
      m.bindTooltip('<b>'+g.city+'</b><br>'+g.count+' photo(s)',{direction:'top'});
      m.on('click',function(){window.ReactNativeWebView.postMessage(JSON.stringify({city:g.city}));});
    });
  </script></body></html>`;

  const onMessage = e => {
    const { city } = JSON.parse(e.nativeEvent.data);
    setSelectedCity(city);
    setSelectedPhotos(PHOTOS.filter(p => p.city === city));
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar backgroundColor={C.bg} barStyle="dark-content" />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: S.pad, paddingBottom: 12 }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ backgroundColor: C.bgCard, borderRadius: S.radiusFull, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: C.border }}>
          <Text style={{ color: C.textMuted, fontSize: 16 }}>←</Text>
        </TouchableOpacity>
        <View>
          <Text style={{ fontWeight: "800", fontSize: 18, color: C.text }}>Tri par lieu</Text>
          <Text style={{ fontSize: 11, color: C.textMuted }}>{selectedCity ? `📍 ${selectedCity} sélectionnée` : "Clique sur une ville"}</Text>
        </View>
      </View>
      <View style={{ height: 300, marginHorizontal: S.pad, borderRadius: S.radius, overflow: "hidden", borderWidth: 1, borderColor: C.border }}>
        <WebView source={{ html }} style={{ flex: 1 }} onMessage={onMessage} javaScriptEnabled />
      </View>
      <View style={{ padding: S.pad, paddingTop: 14 }}>
        <Text style={{ fontWeight: "700", fontSize: 14, color: C.text, marginBottom: 10 }}>
          {selectedCity ? `${selectedPhotos.length} photo(s) à ${selectedCity}` : `${selectedPhotos.length} photos visibles`}
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
          <View style={{ flexDirection: "row", gap: 6 }}>
            {selectedPhotos.slice(0, 8).map(p => <Image key={p.id} source={{ uri: p.url }} style={{ width: 56, height: 56, borderRadius: 10 }} />)}
          </View>
        </ScrollView>
        <TouchableOpacity onPress={() => navigation.navigate("Swipe", { queue: selectedPhotos })} style={{ backgroundColor: C.accent, borderRadius: S.radius, padding: 16, alignItems: "center", elevation: 4 }}>
          <Text style={{ color: "#fff", fontWeight: "800", fontSize: 15 }}>🔀 Trier ces {selectedPhotos.length} photos</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}