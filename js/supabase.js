import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY, WHATSAPP_NUMBER } from "./settings.js";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, c => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
  })[c]);
}

export function whatsappLink(message) {
  const number = String(WHATSAPP_NUMBER || "").replace(/\\D/g, "");
  return number ? `https://wa.me/${number}?text=${encodeURIComponent(message)}` : "";
}

export function showMessage(element, message, isError = false) {
  if (!element) return;
  element.textContent = message;
  element.style.color = isError ? "#b42318" : "#16845d";
}
