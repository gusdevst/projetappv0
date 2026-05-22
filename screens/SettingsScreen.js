//─────────────────────────────────────────────
// screens/SettingsScreen.js
// ─────────────────────────────────────────────
import { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, Modal, StatusBar, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { C, S } from "../constants/theme";
import { Toggle } from "../components/Toggle";
import { RowSetting } from "../components/RowSetting";

export function SettingsScreen({ navigation }) {
  const [notifWeekly,  setNotifWeekly]  = useState(true);
  const [notifMonthly, setNotifMonthly] = useState(false);
  const [autoDelete,   setAutoDelete]   = useState(false);
  const [aiEnabled,    setAiEnabled]    = useState(true);
  const [showPremium,  setShowPremium]  = useState(false);

  const Section = ({ title }) => (
    <Text style={{ fontSize: 11, fontWeight: "800", color: C.textMuted, letterSpacing: 1.5, marginTop: 24, marginBottom: 10, textTransform: "uppercase" }}>{title}</Text>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar backgroundColor={C.bg} barStyle="dark-content" />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: S.pad, paddingBottom: 8 }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ backgroundColor: C.bgCard, borderRadius: S.radiusFull, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: C.border }}>
          <Text style={{ color: C.textMuted, fontSize: 16 }}>←</Text>
        </TouchableOpacity>
        <Text style={{ fontWeight: "900", fontSize: 22, color: C.text }}>Paramètres</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: S.pad, paddingBottom: 40 }}>
        {/* Banner Premium */}
        <TouchableOpacity onPress={() => setShowPremium(true)} style={{ backgroundColor: C.accent, borderRadius: S.radius, padding: 18, marginTop: 8, marginBottom: 4, flexDirection: "row", alignItems: "center", gap: 14, elevation: 4 }}>
          <Text style={{ fontSize: 32 }}>⭐</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: "900", fontSize: 16, color: "#fff" }}>Phototri Premium</Text>
            <Text style={{ fontSize: 12, color: "rgba(255,255,255,.8)", marginTop: 2 }}>IA illimitée · Albums HD · Sans pub</Text>
          </View>
          <View style={{ backgroundColor: "rgba(255,255,255,.25)", borderRadius: S.radiusFull, paddingHorizontal: 12, paddingVertical: 6 }}>
            <Text style={{ color: "#fff", fontWeight: "800", fontSize: 12 }}>2,99 €/mois</Text>
          </View>
        </TouchableOpacity>

        <Section title="Notifications" />
        <RowSetting emoji="🔔" label="Rappel hebdomadaire" desc="Trier ses photos chaque semaine" right={<Toggle value={notifWeekly} onToggle={() => setNotifWeekly(v => !v)} />} />
        <RowSetting emoji="📅" label="Bilan mensuel" desc="Résumé de l'espace libéré" right={<Toggle value={notifMonthly} onToggle={() => setNotifMonthly(v => !v)} />} />

        <Section title="Tri & stockage" />
        <RowSetting emoji="🗑" label="Suppression automatique" desc="Vider la corbeille après 30 jours" right={<Toggle value={autoDelete} onToggle={() => setAutoDelete(v => !v)} />} />
        <RowSetting emoji="🧠" label="Assistant IA" desc="Conseil et amélioration photo" right={<Toggle value={aiEnabled} onToggle={() => setAiEnabled(v => !v)} />} />

        {/* Section "Impression" masquée pour le MVP — réactivation quand un vrai partenaire sera intégré */}

        <Section title="Compte" />
        <RowSetting emoji="📊" label="Mes statistiques" desc="Espace libéré depuis l'installation" onPress={() => {}} right={<Text style={{ color: C.textMuted }}>›</Text>} />
        <RowSetting emoji="🌍" label="Langue" desc="Français" onPress={() => {}} right={<Text style={{ color: C.textMuted }}>›</Text>} />
        <RowSetting emoji="💬" label="Nous contacter" desc="Support & feedback" onPress={() => {}} right={<Text style={{ color: C.textMuted }}>›</Text>} />
        <RowSetting emoji="⭐" label="Noter l'app" desc="5 étoiles ça aide vraiment 🙏" onPress={() => {}} right={<Text style={{ color: C.textMuted }}>›</Text>} />
        <RowSetting emoji="🔒" label="Politique de confidentialité" onPress={() => {}} right={<Text style={{ color: C.textMuted }}>›</Text>} />

        <Text style={{ textAlign: "center", color: C.textMuted, fontSize: 11, marginTop: 24 }}>Phototri v1.0.0 · Fait avec 🌸 en France</Text>
      </ScrollView>

      {/* Modal Premium */}
      <Modal visible={showPremium} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: "rgba(60,20,0,0.5)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: C.bgCard, borderRadius: S.radiusLg, padding: S.padLg, paddingBottom: 44 }}>
            <Text style={{ fontSize: 28, textAlign: "center", marginBottom: 8 }}>⭐</Text>
            <Text style={{ fontSize: 22, fontWeight: "900", color: C.text, textAlign: "center", marginBottom: 4 }}>Phototri Premium</Text>
            <Text style={{ fontSize: 14, color: C.textMuted, textAlign: "center", marginBottom: 24 }}>Essai gratuit 7 jours, puis 2,99 €/mois</Text>
            {[
              { emoji: "🧠", label: "IA illimitée",      desc: "Conseils et améliorations sans limite" },
              { emoji: "📸", label: "Albums HD",          desc: "Export haute résolution" },
              { emoji: "🚫", label: "Sans publicité",     desc: "Expérience 100% propre" },
              { emoji: "⚡", label: "Priorité support",   desc: "Réponse en moins de 24h" },
            ].map(f => (
              <View key={f.label} style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 }}>
                <Text style={{ fontSize: 22 }}>{f.emoji}</Text>
                <View>
                  <Text style={{ fontWeight: "700", fontSize: 14, color: C.text }}>{f.label}</Text>
                  <Text style={{ fontSize: 12, color: C.textMuted }}>{f.desc}</Text>
                </View>
              </View>
            ))}
            <TouchableOpacity
              onPress={() => {
                setShowPremium(false);
                Alert.alert("Bientôt disponible", "Phototri Premium arrive bientôt 🌸 Merci de ton intérêt — on te tient au courant !");
              }}
              style={{ backgroundColor: C.accent, borderRadius: S.radius, padding: 16, alignItems: "center", marginTop: 8, elevation: 4 }}
            >
              <Text style={{ color: "#fff", fontWeight: "900", fontSize: 16 }}>Commencer l'essai gratuit</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowPremium(false)} style={{ marginTop: 14, alignItems: "center" }}>
              <Text style={{ color: C.textMuted, fontSize: 14 }}>Non merci</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}