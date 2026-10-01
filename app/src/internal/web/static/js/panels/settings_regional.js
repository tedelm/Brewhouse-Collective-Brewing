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

	async function loadSettingsRegional(panel) {
		const form = panel.querySelector("#settings-regional-form");
		const errEl = panel.querySelector("#settings-regional-error");
		const currencySel = panel.querySelector("#settings-regional-currency");
		const languageSel = panel.querySelector("#settings-regional-language");

		async function refresh() {
			try {
				const cfg = await api("/api/settings/regional");
				currencySel.value = cfg.currency_code || "SEK";
				languageSel.value = cfg.language || "en";
			} catch (e) {
				errEl.hidden = false;
				errEl.textContent = e.message;
			}
		}

		form.addEventListener("submit", async (ev) => {
			ev.preventDefault();
			errEl.hidden = true;
			try {
				const cfg = await api("/api/settings/regional", {
					method: "PUT",
					body: JSON.stringify({
						currency_code: currencySel.value,
						language: languageSel.value,
					}),
				});
				if (window.BH_I18N && typeof window.BH_I18N.applyRegional === "function") {
					await window.BH_I18N.applyRegional(cfg);
				}
			} catch (e) {
				errEl.hidden = false;
				errEl.textContent = e.message;
			}
		});
		refresh();
	}

	window.BrewhousePanels = window.BrewhousePanels || {};
	window.BrewhousePanels["settings-regional"] = loadSettingsRegional;
})();
