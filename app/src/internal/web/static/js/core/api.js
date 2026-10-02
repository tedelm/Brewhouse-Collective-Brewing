(() => {
	const TOKEN_KEY = "brewhouse_token";

	function token() {
		return sessionStorage.getItem(TOKEN_KEY) || "";
	}

	async function api(path, options = {}) {
		if (window.BrewhouseAuth && typeof window.BrewhouseAuth.markActivity === "function") {
			window.BrewhouseAuth.markActivity();
		}

		const doFetch = async () => {
			const headers = Object.assign(
				{ "Content-Type": "application/json" },
				options.headers || {},
				{ Authorization: "Bearer " + token() }
			);
			const res = await fetch(path, Object.assign({}, options, { headers }));
			const text = await res.text();
			let data = null;
			try {
				data = text ? JSON.parse(text) : null;
			} catch {
				data = { error: text };
			}
			return { res, data };
		};

		let { res, data } = await doFetch();
		if (res.status === 401 && path !== "/api/session/refresh") {
			const auth = window.BrewhouseAuth;
			if (auth && typeof auth.refreshSession === "function") {
				const ok = await auth.refreshSession();
				if (ok) {
					({ res, data } = await doFetch());
				} else if (typeof auth.logout === "function") {
					auth.logout();
				}
			}
		}
		if (!res.ok) {
			const err = new Error((data && data.error) || res.statusText);
			err.status = res.status;
			err.data = data;
			throw err;
		}
		return data;
	}

	async function downloadCSVAuth(path, filename) {
		const res = await fetch(path, {
			headers: { Authorization: "Bearer " + token() },
		});
		if (!res.ok) {
			const text = await res.text();
			let msg = res.statusText;
			try {
				const data = text ? JSON.parse(text) : null;
				if (data && data.error) {
					msg = data.error;
				}
			} catch {
				/* ignore */
			}
			throw new Error(msg);
		}
		const blob = await res.blob();
		const a = document.createElement("a");
		a.href = URL.createObjectURL(blob);
		a.download = filename;
		a.click();
		URL.revokeObjectURL(a.href);
	}

	async function importCSVAuth(path, file) {
		const res = await fetch(path, {
			method: "POST",
			headers: {
				Authorization: "Bearer " + token(),
				"Content-Type": "text/csv",
			},
			body: file,
		});
		const text = await res.text();
		let data = null;
		try {
			data = text ? JSON.parse(text) : null;
		} catch {
			data = { error: text };
		}
		if (!res.ok) {
			throw new Error((data && data.error) || res.statusText);
		}
		return data;
	}

	function formatImportResult(result) {
		const parts = [
			t("js.import.created", { n: result.created || 0 }),
			t("js.import.updated", { n: result.updated || 0 }),
			t("js.import.failed", { n: result.failed || 0 }),
		];
		if (result.errors && result.errors.length) {
			parts.push("", t("js.import.errors"), result.errors.join("\n"));
		}
		return parts.join("\n");
	}

	function esc(s) {
		return String(s ?? "")
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;");
	}

	function statusPill(status, label) {
		const s = String(status || "").trim();
		const cls = s.toLowerCase().replace(/\s+/g, "_");
		return (
			'<span class="status-pill status-pill--' +
			esc(cls) +
			'">' +
			esc(label != null ? label : s) +
			"</span>"
		);
	}

	function table(headers, rowsHtml) {
		const body = Array.isArray(rowsHtml) ? rowsHtml.join("") : rowsHtml;
		return (
			'<div class="table-scroll"><table class="data-table"><thead><tr>' +
			headers.map((h) => "<th>" + esc(h) + "</th>").join("") +
			"</tr></thead><tbody>" +
			body +
			"</tbody></table></div>"
		);
	}

	function fmtMoney(n, currencyOverride) {
		if (n == null || n === "" || Number.isNaN(Number(n))) {
			return "";
		}
		const amount = Number(n).toFixed(2);
		let code = currencyOverride;
		if (!code) {
			code =
				window.BH_I18N && typeof window.BH_I18N.currencyCode === "function"
					? window.BH_I18N.currencyCode()
					: "SEK";
		}
		return amount + " " + code;
	}

	function fmtMoneyAmount(n) {
		if (n == null || n === "" || Number.isNaN(Number(n))) {
			return "";
		}
		return Number(n).toFixed(2);
	}

	function t(key, vars) {
		if (window.BH_I18N && typeof window.BH_I18N.t === "function") {
			return window.BH_I18N.t(key, vars);
		}
		return key;
	}

	function isPasswordComplex(password) {
		if (!password || [...password].length < 8) {
			return false;
		}
		return /[^A-Za-z0-9]/.test(password);
	}

	function currencyCode() {
		if (window.BH_I18N && typeof window.BH_I18N.currencyCode === "function") {
			return window.BH_I18N.currencyCode();
		}
		return "SEK";
	}

	function currencyPerLiter() {
		if (window.BH_I18N && typeof window.BH_I18N.currencyPerLiter === "function") {
			return window.BH_I18N.currencyPerLiter();
		}
		return "SEK/L";
	}

	function noticeTitle() {
		return t("js.notice");
	}

	function statusText(status) {
		const s = String(status || "").trim();
		if (!s) {
			return "";
		}
		const key = "js.status." + s.replace(/\s+/g, "_");
		const translated = t(key);
		return translated === key ? s : translated;
	}

	function categoryText(category) {
		const c = String(category || "")
			.trim()
			.toLowerCase();
		if (!c) {
			return "";
		}
		const key = "js.category." + c;
		const translated = t(key);
		return translated === key ? category : translated;
	}

	async function syncRegionalFromServer() {
		if (!token() || !window.BH_I18N) {
			return;
		}
		try {
			const cfg = await api("/api/settings/regional");
			await window.BH_I18N.applyRegional(cfg);
		} catch (_) {
			/* ignore until authenticated / seeded */
		}
	}

	function platoFromSG(sg) {
		const n = Number(sg);
		if (!n || n <= 0 || Number.isNaN(n)) {
			return 0;
		}
		return -616.868 + 1111.14 * n - 630.272 * n * n + 135.997 * n * n * n;
	}

	function sgFromPlato(plato) {
		const p = Number(plato);
		if (!p || p <= 0 || Number.isNaN(p)) {
			return 1.0;
		}
		let lo = 1.0;
		let hi = 1.25;
		for (let i = 0; i < 64; i++) {
			const mid = (lo + hi) / 2;
			if (platoFromSG(mid) < p) {
				lo = mid;
			} else {
				hi = mid;
			}
		}
		return (lo + hi) / 2;
	}

	function gravityUnit() {
		if (window.BH_I18N && typeof window.BH_I18N.gravityUnit === "function") {
			return window.BH_I18N.gravityUnit();
		}
		return "sg";
	}

	function fmtSG(v, fallback) {
		if (v == null || v === "" || Number.isNaN(Number(v))) {
			return fallback != null ? fallback : "";
		}
		return Number(v).toFixed(3);
	}

	function fmtGravity(sg, fallbackSG) {
		if (sg == null || sg === "" || Number.isNaN(Number(sg))) {
			if (gravityUnit() === "plato") {
				if (fallbackSG == null || fallbackSG === "") {
					return "";
				}
				return platoFromSG(fallbackSG).toFixed(1);
			}
			return fallbackSG != null ? fallbackSG : "";
		}
		if (gravityUnit() === "plato") {
			return platoFromSG(sg).toFixed(1);
		}
		return Number(sg).toFixed(3);
	}

	/** Convert UI gravity field value to SG for API storage. */
	function toSG(inputValue) {
		const n = Number(inputValue);
		if (Number.isNaN(n)) {
			return NaN;
		}
		if (gravityUnit() === "plato") {
			return sgFromPlato(n);
		}
		return n;
	}

	function gravityInputDefaults() {
		if (gravityUnit() === "plato") {
			return { og: "12.0", fg: "2.5", step: "0.1", min: "0" };
		}
		return { og: "1.050", fg: "1.010", step: "0.001", min: "0" };
	}

	function applyGravityInputs(root) {
		const defs = gravityInputDefaults();
		(root || document).querySelectorAll("[data-gravity-input]").forEach(function (input) {
			input.step = defs.step;
			if (defs.min != null) {
				input.min = defs.min;
			}
		});
		if (window.BH_I18N && typeof window.BH_I18N.applyGravityLabels === "function") {
			window.BH_I18N.applyGravityLabels(root || document);
		}
	}

	function datePart(iso) {
		if (!iso) {
			return "";
		}
		const s = String(iso);
		const t = s.indexOf("T");
		return t >= 0 ? s.slice(0, t) : s.slice(0, 10);
	}

	function recipeABV(r) {
		if (r.og == null || r.fg == null) {
			return "";
		}
		return ((r.og - r.fg) * 131.25).toFixed(1) + "%";
	}

	function appConfirm(opts) {
		const dialog = document.getElementById("app-confirm-dialog");
		const titleEl = document.getElementById("app-confirm-title");
		const messageEl = document.getElementById("app-confirm-message");
		if (!dialog || !titleEl || !messageEl) {
			return Promise.resolve(false);
		}
		titleEl.textContent = (opts && opts.title) || t("js.confirm");
		messageEl.textContent = (opts && opts.message) || "";
		return new Promise((resolve) => {
			const onClose = () => {
				dialog.removeEventListener("close", onClose);
				resolve(dialog.returnValue === "confirm");
			};
			dialog.addEventListener("close", onClose);
			dialog.showModal();
		});
	}

	function appInfo(opts) {
		const dialog = document.getElementById("app-info-dialog");
		const titleEl = document.getElementById("app-info-title");
		const messageEl = document.getElementById("app-info-message");
		if (!dialog || !titleEl || !messageEl) {
			return Promise.resolve();
		}
		titleEl.textContent = (opts && opts.title) || t("js.info");
		messageEl.textContent = (opts && opts.message) || "";
		return new Promise((resolve) => {
			const onClose = () => {
				dialog.removeEventListener("close", onClose);
				resolve();
			};
			dialog.addEventListener("close", onClose);
			dialog.showModal();
		});
	}

	function pipelineGuide(step) {
		const map = {
			recipe_created: {
				title: t("js.pipeline.recipe_created.title"),
				message: t("js.pipeline.recipe_created.message"),
			},
			scheduled: {
				title: t("js.pipeline.scheduled.title"),
				message: t("js.pipeline.scheduled.message"),
			},
			brewday_recorded: {
				title: t("js.pipeline.brewday.title"),
				message: t("js.pipeline.brewday.message"),
			},
			hygiene_done: {
				title: t("js.pipeline.hygiene.title"),
				message: t("js.pipeline.hygiene.message"),
			},
			ready_for_delivery: {
				title: t("js.pipeline.ready.title"),
				message: t("js.pipeline.ready.message"),
			},
			delivered: {
				title: t("js.pipeline.delivered.title"),
				message: t("js.pipeline.delivered.message"),
			},
		};
		return map[step] || { title: t("js.next_step"), message: "" };
	}

	function appPrompt(opts) {
		const dialog = document.getElementById("app-prompt-dialog");
		const form = document.getElementById("app-prompt-form");
		const titleEl = document.getElementById("app-prompt-title");
		const fieldsEl = document.getElementById("app-prompt-fields");
		if (!dialog || !form || !titleEl || !fieldsEl) {
			return Promise.resolve(null);
		}
		const fields = (opts && opts.fields) || [];
		titleEl.textContent = (opts && opts.title) || t("js.input");
		fieldsEl.innerHTML = fields
			.map((f) => {
				const type = f.type || "text";
				const required = f.required === false ? "" : " required";
				const label =
					"<label>" + esc(f.label || f.name) + " ";
				if (type === "select") {
					const options = (f.options || [])
						.map((o) => {
							const selected =
								f.value != null && String(f.value) === String(o.value)
									? " selected"
									: "";
							return (
								'<option value="' +
								esc(String(o.value)) +
								'"' +
								selected +
								">" +
								esc(String(o.label != null ? o.label : o.value)) +
								"</option>"
							);
						})
						.join("");
					return (
						label +
						'<select name="' +
						esc(f.name) +
						'"' +
						required +
						">" +
						options +
						"</select></label>"
					);
				}
				const step = f.step != null ? ' step="' + esc(String(f.step)) + '"' : "";
				const min = f.min != null ? ' min="' + esc(String(f.min)) + '"' : "";
				const value = f.value != null ? esc(String(f.value)) : "";
				return (
					label +
					'<input name="' +
					esc(f.name) +
					'" type="' +
					esc(type) +
					'"' +
					step +
					min +
					required +
					' value="' +
					value +
					'"></label>'
				);
			})
			.join("");
		return new Promise((resolve) => {
			const onClose = () => {
				dialog.removeEventListener("close", onClose);
				if (dialog.returnValue !== "save") {
					resolve(null);
					return;
				}
				const fd = new FormData(form);
				const out = {};
				fields.forEach((f) => {
					out[f.name] = String(fd.get(f.name) ?? "");
				});
				resolve(out);
			};
			dialog.addEventListener("close", onClose);
			dialog.showModal();
		});
	}

	function recipeOptionLabel(r) {
		let label = "#" + r.id + " — " + (r.name || "");
		if (r.brewery_name) {
			label += " (" + r.brewery_name + ")";
		}
		return label;
	}

	function fillRecipeSelect(selectEl, recipes, emptyLabel) {
		if (!selectEl) {
			return;
		}
		if (!recipes || !recipes.length) {
			selectEl.innerHTML = '<option value="">' + esc(emptyLabel || t("js.recipes.no_recipes")) + "</option>";
			return;
		}
		selectEl.innerHTML = recipes
			.map((r) => '<option value="' + r.id + '">' + esc(recipeOptionLabel(r)) + "</option>")
			.join("");
	}

	window.BrewhouseCore = {
		token,
		api,
		downloadCSVAuth,
		importCSVAuth,
		formatImportResult,
		esc,
		statusPill,
		table,
		fmtMoney,
		fmtMoneyAmount,
		t,
		isPasswordComplex,
		currencyCode,
		currencyPerLiter,
		noticeTitle,
		statusText,
		categoryText,
		syncRegionalFromServer,
		fmtSG,
		fmtGravity,
		toSG,
		platoFromSG,
		sgFromPlato,
		gravityUnit,
		gravityInputDefaults,
		applyGravityInputs,
		datePart,
		recipeABV,
		appConfirm,
		appInfo,
		pipelineGuide,
		appPrompt,
		recipeOptionLabel,
		fillRecipeSelect,
	};
})();
