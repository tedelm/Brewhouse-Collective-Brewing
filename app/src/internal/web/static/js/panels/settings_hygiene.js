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

	async function loadSettingsHygiene(panel) {
		const hygEl = panel.querySelector("#settings-hygiene");

		async function refresh() {
			try {
				const hyg = await api("/api/settings/hygiene-routines");
				hygEl.innerHTML = table(
					[t("common.name"), t("js.settings.description"), t("js.settings.sort"), ""],
					(hyg || [])
						.map((r) => {
							return (
								"<tr><td>" +
								esc(r.name) +
								"</td><td>" +
								esc(r.description || "") +
								"</td><td>" +
								r.sort_order +
								'</td><td><button type="button" class="btn btn--small" data-hygiene-edit="' +
								r.id +
								'" data-name="' +
								esc(r.name) +
								'" data-description="' +
								esc(r.description || "") +
								'" data-sort="' +
								r.sort_order +
								'">' + esc(t("common.edit")) + '</button> <button type="button" class="btn btn--small" data-hygiene-delete="' +
								r.id +
								'">' + esc(t("common.remove")) + "</button></td></tr>"
							);
						})
						.join("")
				);
			} catch (e) {
				hygEl.textContent = e.message;
			}
		}

		panel.addEventListener("click", async (ev) => {
			const el = ev.target;
			if (!(el instanceof HTMLElement)) {
				return;
			}
			if (el.hasAttribute("data-hygiene-edit")) {
				const id = el.getAttribute("data-hygiene-edit");
				const values = await appPrompt({
					title: t("js.settings.edit_hygiene"),
					fields: [
						{
							name: "name",
							label: t("common.name"),
							type: "text",
							value: el.getAttribute("data-name") || "",
						},
						{
							name: "description",
							label: t("js.settings.description"),
							type: "text",
							value: el.getAttribute("data-description") || "",
						},
						{
							name: "sort_order",
							label: t("js.settings.sort_order"),
							type: "number",
							step: "1",
							value: el.getAttribute("data-sort") || "0",
						},
					],
				});
				if (!values || !String(values.name || "").trim()) {
					return;
				}
				try {
					await api("/api/settings/hygiene-routines/" + id, {
						method: "PUT",
						body: JSON.stringify({
							name: String(values.name).trim(),
							description: String(values.description || "").trim(),
							sort_order: parseInt(values.sort_order, 10) || 0,
						}),
					});
					refresh();
				} catch (e) {
					await appInfo({ title: noticeTitle(), message: e.message });
				}
				return;
			}
			if (el.hasAttribute("data-hygiene-delete")) {
				const id = el.getAttribute("data-hygiene-delete");
				const ok = await appConfirm({
					title: t("js.settings.remove_hygiene_title"),
					message: t("js.settings.remove_hygiene_message", { id: id }),
				});
				if (!ok) {
					return;
				}
				try {
					await api("/api/settings/hygiene-routines/" + id, { method: "DELETE" });
					refresh();
				} catch (e) {
					await appInfo({ title: noticeTitle(), message: e.message });
				}
				return;
			}
			if (el.getAttribute("data-action") === "settings-hygiene-refresh") {
				refresh();
				return;
			}
			if (el.getAttribute("data-action") !== "settings-hygiene-new") {
				return;
			}
			const values = await appPrompt({
				title: t("js.settings.new_hygiene"),
				fields: [
					{ name: "name", label: t("common.name"), type: "text" },
					{ name: "description", label: t("js.settings.description"), type: "text" },
					{ name: "sort_order", label: t("js.settings.sort_order"), type: "number", step: "1", value: "0" },
				],
			});
			if (!values || !String(values.name || "").trim()) {
				return;
			}
			try {
				await api("/api/settings/hygiene-routines", {
					method: "POST",
					body: JSON.stringify({
						name: String(values.name).trim(),
						description: String(values.description || "").trim(),
						sort_order: parseInt(values.sort_order, 10) || 0,
					}),
				});
				refresh();
			} catch (e) {
				await appInfo({ title: noticeTitle(), message: e.message });
			}
		});
		refresh();
	}

	window.BrewhousePanels = window.BrewhousePanels || {};
	window.BrewhousePanels["settings-hygiene"] = loadSettingsHygiene;
})();
