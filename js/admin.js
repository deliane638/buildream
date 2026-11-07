
import { supabase, escapeHtml } from "./supabase.js";

const $ = id => document.getElementById(id);

let sectors = [];
let materials = [];
let inquiries = [];
let adminAuthorized = false;

// ==================================================
// 1. MESSAGES
// ==================================================

function alertAdmin(message, isError = false) {
  const element = $("admin-message");

  if (element) {
    element.textContent = message;
    element.style.color = isError ? "#b42318" : "#16845d";
  }

  console.log(message);
}

// ==================================================
// 2. PROTECTION DE L'ADMINISTRATION
// ==================================================

async function requireAdmin() {
  try {
    const { data, error } = await supabase.auth.getSession();

    if (error) {
      console.error("Erreur de session :", error);
      alertAdmin("Impossible de vérifier la connexion.", true);
      return false;
    }

    if (!data.session) {
      window.location.replace("auth.html");
      return false;
    }

    const user = data.session.user;

    console.log("Utilisateur connecté :", user.id);

    const { data: profile, error: profileError } = await supabase
      .from("profile")
      .select("id, full_name, role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("Erreur profil :", profileError);
      alertAdmin(
        "Erreur de vérification du profil : " + profileError.message,
        true
      );
      return false;
    }

    if (!profile) {
      alertAdmin(
        "Aucun profil associé à ce compte. Contactez l'administrateur.",
        true
      );
      return false;
    }

    const role = String(profile.role || "")
      .trim()
      .toLowerCase();

    console.log("Rôle détecté :", role);

    if (!["admin", "staff"].includes(role)) {
      alertAdmin("Accès refusé : rôle non autorisé.", true);
      return false;
    }

    const userElement = $("admin-user");

    if (userElement) {
      userElement.textContent =
        `${profile.full_name || user.email} · ${role}`;
    }

    adminAuthorized = true;

    return true;

  } catch (error) {
    console.error("Erreur de sécurité :", error);
    alertAdmin("Une erreur est survenue pendant la vérification.", true);
    return false;
  }
}

// ==================================================
// 3. ADAPTATION DES DONNÉES
// ==================================================

function sectorFromDb(row) {
  return {
    id: row.id,
    name: row.name || "",
    description: row.description || "",
    image_url: row.image_url || ""
  };
}

function materialFromDb(row) {
  return {
    id: row.id,
    name: row.name || "",
    descriptions: row.descriptions || "",
    uses: row.uses || "",
    image_url: row.image_url || "",
    available: row.available !== false,
    sector_id: row.sector_id
  };
}

// ==================================================
// 4. CHARGEMENT DES DONNÉES
// ==================================================

async function loadAll() {
  if (!adminAuthorized) return;

  alertAdmin("Chargement des données...");

  const [sectorResult, materialResult] = await Promise.all([
    supabase
      .from("sectors")
      .select("*")
      .order("id", { ascending: true }),

    supabase
      .from("materials")
      .select("*")
      .order("name", { ascending: true })
  ]);

  if (sectorResult.error) {
    console.error("Erreur secteurs :", sectorResult.error);
    alertAdmin("Impossible de charger les secteurs.", true);
    return;
  }

  if (materialResult.error) {
    console.error("Erreur matériaux :", materialResult.error);
    alertAdmin("Impossible de charger les matériaux.", true);
    return;
  }

  sectors = (sectorResult.data || []).map(sectorFromDb);
  materials = (materialResult.data || []).map(materialFromDb);

  renderAll();

  alertAdmin("Administration chargée avec succès.");
}

// ==================================================
// 5. STATISTIQUES
// ==================================================

function renderStats() {
  const totalSectors = $("total-sectors");
  const totalMaterials = $("total-materials");
  const totalInquiries = $("total-inquiries");

  if (totalSectors) {
    totalSectors.textContent = sectors.length;
  }

  if (totalMaterials) {
    totalMaterials.textContent = materials.length;
  }

  if (totalInquiries) {
    totalInquiries.textContent = inquiries.length;
  }
}

// ==================================================
// 6. SECTEURS
// ==================================================

function renderSectors() {
  const container = $("sectors-list");
  if (!container) return;

  container.innerHTML = sectors.map(sector => `
    <div class="admin-item">
      <h3>${escapeHtml(sector.name)}</h3>
      <p>${escapeHtml(sector.description)}</p>

      <button type="button"
        data-delete-sector="${escapeHtml(sector.id)}">
        Supprimer
      </button>
    </div>
  `).join("");
}

// ==================================================
// 7. MATÉRIAUX
// ==================================================

function renderMaterials() {
  const container = $("materials-list");
  if (!container) return;

  container.innerHTML = materials.map(material => `
    <div class="admin-item">
      <h3>${escapeHtml(material.name)}</h3>
      <p>${escapeHtml(material.descriptions)}</p>
      <p>${escapeHtml(material.uses)}</p>

      <p>
        ${material.available ? "Disponible" : "Indisponible"}
      </p>

      <button type="button"
        data-delete-material="${escapeHtml(material.id)}">
        Supprimer
      </button>
    </div>
  `).join("");
}

// ==================================================
// 8. AFFICHAGE GLOBAL
// ==================================================

function renderAll() {
  renderStats();
  renderSectors();
  renderMaterials();
}

// ==================================================
// 9. SUPPRESSION SECTEUR
// ==================================================

async function deleteSector(id) {
  if (!adminAuthorized) return;

  if (!confirm("Voulez-vous vraiment supprimer ce secteur ?")) {
    return;
  }

  const { error } = await supabase
    .from("sectors")
    .delete()
    .eq("id", id);

  if (error) {
    alertAdmin("Erreur : " + error.message, true);
    return;
  }

  alertAdmin("Secteur supprimé.");
  await loadAll();
}

// ==================================================
// 10. SUPPRESSION MATÉRIAU
// ==================================================

async function deleteMaterial(id) {
  if (!adminAuthorized) return;

  if (!confirm("Voulez-vous vraiment supprimer ce matériau ?")) {
    return;
  }

  const { error } = await supabase
    .from("materials")
    .delete()
    .eq("id", id);

  if (error) {
    alertAdmin("Erreur : " + error.message, true);
    return;
  }

  alertAdmin("Matériau supprimé.");
  await loadAll();
}

// ==================================================
// 11. DÉCONNEXION
// ==================================================

async function logout() {
  const { error } = await supabase.auth.signOut();

  if (error) {
    alertAdmin("Erreur pendant la déconnexion.", true);
    return;
  }

  adminAuthorized = false;
  window.location.replace("auth.html");
}

// ==================================================
// 12. ÉVÉNEMENTS
// ==================================================

document.addEventListener("click", async event => {
  if (!adminAuthorized) return;

  const sectorButton = event.target.closest("[data-delete-sector]");

  if (sectorButton) {
    await deleteSector(sectorButton.dataset.deleteSector);
    return;
  }

  const materialButton = event.target.closest("[data-delete-material]");

  if (materialButton) {
    await deleteMaterial(materialButton.dataset.deleteMaterial);
    return;
  }

  if (event.target.closest("#logout-btn")) {
    await logout();
  }
});

// ==================================================
// 13. DÉMARRAGE
// ==================================================

async function startAdmin() {
  const authorized = await requireAdmin();

  if (!authorized) {
    // L'administration reste inutilisable.
    document.body.style.visibility = "hidden";
    return;
  }

  await loadAll();
}

startAdmin();
