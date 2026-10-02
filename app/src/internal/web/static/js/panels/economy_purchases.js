(() => {
	const {
		api,
		esc,
		statusPill,
		fmtMoney,
		fmtMoneyAmount,
		t,
		currencyCode,
		statusText,
		categoryText,
		datePart,
		appInfo,
		canViewEconomy,
		showForbidden,
	} = window.BrewhouseCore;

	async function loadEconomyPurchases(panel) {
		if (!canViewEconomy()) {
			showForbidden(panel);
			return;
		}
		const list = panel.querySelector("#economy-purchases-list");
		const monthInput = panel.querySelector("#economy-purchases-month");
		const sumCost = panel.querySelector("#economy-purchases-sum-cost");
		const sumVAT = panel.querySelector("#economy-purchases-sum-vat");
		let rows = [];
		let report = null;

		const columnHelp = {
			date: {
				title: t("js.economy.purchases.col.date"),
				message: t("js.economy.purchases.help.date"),
			},
			order: {
				title: t("js.economy.purchases.col.order"),
				message: t("js.economy.purchases.help.order"),
			},
			item: {
				title: t("js.economy.purchases.col.item"),
				message: t("js.economy.purchases.help.item"),
			},
			category: {
				title: t("js.economy.purchases.col.category"),
				message: t("js.economy.purchases.help.category"),
			},
			qty: {
				title: t("js.economy.purchases.col.qty"),
				message: t("js.economy.purchases.help.qty"),
			},
			unit_cost: {
				title: t("js.economy.purchases.col.unit_cost"),
				message: t("js.economy.purchases.help.unit_cost"),
			},
			line_cost: {
				title: t("js.economy.purchases.col.line_cost"),
				message: t("js.economy.purchases.help.line_cost"),
			},
			vat_rate: {
				title: t("js.economy.purchases.col.vat_rate"),
				message: t("js.economy.purchases.help.vat_rate"),
			},
			vat: {
				title: t("js.economy.purchases.col.vat"),
				message: t("js.economy.purchases.help.vat"),
			},
			status: {
				title: t("js.economy.purchases.col.status"),
				message: t("js.economy.purchases.help.status"),
			},
		};

		const helpHeaders = [
			{ key: "date", label: t("js.economy.purchases.col.date") },
			{ key: "order", label: t("js.economy.purchases.col.order") },
			{ key: "item", label: t("js.economy.purchases.col.item") },
			{ key: "category", label: t("js.economy.purchases.col.category") },
			{ key: "qty", label: t("js.economy.purchases.col.qty") },
			{ key: "unit_cost", label: t("js.economy.purchases.col.unit_cost") },
			{ key: "line_cost", label: t("js.economy.purchases.col.line_cost") },
			{ key: "vat_rate", label: t("js.economy.purchases.col.vat_rate") },
			{ key: "vat", label: t("js.economy.purchases.col.vat") },
			{ key: "status", label: t("js.economy.purchases.col.status") },
		];

		function helpTable(rowsHtml) {
			return (
				'<div class="table-scroll"><table class="data-table"><thead><tr>' +
				helpHeaders
					.map(
						(h) =>
							'<th class="data-table__th--help" tabindex="0" data-col-help="' +
							esc(h.key) +
							'">' +
							esc(h.label) +
							"</th>"
					)
					.join("") +
				"</tr></thead><tbody>" +
				rowsHtml +
				"</tbody></table></div>"
			);
		}

		function currentMonthValue() {
			const d = new Date();
			const y = d.getFullYear();
			const m = String(d.getMonth() + 1).padStart(2, "0");
			return y + "-" + m;
		}

		function effectiveQty(line) {
			if (line.ordered_qty != null) {
				return Number(line.ordered_qty);
			}
			return Number(line.qty) || 0;
		}

		function setSummary(data) {
			if (!data) {
				sumCost.textContent = "—";
				sumVAT.textContent = "—";
				return;
			}
			const cur = currencyCode();
			sumCost.textContent = fmtMoney(data.cost_total || 0, cur);
			sumVAT.textContent = fmtMoney(data.vat_total || 0, cur);
		}

		function csvEscape(v) {
			const s = v == null ? "" : String(v);
			if (/[",\n\r]/.test(s)) {
				return '"' + s.replace(/"/g, '""') + '"';
			}
			return s;
		}

		function downloadCSV() {
			const month = monthInput.value || currentMonthValue();
			const header = [
				t("js.economy.purchases.col.date"),
				t("js.economy.purchases.col.order"),
				t("js.economy.purchases.col.item"),
				t("js.economy.purchases.col.category"),
				t("js.economy.purchases.col.qty"),
				t("js.economy.purchases.col.unit_cost"),
				t("js.economy.purchases.col.line_cost"),
				t("js.economy.purchases.col.vat_rate"),
				t("js.economy.purchases.col.vat"),
				t("js.economy.purchases.col.status"),
				t("js.economy.purchases.col.brewery"),
				t("js.economy.col.currency"),
			];
			const lines = [header.join(",")];
			const cur = currencyCode();
			rows.forEach((r) => {
				lines.push(
					[
						datePart(r.ordered_at),
						r.order_id,
						r.item_name,
						r.category || "",
						effectiveQty(r),
						r.cost_price != null ? Number(r.cost_price).toFixed(2) : "",
						r.line_cost != null ? Number(r.line_cost).toFixed(2) : "",
						r.vat_rate != null ? Number(r.vat_rate).toFixed(2) : "",
						r.vat_amount != null ? Number(r.vat_amount).toFixed(2) : "",
						r.status || "",
						r.brewery_name || "",
						cur,
					]
						.map(csvEscape)
						.join(",")
				);
			});
			const blob = new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = "purchase-costs-" + month + ".csv";
			document.body.appendChild(a);
			a.click();
			a.remove();
			URL.revokeObjectURL(url);
		}

		async function refresh() {
			const month = monthInput.value || currentMonthValue();
			monthInput.value = month;
			list.textContent = t("js.loading");
			setSummary(null);
			rows = [];
			report = null;
			try {
				report = await api(
					"/api/settings/purchase-costs?month=" + encodeURIComponent(month)
				);
				rows = (report && report.lines) || [];
				setSummary(report);
				if (!rows.length) {
					list.innerHTML =
						'<p class="panel__empty">' +
						esc(t("js.economy.purchases.no_rows", { month: month })) +
						"</p>";
					return;
				}
				const cur = currencyCode();
				list.innerHTML = helpTable(
					rows
						.map((r) => {
							const qty = effectiveQty(r);
							const qtyLabel =
								fmtMoneyAmount(qty) + (r.unit ? " " + esc(r.unit) : "");
							return (
								"<tr><td>" +
								esc(datePart(r.ordered_at)) +
								"</td><td>" +
								r.order_id +
								"</td><td>" +
								esc(r.item_name || "") +
								"</td><td>" +
								esc(categoryText(r.category) || r.category || "") +
								"</td><td>" +
								qtyLabel +
								"</td><td>" +
								fmtMoney(r.cost_price, cur) +
								"</td><td>" +
								fmtMoney(r.line_cost, cur) +
								"</td><td>" +
								fmtMoneyAmount(r.vat_rate) +
								"%</td><td>" +
								fmtMoney(r.vat_amount, cur) +
								"</td><td>" +
								statusPill(r.status, statusText(r.status)) +
								"</td></tr>"
							);
						})
						.join("")
				);
			} catch (e) {
				list.textContent = e.message;
			}
		}

		if (!monthInput.value) {
			monthInput.value = currentMonthValue();
		}
		panel
			.querySelector('[data-action="economy-purchases-refresh"]')
			.addEventListener("click", refresh);
		panel
			.querySelector('[data-action="economy-purchases-csv"]')
			.addEventListener("click", downloadCSV);
		monthInput.addEventListener("change", refresh);
		list.addEventListener("click", (ev) => {
			const th = ev.target.closest("[data-col-help]");
			if (!th || !list.contains(th)) {
				return;
			}
			const key = th.getAttribute("data-col-help");
			const help = columnHelp[key];
			if (!help) {
				return;
			}
			appInfo(help);
		});
		list.addEventListener("keydown", (ev) => {
			if (ev.key !== "Enter" && ev.key !== " ") {
				return;
			}
			const th = ev.target.closest("[data-col-help]");
			if (!th || !list.contains(th)) {
				return;
			}
			ev.preventDefault();
			const key = th.getAttribute("data-col-help");
			const help = columnHelp[key];
			if (help) {
				appInfo(help);
			}
		});
		refresh();
	}

	window.BrewhousePanels = window.BrewhousePanels || {};
	window.BrewhousePanels["economy-purchases"] = loadEconomyPurchases;
})();
