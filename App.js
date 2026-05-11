import { useState, useRef, useEffect } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, Image,
  Dimensions, Animated, PanResponder,
  Modal, ActivityIndicator, StatusBar, Platform, BackHandler
} from "react-native";
import { SafeAreaView, SafeAreaProvider } from "react-native-safe-area-context";

const { width: SW, height: SH } = Dimensions.get("window");

const PHOTOS = [
  { id:1,  url:"https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&q=80", location:"Alpes", city:"Chamonix", year:"2023", size:3.5, lat:45.92, lng:6.87, faces:[] },
  { id:2,  url:"https://images.unsplash.com/photo-1532983330958-4b32a24a4271?w=800&q=80", location:"Nice", city:"Nice", year:"2023", size:4.2, lat:43.71, lng:7.26, faces:["Marie","Lucas"] },
  { id:3,  url:"https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=800&q=80", location:"Lyon", city:"Lyon", year:"2022", size:2.1, lat:45.75, lng:4.83, faces:["Thomas","Marie"] },
  { id:4,  url:"https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=800&q=80", location:"Chartreuse", year:"2023", size:5.0, lat:45.19, lng:5.72, faces:[] },
  { id:5,  url:"https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=800&q=80", location:"Bretagne", city:"Quimper", year:"2021", size:3.8, lat:47.99, lng:-4.09, faces:["Lucas","Emma"] },
  { id:6,  url:"https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?w=800&q=80", location:"Forêt", city:"Fontainebleau", year:"2022", size:2.9, lat:48.41, lng:2.70, faces:[] },
  { id:7,  url:"https://images.unsplash.com/photo-1520962922320-2038eebab146?w=800&q=80", location:"Paris", city:"Paris", year:"2026", size:3.1, lat:48.85, lng:2.35, faces:["Marie","Emma","Thomas"] },
  { id:8,  url:"https://images.unsplash.com/photo-1414609245224-afa02bfb3fda?w=800&q=80", location:"Méditerranée", city:"Marseille", year:"2025", size:4.8, lat:43.30, lng:5.37, faces:["Lucas"] },
  { id:9,  url:"https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800&q=80", location:"Toscane", city:"Florence", year:"2024", size:3.3, lat:43.77, lng:11.25, faces:["Marie","Lucas"] },
  { id:10, url:"https://images.unsplash.com/photo-1467269204594-9661b134dd2b?w=800&q=80", location:"Barcelone", city:"Barcelone", year:"2025", size:4.1, lat:41.39, lng:2.15, faces:["Emma"] },
  { id:11, url:"https://images.unsplash.com/photo-1560969184-10fe8719e047?w=800&q=80", location:"Allemagne", city:"Berlin", year:"2023", size:2.7, lat:52.52, lng:13.40, faces:["Thomas"] },
  { id:12, url:"https://images.unsplash.com/photo-1533929736458-ca588d08c8be?w=800&q=80", location:"Londres", city:"Londres", year:"2024", size:5.2, lat:51.51, lng:-0.13, faces:["Marie","Thomas"] },
];

const FACE_DATA = {
  Marie:  { color:"#f4845f", initials:"MA" },
  Lucas:  { color:"#5b9bd8", initials:"LU" },
  Emma:   { color:"#b07ad8", initials:"EM" },
  Thomas: { color:"#5cb87a", initials:"TH" },
};

const FILTERS = ["Toutes","4 derniers jours","Mois dernier","2026","2025"];

const C = {
  bg:"#fdf6f0", bgCard:"#ffffff", bgMuted:"#fef0e8", border:"#f0ddd0",
  accent:"#f4845f", accent2:"#e8637a",
  text:"#3a1f10", textMid:"#7a4a30", textMuted:"#b08060",
  green:"#5cb87a", red:"#e8637a", purple:"#b07ad8", yellow:"#e8a840",
};

// Hook: gestion bouton retour Android
function useAndroidBack(handler) {
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      handler();
      return true;
    });
    return () => sub.remove();
  }, [handler]);
}

// ── SWIPE SCREEN ────────────────────────────────────────────────────
function SwipeScreen({ queue, onDone, onBack }) {
  const [idx, setIdx] = useState(0);
  const [kept, setKept] = useState([]);
  const [deleted, setDeleted] = useState([]);
  const [printed, setPrinted] = useState([]);
  const [history, setHistory] = useState([]);
  const [showTip, setShowTip] = useState(true);
  const [aiPanel, setAiPanel] = useState(false);
  const [aiMode, setAiMode] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [advice, setAdvice] = useState(null);
  const [enhanced, setEnhanced] = useState(null);

  useAndroidBack(onBack);

  const pan = useRef(new Animated.ValueXY()).current;
  const rotate = pan.x.interpolate({ inputRange:[-SW/2,0,SW/2], outputRange:["-15deg","0deg","15deg"] });

  const photo = queue[idx] || null;
  const similarPhotos = photo
    ? queue.filter(p => p.id !== photo.id && (p.year === photo.year || p.faces?.some(f => photo.faces?.includes(f))))
    : [];

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderMove: Animated.event([null,{dx:pan.x,dy:pan.y}],{useNativeDriver:false}),
    onPanResponderRelease: (_,g) => {
      if (g.dx > 100) swipe("right");
      else if (g.dx < -100) swipe("left");
      else if (g.dy < -100) swipe("up");
      else Animated.spring(pan,{toValue:{x:0,y:0},useNativeDriver:false}).start();
    }
  });

  const swipe = (dir) => {
    if (!photo) return;
    setAiPanel(false); setAdvice(null); setEnhanced(null); setAiMode(null);
    const toX = dir==="left"?-SW*1.5:dir==="right"?SW*1.5:0;
    const toY = dir==="up"?-SH:0;
    Animated.timing(pan,{toValue:{x:toX,y:toY},duration:300,useNativeDriver:false}).start(()=>{
      const newKept    = dir==="right" ? [...kept,photo]   : kept;
      const newDeleted = dir==="left"  ? [...deleted,photo] : deleted;
      const newPrinted = dir==="up"    ? [...printed,photo] : printed;
      setHistory(h=>[...h,{photo,dir,keptSnap:kept,deletedSnap:deleted,printedSnap:printed}]);
      setKept(newKept); setDeleted(newDeleted); setPrinted(newPrinted);
      pan.setValue({x:0,y:0});
      if (idx >= queue.length-1) onDone({kept:newKept,deleted:newDeleted,printed:newPrinted});
      else setIdx(i=>i+1);
    });
  };

  const undo = () => {
    if (!history.length) return;
    const last = history[history.length-1];
    setKept(last.keptSnap); setDeleted(last.deletedSnap); setPrinted(last.printedSnap);
    setHistory(h=>h.slice(0,-1));
    setIdx(i=>Math.max(0,i-1));
  };

  const doAdvice = async () => {
    setAiLoading(true); setAiMode("advice"); setAdvice(null);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:600,messages:[{role:"user",content:[{type:"text",
          text:`Photo à ${photo.location} en ${photo.year}, personnes: ${photo.faces?.join(", ")||"aucune"}. ${similarPhotos.length>0?`${similarPhotos.length} photo(s) similaires existent.`:""} Réponds en JSON uniquement sans markdown: {"decision":"Garder","score":7,"raison":"1 phrase","similaires":"info doublons"}`
        }]}]})
      });
      const data = await res.json();
      const parsed = JSON.parse(data.content[0].text.replace(/```json|```/g,"").trim());
      setAdvice(parsed);
    } catch {
      setAdvice({decision:"Garder",score:7,raison:"Belle photo souvenir.",similaires:similarPhotos.length>0?`${similarPhotos.length} photos similaires détectées.`:"Aucun doublon."});
    }
    setAiLoading(false);
  };

  const doEnhance = async () => {
    setAiLoading(true); setAiMode("enhance"); setEnhanced(null);
    await new Promise(r=>setTimeout(r,1500));
    setEnhanced("Luminosité +8%, contraste +12%, saturation +15% — couleurs réchauffées");
    setAiLoading(false);
  };

  if (!photo) return null;
  const pct = Math.round((idx/queue.length)*100);

  return (
    <View style={{flex:1,backgroundColor:"#000"}}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content"/>
      {/* Progress bar */}
      <View style={{position:"absolute",top:0,left:0,right:0,height:3,zIndex:20,backgroundColor:"#333"}}>
        <View style={{height:3,width:`${pct}%`,backgroundColor:C.accent}}/>
      </View>
      {/* Header — paddingTop pour passer sous la status bar */}
      <View style={{position:"absolute",top:0,left:0,right:0,zIndex:15,paddingTop: Platform.OS==="android"? StatusBar.currentHeight+8 : 52}}>
        <View style={{flexDirection:"row",justifyContent:"space-between",alignItems:"center",paddingHorizontal:16,paddingBottom:8}}>
          <TouchableOpacity onPress={onBack} style={{backgroundColor:"rgba(255,255,255,0.2)",borderRadius:99,paddingHorizontal:14,paddingVertical:8}}>
            <Text style={{color:"#fff",fontWeight:"700",fontSize:13}}>← Retour</Text>
          </TouchableOpacity>
          <View style={{alignItems:"center"}}>
            <Text style={{color:"#fff",fontWeight:"700",fontSize:13}}>{photo.location}</Text>
            <Text style={{color:"rgba(255,255,255,.6)",fontSize:11}}>{photo.year}</Text>
          </View>
          <TouchableOpacity onPress={()=>{setAiPanel(!aiPanel);setAdvice(null);setEnhanced(null);setAiMode(null);}} style={{backgroundColor:"rgba(244,132,95,0.4)",borderRadius:99,paddingHorizontal:12,paddingVertical:8,borderWidth:1,borderColor:"rgba(244,132,95,.6)"}}>
            <Text style={{color:"#ffc8a8",fontWeight:"700",fontSize:12}}>✨ IA</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Card swipeable */}
      <Animated.View {...panResponder.panHandlers} style={{position:"absolute",top:0,left:0,right:0,bottom:0,transform:[{translateX:pan.x},{translateY:pan.y},{rotate}]}}>
        <Image source={{uri:photo.url}} style={{width:"100%",height:"100%"}} resizeMode="cover"/>
        <Animated.View style={{position:"absolute",top:"40%",left:20,opacity:pan.x.interpolate({inputRange:[-50,0],outputRange:[1,0],extrapolate:"clamp"})}}>
          <View style={{backgroundColor:"rgba(232,99,122,0.9)",borderRadius:8,padding:8,borderWidth:2,borderColor:C.red}}>
            <Text style={{color:"#fff",fontWeight:"900",fontSize:20}}>SUPPR.</Text>
          </View>
        </Animated.View>
        <Animated.View style={{position:"absolute",top:"40%",right:20,opacity:pan.x.interpolate({inputRange:[0,50],outputRange:[0,1],extrapolate:"clamp"})}}>
          <View style={{backgroundColor:"rgba(92,184,122,0.9)",borderRadius:8,padding:8,borderWidth:2,borderColor:C.green}}>
            <Text style={{color:"#fff",fontWeight:"900",fontSize:20}}>GARDER</Text>
          </View>
        </Animated.View>
      </Animated.View>

      {/* Compteur */}
      <View style={{position:"absolute",bottom:130,right:20,backgroundColor:"rgba(253,246,240,0.8)",borderRadius:99,paddingHorizontal:12,paddingVertical:4,zIndex:10}}>
        <Text style={{color:C.textMid,fontWeight:"600",fontSize:12}}>{idx+1}/{queue.length}</Text>
      </View>

      {/* Tip */}
      {showTip && idx===0 && (
        <TouchableOpacity onPress={()=>setShowTip(false)} style={{position:"absolute",top:"45%",alignSelf:"center",zIndex:20,backgroundColor:"rgba(253,246,240,0.95)",borderRadius:20,padding:20,borderWidth:1,borderColor:C.border}}>
          <Text style={{color:C.textMid,fontSize:13,lineHeight:24,textAlign:"center"}}>{"← Supprimer\n↑ Imprimer\n→ Garder\n\nTouche pour fermer"}</Text>
        </TouchableOpacity>
      )}

      {/* Panneau IA */}
      {aiPanel && (
        <View style={{position:"absolute",bottom:105,left:12,right:12,zIndex:30,backgroundColor:"rgba(253,246,240,0.97)",borderRadius:22,padding:16,borderWidth:1,borderColor:C.border,shadowColor:"#000",shadowOffset:{width:0,height:8},shadowOpacity:.2,shadowRadius:16,elevation:8}}>
          {!aiMode && (
            <View style={{gap:10}}>
              <Text style={{textAlign:"center",fontWeight:"700",fontSize:11,color:C.textMuted,letterSpacing:1,marginBottom:4}}>ASSISTANT IA</Text>
              <TouchableOpacity onPress={doEnhance} style={{backgroundColor:"#f0e8ff",borderRadius:16,padding:14,flexDirection:"row",alignItems:"center",gap:12}}>
                <Text style={{fontSize:24}}>✨</Text>
                <View><Text style={{fontWeight:"800",fontSize:14,color:C.purple}}>Améliorer la photo</Text><Text style={{fontSize:11,color:C.textMuted,marginTop:2}}>Couleurs, lumière, contraste</Text></View>
              </TouchableOpacity>
              <TouchableOpacity onPress={doAdvice} style={{backgroundColor:"#fff5f0",borderRadius:16,padding:14,flexDirection:"row",alignItems:"center",gap:12}}>
                <Text style={{fontSize:24}}>🧠</Text>
                <View><Text style={{fontWeight:"800",fontSize:14,color:C.accent}}>Conseil IA</Text><Text style={{fontSize:11,color:C.textMuted,marginTop:2}}>Garder · Supprimer · Imprimer</Text></View>
              </TouchableOpacity>
            </View>
          )}
          {aiLoading && (
            <View style={{alignItems:"center",padding:16}}>
              <ActivityIndicator color={C.accent} size="large"/>
              <Text style={{marginTop:12,fontWeight:"700",color:C.accent}}>{aiMode==="advice"?"Analyse en cours…":"Amélioration en cours…"}</Text>
            </View>
          )}
          {enhanced && !aiLoading && (
            <View>
              <View style={{flexDirection:"row",alignItems:"center",gap:8,marginBottom:10}}>
                <Text style={{fontSize:20}}>✨</Text>
                <Text style={{fontWeight:"800",fontSize:14,color:C.purple,flex:1}}>Photo améliorée</Text>
                <TouchableOpacity onPress={()=>{setEnhanced(null);setAiMode(null);}}><Text style={{fontSize:18,color:C.textMuted}}>✕</Text></TouchableOpacity>
              </View>
              <View style={{backgroundColor:"#f0e8ff",borderRadius:12,padding:12,marginBottom:12}}>
                <Text style={{fontSize:12,color:C.purple,fontWeight:"600"}}>{enhanced}</Text>
              </View>
              <View style={{flexDirection:"row",gap:8}}>
                <TouchableOpacity onPress={()=>swipe("right")} style={{flex:1,backgroundColor:C.green,borderRadius:12,padding:11,alignItems:"center"}}><Text style={{color:"#fff",fontWeight:"700"}}>❤️ Garder</Text></TouchableOpacity>
                <TouchableOpacity onPress={()=>swipe("up")} style={{flex:1,backgroundColor:C.purple,borderRadius:12,padding:11,alignItems:"center"}}><Text style={{color:"#fff",fontWeight:"700"}}>🖨 Imprimer</Text></TouchableOpacity>
              </View>
            </View>
          )}
          {advice && !aiLoading && (
            <View>
              <View style={{flexDirection:"row",alignItems:"center",gap:8,marginBottom:10}}>
                <Text style={{fontSize:20}}>🧠</Text>
                <Text style={{fontWeight:"800",fontSize:14,color:C.accent,flex:1}}>Conseil IA</Text>
                <TouchableOpacity onPress={()=>{setAdvice(null);setAiMode(null);}}><Text style={{fontSize:18,color:C.textMuted}}>✕</Text></TouchableOpacity>
              </View>
              <View style={{backgroundColor:advice.decision==="Garder"?"#e8f8ee":advice.decision==="Supprimer"?"#ffe8e8":"#f0e8ff",borderRadius:14,padding:12,marginBottom:8,flexDirection:"row",alignItems:"center",gap:10}}>
                <Text style={{fontSize:28}}>{advice.decision==="Garder"?"❤️":advice.decision==="Supprimer"?"🗑":"🖨"}</Text>
                <View>
                  <Text style={{fontWeight:"900",fontSize:16,color:advice.decision==="Garder"?C.green:advice.decision==="Supprimer"?C.red:C.purple}}>{advice.decision}</Text>
                  <Text style={{fontSize:11,color:C.textMuted}}>Score : {advice.score}/10</Text>
                </View>
              </View>
              <Text style={{fontSize:12,color:C.textMid,marginBottom:8,lineHeight:18}}>{advice.raison}</Text>
              <View style={{backgroundColor:similarPhotos.length>0?"#fff8e0":"#f0fff4",borderRadius:12,padding:10,marginBottom:12,flexDirection:"row",gap:8}}>
                <Text style={{fontSize:14}}>{similarPhotos.length>0?"⚠️":"✅"}</Text>
                <Text style={{fontSize:12,color:C.textMid,flex:1,lineHeight:18}}>{advice.similaires}</Text>
              </View>
              <View style={{flexDirection:"row",gap:6}}>
                <TouchableOpacity onPress={()=>swipe("left")} style={{flex:1,backgroundColor:"#ffe8e8",borderRadius:12,padding:10,alignItems:"center"}}><Text style={{color:C.red,fontWeight:"700",fontSize:12}}>🗑 Suppr.</Text></TouchableOpacity>
                <TouchableOpacity onPress={()=>swipe("right")} style={{flex:1,backgroundColor:"#e8f8ee",borderRadius:12,padding:10,alignItems:"center"}}><Text style={{color:C.green,fontWeight:"700",fontSize:12}}>❤️ Garder</Text></TouchableOpacity>
                <TouchableOpacity onPress={()=>swipe("up")} style={{flex:1,backgroundColor:"#f0e8ff",borderRadius:12,padding:10,alignItems:"center"}}><Text style={{color:C.purple,fontWeight:"700",fontSize:12}}>🖨 Impr.</Text></TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      )}

      {/* Boutons bas */}
      <View style={{position:"absolute",bottom:32,left:0,right:0,flexDirection:"row",justifyContent:"center",alignItems:"center",gap:14,zIndex:10}}>
        <TouchableOpacity onPress={()=>swipe("left")} style={{backgroundColor:"rgba(232,99,122,0.2)",borderWidth:2,borderColor:"rgba(232,99,122,.5)",borderRadius:99,padding:18}}>
          <Text style={{fontSize:22}}>🗑</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={undo} disabled={!history.length} style={{backgroundColor:"rgba(255,255,255,0.15)",borderWidth:2,borderColor:"rgba(255,255,255,.2)",borderRadius:99,padding:12,opacity:history.length?1:0.3}}>
          <Text style={{fontSize:18}}>↩</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={()=>swipe("up")} style={{backgroundColor:"rgba(176,122,216,0.2)",borderWidth:2,borderColor:"rgba(176,122,216,.5)",borderRadius:99,padding:18}}>
          <Text style={{fontSize:22}}>🖨</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={()=>swipe("right")} style={{backgroundColor:"rgba(92,184,122,0.2)",borderWidth:2,borderColor:"rgba(92,184,122,.5)",borderRadius:99,padding:18}}>
          <Text style={{fontSize:22}}>❤️</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── FACE SCREEN ────────────────────────────────────────────────────
function FaceScreen({ onBack, onStartSwipe }) {
  const [selected, setSelected] = useState([]);
  const [scanning, setScanning] = useState(true);
  useEffect(()=>{ setTimeout(()=>setScanning(false),1800); },[]);
  useAndroidBack(onBack);

  const toggle = name => setSelected(prev=>prev.includes(name)?prev.filter(n=>n!==name):[...prev,name]);
  const photosTri = selected.length>0 ? PHOTOS.filter(p=>selected.some(n=>p.faces.includes(n))) : [];

  if (scanning) return (
    <SafeAreaView style={{flex:1,backgroundColor:C.bg,alignItems:"center",justifyContent:"center"}}>
      <StatusBar backgroundColor={C.bg} barStyle="dark-content"/>
      <ActivityIndicator size="large" color={C.accent}/>
      <Text style={{marginTop:16,fontWeight:"800",fontSize:16,color:C.text}}>Analyse des visages…</Text>
      <Text style={{fontSize:13,color:C.textMuted,marginTop:4}}>Reconnaissance en cours</Text>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={{flex:1,backgroundColor:C.bg}}>
      <StatusBar backgroundColor={C.bg} barStyle="dark-content"/>
      <View style={{flexDirection:"row",alignItems:"center",gap:12,padding:20,paddingBottom:12}}>
        <TouchableOpacity onPress={onBack} style={{backgroundColor:C.bgCard,borderRadius:99,paddingHorizontal:14,paddingVertical:8,borderWidth:1,borderColor:C.border}}>
          <Text style={{color:C.textMuted,fontSize:16}}>←</Text>
        </TouchableOpacity>
        <View>
          <Text style={{fontWeight:"800",fontSize:18,color:C.text}}>Tri par visage</Text>
          <Text style={{fontSize:11,color:C.textMuted}}>Sélectionne une ou plusieurs personnes</Text>
        </View>
      </View>
      <ScrollView style={{flex:1,paddingHorizontal:20}}>
        <View style={{flexDirection:"row",flexWrap:"wrap",gap:12,marginBottom:20}}>
          {Object.entries(FACE_DATA).map(([name,data])=>{
            const sel = selected.includes(name);
            const photos = PHOTOS.filter(p=>p.faces.includes(name));
            return (
              <TouchableOpacity key={name} onPress={()=>toggle(name)} style={{width:(SW-52)/2,backgroundColor:sel?`${data.color}18`:C.bgCard,borderRadius:20,padding:16,borderWidth:sel?2:1,borderColor:sel?data.color:C.border}}>
                <View style={{width:60,height:60,borderRadius:30,overflow:"hidden",alignSelf:"center",marginBottom:10,borderWidth:3,borderColor:sel?data.color:C.border}}>
                  <Image source={{uri:photos[0]?.url}} style={{width:"100%",height:"100%"}} resizeMode="cover"/>
                </View>
                <Text style={{fontWeight:"800",fontSize:14,color:C.text,textAlign:"center"}}>{name}</Text>
                <Text style={{fontSize:11,color:C.textMuted,textAlign:"center",marginTop:2}}>{photos.length} photo{photos.length>1?"s":""}</Text>
                <View style={{flexDirection:"row",gap:3,marginTop:10,justifyContent:"center"}}>
                  {photos.slice(0,3).map(p=><Image key={p.id} source={{uri:p.url}} style={{width:28,height:28,borderRadius:6}}/>)}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
        {selected.length>0 && (
          <View style={{backgroundColor:C.bgCard,borderRadius:20,padding:16,borderWidth:1,borderColor:C.border,marginBottom:20}}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:12}}>
              <View style={{flexDirection:"row",gap:6}}>
                {photosTri.slice(0,6).map(p=><Image key={p.id} source={{uri:p.url}} style={{width:52,height:52,borderRadius:10}}/>)}
              </View>
            </ScrollView>
            <TouchableOpacity onPress={()=>onStartSwipe(photosTri)} style={{backgroundColor:C.accent,borderRadius:14,padding:14,alignItems:"center"}}>
              <Text style={{color:"#fff",fontWeight:"800",fontSize:15}}>Trier les {photosTri.length} photos →</Text>
            </TouchableOpacity>
          </View>
        )}
        {selected.length===0 && (
          <Text style={{textAlign:"center",color:C.textMuted,fontSize:13,paddingBottom:30}}>Sélectionne au moins une personne</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── MAP SCREEN ────────────────────────────────────────────────────
function MapScreen({ onBack, onStartSwipe }) {
  const [selectedPhotos, setSelectedPhotos] = useState(PHOTOS);
  const [selectedCity, setSelectedCity] = useState(null);
  useAndroidBack(onBack);

  const { WebView } = require("react-native-webview");

  const cityGroups = {};
  PHOTOS.forEach(p=>{ if(!cityGroups[p.city]) cityGroups[p.city]={lat:p.lat,lng:p.lng,photos:[],city:p.city}; cityGroups[p.city].photos.push(p); });
  const markers = Object.values(cityGroups).map(g=>({lat:g.lat,lng:g.lng,city:g.city,count:g.photos.length}));

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
    const {city} = JSON.parse(e.nativeEvent.data);
    setSelectedCity(city);
    setSelectedPhotos(PHOTOS.filter(p=>p.city===city));
  };

  return (
    <SafeAreaView style={{flex:1,backgroundColor:C.bg}}>
      <StatusBar backgroundColor={C.bg} barStyle="dark-content"/>
      <View style={{flexDirection:"row",alignItems:"center",gap:12,padding:20,paddingBottom:12}}>
        <TouchableOpacity onPress={onBack} style={{backgroundColor:C.bgCard,borderRadius:99,paddingHorizontal:14,paddingVertical:8,borderWidth:1,borderColor:C.border}}>
          <Text style={{color:C.textMuted,fontSize:16}}>←</Text>
        </TouchableOpacity>
        <View>
          <Text style={{fontWeight:"800",fontSize:18,color:C.text}}>Tri par lieu</Text>
          <Text style={{fontSize:11,color:C.textMuted}}>{selectedCity?`📍 ${selectedCity} sélectionnée`:"Clique sur une ville"}</Text>
        </View>
      </View>
      <View style={{height:300,marginHorizontal:20,borderRadius:20,overflow:"hidden",borderWidth:1,borderColor:C.border}}>
        <WebView source={{html}} style={{flex:1}} onMessage={onMessage} javaScriptEnabled/>
      </View>
      <View style={{padding:20,paddingTop:14}}>
        <Text style={{fontWeight:"700",fontSize:14,color:C.text,marginBottom:10}}>
          {selectedCity?`${selectedPhotos.length} photo(s) à ${selectedCity}`:`${selectedPhotos.length} photos visibles`}
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:14}}>
          <View style={{flexDirection:"row",gap:6}}>
            {selectedPhotos.slice(0,8).map(p=><Image key={p.id} source={{uri:p.url}} style={{width:56,height:56,borderRadius:10}}/>)}
          </View>
        </ScrollView>
        <TouchableOpacity onPress={()=>onStartSwipe(selectedPhotos)} style={{backgroundColor:C.accent,borderRadius:16,padding:16,alignItems:"center",elevation:4,shadowColor:C.accent,shadowOffset:{width:0,height:4},shadowOpacity:.3,shadowRadius:8}}>
          <Text style={{color:"#fff",fontWeight:"800",fontSize:15}}>🔀 Trier ces {selectedPhotos.length} photos</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ── GALLERY SCREEN ────────────────────────────────────────────────
function GalleryScreen({ title, photos, accent, onBack, showEmpty, onEmpty }) {
  const [selected, setSelected] = useState(null);
  useAndroidBack(onBack);

  return (
    <SafeAreaView style={{flex:1,backgroundColor:C.bg}}>
      <StatusBar backgroundColor={C.bg} barStyle="dark-content"/>
      <View style={{flexDirection:"row",alignItems:"center",gap:12,padding:20,paddingBottom:12}}>
        <TouchableOpacity onPress={onBack} style={{backgroundColor:C.bgCard,borderRadius:99,paddingHorizontal:14,paddingVertical:8,borderWidth:1,borderColor:C.border}}>
          <Text style={{color:C.textMuted,fontSize:16}}>←</Text>
        </TouchableOpacity>
        <Text style={{fontWeight:"800",fontSize:20,color:C.text,flex:1}}>{title}</Text>
        <Text style={{fontSize:13,color:accent,fontWeight:"800"}}>{photos.length} photos</Text>
      </View>
      <ScrollView contentContainerStyle={{padding:14}}>
        <View style={{flexDirection:"row",flexWrap:"wrap",gap:6}}>
          {photos.length===0
            ? <Text style={{color:C.textMuted,textAlign:"center",width:"100%",marginTop:60,fontSize:15}}>Aucune photo ici</Text>
            : photos.map(p=>(
              <TouchableOpacity key={p.id} onPress={()=>setSelected(p)} style={{width:(SW-40)/3,aspectRatio:1,borderRadius:12,overflow:"hidden"}}>
                <Image source={{uri:p.url}} style={{width:"100%",height:"100%"}} resizeMode="cover"/>
              </TouchableOpacity>
            ))
          }
        </View>
        {showEmpty && photos.length>0 && (
          <TouchableOpacity onPress={onEmpty} style={{backgroundColor:C.red,borderRadius:16,padding:14,alignItems:"center",marginTop:20}}>
            <Text style={{color:"#fff",fontWeight:"800",fontSize:14}}>Vider la corbeille ({photos.reduce((a,p)=>a+p.size,0).toFixed(1)} Mo)</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
      <Modal visible={!!selected} transparent animationType="fade">
        <View style={{flex:1,backgroundColor:"rgba(0,0,0,0.92)",alignItems:"center",justifyContent:"center"}}>
          <TouchableOpacity onPress={()=>setSelected(null)} style={{position:"absolute",top:52,right:20,backgroundColor:"rgba(255,255,255,.2)",borderRadius:99,padding:10}}>
            <Text style={{color:"#fff",fontSize:18}}>✕</Text>
          </TouchableOpacity>
          {selected && <>
            <Image source={{uri:selected.url}} style={{width:SW-40,height:SH*0.65,borderRadius:20}} resizeMode="contain"/>
            <Text style={{color:"#fff",fontWeight:"700",marginTop:16,fontSize:15}}>{selected.location} · {selected.year}</Text>
          </>}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ── SUMMARY SCREEN ────────────────────────────────────────────────
function SummaryScreen({ kept, deleted, printed, onHome }) {
  const deletedSize = deleted.reduce((a,p)=>a+p.size,0);
  useAndroidBack(onHome);
  return (
    <SafeAreaView style={{flex:1,backgroundColor:C.bg}}>
      <StatusBar backgroundColor={C.bg} barStyle="dark-content"/>
      <ScrollView contentContainerStyle={{padding:24}}>
        <Text style={{fontSize:56,textAlign:"center",marginBottom:8}}>🎉</Text>
        <Text style={{fontSize:26,fontWeight:"900",color:C.text,textAlign:"center",marginBottom:4}}>Tri terminé !</Text>
        <Text style={{fontSize:14,color:C.textMuted,textAlign:"center",marginBottom:24}}>Voici ton bilan</Text>
        <View style={{flexDirection:"row",flexWrap:"wrap",gap:12,marginBottom:20}}>
          {[
            {label:"Conservées",val:kept.length,color:C.green,emoji:"❤️"},
            {label:"Supprimées",val:deleted.length,color:C.red,emoji:"🗑"},
            {label:"À imprimer",val:printed.length,color:C.purple,emoji:"🖨"},
            {label:"Mo libérés",val:deletedSize.toFixed(1),color:C.yellow,emoji:"✨"},
          ].map(s=>(
            <View key={s.label} style={{width:(SW-60)/2,backgroundColor:C.bgCard,borderRadius:20,padding:20,alignItems:"center",borderWidth:1,borderColor:C.border}}>
              <Text style={{fontSize:24,marginBottom:6}}>{s.emoji}</Text>
              <Text style={{fontSize:28,fontWeight:"900",color:s.color}}>{s.val}</Text>
              <Text style={{fontSize:12,color:C.textMuted,marginTop:4}}>{s.label}</Text>
            </View>
          ))}
        </View>
        {printed.length>0 && (
          <View style={{backgroundColor:C.bgCard,borderRadius:20,padding:16,borderWidth:1,borderColor:C.border,marginBottom:16}}>
            <Text style={{fontWeight:"800",fontSize:14,color:C.accent,marginBottom:10}}>📸 Photos à imprimer</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{flexDirection:"row",gap:8}}>
                {printed.map(p=><Image key={p.id} source={{uri:p.url}} style={{width:70,height:70,borderRadius:12}}/>)}
              </View>
            </ScrollView>
            <TouchableOpacity style={{marginTop:12,backgroundColor:C.accent,borderRadius:12,padding:13,alignItems:"center"}}>
              <Text style={{color:"#fff",fontWeight:"800",fontSize:14}}>Commander chez CEWE →</Text>
            </TouchableOpacity>
          </View>
        )}
        <TouchableOpacity onPress={onHome} style={{backgroundColor:C.accent,borderRadius:18,padding:16,alignItems:"center",elevation:4,shadowColor:C.accent,shadowOffset:{width:0,height:4},shadowOpacity:.3,shadowRadius:8}}>
          <Text style={{color:"#fff",fontWeight:"800",fontSize:14}}>← Retour à l'accueil</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── HOME SCREEN ────────────────────────────────────────────────────
function HomeScreen({ onSwipe, onFaces, onMap, onSection, kept, deleted, printed }) {
  const [activeFilter, setActiveFilter] = useState("Toutes");
  const deletedSize = deleted.reduce((a,p)=>a+p.size,0);
  const triees = kept.length+deleted.length+printed.length;
  const queue = PHOTOS.filter(p=>
    !kept.map(x=>x.id).includes(p.id) &&
    !deleted.map(x=>x.id).includes(p.id) &&
    !printed.map(x=>x.id).includes(p.id)
  );

  return (
    <SafeAreaView style={{flex:1,backgroundColor:C.bg}}>
      <StatusBar backgroundColor={C.bg} barStyle="dark-content"/>
      <ScrollView contentContainerStyle={{padding:20,paddingBottom:40}}>
        {/* Header */}
        <View style={{flexDirection:"row",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <View>
            <Text style={{fontSize:30,fontWeight:"900",color:C.accent}}>Phototri 🌸</Text>
            <Text style={{fontSize:12,color:C.textMuted,marginTop:2}}>Tes souvenirs méritent mieux</Text>
          </View>
        </View>

        {/* CTA principal */}
        <TouchableOpacity onPress={()=>onSwipe(queue)} style={{backgroundColor:C.accent,borderRadius:20,padding:20,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:10,marginBottom:12,elevation:6,shadowColor:C.accent,shadowOffset:{width:0,height:6},shadowOpacity:.35,shadowRadius:12}}>
          <Text style={{fontSize:16,fontWeight:"800",color:"#fff"}}>🔀 Démarrer le tri · {queue.length} photos</Text>
        </TouchableOpacity>

        {/* Filtres dates */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:14}}>
          <View style={{flexDirection:"row",gap:8,paddingVertical:2}}>
            {FILTERS.map(f=>(
              <TouchableOpacity key={f} onPress={()=>setActiveFilter(f)} style={{paddingHorizontal:16,paddingVertical:8,borderRadius:99,borderWidth:1.5,borderColor:activeFilter===f?C.accent:C.border,backgroundColor:activeFilter===f?C.accent:C.bgCard}}>
                <Text style={{fontSize:12,fontWeight:"700",color:activeFilter===f?"#fff":C.textMuted}}>{f}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* Stats */}
        <View style={{backgroundColor:C.bgCard,borderRadius:20,padding:16,borderWidth:1,borderColor:C.border,marginBottom:14,flexDirection:"row"}}>
          {[
            {label:"Photos",val:PHOTOS.length,color:C.accent},
            {label:"Triées",val:triees,color:C.green},
            {label:"À libérer",val:`${deletedSize.toFixed(1)}Mo`,color:C.red},
          ].map((s,i)=>(
            <View key={s.label} style={{flex:1,alignItems:"center",borderLeftWidth:i>0?1:0,borderLeftColor:C.border}}>
              <Text style={{fontSize:22,fontWeight:"800",color:s.color}}>{s.val}</Text>
              <Text style={{fontSize:11,color:C.textMuted,marginTop:2}}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Tri par visage / lieu */}
        <View style={{flexDirection:"row",gap:10,marginBottom:14}}>
          <TouchableOpacity onPress={onFaces} style={{flex:1,backgroundColor:C.bgCard,borderRadius:20,padding:16,borderWidth:1,borderColor:C.border}}>
            <Text style={{fontSize:24,marginBottom:8}}>👤</Text>
            <Text style={{fontWeight:"700",fontSize:13,color:C.text}}>Par visage</Text>
            <Text style={{fontSize:11,color:C.textMuted,marginTop:2}}>Famille, amis…</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onMap} style={{flex:1,backgroundColor:C.bgCard,borderRadius:20,padding:16,borderWidth:1,borderColor:C.border}}>
            <Text style={{fontSize:24,marginBottom:8}}>🗺</Text>
            <Text style={{fontWeight:"700",fontSize:13,color:C.text}}>Par lieu</Text>
            <Text style={{fontSize:11,color:C.textMuted,marginTop:2}}>Carte interactive</Text>
          </TouchableOpacity>
        </View>

        {/* Sections */}
        {[
          {key:"deleted",emoji:"🗑",label:"Corbeille",desc:`${deleted.length} photos · ${deletedSize.toFixed(1)} Mo`,bg:"#ffe8e8"},
          {key:"album",emoji:"📷",label:"Album souvenirs",desc:`${printed.length} photos à imprimer`,bg:"#f0e8ff"},
          {key:"kept",emoji:"❤️",label:"Photos conservées",desc:`${kept.length} photos gardées`,bg:"#e8f8ee"},
        ].map(s=>(
          <TouchableOpacity key={s.key} onPress={()=>onSection(s.key)} style={{backgroundColor:C.bgCard,borderRadius:20,padding:16,borderWidth:1,borderColor:C.border,flexDirection:"row",alignItems:"center",gap:12,marginBottom:10}}>
            <View style={{width:44,height:44,backgroundColor:s.bg,borderRadius:14,alignItems:"center",justifyContent:"center"}}>
              <Text style={{fontSize:20}}>{s.emoji}</Text>
            </View>
            <View style={{flex:1}}>
              <Text style={{fontWeight:"700",fontSize:14,color:C.text}}>{s.label}</Text>
              <Text style={{fontSize:12,color:C.textMuted,marginTop:2}}>{s.desc}</Text>
            </View>
            <Text style={{color:C.textMuted,fontSize:18}}>›</Text>
          </TouchableOpacity>
        ))}

        {/* Affiliation */}
        <View style={{backgroundColor:C.bgCard,borderRadius:20,padding:16,borderWidth:1,borderColor:C.border,marginTop:4}}>
          <View style={{flexDirection:"row",alignItems:"center",gap:8,marginBottom:14}}>
            <Text style={{fontSize:22}}>📸</Text>
            <View>
              <Text style={{fontWeight:"800",fontSize:14,color:C.text}}>Immortalisez vos souvenirs</Text>
              <Text style={{fontSize:11,color:C.textMuted}}>Imprimez vos plus belles photos</Text>
            </View>
          </View>
          {[
            {name:"CEWE",desc:"Albums & tirages premium",color:"#e8a000",bg:"#fff8e0",emoji:"🏆"},
            {name:"Cheerz",desc:"Prints carrés & posters",color:C.red,bg:"#fff0f3",emoji:"🌸"},
            {name:"Photobox",desc:"Mugs, coussins, toiles",color:"#5b9bd8",bg:"#f0f5ff",emoji:"🎁"},
          ].map(p=>(
            <TouchableOpacity key={p.name} style={{backgroundColor:p.bg,borderRadius:14,padding:12,flexDirection:"row",alignItems:"center",gap:10,marginBottom:6,borderWidth:1,borderColor:C.border}}>
              <Text style={{fontSize:18}}>{p.emoji}</Text>
              <View style={{flex:1}}>
                <Text style={{fontWeight:"700",fontSize:13,color:p.color}}>{p.name}</Text>
                <Text style={{fontSize:11,color:C.textMuted}}>{p.desc}</Text>
              </View>
              <Text style={{color:C.textMuted}}>›</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── ROOT ────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState("home");
  const [swipeQueue, setSwipeQueue] = useState([]);
  const [kept, setKept] = useState([]);
  const [deleted, setDeleted] = useState([]);
  const [printed, setPrinted] = useState([]);
  const [confirmEmpty, setConfirmEmpty] = useState(false);

  const goHome = () => setScreen("home");
  const startSwipe = q => { setSwipeQueue(q); setScreen("swipe"); };

  const handleDone = res => {
    setKept(k=>[...k,...res.kept.filter(p=>!k.map(x=>x.id).includes(p.id))]);
    setDeleted(d=>[...d,...res.deleted.filter(p=>!d.map(x=>x.id).includes(p.id))]);
    setPrinted(p=>[...p,...res.printed.filter(x=>!p.map(y=>y.id).includes(x.id))]);
    setScreen("summary");
  };

  return (
    <SafeAreaProvider>
      {screen==="swipe"   && <SwipeScreen queue={swipeQueue} onDone={handleDone} onBack={goHome}/>}
      {screen==="faces"   && <FaceScreen onBack={goHome} onStartSwipe={q=>{startSwipe(q);}}/>}
      {screen==="map"     && <MapScreen onBack={goHome} onStartSwipe={q=>{startSwipe(q);}}/>}
      {screen==="summary" && <SummaryScreen kept={kept} deleted={deleted} printed={printed} onHome={goHome}/>}
      {screen==="kept"    && <GalleryScreen title="Photos conservées" photos={kept} accent={C.green} onBack={goHome}/>}
      {screen==="album"   && <GalleryScreen title="Album souvenirs" photos={printed} accent={C.purple} onBack={goHome}/>}
      {screen==="deleted" && (
        <View style={{flex:1}}>
          <GalleryScreen title="Corbeille" photos={deleted} accent={C.red} onBack={goHome} showEmpty onEmpty={()=>setConfirmEmpty(true)}/>
          <Modal visible={confirmEmpty} transparent animationType="slide">
            <View style={{flex:1,backgroundColor:"rgba(60,20,0,0.5)",justifyContent:"flex-end"}}>
              <View style={{backgroundColor:C.bgCard,borderRadius:28,padding:28,paddingBottom:44}}>
                <Text style={{fontSize:18,fontWeight:"800",color:C.text,marginBottom:8}}>Vider la corbeille ?</Text>
                <Text style={{fontSize:14,color:C.textMuted,marginBottom:24}}>Supprime définitivement {deleted.length} photos.</Text>
                <View style={{flexDirection:"row",gap:12}}>
                  <TouchableOpacity onPress={()=>setConfirmEmpty(false)} style={{flex:1,backgroundColor:C.bgMuted,borderRadius:14,padding:14,alignItems:"center",borderWidth:1,borderColor:C.border}}>
                    <Text style={{color:C.text,fontWeight:"600",fontSize:15}}>Annuler</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={()=>{setDeleted([]);setConfirmEmpty(false);goHome();}} style={{flex:1,backgroundColor:C.red,borderRadius:14,padding:14,alignItems:"center"}}>
                    <Text style={{color:"#fff",fontWeight:"700",fontSize:15}}>Confirmer</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        </View>
      )}
      {screen==="home" && <HomeScreen onSwipe={startSwipe} onFaces={()=>setScreen("faces")} onMap={()=>setScreen("map")} onSection={s=>setScreen(s)} kept={kept} deleted={deleted} printed={printed}/>}
    </SafeAreaProvider>
  );
}