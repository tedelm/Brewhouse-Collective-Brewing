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

	async function loadEconomy(panel) {
		const examplesEl = panel.querySelector("#economy-examples");
		const form = panel.querySelector("#economy-form");
		const errEl = panel.querySelector("#economy-error");
		const exampleABVs = [3.5, 4.5, 5.0, 5.5, 6.0, 8.0];

		function renderExamples(cfg) {
			const rate = cfg.rate_sek;
			const free = cfg.free_max_abv;
			const discount = cfg.discount;
			const rows = exampleABVs
				.map((abv) => {
					const sek =
						abv <= free ? 0 : Math.round(abv * rate * discount * 100) / 100;
					return (
						"<tr><td>" +
						abv.toFixed(1) +
						" %</td><td>" +
						sek.toFixed(2) +
						" " +
						currencyPerLiter() +
						"</td></tr>"
					);
				})
				.join("");
			examplesEl.innerHTML =
				"<p class=\"panel__lead\">" +
				esc(t("js.economy.examples_lead", { rate: rate, discount: discount })) +
				"</p>" +
				table([t("js.economy.examples_abv"), t("js.economy.examples_tax")], rows);
		}

		async function refresh() {
			examplesEl.textContent = t("js.loading");
			try {
				const cfg = await api("/api/settings/tax-config");
				form.querySelector('[name="rate_sek"]').value = cfg.rate_sek;
				form.querySelector('[name="free_max_abv"]').value = cfg.free_max_abv;
				form.querySelector('[name="discount"]').value = String(cfg.discount);
				renderExamples(cfg);
			} catch (e) {
				examplesEl.textContent = e.message;
			}
		}

		panel.querySelector('[data-action="economy-refresh"]').addEventListener("click", refresh);
		form.addEventListener("submit", async (ev) => {
			ev.preventDefault();
			errEl.hidden = true;
			if (!canRoles(["superuser", "admin"])) {
				return;
			}
			const fd = new FormData(form);
			try {
				const cfg = await api("/api/settings/tax-config", {
					method: "PUT",
					body: JSON.stringify({
						rate_sek: parseFloat(fd.get("rate_sek")),
						free_max_abv: parseFloat(fd.get("free_max_abv")),
						discount: parseFloat(fd.get("discount")),
					}),
				});
				renderExamples(cfg);
			} catch (e) {
				errEl.hidden = false;
				errEl.textContent = e.message;
			}
		});
		form.addEventListener("change", () => {
			const rate = parseFloat(form.querySelector('[name="rate_sek"]').value);
			const free = parseFloat(form.querySelector('[name="free_max_abv"]').value);
			const discount = parseFloat(form.querySelector('[name="discount"]').value);
			if (!Number.isNaN(rate) && !Number.isNaN(free) && !Number.isNaN(discount)) {
				renderExamples({ rate_sek: rate, free_max_abv: free, discount: discount });
			}
		});
		refresh();
	}

	window.BrewhousePanels = window.BrewhousePanels || {};
	window.BrewhousePanels["economy"] = loadEconomy;
})();
