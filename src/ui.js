// HTML menus, driven by mouse, keyboard or gamepad.
import { sfx } from './audio.js';

export class Menus {
  constructor() {
    this.el = document.getElementById('menu');
    this.panel = document.getElementById('menuPanel');
    this.title = document.getElementById('title');
    this.active = null;      // the container whose buttons are navigated
    this.onBack = null;
    this.focus = 0;
  }
  get open() { return !this.el.classList.contains('hidden'); }
  /** Shows a menu. acts: {name: fn(el)}; back: fn when backing out. */
  show(html, acts, back, keepFocus) {
    const prev = keepFocus ? this.focus : 0;
    this.panel.innerHTML = html;
    this.el.classList.remove('hidden');
    this.bind(this.panel, acts);
    this.onBack = back || null;
    this.focus = Math.min(prev, this.items().length - 1);
    this.mark();
  }
  hide() { this.el.classList.add('hidden'); this.panel.innerHTML = ''; this.active = this.title.classList.contains('hidden') ? null : this.title; this.onBack = null; this.focus = 0; this.mark(); }
  showTitle(acts) { this.title.classList.remove('hidden'); this.bind(this.title, acts); this.focus = 0; this.mark(); }
  hideTitle() { this.title.classList.add('hidden'); if (this.active === this.title) this.active = null; }
  bind(root, acts) {
    this.active = root;
    root.querySelectorAll('[data-act]').forEach((b) => {
      b.onclick = (e) => { e.preventDefault(); const f = acts[b.dataset.act]; if (f && !b.classList.contains('off')) { sfx('ui'); f(b); } };
      b.onmouseenter = () => { const i = this.items().indexOf(b); if (i >= 0) { this.focus = i; this.mark(); } };
    });
  }
  items() { return this.active ? [...this.active.querySelectorAll('[data-act]')].filter((b) => b.offsetParent !== null) : []; }
  mark() { const it = this.items(); it.forEach((b, i) => b.classList.toggle('focus', i === this.focus)); if (it[this.focus]) it[this.focus].scrollIntoView({ block: 'nearest' }); }
  nav(d) {
    if (!this.active) return;
    const it = this.items();
    if (!it.length) return;
    if (d === 'up' || d === 'left') { this.focus = (this.focus - 1 + it.length) % it.length; this.mark(); sfx('ui'); }
    else if (d === 'down' || d === 'right') { this.focus = (this.focus + 1) % it.length; this.mark(); sfx('ui'); }
    else if (d === 'confirm') it[this.focus]?.click();
    else if (d === 'back' && this.onBack) { sfx('ui'); this.onBack(); }
  }
}
