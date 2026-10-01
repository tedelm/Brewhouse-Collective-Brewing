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

	async function loadSettingsSuppliers(panel) {
		const listEl = panel.querySelector("#settings-suppliers");

		async function refresh() {
			try {
				const suppliers = await api("/api/settings/suppliers");
				listEl.innerHTML = table(
					[
						t("common.id"),
						t("common.name"),
						t("settings.suppliers.adjust_percent"),
						t("common.active"),
						"",
					],
					(suppliers || [])
						.map((s) => {
							const toggleLabel = s.active ? t("js.settings.disable") : t("js.settings.enable");
							return (
								"<tr><td>" +
								s.id +
								"</td><td>" +
								esc(s.name) +
								"</td><td>" +
								s.adjust_percent +
								"</td><td>" +
								(s.active ? t("js.settings.yes") : t("js.settings.no")) +
								'</td><td><button type="button" class="btn btn--small" data-supplier-edit="' +
								s.id +
								'" data-name="' +
								esc(s.name) +
								'" data-adjust="' +
								s.adjust_percent +
								'">' +
								esc(t("common.edit")) +
								'</button> <button type="button" class="btn btn--small" data-supplier-active="' +
								s.id +
								'" data-active="' +
								(s.active ? "0" : "1") +
								'">' +
								toggleLabel +
								'</button> <button type="button" class="btn btn--small" data-supplier-delete="' +
								s.id +
								'">' +
								esc(t("common.remove")) +
								"</button></td></tr>"
							);
						})
						.join("")
				);
			} catch (e) {
				listEl.textContent = e.message;
			}
		}

		panel.addEventListener("click", async (ev) => {
			const el = ev.target;
			if (!(el instanceof HTMLElement)) {
				return;
			}
			if (el.hasAttribute("data-supplier-edit")) {
				const id = el.getAttribute("data-supplier-edit");
				const values = await appPrompt({
					title: t("js.settings.edit_supplier"),
					fields: [
						{
							name: "name",
							label: t("js.settings.supplier_name"),
							type: "text",
							value: el.getAttribute("data-name") || "",
						},
						{
							name: "adjust_percent",
							label: t("js.settings.adjust_percent"),
							type: "number",
							step: "any",
							value: el.getAttribute("data-adjust") || "0",
						},
					],
				});
				if (!values || !String(values.name || "").trim()) {
					return;
				}
				try {
					await api("/api/settings/suppliers/" + id, {
						method: "PUT",
						body: JSON.stringify({
							name: String(values.name).trim(),
							adjust_percent: parseFloat(values.adjust_percent) || 0,
						}),
					});
					refresh();
				} catch (e) {
					await appInfo({ title: noticeTitle(), message: e.message });
				}
				return;
			}
			if (el.hasAttribute("data-supplier-active")) {
				try {
					await api(
						"/api/settings/suppliers/" + el.getAttribute("data-supplier-active") + "/active",
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
			if (el.hasAttribute("data-supplier-delete")) {
				const id = el.getAttribute("data-supplier-delete");
				const ok = await appConfirm({
					title: t("js.settings.remove_supplier_title"),
					message: t("js.settings.remove_supplier_message", { id: id }),
				});
				if (!ok) {
					return;
				}
				try {
					await api("/api/settings/suppliers/" + id, { method: "DELETE" });
					refresh();
				} catch (e) {
					await appInfo({ title: noticeTitle(), message: e.message });
				}
				return;
			}
			if (el.getAttribute("data-action") !== "settings-supplier-new") {
				return;
			}
			const values = await appPrompt({
				title: t("js.settings.new_supplier"),
				fields: [
					{ name: "name", label: t("js.settings.supplier_name"), type: "text" },
					{
						name: "adjust_percent",
						label: t("js.settings.adjust_percent"),
						type: "number",
						step: "any",
						value: "0",
					},
				],
			});
			if (!values || !String(values.name || "").trim()) {
				return;
			}
			try {
				await api("/api/settings/suppliers", {
					method: "POST",
					body: JSON.stringify({
						name: String(values.name).trim(),
						adjust_percent: parseFloat(values.adjust_percent) || 0,
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
	window.BrewhousePanels["settings-suppliers"] = loadSettingsSuppliers;
})();
