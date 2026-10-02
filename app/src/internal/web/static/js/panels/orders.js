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

	async function loadOrders(panel) {
		const list = panel.querySelector("#orders-list");
		const lineDialog = panel.querySelector("#order-line-dialog");
		const lineForm = panel.querySelector("#order-line-form");
		const itemSelect = panel.querySelector("#order-line-item");
		const brewerySelect = panel.querySelector("#order-line-brewery");
		const newDialog = panel.querySelector("#order-new-dialog");
		const newForm = panel.querySelector("#order-new-form");
		const confirmDialog = panel.querySelector("#order-confirm-dialog");
		const confirmForm = panel.querySelector("#order-confirm-form");
		const confirmTitle = panel.querySelector("#order-confirm-title");
		const confirmMessage = panel.querySelector("#order-confirm-message");
		const externalDialog = panel.querySelector("#order-external-dialog");
		const externalForm = panel.querySelector("#order-external-form");
		const orderedQtyDialog = panel.querySelector("#order-ordered-qty-dialog");
		const orderedQtyForm = panel.querySelector("#order-ordered-qty-form");
		const costDialog = panel.querySelector("#order-cost-dialog");
		const costForm = panel.querySelector("#order-cost-form");
		const vatDialog = panel.querySelector("#order-vat-dialog");
		const vatForm = panel.querySelector("#order-vat-form");
		const linksDialog = panel.querySelector("#order-links-dialog");
		const linksList = panel.querySelector("#order-links-list");
		const linksTitle = panel.querySelector("#order-links-title");
		const linksOrderIdEl = panel.querySelector("#order-links-order-id");
		const canManage = canRoles(["superuser", "admin"]);
		const isAdmin = canRoles(["admin"]);

		function formatOrderDate(iso) {
			if (!iso) {
				return "";
			}
			const d = new Date(iso);
			if (Number.isNaN(d.getTime())) {
				return String(iso);
			}
			return d.toLocaleString();
		}

		function groupLinesByBrewery(lines) {
			const groups = [];
			const index = {};
			(lines || []).forEach((l) => {
				const key = l.brewery_id != null ? String(l.brewery_id) : "unassigned";
				const label = l.brewery_id != null ? l.brewery_name || t("js.inventory.brewery_n", { id: l.brewery_id }) : t("js.inventory.unassigned");
				if (index[key] == null) {
					index[key] = groups.length;
					groups.push({ key, label, lines: [] });
				}
				groups[index[key]].lines.push(l);
			});
			groups.sort((a, b) => {
				if (a.key === "unassigned") return 1;
				if (b.key === "unassigned") return -1;
				return a.label.localeCompare(b.label);
			});
			return groups;
		}

		function renderLines(order, lines) {
			if (!lines || !lines.length) {
				return "<p class=\"panel__empty\">" + esc(t("js.orders.no_lines_short")) + "</p>";
			}
			const canEditLines =
				canManage &&
				(order.status === "planning" ||
					order.status === "ordered" ||
					order.status === "paused");
			return groupLinesByBrewery(lines)
				.map((g) => {
					const items = g.lines
						.map((l) => {
							const unit = l.unit ? " " + esc(l.unit) : "";
							const orderQty =
								l.ordered_qty != null && l.ordered_qty !== undefined
									? l.ordered_qty
									: l.qty;
							const costPrice = l.cost_price != null ? l.cost_price : 0;
							const lineCost = l.line_cost != null ? l.line_cost : costPrice * orderQty;
							const vatRate = l.vat_rate != null ? l.vat_rate : 0;
							const vatAmount = l.vat_amount != null ? l.vat_amount : 0;
							let text =
								esc(l.item_name) +
								" (" +
								esc(categoryText(l.category)) +
								") — " +
								t("js.orders.need") +
								" " +
								l.qty +
								unit +
								" · " +
								t("js.orders.order_qty") +
								" " +
								orderQty +
								unit +
								" · " +
								costPrice +
								" " +
								currencyCode() +
								"/unit · line " +
								lineCost +
								" " +
								currencyCode() +
								" · " +
								t("js.orders.vat") +
								" " +
								vatRate +
								"% = " +
								vatAmount +
								" " +
								currencyCode();
							if (canEditLines) {
								text +=
									' <button type="button" class="btn btn--small" data-action="order-line-ordered-qty" data-order-id="' +
									order.id +
									'" data-line-id="' +
									l.id +
									'" data-need="' +
									l.qty +
									'" data-ordered="' +
									orderQty +
									'">Set ordered qty</button>';
								text +=
									' <button type="button" class="btn btn--small" data-action="order-line-cost" data-order-id="' +
									order.id +
									'" data-line-id="' +
									l.id +
									'" data-cost="' +
									costPrice +
									'">Set cost</button>';
								text +=
									' <button type="button" class="btn btn--small" data-action="order-line-vat" data-order-id="' +
									order.id +
									'" data-line-id="' +
									l.id +
									'" data-vat="' +
									vatRate +
									'">' +
									esc(t("js.orders.set_vat")) +
									"</button>";
							}
							return "<li>" + text + "</li>";
						})
						.join("");
					return (
						'<div class="order-brewery-group"><h3 class="order-brewery-group__title">' +
						esc(g.label) +
						"</h3><ul>" +
						items +
						"</ul></div>"
					);
				})
				.join("");
		}

		function renderLinksModal(order) {
			if (linksOrderIdEl) {
				linksOrderIdEl.value = String(order.id);
			}
			if (linksTitle) {
				linksTitle.textContent = t("js.orders.product_links", { id: order.id });
			}
			const lines = order.lines || [];
			if (!lines.length) {
				linksList.innerHTML = "<p class=\"panel__empty\">" + esc(t("js.orders.no_lines")) + "</p>";
				return;
			}
			linksList.innerHTML = lines
				.map((l) => {
					const unit = l.unit ? " " + esc(l.unit) : "";
					const orderQty =
						l.ordered_qty != null && l.ordered_qty !== undefined ? l.ordered_qty : l.qty;
					const meta =
						esc(l.item_name) +
						" (" +
						esc(categoryText(l.category)) +
						") — " +
						t("js.orders.need") +
						" " +
						l.qty +
						unit +
						" · " +
						t("js.orders.order_qty") +
						" " +
						orderQty +
						unit;
					if (!l.inventory_item_id) {
						return (
							'<div class="order-link-row">' +
							'<p class="order-link-row__meta">' +
							meta +
							"</p>" +
							'<p class="panel__empty">' + esc(t("js.orders.no_catalog_item")) + "</p>" +
							"</div>"
						);
					}
					const linkVal = l.link || "";
					let actions =
						'<button type="button" class="btn btn--small" data-action="order-link-open" data-line-id="' +
						l.id +
						'">' + esc(t("js.orders.open")) + "</button>";
					if (canManage) {
						actions +=
							' <button type="button" class="btn btn--small btn--primary" data-action="order-link-save" data-line-id="' +
							l.id +
							'">' + esc(t("common.save")) + "</button>";
					}
					return (
						'<div class="order-link-row" data-line-id="' +
						l.id +
						'">' +
						'<p class="order-link-row__meta">' +
						meta +
						"</p>" +
						'<label class="order-link-row__field">' + esc(t("js.orders.product_url")) +
						'<input type="url" name="link" value="' +
						esc(linkVal) +
						'" placeholder="https://…" data-line-id="' +
						l.id +
						'">' +
						"</label>" +
						'<div class="order-link-row__actions">' +
						actions +
						"</div>" +
						"</div>"
					);
				})
				.join("");
		}

		async function openLinksModal(orderId) {
			const order = await api("/api/inventory/orders/" + orderId);
			renderLinksModal(order);
			linksDialog.showModal();
		}

		async function loadItemOptions() {
			const items = (await api("/api/inventory")) || [];
			itemSelect.innerHTML = items
				.map(
					(i) =>
						'<option value="' +
						i.id +
						'">' +
						esc(i.category) +
						" — " +
						esc(i.name) +
						(i.producer ? " (" + esc(i.producer) + ")" : "") +
						"</option>"
				)
				.join("");
		}

		async function loadBreweryOptions() {
			const breweries = (await api("/api/breweries")) || [];
			brewerySelect.innerHTML =
				'<option value="">' + esc(t("js.inventory.unassigned")) + "</option>" +
				breweries
					.map((b) => '<option value="' + b.id + '">' + esc(b.name) + "</option>")
					.join("");
		}

		async function refresh() {
			list.textContent = t("js.loading");
			try {
				const orders = await api("/api/inventory/orders");
				if (!orders || !orders.length) {
					list.innerHTML = "<p class=\"panel__empty\">" + esc(t("js.orders.empty")) + "</p>";
					refreshOrdersNavCount();
					return;
				}
				list.innerHTML = orders
					.map((o) => {
						let actions =
							'<button type="button" class="btn btn--small" data-action="order-export" data-id="' +
							o.id +
							'">' + esc(t("common.export_csv")) + "</button> " +
							'<button type="button" class="btn btn--small" data-action="order-product-links" data-id="' +
							o.id +
							'">' + esc(t("orders.product_links")) + "</button>";
						if (canManage && o.status !== "completed") {
							actions +=
								' <button type="button" class="btn btn--small" data-action="order-edit-external" data-id="' +
								o.id +
								'" data-external="' +
								esc(o.external_order_id || "") +
								'">' + esc(t("js.orders.edit_external_id")) + "</button>";
						}
						if (canManage && o.status === "planning") {
							actions +=
								' <button type="button" class="btn btn--small" data-action="order-add-line" data-id="' +
								o.id +
								'">' + esc(t("orders.add_line")) + "</button> " +
								'<button type="button" class="btn btn--small btn--primary" data-action="order-status" data-id="' +
								o.id +
								'" data-status="ordered">' + esc(t("js.orders.mark_ordered_title")) + "</button>";
						}
						if (isAdmin && o.status === "planning") {
							actions +=
								' <button type="button" class="btn btn--small" data-action="order-status" data-id="' +
								o.id +
								'" data-status="paused">' + esc(t("js.orders.pause")) + "</button>";
						}
						if (isAdmin && o.status === "paused") {
							actions +=
								' <button type="button" class="btn btn--small btn--primary" data-action="order-status" data-id="' +
								o.id +
								'" data-status="planning">' + esc(t("js.orders.resume")) + "</button>";
						}
						if (canManage && o.status === "ordered") {
							actions +=
								' <button type="button" class="btn btn--small btn--primary" data-action="order-status" data-id="' +
								o.id +
								'" data-status="completed">' + esc(t("js.orders.mark_completed")) + "</button>";
						}
						if (isAdmin && o.status !== "completed") {
							actions +=
								' <button type="button" class="btn btn--small" data-action="order-delete" data-id="' +
								o.id +
								'">' + esc(t("common.delete")) + "</button>";
						}
						const ext =
							o.external_order_id && String(o.external_order_id).trim()
								? '<p class="order-external-id">' + esc(t("js.orders.external_id_label", { id: o.external_order_id })) + "</p>"
								: '<p class="order-external-id order-external-id--empty">' + esc(t("js.orders.no_external_id")) + "</p>";
						let dates =
							'<p class="order-dates">' +
							esc(t("js.orders.created")) +
							": " +
							esc(formatOrderDate(o.created_at)) +
							" · " +
							esc(t("js.orders.updated")) +
							": " +
							esc(formatOrderDate(o.updated_at || o.created_at));
						if (o.ordered_at) {
							dates += " · " + t("js.orders.ordered") + ": " + esc(formatOrderDate(o.ordered_at));
						}
						dates += "</p>";
						const total =
							'<p class="order-total"><strong>' +
							t("js.orders.total") +
							": " +
							(o.total != null ? o.total : 0) +
							" " +
							currencyCode() +
							"</strong> · " +
							t("js.orders.vat_total") +
							": " +
							(o.vat_total != null ? o.vat_total : 0) +
							" " +
							currencyCode() +
							"</p>";
						return (
							'<div class="panel__card" data-order-id="' +
							o.id +
							'"><div class="panel__card-head"><strong>#' +
							o.id +
							'</strong> ' +
							statusPill(o.status, statusText(o.status)) +
							"</div>" +
							dates +
							ext +
							(o.notes ? "<p>" + esc(o.notes) + "</p>" : "") +
							renderLines(o, o.lines) +
							total +
							'<div class="panel__card-actions">' +
							actions +
							"</div>" +
							"</div>"
						);
					})
					.join("");
				refreshOrdersNavCount();
			} catch (e) {
				list.textContent = e.message;
			}
		}

		panel.addEventListener("click", async (ev) => {
			const el = ev.target;
			if (!(el instanceof HTMLElement)) {
				return;
			}
			if (el.getAttribute("data-action") === "orders-refresh") {
				refresh();
			}
			if (el.getAttribute("data-action") === "orders-new") {
				if (!canManage) {
					return;
				}
				newForm.reset();
				newDialog.showModal();
			}
			if (el.getAttribute("data-action") === "order-export") {
				const id = el.getAttribute("data-id");
				try {
					await downloadCSVAuth("/api/inventory/orders/" + id + "/export", "order-" + id + ".csv");
				} catch (e) {
					await appInfo({ title: noticeTitle(), message: e.message });
				}
			}
			if (el.getAttribute("data-action") === "order-product-links") {
				try {
					await openLinksModal(el.getAttribute("data-id"));
				} catch (e) {
					await appInfo({ title: noticeTitle(), message: e.message });
				}
			}
			if (el.getAttribute("data-action") === "order-link-open") {
				const row = el.closest(".order-link-row");
				const input = row && row.querySelector('input[name="link"]');
				const url = input ? String(input.value || "").trim() : "";
				if (!url) {
					await appInfo({ title: noticeTitle(), message: t("js.orders.no_url") });
					return;
				}
				window.open(url, "_blank", "noopener,noreferrer");
			}
			if (el.getAttribute("data-action") === "order-link-save") {
				if (!canManage) {
					return;
				}
				const lineId = el.getAttribute("data-line-id");
				const orderId = linksOrderIdEl && linksOrderIdEl.value;
				const row = el.closest(".order-link-row");
				const input = row && row.querySelector('input[name="link"]');
				if (!orderId || !lineId || !input) {
					return;
				}
				try {
					const updated = await api(
						"/api/inventory/orders/" + orderId + "/lines/" + lineId,
						{
							method: "PATCH",
							body: JSON.stringify({ link: String(input.value || "").trim() }),
						}
					);
					renderLinksModal(updated);
					refresh();
				} catch (e) {
					await appInfo({ title: noticeTitle(), message: e.message });
				}
			}
			if (el.getAttribute("data-action") === "order-add-line") {
				if (!canManage) {
					return;
				}
				try {
					await loadItemOptions();
					await loadBreweryOptions();
					lineForm.elements.namedItem("order_id").value = el.getAttribute("data-id");
					lineDialog.showModal();
				} catch (e) {
					await appInfo({ title: noticeTitle(), message: e.message });
				}
			}
			if (el.getAttribute("data-action") === "order-edit-external") {
				if (!canManage) {
					return;
				}
				externalForm.elements.namedItem("order_id").value = el.getAttribute("data-id");
				externalForm.elements.namedItem("external_order_id").value =
					el.getAttribute("data-external") || "";
				externalDialog.showModal();
			}
			if (el.getAttribute("data-action") === "order-line-ordered-qty") {
				if (!canManage) {
					return;
				}
				const defaultQty = el.getAttribute("data-ordered") || el.getAttribute("data-need") || "1";
				orderedQtyForm.elements.namedItem("order_id").value = el.getAttribute("data-order-id");
				orderedQtyForm.elements.namedItem("line_id").value = el.getAttribute("data-line-id");
				orderedQtyForm.elements.namedItem("ordered_qty").value = defaultQty;
				orderedQtyDialog.showModal();
			}
			if (el.getAttribute("data-action") === "order-line-cost") {
				if (!canManage) {
					return;
				}
				costForm.elements.namedItem("order_id").value = el.getAttribute("data-order-id");
				costForm.elements.namedItem("line_id").value = el.getAttribute("data-line-id");
				costForm.elements.namedItem("cost_price").value = el.getAttribute("data-cost") || "0";
				costDialog.showModal();
			}
			if (el.getAttribute("data-action") === "order-line-vat") {
				if (!canManage) {
					return;
				}
				vatForm.elements.namedItem("order_id").value = el.getAttribute("data-order-id");
				vatForm.elements.namedItem("line_id").value = el.getAttribute("data-line-id");
				vatForm.elements.namedItem("vat_rate").value = el.getAttribute("data-vat") || "0";
				vatDialog.showModal();
			}
			if (el.getAttribute("data-action") === "order-status") {
				const status = el.getAttribute("data-status");
				const card = el.closest("[data-order-id]");
				const currentStatus =
					card && card.querySelector(".status-pill")
						? card.querySelector(".status-pill").textContent.trim()
						: "";
				const isPause = status === "paused";
				const isResume = status === "planning" && currentStatus === "paused";
				if ((isPause || isResume) && !isAdmin) {
					return;
				}
				if (!isPause && !isResume && !canManage) {
					return;
				}
				confirmForm.elements.namedItem("action").value = "status";
				confirmForm.elements.namedItem("order_id").value = el.getAttribute("data-id");
				confirmForm.elements.namedItem("status").value = status;
				if (isPause) {
					confirmTitle.textContent = t("js.orders.pause_title");
					confirmMessage.textContent = t("js.orders.pause_message");
				} else if (isResume) {
					confirmTitle.textContent = t("js.orders.resume_title");
					confirmMessage.textContent = t("js.orders.resume_message");
				} else if (status === "completed") {
					confirmTitle.textContent = t("js.orders.complete_title");
					confirmMessage.textContent = t("js.orders.complete_message");
				} else {
					confirmTitle.textContent = t("js.orders.mark_ordered_title");
					confirmMessage.textContent = t("js.orders.mark_ordered_message");
				}
				confirmDialog.showModal();
			}
			if (el.getAttribute("data-action") === "order-delete") {
				if (!isAdmin) {
					return;
				}
				confirmForm.elements.namedItem("action").value = "delete";
				confirmForm.elements.namedItem("order_id").value = el.getAttribute("data-id");
				confirmForm.elements.namedItem("status").value = "";
				confirmTitle.textContent = t("js.orders.delete_title");
				confirmMessage.textContent = t("js.orders.delete_message");
				confirmDialog.showModal();
			}
		});

		newDialog.addEventListener("close", async () => {
			if (newDialog.returnValue !== "save") {
				return;
			}
			const fd = new FormData(newForm);
			try {
				const order = await api("/api/inventory/orders", {
					method: "POST",
					body: JSON.stringify({
						notes: String(fd.get("notes") || "").trim(),
						external_order_id: String(fd.get("external_order_id") || "").trim(),
						lines: [],
					}),
				});
				await appInfo({ title: noticeTitle(), message: t("js.orders.created_order", { id: order.id }) });
				refresh();
			} catch (e) {
				await appInfo({ title: noticeTitle(), message: e.message });
			}
		});

		lineDialog.addEventListener("close", async () => {
			if (lineDialog.returnValue !== "save") {
				return;
			}
			const fd = new FormData(lineForm);
			const orderId = fd.get("order_id");
			const breweryRaw = String(fd.get("brewery_id") || "").trim();
			const body = {
				inventory_item_id: parseInt(fd.get("inventory_item_id"), 10),
				qty: parseFloat(fd.get("qty")),
			};
			if (breweryRaw) {
				body.brewery_id = parseInt(breweryRaw, 10);
			}
			try {
				await api("/api/inventory/orders/" + orderId + "/lines", {
					method: "POST",
					body: JSON.stringify(body),
				});
				refresh();
			} catch (e) {
				await appInfo({ title: noticeTitle(), message: e.message });
			}
		});

		confirmDialog.addEventListener("close", async () => {
			if (confirmDialog.returnValue !== "confirm") {
				return;
			}
			const fd = new FormData(confirmForm);
			const action = String(fd.get("action") || "");
			const orderId = fd.get("order_id");
			try {
				if (action === "delete") {
					await api("/api/inventory/orders/" + orderId, { method: "DELETE" });
				} else if (action === "status") {
					await api("/api/inventory/orders/" + orderId, {
						method: "PATCH",
						body: JSON.stringify({ status: String(fd.get("status") || "") }),
					});
				}
				refresh();
			} catch (e) {
				await appInfo({ title: noticeTitle(), message: e.message });
			}
		});

		externalDialog.addEventListener("close", async () => {
			if (externalDialog.returnValue !== "save") {
				return;
			}
			const fd = new FormData(externalForm);
			try {
				await api("/api/inventory/orders/" + fd.get("order_id"), {
					method: "PATCH",
					body: JSON.stringify({
						external_order_id: String(fd.get("external_order_id") || "").trim(),
					}),
				});
				refresh();
			} catch (e) {
				await appInfo({ title: noticeTitle(), message: e.message });
			}
		});

		orderedQtyDialog.addEventListener("close", async () => {
			if (orderedQtyDialog.returnValue !== "save") {
				return;
			}
			const fd = new FormData(orderedQtyForm);
			const orderedQty = parseFloat(fd.get("ordered_qty"));
			if (Number.isNaN(orderedQty) || orderedQty < 0) {
				await appInfo({ title: noticeTitle(), message: t("js.orders.ordered_qty_invalid") });
				return;
			}
			try {
				await api(
					"/api/inventory/orders/" + fd.get("order_id") + "/lines/" + fd.get("line_id"),
					{
						method: "PATCH",
						body: JSON.stringify({ ordered_qty: orderedQty }),
					}
				);
				refresh();
			} catch (e) {
				await appInfo({ title: noticeTitle(), message: e.message });
			}
		});

		costDialog.addEventListener("close", async () => {
			if (costDialog.returnValue !== "save") {
				return;
			}
			const fd = new FormData(costForm);
			const costPrice = parseFloat(fd.get("cost_price"));
			if (Number.isNaN(costPrice) || costPrice < 0) {
				await appInfo({ title: noticeTitle(), message: t("js.orders.cost_invalid") });
				return;
			}
			try {
				await api(
					"/api/inventory/orders/" + fd.get("order_id") + "/lines/" + fd.get("line_id"),
					{
						method: "PATCH",
						body: JSON.stringify({ cost_price: costPrice }),
					}
				);
				refresh();
			} catch (e) {
				await appInfo({ title: noticeTitle(), message: e.message });
			}
		});

		vatDialog.addEventListener("close", async () => {
			if (vatDialog.returnValue !== "save") {
				return;
			}
			const fd = new FormData(vatForm);
			const vatRate = parseFloat(fd.get("vat_rate"));
			if (Number.isNaN(vatRate) || vatRate < 0 || vatRate > 100) {
				await appInfo({ title: noticeTitle(), message: t("js.orders.vat_invalid") });
				return;
			}
			try {
				await api(
					"/api/inventory/orders/" + fd.get("order_id") + "/lines/" + fd.get("line_id"),
					{
						method: "PATCH",
						body: JSON.stringify({ vat_rate: vatRate }),
					}
				);
				refresh();
			} catch (e) {
				await appInfo({ title: noticeTitle(), message: e.message });
			}
		});

		applyRequireRoles(panel);
		refresh();
	}

	window.BrewhousePanels = window.BrewhousePanels || {};
	window.BrewhousePanels["orders"] = loadOrders;
})();
