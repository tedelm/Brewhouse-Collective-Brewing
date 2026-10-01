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

	async function loadSettingsMultipliers(panel) {
		const multsEl = panel.querySelector("#settings-mults");

		async function refresh() {
			try {
				const mults = await api("/api/settings/multipliers");
				multsEl.innerHTML = table(
					[t("common.id"), t("common.name"), "×", t("common.active"), ""],
					(mults || [])
						.map((m) => {
							const toggleLabel = m.active ? t("js.settings.disable") : t("js.settings.enable");
							return (
								"<tr><td>" +
								m.id +
								"</td><td>" +
								esc(m.name) +
								"</td><td>" +
								m.multiplier +
								"</td><td>" +
								(m.active ? t("js.settings.yes") : t("js.settings.no")) +
								'</td><td><button type="button" class="btn btn--small" data-mult-edit="' +
								m.id +
								'" data-name="' +
								esc(m.name) +
								'" data-multiplier="' +
								m.multiplier +
								'">' + esc(t("common.edit")) + '</button> <button type="button" class="btn btn--small" data-mult-active="' +
								m.id +
								'" data-active="' +
								(m.active ? "0" : "1") +
								'">' +
								toggleLabel +
								'</button> <button type="button" class="btn btn--small" data-mult-delete="' +
								m.id +
								'">' + esc(t("common.remove")) + "</button></td></tr>"
							);
						})
						.join("")
				);
			} catch (e) {
				multsEl.textContent = e.message;
			}
		}

		panel.addEventListener("click", async (ev) => {
			const el = ev.target;
			if (!(el instanceof HTMLElement)) {
				return;
			}
			if (el.hasAttribute("data-mult-edit")) {
				const id = el.getAttribute("data-mult-edit");
				const values = await appPrompt({
					title: t("js.settings.edit_multiplier"),
					fields: [
						{
							name: "name",
							label: t("js.settings.multiplier_name"),
							type: "text",
							value: el.getAttribute("data-name") || "",
						},
						{
							name: "multiplier",
							label: t("delivery.multiplier"),
							type: "number",
							step: "any",
							value: el.getAttribute("data-multiplier") || "1",
						},
					],
				});
				if (!values || !String(values.name || "").trim()) {
					return;
				}
				try {
					await api("/api/settings/multipliers/" + id, {
						method: "PUT",
						body: JSON.stringify({
							name: String(values.name).trim(),
							multiplier: parseFloat(values.multiplier),
						}),
					});
					refresh();
				} catch (e) {
					await appInfo({ title: noticeTitle(), message: e.message });
				}
				return;
			}
			if (el.hasAttribute("data-mult-active")) {
				try {
					await api(
						"/api/settings/multipliers/" + el.getAttribute("data-mult-active") + "/active",
						{
							method: "POST",
							body: JSON.stringify({ active: el.getAttribute("data-active") === "1" }),
						}
					);
					refresh();
				} catch (e) {
					await appInfo({ title: noticeTitle(), message: e.message });
				}
				return;
			}
			if (el.hasAttribute("data-mult-delete")) {
				const id = el.getAttribute("data-mult-delete");
				const ok = await appConfirm({
					title: t("js.settings.remove_multiplier_title"),
					message: t("js.settings.remove_multiplier_message", { id: id }),
				});
				if (!ok) {
					return;
				}
				try {
					await api("/api/settings/multipliers/" + id, { method: "DELETE" });
					refresh();
				} catch (e) {
					await appInfo({ title: noticeTitle(), message: e.message });
				}
				return;
			}
			if (el.getAttribute("data-action") !== "settings-mult-new") {
				return;
			}
			const values = await appPrompt({
				title: t("js.settings.new_multiplier"),
				fields: [
					{ name: "name", label: t("js.settings.multiplier_name"), type: "text" },
					{ name: "multiplier", label: t("delivery.multiplier"), type: "number", step: "any", value: "1.5" },
				],
			});
			if (!values || !String(values.name || "").trim()) {
				return;
			}
			try {
				await api("/api/settings/multipliers", {
					method: "POST",
					body: JSON.stringify({
						name: String(values.name).trim(),
						multiplier: parseFloat(values.multiplier),
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
	window.BrewhousePanels["settings-multipliers"] = loadSettingsMultipliers;
})();
