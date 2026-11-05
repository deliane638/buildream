# BUILDREAM SARL — guide de démarrage (version adaptée à ta base)

Cette version reprend le projet HTML/CSS/JavaScript fourni et l'adapte aux tables Supabase visibles dans tes captures.

## 1. Ce qui est déjà dans le projet
- `index.html` : site public responsive, présentation, secteurs, catalogue, contact.
- `auth.html` : inscription et connexion.
- `admin.html` : tableau de bord pour les comptes `admin` et `staff`.
- `js/settings.js` : URL Supabase, clé publique, WhatsApp de test et email.
- `js/public.js` : lecture du catalogue dans les tables françaises.
- `js/admin.js` : gestion des secteurs, matériels et demandes.
- `supabase/schema.sql` : migration non destructive pour ta base française.
- `assets/posters/` : affiches et visuels présents dans ton projet.

## 2. Sauvegarde avant modification
Garde une copie de ton projet et de ta base. Le script SQL ne supprime aucune table et aucune ligne, mais il modifie les politiques RLS et ajoute des champs/tables. Lis-le avant de l'exécuter.

## 3. Configuration Supabase
Le fichier `js/settings.js` contient déjà l'URL de projet et la clé publique qui figuraient dans ton ZIP.
- La clé `sb_publishable_...` est une clé publique prévue pour le navigateur.
- Ne copie jamais une clé `sb_secret_...` ou `service_role` dans le site.
- Le numéro WhatsApp présent dans le fichier est utilisé comme numéro de test. Tu pourras le remplacer par celui du propriétaire avant la mise en ligne.
- L'adresse email est une adresse de réception de test; confirme l'adresse officielle avec l'entreprise.

## 4. Adapter la base existante
Dans Supabase :
1. Fais une sauvegarde de la base si elle contient déjà des données importantes.
2. Ouvre **SQL Editor** puis **New query**.
3. Ouvre `supabase/schema.sql` dans VS Code.
4. Copie tout le contenu dans SQL Editor.
5. Lis le script puis clique sur **Run**.
6. Si Supabase affiche une erreur, arrête-toi et copie le message exact. Ne relance pas le script en boucle.

Le code utilise directement les noms confirmés dans tes captures :
- `secteurs` : `identifiant`, `nom`, `description`, `URL de l'image`, et le champ ajouté `visible`.
- `matériels` : `identifiant`, `nom`, `descriptions`, `utilise`, `URL de l'image`, `disponible`, `secteur_id`.
- `profil` : `identifiant`, `nom et prénom`, `rôle`, `créer_à`.
- `demandes_contact` : nouvelle table ajoutée par le script pour recevoir les formulaires.

Le script ajoute `visible` à `secteurs`, `créer_à` à `matériels`, et crée `demandes_contact`. Il ne remplace pas tes trois tables.

## 5. Créer le compte administrateur
1. Lance le site et ouvre `auth.html`.
2. Crée le compte du propriétaire avec son email.
3. Dans Supabase, ouvre **Authentication > Users** et copie son UUID.
4. Dans **SQL Editor**, exécute cette commande en remplaçant l'UUID :

   `UPDATE public.profil SET "rôle" = 'admin' WHERE identifiant = 'UUID_DU_PROPRIETAIRE';`

5. Le propriétaire pourra ouvrir `admin.html`.

Pour ajouter un compagnon :
1. Il crée d'abord son compte sur `auth.html`.
2. Tu copies son UUID dans **Authentication > Users**.
3. Tu exécutes :

   `UPDATE public.profil SET "rôle" = 'staff' WHERE identifiant = 'UUID_DU_COMPAGNON';`

Les inscriptions publiques restent au rôle `client`. Un visiteur ne peut pas se donner le rôle admin depuis le formulaire.

## 6. WhatsApp et email
Le numéro de test est déjà lu par `js/supabase.js` depuis `js/settings.js` (correction apportée : l'ancienne fonction lisait une autre variable vide, ce qui empêchait le bouton WhatsApp de fonctionner).

Dans `js/settings.js` :
- `WHATSAPP_NUMBER` : numéro au format international, sans `+`, espace ni tiret.
- `COMPANY_EMAIL` : adresse qui reçoit les demandes par email.

Teste d'abord le bouton avec le numéro de test. Avant publication, demande l'autorisation du propriétaire et remplace-le par le numéro officiel de l'entreprise.

## 7. Lancer le site sur ton ordinateur
Avec VS Code :
1. Installe l'extension **Live Server**.
2. Ouvre `index.html`.
3. Fais clic droit > **Open with Live Server**.

N'ouvre pas directement `index.html` en double-cliquant : les modules JavaScript peuvent être bloqués par le navigateur.

## 8. Vérifications
- Le site public s'ouvre sans connexion.
- Les secteurs existants apparaissent.
- Les matériaux disponibles apparaissent lorsqu'ils existent dans la table.
- Le formulaire contact peut ouvrir WhatsApp ou le logiciel email.
- Les demandes sont enregistrées dans `demandes_contact` si les politiques SQL sont installées.
- Un compte client ne peut pas ouvrir l'administration.
- Un compte `admin` ou `staff` peut gérer secteurs et matériels et traiter les demandes.
- Teste aussi l'affichage sur téléphone.

## 9. Images du catalogue
Les affiches de l'entreprise sont dans `assets/posters/`. Pour chaque matériau, l'admin peut saisir une URL directe d'image HTTPS dans le champ prévu. Plus tard, nous pourrons configurer Supabase Storage pour téléverser directement les photos depuis l'administration.

## 10. Avant la mise en production
- Fais valider par le propriétaire le numéro WhatsApp et l'adresse email.
- Vérifie les intitulés et descriptions des secteurs avec l'entreprise.
- N'affiche pas de prix ni de disponibilité garantie sans validation.
- Configure les URL de redirection dans **Supabase > Authentication > URL Configuration** pour le domaine de production.
- Vérifie les politiques RLS dans Supabase. Si des politiques anciennes existent déjà sur les mêmes tables, elles peuvent s'ajouter aux nouvelles : fais vérifier les politiques existantes avant d'ouvrir le site au public.
- N'expose jamais la clé secrète Supabase dans les fichiers JavaScript.
