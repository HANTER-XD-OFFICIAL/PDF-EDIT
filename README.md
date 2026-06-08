# 🚀 MD RASEL PDF STUDIO

**MD RASEL PDF STUDIO** is an advanced, fully responsive, and serverless client-side PDF editing and conversion suite. Powered by cutting-edge web technologies, this tool operates **100% inside your web browser**. Your documents are never uploaded to any remote server, guaranteeing absolute privacy and zero latency.

---

## 🌍 Open Live Website

Click the button below to open the application directly in your browser:

<p align="center">
  <a href="https://hanter-xd-official.github.io/PDF-EDIT/" target="_blank">
    <img src="https://img.shields.io/badge/🌍_Open_Website-MD_RASEL_PDF_STUDIO-06b6d4?style=for-the-badge&logo=google-chrome&logoColor=white" alt="Open Website" />
  </a>
</p>

<p align="center">
  <strong>🔗 Live URL:</strong> <a href="https://hanter-xd-official.github.io/PDF-EDIT/">https://hanter-xd-official.github.io/PDF-EDIT/</a>
</p>

---

## 📋 Table of Contents
- [Core Features](#-core-features)
- [Technical Architecture](#-technical-architecture)
- [Keyboard Shortcuts](#-keyboard-shortcuts)
- [Local Setup & Deployment](#-local-setup--deployment)
- [Privacy & Security](#-privacy--security)
- [Developer & Credits](#-developer--credits)

---

## ✨ Core Features

### 1. Interactive PDF Editor
* **True PDF Text Editing:** The engine automatically parses text layout nodes upon file import, positioning editable Fabric.js elements on top. Simply double-click any text block to modify, replace, resize, or move it.
* **Double-Text Overlap Prevention (Full HD Flattening):** Rather than layering transparent edits over original vector text (which causes duplicate overlapping text on export), the rendering engine compiles all modified layers into a single clean, flat document layer.
* **Image Insertion & Replacement:** Upload photos, logos, or annotations to scale, rotate, and overlay anywhere on the PDF pages.
* **Whiteout / Erase Tool:** A dedicated solid white brush tool to easily mask out or whiteout unwanted text, elements, or watermarks.
* **Digital Signatures:** Hand-draw and save electronic signatures directly inside an integrated touch-responsive sketch pad modal.
* **Page Structuring:** Rotate pages 90° clockwise or delete pages permanently from the document array with instant index reconstruction.
* **Pinch-to-Zoom & Pan:** A mobile-friendly canvas viewport allowing touch-scrolling and horizontal/vertical panning on smaller screens.

### 2. PDF to PNG Rasterizer Converter
* **Full HD Rendering:** Convert PDF pages into high-density rasterized PNG images with selectable scales ranging from standard (1.0x) to Ultra HD (3.0x).
* **Page Range Selection:** Choose to export all pages or convert selected pages only.
* **Automated ZIP Packager:** Converts and packages all rendered image files into a compressed `.zip` archive on the fly inside the browser.

### 3. Futuristic UI/UX
* **Glassmorphism Dashboard:** Immersive dark mode styling accented with neon-glow transitions and floating background particle effects.
* **Mobile Layout Optimization:** The sidebar auto-hides on mobile viewports to save screen space, accompanied by a dedicated **Immersive Full Screen** toggle.
* **Animated Splash Screen:** A premium onboarding screen transition that handles safe worker loading on startup.
* **Recent Files Cache:** Keeps track of your last 5 processed files locally in `localStorage` for rapid workflow resumption.

---

## 🛠️ Technical Architecture

This application operates completely on the client side without relying on database servers:
* **PDF.js Engine (v2.16.105):** Standard library utilized to parse and render vector PDF frames directly onto HTML5 canvases.
* **Blob-Worker CORS Bypass:** To bypass origin blocking policies on platforms like GitHub Pages, the PDF.js Web Worker is initialized dynamically using an inline Base64 blob wrapper.
* **Fabric.js (v5.3.1):** Manages interactive overlay vector elements, freehand brush parameters, shapes, and signature scaling.
* **PDF-Lib:** Used to compile structural alterations, add pages, and render flattened high-resolution canvas snapshots back into standard PDF binaries.
* **Dual-Layer Safe Downloader:** To handle download blocking policies on some mobile webviews and mobile Chrome browsers, the download pipeline features an automated HTML5 Anchor link-generation fallback mechanism.

---

## ⌨️ Keyboard Shortcuts

Speed up your editing workflow using these integrated keyboard triggers:

| Key | Action |
| --- | --- |
| **`V`** | Activates Selection/Editing Mode |
| **`T`** | Adds a New Text Layer to the Canvas |
| **`Delete` / `Backspace`** | Removes the Selected Element or Image Object |
| **`Ctrl` + Mouse Wheel** | Zooms the Active Canvas In and Out |

---

## 💻 Local Setup & Deployment

To run this project locally or host it yourself, follow these instructions:

1. **Clone the Repository:**
   ```bash
   git clone https://github.com/YOUR_USERNAME/PDF-EDIT.git
   cd PDF-EDIT
