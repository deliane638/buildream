import { supabase, showMessage } from "./supabase.js";
const $ = id => document.getElementById(id);
let signupMode = false;

$("switch-mode").addEventListener("click", () => {
  signupMode = !signupMode;
  $("name-wrap").classList.toggle("hidden", !signupMode);
  $("auth-title").textContent = signupMode ? "Créer un compte" : "Connexion";
  $("auth-subtitle").textContent = signupMode ? "Inscrivez-vous comme client BUILDREAM." : "Accédez à votre compte BUILDREAM.";
  $("auth-submit").textContent = signupMode ? "Créer mon compte" : "Se connecter";
  $("switch-copy").textContent = signupMode ? "Déjà inscrit ?" : "Pas encore de compte ?";
  $("switch-mode").textContent = signupMode ? "Se connecter" : "Créer un compte";
  $("password").autocomplete = signupMode ? "new-password" : "current-password";
  showMessage($("auth-feedback"), "");
});
$("auth-form").addEventListener("submit", async e => {
  e.preventDefault();
  const email = $("email").value.trim();
  const password = $("password").value;
  $("auth-submit").disabled = true;
  $("auth-submit").textContent = "Patientez…";
  try {
    if (signupMode) {
      const fullName = $("full-name").value.trim();
      if (!fullName) throw new Error("Veuillez saisir votre nom complet.");
      const { data, error } = await supabase.auth.signUp({
        email, password,
        options: { data: { full_name: fullName } }
      });
      if (error) throw error;
      if (data.session) {
        showMessage($("auth-feedback"), "Compte créé. Vous allez être redirigé…");
        location.href = "index.html";
      } else {
        showMessage($("auth-feedback"), "Compte créé. Vérifiez votre boîte email pour confirmer l'adresse, puis connectez-vous.");
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      location.href = "index.html";
    }
  } catch (err) {
    showMessage($("auth-feedback"), err.message || "Une erreur est survenue.", true);
  } finally {
    $("auth-submit").disabled = false;
    $("auth-submit").textContent = signupMode ? "Créer mon compte" : "Se connecter";
  }
});
