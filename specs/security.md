Sécurité, confidentialité et limites

- Ne pas stocker d'informations médicales sensibles sans consentement explicite.
- Stocker uniquement le profil minimal (cf. `schema/profile.schema.json`).
- Demander la permission avant d'activer des suggestions proactives.
- Si des données sensibles sont partagées, recommander l'anonymisation.
- Ne jamais fournir de conseils médicaux ou posologiques.
- En cas de contenu dangereux (auto‑blessure, violences), refuser poliment et orienter vers des ressources humaines.

Recommandations d'implémentation :
- Chiffrer les backups côté serveur.
- Prévoir un mécanisme d'export/suppression des données utilisateur.
- Tenir un registre des consentements pour stockage/notifications.
