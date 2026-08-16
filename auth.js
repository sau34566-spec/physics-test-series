import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

export function enforceRoleGuard(requiredRole, redirectPath) {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = redirectPath || "/index.html";
      return;
    }

    try {
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (!userDoc.exists()) throw new Error("User record missing");

      const profile = userDoc.data();
      if (profile.status === "DISABLED") {
        await signOut(auth);
        alert("Account is disabled. Contact system admin.");
        window.location.href = "/index.html";
        return;
      }

      if (requiredRole !== "*" && profile.role !== requiredRole && profile.role !== "super_admin") {
        alert("Unauthorized route access.");
        window.location.href = "/index.html";
      }
    } catch (err) {
      console.error("Auth routing failure:", err);
      window.location.href = "/index.html";
    }
  });
}