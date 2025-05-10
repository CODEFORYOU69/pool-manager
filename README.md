# Taekwondo Tournament Manager - Vue Spectateur

Ce projet fournit une solution pour permettre aux spectateurs et coaches de suivre les tournois de taekwondo en temps réel. Il utilise une approche de Change Data Capture (CDC) pour synchroniser les données entre la base de données locale de l'application principale et une base de données distante utilisée par l'application spectateur.

## Architecture

Le projet est composé de trois parties principales :

1. **Scripts SQL CDC** - Pour capturer les changements dans la base de données
2. **Service de synchronisation** - Pour répliquer les changements vers la base de données distante
3. **Application Next.js** - Pour afficher les informations du tournoi aux spectateurs

### Avantages de l'approche CDC

- Pas de dépendance à ngrok ou autres services de tunneling
- Synchronisation automatique et en temps réel
- Permet de déployer l'application spectateur sur un service comme Vercel
- Faible impact sur les performances de l'application principale

## Installation et Configuration

### 1. Base de données locale (MySQL/PostgreSQL)

1. Exécuter le script SQL pour configurer les triggers CDC :

```bash
psql -d taekwondo_db -f db/sync-triggers.sql
```

### 2. Service de synchronisation

1. Aller dans le répertoire du service de synchronisation :

```bash
cd sync-service
```

2. Installer les dépendances :

```bash
npm install
```

3. Configurer les variables d'environnement dans `config.env` :

```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/taekwondo_db"
REMOTE_DATABASE_URL="postgresql://postgres:postgres@remote-db-server:5432/taekwondo_remote_db"
SYNC_INTERVAL=5
```

4. Démarrer le service de synchronisation :

```bash
npm start
```

### 3. Application Spectateur (Next.js)

1. Aller dans le répertoire de l'application spectateur :

```bash
cd spectator-app
```

2. Installer les dépendances :

```bash
npm install
```

3. Copier `example.env.local` vers `.env.local` et configurer les variables d'environnement :

```
NEXT_PUBLIC_API_URL=http://localhost:3001/api
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/taekwondo_remote_db"
```

4. Pour le développement local :

```bash
npm run dev
```

5. Pour la production :

```bash
npm run build
npm start
```

## Déploiement

### Service de synchronisation

Le service de synchronisation est conçu pour fonctionner sur le même système que l'application principale de gestion de tournois. Il peut être exécuté comme un service systemd ou via PM2.

### Application Spectateur

L'application spectateur peut être déployée sur Vercel ou un autre service de déploiement pour applications Next.js :

```bash
cd spectator-app
vercel
```

## Configuration de la base de données distante

1. Créer une base de données PostgreSQL distante avec le même schéma que la base de données locale
2. Configurer les informations de connexion dans `sync-service/config.env`
3. Le service de synchronisation s'occupera de répliquer les données

## Fonctionnalités de l'application spectateur

- Vue d'ensemble des aires avec les prochains combats
- Résultats des combats terminés
- Vue détaillée des informations de chaque combat
- Mise à jour automatique des données en temps réel
- Interface responsive pour mobiles et tablettes

## Licence

Ce projet est sous licence MIT.

## Contribution

Les contributions sont les bienvenues. N'hésitez pas à ouvrir une issue ou à soumettre une pull request.
