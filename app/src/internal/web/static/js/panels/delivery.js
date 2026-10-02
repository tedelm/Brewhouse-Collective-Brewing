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

	async function loadDelivery(panel) {
		const list = panel.querySelector("#delivery-list");
		const form = panel.querySelector("#delivery-form");
		const errEl = panel.querySelector("#delivery-error");
		const recipeSel = panel.querySelector("#delivery-recipe");
		const multSel = panel.querySelector("#delivery-multiplier");
		const beerNetInput = panel.querySelector("#delivery-beer-net");
		const fgInput = form.querySelector('[name="fg"]');
		const volInput = form.querySelector('[name="delivery_volume"]');
		const previewABV = panel.querySelector("#delivery-preview-abv");
		const previewCost = panel.querySelector("#delivery-preview-cost");
		const previewTax = panel.querySelector("#delivery-preview-tax");
		const previewNet = panel.querySelector("#delivery-preview-net");
		const previewProfit = panel.querySelector("#delivery-preview-profit");
		const previewPerL = panel.querySelector("#delivery-preview-per-l");
		let byID = {};
		let taxPreviewTimer = null;
		let previewOG = null;
		let previewCostTotal = 0;

		function fillFG(recipe) {
			fgInput.value = fmtSG(recipe && recipe.fg, "1.010");
		}

		function clearPreview() {
			previewABV.textContent = "—";
			previewCost.textContent = "—";
			previewTax.textContent = "—";
			previewNet.textContent = "—";
			previewProfit.textContent = "—";
			previewPerL.textContent = "—";
		}

		function selectedMultiplier() {
			const opt = multSel.selectedOptions[0];
			if (!opt) {
				return NaN;
			}
			const raw = opt.getAttribute("data-multiplier");
			const n = parseFloat(raw);
			return Number.isNaN(n) ? NaN : n;
		}

		function updatePreview() {
			const og = previewOG;
			const fg = parseFloat(fgInput.value);
			const vol = parseFloat(volInput.value);
			const beerNet = parseFloat(beerNetInput.value);
			const mult = selectedMultiplier();
			if (
				og == null ||
				Number.isNaN(og) ||
				Number.isNaN(fg) ||
				Number.isNaN(vol) ||
				vol <= 0 ||
				Number.isNaN(beerNet) ||
				Number.isNaN(mult)
			) {
				clearPreview();
				return;
			}
			const abv = (og - fg) * 131.25;
			const cost = previewCostTotal;
			const perL = beerNet * mult;
			const net = perL * vol;
			previewABV.textContent = abv.toFixed(1) + " %";
			previewCost.textContent = fmtMoney(cost);
			previewNet.textContent = fmtMoney(net);
			previewProfit.textContent = fmtMoney(net - cost);
			previewPerL.textContent = fmtMoney(perL);
			previewTax.textContent = "…";
			if (taxPreviewTimer) {
				clearTimeout(taxPreviewTimer);
			}
			taxPreviewTimer = setTimeout(async () => {
				try {
					const preview = await api(
						"/api/settings/tax-preview?abv=" +
							encodeURIComponent(abv) +
							"&og=" +
							encodeURIComponent(og) +
							"&volume=" +
							encodeURIComponent(vol)
					);
					previewTax.textContent = fmtMoney(preview.total);
				} catch (e) {
					previewTax.textContent = "—";
				}
			}, 150);
		}

		async function loadRecipePreview(id) {
			previewOG = null;
			previewCostTotal = 0;
			if (!id) {
				clearPreview();
				return;
			}
			try {
				const recipe = await api("/api/recipes/" + id);
				previewOG = recipe.og != null ? Number(recipe.og) : null;
				const ings = recipe.ingredients || [];
				previewCostTotal = ings.reduce(
					(sum, ing) => sum + Number(ing.qty || 0) * Number(ing.cost_price || 0),
					0
				);
				if (recipe.delivery_volume != null && recipe.delivery_volume > 0) {
					volInput.value = recipe.delivery_volume;
				}
				updatePreview();
			} catch (e) {
				clearPreview();
			}
		}

		async function loadPricingControls() {
			const [mults, beer] = await Promise.all([
				api("/api/settings/multipliers?active=1"),
				api("/api/settings/beer-price"),
			]);
			const listMults = mults || [];
			multSel.innerHTML = listMults
				.map((m) => {
					const selected = m.name === "default" ? " selected" : "";
					return (
						'<option value="' +
						m.id +
						'" data-multiplier="' +
						m.multiplier +
						'"' +
						selected +
						">" +
						esc(m.name) +
						" (×" +
						m.multiplier +
						")</option>"
					);
				})
				.join("");
			if (listMults.length && !multSel.value) {
				multSel.value = String(listMults[0].id);
			}
			beerNetInput.value = beer.min_net_sek_per_liter ?? 0;
		}

		async function refresh() {
			try {
				const recipes = await api("/api/recipes");
				const selectable = (recipes || []).filter(
					(r) => r.status === "hygiene_done" || r.status === "ready_for_delivery"
				);
				byID = {};
				selectable.forEach((r) => {
					byID[String(r.id)] = r;
				});
				const prev = recipeSel.value;
				fillRecipeSelect(recipeSel, selectable, t("js.delivery.no_ready"));
				if (prev && byID[prev]) {
					recipeSel.value = prev;
				}
				fillFG(byID[recipeSel.value]);
				await loadRecipePreview(recipeSel.value);
				const relevant = (recipes || []).filter((r) =>
					["hygiene_done", "ready_for_delivery", "delivered"].includes(r.status)
				);
				if (!relevant.length) {
					list.innerHTML = "<p class=\"panel__empty\">" + esc(t("js.delivery.empty")) + "</p>";
					refreshBrewingNavCounts();
					return;
				}
				list.innerHTML = table(
					[
						t("js.delivery.col.id"),
						t("js.delivery.col.name"),
						t("js.delivery.col.brewery"),
						t("js.delivery.col.status"),
						t("js.delivery.col.brew_date"),
						t("js.delivery.col.delivery_date"),
						t("js.delivery.col.abv"),
						t("js.delivery.col.cost"),
						t("js.delivery.col.tax"),
						t("js.delivery.col.net"),
						t("js.delivery.col.profit"),
						"",
					],
					relevant
						.map((r) => {
							let btn = "";
							if (r.status === "ready_for_delivery") {
								btn =
									'<button type="button" class="btn btn--small" data-deliver="' +
									r.id +
									'">' + esc(t("js.recipes.deliver")) + "</button>";
							} else if (r.status === "delivered") {
								btn =
									'<button type="button" class="btn btn--small" data-revoke-delivery="' +
									r.id +
									'">' + esc(t("js.delivery.revoke")) + "</button>";
							}
							const hasCostNet = r.cost != null && r.net != null;
							const profit = hasCostNet
								? fmtMoney((Number(r.net) || 0) - (Number(r.cost) || 0))
								: "—";
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
								esc(r.booked_date || "") +
								"</td><td>" +
								esc(datePart(r.delivered_at)) +
								"</td><td>" +
								esc(recipeABV(r)) +
								"</td><td>" +
								fmtMoney(r.cost) +
								"</td><td>" +
								fmtMoney(r.tax) +
								"</td><td>" +
								fmtMoney(r.net) +
								"</td><td>" +
								profit +
								"</td><td>" +
								btn +
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
		panel.querySelector('[data-action="delivery-refresh"]').addEventListener("click", refresh);
		recipeSel.addEventListener("change", async () => {
			fillFG(byID[recipeSel.value]);
			await loadRecipePreview(recipeSel.value);
		});
		["input", "change"].forEach((evt) => {
			fgInput.addEventListener(evt, updatePreview);
			volInput.addEventListener(evt, updatePreview);
			beerNetInput.addEventListener(evt, updatePreview);
			multSel.addEventListener(evt, updatePreview);
		});
		panel.addEventListener("click", async (ev) => {
			const el = ev.target;
			if (!(el instanceof HTMLElement)) {
				return;
			}
			if (el.hasAttribute("data-deliver")) {
				try {
					await api("/api/recipes/" + el.getAttribute("data-deliver") + "/deliver", {
						method: "POST",
					});
					refresh();
					await appInfo(pipelineGuide("delivered"));
				} catch (e) {
					await appInfo({ title: noticeTitle(), message: e.message });
				}
				return;
			}
			if (el.hasAttribute("data-revoke-delivery")) {
				const id = el.getAttribute("data-revoke-delivery");
				const ok = await appConfirm({
					title: t("js.delivery.revoke_title"),
					message: t("js.delivery.revoke_message", { id: id }),
				});
				if (!ok) {
					return;
				}
				try {
					await api("/api/recipes/" + id + "/delivery/revoke", { method: "POST" });
					refresh();
				} catch (e) {
					await appInfo({ title: noticeTitle(), message: e.message });
				}
			}
		});
		form.addEventListener("submit", async (ev) => {
			ev.preventDefault();
			errEl.hidden = true;
			const fd = new FormData(form);
			try {
				await api("/api/recipes/" + fd.get("recipe_id") + "/delivery", {
					method: "POST",
					body: JSON.stringify({
						fg: parseFloat(fd.get("fg")),
						delivery_volume: parseFloat(fd.get("delivery_volume")),
						beer_net_sek_per_liter: parseFloat(fd.get("beer_net_sek_per_liter")),
						multiplier_id: parseInt(fd.get("multiplier_id"), 10),
					}),
				});
				refresh();
				await appInfo(pipelineGuide("ready_for_delivery"));
			} catch (e) {
				errEl.hidden = false;
				errEl.textContent = e.message;
			}
		});
		try {
			await loadPricingControls();
		} catch (e) {
			errEl.hidden = false;
			errEl.textContent = e.message;
		}
		refresh();
	}

	window.BrewhousePanels = window.BrewhousePanels || {};
	window.BrewhousePanels["delivery"] = loadDelivery;
})();
