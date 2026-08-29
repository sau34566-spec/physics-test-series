# Physics Test Series

Multi-institute online examination platform for candidates, institute
administrators, and super administrators.

## Firebase foundation

All three portals use the same Firebase application configured in
`js/firebase-config.js`:

- Firebase project: `superadmin-2c2f1`

- Candidate portal: `/index.html`
- Institute admin portal: `/admin/index.html`
- Super admin portal: `/superadmin/index.html`

Firebase Web SDK `12.1.0` is used consistently throughout the project. Do not
initialize Firebase separately inside feature modules; import `auth` and `db`
from `js/firebase-config.js` instead.

The Super Admin must have:

1. A Firebase Authentication email/password account.
2. A matching Firestore document at `admins/{uid}` (or the temporary
   compatibility path `users/{uid}`).
3. `role: "super_admin"` and `status: "active"` in that document.

Firestore authorization rules are stored in `firebase/firestore.rules`, and the
data model is documented in `docs/firestore-data-model.md`. Candidate access
uses a separate named Firebase app with Anonymous Authentication so it cannot
replace an Admin session on the same browser origin.
