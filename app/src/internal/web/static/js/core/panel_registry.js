(() => {
	const {
		canRoles,
		canViewEconomy,
		applyRequireRoles,
		showForbidden,
	} = window.BrewhouseCore;

	function initPanel(root) {
		const panel = root.querySelector("[data-panel]");
		if (!panel) {
			return;
		}
		applyRequireRoles(panel);
		const kind = panel.getAttribute("data-panel");
		if (kind === "iam-users" && !canRoles("admin")) {
			showForbidden(panel);
			return;
		}
		if ((kind === "iam" || (kind && kind.startsWith("iam-"))) && kind !== "iam-breweries" && !canRoles("admin")) {
			showForbidden(panel);
			return;
		}
		if ((kind && kind.startsWith("settings")) && !canRoles("admin")) {
			showForbidden(panel);
			return;
		}
		if (kind === "economy" && !canRoles("admin")) {
			showForbidden(panel);
			return;
		}
		if (kind === "economy-deliveries" && !canViewEconomy()) {
			showForbidden(panel);
			return;
		}
		if (kind === "economy-purchases" && !canViewEconomy()) {
			showForbidden(panel);
			return;
		}
		const panels = window.BrewhousePanels || {};
		const loaders = {
			recipes: panels.recipes,
			schedule: panels.schedule,
			brewday: panels.brewday,
			inventory: panels.inventory,
			orders: panels.orders,
			hygiene: panels.hygiene,
			"tools-calculators": panels["tools-calculators"],
			economy: panels.economy,
			"economy-deliveries": panels["economy-deliveries"],
			"economy-purchases": panels["economy-purchases"],
			delivery: panels.delivery,
			"iam-users": panels["iam-users"],
			"iam-breweries": panels["iam-breweries"],
			"settings-brand": panels["settings-brand"],
			"settings-tanks": panels["settings-tanks"],
			"settings-multipliers": panels["settings-multipliers"],
			"settings-suppliers": panels["settings-suppliers"],
			"settings-beer-price": panels["settings-beer-price"],
			"settings-regional": panels["settings-regional"],
			"settings-hygiene": panels["settings-hygiene"],
			"settings-backup": panels["settings-backup"],
		};
		const fn = loaders[kind];
		if (fn) {
			fn(panel);
		}
	}

	window.BrewhouseCore.initPanel = initPanel;

	document.body.addEventListener("htmx:afterSwap", (event) => {
		if (event.detail.target && event.detail.target.id === "main-content") {
			if (window.BH_I18N && typeof window.BH_I18N.applyI18n === "function") {
				window.BH_I18N.applyI18n(event.detail.target);
			}
			initPanel(event.detail.target);
			if (window.Brewhouse && typeof window.Brewhouse.onNavigate === "function") {
				window.Brewhouse.onNavigate();
			}
		}
	});
})();
