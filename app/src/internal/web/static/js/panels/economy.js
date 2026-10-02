(() => {
	const {
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
		datePart,
		recipeABV,
		appConfirm,
		appInfo,
		pipelineGuide,
		appPrompt,
		fillRecipeSelect,
		recipeOptionLabel,
		refreshOrdersNavCount,
		refreshBrewingNavCounts,
		setNavCount,
		canViewEconomy,
		recipeNextStep,
		navLink,
		canRoles,
		applyRequireRoles,
		showForbidden,
	} = window.BrewhouseCore;

	const EXAMPLE_ABVS = [3.5, 4.5, 5.0, 5.5, 6.0, 8.0];
	const EXAMPLE_OG = 1.048; // ~12 °P

	function discountLabel(key) {
		const i18nKey = "economy.tax.discount_" + key;
		const translated = t(i18nKey);
		return translated === i18nKey ? key : translated;
	}

	function countryLabel(code) {
		const i18nKey = "settings.regional.tax_" + code;
		const translated = t(i18nKey);
		return translated === i18nKey ? code : translated;
	}

	function renderParamFields(container, cfg) {
		const params = cfg.params && typeof cfg.params === "object" ? cfg.params : {};
		const basis = cfg.basis || "";
		let html = "";
		if (basis === "abv_per_pct" && cfg.country === "fr") {
			html +=
				'<label><span data-i18n="economy.tax.rate_high">Rate high ({currency}/hl/% ABV)</span>' +
				'<input name="rate_high" type="number" step="0.01" min="0" required value="' +
				esc(String(params.rate_high ?? "")) +
				'"></label>';
			html +=
				'<label><span data-i18n="economy.tax.rate_low">Rate low ({currency}/hl/% ABV)</span>' +
				'<input name="rate_low" type="number" step="0.01" min="0" required value="' +
				esc(String(params.rate_low ?? "")) +
				'"></label>';
			html +=
				'<label><span data-i18n="economy.tax.low_max_abv">Low ABV threshold (%)</span>' +
				'<input name="low_max_abv" type="number" step="0.1" min="0" required value="' +
				esc(String(params.low_max_abv ?? "")) +
				'"></label>';
		} else if (basis === "abv_per_pct") {
			html +=
				'<label><span data-i18n="economy.tax.rate">Rate ({currency} per liter per % ABV)</span>' +
				'<input name="rate" type="number" step="0.01" min="0" required value="' +
				esc(String(params.rate ?? cfg.rate_sek ?? "")) +
				'"></label>';
			if (params.free_max_abv != null || cfg.country === "sv") {
				html +=
					'<label><span data-i18n="economy.tax.free_max">Free max ABV (%)</span>' +
					'<input name="free_max_abv" type="number" step="0.1" min="0" required value="' +
					esc(String(params.free_max_abv ?? cfg.free_max_abv ?? "")) +
					'"></label>';
			}
		} else if (basis === "pure_alcohol" && cfg.country === "fi") {
			html +=
				'<label><span data-i18n="economy.tax.rate_low_cents">Low band (cents/cl pure alcohol)</span>' +
				'<input name="rate_low_cents_per_cl" type="number" step="0.01" min="0" required value="' +
				esc(String(params.rate_low_cents_per_cl ?? "")) +
				'"></label>';
			html +=
				'<label><span data-i18n="economy.tax.rate_high_cents">High band (cents/cl pure alcohol)</span>' +
				'<input name="rate_high_cents_per_cl" type="number" step="0.01" min="0" required value="' +
				esc(String(params.rate_high_cents_per_cl ?? "")) +
				'"></label>';
			html +=
				'<label><span data-i18n="economy.tax.low_max_abv">Low band max ABV (%)</span>' +
				'<input name="low_max_abv" type="number" step="0.1" min="0" required value="' +
				esc(String(params.low_max_abv ?? "")) +
				'"></label>';
			html +=
				'<label><span data-i18n="economy.tax.min_abv">Min taxable ABV (%)</span>' +
				'<input name="min_abv" type="number" step="0.1" min="0" required value="' +
				esc(String(params.min_abv ?? "")) +
				'"></label>';
		} else if (basis === "pure_alcohol") {
			html +=
				'<label><span data-i18n="economy.tax.rate_pure">Rate ({currency}/L pure alcohol)</span>' +
				'<input name="rate" type="number" step="0.01" min="0" required value="' +
				esc(String(params.rate ?? "")) +
				'"></label>';
			html +=
				'<label><span data-i18n="economy.tax.free_max">Free max ABV (%)</span>' +
				'<input name="free_max_abv" type="number" step="0.1" min="0" required value="' +
				esc(String(params.free_max_abv ?? "")) +
				'"></label>';
		} else if (basis === "plato_rate") {
			html +=
				'<label><span data-i18n="economy.tax.rate_plato">Rate ({currency}/hl/°Plato)</span>' +
				'<input name="rate_per_hl_plato" type="number" step="0.001" min="0" required value="' +
				esc(String(params.rate_per_hl_plato ?? "")) +
				'"></label>';
		} else if (basis === "plato_bands") {
			html +=
				'<p class="panel__lead" data-i18n="economy.tax.es_bands_note">Spain uses fixed ABV/°Plato bands (2026). Rates are built into the calculator.</p>';
		}
		container.innerHTML = html;
		if (window.BH_I18N && typeof window.BH_I18N.applyI18n === "function") {
			window.BH_I18N.applyI18n(container);
		}
	}

	function collectParams(form, cfg) {
		const basis = cfg.basis;
		const fd = new FormData(form);
		if (basis === "abv_per_pct" && cfg.country === "fr") {
			return {
				rate_high: parseFloat(fd.get("rate_high")),
				rate_low: parseFloat(fd.get("rate_low")),
				low_max_abv: parseFloat(fd.get("low_max_abv")),
			};
		}
		if (basis === "abv_per_pct") {
			const out = { rate: parseFloat(fd.get("rate")) };
			const free = fd.get("free_max_abv");
			if (free != null && free !== "") {
				out.free_max_abv = parseFloat(free);
			}
			return out;
		}
		if (basis === "pure_alcohol" && cfg.country === "fi") {
			return {
				rate_low_cents_per_cl: parseFloat(fd.get("rate_low_cents_per_cl")),
				rate_high_cents_per_cl: parseFloat(fd.get("rate_high_cents_per_cl")),
				low_max_abv: parseFloat(fd.get("low_max_abv")),
				min_abv: parseFloat(fd.get("min_abv")),
			};
		}
		if (basis === "pure_alcohol") {
			return {
				rate: parseFloat(fd.get("rate")),
				free_max_abv: parseFloat(fd.get("free_max_abv")),
			};
		}
		if (basis === "plato_rate") {
			return { rate_per_hl_plato: parseFloat(fd.get("rate_per_hl_plato")) };
		}
		if (basis === "plato_bands") {
			return cfg.params || { bands: [] };
		}
		return cfg.params || {};
	}

	async function loadEconomy(panel) {
		const examplesEl = panel.querySelector("#economy-examples");
		const form = panel.querySelector("#economy-form");
		const errEl = panel.querySelector("#economy-error");
		const paramsEl = panel.querySelector("#economy-params-fields");
		const discountSel = panel.querySelector("#economy-discount");
		const countryLabelEl = panel.querySelector("#economy-country-label");
		let currentCfg = null;

		async function renderExamples(cfg) {
			const rows = [];
			for (const abv of EXAMPLE_ABVS) {
				try {
					const preview = await api(
						"/api/settings/tax-preview?abv=" +
							encodeURIComponent(abv) +
							"&og=" +
							encodeURIComponent(EXAMPLE_OG) +
							"&volume=1"
					);
					rows.push(
						"<tr><td>" +
							abv.toFixed(1) +
							" %</td><td>" +
							Number(preview.per_liter).toFixed(4) +
							" " +
							currencyPerLiter() +
							"</td></tr>"
					);
				} catch (e) {
					rows.push("<tr><td>" + abv.toFixed(1) + " %</td><td>—</td></tr>");
				}
			}
			examplesEl.innerHTML =
				"<p class=\"panel__lead\">" +
				esc(t("js.economy.examples_lead_country", { country: countryLabel(cfg.country) })) +
				"</p>" +
				table([t("js.economy.examples_abv"), t("js.economy.examples_tax")], rows.join(""));
		}

		function fillDiscount(cfg) {
			const opts = cfg.discount_options || [{ key: "full", label: "full" }];
			discountSel.innerHTML = opts
				.map((o) => {
					const selected = o.key === cfg.discount_key ? " selected" : "";
					return (
						'<option value="' +
						esc(o.key) +
						'"' +
						selected +
						">" +
						esc(discountLabel(o.key)) +
						"</option>"
					);
				})
				.join("");
		}

		async function refresh() {
			examplesEl.textContent = t("js.loading");
			try {
				const cfg = await api("/api/settings/tax-config");
				currentCfg = cfg;
				countryLabelEl.textContent =
					t("economy.tax.active_country") + ": " + countryLabel(cfg.country);
				form.querySelector("#economy-basis").value = cfg.basis || "";
				renderParamFields(paramsEl, cfg);
				fillDiscount(cfg);
				await renderExamples(cfg);
			} catch (e) {
				examplesEl.textContent = e.message;
			}
		}

		panel.querySelector('[data-action="economy-refresh"]').addEventListener("click", () => {
			refresh();
			refreshVAT();
		});
		form.addEventListener("submit", async (ev) => {
			ev.preventDefault();
			errEl.hidden = true;
			if (!canRoles(["superuser", "admin"])) {
				return;
			}
			if (!currentCfg) {
				return;
			}
			try {
				const params = collectParams(form, currentCfg);
				const cfg = await api("/api/settings/tax-config", {
					method: "PUT",
					body: JSON.stringify({
						params: params,
						discount_key: discountSel.value,
					}),
				});
				currentCfg = cfg;
				renderParamFields(paramsEl, cfg);
				fillDiscount(cfg);
				await renderExamples(cfg);
			} catch (e) {
				errEl.hidden = false;
				errEl.textContent = e.message;
			}
		});

		const vatForm = panel.querySelector("#economy-vat-form");
		const vatErrEl = panel.querySelector("#economy-vat-error");
		const vatRateInput = panel.querySelector("#economy-vat-rate");
		const vatCountryLabelEl = panel.querySelector("#economy-vat-country-label");

		async function refreshVAT() {
			if (!vatForm) {
				return;
			}
			try {
				const cfg = await api("/api/settings/vat-config");
				if (vatCountryLabelEl) {
					vatCountryLabelEl.textContent =
						t("economy.tax.active_country") + ": " + countryLabel(cfg.country);
				}
				if (vatRateInput) {
					vatRateInput.value = cfg.rate_percent != null ? cfg.rate_percent : 25;
				}
			} catch (e) {
				if (vatErrEl) {
					vatErrEl.hidden = false;
					vatErrEl.textContent = e.message;
				}
			}
		}

		if (vatForm) {
			vatForm.addEventListener("submit", async (ev) => {
				ev.preventDefault();
				if (vatErrEl) {
					vatErrEl.hidden = true;
				}
				if (!canRoles(["superuser", "admin"])) {
					return;
				}
				try {
					const cfg = await api("/api/settings/vat-config", {
						method: "PUT",
						body: JSON.stringify({
							rate_percent: parseFloat(vatRateInput.value),
						}),
					});
					if (vatCountryLabelEl) {
						vatCountryLabelEl.textContent =
							t("economy.tax.active_country") + ": " + countryLabel(cfg.country);
					}
					vatRateInput.value = cfg.rate_percent;
				} catch (e) {
					if (vatErrEl) {
						vatErrEl.hidden = false;
						vatErrEl.textContent = e.message;
					}
				}
			});
		}

		refresh();
		refreshVAT();
	}

	window.BrewhousePanels = window.BrewhousePanels || {};
	window.BrewhousePanels["economy"] = loadEconomy;
})();
