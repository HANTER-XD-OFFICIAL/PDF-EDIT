# ⬡ MD RASEL PDF STUDIO

> Professional browser-based PDF editor & converter — powered by PDF.js, Fabric.js & PDF-lib.

![License: MIT](https://img.shields.io/badge/License-MIT-cyan.svg)
![GitHub Pages Ready](https://img.shields.io/badge/GitHub%20Pages-Ready-green.svg)
![No Backend](https://img.shields.io/badge/Backend-None%20Required-blueviolet.svg)

---

## ✨ Features

### PDF Editor
- **Drag & drop** PDF upload with animated progress
- **Drawing tools**: freehand brush, highlighter, text, shapes (rect/circle/arrow)
- **Signature pad**: draw & embed your signature
- **Image insertion**: embed JPG/PNG onto pages
- **Page management**: rotate, delete pages
- **Zoom in/out** (30%–300%)
- **Undo/Redo** history (per page, up to 60 steps)
- **Export**: downloads a clean PDF with all annotations embedded

### PDF → PNG Converter
- Convert **all pages** or a **custom range** (e.g. `1,3,5-8`)
- **Quality selector** (1×–4× scale)
- Individual PNG download or **bulk ZIP export**
- Live conversion progress bar

### UX
- Futuristic dark theme with **neon glow**, glassmorphism, animated particles
- One-click **light/dark toggle**
- **Recent files** history (localStorage)
- Full keyboard shortcuts
- **Mobile responsive** sidebar & toolbar
- Animated splash screen, toast notifications, modal popups
- Fullscreen editing mode

---

## 🚀 Deployment (GitHub Pages)

```bash
# 1. Fork or clone this repository
git clone https://github.com/YOUR_USERNAME/md-rasel-pdf-studio.git
cd md-rasel-pdf-studio

# 2. Push to GitHub
git add .
git commit -m "Initial deploy"
git push origin main

# 3. Enable GitHub Pages
# Go to: Repository → Settings → Pages
# Source: Deploy from branch → main → / (root)
# Save — your site will be live at:
# https://YOUR_USERNAME.github.io/md-rasel-pdf-studio/
```

No build step, no npm, no server — it's 100% static files.

---

## 📁 Project Structure

```
md-rasel-pdf-studio/
├── index.html          ← Main app (single page)
├── css/
│   └── style.css       ← Full stylesheet (dark theme, animations)
├── js/
│   ├── app.js          ← Core application logic
│   └── particles.js    ← Animated particle background
└── README.md
```

---

## ⌨️ Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Ctrl+Z` | Undo |
| `Ctrl+Y` | Redo |
| `Delete` | Delete selected object |
| `Ctrl++` | Zoom in |
| `Ctrl+-` | Zoom out |
| `Arrow →/←` | Next/Prev page |
| `F` | Fullscreen |

---

## 🛠 Libraries Used (CDN — no install needed)

| Library | Purpose |
|---------|---------|
| [PDF.js 3.11](https://mozilla.github.io/pdf.js/) | Render PDF pages to canvas |
| [PDF-lib 1.17](https://pdf-lib.js.org/) | Modify & export PDF files |
| [Fabric.js 5.3](http://fabricjs.com/) | Drawing, shapes, text, images on canvas |
| [JSZip 3.10](https://stuk.github.io/jszip/) | Create ZIP archives client-side |
| [FileSaver.js 2.0](https://github.com/eligrey/FileSaver.js/) | Download files from browser |
| [Anime.js 3.2](https://animejs.com/) | Smooth UI animations |

---

## 📄 License

MIT — free to use and modify.

---

**Powered by MD RASEL** · Built with ❤️ for the open web
