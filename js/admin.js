
import { supabase, escapeHtml } from "./supabase.js";

const $ = id => document.getElementById(id);

let sectors = [];
let materials = [];
let inquiries = [];

// ==================================================
// 1. ADAPTATION DES DONNÉES SUPABASE
// ==================================================

function sectorFromDb(row) {
  return {
    id: row.id,
    name: row.name || "",
    description: row.description || "",
    image_url: row.image_url || "",
    is_active: row.is_active !== false
  };
}

function materialFromDb(row) {
  return {
    id: row.id,
    name: row.name || "",
    description: row.descriptions || "",
    uses: row.uses || "",
    image_url: row.image_url || "",
    available: row.available !== false,
    sector_id: row.sector_id
  };
}

// ==================================================
// 2. AFFICHAGE DES ALERTES
// ==================================================

function alertAdmin(message, error = false) {
  const el = $("admin-alert");

  el.textContent = message;
  el.classList.remove("hidden");

  el.style.background = error ? "#fff0ef" : "#e9f7ef";
  el.style.color = error ? "#a12622" : "#176b49";
}

// ==================================================
// 3. VÉRIFICATION DE L'ADMINISTRATEUR
// ==================================================

async function requireAdmin() {
  const { data, error } = await supabase.auth.getSession();

  const session = data?.session;

  if (error || !session) {
    location.href = "auth.html";
    return false;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profile")
    .select("id, full_name, role")
    .eq("id", session.user.id)
    .maybeSingle();

  if (profileError) {
    alertAdmin(
      "Impossible de vérifier votre rôle : " + profileError.message,
      true
    );
    return false;
  }

  const role = profile?.role;

  if (!profile || !["admin", "staff"].includes(role)) {
    alertAdmin(
      "Accès refusé. Ce compte ne possède pas les droits d'administration.",
      true
    );

    setTimeout(() => {
      location.href = "index.html";
    }, 1800);

    return false;
  }

  $("admin-user").textContent =
    `${profile.full_name || session.user.email} · ${role}`;

  return true;
}

// ==================================================
// 4. CHARGEMENT DES DONNÉES
// ==================================================

async function loadAll() {
  const [s, m, i] = await Promise.all([
    supabase
      .from("sectors")
      .select("*")
      .order("id"),

    supabase
      .from("materials")
      .select("*")
      .order("name"),

    supabase
      .from("demandes_contact")
      .select("*")
      .order("cree_a", { ascending: false })
      .limit(100)
  ]);

  if (s.error) {
    alertAdmin("Erreur secteurs : " + s.error.message, true);
  }

  if (m.error) {
    alertAdmin("Erreur matériaux : " + m.error.message, true);
  }

  if (i.error) {
    console.error("Erreur demandes :", i.error.message);
  }

  sectors = (s.data || []).map(sectorFromDb);
  materials = (m.data || []).map(materialFromDb);
  inquiries = i.data || [];

  $("stat-materials").textContent = materials.length;

  $("stat-sectors").textContent =
    sectors.filter(s => s.is_active).length;

  $("stat-requests").textContent = inquiries.length;

  renderSectorOptions();
  renderSectorList();
  renderMaterialsTable();
  renderInquiries();
}

// ==================================================
// 5. GESTION DES OPTIONS DE SECTEURS
// ==================================================

function renderSectorOptions(selected = "") {
  $("material-sector").innerHTML =
    `<option value="">Choisir un secteur</option>` +

    sectors.map(s => `
      <option
        value="${escapeHtml(s.id)}"
        ${String(s.id) === String(selected) ? "selected" : ""}
      >
        ${escapeHtml(s.name)}
      </option>
    `).join("");
}

// ==================================================
// 6. AFFICHAGE DES SECTEURS
// ==================================================

function renderSectorList() {
  $("sector-list").innerHTML = sectors.length
    ? sectors.map(s => `
      <div class="admin-list-item">
        <div>
          <b>${escapeHtml(s.name)}</b>
          <br>
          <small>${s.is_active ? "Visible" : "Masqué"}</small>
        </div>

        <div>
          <button data-edit-sector="${escapeHtml(s.id)}">
            Modifier
          </button>

          <button data-toggle-sector="${escapeHtml(s.id)}">
            ${s.is_active ? "Masquer" : "Afficher"}
          </button>
        </div>
      </div>
    `).join("")
    : "Aucun secteur enregistré.";

  $("sector-list")
    .querySelectorAll("[data-edit-sector]")
    .forEach(button => {
      button.addEventListener("click", () => {
        editSector(button.dataset.editSector);
      });
    });

  $("sector-list")
    .querySelectorAll("[data-toggle-sector]")
    .forEach(button => {
      button.addEventListener("click", () => {
        toggleSector(button.dataset.toggleSector);
      });
    });
}

// ==================================================
// 7. AFFICHAGE DES MATÉRIAUX
// ==================================================

function renderMaterialsTable() {
  if (!$("material-table-body")) {
    const wrap = document.createElement("div");

    wrap.className = "table-wrap";

    wrap.innerHTML = `
      <h3 style="margin:28px 0 12px;color:#10243e">
        Articles enregistrés
      </h3>

      <table>
        <thead>
          <tr>
            <th>Article</th>
            <th>Secteur</th>
            <th>Visibilité</th>
            <th>Actions</th>
          </tr>
        </thead>

        <tbody id="material-table-body"></tbody>
      </table>
    `;

    $("materials").appendChild(wrap);
  }

  const tbody = $("material-table-body");

  tbody.innerHTML = materials.length
    ? materials.map(m => `
      <tr>
        <td>
          <b>${escapeHtml(m.name)}</b>
          <br>
          <small>${escapeHtml(m.description)}</small>
        </td>

        <td>
          ${escapeHtml(
            sectors.find(s =>
              String(s.id) === String(m.sector_id)
            )?.name || "—"
          )}
        </td>

        <td>
          <span class="status-pill ${m.available ? "" : "closed"}">
            ${m.available ? "Visible" : "Masqué / indisponible"}
          </span>
        </td>

        <td>
          <button class="table-action"
            data-edit-material="${escapeHtml(m.id)}">
            Modifier
          </button>

          <button class="table-action"
            data-toggle-material="${escapeHtml(m.id)}">
            ${m.available ? "Masquer" : "Afficher"}
          </button>

          <button class="table-action"
            data-delete-material="${escapeHtml(m.id)}">
            Supprimer
          </button>
        </td>
      </tr>
    `).join("")
    : `<tr><td colspan="4">Aucun article enregistré.</td></tr>`;

  tbody.querySelectorAll("[data-edit-material]")
    .forEach(button => {
      button.addEventListener("click", () => {
        editMaterial(button.dataset.editMaterial);
      });
    });

  tbody.querySelectorAll("[data-toggle-material]")
    .forEach(button => {
      button.addEventListener("click", () => {
        toggleMaterial(button.dataset.toggleMaterial);
      });
    });

  tbody.querySelectorAll("[data-delete-material]")
    .forEach(button => {
      button.addEventListener("click", () => {
        deleteMaterial(button.dataset.deleteMaterial);
      });
    });
}

// ==================================================
// 8. GESTION DES DEMANDES DE CONTACT
// ==================================================

function renderInquiries() {
  $("request-list").innerHTML = inquiries.length
    ? inquiries.map(q => `
      <tr>
        <td>
          ${q.cree_a
            ? new Date(q.cree_a).toLocaleDateString("fr-FR")
            : "—"}
        </td>

        <td>${escapeHtml(q.nom)}</td>

        <td>
          <a href="mailto:${escapeHtml(q.email)}">
            ${escapeHtml(q.email)}
          </a>
        </td>

        <td>${escapeHtml(q.objet)}</td>

        <td>${escapeHtml(q.message)}</td>

        <td>
          <span class="status-pill ${q.statut === "traitée" ? "" : "closed"}">
            ${escapeHtml(q.statut || "nouvelle")}
          </span>
        </td>

        <td>
          <button class="table-action"
            data-done="${escapeHtml(q.identifiant)}">
            Traitée
          </button>
        </td>
      </tr>
    `).join("")
    : `<tr><td colspan="7">Aucune demande enregistrée.</td></tr>`;

  $("request-list")
    .querySelectorAll("[data-done]")
    .forEach(button => {
      button.addEventListener("click", () => {
        markInquiry(button.dataset.done);
      });
    });
}

// ==================================================
// 9. AJOUT ET MODIFICATION DES MATÉRIAUX
// ==================================================

$("material-form").addEventListener("submit", async e => {
  e.preventDefault();

  const id = $("material-id").value;

  const row = {
    name: $("material-name").value.trim(),

    sector_id: Number($("material-sector").value),

    descriptions: $("material-description").value.trim(),

    uses: $("material-uses").value.trim(),

    image_url: $("material-image").value.trim() || null,

    available: $("material-available").checked
  };

  const result = id
    ? await supabase
        .from("materials")
        .update(row)
        .eq("id", id)

    : await supabase
        .from("materials")
        .insert([row]);

  if (result.error) {
    alertAdmin(
      "Enregistrement impossible : " + result.error.message,
      true
    );
    return;
  }

  alertAdmin(id ? "Article modifié." : "Article ajouté.");

  resetMaterialForm();

  await loadAll();
});

// ==================================================
// 10. MODIFIER UN MATÉRIAU
// ==================================================

function editMaterial(id) {
  const m = materials.find(x => String(x.id) === String(id));

  if (!m) return;

  $("material-id").value = m.id;
  $("material-name").value = m.name;
  $("material-sector").value = m.sector_id;
  $("material-description").value = m.description;
  $("material-uses").value = m.uses;
  $("material-image").value = m.image_url;
  $("material-available").checked = m.available;

  $("material-form-title").textContent = "Modifier un article";

  $("material-save").textContent =
    "Enregistrer les modifications";

  $("materials").scrollIntoView({ behavior: "smooth" });
}

// ==================================================
// 11. RÉINITIALISER LE FORMULAIRE MATÉRIAUX
// ==================================================

function resetMaterialForm() {
  $("material-form").reset();

  $("material-id").value = "";

  $("material-available").checked = true;

  $("material-form-title").textContent = "Ajouter un article";

  $("material-save").textContent = "Enregistrer l'article";
}

$("material-cancel").addEventListener("click", resetMaterialForm);

// ==================================================
// 12. MASQUER / AFFICHER UN MATÉRIAU
// ==================================================

async function toggleMaterial(id) {
  const m = materials.find(x => String(x.id) === String(id));

  if (!m) return;

  const { error } = await supabase
    .from("materials")
    .update({ available: !m.available })
    .eq("id", id);

  if (error) {
    alertAdmin(error.message, true);
  } else {
    await loadAll();
  }
}

// ==================================================
// 13. SUPPRIMER UN MATÉRIAU
// ==================================================

async function deleteMaterial(id) {
  if (!confirm("Supprimer définitivement cet article ?")) return;

  const { error } = await supabase
    .from("materials")
    .delete()
    .eq("id", id);

  if (error) {
    alertAdmin(error.message, true);
    return;
  }

  alertAdmin("Article supprimé.");

  await loadAll();
}

// ==================================================
// 14. AJOUT ET MODIFICATION DES SECTEURS
// ==================================================

$("sector-form").addEventListener("submit", async e => {
  e.preventDefault();

  const id = $("sector-id").value;

  const row = {
    name: $("sector-name").value.trim(),

    description: $("sector-description").value.trim(),

    image_url: $("sector-image").value.trim() || null,

    is_active: $("sector-active").checked
  };

  const result = id
    ? await supabase
        .from("sectors")
        .update(row)
        .eq("id", id)

    : await supabase
        .from("sectors")
        .insert([row]);

  if (result.error) {
    alertAdmin(
      "Secteur non enregistré : " + result.error.message,
      true
    );
    return;
  }

  alertAdmin(id ? "Secteur modifié." : "Secteur ajouté.");

  resetSectorForm();

  await loadAll();
});

// ==================================================
// 15. MODIFIER UN SECTEUR
// ==================================================

function editSector(id) {
  const s = sectors.find(x => String(x.id) === String(id));

  if (!s) return;

  $("sector-id").value = s.id;
  $("sector-name").value = s.name;
  $("sector-description").value = s.description;
  $("sector-image").value = s.image_url;
  $("sector-active").checked = s.is_active;

  $("sector-save").textContent = "Enregistrer les modifications";

  $("sectors").scrollIntoView({ behavior: "smooth" });
}

// ==================================================
// 16. RÉINITIALISER LE FORMULAIRE SECTEURS
// ==================================================

function resetSectorForm() {
  $("sector-form").reset();

  $("sector-id").value = "";

  $("sector-active").checked = true;

  $("sector-save").textContent = "Ajouter le secteur";
}

$("sector-cancel").addEventListener("click", resetSectorForm);

// ==================================================
// 17. MASQUER / AFFICHER UN SECTEUR
// ==================================================

async function toggleSector(id) {
  const s = sectors.find(x => String(x.id) === String(id));

  if (!s) return;

  const { error } = await supabase
    .from("sectors")
    .update({ is_active: !s.is_active })
    .eq("id", id);

  if (error) {
    alertAdmin(error.message, true);
  } else {
    await loadAll();
  }
}

// ==================================================
// 18. MARQUER UNE DEMANDE COMME TRAITÉE
// ==================================================

async function markInquiry(id) {
  const { error } = await supabase
    .from("demandes_contact")
    .update({ statut: "traitée" })
    .eq("identifiant", id);

  if (error) {
    alertAdmin(error.message, true);
  } else {
    await loadAll();
  }
}

// ==================================================
// 19. ACTUALISER LES DEMANDES
// ==================================================

$("refresh-requests").addEventListener("click", loadAll);

// ==================================================
// 20. DÉCONNEXION
// ==================================================

$("logout").addEventListener("click", async () => {
  await supabase.auth.signOut();

  location.href = "auth.html";
});

// ==================================================
// 21. DÉMARRAGE DE L'ADMINISTRATION
// ==================================================

if (await requireAdmin()) {
  await loadAll();
}
