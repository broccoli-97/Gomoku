export function $(id) {
  return document.getElementById(id);
}

export function setText(el, text) {
  if (el) el.textContent = text;
}

export function toggle(el, show) {
  if (!el) return;
  el.classList.toggle('hidden', !show);
}
