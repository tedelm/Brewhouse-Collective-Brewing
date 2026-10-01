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

	async function loadHygiene(panel) {
		const list = panel.querySelector("#hygiene-list");
		const errEl = panel.querySelector("#hygiene-error");

		function renderChecklist(recipe, routines) {
			const groups = [];
			const index = {};
			(routines || []).forEach((r) => {
				const section = r.description || t("js.hygiene.checklist");
				if (index[section] == null) {
					index[section] = groups.length;
					groups.push({ section, items: [] });
				}
				groups[index[section]].items.push(r);
			});
			const body = groups
				.map((g) => {
					const items = g.items
						.map((r) => {
							const done = !!r.done;
							return (
								'<label class="hygiene-check' +
								(done ? " is-done" : "") +
								'"><input type="checkbox" data-hygiene-routine="' +
								r.id +
								'" data-recipe-id="' +
								recipe.id +
								'"' +
								(done ? " checked disabled" : "") +
								'> <span><span class="hygiene-step__id">#' +
								r.id +
								"</span> " +
								esc(r.name) +
								"</span></label>"
							);
						})
						.join("");
					return (
						'<div class="hygiene-section"><h3 class="hygiene-section__title">' +
						esc(g.section) +
						"</h3>" +
						items +
						"</div>"
					);
				})
				.join("");
			return (
				'<article class="hygiene-batch" data-hygiene-recipe="' +
				recipe.id +
				'"><div class="hygiene-batch__head"><h2 class="hygiene-batch__title">' +
				esc(recipe.name) +
				" · " +
				esc(recipe.brewery_name || "") +
				'</h2><button type="button" class="btn btn--small btn--primary" data-action="hygiene-complete-all" data-recipe-id="' +
				recipe.id +
				'">' +
				esc(t("hygiene.confirm_all")) +
				"</button></div>" +
				(body || "<p class=\"panel__empty\">" + esc(t("js.hygiene.no_routines")) + "</p>") +
				"</article>"
			);
		}

		async function refresh() {
			list.textContent = t("js.loading");
			if (errEl) {
				errEl.hidden = true;
			}
			try {
				const recipes = await api("/api/recipes");
				const brewday = (recipes || []).filter((r) => r.status === "brewday");
				if (!brewday.length) {
					list.innerHTML = "<p class=\"panel__empty\">" + esc(t("js.hygiene.no_brewday")) + "</p>";
					refreshBrewingNavCounts();
					return;
				}
				const statuses = await Promise.all(
					brewday.map((r) =>
						api("/api/recipes/" + r.id + "/hygiene").then((rows) => ({ r, rows }))
					)
				);
				list.innerHTML = statuses.map(({ r, rows }) => renderChecklist(r, rows || [])).join("");
				refreshBrewingNavCounts();
			} catch (e) {
				list.textContent = e.message;
			}
		}

		panel.querySelector('[data-action="hygiene-refresh"]').addEventListener("click", refresh);
		panel.addEventListener("change", async (ev) => {
			const el = ev.target;
			if (!(el instanceof HTMLInputElement) || !el.matches("[data-hygiene-routine]")) {
				return;
			}
			if (!el.checked) {
				return;
			}
			const recipeId = el.getAttribute("data-recipe-id");
			const routineId = el.getAttribute("data-hygiene-routine");
			try {
				await api("/api/recipes/" + recipeId + "/hygiene", {
					method: "POST",
					body: JSON.stringify({ routine_id: parseInt(routineId, 10) }),
				});
				refresh();
			} catch (e) {
				el.checked = false;
				if (errEl) {
					errEl.hidden = false;
					errEl.textContent = e.message;
				}
			}
		});
		panel.addEventListener("click", async (ev) => {
			const el = ev.target;
			if (!(el instanceof HTMLElement)) {
				return;
			}
			const btn = el.closest('[data-action="hygiene-complete-all"]');
			if (!btn) {
				return;
			}
			const recipeId = btn.getAttribute("data-recipe-id");
			const ok = await appConfirm({
				title: t("js.hygiene.complete_title"),
				message: t("js.hygiene.complete_message", { id: recipeId }),
			});
			if (!ok) {
				return;
			}
			try {
				await api("/api/recipes/" + recipeId + "/hygiene/complete", { method: "POST" });
				refresh();
				refreshBrewingNavCounts();
				await appInfo(pipelineGuide("hygiene_done"));
			} catch (e) {
				if (errEl) {
					errEl.hidden = false;
					errEl.textContent = e.message;
				}
			}
		});
		refresh();
	}

	window.BrewhousePanels = window.BrewhousePanels || {};
	window.BrewhousePanels["hygiene"] = loadHygiene;
})();
