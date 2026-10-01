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

	async function loadSettingsTanks(panel) {
		const tanksEl = panel.querySelector("#settings-tanks");

		async function refresh() {
			try {
				const tanks = await api("/api/settings/tanks");
				tanksEl.innerHTML = table(
					[t("common.id"), t("common.name"), t("js.settings.capacity_l"), t("common.active"), ""],
					(tanks || [])
						.map((tank) => {
							const toggleLabel = tank.active ? t("js.settings.disable") : t("js.settings.enable");
							return (
								"<tr><td>" +
								tank.id +
								"</td><td>" +
								esc(tank.name) +
								"</td><td>" +
								tank.capacity_liters +
								"</td><td>" +
								(tank.active ? t("js.settings.yes") : t("js.settings.no")) +
								'</td><td><button type="button" class="btn btn--small" data-tank-edit="' +
								tank.id +
								'" data-name="' +
								esc(tank.name) +
								'" data-capacity="' +
								tank.capacity_liters +
								'">' +
								esc(t("common.edit")) +
								'</button> <button type="button" class="btn btn--small" data-tank-active="' +
								tank.id +
								'" data-active="' +
								(tank.active ? "0" : "1") +
								'">' +
								toggleLabel +
								'</button> <button type="button" class="btn btn--small" data-tank-delete="' +
								tank.id +
								'">' +
								esc(t("common.remove")) +
								"</button></td></tr>"
							);
						})
						.join("")
				);
			} catch (e) {
				tanksEl.textContent = e.message;
			}
		}

		panel.addEventListener("click", async (ev) => {
			const el = ev.target;
			if (!(el instanceof HTMLElement)) {
				return;
			}
			if (el.hasAttribute("data-tank-edit")) {
				const id = el.getAttribute("data-tank-edit");
				const values = await appPrompt({
					title: t("js.settings.edit_tank"),
					fields: [
						{
							name: "name",
							label: t("js.settings.tank_name"),
							type: "text",
							value: el.getAttribute("data-name") || "",
						},
						{
							name: "capacity_liters",
							label: t("js.settings.capacity_liters"),
							type: "number",
							step: "any",
							value: el.getAttribute("data-capacity") || "0",
						},
					],
				});
				if (!values || !String(values.name || "").trim()) {
					return;
				}
				try {
					await api("/api/settings/tanks/" + id, {
						method: "PUT",
						body: JSON.stringify({
							name: String(values.name).trim(),
							capacity_liters: parseFloat(values.capacity_liters),
						}),
					});
					refresh();
				} catch (e) {
					await appInfo({ title: noticeTitle(), message: e.message });
				}
				return;
			}
			if (el.hasAttribute("data-tank-active")) {
				try {
					await api("/api/settings/tanks/" + el.getAttribute("data-tank-active") + "/active", {
						method: "POST",
						body: JSON.stringify({ active: el.getAttribute("data-active") === "1" }),
					});
					refresh();
				} catch (e) {
					await appInfo({ title: noticeTitle(), message: e.message });
				}
				return;
			}
			if (el.hasAttribute("data-tank-delete")) {
				const id = el.getAttribute("data-tank-delete");
				const ok = await appConfirm({
					title: t("js.settings.remove_tank_title"),
					message: t("js.settings.remove_tank_message", { id: id }),
				});
				if (!ok) {
					return;
				}
				try {
					await api("/api/settings/tanks/" + id, { method: "DELETE" });
					refresh();
				} catch (e) {
					await appInfo({ title: noticeTitle(), message: e.message });
				}
				return;
			}
			if (el.getAttribute("data-action") !== "settings-tank-new") {
				return;
			}
			const values = await appPrompt({
				title: t("js.settings.new_tank"),
				fields: [
					{ name: "name", label: t("js.settings.tank_name"), type: "text" },
					{ name: "capacity_liters", label: t("js.settings.capacity_liters"), type: "number", step: "any", value: "1000" },
				],
			});
			if (!values || !String(values.name || "").trim()) {
				return;
			}
			try {
				await api("/api/settings/tanks", {
					method: "POST",
					body: JSON.stringify({
						name: String(values.name).trim(),
						capacity_liters: parseFloat(values.capacity_liters),
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
	window.BrewhousePanels["settings-tanks"] = loadSettingsTanks;
})();
