(() => {
	function t(key, vars) {
		if (window.BH_I18N && typeof window.BH_I18N.t === "function") {
			return window.BH_I18N.t(key, vars);
		}
		return key;
	}

	function authHeaders() {
		const token = sessionStorage.getItem("brewhouse_token") || "";
		const headers = { Accept: "application/json" };
		if (token) {
			headers.Authorization = "Bearer " + token;
		}
		return headers;
	}

	function canElevate() {
		return sessionStorage.getItem("brewhouse_can_elevate") === "1";
	}

	function isVisible(el) {
		if (!el) {
			return false;
		}
		if (el.hidden) {
			return false;
		}
		const style = window.getComputedStyle(el);
		if (style.display === "none" || style.visibility === "hidden") {
			return false;
		}
		const section = el.closest(".shell__nav-section, .shell__sheet-section");
		if (section && section.hidden) {
			return false;
		}
		return true;
	}

	function findTarget(id) {
		if (!id) {
			return null;
		}
		const nodes = Array.from(document.querySelectorAll('[data-tour="' + id + '"]'));
		const visible = nodes.find((el) => isVisible(el) && el.getClientRects().length > 0);
		return visible || nodes.find((el) => isVisible(el)) || nodes[0] || null;
	}

	function expandSectionFor(el) {
		if (!el) {
			return;
		}
		const section = el.closest(".shell__nav-section, .shell__sheet-section");
		if (!section) {
			return;
		}
		const root = section.parentElement;
		const sectionSel = section.classList.contains("shell__sheet-section")
			? ".shell__sheet-section"
			: ".shell__nav-section";
		if (root) {
			root.querySelectorAll(sectionSel).forEach((other) => {
				if (other === section) {
					return;
				}
				other.classList.remove("is-expanded");
				const otherHeader = other.querySelector("[aria-expanded]");
				if (otherHeader) {
					otherHeader.setAttribute("aria-expanded", "false");
				}
			});
		}
		section.classList.add("is-expanded");
		const header = section.querySelector("[aria-expanded]");
		if (header) {
			header.setAttribute("aria-expanded", "true");
		}
	}

	function ensureNavVisible() {
		const shell = document.getElementById("shell");
		if (shell && shell.classList.contains("is-collapsed")) {
			shell.classList.remove("is-collapsed");
			const collapse = document.getElementById("shell-collapse");
			if (collapse) {
				collapse.setAttribute("aria-expanded", "true");
			}
		}
		const fab = document.getElementById("shell-nav-fab");
		const fabVisible = fab && window.getComputedStyle(fab).display !== "none";
		if (fabVisible && shell && !shell.classList.contains("is-sheet-open")) {
			shell.classList.add("is-sheet-open");
			document.body.classList.add("is-nav-sheet-open");
			fab.setAttribute("aria-expanded", "true");
			const sheet = document.getElementById("shell-nav-sheet");
			if (sheet) {
				sheet.setAttribute("aria-hidden", "false");
			}
			const backdrop = document.getElementById("shell-nav-backdrop");
			if (backdrop) {
				backdrop.hidden = false;
			}
		}
	}

	const STEPS = [
		{ id: "welcome", target: null, titleKey: "tour.welcome.title", bodyKey: "tour.welcome.body" },
		{ id: "recipes", target: "recipes", titleKey: "tour.recipes.title", bodyKey: "tour.recipes.body" },
		{ id: "schedule", target: "schedule", titleKey: "tour.schedule.title", bodyKey: "tour.schedule.body" },
		{ id: "brewday", target: "brewday", titleKey: "tour.brewday.title", bodyKey: "tour.brewday.body" },
		{ id: "hygiene", target: "hygiene", titleKey: "tour.hygiene.title", bodyKey: "tour.hygiene.body" },
		{ id: "delivery", target: "delivery", titleKey: "tour.delivery.title", bodyKey: "tour.delivery.body" },
		{ id: "inventory", target: "inventory", titleKey: "tour.inventory.title", bodyKey: "tour.inventory.body" },
		{ id: "tools", target: "tools", titleKey: "tour.tools.title", bodyKey: "tour.tools.body" },
		{ id: "economy", target: "economy", titleKey: "tour.economy.title", bodyKey: "tour.economy.body", requireVisible: true },
		{ id: "iam", target: "iam", titleKey: "tour.iam.title", bodyKey: "tour.iam.body" },
		{ id: "settings", target: "settings", titleKey: "tour.settings.title", bodyKey: "tour.settings.body", requireVisible: true },
		{ id: "admin", target: "admin", titleKey: "tour.admin.title", bodyKey: "tour.admin.body", requireElevate: true },
		{ id: "guide", target: "guide", titleKey: "tour.guide.title", bodyKey: "tour.guide.body" },
	];

	function activeSteps() {
		return STEPS.filter((step) => {
			if (step.requireElevate && !canElevate()) {
				return false;
			}
			if (!step.target) {
				return true;
			}
			const el = findTarget(step.target);
			if (!el) {
				return !step.requireVisible;
			}
			if (step.requireVisible && !isVisible(el)) {
				return false;
			}
			return true;
		});
	}

	let running = false;

	async function completeTour() {
		try {
			await fetch("/api/me/app-tour/complete", {
				method: "POST",
				headers: authHeaders(),
			});
		} catch (err) {
			console.error("App tour complete failed:", err);
		}
	}

	function positionUI(target) {
		const backdrop = document.getElementById("app-tour-backdrop");
		const spotlight = document.getElementById("app-tour-spotlight");
		const card = document.getElementById("app-tour-card");
		if (!spotlight || !card) {
			return;
		}
		const pad = 8;
		if (!target) {
			spotlight.hidden = true;
			if (backdrop) {
				backdrop.hidden = false;
			}
			card.style.top = "50%";
			card.style.left = "50%";
			card.style.transform = "translate(-50%, -50%)";
			return;
		}
		if (backdrop) {
			backdrop.hidden = true;
		}
		const rect = target.getBoundingClientRect();
		spotlight.hidden = false;
		spotlight.style.top = Math.max(0, rect.top - pad) + "px";
		spotlight.style.left = Math.max(0, rect.left - pad) + "px";
		spotlight.style.width = rect.width + pad * 2 + "px";
		spotlight.style.height = rect.height + pad * 2 + "px";

		const cardW = Math.min(360, window.innerWidth - 24);
		card.style.width = cardW + "px";
		card.style.transform = "none";
		let top = rect.bottom + 12;
		let left = Math.min(Math.max(12, rect.left), window.innerWidth - cardW - 12);
		if (top + 220 > window.innerHeight) {
			top = Math.max(12, rect.top - 220);
		}
		if (top < 12) {
			top = 12;
		}
		card.style.top = top + "px";
		card.style.left = left + "px";
	}

	async function runAppTour(opts) {
		const force = !!(opts && opts.force);
		if (running) {
			return;
		}
		const root = document.getElementById("app-tour");
		if (!root) {
			return;
		}
		if (!force) {
			try {
				const res = await fetch("/api/me/app-tour", { headers: authHeaders() });
				const data = await res.json().catch(() => ({}));
				if (!res.ok || !data.needed) {
					return;
				}
			} catch (err) {
				console.error("App tour status failed:", err);
				return;
			}
		} else {
			try {
				await fetch("/api/me/app-tour/reset", {
					method: "POST",
					headers: authHeaders(),
				});
			} catch (err) {
				console.error("App tour reset failed:", err);
			}
		}

		const steps = activeSteps();
		if (!steps.length) {
			await completeTour();
			return;
		}

		running = true;
		ensureNavVisible();
		root.hidden = false;
		document.body.classList.add("is-app-tour");

		const titleEl = document.getElementById("app-tour-title");
		const bodyEl = document.getElementById("app-tour-body");
		const stepsEl = document.getElementById("app-tour-steps");
		const backBtn = document.getElementById("app-tour-back");
		const nextBtn = document.getElementById("app-tour-next");
		const finishBtn = document.getElementById("app-tour-finish");
		const skipBtn = document.getElementById("app-tour-skip");

		let index = 0;
		let finished = false;

		function cleanup() {
			document.querySelectorAll(".app-tour-target").forEach((el) => {
				el.classList.remove("app-tour-target");
			});
			root.hidden = true;
			document.body.classList.remove("is-app-tour");
			running = false;
		}

		function render() {
			const step = steps[index];
			document.querySelectorAll(".app-tour-target").forEach((el) => {
				el.classList.remove("app-tour-target");
			});
			ensureNavVisible();
			const target = step.target ? findTarget(step.target) : null;
			if (target) {
				expandSectionFor(target);
				target.classList.add("app-tour-target");
				target.scrollIntoView({ block: "nearest", inline: "nearest" });
			}
			titleEl.textContent = t(step.titleKey);
			bodyEl.textContent = t(step.bodyKey);
			stepsEl.textContent = t("tour.step_of", {
				current: String(index + 1),
				total: String(steps.length),
			});
			backBtn.hidden = index === 0;
			nextBtn.hidden = index >= steps.length - 1;
			finishBtn.hidden = index < steps.length - 1;
			requestAnimationFrame(() => positionUI(target));
		}

		async function finish() {
			if (finished) {
				return;
			}
			finished = true;
			await completeTour();
			cleanup();
		}

		function onNext() {
			if (index < steps.length - 1) {
				index += 1;
				render();
			}
		}

		function onBack() {
			if (index > 0) {
				index -= 1;
				render();
			}
		}

		function onResize() {
			const step = steps[index];
			const target = step && step.target ? findTarget(step.target) : null;
			positionUI(target);
		}

		await new Promise((resolve) => {
			nextBtn.onclick = onNext;
			backBtn.onclick = onBack;
			finishBtn.onclick = async () => {
				await finish();
				window.removeEventListener("resize", onResize);
				resolve();
			};
			skipBtn.onclick = async () => {
				await finish();
				window.removeEventListener("resize", onResize);
				resolve();
			};
			window.addEventListener("resize", onResize);
			render();
		});
	}

	document.body.addEventListener("click", (ev) => {
		const btn = ev.target.closest("[data-action='retake-app-tour']");
		if (!btn) {
			return;
		}
		ev.preventDefault();
		void runAppTour({ force: true });
	});

	window.BrewhouseAppTour = {
		run: runAppTour,
	};
})();
