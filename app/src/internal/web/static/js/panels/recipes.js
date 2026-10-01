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

	async function loadRecipes(panel) {
		const list = panel.querySelector("#recipes-list");
		const dialog = panel.querySelector("#recipe-dialog");
		const form = panel.querySelector("#recipe-form");
		const errEl = panel.querySelector("#recipe-error");
		const titleEl = panel.querySelector("#recipe-dialog-title");
		const saveBtn = panel.querySelector("#recipe-save-btn");
		const brewerySel = form.querySelector('[name="brewery_id"]');
		const shortfallDialog = panel.querySelector("#recipe-shortfall-dialog");
		const shortfallList = panel.querySelector("#recipe-shortfall-list");
		const shortfallNotice = panel.querySelector("#recipe-shortfall-notice");
		const shortfallError = panel.querySelector("#recipe-shortfall-error");
		const showHiddenEl = panel.querySelector("#recipes-show-hidden");

		function editableStatus(status) {
			return status === "created" || status === "scheduled";
		}

		function showHidden() {
			return !!(showHiddenEl && showHiddenEl.checked);
		}

		async function openRecipeDialog(recipe) {
			errEl.hidden = true;
			const breweries = await api("/api/breweries");
			const items = await api("/api/inventory");
			form._items = items || [];
			brewerySel.innerHTML = (breweries || [])
				.map((b) => '<option value="' + b.id + '">' + esc(b.name) + "</option>")
				.join("");
			renderIngSections(panel);
			if (recipe && recipe.id) {
				form.elements.namedItem("id").value = String(recipe.id);
				brewerySel.value = String(recipe.brewery_id);
				brewerySel.disabled = true;
				form.elements.namedItem("name").value = recipe.name || "";
				if (titleEl) {
					titleEl.textContent = t("js.recipes.edit");
				}
				if (saveBtn) {
					saveBtn.textContent = t("common.save");
				}
				const ings = recipe.ingredients || [];
				ings.forEach((ing) =>
					addIngRow(panel, ing.inventory_item_id, ing.qty, ing.unit, ing.category)
				);
			} else {
				form.elements.namedItem("id").value = "";
				brewerySel.disabled = false;
				form.elements.namedItem("name").value = "";
				if (titleEl) {
					titleEl.textContent = t("js.recipes.new");
				}
				if (saveBtn) {
					saveBtn.textContent = t("js.recipes.create");
				}
			}
			dialog.showModal();
		}

		async function refresh() {
			list.textContent = t("js.loading");
			try {
				const qs = showHidden() ? "?include_hidden=1" : "";
				const recipes = await api("/api/recipes" + qs);
				if (!recipes || !recipes.length) {
					list.innerHTML = "<p class=\"panel__empty\">" + esc(t("js.recipes.empty")) + "</p>";
					refreshBrewingNavCounts();
					return;
				}
				function ingredientsUsed(status) {
					return (
						status === "brewday" ||
						status === "hygiene_done" ||
						status === "ready_for_delivery" ||
						status === "delivered"
					);
				}
				function lineStatus(ing, recipeStatus) {
					if (ingredientsUsed(recipeStatus)) {
						return "completed";
					}
					const need = Number(ing.qty) || 0;
					const taken = Number(ing.checked_out) || 0;
					if (taken >= need) {
						return "ok";
					}
					if (taken > 0) {
						return "partial";
					}
					return "short";
				}
				function statusChip(status) {
					const s = status || "ok";
					return (
						'<span class="status-pill status-pill--' +
						esc(s) +
						" ingredient-status ingredient-status--" +
						esc(s) +
						'">' +
						esc(s) +
						"</span>"
					);
				}
				function renderIngDetail(r) {
					const ings = r.ingredients || [];
					if (!ings.length) {
						return '<p class="panel__empty">' + esc(t("js.recipes.no_ingredients")) + "</p>";
					}
					const rows = ings
						.map((ing) => {
							const unit = ing.unit ? " " + esc(ing.unit) : "";
							return (
								"<tr><td>" +
								esc(ing.item_name || "") +
								"</td><td>" +
								esc(categoryText(ing.category || "")) +
								"</td><td>" +
								(ing.qty ?? "") +
								unit +
								"</td><td>" +
								(ing.checked_out ?? "") +
								unit +
								"</td><td>" +
								statusChip(lineStatus(ing, r.status)) +
								"</td></tr>"
							);
						})
						.join("");
					return (
						'<table class="data-table data-table--nested"><thead><tr>' +
						"<th>" + esc(t("js.recipes.ing.ingredient")) + "</th><th>" + esc(t("js.recipes.ing.category")) + "</th><th>" + esc(t("js.recipes.ing.need")) + "</th><th>" + esc(t("js.recipes.ing.checked_out")) + "</th><th>" + esc(t("js.recipes.ing.status")) + "</th>" +
						"</tr></thead><tbody>" +
						rows +
						"</tbody></table>"
					);
				}
				const body = recipes
					.map((r) => {
						let actions = "";
						if (editableStatus(r.status)) {
							actions +=
								'<button type="button" class="btn btn--small" data-edit-recipe="' +
								r.id +
								'">' + esc(t("common.edit")) + "</button> ";
							actions +=
								'<button type="button" class="btn btn--small" data-del-recipe="' +
								r.id +
								'">' + esc(t("common.delete")) + "</button>";
						}
						if (r.status === "delivered" && r.active !== false) {
							actions +=
								' <button type="button" class="btn btn--small" data-hide-recipe="' +
								r.id +
								'">' + esc(t("js.recipes.hide")) + "</button>";
						}
						if (r.status === "delivered" && r.active === false) {
							actions +=
								' <button type="button" class="btn btn--small" data-unhide-recipe="' +
								r.id +
								'">' + esc(t("js.recipes.unhide")) + "</button>";
						}
						if (r.status === "ready_for_delivery") {
							actions +=
								' <button type="button" class="btn btn--small" data-deliver="' +
								r.id +
								'">' + esc(t("js.recipes.deliver")) + "</button>";
						}
						if (r.status === "delivered") {
							actions +=
								' <button type="button" class="btn btn--small" data-brew-again="' +
								r.id +
								'">' + esc(t("js.recipes.brew_again")) + "</button>";
						}
						const next = recipeNextStep(r.status);
						const nextCell = next ? navLink(next.href, next.label) : "—";
						const statusLabel =
							r.status === "delivered" && r.active === false
								? t("js.recipes.delivered_hidden")
								: statusText(r.status);
						const statusKey =
							r.status === "delivered" && r.active === false ? "delivered" : r.status;
						const ingStatus = r.ingredient_status || "ok";
						const main =
							'<tr class="recipe-row" data-recipe-id="' +
							r.id +
							'"><td>' +
							r.id +
							"</td><td>" +
							esc(r.name) +
							"</td><td>" +
							esc(r.brewery_name || String(r.brewery_id)) +
							"</td><td>" +
							statusPill(statusKey, statusLabel) +
							'</td><td><button type="button" class="ingredient-status-btn" data-toggle-ingredients="' +
							r.id +
							'" aria-expanded="false">' +
							statusChip(ingStatus) +
							' <span class="ingredient-status-btn__chevron" aria-hidden="true">▸</span></button></td><td>' +
							nextCell +
							"</td><td>" +
							actions +
							"</td></tr>";
						const detail =
							'<tr class="recipe-ings-detail" data-ings-for="' +
							r.id +
							'" hidden><td colspan="7">' +
							renderIngDetail(r) +
							"</td></tr>";
						return main + detail;
					})
					.join("");
				list.innerHTML =
					'<div class="table-scroll"><table class="data-table"><thead><tr>' +
					"<th>" + esc(t("js.recipes.col.id")) + "</th><th>" + esc(t("js.recipes.col.name")) + "</th><th>" + esc(t("js.recipes.col.brewery")) + "</th><th>" + esc(t("js.recipes.col.status")) + "</th><th>" + esc(t("js.recipes.col.ingredients")) + "</th><th>" + esc(t("js.recipes.col.next")) + "</th><th>" + esc(t("js.recipes.col.actions")) + "</th>" +
					"</tr></thead><tbody>" +
					body +
					"</tbody></table></div>";
				refreshBrewingNavCounts();
			} catch (e) {
				list.textContent = e.message;
			}
		}

		function showShortfallNotice(lines, orderId) {
			const lead = panel.querySelector("#recipe-shortfall-lead");
			if (lead) {
				lead.textContent = orderId
					? t("js.recipes.shortfall_with_order", { id: orderId })
					: t("js.recipes.shortfall_no_order");
			}
			shortfallNotice.hidden = true;
			shortfallError.hidden = true;
			shortfallList.innerHTML = (lines || [])
				.map(
					(s) =>
						"<li>" +
						esc(s.name) +
						" — " + t("js.recipes.missing") + " " +
						esc(String(s.missing)) +
						"</li>"
				)
				.join("");
			return new Promise((resolve) => {
				const onClose = () => {
					shortfallDialog.removeEventListener("close", onClose);
					resolve();
				};
				shortfallDialog.addEventListener("close", onClose);
				shortfallDialog.showModal();
			});
		}

		panel.addEventListener("click", async (ev) => {
			const el = ev.target;
			if (!(el instanceof HTMLElement)) {
				return;
			}
			if (el.getAttribute("data-action") === "recipe-refresh") {
				refresh();
			}
			const toggleBtn = el.closest("[data-toggle-ingredients]");
			if (toggleBtn) {
				const id = toggleBtn.getAttribute("data-toggle-ingredients");
				const detail = list.querySelector('.recipe-ings-detail[data-ings-for="' + id + '"]');
				const chevron = toggleBtn.querySelector(".ingredient-status-btn__chevron");
				if (detail) {
					const open = detail.hasAttribute("hidden");
					if (open) {
						detail.removeAttribute("hidden");
					} else {
						detail.setAttribute("hidden", "");
					}
					toggleBtn.setAttribute("aria-expanded", open ? "true" : "false");
					if (chevron) {
						chevron.textContent = open ? "▾" : "▸";
					}
				}
				return;
			}
			if (el.getAttribute("data-action") === "recipe-new") {
				try {
					await openRecipeDialog(null);
				} catch (e) {
					await appInfo({ title: noticeTitle(), message: e.message });
				}
			}
			if (el.getAttribute("data-action") === "recipe-remove-ing") {
				const row = el.closest(".ing-row");
				if (row) {
					row.remove();
				}
			}
			if (el.hasAttribute("data-edit-recipe")) {
				const id = el.getAttribute("data-edit-recipe");
				try {
					const recipe = await api("/api/recipes/" + id);
					await openRecipeDialog(recipe);
				} catch (e) {
					await appInfo({ title: noticeTitle(), message: e.message });
				}
			}
			if (el.hasAttribute("data-del-recipe")) {
				const id = el.getAttribute("data-del-recipe");
				const ok = await appConfirm({
					title: t("js.recipes.delete_title"),
					message: t("js.recipes.delete_message", { id: id }),
				});
				if (!ok) {
					return;
				}
				try {
					await api("/api/recipes/" + id, { method: "DELETE" });
					refresh();
				} catch (e) {
					await appInfo({ title: noticeTitle(), message: e.message });
				}
			}
			if (el.hasAttribute("data-hide-recipe")) {
				const id = el.getAttribute("data-hide-recipe");
				try {
					await api("/api/recipes/" + id + "/active", {
						method: "POST",
						body: JSON.stringify({ active: false }),
					});
					refresh();
				} catch (e) {
					await appInfo({ title: noticeTitle(), message: e.message });
				}
			}
			if (el.hasAttribute("data-unhide-recipe")) {
				const id = el.getAttribute("data-unhide-recipe");
				try {
					await api("/api/recipes/" + id + "/active", {
						method: "POST",
						body: JSON.stringify({ active: true }),
					});
					refresh();
				} catch (e) {
					await appInfo({ title: noticeTitle(), message: e.message });
				}
			}
			if (el.hasAttribute("data-deliver")) {
				const id = el.getAttribute("data-deliver");
				try {
					await api("/api/recipes/" + id + "/deliver", { method: "POST" });
					refresh();
				} catch (e) {
					await appInfo({ title: noticeTitle(), message: e.message });
				}
			}
			if (el.hasAttribute("data-brew-again")) {
				const id = el.getAttribute("data-brew-again");
				const ok = await appConfirm({
					title: t("js.recipes.brew_again_title"),
					message: t("js.recipes.brew_again_message"),
				});
				if (!ok) {
					return;
				}
				try {
					await api("/api/recipes/" + id + "/brew-again", { method: "POST" });
					refresh();
					refreshOrdersNavCount();
					await appInfo(pipelineGuide("recipe_created"));
				} catch (e) {
					await appInfo({ title: noticeTitle(), message: e.message });
				}
			}
		});

		panel.addEventListener("mousedown", (ev) => {
			const el = ev.target;
			if (!(el instanceof HTMLElement)) {
				return;
			}
			const suggestion = el.closest(".ing-search-results__btn");
			if (!suggestion) {
				return;
			}
			ev.preventDefault();
			const section = suggestion.closest(".recipe-ing-section");
			const id = parseInt(suggestion.getAttribute("data-item-id"), 10);
			addIngRow(panel, id);
			const search = section && section.querySelector(".ing-search");
			const results = section && section.querySelector(".ing-search-results");
			if (search) {
				search.value = "";
			}
			if (results) {
				results.hidden = true;
				results.innerHTML = "";
			}
		});

		dialog.addEventListener("close", async () => {
			brewerySel.disabled = false;
			if (dialog.returnValue !== "save") {
				return;
			}
			errEl.hidden = true;
			const fd = new FormData(form);
			const idVal = (fd.get("id") || "").toString();
			const rows = panel.querySelectorAll("#recipe-ingredients .ing-row");
			const ingredients = [];
			rows.forEach((row) => {
				const itemId = parseInt(row.querySelector('[name="item_id"]').value, 10);
				const qty = parseFloat(row.querySelector('[name="qty"]').value);
				const unit = row.querySelector('[name="unit"]').value;
				if (itemId && qty > 0) {
					ingredients.push({ inventory_item_id: itemId, qty, unit });
				}
			});
			const body = {
				brewery_id: parseInt(fd.get("brewery_id"), 10),
				name: fd.get("name"),
				ingredients,
			};
			try {
				let result;
				const isCreate = !idVal;
				if (idVal) {
					result = await api("/api/recipes/" + idVal, {
						method: "PUT",
						body: JSON.stringify(body),
					});
				} else {
					result = await api("/api/recipes", {
						method: "POST",
						body: JSON.stringify(body),
					});
				}
				form.reset();
				refresh();
				if (result && result.shortfalls && result.shortfalls.length) {
					await showShortfallNotice(result.shortfalls, result.order_id);
					refreshOrdersNavCount();
				}
				refreshBrewingNavCounts();
				if (isCreate) {
					await appInfo(pipelineGuide("recipe_created"));
				}
			} catch (e) {
				errEl.hidden = false;
				errEl.textContent = e.message;
				dialog.showModal();
			}
		});

		if (showHiddenEl) {
			showHiddenEl.addEventListener("change", () => {
				refresh();
			});
		}

		refresh();
	}

	function recipeIngCategories() {
		return [
			{ id: "malt", label: t("js.category.malt") },
			{ id: "hops", label: t("js.category.hops") },
			{ id: "yeast", label: t("js.category.yeast") },
			{ id: "misc", label: t("js.category.misc") },
			{ id: "equipment", label: t("js.category.equipment") },
		];
	}

	function unitOptions(selected) {
		const units = ["kg", "g", "L", "ml", "pcs", "pack"];
		const sel = selected || "kg";
		const list = units.includes(sel) ? units : units.concat([sel]);
		return list
			.map((u) => '<option value="' + esc(u) + '"' + (u === sel ? " selected" : "") + ">" + esc(u) + "</option>")
			.join("");
	}

	function renderIngSections(panel) {
		const wrap = panel.querySelector("#recipe-ingredients");
		if (!wrap) {
			return;
		}
		wrap.innerHTML = recipeIngCategories().map(
			(cat) =>
				'<div class="recipe-ing-section" data-category="' +
				esc(cat.id) +
				'">' +
				'<h3 class="recipe-ing-section__title">' +
				esc(cat.label) +
				"</h3>" +
				'<div class="ing-search-wrap">' +
				'<input type="search" class="ing-search" placeholder="' +
				esc(t("js.recipes.search", { category: cat.label.toLowerCase() })) +
				'" autocomplete="off">' +
				'<ul class="ing-search-results" hidden></ul>' +
				"</div>" +
				'<div class="ing-section-rows"></div>' +
				"</div>"
		).join("");

		wrap.querySelectorAll(".recipe-ing-section").forEach((section) => {
			const search = section.querySelector(".ing-search");
			const results = section.querySelector(".ing-search-results");
			const category = section.getAttribute("data-category");
			if (!search || !results) {
				return;
			}
			search.addEventListener("input", () => {
				const q = search.value.trim().toLowerCase();
				if (!q) {
					results.hidden = true;
					results.innerHTML = "";
					return;
				}
				const items = panel.querySelector("#recipe-form")._items || [];
				const matches = items
					.filter(
						(i) =>
							(i.category || "") === category &&
							String(i.name || "")
								.toLowerCase()
								.includes(q)
					)
					.slice(0, 12);
				if (!matches.length) {
					results.innerHTML = '<li class="ing-search-results__empty">' + esc(t("js.recipes.no_matches")) + "</li>";
					results.hidden = false;
					return;
				}
				results.innerHTML = matches
					.map(
						(i) =>
							'<li><button type="button" class="ing-search-results__btn" data-item-id="' +
							i.id +
							'">' +
							esc(i.name) +
							(i.producer ? " — " + esc(i.producer) : "") +
							' <span class="ing-search-results__stock">(' +
							esc(t("js.recipes.stock", { qty: i.qty, unit: i.unit || "" })) +
							")</span></button></li>"
					)
					.join("");
				results.hidden = false;
			});
			search.addEventListener("keydown", (ev) => {
				if (ev.key === "Escape") {
					results.hidden = true;
					results.innerHTML = "";
				}
			});
			search.addEventListener("blur", () => {
				setTimeout(() => {
					results.hidden = true;
				}, 150);
			});
		});
	}

	function addIngRow(panel, selectedId, qty, unit, categoryHint) {
		if (!selectedId) {
			return;
		}
		const form = panel.querySelector("#recipe-form");
		const items = (form && form._items) || [];
		const item = items.find((i) => i.id === selectedId);
		if (!item) {
			return;
		}
		const category = item.category || categoryHint || "";
		const section = panel.querySelector(
			'.recipe-ing-section[data-category="' + category + '"] .ing-section-rows'
		);
		if (!section) {
			return;
		}
		const existing = panel.querySelector(
			'#recipe-ingredients .ing-row [name="item_id"][value="' + selectedId + '"]'
		);
		if (existing) {
			return;
		}
		const rowUnit = unit || item.unit || "kg";
		const div = document.createElement("div");
		div.className = "ing-row";
		div.innerHTML =
			'<input type="hidden" name="item_id" value="' +
			item.id +
			'">' +
			'<span class="ing-row__name">' +
			esc(item.name) +
			(item.producer ? " <span class=\"ing-row__producer\">(" + esc(item.producer) + ")</span>" : "") +
			"</span>" +
			'<label>' +
			esc(t("common.qty")) +
			' <input name="qty" type="number" step="any" value="' +
			(qty != null ? qty : 1) +
			'" min="0"></label>' +
			"<label>" +
			esc(t("common.unit")) +
			' <select name="unit">' +
			unitOptions(rowUnit) +
			"</select></label>" +
			'<span class="ing-row__stock">' +
			esc(t("js.recipes.in_stock", { qty: item.qty, unit: item.unit || "" })) +
			"</span>" +
			'<button type="button" class="btn btn--small" data-action="recipe-remove-ing">' +
			esc(t("common.remove")) +
			"</button>";
		section.appendChild(div);
	}

	window.BrewhousePanels = window.BrewhousePanels || {};
	window.BrewhousePanels["recipes"] = loadRecipes;
})();
