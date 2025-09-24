# Cours Active Directory - Partie 2
## Trajectoire 1 : approfondir l'écosystème Windows Server / AD on-prem
### Windows Server 2022 - suite du cours AD DS

---

> **Prérequis** : ce cours suppose que tu as terminé la Partie 1. On réutilise et on étend le même lab (`corp.lab.local`, DC01/DC02, SRV01). On ajoute au fur et à mesure quelques serveurs membres dédiés pour respecter la **séparation des rôles** - un vrai réflexe d'ingénieur : on ne met pas une CA racine ou un ADFS sur un contrôleur de domaine.
>
> **Fil conducteur de cette partie** : tout se chaîne autour de l'**identité + la confiance cryptographique**. La PKI (module 16) émet les certificats que consommeront ADFS (module 17), LDAPS, l'EAP-TLS de NPS (module 19) et le durcissement TLS des serveurs de fichiers (module 18). C'est voulu : en production ces rôles ne vivent jamais isolés.

---

## Table des matières (Partie 2)

- **Module 16** - AD CS : la PKI d'entreprise (le plus important)
- **Module 17** - AD FS : fédération et SSO
- **Module 18** - Services de fichiers avancés : DFS-N, DFS-R, FSRM, ABE
- **Module 19** - NPS / RADIUS : 802.1X, VPN, Wi-Fi
- **Module 20** - Gestion des mises à jour : WSUS (et ses alternatives modernes)
- **Module 21** - Supervision, journalisation et exploitation
- **Module 22** - Projet final Partie 2 + questions d'examen

---

## Topologie étendue du lab

```
                    Réseau interne : 192.168.10.0/24

┌───────────────┐ ┌───────────────┐ ┌───────────────┐ ┌───────────────┐
│ DC01 / DC02   │ │ ROOTCA        │ │ SUBCA         │ │ SRV01         │
│ AD DS + DNS   │ │ CA racine     │ │ CA émettrice  │ │ Fichiers/DFS  │
│ .10 / .11     │ │ HORS DOMAINE  │ │ Enterprise    │ │ FSRM          │
│               │ │ ÉTEINTE       │ │ .31           │ │ .20           │
│               │ │ (offline)     │ │               │ │               │
└───────────────┘ └───────────────┘ └───────────────┘ └───────────────┘

┌───────────────┐ ┌───────────────┐ ┌───────────────┐
│ ADFS01        │ │ NPS01         │ │ WSUS01        │
│ Fédération    │ │ RADIUS/802.1X │ │ MàJ           │
│ .40           │ │ .50           │ │ .60           │
└───────────────┘ └───────────────┘ └───────────────┘
```

> **Note d'ingénieur** : sur un vrai lab, tu n'as pas besoin d'allumer les 7 VM en même temps. Fais des snapshots, allume par module. La CA racine (`ROOTCA`) reste **éteinte 99 % du temps** - c'est exactement ce qu'on fait en production (offline root CA).

---

# Module 16 - AD CS : la PKI d'entreprise

## 16.1 Pourquoi une PKI, et pourquoi c'est le module le plus rentable

Une PKI (Public Key Infrastructure) émet, gère et révoque des **certificats numériques** : des paires clés publique/privée signées par une autorité de confiance. Dans une infra AD, la PKI est **partout**, souvent sans qu'on s'en rende compte :

- **LDAPS** (LDAP over TLS, port 636) - dès que tu veux chiffrer les requêtes annuaire.
- **RDP** - pour supprimer l'avertissement de certificat et empêcher le MITM.
- **802.1X / EAP-TLS** - authentification réseau par certificat (module 19).
- **VPN, Wi-Fi entreprise, S/MIME, signature de code, SMB over QUIC, Always On VPN.**
- **ADFS** (module 17) exige un certificat de service.
- **Web interne** (HTTPS sur les intranets, consoles d'admin).

C'est aussi une des **surfaces d'attaque les plus critiques et les plus mal comprises** d'AD (voir 16.8, les attaques ESC). Une CA mal configurée = compromission de tout le domaine. Un ingénieur qui maîtrise la PKI *et* son durcissement a une vraie valeur.

## 16.2 Concepts fondamentaux

| Terme | Définition |
|---|---|
| **CA (Certificate Authority)** | Autorité qui signe les certificats. Racine de la confiance |
| **Certificat** | Clé publique + identité + signature de la CA, avec une durée de validité |
| **Clé privée** | Jamais partagée. Compromise = certificat à révoquer immédiatement |
| **CSR** | Certificate Signing Request : demande envoyée à la CA |
| **Template** | Modèle définissant les paramètres d'un type de certificat (Enterprise CA uniquement) |
| **CRL** | Certificate Revocation List : liste des certificats révoqués |
| **OCSP** | Online Certificate Status Protocol : vérification de révocation en temps réel |
| **CDP / AIA** | Points de distribution de la CRL / accès aux infos de l'autorité (dans chaque certif) |
| **Auto-enrollment** | Émission/renouvellement automatique de certificats via GPO |

## 16.3 Choix d'architecture : le modèle à deux niveaux (two-tier)

En production, **ne jamais** faire une CA unique. Le standard est le **two-tier PKI** :

```
        ┌────────────────────────────┐
        │  Root CA (ROOTCA)          │  ← Standalone, HORS DOMAINE, ÉTEINTE
        │  Offline. S'allume 1x/an   │     pour signer la CRL et renouveler
        │  pour signer la sub CA     │
        └────────────┬───────────────┘
                     │ signe
                     ▼
        ┌────────────────────────────┐
        │  Issuing / Subordinate CA  │  ← Enterprise, intégrée AD, EN LIGNE
        │  (SUBCA)                   │     émet TOUS les certificats du quotidien
        │  Émet les certifs clients  │
        └────────────────────────────┘
```

Pourquoi ? Si la CA émettrice est compromise, on la révoque et on en remonte une nouvelle **sans** invalider toute la chaîne de confiance. La racine, hors ligne, reste protégée. La clé privée de la racine est le secret le plus précieux de ton infra.

- **Standalone CA** : pas d'intégration AD, pas de templates, pas d'auto-enrollment. Parfaite pour une racine offline.
- **Enterprise CA** : intégrée à AD, publie ses certifs dans l'annuaire, supporte les templates et l'auto-enrollment. C'est ta CA émettrice.

> Pour un lab d'apprentissage rapide, on peut faire une **Enterprise Root CA** unique (16.4b). Mais je vais te montrer le vrai modèle two-tier, parce que c'est ce qu'on te demandera en entreprise et en entretien.

## 16.4 Déploiement de la CA racine hors ligne (ROOTCA)

`ROOTCA` = serveur **non joint au domaine**, IP `192.168.10.30`, workgroup.

```powershell
# Sur ROOTCA (workgroup, hors domaine)
Install-WindowsFeature ADCS-Cert-Authority -IncludeManagementTools

# Fichier de politique CAPolicy.inf (contrôle la durée de vie et la CRL de la racine)
# À placer dans C:\Windows\CAPolicy.inf AVANT de configurer la CA :
```
```ini
[Version]
Signature="$Windows NT$"

[Certsrv_Server]
RenewalKeyLength=4096
RenewalValidityPeriod=Years
RenewalValidityPeriodUnits=20
CRLPeriod=Years
CRLPeriodUnits=1
CRLDeltaPeriod=Days
CRLDeltaPeriodUnits=0
LoadDefaultTemplates=0
```
```powershell
# Configurer la CA racine STANDALONE
Install-AdcsCertificationAuthority `
    -CAType StandaloneRootCA `
    -CACommonName "CORP Root CA" `
    -KeyLength 4096 `
    -HashAlgorithmName SHA256 `
    -ValidityPeriod Years -ValidityPeriodUnits 20 `
    -CryptoProviderName "RSA#Microsoft Software Key Storage Provider" `
    -Force

# Définir la durée de vie MAX des certificats émis par la racine (la sub CA)
certutil -setreg CA\ValidityPeriod "Years"
certutil -setreg CA\ValidityPeriodUnits 10
Restart-Service certsvc

# Publier la CRL manuellement (à refaire chaque année quand tu rallumes la racine)
certutil -CRL
```

Ensuite, **exporte** le certificat racine (`.crt`) et la CRL vers une clé USB / un partage, puis **éteins ROOTCA**. On rallumera cette machine uniquement pour renouveler la sub CA ou republier la CRL.

## 16.4b Raccourci lab : Enterprise Root CA unique

Si tu veux aller vite pour apprendre les templates et l'auto-enrollment sans monter deux niveaux :

```powershell
# Sur SUBCA (ou un serveur membre du domaine), en admin de l'Entreprise
Install-WindowsFeature ADCS-Cert-Authority -IncludeManagementTools
Install-AdcsCertificationAuthority `
    -CAType EnterpriseRootCA `
    -CACommonName "CORP Enterprise CA" `
    -KeyLength 4096 -HashAlgorithmName SHA256 `
    -ValidityPeriod Years -ValidityPeriodUnits 10 -Force
```
> Fais le two-tier au moins une fois pour comprendre. En prod, c'est le two-tier ou rien.

## 16.5 Déploiement de la CA émettrice (SUBCA)

`SUBCA` = **serveur membre du domaine**, `192.168.10.31`.

```powershell
# Sur SUBCA (joint au domaine)
Install-WindowsFeature ADCS-Cert-Authority, ADCS-Web-Enrollment -IncludeManagementTools

# Configurer comme CA subordonnée d'entreprise
Install-AdcsCertificationAuthority `
    -CAType EnterpriseSubordinateCA `
    -CACommonName "CORP Issuing CA" `
    -KeyLength 4096 -HashAlgorithmName SHA256 `
    -CryptoProviderName "RSA#Microsoft Software Key Storage Provider" `
    -Force
# Cette commande génère une CSR : C:\SUBCA.corp.lab.local_CORP Issuing CA.req
```

Workflow de signature (le point qui bloque tout le monde la première fois) :

1. Copie la CSR de SUBCA vers ROOTCA (rallumée temporairement).
2. Sur ROOTCA : `certreq -submit "C:\...req"` → note l'ID de la requête.
3. `certutil -resubmit <ID>` (approuver), puis `certreq -retrieve <ID> "C:\subca.cer"`.
4. Exporte aussi le certif racine et la CRL.
5. Sur SUBCA : importe le certif racine dans le magasin *Trusted Root* (via GPO idéalement), puis :
```powershell
certutil -installcert "C:\subca.cer"
Start-Service certsvc
```
6. **Configure les points CDP/AIC** pour qu'ils pointent vers un emplacement HTTP accessible (sinon la révocation ne fonctionnera pas quand la racine sera éteinte). C'est l'erreur classique du two-tier.

## 16.6 Templates de certificats

Les templates (uniquement sur Enterprise CA) définissent : l'usage (EKU), qui peut demander, la longueur de clé, l'auto-enrollment, la validité.

```powershell
# Lister les templates publiés
certutil -CATemplates

# Console graphique : certtmpl.msc pour dupliquer/personnaliser un template
# Puis publier via certsrv.msc → clic droit Templates → New → Certificate Template to Issue
```

Bonnes pratiques templates :

- **Ne modifie jamais** les templates par défaut : **duplique**-les, versionne le nom (`CORP-Web-Server-v1`).
- Coche *"Do not store certs and requests in the CA database"* seulement si tu sais pourquoi.
- Pour l'auto-enrollment : onglet *Security* → le groupe cible a *Read + Enroll + Autoenroll*.
- **Surveille de près** qui a *Enroll* et surtout qui peut fournir le *subject* - c'est la racine des attaques ESC1 (voir 16.8).

## 16.7 Auto-enrollment par GPO (le confort quotidien)

Objectif : chaque poste/serveur reçoit et renouvelle automatiquement ses certificats.

1. Duplique le template *Computer* → `CORP-Computer-Auth`, coche *Autoenroll* dans les permissions du groupe `Domain Computers`.
2. Publie le template sur la CA.
3. GPO `GPO-C-AutoEnroll` liée au domaine :
   - *Computer Config → Policies → Windows Settings → Security Settings → Public Key Policies → Certificate Services Client - Auto-Enrollment* = **Enabled**, coche renew + update.

4. Sur un client : `gpupdate /force`, puis `certlm.msc` → Personal → Certificates : le certif machine apparaît.
```powershell
certutil -pulse   # forcer le déclenchement de l'auto-enrollment
```

## 16.8 Durcissement PKI - les attaques ESC (Certified Pre-Owned)

C'est **le** sujet qui distingue un admin d'un ingénieur sécurité. La recherche *Certified Pre-Owned* (SpecterOps) a documenté une famille d'escalades de privilèges via AD CS. À connaître, même de haut niveau :

| ID | Mauvaise config | Impact |
|---|---|---|
| **ESC1** | Template autorisant le demandeur à fournir le *subject* (SAN) + EKU Client Auth + Enroll pour utilisateurs peu privilégiés | Un utilisateur lambda demande un certif "au nom de" Domain Admin → auth en tant qu'admin |
| **ESC2** | Template avec EKU *Any Purpose* ou pas d'EKU | Certif utilisable pour tout |
| **ESC3** | Template *Enrollment Agent* mal restreint | Demander des certifs au nom d'autrui |
| **ESC4** | ACL faibles sur le template lui-même | Réécrire le template pour le rendre vulnérable |
| **ESC6** | Flag `EDITF_ATTRIBUTESUBJECTALTNAME2` sur la CA | SAN arbitraire sur toute demande |
| **ESC7** | Droits *ManageCA / ManageCertificates* mal attribués | Activer une config vulnérable, approuver des demandes |
| **ESC8** | Endpoint HTTP d'enrôlement (Web Enrollment) sans EPA → relais NTLM vers la CA | Relayer un compte machine DC → certif de DC → DCSync |

Défenses (à appliquer dans ton lab pour t'entraîner) :
```powershell
# Auditer ta propre PKI - l'outil de référence est PSPKI / Certify / Certipy
Install-Module PSPKI -Scope CurrentUser
# Vérifier le flag dangereux ESC6 :
certutil -getreg policy\EditFlags
# S'il contient EDITF_ATTRIBUTESUBJECTALTNAME2, le retirer :
certutil -setreg policy\EditFlags -EDITF_ATTRIBUTESUBJECTALTNAME2
Restart-Service certsvc
```
- Ne jamais donner *Enroll* + "supply subject in request" + Client Auth à des groupes larges.
- Désactive Web Enrollment (ESC8) si tu ne l'utilises pas, ou force **EPA** (Extended Protection for Authentication) + HTTPS.
- Restreins strictement *ManageCA/ManageCertificates* (ESC7).
- Active l'audit CA : `certutil -setreg CA\AuditFilter 127` puis active la GPO *Audit Certification Services*.
- **Mets les DC dans Protected Users** et sépare les tiers (rappel du module 12) : la PKI est un actif **Tier 0**.

## 16.9 Révocation et exploitation

```powershell
# Révoquer un certificat (par numéro de série)
certutil -revoke <serial> <raison>   # ex. raison 4 = superseded

# Publier une nouvelle CRL
certutil -CRL

# Vérifier une chaîne de certificats
certutil -verify -urlfetch certif.cer

# Sauvegarde de la CA (clé privée + base) - CRITIQUE
Backup-CARoleService -Path C:\Backup\CA -Password (Read-Host -AsSecureString)
# Restauration : Restore-CARoleService
```

## 16.10 Exercice pratique n°10
1. Monte le two-tier complet : ROOTCA offline standalone + SUBCA enterprise subordinate. Fais toute la chaîne de signature.
2. Configure les CDP/AIA en HTTP et vérifie `certutil -verify -urlfetch` sur un certif émis, **racine éteinte**.
3. Déploie l'auto-enrollment machine par GPO ; confirme sur SRV01 avec `certlm.msc`.
4. Émets un certif "Web Server" pour SRV01 et active LDAPS sur les DC (le certif se dépose dans le magasin *NTDS Personal*). Teste avec `ldp.exe` sur le port 636.
5. **Sécu** : vérifie le flag ESC6 sur ta CA, audite les templates avec PSPKI, et écris une note expliquant pourquoi ESC1 est si dangereux.

---

# Module 17 - AD FS : fédération et SSO

## 17.1 Le problème que résout la fédération

AD DS authentifie très bien **à l'intérieur** de ton réseau (Kerberos/NTLM). Mais dès qu'un utilisateur doit s'authentifier auprès d'une **application web tierce** (SaaS, appli partenaire), Kerberos ne passe pas les frontières. La **fédération d'identité** résout ça : l'application fait *confiance* à ton fournisseur d'identité (IdP), qui atteste de l'identité via des **claims** (revendications) transportées par des jetons standardisés.

Standards clés :

- **SAML 2.0** - le vétéran, dominant dans le SaaS entreprise.
- **WS-Federation** - historique Microsoft.
- **OAuth 2.0 / OpenID Connect (OIDC)** - moderne, orienté API/mobile.

> **Cadrage honnête d'ingénieur** : Microsoft pousse fortement vers **Entra ID** (trajectoire 2) comme IdP cloud. ADFS reste très présent dans l'existant, en scénario hybride, ou quand une contrainte réglementaire impose de garder l'IdP on-prem. Apprendre ADFS reste **très formateur** pour comprendre SAML/OIDC - les concepts se transposent directement à Entra ID, Okta, Keycloak.

## 17.2 Vocabulaire

| Terme | Définition |
|---|---|
| **IdP (Identity Provider)** | Émet les jetons d'identité. Ici : ADFS adossé à AD DS |
| **RP / SP (Relying Party / Service Provider)** | L'application qui consomme le jeton et fait confiance à l'IdP |
| **Claim** | Une information sur l'utilisateur (email, groupes, UPN…) dans le jeton |
| **Claim rule** | Règle qui transforme les attributs AD en claims envoyés à l'appli |
| **Relying Party Trust** | La relation de confiance configurée dans ADFS pour une appli donnée |
| **Federation metadata** | XML décrivant l'IdP/SP (endpoints, certifs) pour automatiser la config |
| **WAP (Web Application Proxy)** | Reverse-proxy en DMZ qui publie ADFS vers l'extérieur sans exposer le serveur |

## 17.3 Prérequis - et pourquoi ADFS dépend du module 16

ADFS **exige un certificat de service** (SSL). C'est là que la chaîne se boucle : tu émets ce certificat depuis **ta PKI du module 16**. Il te faut aussi :

- Un enregistrement DNS dédié : `fs.corp.lab.local` (le service ADFS a son propre nom, pas celui du serveur).
- Un compte de service - idéalement un **gMSA** (rappel module 11.4).
- Le certificat avec le SAN `fs.corp.lab.local` (+ `enterpriseregistration.corp.lab.local` pour le Device Registration).

```powershell
# Sur ADFS01 (membre du domaine, 192.168.10.40)
# 1. gMSA pour ADFS
Add-KdsRootKey -EffectiveTime ((Get-Date).AddHours(-10))  # si pas déjà fait
New-ADServiceAccount -Name "gmsa-adfs" -DNSHostName "fs.corp.lab.local" `
    -PrincipalsAllowedToRetrieveManagedPassword "ADFS01$"
Install-ADServiceAccount gmsa-adfs

# 2. DNS : enregistrement A pour le nom du service
#    (sur un DC)
Add-DnsServerResourceRecordA -ZoneName "corp.lab.local" -Name "fs" -IPv4Address 192.168.10.40

# 3. Certificat : demande un certif Web Server avec SAN fs.corp.lab.local à la SUBCA
#    (via certlm.msc → Personal → Request New Certificate, ou certreq)
```

## 17.4 Installation et configuration

```powershell
# Installer le rôle
Install-WindowsFeature ADFS-Federation -IncludeManagementTools

# Configurer la ferme ADFS (premier serveur)
$cert = (Get-ChildItem Cert:\LocalMachine\My | Where-Object {$_.Subject -like "*fs.corp.lab.local*"}).Thumbprint

Install-AdfsFarm `
    -CertificateThumbprint $cert `
    -FederationServiceName "fs.corp.lab.local" `
    -FederationServiceDisplayName "CORP SSO" `
    -GroupServiceAccountIdentifier "CORP\gmsa-adfs$"

# Vérifier
Get-AdfsProperties | Select-Object HostName, Identifier
# Page de test :  https://fs.corp.lab.local/adfs/ls/idpinitiatedsignon.aspx
# (à activer : Set-AdfsProperties -EnableIdPInitiatedSignonPage $true)
```

## 17.5 Créer une Relying Party Trust + claim rules

Exemple conceptuel : publier une application SAML.

1. ADFS Management → *Relying Party Trusts* → *Add* → importe les *federation metadata* de l'appli (URL ou fichier XML).
2. Définis les **claim rules** :
   - *Send LDAP Attributes as Claims* : mapper `E-Mail-Addresses` → claim `email`, `Display-Name` → `name`.
   - *Transform* : transformer l'UPN en *Name ID* au format attendu par l'appli.
```powershell
# Exemple de règle en langage de claims (issuance transform rule)
# Envoie l'email et le UPN
@'
c:[Type == "http://schemas.microsoft.com/ws/2008/06/identity/claims/windowsaccountname"]
 => issue(store = "Active Directory",
          types = ("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
                   "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/upn"),
          query = ";mail,userPrincipalName;{0}", param = c.Value);
'@
```

## 17.6 Publication externe et durcissement

- **WAP (Web Application Proxy)** en DMZ : ne jamais exposer ADFS directement sur Internet. Le WAP pré-authentifie et relaie.
- **Extranet Smart Lockout** : protège contre le brute-force externe sans verrouiller le compte AD interne.
- **MFA** : ADFS supporte des fournisseurs MFA (Azure MFA adapter, certificats, tiers).
- **Certificats** : surveille l'expiration du *token-signing certificate* (auto-rollover activé par défaut, mais à monitorer - cause n°1 de panne ADFS).
- ADFS est un actif **Tier 0** (il peut émettre des jetons pour n'importe qui) : mêmes règles de cloisonnement que les DC.

## 17.7 Exercice pratique n°11
1. Émets le certif ADFS depuis ta PKI (module 16), crée le gMSA et l'enregistrement DNS.
2. Installe la ferme ADFS, active la page de test IdP-initiated et connecte-toi.
3. Configure une Relying Party Trust factice et écris une claim rule qui envoie email + groupes.
4. Explique par écrit la différence entre SAML et OIDC, et pourquoi le token-signing cert est un point de défaillance critique.

---

# Module 18 - Services de fichiers avancés

## 18.1 Objectif

On étend le module 6 (AGDLP + partage simple) vers une architecture de fichiers **résiliente et gérée** : espace de noms unifié (DFS-N), réplication (DFS-R), quotas et filtrage (FSRM), et énumération basée sur l'accès (ABE).

## 18.2 DFS Namespaces (DFS-N) - l'espace de noms unifié

Problème : les utilisateurs mémorisent `\\SRV01\Compta`, `\\SRV02\RH`, `\\SRV03\Projets`… et si un serveur change, tout casse. DFS-N crée un **chemin logique unique** indépendant des serveurs physiques :

```
\\corp.lab.local\dfs\Compta   →  pointe vers  \\SRV01\Compta
\\corp.lab.local\dfs\RH       →  pointe vers  \\SRV02\RH
```

Le chemin `\\corp.lab.local\dfs\...` est un **namespace basé domaine** (résilient, publié dans AD). Si un serveur cible tombe, DFS bascule vers une réplique (avec DFS-R).

```powershell
Install-WindowsFeature FS-DFS-Namespace, FS-DFS-Replication, RSAT-DFS-Mgmt-Con

# Créer un namespace basé domaine
New-DfsnRoot -TargetPath "\\SRV01\dfs" -Type DomainV2 -Path "\\corp.lab.local\dfs"

# Ajouter un dossier avec cible
New-DfsnFolder -Path "\\corp.lab.local\dfs\Compta" -TargetPath "\\SRV01\Compta"
# Ajouter une 2e cible pour la résilience (nécessite DFS-R entre les deux)
New-DfsnFolderTarget -Path "\\corp.lab.local\dfs\Compta" -TargetPath "\\SRV02\Compta"
```

## 18.3 DFS Replication (DFS-R)

Réplication multi-maîtres de dossiers entre serveurs (moteur RDC - Remote Differential Compression, ne réplique que les deltas). Sert à la **résilience** et au rapprochement de données entre sites.

```powershell
New-DfsReplicationGroup -GroupName "RG-Compta"
New-DfsReplicatedFolder -GroupName "RG-Compta" -FolderName "Compta"
Add-DfsrMember -GroupName "RG-Compta" -ComputerName SRV01, SRV02
Add-DfsrConnection -GroupName "RG-Compta" -SourceComputerName SRV01 -DestinationComputerName SRV02
Set-DfsrMembership -GroupName "RG-Compta" -FolderName "Compta" `
    -ContentPath "D:\Compta" -ComputerName SRV01 -PrimaryMember $true
# Surveiller le backlog
Get-DfsrBacklog -GroupName "RG-Compta" -SourceComputerName SRV01 -DestinationComputerName SRV02 -FolderName "Compta"
```

> **Piège classique** : DFS-R n'est **pas** fait pour des fichiers ouverts en permanence en écriture simultanée (bases de données, fichiers verrouillés). Pour ça → serveur unique + sauvegarde, ou stockage partagé/cluster. DFS-R = fichiers "au repos" (documents bureautiques, dépôts).

## 18.4 FSRM - quotas et filtrage de fichiers

File Server Resource Manager : gouvernance du stockage.

```powershell
Install-WindowsFeature FS-Resource-Manager -IncludeManagementTools

# Quota : 5 Go sur le partage Compta, avec alerte à 85 %
New-FsrmQuota -Path "D:\Compta" -Size 5GB `
    -Threshold (New-FsrmQuotaThreshold -Percentage 85)

# File Screen : interdire les fichiers exécutables et audio/vidéo dans les partages bureautiques
New-FsrmFileGroup -Name "Executables" -IncludePattern @("*.exe","*.bat","*.cmd","*.scr")
New-FsrmFileScreen -Path "D:\Compta" -IncludeGroup "Executables" -Active

# Bonus sécu : un file screen sur les extensions de ransomware connues
New-FsrmFileGroup -Name "Ransomware" -IncludePattern @("*.locky","*.crypt","*.encrypted","*.wcry")
New-FsrmFileScreen -Path "D:\Compta" -IncludeGroup "Ransomware" -Active `
    -Notification (New-FsrmFileScreenNotificationAction -Type Event -EventType Warning)
```

> Le file screening est un **garde-fou low-cost anti-ransomware** : détection précoce de la création massive de fichiers chiffrés. Ce n'est pas une protection complète, mais c'est un signal utile à router vers ton SIEM (module 21).

## 18.5 Access-Based Enumeration (ABE)

ABE masque les dossiers auxquels l'utilisateur n'a pas accès - il ne les voit même pas. Meilleure UX et moins de fuite d'information (les noms de dossiers peuvent être sensibles).

```powershell
Set-SmbShare -Name "Compta" -FolderEnumerationMode AccessBased
# Sur un namespace DFS :
Set-DfsnRoot -Path "\\corp.lab.local\dfs" -EnableAccessBasedEnumeration $true
```

## 18.6 Exercice pratique n°12
1. Crée un namespace domaine `\\corp.lab.local\dfs` avec deux dossiers pointant vers SRV01.
2. Ajoute SRV02, configure DFS-R entre SRV01 et SRV02 pour `Compta`, vérifie le backlog à 0.
3. Applique un quota 5 Go + file screen exécutables + file screen ransomware sur `Compta`.
4. Active ABE et prouve qu'un utilisateur RH ne voit pas le dossier Compta.

---

# Module 19 - NPS / RADIUS : contrôle d'accès réseau

## 19.1 Le rôle de NPS

Network Policy Server est l'implémentation Microsoft de **RADIUS**. Il centralise l'authentification/autorisation des accès réseau contre AD :

- **802.1X filaire et Wi-Fi** : un poste ne parle au réseau que s'il s'authentifie (par certificat ou identifiants AD).
- **VPN** : authentifier les connexions VPN via AD.
- **Comptabilité (accounting)** : journaliser qui se connecte, où, quand.

Chaîne de confiance encore une fois liée au module 16 : la méthode la plus robuste, **EAP-TLS**, exige un **certificat côté client ET côté serveur**, tous deux émis par ta PKI.

## 19.2 Installation et enregistrement dans AD

```powershell
# Sur NPS01 (membre du domaine, 192.168.10.50)
Install-WindowsFeature NPAS -IncludeManagementTools

# Enregistrer NPS dans AD (l'autorise à lire les propriétés de dial-in des comptes)
netsh nps add registeredserver
# ou : Get-Command -Module NPS  ;  la console est nps.msc
```

## 19.3 Concepts NPS

| Élément | Rôle |
|---|---|
| **RADIUS Client** | Le commutateur / point d'accès / passerelle VPN qui interroge NPS (pas le PC final !) |
| **Connection Request Policy** | Où traiter la demande (localement ou la transférer) |
| **Network Policy** | Conditions (groupe AD, type de port…) → autoriser/refuser + paramètres |
| **Shared Secret** | Secret partagé entre le client RADIUS et NPS |

## 19.4 Exemple : 802.1X Wi-Fi avec PEAP-MSCHAPv2

```powershell
# Déclarer le point d'accès comme client RADIUS
New-NpsRadiusClient -Name "AP-Etage1" -Address "192.168.10.200" `
    -SharedSecret "UnSecretRadiusLong!" -VendorName "RADIUS Standard"
```
Puis dans `nps.msc` :

1. **Network Policy** `Wi-Fi-Employes` :
   - Condition : *Windows Groups* = `G_WiFi_Autorises` ; *NAS Port Type* = *Wireless 802.11*.
   - Autoriser l'accès.
   - Méthode EAP : **Microsoft: Protected EAP (PEAP)** → EAP interne MSCHAPv2, avec le certif serveur émis par ta PKI.

2. Le point d'accès pointe son RADIUS vers `192.168.10.50` avec le secret partagé.
3. GPO Wi-Fi (Computer → Policies → Windows Settings → Wireless Network Policies) pour pousser le profil aux clients.

> **EAP-TLS > PEAP-MSCHAPv2.** PEAP-MSCHAPv2 repose sur le mot de passe (vulnérable au vol d'identifiants / relais). En production sérieuse, vise **EAP-TLS** (certificat client par auto-enrollment du module 16) : pas de mot de passe sur le fil, authentification mutuelle.

## 19.5 Exercice pratique n°13
1. Installe NPS01, enregistre-le dans AD.
2. Configure une Network Policy 802.1X limitée au groupe `G_WiFi_Autorises`.
3. **Niveau expert** : bascule la policy en **EAP-TLS**, en t'appuyant sur les certifs machine auto-enrollés du module 16. Explique pourquoi c'est plus sûr que PEAP.
4. Active l'accounting RADIUS vers un fichier et repère une tentative d'authentification.

---

# Module 20 - Gestion des mises à jour : WSUS

## 20.1 Rôle et cadrage moderne

WSUS (Windows Server Update Services) centralise l'approbation et la distribution des mises à jour Microsoft : au lieu que 500 machines téléchargent chacune depuis Internet, elles tirent d'un serveur interne que tu contrôles, avec **approbation par vagues** (pilote → prod).

> **Honnêteté d'ingénieur 2026** : WSUS est une techno mature mais vieillissante, et Microsoft l'a officiellement placée en **maintenance/deprecation** (plus de développement de fonctionnalités). Les approches modernes recommandées sont **Windows Autopatch**, **Microsoft Intune** (cloud/hybride) et **Azure Update Manager** pour les serveurs. Apprends WSUS pour l'existant que tu vas rencontrer, mais sache que le futur est côté cloud (trajectoire 2). Je te le signale honnêtement plutôt que de te vendre une compétence en fin de vie.

## 20.2 Installation

```powershell
# Sur WSUS01 (192.168.10.60) - utilise WID (base interne) ou un vrai SQL
Install-WindowsFeature UpdateServices, UpdateServices-WidDB -IncludeManagementTools

# Post-config : définir le dossier de contenu
& 'C:\Program Files\Update Services\Tools\wsusutil.exe' postinstall CONTENT_DIR=D:\WSUS
```
Puis dans la console WSUS : choisis les produits (Windows Server 2022, Windows 11…), les classifications (Security Updates, Critical), la langue, et lance la synchronisation.

## 20.3 Groupes d'ordinateurs et approbation par vagues

1. Crée des **Computer Groups** : `Pilote`, `Serveurs`, `Postes`.
2. Approuve d'abord pour `Pilote`, valide 1 semaine, puis pour le reste. **Jamais d'auto-approbation aveugle sur la prod.**
3. Affecte les machines aux groupes via GPO (*client-side targeting*).

## 20.4 GPO client Windows Update

`GPO-C-WindowsUpdate` (Computer → Policies → Admin Templates → Windows Components → Windows Update) :

- *Specify intranet Microsoft update service location* = `http://WSUS01:8530`
- *Enable client-side targeting* = nom du groupe WSUS
- Planification d'installation, heures actives, redémarrage.

```powershell
# Sur un client : forcer la détection et vérifier
wuauclt /detectnow      # (legacy)
# Moderne :
(New-Object -ComObject Microsoft.Update.AutoUpdate).DetectNow()
# Diagnostic : C:\Windows\WindowsUpdate.log  →  Get-WindowsUpdateLog
```

## 20.5 Exercice pratique n°14
1. Installe WSUS01 (WID), synchronise Windows Server 2022 + classifications Security/Critical.
2. Crée les groupes Pilote/Serveurs/Postes et pousse la GPO avec client-side targeting.
3. Approuve une mise à jour pour Pilote uniquement, vérifie qu'elle ne descend pas sur les autres.
4. Rédige un court paragraphe : « pourquoi migrer de WSUS vers Intune/Autopatch/Azure Update Manager ? » - ce sera ton pont vers la trajectoire 2.

---

# Module 21 - Supervision, journalisation et exploitation

## 21.1 Pourquoi ce module

Déployer, c'est 20 % du métier. **Exploiter et détecter**, c'est les 80 % restants. Un ingénieur Google/SRE ne juge pas une infra sur son installation mais sur son **observabilité** : peut-on savoir qu'elle va mal *avant* les utilisateurs ?

## 21.2 Centraliser les journaux (Windows Event Forwarding)

Sans budget SIEM, Windows offre **WEF** (Windows Event Forwarding) : les machines poussent leurs événements vers un **collecteur** central, en natif, sans agent.

```powershell
# Sur le collecteur : activer le service de collecte
wecutil qc /q
# Sur les sources (via GPO) : configurer le SubscriptionManager vers le collecteur
#   Computer > Policies > Admin Templates > Windows Components > Event Forwarding
# Puis créer une souscription (wecutil cs subscription.xml) ciblant les events clés :
#   4625, 4740, 4728/4732/4756, 4768/4769, 4662, 1102, 4720, 4726...
```

En entreprise, on branche ensuite ce flux (ou directement les DC) vers un **SIEM** : Microsoft Sentinel, Splunk, Elastic (ELK), Wazuh. Les file screens ransomware du module 18 et les events PKI du module 16 y remontent aussi.

## 21.3 Métriques de santé à surveiller en continu

- **Réplication AD** : `repadmin /replsummary` = 0 échec (rappel module 9).
- **DFS-R backlog** : proche de 0 (module 18).
- **Expiration des certificats** : ADFS token-signing, certifs serveurs, CA (module 16).
- **Espace disque** des DC (surtout SYSVOL, NTDS, journaux).
- **Décalage temps** : `w32tm /monitor` (module 14).
- **Services critiques** : NTDS, DNS, KDC, Netlogon, DFSR, ADFS, CertSvc.

```powershell
# Exemple : alerter sur les certificats expirant dans < 30 jours (à planifier)
Get-ChildItem Cert:\LocalMachine\My | Where-Object {
    $_.NotAfter -lt (Get-Date).AddDays(30)
} | Select-Object Subject, NotAfter
```

## 21.4 Automatisation de l'exploitation

Reprends le script de santé du module 11.3 et transforme-le en **tâche planifiée quotidienne** qui envoie un rapport (mail ou webhook). C'est le premier pas vers la trajectoire 3 (Infra as Code / observabilité). L'idée directrice : **si tu le fais deux fois à la main, tu le scriptes.**

## 21.5 Exercice pratique n°15
1. Configure WEF : un collecteur + une souscription qui ramène les events 4625/4740/4768 des DC.
2. Écris un script qui liste tous les certificats de l'infra expirant sous 30 jours, sur SRV01, SUBCA et ADFS01.
3. Planifie un rapport de santé quotidien consolidant réplication + services + certifs + backlog DFS-R.

---

# Module 22 - Projet final Partie 2 + examen

## 22.1 Projet fil rouge : « CORP Services »

**Objectif** : livrer une infra de services on-prem complète, sécurisée et observable, adossée au domaine `corp.lab.local` de la Partie 1.

Checklist de livraison :

- [ ] **PKI two-tier** : ROOTCA offline + SUBCA enterprise ; CDP/AIA HTTP ; auto-enrollment machine par GPO ; flag ESC6 vérifié ; templates audités (PSPKI).
- [ ] **LDAPS** actif sur les DC avec certif de la PKI, testé via `ldp.exe:636`.
- [ ] **ADFS** installé (certif issu de la PKI, gMSA, DNS `fs.`), une RP trust de test avec claim rules.
- [ ] **Fichiers** : namespace `\\corp.lab.local\dfs`, DFS-R résilient SRV01↔SRV02, FSRM (quota + file screen ransomware), ABE activé.
- [ ] **NPS** : policy 802.1X, idéalement EAP-TLS avec les certifs auto-enrollés.
- [ ] **WSUS** : groupes par vagues + GPO client-side targeting.
- [ ] **Observabilité** : WEF vers un collecteur, alerte expiration certifs, rapport de santé quotidien planifié.
- [ ] **Sécurité transverse** : CA/ADFS traités comme Tier 0, audit activé partout, secrets gérés (gMSA), aucune modif des templates/GPO par défaut.

## 22.2 Questions type examen / entretien

1. Pourquoi une PKI two-tier plutôt qu'une CA unique ? Que fait-on de la racine au quotidien ?
2. Décris l'attaque **ESC1** et sa remédiation. Pourquoi la PKI est-elle un actif Tier 0 ?
3. Différence Standalone CA vs Enterprise CA ? Laquelle supporte les templates et l'auto-enrollment ?
4. Qu'est-ce qu'un CDP/AIA et pourquoi est-ce critique quand la racine est offline ?
5. SAML vs OIDC : quand chaque ? Quel est le point de défaillance n°1 d'ADFS ?
6. Pourquoi ne jamais mettre une base de données en DFS-R ? Quelle alternative ?
7. EAP-TLS vs PEAP-MSCHAPv2 : lequel et pourquoi ?
8. Comment le module 16 (PKI) alimente-t-il concrètement les modules 17, 18, 19 ? (donne 3 dépendances)
9. WSUS est-il un choix d'avenir ? Que recommanderais-tu en 2026 et pourquoi ?
10. Cite 6 métriques que tu surveilles en continu sur cette infra et l'outil natif pour chacune.

## 22.3 Ce qui vient après (ponts vers les trajectoires 2 et 3)

- **Trajectoire 2 (hybride/cloud)** : Entra ID, Entra Connect (sync des identités de `corp.lab.local` vers le cloud), Conditional Access, PIM - c'est la suite la plus stratégique. Ton WSUS deviendra Intune/Autopatch, ton ADFS pourra céder la place à l'auth cloud.
- **Trajectoire 3 (DevSecOps)** : reconstruire tout ce lab en **Terraform + PowerShell DSC/Ansible**, versionner les GPO et la config PKI dans Git, tester avec **Pester**, brancher les logs (modules 16/18/21) dans un SIEM, et auditer offensivement avec **BloodHound / PingCastle / Certipy**.

---

## Annexe - Aide-mémoire Partie 2

```
# AD CS
Install-AdcsCertificationAuthority        Configurer une CA
certutil -CATemplates                      Templates publiés
certutil -CRL                              Publier la CRL
certutil -verify -urlfetch cert.cer        Valider une chaîne
certutil -getreg policy\EditFlags          Vérifier ESC6
certutil -pulse                            Forcer l'auto-enrollment
Backup-CARoleService                       Sauvegarder la CA

# AD FS
Install-AdfsFarm                           Créer la ferme
Get-AdfsProperties                         État du service
Get-AdfsRelyingPartyTrust                  Lister les RP trusts

# Fichiers
New-DfsnRoot / New-DfsnFolder              Namespace DFS
Get-DfsrBacklog                            Backlog de réplication
New-FsrmQuota / New-FsrmFileScreen         Quotas et filtrage
Set-SmbShare -FolderEnumerationMode AccessBased   ABE

# NPS
New-NpsRadiusClient                        Déclarer un client RADIUS
netsh nps add registeredserver             Enregistrer NPS dans AD

# WSUS
wsusutil.exe postinstall                   Post-configuration
Get-WsusServer / Get-WsusComputer          Gestion PowerShell

# Observabilité
wecutil qc                                 Activer la collecte WEF
w32tm /monitor                             Santé du temps
repadmin /replsummary                      Santé réplication
```

*Fin de la Partie 2. Les modules se chaînent autour de la confiance cryptographique : monte la PKI en premier, tout le reste en découle. Quand tu es à l'aise ici, la trajectoire 2 (Entra ID / hybride) est la suite qui a le plus de valeur sur le marché.*
