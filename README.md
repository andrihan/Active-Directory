# Active Directory sur Windows Server 2022

### De l'installation à la sécurité offensive - un parcours complet en 9 modules

Ce dépôt contient un **cours intégral sur Active Directory Domain Services (AD DS)**, pensé comme une progression cohérente de bout en bout : on ne se contente pas d'installer des rôles, on apprend à **concevoir, sécuriser, fiabiliser, exploiter, comprendre et attaquer** un annuaire d'entreprise.

Tout le cours s'appuie sur un unique lab pratique, filé du premier au dernier module : **`corp.lab.local`**.

---

## Sommaire

| # | Module | Fichier | Ce que vous y apprenez |
|---|--------|---------|-------------------------|
| 1 | Le cœur d'AD DS | [`docs/1.AD.md`](docs/1.AD.md) | Forêt, domaine, OU, DNS, contrôleurs de domaine, utilisateurs et groupes (AGDLP), GPO, réplication, rôles FSMO, sécurité de base. De rien à un domaine fonctionnel. |
| 2 | L'écosystème de services | [`docs/2.  AD.md`](<docs/2.  AD.md>) | PKI d'entreprise (AD CS et attaques ESC), fédération (AD FS), fichiers avancés (DFS, FSRM), RADIUS/802.1X (NPS), gestion des mises à jour (WSUS), observabilité. Fil rouge : la confiance cryptographique. |
| 3 | La résilience | [`docs/3.AD.md`](docs/3.AD.md) | Clustering (WSFC, quorum), stockage résilient (Storage Spaces Direct, Storage Replica), Hyper-V en cluster, Live Migration, plan de reprise (DR), DHCP haute disponibilité. RTO/RPO à l'appui. |
| 4 | L'exploitation SRE-grade | [`docs/4.AD.md`](docs/4.AD.md) | Server Core, JEA (moindre privilège en commande), contrôle applicatif (AppLocker/WDAC), durcissement (Credential Guard, baselines), sauvegarde immuable, PRA, pratiques SRE (SLI/SLO, budget d'erreur, réduction du toil). |
| 5 | Les fondements théoriques | [`docs/6.AD-Théorie.md`](docs/6.AD-Théorie.md) | Cryptographie, LSA/SSPI, Kerberos de bout en bout, NTLM, SID et jetons, LDAP et le schéma, la base NTDS.dit, réplication multi-maîtres, PKINIT, approbations. Le « sous le capot » qui transforme le « je sais faire » en « je sais pourquoi ». |
| 6 | Purple Team AD | [`docs/6. Attaquer AD.md`](<docs/6. Attaquer AD.md>) | Reconnaissance, escalade (Kerberoasting, abus d'ACL, ESC), mouvement latéral, domination du domaine (DCSync, Golden Ticket) - chaque technique suivie de sa **détection** et de sa **remédiation**. |
| 6-bis | Opérations Red Team | [`docs/7. AD Operation Red Team.md`](<docs/7. AD Operation Red Team.md>) | La couche opérationnelle : méthodologie d'engagement, discipline offensive, industrialisation des techniques d'attaque en conditions réelles de mission. |
| 7-bis | Gouvernance des outils de sécurité | [`docs/8.AD Gouvernance outils sécurité dans AD.md`](<docs/8.AD Gouvernance outils sécurité dans AD.md>) | Intégrer et gouverner le stack de sécurité **dans** Active Directory : le liant opérationnel entre les outils et l'annuaire. |
| 7-bis (annexe) | Commandes & configurations de référence | [`docs/9. AD Annexes Commandes & Configurations outils securité.md`](<docs/9. AD Annexes Commandes & Configurations outils securité.md>) | Le stack de sécurité déployé et gouverné dans AD, en version copier-coller : commandes et configurations prêtes à l'emploi. |

---

## Progression du cours

```
Partie 1  Fondations AD DS
Partie 2  Écosystème de services (PKI, ADFS, DFS, NPS, WSUS)
Partie 3  Haute disponibilité et résilience
Partie 4  Exploitation SRE-grade et durcissement
Partie 5  Internals et fondements théoriques
Partie 6  Purple Team - attaque et remédiation
Partie 6-bis  Discipline Red Team
Partie 7-bis  Gouvernance des outils de sécurité
Partie 7-bis (annexe)  Commandes & configurations de référence
```

Chaque partie s'appuie sur la précédente : les fondations (1) portent l'écosystème (2), qui doit rester résilient (3) et exploitable sans risque (4), avant de comprendre ce qui se passe réellement sous le capot (5) puis de savoir l'attaquer (6, 6-bis) et le gouverner (7-bis).

---

## Public visé

- Administrateurs systèmes qui déploient et opèrent Active Directory en production.
- Ingénieurs sécurité / Blue Team qui doivent durcir, détecter et remédier.
- Pentesters / Red Team qui doivent comprendre l'annuaire pour l'exploiter de façon légale et encadrée.
- Toute personne voulant un parcours complet, du premier contrôleur de domaine jusqu'à la compromission et la défense d'une forêt AD.

## Prérequis

- Notions de base en réseaux (DNS, TCP/IP) et en administration Windows Server.
- Un environnement de lab (Hyper-V, VMware ou équivalent) pour suivre les manipulations pas à pas.
- Aucune expérience préalable en sécurité offensive n'est requise : les parties 6 et suivantes réexpliquent les prérequis nécessaires.

## Cadre légal

Les techniques offensives présentées dans les parties 6, 6-bis et 7-bis sont destinées **exclusivement** à un usage sur lab personnel ou dans le cadre d'un engagement de sécurité autorisé. Chaque technique d'attaque est systématiquement accompagnée de sa détection et de sa remédiation.

---

## En résumé

Ce cours couvre Active Directory **de l'installation débutant jusqu'au niveau ingénieur sécurité** : conception, services, haute disponibilité, exploitation professionnelle, maîtrise des protocoles internes, gouvernance des outils de sécurité, et sécurité offensive/défensive. Un cursus on-prem complet et cohérent, articulé autour d'un unique lab de bout en bout : `corp.lab.local`.
