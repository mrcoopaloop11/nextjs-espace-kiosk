# eSpace Digital Kiosk

A dynamic, auto-scrolling digital signage solution built with Next.js and Tailwind CSS. This application connects to the eSpace API to display daily event schedules for churches and organizations.

It is designed to run unattended on TVs or display monitors, featuring smart text-compression, auto-scrolling, dynamic time indicators, and automated macOS deployment.

## ✨ Features

* **Real-Time Data:** Fetches approved and active events directly from the eSpace API.
* **Auto-Scrolling:** Automatically scrolls up and down smoothly for days with long event lists, pausing at the top and bottom.
* **Smart Room Compression:** Automatically groups rooms with shared prefixes to save screen real estate (e.g., `Meeting Room A`, `Meeting Room B` becomes `Meeting Room A + B`).
* **Dynamic Text Scaling:** Uses browser observers to dynamically shrink long event times or names so they perfectly fit their columns without wrapping or breaking the layout.
* **Dynamic Time Separators:** Visually breaks up the day by automatically inserting customizable time headers (e.g., 12:00 PM, 5:00 PM) between events.
* **Theming:** Supports both a default Dark Mode and a crisp Light Mode.
* **Date Agnostic:** Can display today's schedule, tomorrow's, or any specific date offset.
* **Standalone Build:** Optimized for lightweight deployment on minimal hardware.

## 🚀 Getting Started

### 1. Prerequisites

* Node.js 18.x or later (Auto-installed on macOS via scripts)
* An active eSpace API Key

### 2. Environment Variables

Create a `.env` file in the root of your project. *(Note: Must be named `.env` and not `.env.local` for the standalone installer to properly bundle it).*

```env
# Required: Your eSpace API Key (Server-side only)
ESPACE_API_KEY=your_espace_api_key_here

# Optional: Default Location Code (e.g., AN for Anaheim)
NEXT_PUBLIC_LOCATION_CODE=AN

# Optional: Override the main header title (Defaults to "Today's Schedule")
NEXT_PUBLIC_ESPACE_CHURCH_NAME="My Church Name"

# Optional: Fallback campus name if the API doesn't provide one
NEXT_PUBLIC_ESPACE_CAMPUS="Anaheim"

```

## 🍏 Automated macOS Deployment (Recommended)

For setting up dedicated Mac Minis or kiosk computers, this project includes automated Bash scripts that handle the entire deployment process, including background services and reverse proxies.

### Installation (`Install.command`)

1. Ensure your `.env` file is created and populated in the project folder.
2. Double-click `Install.command` (or run it via Terminal).
3. The script will prompt for **Administrator Credentials** via a secure macOS popup. It uses these to configure system-level network routing.

**What the installer does automatically:**

* Installs Homebrew, Node.js, and Caddy (Reverse Proxy).
* Builds the Next.js app in lightweight `standalone` mode.
* Copies necessary `public` and `static` assets.
* Configures **Caddy** to listen on Port 80 and 443 (HTTP/HTTPS) so you can access the kiosk without typing `:3000`.
* Creates a macOS `LaunchAgent` so the kiosk server starts invisibly in the background every time the computer turns on.

### Uninstallation (`uninstall.command`)

If you need to remove the kiosk or update it completely from scratch, run `uninstall.command`. It will safely stop the Caddy proxy, unload the Next.js background service, and delete the application files from `~/Library/Application Support/`.

## 🎛️ URL Parameters (Kiosk Controls)

You can customize the kiosk display on the fly by adding query parameters to the URL. This is useful if you have multiple screens showing different campuses or days.

| Parameter | Options | Default | Description |
| --- | --- | --- | --- |
| `location` | Any eSpace Loc Code | `.env` value | Filters events for a specific location code (e.g., `?location=NB`). |
| `day` | `today`, `tomorrow`, `1`, `-1` | `today` | Changes the target date. Numbers offset the current day. |
| `theme` | `dark`, `light` | `dark` | Switches the visual theme of the kiosk. |
| `filter` | `active`, `all` | `active` | `active` hides events once their end time passes. `all` shows all events for the day regardless of time. |
| `compressRooms` | `true`, `false` | `true` | Set to `false` to disable the smart grouping of room names. |

**Example URL:** `http://localhost/?location=NB&theme=light&day=tomorrow`

## ⚙️ Configuration

### Time Separators

To change or remove the divider lines (e.g., "12:00 PM", "5:00 PM") that appear between events, edit the `TIME_SEPARATORS` array at the top of `app/page.tsx`:

```typescript
const TIME_SEPARATORS = [
  { time: "12:00:00", label: "12:00 PM" },
  { time: "17:00:00", label: "5:00 PM" }
];
// To disable completely, change it to: const TIME_SEPARATORS = [];

```

## 📦 Manual Deployment (Linux / Docker)

If you are not using the macOS `Install.command`, you can deploy the `standalone` build manually.

1. Build the project:

```bash
npm run build

```

2. Next.js will generate a `.next/standalone` folder. Move this folder to your server.
3. **CRITICAL STEP:** You must manually copy the `public` folder and the `.next/static` folder into the standalone directory, otherwise styles and images will fail to load:

```bash
cp -r public .next/standalone/
cp -r .next/static .next/standalone/.next/

```

4. Start the server:

```bash
cd .next/standalone
node server.js

```

*(By default, this runs on port 3000. You can change it by passing a PORT environment variable: `PORT=8080 node server.js`)*

## 🛠️ Built With

* [Next.js](https://nextjs.org/) (App Router)
* [Tailwind CSS v4](https://tailwindcss.com/)
* [Tabler Icons](https://www.google.com/search?q=https://tabler-icons.com/)