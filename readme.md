# Allure Report Viewer

> **A serverless, client-side viewer for Allure Reports. Just drag, drop, and view.**

This tool allows you to view generated Allure Reports locally without installing the Allure CLI, Java, or spinning up a dedicated web server. It solves the CORS issues typically encountered when opening `index.html` directly.

## 🚀 Quick Start

1.  **Generate Report:** Make sure you have an `allure-report` folder containing `index.html` generated from your results.
    * *Reference:* [Generate reports manually](https://allurereport.org/docs/v3/generate-report/#generate-reports-manually-from-existing-results)
2.  **Upload:** Drag and drop the **entire** `allure-report` folder into the viewer.
3.  **Enjoy:** View your analytics immediately.

<p align="center">
  <img src="assets/drag-and-drop.gif"/>
</p>


## 🌟 Key Features

* **Zero Installation:** No Java, Python, or Allure CLI required.
* **Secure & Private:** Runs entirely in your browser's RAM. No data is uploaded to any server.
* **Smart Path Detection:** Automatically finds `index.html` even if you drop a parent directory.
* **Playwright Style:** Inspired by the [Playwright Trace Viewer](https://trace.playwright.dev) UX.

## 🛠️ How It Works

Traditional reports fail locally due to CORS policies. This viewer uses a **Service Worker** (`sw.js`) to intercept network requests and serve the report files directly from your browser's memory, bypassing file system security restrictions.

## ⚠️ Limitations

* **Memory:** Very large reports (GBs of screenshots) may impact browser performance as they are loaded into RAM.
* **Browser:** Requires a modern browser (Chrome, Edge, Firefox, Safari).

---
[MIT License](LICENSE)