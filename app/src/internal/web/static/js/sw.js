/* Brewhouse service worker — cache shell/static; API always hits network. */
const SW_VERSION = new URL(self.location.href).searchParams.get("v") || "dev";
const CACHE_NAME = "brewhouse-" + SW_VERSION;

const PRECACHE = [
	"/",
	"/static/css/app.css",
	"/static/js/htmx.min.js",
	"/static/js/i18n.js",
	"/static/js/wasm_loader.js",
	"/static/js/wasm_exec.js",
	"/static/js/core/api.js",
	"/static/js/core/ui.js",
	"/static/js/core/panel_registry.js",
	"/static/js/panels/recipes.js",
	"/static/js/panels/schedule.js",
	"/static/js/panels/brewday.js",
	"/static/js/panels/inventory.js",
	"/static/js/panels/orders.js",
	"/static/js/panels/hygiene.js",
	"/static/js/panels/tools_calculators.js",
	"/static/js/panels/economy.js",
	"/static/js/panels/economy_deliveries.js",
	"/static/js/panels/delivery.js",
	"/static/js/panels/iam_users.js",
	"/static/js/panels/iam_breweries.js",
	"/static/js/panels/settings_brand.js",
	"/static/js/panels/settings_tanks.js",
	"/static/js/panels/settings_multipliers.js",
	"/static/js/panels/settings_suppliers.js",
	"/static/js/panels/settings_beer_price.js",
	"/static/js/panels/settings_regional.js",
	"/static/js/panels/settings_hygiene.js",
	"/static/js/panels/settings_backup.js",
	"/static/js/panels/setup_wizard.js",
	"/static/wasm/app.wasm",
	"/static/fonts/material-symbols-outlined.woff2",
	"/static/manifest.webmanifest",
	"/static/images/icon-192.png",
	"/static/images/icon-512.png",
	"/logo",
	"/favicon",
];

self.addEventListener("install", (event) => {
	event.waitUntil(
		caches
			.open(CACHE_NAME)
			.then((cache) => cache.addAll(PRECACHE))
			.then(() => self.skipWaiting())
	);
});

self.addEventListener("activate", (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) =>
				Promise.all(
					keys
						.filter((key) => key.startsWith("brewhouse-") && key !== CACHE_NAME)
						.map((key) => caches.delete(key))
				)
			)
			.then(() => self.clients.claim())
	);
});

self.addEventListener("fetch", (event) => {
	const req = event.request;
	if (req.method !== "GET") {
		return;
	}
	const url = new URL(req.url);
	if (url.origin !== self.location.origin) {
		return;
	}
	if (url.pathname.startsWith("/api/")) {
		return;
	}

	event.respondWith(
		caches.match(req).then((cached) => {
			if (cached) {
				return cached;
			}
			return fetch(req)
				.then((res) => {
					if (res && res.ok && (url.pathname.startsWith("/static/") || url.pathname === "/" || url.pathname === "/logo" || url.pathname === "/favicon")) {
						const copy = res.clone();
						caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
					}
					return res;
				})
				.catch(() => {
					if (req.mode === "navigate") {
						return caches.match("/");
					}
					return undefined;
				});
		})
	);
});
