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

	async function loadSettingsBeerPrice(panel) {
		const beerForm = panel.querySelector("#settings-beer-price-form");
		const beerErr = panel.querySelector("#settings-beer-price-error");

		async function refresh() {
			try {
				const beer = await api("/api/settings/beer-price");
				beerForm.querySelector('[name="min_net_sek_per_liter"]').value =
					beer.min_net_sek_per_liter ?? 0;
			} catch (e) {
				beerErr.hidden = false;
				beerErr.textContent = e.message;
			}
		}

		beerForm.addEventListener("submit", async (ev) => {
			ev.preventDefault();
			beerErr.hidden = true;
			const fd = new FormData(beerForm);
			try {
				await api("/api/settings/beer-price", {
					method: "PUT",
					body: JSON.stringify({
						min_net_sek_per_liter: parseFloat(fd.get("min_net_sek_per_liter")),
					}),
				});
			} catch (e) {
				beerErr.hidden = false;
				beerErr.textContent = e.message;
			}
		});
		refresh();
	}

	window.BrewhousePanels = window.BrewhousePanels || {};
	window.BrewhousePanels["settings-beer-price"] = loadSettingsBeerPrice;
})();
