// components/AddressInput.js
// Champ « adresse » avec suggestions pendant la frappe (comme sur les sites de livraison).
// - dès 3 caractères, propose jusqu'à 5 adresses (services/addressSearch.js) ; toucher une ligne remplit le champ
// - adresse introuvable ou recherche indisponible : on garde ce que l'utilisateur a tapé (saisie manuelle OK)
// Le parent garde la valeur : <AddressInput value={adresse} onChange={setAdresse} />

import { useEffect, useRef, useState } from "react";
import { View, TextInput, TouchableOpacity, ActivityIndicator } from "react-native";
import Text from "./AppText";
import { C, FONT } from "../constants/theme";
import { searchAddress, MIN_CHARS } from "../services/addressSearch";

export default function AddressInput({ value, onChange, placeholder, editable = true }) {
  const [suggestions, setSuggestions] = useState([]);
  const [status, setStatus] = useState("idle"); // idle | loading | found | none | error | picked
  const timer = useRef(null);
  const abort = useRef(null);
  const reqId = useRef(0);        // numéro de la dernière frappe : une réponse trop vieille est ignorée

  // Nettoyage à la fermeture de l'écran.
  useEffect(() => () => { reqId.current++; clearTimeout(timer.current); abort.current?.abort(); }, []);

  function onText(text) {
    onChange(text);
    clearTimeout(timer.current);
    abort.current?.abort();
    const my = ++reqId.current;
    if (text.trim().length < MIN_CHARS) { setSuggestions([]); setStatus("idle"); return; }
    setStatus("loading");
    // Petite attente après la dernière touche : une requête par pause, pas par lettre.
    timer.current = setTimeout(async () => {
      const ctl = new AbortController();
      abort.current = ctl;
      try {
        const list = await searchAddress(text, ctl.signal);
        if (my !== reqId.current) return; // l'utilisateur a retapé entre-temps
        setSuggestions(list);
        setStatus(list.length ? "found" : "none");
      } catch (e) {
        if (my !== reqId.current) return;
        setSuggestions([]);
        setStatus("error");
      }
    }, 350);
  }

  function pick(s) {
    reqId.current++; // ignore une recherche encore en vol
    onChange(s.label); // appelé directement : pas de nouvelle recherche (onChangeText ne se déclenche qu'à la frappe)
    setSuggestions([]);
    setStatus("picked");
  }

  const hint =
    status === "none"  ? "Adresse introuvable ? Pas de souci : on gardera ce que tu as écrit." :
    status === "error" ? "Recherche indisponible : saisis l'adresse à la main." :
    null;

  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <TextInput
          value={value}
          onChangeText={onText}
          editable={editable}
          placeholder={placeholder}
          placeholderTextColor={C.textMuted}
          autoCorrect={false}
          autoComplete="street-address"
          textContentType="fullStreetAddress"
          returnKeyType="done"
          style={{ flex: 1, fontSize: 13.5, fontWeight: "500", color: C.text, fontFamily: FONT, paddingVertical: 2, marginTop: 1 }}
        />
        {status === "loading" && <ActivityIndicator size="small" color={C.textMuted} />}
        {status === "picked" && <Text style={{ fontSize: 11, fontWeight: "700", color: C.accent }}>✓ trouvée</Text>}
      </View>

      {suggestions.length > 0 && (
        <View style={{ marginTop: 6, borderTopWidth: 1, borderTopColor: C.border }}>
          {suggestions.map((s) => (
            <TouchableOpacity key={s.id} onPress={() => pick(s)} activeOpacity={0.7}
              style={{ paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: C.border }}>
              <Text style={{ fontSize: 13, color: C.text }}>{s.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {!!hint && <Text style={{ fontSize: 11, color: C.textMuted, marginTop: 6, lineHeight: 15 }}>{hint}</Text>}
    </View>
  );
}
