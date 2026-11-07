async function requireAdmin() {
  const { data, error } = await supabase.auth.getSession();

  const session = data?.session;

  if (error || !session) {
    alertAdmin("Aucune session active. Connectez-vous d'abord.", true);
    return false;
  }

  console.log("UID connecté :", session.user.id);

  const { data: profile, error: profileError } = await supabase
    .from("profile")
    .select("id, full_name, role")
    .eq("id", session.user.id)
    .maybeSingle();

  console.log("Profil trouvé :", profile);
  console.log("Erreur profil :", profileError);

  if (profileError) {
    alertAdmin("Erreur de vérification : " + profileError.message, true);
    return false;
  }

  if (!profile) {
    alertAdmin("Aucun profil trouvé pour cet utilisateur.", true);
    return false;
  }

  const role = String(profile.role || "").trim().toLowerCase();

  if (!["admin", "staff"].includes(role)) {
    alertAdmin("Rôle non autorisé : " + role, true);
    return false;
  }

  $("admin-user").textContent =
    `${profile.full_name || session.user.email} · ${role}`;

  return true;
}
