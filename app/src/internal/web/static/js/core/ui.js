(() => {
	const {
		api,
		t,
		esc,
		token,
		appInfo,
		appConfirm,
		appPrompt,
	} = window.BrewhouseCore;

	async function refreshOrdersNavCount() {
		const els = document.querySelectorAll("[data-orders-nav-count]");
		if (!els.length) {
			return;
		}
		try {
			const data = await api("/api/inventory/orders/open-count");
			const n = data && typeof data.count === "number" ? data.count : 0;
			const shortfalls =
				data && typeof data.shortfall_lines === "number" ? data.shortfall_lines : 0;
			els.forEach((el) => {
				if (n > 0) {
					el.textContent = String(n);
					el.hidden = false;
					el.classList.toggle("shell__nav-count--shortfall", shortfalls > 0);
					el.title = shortfalls > 0 ? t("js.orders.shortfall_badge", { n: shortfalls }) : "";
				} else {
					el.textContent = "";
					el.hidden = true;
					el.classList.remove("shell__nav-count--shortfall");
					el.title = "";
				}
			});
		} catch {
			els.forEach((el) => {
				el.textContent = "";
				el.hidden = true;
				el.classList.remove("shell__nav-count--shortfall");
				el.title = "";
			});
		}
	}

	function setNavCount(selector, n) {
		document.querySelectorAll(selector).forEach((el) => {
			if (n > 0) {
				el.textContent = String(n);
				el.hidden = false;
			} else {
				el.textContent = "";
				el.hidden = true;
			}
		});
	}

	async function refreshBrewingNavCounts() {
		const hasAny =
			document.querySelector("[data-recipes-nav-count]") ||
			document.querySelector("[data-schedule-nav-count]") ||
			document.querySelector("[data-brewday-nav-count]") ||
			document.querySelector("[data-hygiene-nav-count]") ||
			document.querySelector("[data-delivery-nav-count]");
		if (!hasAny) {
			return;
		}
		try {
			const data = await api("/api/recipes/nav-counts");
			setNavCount(
				"[data-recipes-nav-count]",
				data && typeof data.recipes === "number" ? data.recipes : 0
			);
			setNavCount(
				"[data-schedule-nav-count]",
				data && typeof data.schedule === "number" ? data.schedule : 0
			);
			setNavCount(
				"[data-brewday-nav-count]",
				data && typeof data.brewday === "number" ? data.brewday : 0
			);
			setNavCount(
				"[data-hygiene-nav-count]",
				data && typeof data.hygiene === "number" ? data.hygiene : 0
			);
			setNavCount(
				"[data-delivery-nav-count]",
				data && typeof data.delivery === "number" ? data.delivery : 0
			);
		} catch {
			setNavCount("[data-recipes-nav-count]", 0);
			setNavCount("[data-schedule-nav-count]", 0);
			setNavCount("[data-brewday-nav-count]", 0);
			setNavCount("[data-hygiene-nav-count]", 0);
			setNavCount("[data-delivery-nav-count]", 0);
		}
	}

	function canViewEconomy() {
		if (window.BrewhouseAuth && typeof window.BrewhouseAuth.canViewEconomy === "function") {
			return window.BrewhouseAuth.canViewEconomy();
		}
		return canRoles("admin");
	}

	function recipeNextStep(status) {
		const map = {
			created: { href: "/app/schedule", label: t("js.recipes.next.schedule") },
			scheduled: { href: "/app/brewday", label: t("js.recipes.next.brewday") },
			brewday: { href: "/app/hygiene", label: t("js.recipes.next.hygiene") },
			hygiene_done: { href: "/app/delivery", label: t("js.recipes.next.delivery") },
			ready_for_delivery: { href: "/app/delivery", label: t("js.recipes.next.deliver") },
		};
		return map[status] || null;
	}

	function navLink(href, label) {
		return (
			'<a class="btn btn--small" href="' +
			esc(href) +
			'" hx-get="' +
			esc(href) +
			'" hx-target="#main-content" hx-swap="innerHTML">' +
			esc(label) +
			"</a>"
		);
	}

	function canRoles(roles) {
		if (window.BrewhouseAuth && typeof window.BrewhouseAuth.can === "function") {
			return window.BrewhouseAuth.can(roles);
		}
		const r = (sessionStorage.getItem("brewhouse_role") || "").trim().toLowerCase();
		if (!r) {
			return false;
		}
		const list = Array.isArray(roles) ? roles : String(roles).split(",");
		return list.map((s) => s.trim().toLowerCase()).includes(r);
	}

	function applyRequireRoles(root) {
		root.querySelectorAll("[data-require-roles]").forEach((el) => {
			const allowed = el.getAttribute("data-require-roles") || "";
			el.classList.toggle("is-role-hidden", !canRoles(allowed));
		});
		const elevatable =
			window.BrewhouseAuth && typeof window.BrewhouseAuth.canElevate === "function"
				? window.BrewhouseAuth.canElevate()
				: sessionStorage.getItem("brewhouse_can_elevate") === "1";
		root.querySelectorAll("[data-require-elevate]").forEach((el) => {
			el.classList.toggle("is-role-hidden", !elevatable);
		});
	}

	function showForbidden(panel) {
		panel.innerHTML =
			'<p class="panel__empty">' + esc(t("js.forbidden")) + "</p>";
	}

	window.BrewhouseUI = {
		info: appInfo,
		confirm: appConfirm,
		prompt: appPrompt,
		refreshOrdersNavCount,
		refreshBrewingNavCounts,
	};

	Object.assign(window.BrewhouseCore, {
		refreshOrdersNavCount,
		refreshBrewingNavCounts,
		setNavCount,
		canViewEconomy,
		recipeNextStep,
		navLink,
		canRoles,
		applyRequireRoles,
		showForbidden,
	});

	document.body.addEventListener("htmx:configRequest", (event) => {
		if (window.BrewhouseAuth && typeof window.BrewhouseAuth.markActivity === "function") {
			window.BrewhouseAuth.markActivity();
		}
		const t = token();
		if (t) {
			event.detail.headers.Authorization = "Bearer " + t;
		}
	});

	document.body.addEventListener("htmx:responseError", async (event) => {
		const xhr = event.detail.xhr;
		if (!xhr || xhr.status !== 401) {
			return;
		}
		const auth = window.BrewhouseAuth;
		if (!auth || typeof auth.refreshSession !== "function") {
			return;
		}
		const ok = await auth.refreshSession();
		if (!ok && typeof auth.logout === "function") {
			auth.logout();
		}
	});
})();
