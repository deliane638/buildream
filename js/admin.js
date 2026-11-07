
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
  const element = $("admin-alert");

  if (!element) {
    console.log(message);
    return;
  }

  element.textContent = message;
  element.classList.remove("hidden");
  element.style.color = isError ? "#b42318" : "#16845d";
}

// ==================================================
// 2. SÉCURITÉ : CONNEXION ET RÔLE
// ==================================================

async function requireAdmin() {
  const { data, error } = await supabase.auth.getSession();

  if (error || !data?.session) {
    window.location.replace("auth.html");
    return false;
  }

  const user = data.session.user;

  const { data: profile, error: profileError } = await supabase
    .from("profile")
    .select("id, full_name, role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    alertAdmin("Erreur de vérification : " + profileError.message, true);
    return false;
  }

  if (!profile) {
    alertAdmin("Aucun profil trouvé pour ce compte.", true);
    return false;
  }

  const role = String(profile.role || "").trim().toLowerCase();

  if (!["admin", "staff"].includes(role)) {
    alertAdmin("Accès refusé : rôle non autorisé.", true);
    window.location.replace("index.html");
    return false;
  }

  $("admin-user").textContent =
    `${profile.full_name || user.email} · ${role}`;

  adminAuthorized = true;
  return true;
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

  const [sectorResult, materialResult] = await Promise.all([
    supabase.from("sectors").select("*").order("id"),
    supabase.from("materials").select("*").order("name")
  ]);

  if (sectorResult.error) {
    alertAdmin("Erreur secteurs : " + sectorResult.error.message, true);
    return;
  }

  if (materialResult.error) {
    alertAdmin("Erreur matériaux : " + materialResult.error.message, true);
    return;
  }

  sectors = (sectorResult.data || []).map(sectorFromDb);
  materials = (materialResult.data || []).map(materialFromDb);

  await loadInquiries();
  renderAll();

  alertAdmin("Données chargées avec succès.");
}

// ==================================================
// 5. DEMANDES DE CONTACT
// ==================================================

async function loadInquiries() {
  const { data, error } = await supabase
    .from("demandes_contact")
    .select("*");

  if (error) {
    console.warn("Demandes de contact :", error.message);
    inquiries = [];
    return;
  }

  inquiries = data || [];

  inquiries.sort((a, b) =>
    String(b.cree_a || b.created_at || "")
      .localeCompare(String(a.cree_a || a.created_at || ""))
  );
}

function renderInquiries() {
  const container = $("request-list");
  if (!container) return;

  if (!inquiries.length) {
    container.innerHTML =
      '<tr><td colspan="7">Aucune demande trouvée.</td></tr>';
    return;
  }

  container.innerHTML = inquiries.map(item => `
    <tr>
      <td>${escapeHtml(item.cree_a || item.created_at || "")}</td>
      <td>${escapeHtml(item.nom || item.name || "")}</td>
      <td>${escapeHtml(item.email || "")}</td>
      <td>${escapeHtml(item.objet || item.subject || "")}</td>
      <td>${escapeHtml(item.message || "")}</td>
      <td>${escapeHtml(item.statut || item.status || "En attente")}</td>
      <td></td>
    </tr>
  `).join("");
}

// ==================================================
// 6. STATISTIQUES
// ==================================================

function renderStats() {
  $("stat-materials").textContent = materials.length;
  $("stat-sectors").textContent = sectors.length;
  $("stat-requests").textContent = inquiries.length;
}

// ==================================================
// 7. LISTE DES SECTEURS
// ==================================================

function renderSectors() {
  const container = $("sector-list");
  if (!container) return;

  if (!sectors.length) {
    container.innerHTML = "<p>Aucun secteur enregistré.</p>";
    return;
  }

  container.innerHTML = sectors.map(sector => `
    <article class="admin-item">
      <h3>${escapeHtml(sector.name)}</h3>
      <p>${escapeHtml(sector.description)}</p>

      <button type="button"
        class="btn btn-light"
        data-edit-sector="${escapeHtml(sector.id)}">
        Modifier
      </button>

      <button type="button"
        class="btn btn-light"
        data-delete-sector="${escapeHtml(sector.id)}">
        Supprimer
      </button>
    </article>
  `).join("");
}

// ==================================================
// 8. LISTE DES MATÉRIAUX
// ==================================================

function renderMaterials() {
  let container = $("material-list");

  if (!container) {
    container = document.createElement("div");
    container.id = "material-list";
    container.className = "admin-list";

    $("material-form").after(container);
  }

  if (!materials.length) {
    container.innerHTML = "<p>Aucun matériau enregistré.</p>";
    return;
  }

  container.innerHTML = materials.map(material => `
    <article class="admin-item">
      <h3>${escapeHtml(material.name)}</h3>
      <p>${escapeHtml(material.descriptions)}</p>
      <p>${escapeHtml(material.uses)}</p>
      <p>${material.available ? "Disponible" : "Indisponible"}</p>

      <button type="button"
        class="btn btn-light"
        data-edit-material="${escapeHtml(material.id)}">
        Modifier
      </button>

      <button type="button"
        class="btn btn-light"
        data-delete-material="${escapeHtml(material.id)}">
        Supprimer
      </button>
    </article>
  `).join("");
}

// ==================================================
// 9. REMPLIR LA LISTE DES SECTEURS DU FORMULAIRE
// ==================================================

function renderSectorOptions() {
  const select = $("material-sector");
  if (!select) return;

  const previousValue = select.value;

  select.innerHTML = `
    <option value="">Choisir un secteur</option>
    ${sectors.map(sector => `
      <option value="${escapeHtml(sector.id)}">
        ${escapeHtml(sector.name)}
      </option>
    `).join("")}
  `;

  if (sectors.some(s => String(s.id) === previousValue)) {
    select.value = previousValue;
  }
}

// ==================================================
// 10. AFFICHAGE GLOBAL
// ==================================================

function renderAll() {
  renderStats();
  renderSectors();
  renderMaterials();
  renderSectorOptions();
  renderInquiries();
}

// ==================================================
// 11. AJOUT / MODIFICATION D'UN SECTEUR
// ==================================================

$("sector-form").addEventListener("submit", async event => {
  event.preventDefault();
  if (!adminAuthorized) return;

  const id = $("sector-id").value;

  const sector = {
    name: $("sector-name").value.trim(),
    description: $("sector-description").value.trim(),
    image_url: $("sector-image").value.trim()
  };

  if (!sector.name) {
    alertAdmin("Le nom du secteur est obligatoire.", true);
    return;
  }

  const button = $("sector-save");
  button.disabled = true;

  let result;

  if (id) {
    result = await supabase
      .from("sectors")
      .update(sector)
      .eq("id", id);
  } else {
    result = await supabase
      .from("sectors")
      .insert([sector]);
  }

  button.disabled = false;

  if (result.error) {
    alertAdmin("Erreur d'enregistrement : " + result.error.message, true);
    return;
  }

  $("sector-form").reset();
  $("sector-id").value = "";
  button.textContent = "Ajouter le secteur";
  $("sector-cancel").style.display = "none";

  alertAdmin(id ? "Secteur modifié." : "Secteur ajouté.");

  await loadAll();
});

// ==================================================
// 12. AJOUT / MODIFICATION D'UN MATÉRIAU
// ==================================================

$("material-form").addEventListener("submit", async event => {
  event.preventDefault();
  if (!adminAuthorized) return;

  const id = $("material-id").value;
  const sectorId = $("material-sector").value;

  if (!sectorId) {
    alertAdmin("Choisis un secteur.", true);
    return;
  }

  const material = {
    name: $("material-name").value.trim(),
    sector_id: sectorId,
    descriptions: $("material-description").value.trim(),
    uses: $("material-uses").value.trim(),
    image_url: $("material-image").value.trim(),
    available: $("material-available").checked
  };

  const button = $("material-save");
  button.disabled = true;

  let result;

  if (id) {
    result = await supabase
      .from("materials")
      .update(material)
      .eq("id", id);
  } else {
    result = await supabase
      .from("materials")
      .insert([material]);
  }

  button.disabled = false;

  if (result.error) {
    alertAdmin("Erreur d'enregistrement : " + result.error.message, true);
    return;
  }

  $("material-form").reset();
  $("material-id").value = "";
  $("material-available").checked = true;

  button.textContent = "Enregistrer l'article";
  $("material-cancel").style.display = "none";

  alertAdmin(id ? "Article modifié." : "Article ajouté.");

  await loadAll();
});

// ==================================================
// 13. MODIFIER UN SECTEUR
// ==================================================

function editSector(id) {
  const sector = sectors.find(item => String(item.id) === String(id));
  if (!sector) return;

  $("sector-id").value = sector.id;
  $("sector-name").value = sector.name;
  $("sector-description").value = sector.description;
  $("sector-image").value = sector.image_url;

  $("sector-save").textContent = "Enregistrer les modifications";
  $("sector-cancel").style.display = "inline-block";

  $("sectors").scrollIntoView({ behavior: "smooth" });
}

// ==================================================
// 14. MODIFIER UN MATÉRIAU
// ==================================================

function editMaterial(id) {
  const material = materials.find(item => String(item.id) === String(id));
  if (!material) return;

  $("material-id").value = material.id;
  $("material-name").value = material.name;
  $("material-sector").value = material.sector_id;
  $("material-description").value = material.descriptions;
  $("material-uses").value = material.uses;
  $("material-image").value = material.image_url;
  $("material-available").checked = material.available;

  $("material-save").textContent = "Enregistrer les modifications";
  $("material-cancel").style.display = "inline-block";

  $("materials").scrollIntoView({ behavior: "smooth" });
}

// ==================================================
// 15. SUPPRIMER UN SECTEUR
// ==================================================

async function deleteSector(id) {
  if (!adminAuthorized) return;

  const used = materials.some(
    material => String(material.sector_id) === String(id)
  );

  if (used) {
    alertAdmin(
      "Ce secteur contient des matériaux. Déplace-les ou supprime-les d'abord.",
      true
    );
    return;
  }

  if (!confirm("Veux-tu vraiment supprimer ce secteur ?")) return;

  const { error } = await supabase
    .from("sectors")
    .delete()
    .eq("id", id);

  if (error) {
    alertAdmin("Erreur de suppression : " + error.message, true);
    return;
  }

  alertAdmin("Secteur supprimé.");
  await loadAll();
}

// ==================================================
// 16. SUPPRIMER UN MATÉRIAU
// ==================================================

async function deleteMaterial(id) {
  if (!adminAuthorized) return;

  if (!confirm("Veux-tu vraiment supprimer cet article ?")) return;

  const { error } = await supabase
    .from("materials")
    .delete()
    .eq("id", id);

  if (error) {
    alertAdmin("Erreur de suppression : " + error.message, true);
    return;
  }

  alertAdmin("Article supprimé.");
  await loadAll();
}

// ==================================================
// 17. ANNULER LES MODIFICATIONS
// ==================================================

$("sector-cancel").addEventListener("click", () => {
  $("sector-form").reset();
  $("sector-id").value = "";
  $("sector-save").textContent = "Ajouter le secteur";
  $("sector-cancel").style.display = "none";
});

$("material-cancel").addEventListener("click", () => {
  $("material-form").reset();
  $("material-id").value = "";
  $("material-available").checked = true;
  $("material-save").textContent = "Enregistrer l'article";
  $("material-cancel").style.display = "none";
});

// ==================================================
// 18. BOUTONS ET ACTIONS
// ==================================================

document.addEventListener("click", async event => {
  if (!adminAuthorized) return;

  const editSectorButton = event.target.closest("[data-edit-sector]");
  if (editSectorButton) {
    editSector(editSectorButton.dataset.editSector);
    return;
  }

  const deleteSectorButton = event.target.closest("[data-delete-sector]");
  if (deleteSectorButton) {
    await deleteSector(deleteSectorButton.dataset.deleteSector);
    return;
  }

  const editMaterialButton = event.target.closest("[data-edit-material]");
  if (editMaterialButton) {
    editMaterial(editMaterialButton.dataset.editMaterial);
    return;
  }

  const deleteMaterialButton = event.target.closest("[data-delete-material]");
  if (deleteMaterialButton) {
    await deleteMaterial(deleteMaterialButton.dataset.deleteMaterial);
    return;
  }
});

// ==================================================
// 19. ACTUALISER LES DEMANDES
// ==================================================

$("refresh-requests").addEventListener("click", async () => {
  if (!adminAuthorized) return;

  await loadInquiries();
  renderStats();
  renderInquiries();

  alertAdmin("Demandes actualisées.");
});

// ==================================================
// 20. DÉCONNEXION
// ==================================================

$("logout").addEventListener("click", async () => {
  const { error } = await supabase.auth.signOut();

  if (error) {
    alertAdmin("Erreur de déconnexion : " + error.message, true);
    return;
  }

  adminAuthorized = false;
  window.location.replace("auth.html");
});

// ==================================================
// 21. DÉMARRAGE
// ==================================================

async function startAdmin() {
  try {
    const authorized = await requireAdmin();

    if (!authorized) return;

    await loadAll();

  } catch (error) {
    console.error(error);
    alertAdmin("Une erreur inattendue est survenue.", true);
  }
}

startAdmin();
