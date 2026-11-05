import { supabase, escapeHtml } from "./supabase.js";
const $ = id => document.getElementById(id);
let sectors = [];
let materials = [];
let inquiries = [];

const sectorFromDb = r => ({
  id: r.identifiant, name: r.nom || "", description: r.description || "",
  image_url: r["URL de l'image"] || "", is_active: r.visible !== false
});
const materialFromDb = r => ({
  id: r.identifiant, name: r.nom || "", description: r.descriptions || "",
  uses: r.utilise || "", image_url: r["URL de l'image"] || "",
  available: r.disponible !== false, sector_id: r.secteur_id
});
function alertAdmin(message, error=false) {
  const el = $("admin-alert");
  el.textContent = message;
  el.classList.remove("hidden");
  el.style.background = error ? "#fff0ef" : "#e9f7ef";
  el.style.color = error ? "#a12622" : "#176b49";
}
async function requireAdmin() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session) { location.href = "auth.html"; return false; }
  const { data: profile, error: profileError } = await supabase
    .from("profil").select("*").eq("identifiant", session.user.id).maybeSingle();
  if (profileError) {
    alertAdmin("Impossible de vérifier votre rôle : " + profileError.message, true);
    return false;
  }
  const role = profile?.["rôle"];
  if (!profile || !["admin", "staff"].includes(role)) {
    alertAdmin("Accès refusé. Ce compte n'a pas les droits d'administration.", true);
    setTimeout(() => location.href = "index.html", 1800);
    return false;
  }
  $("admin-user").textContent = `${profile["nom et prénom"] || session.user.email} · ${role}`;
  return true;
}
async function loadAll() {
  const [s, m, i] = await Promise.all([
    supabase.from("secteurs").select("*").order("identifiant"),
    supabase.from("matériels").select("*").order("nom"),
    supabase.from("demandes_contact").select("*").order("cree_a", { ascending: false }).limit(100)
  ]);
  const err = s.error || m.error || i.error;
  if (err) alertAdmin("Erreur de chargement : " + err.message, true);
  sectors = (s.data || []).map(sectorFromDb);
  materials = (m.data || []).map(materialFromDb);
  inquiries = i.data || [];
  $("stat-materials").textContent = materials.length;
  $("stat-sectors").textContent = sectors.filter(x => x.is_active !== false).length;
  $("stat-requests").textContent = inquiries.length;
  renderSectorOptions();
  renderSectorList();
  renderMaterialsTable();
  renderInquiries();
}
function renderSectorOptions(selected="") {
  $("material-sector").innerHTML = `<option value="">Choisir un secteur</option>` +
    sectors.map(s => `<option value="${escapeHtml(s.id)}" ${String(s.id) === String(selected) ? "selected" : ""}>${escapeHtml(s.name)}</option>`).join("");
}
function renderSectorList() {
  $("sector-list").innerHTML = sectors.length ? sectors.map(s =>
    `<div class="admin-list-item"><div><b>${escapeHtml(s.name)}</b><br><small>${s.is_active ? "Visible" : "Masqué"}</small></div><div><button data-edit-sector="${escapeHtml(s.id)}">Modifier</button> <button data-toggle-sector="${escapeHtml(s.id)}">${s.is_active ? "Masquer" : "Afficher"}</button></div></div>`
  ).join("") : "Aucun secteur enregistré.";
  $("sector-list").querySelectorAll("[data-edit-sector]").forEach(b => b.addEventListener("click", () => editSector(b.dataset.editSector)));
  $("sector-list").querySelectorAll("[data-toggle-sector]").forEach(b => b.addEventListener("click", () => toggleSector(b.dataset.toggleSector)));
}
function renderMaterialsTable() {
  if (!$("material-table-body")) {
    const wrap = document.createElement("div");
    wrap.className = "table-wrap";
    wrap.innerHTML = `<h3 style="margin:28px 0 12px;color:#10243e">Articles enregistrés</h3><table><thead><tr><th>Article</th><th>Secteur</th><th>Visibilité</th><th>Actions</th></tr></thead><tbody id="material-table-body"></tbody></table>`;
    $("materials").appendChild(wrap);
  }
  const tbody = $("material-table-body");
  tbody.innerHTML = materials.length ? materials.map(m =>
    `<tr><td><b>${escapeHtml(m.name)}</b><br><small>${escapeHtml(m.description)}</small></td><td>${escapeHtml(sectors.find(s => String(s.id) === String(m.sector_id))?.name || "—")}</td><td><span class="status-pill ${m.available ? "" : "closed"}">${m.available ? "Visible" : "Masqué / indisponible"}</span></td><td><button class="table-action" data-edit-material="${escapeHtml(m.id)}">Modifier</button> <button class="table-action" data-toggle-material="${escapeHtml(m.id)}">${m.available ? "Masquer" : "Afficher"}</button> <button class="table-action" data-delete-material="${escapeHtml(m.id)}">Supprimer</button></td></tr>`
  ).join("") : `<tr><td colspan="4">Aucun article enregistré.</td></tr>`;
  tbody.querySelectorAll("[data-edit-material]").forEach(b => b.addEventListener("click", () => editMaterial(b.dataset.editMaterial)));
  tbody.querySelectorAll("[data-toggle-material]").forEach(b => b.addEventListener("click", () => toggleMaterial(b.dataset.toggleMaterial)));
  tbody.querySelectorAll("[data-delete-material]").forEach(b => b.addEventListener("click", () => deleteMaterial(b.dataset.deleteMaterial)));
}
function renderInquiries() {
  $("request-list").innerHTML = inquiries.length ? inquiries.map(q =>
    `<tr><td>${q.cree_a ? new Date(q.cree_a).toLocaleDateString("fr-FR") : "—"}</td><td>${escapeHtml(q.nom)}</td><td><a href="mailto:${escapeHtml(q.email)}">${escapeHtml(q.email)}</a></td><td>${escapeHtml(q.objet)}</td><td>${escapeHtml(q.message)}</td><td><span class="status-pill ${q.statut === "traitée" ? "" : "closed"}">${escapeHtml(q.statut || "nouvelle")}</span></td><td><button class="table-action" data-done="${escapeHtml(q.identifiant)}">Traitée</button></td></tr>`
  ).join("") : `<tr><td colspan="7">Aucune demande enregistrée.</td></tr>`;
  $("request-list").querySelectorAll("[data-done]").forEach(b => b.addEventListener("click", () => markInquiry(b.dataset.done)));
}
$("material-form").addEventListener("submit", async e => {
  e.preventDefault();
  const id = $("material-id").value;
  const row = {
    nom: $("material-name").value.trim(),
    secteur_id: $("material-sector").value,
    descriptions: $("material-description").value.trim(),
    utilise: $("material-uses").value.trim(),
    "URL de l'image": $("material-image").value.trim() || null,
    disponible: $("material-available").checked
  };
  const result = id
    ? await supabase.from("matériels").update(row).eq("identifiant", id)
    : await supabase.from("matériels").insert([row]);
  if (result.error) { alertAdmin("Enregistrement impossible : " + result.error.message, true); return; }
  alertAdmin(id ? "Article modifié." : "Article ajouté.");
  resetMaterialForm();
  await loadAll();
});
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
  $("material-save").textContent = "Enregistrer les modifications";
  $("materials").scrollIntoView({ behavior: "smooth" });
}
function resetMaterialForm() {
  $("material-form").reset();
  $("material-id").value = "";
  $("material-available").checked = true;
  $("material-form-title").textContent = "Ajouter un article";
  $("material-save").textContent = "Enregistrer l'article";
}
$("material-cancel").addEventListener("click", resetMaterialForm);
async function toggleMaterial(id) {
  const m = materials.find(x => String(x.id) === String(id));
  if (!m) return;
  const { error } = await supabase.from("matériels").update({ disponible: !m.available }).eq("identifiant", id);
  if (error) alertAdmin(error.message, true); else await loadAll();
}
async function deleteMaterial(id) {
  if (!confirm("Supprimer définitivement cet article ?")) return;
  const { error } = await supabase.from("matériels").delete().eq("identifiant", id);
  if (error) alertAdmin(error.message, true);
  else { alertAdmin("Article supprimé."); await loadAll(); }
}
$("sector-form").addEventListener("submit", async e => {
  e.preventDefault();
  const id = $("sector-id").value;
  const row = {
    nom: $("sector-name").value.trim(),
    description: $("sector-description").value.trim(),
    "URL de l'image": $("sector-image").value.trim() || null,
    visible: $("sector-active").checked
  };
  const result = id
    ? await supabase.from("secteurs").update(row).eq("identifiant", id)
    : await supabase.from("secteurs").insert([row]);
  if (result.error) { alertAdmin("Secteur non enregistré : " + result.error.message, true); return; }
  alertAdmin(id ? "Secteur modifié." : "Secteur ajouté.");
  resetSectorForm();
  await loadAll();
});
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
function resetSectorForm() {
  $("sector-form").reset();
  $("sector-id").value = "";
  $("sector-active").checked = true;
  $("sector-save").textContent = "Ajouter le secteur";
}
$("sector-cancel").addEventListener("click", resetSectorForm);
async function toggleSector(id) {
  const s = sectors.find(x => String(x.id) === String(id));
  if (!s) return;
  const { error } = await supabase.from("secteurs").update({ visible: !s.is_active }).eq("identifiant", id);
  if (error) alertAdmin(error.message, true); else await loadAll();
}
async function markInquiry(id) {
  const { error } = await supabase.from("demandes_contact").update({ statut: "traitée" }).eq("identifiant", id);
  if (error) alertAdmin(error.message, true); else await loadAll();
}
$("refresh-requests").addEventListener("click", loadAll);
$("logout").addEventListener("click", async () => {
  await supabase.auth.signOut();
  location.href = "auth.html";
});
if (await requireAdmin()) await loadAll();
