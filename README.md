# PortMap Offline

Offline web-based port mapping and network topology documentation tool for AV / IT / broadcast network planning.

**Version:** v3.8.94

## What is included

- Offline single-page web app
- Port Map view, Devices view, Topology view, Print Layout view
- Import / Export PortMap project files (`.portmap`)
- Export PDF, and PNG / SVG from Topology
- Edit Port and Edit Switch dialogs with tag and VLAN suggestions

## How to run

Open `index.html` directly in a browser. No build step is required.

Recommended browsers: Microsoft Edge, Google Chrome.

## Notes

This is an offline tool. It does not require a backend server and does not make external network calls. Project data is stored locally in the browser and can be exported / imported as `.portmap` files.

## Project structure

```text
PortMap/
├── index.html
├── static/
│   ├── app.js
│   └── style.css
├── assets/
│   ├── rj45_jack_only.png
│   └── rj45_port_mask.png
└── README.md
```
