import { supabase, escapeHtml, whatsappLink } from "./supabase.js";
import { COMPANY_EMAIL } from "./settings.js";

const $ = id => document.getElementById(id);
$("year").textContent = new Date().getFullYear();

$("menu-toggle").addEventListener("click", () => {
  const opened = $("nav-links").classList.toggle("open");
  $("menu-toggle").setAttribute("aria-expanded", String(opened));
});
document.querySelectorAll("#nav-links a").forEach(a =>
  a.addEventListener("click", () => $("nav-links").classList.remove("open"))
);

// La base existante utilise des noms de tables et de colonnes en français.
// On normalise les lignes ici pour que le reste de l'interface soit lisible.
let sectors = [];
let materials = [];

function normalizeSector(row) {
  return {
    id: row.id,
    name: row.name || "",
    description: row.description || "",
    image_url: row.image_url || "",
    is_active: row.is_active !== false
  };
}

function normalizeMaterial(row) {
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
function sectorImage(sector) {
  return sector.image_url || "assets/posters/catalogue-services.webp";
}
function contactMessage(name, item) {
  return `Bonjour BUILDREAM SARL,\nJe souhaite obtenir des informations sur : ${item}.\nNom : ${name || "Client"}.\nMerci de me recontacter.`;
}
function renderSectors() {
  const grid = $("sector-grid");
  const active = sectors.filter(s => s.is_active !== false);
  if (!active.length) {
    grid.innerHTML = `<p class="empty-state">Nos secteurs seront bientôt présentés ici. Contactez-nous pour toute demande.</p>`;
    return;
  }
  grid.innerHTML = active.map(s => `
    <article class="sector-card">
      <img src="${escapeHtml(sectorImage(s))}" alt="${escapeHtml(s.name)}" loading="lazy" onerror="this.src='assets/posters/catalogue-services.webp'">
      <div class="sector-card-content"><h3>${escapeHtml(s.name)}</h3><p>${escapeHtml(s.description || "Contactez notre équipe pour découvrir les prestations de ce secteur.")}</p><a href="#catalogue" data-sector="${escapeHtml(s.id)}">VOIR LES ARTICLES →</a></div>
    </article>`).join("");
  grid.querySelectorAll("[data-sector]").forEach(a => a.addEventListener("click", () => {
    $("sector-filter").value = a.dataset.sector;
    renderMaterials();
  }));
}
function renderMaterials() {
  const query = $("material-search").value.trim().toLocaleLowerCase("fr");
  const sectorId = $("sector-filter").value;
  const filtered = materials.filter(m => m.available !== false &&
    (!sectorId || String(m.sector_id) === String(sectorId)) &&
    (!query || [m.name, m.description, m.uses].join(" ").toLocaleLowerCase("fr").includes(query)));
  $("catalog-count").textContent = `${filtered.length} article(s)`;
  if (!filtered.length) {
    $("material-grid").innerHTML = `<p class="empty-state">Aucun article ne correspond à votre recherche. Écrivez-nous pour vérifier la disponibilité.</p>`;
    return;
  }
  $("material-grid").innerHTML = filtered.map(m => {
    const sector = sectors.find(s => String(s.id) === String(m.sector_id));
    const message = contactMessage("", m.name);
    const wa = whatsappLink(message);
    const mail = `mailto:${COMPANY_EMAIL}?subject=${encodeURIComponent("Demande d'information : " + m.name)}&body=${encodeURIComponent(message)}`;
    return `<article class="material-card">
      <div class="material-photo">${m.image_url ? `<img src="${escapeHtml(m.image_url)}" alt="${escapeHtml(m.name)}" loading="lazy" onerror="this.parentElement.textContent='Image non disponible'">` : `BUILDREAM SARL`}</div>
      <div class="material-content"><span class="material-sector">${escapeHtml(sector?.name || "Catalogue")}</span>
      <h3>${escapeHtml(m.name)}</h3><p>${escapeHtml(m.description || "Contactez-nous pour obtenir les caractéristiques de cet article.")}</p>
      ${m.uses ? `<p class="material-uses"><b>Applications :</b> ${escapeHtml(m.uses)}</p>` : ""}
      <span class="available">● Disponibilité à confirmer auprès de l'équipe</span>
      <div class="material-actions">${wa ? `<a href="${wa}" target="_blank" rel="noopener">WhatsApp</a>` : ""}<a href="${mail}">Demander les détails</a></div></div></article>`;
  }).join("");
}
async function loadCatalog() {
  const [sectorResult, materialResult] = await Promise.all([
    supabase.from("sectors").select("*").order("id"),
    supabase.from("materials").select("*").order("name")
  ]);

  if (sectorResult.error) console.error(sectorResult.error);
  if (materialResult.error) console.error(materialResult.error);

  sectors = (sectorResult.data || []).map(normalizeSector);
  materials = (materialResult.data || []).map(normalizeMaterial);

  if (sectorResult.error || materialResult.error) {
    $("material-grid").innerHTML =
      `<p>Impossible de charger le catalogue.</p>`;
  }

  $("sector-filter").innerHTML =
    `<option value="">Tous les secteurs</option>` +
    sectors.filter(s => s.is_active).map(s =>
      `<option value="${escapeHtml(s.id)}">${escapeHtml(s.name)}</option>`
    ).join("");

  renderSectors();
  renderMaterials();
}
$("material-search").addEventListener("input", renderMaterials);
$("sector-filter").addEventListener("change", renderMaterials);

function readContactForm() {
  return {
    name: $("contact-name").value.trim(),
    email: $("contact-email").value.trim(),
    subject: $("contact-subject").value,
    message: $("contact-message").value.trim()
  };
}
function makeContactText(d) {
  return `Bonjour BUILDREAM SARL,\n\nNom : ${d.name}\nEmail : ${d.email}\nObjet : ${d.subject}\n\nMessage :\n${d.message}`;
}
async function saveInquiry(d) {
  const { error } = await supabase.from("demandes_contact").insert([{
    nom: d.name, email: d.email, objet: d.subject, message: d.message
  }]);
  if (error) console.warn("Demande non enregistrée dans Supabase:", error.message);
}
$("send-email").addEventListener("click", async () => {
  const d = readContactForm();
  if (!$("contact-form").reportValidity()) return;
  await saveInquiry(d);
  const subject = encodeURIComponent(`[BUILDREAM] ${d.subject}`);
  const body = encodeURIComponent(makeContactText(d));
  window.location.href = `mailto:${COMPANY_EMAIL}?subject=${subject}&body=${body}`;
  $("contact-feedback").textContent = "Votre application de messagerie va s'ouvrir avec le message préparé.";
});
$("send-whatsapp").addEventListener("click", async () => {
  const d = readContactForm();
  if (!$("contact-form").reportValidity()) return;
  const url = whatsappLink(makeContactText(d));
  if (!url) {
    $("contact-feedback").textContent = "Le numéro WhatsApp n'est pas configuré. Renseignez-le dans js/settings.js.";
    return;
  }
  await saveInquiry(d);
  window.open(url, "_blank", "noopener");
});
loadCatalog();
