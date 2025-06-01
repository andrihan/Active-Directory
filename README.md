# Active Directory sur Windows Server 2022
## De l'installation à la sécurité offensive — un parcours en 6 parties

Ce document est un **cours intégral sur Active Directory Domain Services (AD DS)**, conçu comme une progression cohérente : on ne se contente pas d'installer des rôles, on apprend à **concevoir, sécuriser, résilier, exploiter, comprendre et attaquer** un annuaire d'entreprise — sur un lab pratique `corp.lab.local` filé du début à la fin.

---

## Les 6 parties

**Partie 1 — Le cœur d'AD DS.**
Les fondations : forêt, domaine, OU, DNS, contrôleurs de domaine, utilisateurs et groupes (stratégie AGDLP), stratégies de groupe (GPO), réplication, rôles FSMO et sécurité de base. De rien à un domaine fonctionnel.

**Partie 2 — L'écosystème de services.**
Tout ce qui s'appuie sur AD : la PKI d'entreprise (AD CS et les attaques ESC), la fédération (AD FS), les fichiers avancés (DFS, FSRM), RADIUS/802.1X (NPS), la gestion des mises à jour (WSUS) et l'observabilité. Le fil rouge : la **confiance cryptographique** qui relie ces services.

**Partie 3 — La résilience.**
Concevoir pour que ça ne tombe pas : clustering (WSFC, quorum), stockage résilient (Storage Spaces Direct, Storage Replica), Hyper-V en cluster, Live Migration, plan de reprise (DR) et DHCP en haute disponibilité. RTO/RPO à l'appui.

**Partie 4 — L'exploitation SRE-grade.**
La discipline qui tient l'infra sans se faire pirater : Server Core, JEA (moindre privilège au niveau commande), contrôle applicatif (AppLocker/WDAC), durcissement (Credential Guard, baselines), sauvegarde immuable, PRA, et les pratiques SRE (SLI/SLO, budget d'erreur, réduction du toil).

**Partie 5 — Les fondements théoriques.**
Le « sous le capot » : cryptographie, LSA/SSPI, Kerberos de bout en bout, NTLM, SID et jetons, LDAP et le schéma, la base NTDS.dit, la réplication multi-maîtres, PKINIT, les approbations. La partie qui transforme le « je sais faire » en « je sais pourquoi ».

**Partie 6 — Purple Team AD.**
L'offensive au service de la défense, dans un cadre strictement légal : reconnaissance, escalade (Kerberoasting, abus d'ACL, ESC), mouvement latéral, domination du domaine (DCSync, Golden Ticket) — chaque technique suivie de sa **détection** et de sa **remédiation**, puis industrialisée en audit continu.

---

## En résumé

Ce cours couvre Active Directory **de l'installation débutant jusqu'au niveau ingénieur sécurité** : conception, services, haute disponibilité, exploitation professionnelle, maîtrise des protocoles internes, et sécurité offensive/défensive. Un cursus on-prem complet et cohérent, articulé autour d'un unique lab de bout en bout.
