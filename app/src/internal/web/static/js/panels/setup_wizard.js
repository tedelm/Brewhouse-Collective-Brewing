(() => {
	function core() {
		return window.BrewhouseCore || {};
	}

	function t(key, vars) {
		const fn = core().t;
		return typeof fn === "function" ? fn(key, vars) : key;
	}

	function esc(s) {
		const fn = core().esc;
		return typeof fn === "function" ? fn(s) : String(s ?? "");
	}

	function api(path, opts) {
		const fn = core().api;
		if (typeof fn !== "function") {
			return Promise.reject(new Error("api unavailable"));
		}
		return fn(path, opts);
	}

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

	function fillDiscount(sel, cfg) {
		const opts = cfg.discount_options || [{ key: "full", label: "full" }];
		sel.innerHTML = opts
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

	async function runSetupWizard() {
		const dialog = document.getElementById("setup-wizard");
		if (!dialog || typeof dialog.showModal !== "function") {
			return;
		}
		const form = document.getElementById("setup-wizard-form");
		const errEl = document.getElementById("setup-wizard-error");
		const stepsEl = document.getElementById("setup-wizard-steps");
		const backBtn = document.getElementById("setup-wizard-back");
		const nextBtn = document.getElementById("setup-wizard-next");
		const finishBtn = document.getElementById("setup-wizard-finish");
		const skipBtn = document.getElementById("setup-wizard-skip");
		const currencySel = document.getElementById("wizard-currency");
		const languageSel = document.getElementById("wizard-language");
		const taxCountrySel = document.getElementById("wizard-tax-country");
		const gravitySel = document.getElementById("wizard-gravity");
		const taxParamsEl = document.getElementById("wizard-tax-params");
		const taxDiscountSel = document.getElementById("wizard-tax-discount");
		const taxBasisEl = document.getElementById("wizard-tax-basis");
		const taxCountryLabel = document.getElementById("wizard-tax-country-label");
		const vatRateInput = document.getElementById("wizard-vat-rate");
		const vatCountryLabel = document.getElementById("wizard-vat-country-label");
		const stepEls = Array.from(dialog.querySelectorAll("[data-wizard-step]"));

		let step = 0;
		let taxCfg = null;
		const totalSteps = 3;

		function showError(msg) {
			if (!errEl) {
				return;
			}
			errEl.hidden = !msg;
			errEl.textContent = msg || "";
		}

		function renderStep() {
			stepEls.forEach((el) => {
				const n = Number(el.getAttribute("data-wizard-step"));
				el.hidden = n !== step;
			});
			if (stepsEl) {
				stepsEl.textContent = t("wizard.step_of", {
					current: String(step + 1),
					total: String(totalSteps),
				});
			}
			if (backBtn) {
				backBtn.hidden = step === 0;
			}
			if (nextBtn) {
				nextBtn.hidden = step >= totalSteps - 1;
			}
			if (finishBtn) {
				finishBtn.hidden = step < totalSteps - 1;
			}
			showError("");
		}

		async function loadRegional() {
			const cfg = await api("/api/settings/regional");
			currencySel.value = cfg.currency_code || "SEK";
			languageSel.value = cfg.language || "en";
			taxCountrySel.value = cfg.tax_country || "sv";
			gravitySel.value = cfg.gravity_unit || "sg";
		}

		async function saveRegional() {
			const cfg = await api("/api/settings/regional", {
				method: "PUT",
				body: JSON.stringify({
					currency_code: currencySel.value,
					language: languageSel.value,
					tax_country: taxCountrySel.value,
					gravity_unit: gravitySel.value,
				}),
			});
			if (window.BH_I18N && typeof window.BH_I18N.applyRegional === "function") {
				await window.BH_I18N.applyRegional(cfg);
			}
			if (window.BH_I18N && typeof window.BH_I18N.applyI18n === "function") {
				window.BH_I18N.applyI18n(dialog);
			}
		}

		async function loadTax() {
			taxCfg = await api("/api/settings/tax-config");
			taxBasisEl.value = taxCfg.basis || "";
			if (taxCountryLabel) {
				taxCountryLabel.textContent =
					t("economy.tax.active_country") + ": " + countryLabel(taxCfg.country);
			}
			renderParamFields(taxParamsEl, taxCfg);
			fillDiscount(taxDiscountSel, taxCfg);
		}

		async function saveTax() {
			if (!taxCfg) {
				await loadTax();
			}
			const params = collectParams(form, taxCfg);
			taxCfg = await api("/api/settings/tax-config", {
				method: "PUT",
				body: JSON.stringify({
					params: params,
					discount_key: taxDiscountSel.value,
				}),
			});
		}

		async function loadVAT() {
			const cfg = await api("/api/settings/vat-config");
			if (vatCountryLabel) {
				vatCountryLabel.textContent =
					t("economy.tax.active_country") + ": " + countryLabel(cfg.country);
			}
			vatRateInput.value = cfg.rate_percent != null ? cfg.rate_percent : 25;
		}

		async function saveVAT() {
			await api("/api/settings/vat-config", {
				method: "PUT",
				body: JSON.stringify({
					rate_percent: parseFloat(vatRateInput.value),
				}),
			});
		}

		async function saveCurrentStep() {
			if (step === 0) {
				await saveRegional();
			} else if (step === 1) {
				await saveTax();
			} else if (step === 2) {
				await saveVAT();
			}
		}

		async function completeWizard() {
			await api("/api/settings/setup-wizard/complete", { method: "POST" });
		}

		return new Promise((resolve) => {
			let settled = false;
			const finish = async (skip) => {
				if (settled) {
					return;
				}
				settled = true;
				try {
					showError("");
					if (!skip) {
						await saveCurrentStep();
					}
					await completeWizard();
					dialog.close();
					resolve();
				} catch (e) {
					settled = false;
					showError(e.message || String(e));
				}
			};

			skipBtn.onclick = () => finish(true);
			backBtn.onclick = () => {
				if (step > 0) {
					step -= 1;
					renderStep();
				}
			};
			nextBtn.onclick = async () => {
				try {
					showError("");
					await saveCurrentStep();
					step += 1;
					renderStep();
					if (step === 1) {
						await loadTax();
					} else if (step === 2) {
						await loadVAT();
					}
				} catch (e) {
					showError(e.message || String(e));
				}
			};
			finishBtn.onclick = () => finish(false);

			(async () => {
				try {
					await loadRegional();
					if (window.BH_I18N && typeof window.BH_I18N.applyI18n === "function") {
						window.BH_I18N.applyI18n(dialog);
					}
					renderStep();
					dialog.showModal();
				} catch (e) {
					showError(e.message || String(e));
					try {
						dialog.showModal();
					} catch (_) {
						resolve();
					}
				}
			})();
		});
	}

	window.BrewhouseSetupWizard = {
		run: runSetupWizard,
	};
})();
