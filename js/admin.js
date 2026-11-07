
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
  } else {
    console.log(message);
  }
}

// ==================================================
// 2. VÉRIFICATION DE L'ACCÈS ADMINISTRATEUR
// ==================================================

async function requireAdmin() {
  try {
    const { data, error } = await supabase.auth.getSession();

    if (error || !data?.session) {
      window.location.replace("auth.html");
      return false;
    }

    const session = data.session;

    const { data: profile, error: profileError } = await supabase
      .from("profile")
      .select("id, full_name, role")
      .eq("id", session.user.id)
      .maybeSingle();

    if (profileError || !profile) {
      console.error("Erreur profil :", profileError);
      alertAdmin("Impossible de vérifier votre profil.", true);
      window.location.replace("index.html");
      return false;
    }

    const role = String(profile.role || "")
      .trim()
      .toLowerCase();

    if (!["admin", "staff"].includes(role)) {
      alertAdmin("Accès réservé aux administrateurs.", true);
      window.location.replace("index.html");
      return false;
    }

    const userElement = $("admin-user");

    if (userElement) {
      userElement.textContent =
        `${profile.full_name || session.user.email} · ${role}`;
    }

    adminAuthorized = true;
    return true;

  } catch (error) {
    console.error("Erreur de sécurité :", error);
    window.location.replace("auth.html");
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

  const [sectorResult, materialResult, inquiryResult] =
    await Promise.all([
      supabase
        .from("sectors")
        .select("*")
        .order("id", { ascending: true }),

      supabase
        .from("materials")
        .select("*")
        .order("name", { ascending: true }),

      supabase
        .from("demandes_contact")
        .select("*")
        .order("cree_a", { ascending: false })
        .limit(100)
    ]);

  if (sectorResult.error) {
    console.error("Erreur secteurs :", sectorResult.error);
    alertAdmin("Erreur de chargement des secteurs.", true);
    return;
  }

  if (materialResult.error) {
    console.error("Erreur matériaux :", materialResult.error);
    alertAdmin("Erreur de chargement des matériaux.", true);
    return;
  }

  if (inquiryResult.error) {
    console.error("Erreur demandes :", inquiryResult.error);
    inquiries = [];
    console.error(
      "Vérifie la table demandes_contact et ses colonnes."
    );
  } else {
    inquiries = inquiryResult.data || [];
  }

  sectors = (sectorResult.data || []).map(sectorFromDb);
  materials = (materialResult.data || []).map(materialFromDb);

  renderAll();
  alertAdmin("Données chargées.");
}

// ==================================================
// 5. AFFICHAGE DES STATISTIQUES
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
// 6. AFFICHAGE DES SECTEURS
// ==================================================

function renderSectors() {
  const container = $("sectors-list");
  if (!container) return;

  container.innerHTML = sectors.map(sector => `
    <div class="admin-item">
      <h3>${escapeHtml(sector.name)}</h3>
      <p>${escapeHtml(sector.description)}</p>
      <button type="button"
        data-edit-sector="${escapeHtml(sector.id)}">
        Modifier
      </button>
      <button type="button"
        data-delete-sector="${escapeHtml(sector.id)}">
        Supprimer
      </button>
    </div>
  `).join("");
}

// ==================================================
// 7. AFFICHAGE DES MATÉRIAUX
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
        Disponibilité :
        ${material.available ? "Disponible" : "Indisponible"}
      </p>
      <button type="button"
        data-edit-material="${escapeHtml(material.id)}">
        Modifier
      </button>
      <button type="button"
        data-delete-material="${escapeHtml(material.id)}">
        Supprimer
      </button>
    </div>
  `).join("");
}

// ==================================================
// 8. AFFICHAGE DES DEMANDES
// ==================================================

function renderInquiries() {
  const container = $("inquiries-list");
  if (!container) return;

  container.innerHTML = inquiries.map(inquiry => `
    <div class="admin-item">
      <h3>${escapeHtml(inquiry.nom || "")}</h3>
      <p>${escapeHtml(inquiry.email || "")}</p>
      <p>${escapeHtml(inquiry.message || "")}</p>
      <p>${escapeHtml(inquiry.cree_a || "")}</p>
    </div>
  `).join("");
}

// ==================================================
// 9. AFFICHAGE GLOBAL
// ==================================================

function renderAll() {
  renderStats();
  renderSectors();
  renderMaterials();
  renderInquiries();
}

// ==================================================
// 10. SUPPRESSION D'UN SECTEUR
// ==================================================

async function deleteSector(id) {
  if (!adminAuthorized) return;

  if (!confirm("Supprimer ce secteur ?")) return;

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
// 11. SUPPRESSION D'UN MATÉRIAU
// ==================================================

async function deleteMaterial(id) {
  if (!adminAuthorized) return;

  if (!confirm("Supprimer ce matériau ?")) return;

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
// 12. DÉCONNEXION
// ==================================================

async function logout() {
  const { error } = await supabase.auth.signOut();

  if (error) {
    alertAdmin("Erreur de déconnexion.", true);
    return;
  }

  window.location.replace("auth.html");
}

// ==================================================
// 13. ÉVÉNEMENTS
// ==================================================

document.addEventListener("click", async event => {
  if (!adminAuthorized) return;

  const deleteSectorButton =
    event.target.closest("[data-delete-sector]");

  if (deleteSectorButton) {
    await deleteSector(
      deleteSectorButton.dataset.deleteSector
    );
    return;
  }

  const deleteMaterialButton =
    event.target.closest("[data-delete-material]");

  if (deleteMaterialButton) {
    await deleteMaterial(
      deleteMaterialButton.dataset.deleteMaterial
    );
    return;
  }

  if (event.target.closest("#logout-btn")) {
    await logout();
  }
});

// ==================================================
// 14. DÉMARRAGE SÉCURISÉ
// ==================================================

async function startAdmin() {
  const authorized = await requireAdmin();

  if (!authorized) return;

  await loadAll();
}

startAdmin();
