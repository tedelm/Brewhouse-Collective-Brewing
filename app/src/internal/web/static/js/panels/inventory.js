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

	async function loadInventory(panel) {
		const category = panel.getAttribute("data-category");
		const isMalt = category === "malt";
		const isYeast = category === "yeast";
		const defaultUnit = category === "hops" ? "g" : category === "yeast" ? "pack" : category === "equipment" ? "pcs" : "kg";
		const list = panel.querySelector("#inventory-list");
		const dialog = panel.querySelector("#inventory-dialog");
		const form = panel.querySelector("#inventory-form");
		const titleEl = panel.querySelector("#inventory-dialog-title");
		const canEdit = canRoles(["superuser", "admin"]);
		const canDelete = canRoles(["admin"]);
		const logOffsets = new Map();
		const logPageSize = 5;
		const colCount = 10;
		const supplierSelect = form.elements.namedItem("supplier_id");
		const effectiveHint = panel.querySelector("#inventory-effective-cost");
		let suppliersById = {};

		panel.querySelectorAll(".inventory-field--malt").forEach((el) => {
			el.classList.toggle("is-role-hidden", !isMalt);
		});
		panel.querySelectorAll(".inventory-field--yeast").forEach((el) => {
			el.classList.toggle("is-role-hidden", !isYeast);
		});

		async function loadSuppliers() {
			suppliersById = {};
			if (!(supplierSelect instanceof HTMLSelectElement)) {
				return;
			}
			try {
				const suppliers = await api("/api/settings/suppliers?active=1");
				const current = supplierSelect.value;
				supplierSelect.innerHTML = '<option value="">—</option>';
				(suppliers || []).forEach((s) => {
					suppliersById[String(s.id)] = s;
					const opt = document.createElement("option");
					opt.value = String(s.id);
					opt.textContent = s.name + (s.adjust_percent ? " (" + s.adjust_percent + "%)" : "");
					supplierSelect.appendChild(opt);
				});
				if (current) {
					supplierSelect.value = current;
				}
			} catch (e) {
				/* keep empty select */
			}
		}

		function updateEffectiveHint() {
			if (!(effectiveHint instanceof HTMLElement)) {
				return;
			}
			const base = parseFloat(form.elements.namedItem("cost_price").value) || 0;
			const sid = supplierSelect instanceof HTMLSelectElement ? supplierSelect.value : "";
			const adj = sid && suppliersById[sid] ? Number(suppliersById[sid].adjust_percent) || 0 : 0;
			const effective = base * (1 + adj / 100);
			if (!sid || adj === 0) {
				effectiveHint.hidden = true;
				return;
			}
			effectiveHint.hidden = false;
			effectiveHint.textContent = t("inventory.effective_cost", { cost: String(effective), currency: currencyCode() });
		}

		function fillForm(item) {
			form.reset();
			form.elements.namedItem("id").value = item && item.id ? String(item.id) : "";
			form.elements.namedItem("name").value = (item && item.name) || "";
			form.elements.namedItem("item_type").value = (item && item.item_type) || "";
			form.elements.namedItem("producer").value = (item && item.producer) || "";
			if (supplierSelect instanceof HTMLSelectElement) {
				const sid = item && item.supplier_id != null ? String(item.supplier_id) : "";
				if (sid && !suppliersById[sid] && item.supplier_name) {
					const opt = document.createElement("option");
					opt.value = sid;
					opt.textContent = item.supplier_name;
					supplierSelect.appendChild(opt);
					suppliersById[sid] = {
						id: item.supplier_id,
						name: item.supplier_name,
						adjust_percent: item.adjust_percent || 0,
					};
				}
				supplierSelect.value = sid;
			}
			form.elements.namedItem("min_ebc").value = item && item.min_ebc != null ? item.min_ebc : 0;
			form.elements.namedItem("max_ebc").value = item && item.max_ebc != null ? item.max_ebc : 0;
			form.elements.namedItem("pitch_min_g_hl").value =
				item && item.pitch_min_g_hl != null ? item.pitch_min_g_hl : 0;
			form.elements.namedItem("pitch_max_g_hl").value =
				item && item.pitch_max_g_hl != null ? item.pitch_max_g_hl : 0;
			form.elements.namedItem("pack_size_g").value =
				item && item.pack_size_g != null ? item.pack_size_g : 0;
			form.elements.namedItem("temp_min_c").value =
				item && item.temp_min_c != null ? item.temp_min_c : 0;
			form.elements.namedItem("temp_max_c").value =
				item && item.temp_max_c != null ? item.temp_max_c : 0;
			form.elements.namedItem("link").value = (item && item.link) || "";
			form.elements.namedItem("unit").value = (item && item.unit) || defaultUnit;
			form.elements.namedItem("qty").value = item && item.qty != null ? item.qty : 0;
			form.elements.namedItem("cost_price").value = item && item.cost_price != null ? item.cost_price : 0;
			if (titleEl) {
				titleEl.textContent = item && item.id ? t("js.inventory.edit_item") : t("js.inventory.item");
			}
			updateEffectiveHint();
		}

		function bodyFromForm() {
			const fd = new FormData(form);
			const sidRaw = fd.get("supplier_id");
			const sid = sidRaw ? parseInt(String(sidRaw), 10) : 0;
			return {
				category,
				name: fd.get("name"),
				unit: fd.get("unit"),
				qty: parseFloat(fd.get("qty")) || 0,
				cost_price: parseFloat(fd.get("cost_price")) || 0,
				producer: fd.get("producer") || "",
				item_type: fd.get("item_type") || "",
				min_ebc: parseFloat(fd.get("min_ebc")) || 0,
				max_ebc: parseFloat(fd.get("max_ebc")) || 0,
				pitch_min_g_hl: parseFloat(fd.get("pitch_min_g_hl")) || 0,
				pitch_max_g_hl: parseFloat(fd.get("pitch_max_g_hl")) || 0,
				pack_size_g: parseFloat(fd.get("pack_size_g")) || 0,
				temp_min_c: parseFloat(fd.get("temp_min_c")) || 0,
				temp_max_c: parseFloat(fd.get("temp_max_c")) || 0,
				link: fd.get("link") || "",
				supplier_id: sid > 0 ? sid : null,
			};
		}

		function formatLogTime(iso) {
			if (!iso) {
				return "";
			}
			const d = new Date(iso);
			if (Number.isNaN(d.getTime())) {
				return String(iso);
			}
			return d.toLocaleString();
		}

		function formatLogUser(entry) {
			const user = entry.username || "";
			const email = entry.email || "";
			if (user && email) {
				return user + " / " + email;
			}
			return user || email || "—";
		}

		function logPanelEls(id) {
			const detail = list.querySelector('.inventory-log-detail[data-log-for="' + id + '"]');
			if (!detail) {
				return null;
			}
			return {
				detail,
				logList: detail.querySelector(".inventory-log-list"),
				moreBtn: detail.querySelector('[data-action="inventory-log-more"]'),
			};
		}

		function renderLogRows(logListEl, entries, append) {
			const rows = (entries || [])
				.map(
					(e) =>
						"<tr><td>" +
						esc(formatLogTime(e.created_at)) +
						"</td><td>" +
						esc(formatLogUser(e)) +
						"</td><td>" +
						esc(e.summary || "") +
						"</td></tr>"
				)
				.join("");
			if (append) {
				const tbody = logListEl.querySelector("tbody");
				if (tbody) {
					tbody.insertAdjacentHTML("beforeend", rows);
					return;
				}
			}
			if (!entries || !entries.length) {
				logListEl.innerHTML = "<p class=\"panel__empty\">" + esc(t("js.inventory.no_log")) + "</p>";
				return;
			}
			logListEl.innerHTML =
				'<table class="data-table data-table--nested"><thead><tr>' +
				"<th>Time</th><th>User</th><th>Change</th>" +
				"</tr></thead><tbody>" +
				rows +
				"</tbody></table>";
		}

		async function loadLogPage(id, reset) {
			const els = logPanelEls(id);
			if (!els || !els.logList) {
				return;
			}
			let offset = reset ? 0 : logOffsets.get(id) || 0;
			if (reset) {
				logOffsets.set(id, 0);
				els.logList.textContent = t("js.loading");
				if (els.moreBtn) {
					els.moreBtn.hidden = true;
				}
			}
			try {
				const data = await api(
					"/api/inventory/" + id + "/log?limit=" + logPageSize + "&offset=" + offset
				);
				const items = (data && data.items) || [];
				renderLogRows(els.logList, items, !reset && offset > 0);
				offset += items.length;
				logOffsets.set(id, offset);
				if (els.moreBtn) {
					els.moreBtn.hidden = !(data && data.has_more);
				}
			} catch (e) {
				els.logList.textContent = e.message;
				if (els.moreBtn) {
					els.moreBtn.hidden = true;
				}
			}
		}

		async function toggleLogRow(row) {
			const id = row.getAttribute("data-inventory-id");
			const els = logPanelEls(id);
			if (!els) {
				return;
			}
			const open = els.detail.hasAttribute("hidden");
			if (open) {
				els.detail.removeAttribute("hidden");
				row.setAttribute("aria-expanded", "true");
				await loadLogPage(id, true);
			} else {
				els.detail.setAttribute("hidden", "");
				row.setAttribute("aria-expanded", "false");
			}
		}

		async function refresh() {
			list.textContent = t("js.loading");
			logOffsets.clear();
			try {
				const items = await api("/api/inventory?category=" + encodeURIComponent(category));
				if (!items || !items.length) {
					list.innerHTML = "<p class=\"panel__empty\">" + esc(t("js.inventory.empty")) + "</p>";
					return;
				}
				const headers = isMalt
					? [
							t("js.inventory.col.name"),
							t("js.inventory.col.type"),
							t("js.inventory.col.producer"),
							t("js.inventory.col.supplier"),
							t("js.inventory.col.ebc"),
							t("js.inventory.col.qty"),
							t("js.inventory.col.cost"),
							t("js.inventory.col.effective_cost"),
							"",
							"",
					  ]
					: [
							t("js.inventory.col.name"),
							t("js.inventory.col.type"),
							t("js.inventory.col.producer"),
							t("js.inventory.col.supplier"),
							t("js.inventory.col.unit"),
							t("js.inventory.col.qty"),
							t("js.inventory.col.cost"),
							t("js.inventory.col.effective_cost"),
							"",
							"",
					  ];
				list.innerHTML = table(
					headers,
					items
						.map((i) => {
							const ebc =
								i.min_ebc || i.max_ebc
									? esc(String(i.min_ebc)) + "–" + esc(String(i.max_ebc))
									: "—";
							const linkCell = i.link
								? '<a href="' +
								  esc(i.link) +
								  '" target="_blank" rel="noopener noreferrer">' + esc(t("common.link")) + "</a>"
								: "";
							const orderBtn = canEdit
								? '<button type="button" class="btn btn--small" data-action="inventory-order" data-id="' +
								  i.id +
								  '" data-name="' +
								  esc(i.name) +
								  '">' + esc(t("js.inventory.add_to_order")) + "</button>"
								: "";
							const editBtn = canEdit
								? '<button type="button" class="btn btn--small" data-action="inventory-edit" data-id="' +
								  i.id +
								  '">' + esc(t("common.edit")) + "</button>"
								: "";
							const deleteBtn = canDelete
								? '<button type="button" class="btn btn--small" data-action="inventory-delete" data-id="' +
								  i.id +
								  '" data-name="' +
								  esc(i.name) +
								  '">' + esc(t("common.delete")) + "</button>"
								: "";
							const actions = [orderBtn, editBtn, deleteBtn].filter(Boolean).join(" ");
							const effective =
								i.effective_cost_price != null ? i.effective_cost_price : i.cost_price;
							const cells = isMalt
								? "<td>" +
								  esc(i.name) +
								  "</td><td>" +
								  esc(i.item_type || "") +
								  "</td><td>" +
								  esc(i.producer || "") +
								  "</td><td>" +
								  esc(i.supplier_name || "—") +
								  "</td><td>" +
								  ebc +
								  "</td><td>" +
								  i.qty +
								  "</td><td>" +
								  i.cost_price +
								  "</td><td>" +
								  effective +
								  "</td><td>" +
								  linkCell +
								  "</td><td>" +
								  actions +
								  "</td>"
								: "<td>" +
								  esc(i.name) +
								  "</td><td>" +
								  esc(i.item_type || "") +
								  "</td><td>" +
								  esc(i.producer || "") +
								  "</td><td>" +
								  esc(i.supplier_name || "—") +
								  "</td><td>" +
								  esc(i.unit) +
								  "</td><td>" +
								  i.qty +
								  "</td><td>" +
								  i.cost_price +
								  "</td><td>" +
								  effective +
								  "</td><td>" +
								  linkCell +
								  "</td><td>" +
								  actions +
								  "</td>";
							const main =
								'<tr class="inventory-row" data-inventory-id="' +
								i.id +
								'" aria-expanded="false">' +
								cells +
								"</tr>";
							const detail =
								'<tr class="inventory-log-detail" data-log-for="' +
								i.id +
								'" hidden><td colspan="' +
								colCount +
								'"><div class="inventory-log-panel"><div class="inventory-log-list"></div>' +
								'<button type="button" class="btn btn--small" data-action="inventory-log-more" data-id="' +
								i.id +
								'" hidden>' + esc(t("js.inventory.load_more")) + '</button></div></td></tr>';
							return main + detail;
						})
						.join("")
				);
			} catch (e) {
				list.textContent = e.message;
			}
		}

		panel.addEventListener("click", async (ev) => {
			const el = ev.target;
			if (!(el instanceof HTMLElement)) {
				return;
			}
			if (el.getAttribute("data-action") === "inventory-refresh") {
				refresh();
			}
			if (el.getAttribute("data-action") === "inventory-export") {
				try {
					await downloadCSVAuth(
						"/api/inventory/export?category=" + encodeURIComponent(category),
						category + "-inventory.csv"
					);
				} catch (e) {
					await appInfo({ title: noticeTitle(), message: e.message });
				}
				return;
			}
			if (el.getAttribute("data-action") === "inventory-import") {
				if (!canEdit) {
					return;
				}
				const input = panel.querySelector("#inventory-import-file");
				if (input) {
					input.value = "";
					input.click();
				}
				return;
			}
			if (el.getAttribute("data-action") === "inventory-new") {
				if (!canEdit) {
					return;
				}
				fillForm(null);
				dialog.showModal();
			}
			if (el.getAttribute("data-action") === "inventory-edit") {
				if (!canEdit) {
					return;
				}
				const id = parseInt(el.getAttribute("data-id"), 10);
				api("/api/inventory/" + id)
					.then((item) => {
						fillForm(item);
						dialog.showModal();
					})
					.catch((e) => { appInfo({ title: noticeTitle(), message: e.message }); });
			}
			if (el.getAttribute("data-action") === "inventory-delete") {
				if (!canDelete) {
					return;
				}
				const id = parseInt(el.getAttribute("data-id"), 10);
				const name = el.getAttribute("data-name") || "item";
				const ok = await appConfirm({
					title: t("js.inventory.delete_title"),
					message: t("js.inventory.delete_message", { name: name }),
				});
				if (!ok) {
					return;
				}
				try {
					await api("/api/inventory/" + id, { method: "DELETE" });
					refresh();
				} catch (e) {
					await appInfo({ title: noticeTitle(), message: e.message });
				}
				return;
			}
			if (el.getAttribute("data-action") === "inventory-log-more") {
				const id = parseInt(el.getAttribute("data-id"), 10);
				loadLogPage(id, false).catch((e) => { appInfo({ title: noticeTitle(), message: e.message }); });
				return;
			}
			const invRow = el.closest(".inventory-row");
			if (invRow && !el.closest("a, button, [data-action]")) {
				toggleLogRow(invRow).catch((e) => { appInfo({ title: noticeTitle(), message: e.message }); });
				return;
			}
			if (el.getAttribute("data-action") === "inventory-order") {
				if (!canEdit) {
					return;
				}
				const id = parseInt(el.getAttribute("data-id"), 10);
				const name = el.getAttribute("data-name") || "item";
				let planning = [];
				let breweries = [];
				try {
					const [orders, breweryList] = await Promise.all([
						api("/api/inventory/orders"),
						api("/api/breweries"),
					]);
					planning = (orders || []).filter((o) => o.status === "planning");
					breweries = breweryList || [];
				} catch (e) {
					await appInfo({ title: noticeTitle(), message: e.message });
					return;
				}
				const orderOptions = [{ value: "new", label: t("js.inventory.create_order") }].concat(
					planning.map((o) => {
						const lineCount = (o.lines || []).length;
						const notes = String(o.notes || "").trim();
						const noteBit = notes ? " — " + notes.slice(0, 40) : "";
						return {
							value: String(o.id),
							label: "#" + o.id + noteBit + " (" + t("js.orders.lines_count", { n: lineCount }) + ")",
						};
					})
				);
				const breweryOptions = [{ value: "", label: t("js.inventory.unassigned") }].concat(
					breweries.map((b) => ({
						value: String(b.id),
						label: b.name || t("js.inventory.brewery_n", { id: b.id }),
					}))
				);
				const defaultBrewery = breweries.length ? String(breweries[0].id) : "";
				const values = await appPrompt({
					title: t("js.inventory.add_to_order"),
					fields: [
						{
							name: "qty",
							label: t("js.inventory.qty_to_order", { name: name }),
							type: "number",
							step: "any",
							min: "0.01",
							value: "1",
						},
						{
							name: "brewery_id",
							label: t("js.inventory.brewery"),
							type: "select",
							options: breweryOptions,
							value: defaultBrewery,
						},
						{
							name: "order_id",
							label: t("js.inventory.order"),
							type: "select",
							options: orderOptions,
							value: planning.length ? String(planning[0].id) : "new",
						},
						{
							name: "notes",
							label: t("js.inventory.notes_new"),
							type: "text",
							required: false,
						},
					],
				});
				if (!values) {
					return;
				}
				const qty = parseFloat(values.qty);
				if (!(qty > 0)) {
					await appInfo({ title: noticeTitle(), message: t("js.inventory.qty_positive") });
					return;
				}
				const breweryRaw = String(values.brewery_id || "").trim();
				const breweryID = breweryRaw ? parseInt(breweryRaw, 10) : null;
				const line = { inventory_item_id: id, qty };
				if (breweryID) {
					line.brewery_id = breweryID;
				}
				try {
					let order;
					if (values.order_id === "new") {
						order = await api("/api/inventory/orders", {
							method: "POST",
							body: JSON.stringify({
								notes: String(values.notes || "").trim(),
								lines: [line],
							}),
						});
					} else {
						order = await api("/api/inventory/orders/" + values.order_id + "/lines", {
							method: "POST",
							body: JSON.stringify(line),
						});
					}
					await appInfo({ title: noticeTitle(), message: t("js.inventory.added_to_order", { id: order.id }) });
					if (values.order_id === "new") {
						refreshOrdersNavCount();
					}
				} catch (e) {
					await appInfo({ title: noticeTitle(), message: e.message });
				}
			}
		});

		const importFile = panel.querySelector("#inventory-import-file");
		if (importFile) {
			importFile.addEventListener("change", async () => {
				const file = importFile.files && importFile.files[0];
				if (!file) {
					return;
				}
				try {
					const result = await importCSVAuth(
						"/api/inventory/import?category=" + encodeURIComponent(category),
						file
					);
					await appInfo({
						title: t("js.inventory.import_result"),
						message: formatImportResult(result || {}),
					});
					refresh();
				} catch (e) {
					await appInfo({ title: noticeTitle(), message: e.message });
				}
				importFile.value = "";
			});
		}

		dialog.addEventListener("close", async () => {
			if (dialog.returnValue !== "save") {
				return;
			}
			const idVal = form.elements.namedItem("id").value;
			const body = bodyFromForm();
			try {
				if (idVal) {
					await api("/api/inventory/" + idVal, {
						method: "PUT",
						body: JSON.stringify(body),
					});
				} else {
					await api("/api/inventory", {
						method: "POST",
						body: JSON.stringify(body),
					});
				}
				form.reset();
				refresh();
			} catch (e) {
				await appInfo({ title: noticeTitle(), message: e.message });
			}
		});
		form.addEventListener("input", updateEffectiveHint);
		form.addEventListener("change", updateEffectiveHint);
		await loadSuppliers();
		refresh();
	}

	window.BrewhousePanels = window.BrewhousePanels || {};
	window.BrewhousePanels["inventory"] = loadInventory;
})();
