# PortMap Offline

Offline web-based port mapping and network topology documentation tool for AV / IT / broadcast network planning.

## Current build

**v3.8.94 — PortMap Project File Wording Cleanup**

This package is prepared as a clean GitHub-ready project from the latest accepted working build.

## What is included

- Offline single-page web app
- Port Map view
- Devices view
- Topology view
- Print Layout view
- Import / Export PortMap project files
- Export PDF
- Export PNG / SVG from Topology
- Edit Port and Edit Switch dialogs
- Tag suggestions in Edit Port
- VLAN suggestions in Edit Port
- Responsive top bar fixes
- Topology info popup auto-close on view change

## How to run

Open `index.html` directly in a browser.

No build step is required.

Recommended browsers:

- Microsoft Edge
- Google Chrome

## Project structure

```text
PortMap_Offline/
├── index.html
├── static/
│   ├── app.js
│   └── style.css
├── assets/
│   ├── rj45_jack_only.png
│   └── rj45_port_mask.png
├── README.md
├── README.txt
├── VERSION.txt
└── .gitignore
```

## Notes

This is an offline tool. It does not require a backend server and does not make external network calls.

Project data is stored locally in the browser and can be exported/imported as `.portmap` project files.

## Safe continuation point

This GitHub-ready package should be treated as the clean continuation point after v3.8.94.


## v3.8.89

- Top bar `New Project` now creates a NETGEAR AV template project.
- Default template uses modern NETGEAR AV/Core switch model names: M4500 XSM4556, M4350 MSM4332, and M4250 GSM4230PX.
- No export, topology, print layout, or data-model behavior changed.


## Project files

PortMap project backups are exported as `.portmap` files. Older backup files can still be imported for compatibility.


## v3.8.92

- First launch keeps the NETGEAR AV template.
- New Project now creates a blank project.

## v3.8.93

- Project export now uses the `.portmap` file extension.
- Older backup imports remain supported.

## v3.8.94

- User-facing project file wording cleaned up to use PortMap project files.
