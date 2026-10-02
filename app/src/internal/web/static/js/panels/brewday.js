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
		fmtGravity,
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

	async function loadBrewday(panel) {
		const list = panel.querySelector("#brewday-list");
		const form = panel.querySelector("#brewday-form");
		const errEl = panel.querySelector("#brewday-error");
		const recipeSel = panel.querySelector("#brewday-recipe");
		const ogInput = form.querySelector('[name="og"]');
		const volInput = form.querySelector('[name="brew_volume"]');
		let byID = {};

		function fillBrewdayFields(recipe) {
			const defs = window.BrewhouseCore.gravityInputDefaults
				? window.BrewhouseCore.gravityInputDefaults()
				: { og: "1.050" };
			ogInput.value = fmtGravity(recipe && recipe.og, defs.og);
			if (recipe && recipe.brew_volume != null && recipe.brew_volume !== "") {
				volInput.value = recipe.brew_volume;
			} else {
				volInput.value = "100";
			}
			const submitBtn = form.querySelector('button[type="submit"]');
			if (submitBtn) {
				submitBtn.disabled = false;
				submitBtn.title = "";
			}
		}

		function selectRecipeForEdit(recipeId) {
			const key = String(recipeId);
			const recipe = byID[key];
			if (!recipe) {
				return;
			}
			recipeSel.value = key;
			fillBrewdayFields(recipe);
			form.scrollIntoView({ behavior: "smooth", block: "nearest" });
		}

		async function refresh(preferId) {
			list.textContent = t("js.loading");
			try {
				const recipes = await api("/api/recipes");
				const selectable = (recipes || []).filter(
					(r) =>
						r.status === "scheduled" ||
						r.status === "brewday" ||
						r.status === "hygiene_done"
				);
				byID = {};
				selectable.forEach((r) => {
					byID[String(r.id)] = r;
				});
				const prev = preferId != null ? String(preferId) : recipeSel.value;
				fillRecipeSelect(recipeSel, selectable, t("js.brewday.no_ready"));
				if (prev && byID[prev]) {
					recipeSel.value = prev;
				}
				fillBrewdayFields(byID[recipeSel.value]);
				if (!selectable.length) {
					list.innerHTML = "<p class=\"panel__empty\">" + esc(t("js.brewday.empty")) + "</p>";
					refreshBrewingNavCounts();
					return;
				}
				list.innerHTML = table(
					[t("js.brewday.col.id"), t("js.brewday.col.name"), t("js.brewday.col.brewery"), t("js.brewday.col.status"), t("js.brewday.col.og"), t("js.brewday.col.brew_vol"), ""],
					selectable
						.map((r) => {
							let actions = "";
							if (r.status === "brewday") {
								actions =
									'<button type="button" class="btn btn--small" data-action="brewday-edit" data-id="' +
									r.id +
									'">' + esc(t("common.edit")) + "</button> " +
									'<button type="button" class="btn btn--small btn--primary" data-action="brewday-hygiene-done" data-id="' +
									r.id +
									'">' + esc(t("js.brewday.hygiene_shortcut")) + "</button> " +
									'<button type="button" class="btn btn--small" data-action="brewday-revoke" data-id="' +
									r.id +
									'">' + esc(t("js.brewday.remove")) + "</button>";
							}
							if (r.status === "hygiene_done") {
								actions =
									'<button type="button" class="btn btn--small" data-action="brewday-edit" data-id="' +
									r.id +
									'">' + esc(t("common.edit")) + "</button> " +
									'<button type="button" class="btn btn--small" data-action="brewday-hygiene-revoke" data-id="' +
									r.id +
									'">' + esc(t("js.brewday.revoke_hygiene")) + "</button>";
							}
							return (
								"<tr><td>" +
								r.id +
								"</td><td>" +
								esc(r.name) +
								"</td><td>" +
								esc(r.brewery_name || "") +
								"</td><td>" +
								statusPill(r.status, statusText(r.status)) +
								"</td><td>" +
								fmtGravity(r.og, "") +
								"</td><td>" +
								(r.brew_volume ?? "") +
								"</td><td>" +
								actions +
								"</td></tr>"
							);
						})
						.join("")
				);
				refreshBrewingNavCounts();
			} catch (e) {
				list.textContent = e.message;
			}
		}

		panel.querySelector('[data-action="brewday-refresh"]').addEventListener("click", () => {
			refresh();
		});
		recipeSel.addEventListener("change", () => {
			fillBrewdayFields(byID[recipeSel.value]);
		});
		panel.addEventListener("click", async (ev) => {
			const el = ev.target;
			if (!(el instanceof HTMLElement)) {
				return;
			}
			const action = el.getAttribute("data-action");
			const id = el.getAttribute("data-id");
			if (action === "brewday-edit") {
				const key = String(id);
				let recipe = byID[key];
				if (!recipe) {
					return;
				}
				try {
					if (recipe.status === "hygiene_done") {
						await api("/api/recipes/" + key + "/hygiene/revoke", { method: "POST" });
						await refresh(key);
						recipe = byID[key];
					}
					selectRecipeForEdit(key);
				} catch (e) {
					await appInfo({ title: noticeTitle(), message: e.message });
				}
				return;
			}
			if (action === "brewday-revoke") {
				const ok = await appConfirm({
					title: t("js.brewday.remove_title"),
					message: t("js.brewday.remove_message", { id: id }),
				});
				if (!ok) {
					return;
				}
				try {
					await api("/api/recipes/" + id + "/brewday/revoke", { method: "POST" });
					refresh();
				} catch (e) {
					await appInfo({ title: noticeTitle(), message: e.message });
				}
				return;
			}
			if (action === "brewday-hygiene-revoke") {
				const ok = await appConfirm({
					title: t("js.brewday.revoke_hygiene_title"),
					message: t("js.brewday.revoke_hygiene_message", { id: id }),
				});
				if (!ok) {
					return;
				}
				try {
					await api("/api/recipes/" + id + "/hygiene/revoke", { method: "POST" });
					refresh(id);
				} catch (e) {
					await appInfo({ title: noticeTitle(), message: e.message });
				}
				return;
			}
			if (action !== "brewday-hygiene-done") {
				return;
			}
			const ok = await appConfirm({
				title: t("js.hygiene.complete_title"),
				message: t("js.brewday.hygiene_message", { id: id }),
			});
			if (!ok) {
				return;
			}
			try {
				await api("/api/recipes/" + id + "/hygiene/complete", { method: "POST" });
				refresh();
				await appInfo(pipelineGuide("hygiene_done"));
			} catch (e) {
				await appInfo({ title: noticeTitle(), message: e.message });
			}
		});
		form.addEventListener("submit", async (ev) => {
			ev.preventDefault();
			errEl.hidden = true;
			const fd = new FormData(form);
			try {
				await api("/api/recipes/" + fd.get("recipe_id") + "/brewday", {
					method: "POST",
					body: JSON.stringify({
						og: toSG(fd.get("og")),
						brew_volume: parseFloat(fd.get("brew_volume")),
					}),
				});
				refresh();
				await appInfo(pipelineGuide("brewday_recorded"));
			} catch (e) {
				errEl.hidden = false;
				errEl.textContent = e.message;
			}
		});
		applyGravityInputs(panel);
		const defs = window.BrewhouseCore.gravityInputDefaults
			? window.BrewhouseCore.gravityInputDefaults()
			: { og: "1.050" };
		if (!recipeSel.value) {
			ogInput.value = defs.og;
		}
		refresh();
	}

	window.BrewhousePanels = window.BrewhousePanels || {};
	window.BrewhousePanels["brewday"] = loadBrewday;
})();
