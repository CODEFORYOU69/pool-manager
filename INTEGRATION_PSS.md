# Intégration PSS → Taekwondo Tournament Manager

Ce document explique comment configurer la console PSS (Daedo) ou tout système tiers (ex: `andco-sys`) pour envoyer automatiquement les résultats de combats à l'application **Taekwondo Tournament Manager**.

---

## Vue d'ensemble

```
┌──────────────────┐      HTTP POST       ┌──────────────────────────────┐
│   Console PSS    │  ──────────────────▶ │  Taekwondo Tournament Mgr    │
│   (envoi)        │  X-API-Key + JSON    │  http://<host>:3001          │
└──────────────────┘                      │  → SQLite local              │
                                          │  → sync auto vers Neon       │
                                          │  → visible dans spectator    │
                                          └──────────────────────────────┘
```

L'application reçoit les résultats en **HTTP REST** (pas de WebSocket nécessaire) et les écrit dans SQLite local, puis synchronise vers Neon pour que le spectator les voit en temps réel.

---

## 1. Pré-requis côté organisateur

### 1.1 Récupérer les informations à donner au collègue

Trois informations à transmettre :

| Info | Où la trouver |
|---|---|
| **URL de base** | Onglet **Clés API** sur la compétition → liste des IPs LAN détectées |
| **Clé API** | Bouton **Clés API** → **Générer une clé** → copier la valeur affichée |
| **Format JSON** | Voir section 3 ci-dessous |

### 1.2 Autoriser les connexions entrantes (macOS)

Au premier lancement de l'app, macOS demande "Accepter les connexions entrantes ?" → **Autoriser**.

Si tu as cliqué Refuser par erreur :
- **Préférences Système** → **Réseau** → **Pare-feu** → **Options du pare-feu**
- Vérifier que l'app **Taekwondo Tournament Manager** est sur **Autoriser les connexions entrantes**

### 1.3 Vérifier que l'API tourne

L'app Electron lance automatiquement le serveur Express sur le port **3001** au démarrage. Pour vérifier depuis ta machine :

```bash
curl http://localhost:3001/api/health
# → {"status":"ok"}
```

---

## 2. Configuration réseau (3 scénarios)

### Scénario A — Wi-Fi de la salle (le plus courant)

Les deux machines sur le même SSID.

1. Sur ton Mac, récupère ton IP locale dans l'onglet **Clés API** (priorité aux IPs RFC1918 : `192.168.x.x` ou `10.x.x.x`).
2. Le collègue configure son outil PSS avec : `http://192.168.x.x:3001`

⚠️ Si le routeur attribue une IP dynamique qui change, préfère le hostname Bonjour :
```
http://<tonhostname>.local:3001
```
Le hostname est aussi affiché dans l'onglet Clés API. Marche depuis Windows si Bonjour Print Services / iTunes est installé.

### Scénario B — Pas de Wi-Fi → câble Ethernet direct

Brancher un câble Ethernet entre les deux machines, puis configurer des IPs statiques :

**Mac (toi) :**
- Préférences Système → Réseau → Ethernet
- Configurer IPv4 : Manuellement
- Adresse IP : `192.168.50.1`
- Masque : `255.255.255.0`
- Routeur : laisser vide

**Windows (collègue) :**
- Panneau de configuration → Centre Réseau et partage → Modifier les paramètres de la carte
- Clic droit sur la carte Ethernet → Propriétés → Protocole Internet version 4 (TCP/IPv4)
- Utiliser l'adresse IP suivante : `192.168.50.2`
- Masque : `255.255.255.0`
- Passerelle : laisser vide

**Test depuis le Windows :**
```cmd
ping 192.168.50.1
```

Le collègue pointe son outil sur : `http://192.168.50.1:3001`

### Scénario C — À distance (tu n'es pas sur place)

Le LAN ne marche pas. Trois options :

1. **Cloudflare Tunnel** (gratuit) : expose `localhost:3001` derrière une URL `https://*.trycloudflare.com`.
2. **ngrok** : `ngrok http 3001` → URL publique HTTPS.
3. **VPN** (Tailscale, WireGuard) : les deux machines sur le même réseau privé.

Plus fragile : préférer A ou B le jour de la compétition.

---

## 3. Format des requêtes

### Endpoint

```
POST http://<host>:3001/api/live/results
Content-Type: application/json
X-API-Key: <clé générée dans l'app>
```

### Body JSON

```json
{
  "matchNumber": 42,
  "redScore": 18,
  "blueScore": 12,
  "winner": "red",
  "rounds": [
    { "redScore": 6, "blueScore": 4 },
    { "redScore": 12, "blueScore": 8 }
  ],
  "endedAt": "2026-05-23T14:32:11.000Z"
}
```

Champs minimaux requis : `matchNumber`, `redScore`, `blueScore`, `winner` (`"red"` ou `"blue"`).

### Réponses

- `200 OK` → match enregistré + sync Neon déclenchée
- `401 Unauthorized` → clé API absente ou invalide
- `404 Not Found` → `matchNumber` inconnu pour cette compétition
- `409 Conflict` → match déjà clôturé (résultat ne peut pas être réécrit)

---

## 4. Test rapide avec curl

Depuis la machine émettrice, vérifier que tout passe :

```bash
# 1. Health check (pas besoin de clé)
curl http://192.168.x.x:3001/api/health

# 2. Envoi d'un résultat de test
curl -X POST http://192.168.x.x:3001/api/live/results \
  -H "Content-Type: application/json" \
  -H "X-API-Key: TA_CLE_API_ICI" \
  -d '{
    "matchNumber": 1,
    "redScore": 10,
    "blueScore": 5,
    "winner": "red"
  }'
```

Côté organisateur, le match doit apparaître mis à jour dans le planning et dans le spectator (après quelques secondes pour la sync Neon).

---

## 5. Dépannage

| Symptôme | Cause probable | Solution |
|---|---|---|
| `curl: Connection refused` | App pas lancée ou port pas ouvert | Lancer l'app, vérifier le pare-feu macOS |
| `Connection timed out` | Mauvais réseau / pare-feu Windows | Tester `ping <ip>` d'abord |
| `401 Unauthorized` | Clé manquante ou mauvaise | Recopier la clé depuis l'onglet Clés API |
| `404 matchNumber` | Numéro de combat inexistant | Vérifier que les combats ont bien été générés et numérotés |
| `409 Conflict` | Match déjà fini | Normal — un résultat ne se réécrit pas automatiquement |
| Résultat reçu mais pas dans spectator | Sync Neon échoue | Vérifier la connexion Internet côté organisateur |

---

## 6. Bonnes pratiques le jour J

1. **Tester la chaîne 30 min avant le début** avec un faux résultat sur le combat n°1.
2. **Garder une clé API par compétition** (ne pas réutiliser entre événements).
3. **Noter l'IP / hostname** sur un papier au cas où le DHCP renouvelle pendant l'événement.
4. **Câble Ethernet en backup** si la salle a un Wi-Fi peu fiable.
5. **Si tu perds la connexion** entre les deux machines, les résultats restent en attente côté PSS — il suffit de relancer dès que le lien revient.

---

## Annexe — Pourquoi pas de WebSocket ?

La PSS Daedo (et `andco-sys` qui s'interface avec) parle **HTTP REST**, pas WebSocket. Un WebSocket serait pertinent uniquement pour pousser les mises à jour du serveur vers le **spectator** (afficher le score en live sans polling) — ce qui n'est pas implémenté actuellement, mais le spectator fonctionne très bien via Neon en HTTP.
