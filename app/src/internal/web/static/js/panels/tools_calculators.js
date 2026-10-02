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
		toSG,
		applyGravityInputs,
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

	async function loadToolsCalculators(panel) {
		// Metric yield: points·L/kg (DME ≈ 44 PPG → ~370; LME ≈ 36 PPG → ~300).
		const YIELD = { dme: 370, lme: 300 };
		/** @type {Map<string, object>} */
		const pitchYeastById = new Map();

		function yeastPitchConfigured(item) {
			return (
				item &&
				item.pitch_min_g_hl > 0 &&
				item.pitch_max_g_hl >= item.pitch_min_g_hl &&
				item.pack_size_g > 0 &&
				item.temp_max_c > 0 &&
				item.temp_max_c >= item.temp_min_c
			);
		}

		function extractYield(type) {
			return YIELD[type] || YIELD.dme;
		}

		function abvFromSG(og, fg) {
			return (og - fg) * 131.25;
		}

		function num(form, name) {
			return parseFloat(form.querySelector('[name="' + name + '"]').value);
		}

		function gravitySG(form, name) {
			return toSG(form.querySelector('[name="' + name + '"]').value);
		}

		function fmtG(g) {
			return (Math.round(g * 10) / 10).toFixed(1) + " g";
		}

		function fmtTempRange(minC, maxC) {
			return minC + "–" + maxC + " °C";
		}

		let taxPreviewTimer = null;
		const taxCfgEl = panel.querySelector("#calc-tax-config");
		const yeastSelect = panel.querySelector("#calc-pitch-yeast");

		function updateABV() {
			const form = panel.querySelector("#calc-abv-form");
			const out = panel.querySelector("#calc-abv-result");
			const og = gravitySG(form, "og");
			const fg = gravitySG(form, "fg");
			if (Number.isNaN(og) || Number.isNaN(fg)) {
				out.textContent = "—";
				return;
			}
			out.textContent = abvFromSG(og, fg).toFixed(1) + " %";
		}

		function updateTax() {
			const form = panel.querySelector("#calc-tax-form");
			const og = gravitySG(form, "og");
			const fg = gravitySG(form, "fg");
			const vol = num(form, "volume");
			const abvEl = panel.querySelector("#calc-tax-abv");
			const perEl = panel.querySelector("#calc-tax-per-l");
			const totEl = panel.querySelector("#calc-tax-total");
			if (Number.isNaN(og) || Number.isNaN(fg) || Number.isNaN(vol) || vol <= 0) {
				abvEl.textContent = "—";
				perEl.textContent = "—";
				totEl.textContent = "—";
				return;
			}
			const abv = abvFromSG(og, fg);
			abvEl.textContent = abv.toFixed(1) + " %";
			perEl.textContent = "…";
			totEl.textContent = "…";
			if (taxPreviewTimer) {
				clearTimeout(taxPreviewTimer);
			}
			taxPreviewTimer = setTimeout(async () => {
				try {
					const preview = await api(
						"/api/settings/tax-preview?abv=" +
							encodeURIComponent(abv) +
							"&og=" +
							encodeURIComponent(og) +
							"&volume=" +
							encodeURIComponent(vol)
					);
					perEl.textContent = fmtMoney(preview.per_liter);
					totEl.textContent = fmtMoney(preview.total);
				} catch (e) {
					perEl.textContent = "—";
					totEl.textContent = "—";
				}
			}, 150);
		}

		function updateExtract() {
			const form = panel.querySelector("#calc-extract-form");
			const out = panel.querySelector("#calc-extract-result");
			const cur = num(form, "current_sg");
			const target = num(form, "target_sg");
			const vol = num(form, "volume");
			const type = form.querySelector('[name="extract_type"]').value;
			if (
				Number.isNaN(cur) ||
				Number.isNaN(target) ||
				Number.isNaN(vol) ||
				vol <= 0 ||
				target <= cur
			) {
				out.textContent = "—";
				return;
			}
			const points = (target - cur) * 1000;
			const kg = (points * vol) / extractYield(type);
			out.textContent = kg.toFixed(3) + " kg (" + Math.round(kg * 1000) + " g)";
		}

		function updateDilute() {
			const form = panel.querySelector("#calc-dilute-form");
			const waterEl = panel.querySelector("#calc-dilute-water");
			const finalEl = panel.querySelector("#calc-dilute-final");
			const cur = num(form, "current_sg");
			const vol = num(form, "volume");
			const wanted = num(form, "wanted_sg");
			if (
				Number.isNaN(cur) ||
				Number.isNaN(vol) ||
				Number.isNaN(wanted) ||
				vol <= 0 ||
				wanted <= 1 ||
				wanted >= cur
			) {
				waterEl.textContent = "—";
				finalEl.textContent = "—";
				return;
			}
			const finalVol = (vol * (cur - 1)) / (wanted - 1);
			const water = finalVol - vol;
			waterEl.textContent = water.toFixed(2) + " L";
			finalEl.textContent = finalVol.toFixed(2) + " L";
		}

		function clearPitchResults() {
			const infoEl = panel.querySelector("#calc-pitch-info");
			const rangeEl = panel.querySelector("#calc-pitch-range");
			const selectedEl = panel.querySelector("#calc-pitch-selected");
			const packsEl = panel.querySelector("#calc-pitch-packs");
			const tempEl = panel.querySelector("#calc-pitch-temp");
			if (infoEl) infoEl.textContent = "—";
			if (rangeEl) rangeEl.textContent = "—";
			if (selectedEl) selectedEl.textContent = "—";
			if (packsEl) packsEl.textContent = "—";
			if (tempEl) tempEl.textContent = "—";
		}

		function updatePitch() {
			const form = panel.querySelector("#calc-pitch-form");
			const infoEl = panel.querySelector("#calc-pitch-info");
			const rangeEl = panel.querySelector("#calc-pitch-range");
			const selectedEl = panel.querySelector("#calc-pitch-selected");
			const packsEl = panel.querySelector("#calc-pitch-packs");
			const tempEl = panel.querySelector("#calc-pitch-temp");
			const yeastId = form.querySelector('[name="yeast"]').value;
			const pitchLevel = form.querySelector('[name="pitch"]').value;
			const vol = num(form, "volume");
			const item = pitchYeastById.get(String(yeastId));
			if (!item) {
				clearPitchResults();
				return;
			}
			const tempC = fmtTempRange(item.temp_min_c, item.temp_max_c);
			if (infoEl) {
				infoEl.textContent =
					item.name +
					(item.item_type ? " · " + item.item_type : "") +
					" · " +
					item.pitch_min_g_hl +
					"–" +
					item.pitch_max_g_hl +
					" g/hl · pack " +
					item.pack_size_g +
					" g · " +
					tempC;
			}
			if (Number.isNaN(vol) || vol <= 0) {
				rangeEl.textContent = "—";
				selectedEl.textContent = "—";
				packsEl.textContent = "—";
				tempEl.textContent = tempC;
				return;
			}
			const hl = vol / 100;
			const minG = hl * item.pitch_min_g_hl;
			const maxG = hl * item.pitch_max_g_hl;
			const midG = (minG + maxG) / 2;
			let selectedG = midG;
			if (pitchLevel === "low") {
				selectedG = minG;
			} else if (pitchLevel === "high") {
				selectedG = maxG;
			}
			const packsExact = selectedG / item.pack_size_g;
			const packsCeil = Math.ceil(packsExact);
			rangeEl.textContent = fmtG(minG) + "–" + fmtG(maxG);
			selectedEl.textContent = fmtG(selectedG);
			packsEl.textContent =
				t("js.tools.packs", { n: packsCeil, exact: packsExact.toFixed(2) });
			tempEl.textContent = tempC;
		}

		const PSI_PER_BAR = 14.5038;
		const CO2_BAND_CLASSES = [
			"calc-co2-band--low",
			"calc-co2-band--stout",
			"calc-co2-band--lager",
			"calc-co2-band--wheat",
			"calc-co2-band--high",
		];

		function co2Factor(tempC) {
			const tfOffset = tempC * 1.8;
			return 0.01821 + 0.090115 * Math.exp(-tfOffset / 43.349);
		}

		function co2Volumes(tempC, psi) {
			const tfOffset = tempC * 1.8;
			return (psi + 14.695) * co2Factor(tempC) - 0.003342 * tfOffset;
		}

		function co2Psi(tempC, volumes) {
			const tfOffset = tempC * 1.8;
			const factor = co2Factor(tempC);
			if (factor <= 0) {
				return NaN;
			}
			return (volumes + 0.003342 * tfOffset) / factor - 14.695;
		}

		function co2Band(volumes) {
			if (volumes < 1.5) {
				return { key: "tools.co2.band_low", cls: "calc-co2-band--low" };
			}
			if (volumes < 2.2) {
				return { key: "tools.co2.band_stout", cls: "calc-co2-band--stout" };
			}
			if (volumes < 2.6) {
				return { key: "tools.co2.band_lager", cls: "calc-co2-band--lager" };
			}
			if (volumes <= 4.0) {
				return { key: "tools.co2.band_wheat", cls: "calc-co2-band--wheat" };
			}
			return { key: "tools.co2.band_high", cls: "calc-co2-band--high" };
		}

		function setCo2Band(el, volumes) {
			if (!el) {
				return;
			}
			CO2_BAND_CLASSES.forEach((c) => el.classList.remove(c));
			if (Number.isNaN(volumes)) {
				el.textContent = "—";
				return;
			}
			const band = co2Band(volumes);
			el.textContent = t(band.key);
			el.classList.add(band.cls);
		}

		function updateCO2() {
			const form = panel.querySelector("#calc-co2-form");
			const volEl = panel.querySelector("#calc-co2-volumes");
			const styleEl = panel.querySelector("#calc-co2-style");
			const temp = num(form, "temp");
			const pressure = num(form, "pressure");
			const unit = form.querySelector('[name="unit"]').value;
			if (Number.isNaN(temp) || Number.isNaN(pressure) || pressure < 0) {
				volEl.textContent = "—";
				setCo2Band(styleEl, NaN);
				return;
			}
			const psi = unit === "bar" ? pressure * PSI_PER_BAR : pressure;
			const volumes = co2Volumes(temp, psi);
			volEl.textContent = volumes.toFixed(2);
			setCo2Band(styleEl, volumes);
		}

		function updateCO2Target() {
			const form = panel.querySelector("#calc-co2-target-form");
			const psiEl = panel.querySelector("#calc-co2-need-psi");
			const barEl = panel.querySelector("#calc-co2-need-bar");
			const styleEl = panel.querySelector("#calc-co2-target-style");
			const temp = num(form, "temp");
			const volumes = num(form, "volumes");
			if (Number.isNaN(temp) || Number.isNaN(volumes) || volumes <= 0) {
				psiEl.textContent = "—";
				barEl.textContent = "—";
				setCo2Band(styleEl, NaN);
				return;
			}
			const psi = co2Psi(temp, volumes);
			if (Number.isNaN(psi) || psi < 0) {
				psiEl.textContent = "—";
				barEl.textContent = "—";
				setCo2Band(styleEl, volumes);
				return;
			}
			psiEl.textContent = psi.toFixed(2) + " PSI";
			barEl.textContent = (psi / PSI_PER_BAR).toFixed(2) + " BAR";
			setCo2Band(styleEl, volumes);
		}

		function refreshAll() {
			updateABV();
			updateTax();
			updateExtract();
			updateDilute();
			updatePitch();
			updateCO2();
			updateCO2Target();
		}

		panel.addEventListener("input", (ev) => {
			const el = ev.target;
			if (!(el instanceof HTMLElement)) {
				return;
			}
			if (el.closest("#calc-abv-form")) {
				updateABV();
			}
			if (el.closest("#calc-tax-form")) {
				updateTax();
			}
			if (el.closest("#calc-extract-form")) {
				updateExtract();
			}
			if (el.closest("#calc-dilute-form")) {
				updateDilute();
			}
			if (el.closest("#calc-pitch-form")) {
				updatePitch();
			}
			if (el.closest("#calc-co2-form")) {
				updateCO2();
			}
			if (el.closest("#calc-co2-target-form")) {
				updateCO2Target();
			}
		});
		panel.addEventListener("change", (ev) => {
			const el = ev.target;
			if (!(el instanceof HTMLElement)) {
				return;
			}
			if (el.closest("#calc-extract-form")) {
				updateExtract();
			}
			if (el.closest("#calc-pitch-form")) {
				updatePitch();
			}
			if (el.closest("#calc-co2-form")) {
				updateCO2();
			}
			if (el.closest("#calc-co2-target-form")) {
				updateCO2Target();
			}
		});

		try {
			const taxCfg = await api("/api/settings/tax-config");
			if (taxCfgEl) {
				taxCfgEl.textContent = t("js.tools.tax_config_country", {
					country: taxCfg.country || "sv",
					basis: taxCfg.basis || "",
					discount: taxCfg.discount_key || "full",
				});
			}
		} catch (e) {
			if (taxCfgEl) {
				taxCfgEl.textContent = t("js.tools.tax_config_error") + " " + e.message;
			}
		}

		if (yeastSelect) {
			try {
				const items = (await api("/api/inventory?category=yeast")) || [];
				const configured = items.filter(yeastPitchConfigured);
				pitchYeastById.clear();
				yeastSelect.innerHTML = "";
				if (configured.length === 0) {
					const opt = document.createElement("option");
					opt.value = "";
					opt.textContent = t("js.tools.no_yeast_pitch");
					opt.disabled = true;
					opt.selected = true;
					yeastSelect.appendChild(opt);
				} else {
					configured.forEach((item, i) => {
						pitchYeastById.set(String(item.id), item);
						const opt = document.createElement("option");
						opt.value = String(item.id);
						opt.textContent = item.item_type
							? item.name + " (" + item.item_type + ")"
							: item.name;
						if (i === 0) {
							opt.selected = true;
						}
						yeastSelect.appendChild(opt);
					});
				}
			} catch (e) {
				yeastSelect.innerHTML = "";
				const opt = document.createElement("option");
				opt.value = "";
				opt.textContent = t("js.tools.yeast_load_error");
				opt.disabled = true;
				opt.selected = true;
				yeastSelect.appendChild(opt);
			}
		}

		applyGravityInputs(panel);
		const defs = window.BrewhouseCore.gravityInputDefaults
			? window.BrewhouseCore.gravityInputDefaults()
			: { og: "1.050", fg: "1.010" };
		panel.querySelectorAll('[data-gravity-input="og"]').forEach((el) => {
			el.value = defs.og;
		});
		panel.querySelectorAll('[data-gravity-input="fg"]').forEach((el) => {
			el.value = defs.fg;
		});
		refreshAll();
	}

	window.BrewhousePanels = window.BrewhousePanels || {};
	window.BrewhousePanels["tools-calculators"] = loadToolsCalculators;
})();
