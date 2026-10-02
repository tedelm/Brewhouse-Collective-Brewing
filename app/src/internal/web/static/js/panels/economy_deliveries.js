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

	async function loadEconomyDeliveries(panel) {
		const list = panel.querySelector("#economy-deliveries-list");
		const monthInput = panel.querySelector("#economy-deliveries-month");
		const sumVol = panel.querySelector("#economy-deliveries-sum-vol");
		const sumCost = panel.querySelector("#economy-deliveries-sum-cost");
		const sumTax = panel.querySelector("#economy-deliveries-sum-tax");
		const sumNet = panel.querySelector("#economy-deliveries-sum-net");
		const sumProfit = panel.querySelector("#economy-deliveries-sum-profit");
		let rows = [];

		const columnHelp = {
			delivered: {
				title: t("js.economy.col.delivered"),
				message: t("js.economy.help.delivered"),
			},
			id: {
				title: t("js.economy.col.id"),
				message: t("js.economy.help.id"),
			},
			name: {
				title: t("js.economy.col.name"),
				message: t("js.economy.help.name"),
			},
			brewery: {
				title: t("js.economy.col.brewery"),
				message: t("js.economy.help.brewery"),
			},
			abv: {
				title: t("js.economy.col.abv"),
				message: t("js.economy.help.abv"),
			},
			volume: {
				title: t("js.economy.col.volume"),
				message: t("js.economy.help.volume"),
			},
			cost: {
				title: t("js.economy.col.cost"),
				message: t("js.economy.help.cost"),
			},
			tax: {
				title: t("js.economy.col.tax"),
				message: t("js.economy.help.tax"),
			},
			net: {
				title: t("js.economy.col.net"),
				message: t("js.economy.help.net"),
			},
			profit: {
				title: t("js.economy.col.profit"),
				message: t("js.economy.help.profit"),
			},
			"net-per-l": {
				title: t("js.economy.net_per_l", { currency: currencyCode() }),
				message: t("js.economy.net_per_l_help"),
			},
		};

		const helpHeaders = [
			{ key: "delivered", label: t("js.economy.col.delivered") },
			{ key: "id", label: t("js.economy.col.id") },
			{ key: "name", label: t("js.economy.col.name") },
			{ key: "brewery", label: t("js.economy.col.brewery") },
			{ key: "abv", label: t("js.economy.col.abv") },
			{ key: "volume", label: t("js.economy.col.volume") },
			{ key: "cost", label: t("js.economy.col.cost") },
			{ key: "tax", label: t("js.economy.col.tax") },
			{ key: "net", label: t("js.economy.col.net") },
			{ key: "profit", label: t("js.economy.col.profit") },
			{ key: "net-per-l", label: t("js.economy.net_per_l", { currency: currencyCode() }) },
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

		function recipeCurrency(r) {
			return (r && r.currency_code) || "SEK";
		}

		function netPerLiter(r) {
			const vol = Number(r.delivery_volume);
			const net = Number(r.net);
			if (!vol || Number.isNaN(vol) || vol <= 0 || Number.isNaN(net)) {
				return "";
			}
			return fmtMoney(net / vol, recipeCurrency(r));
		}

		function formatMoneyByCurrency(byCurrency, field) {
			const codes = Object.keys(byCurrency).sort();
			if (!codes.length) {
				return "—";
			}
			return codes
				.map((code) => fmtMoney(byCurrency[code][field] || 0, code))
				.join(" · ");
		}

		function setSummary(totalsByCurrency) {
			if (!totalsByCurrency) {
				sumVol.textContent = "—";
				sumCost.textContent = "—";
				sumNet.textContent = "—";
				sumTax.textContent = "—";
				sumProfit.textContent = "—";
				return;
			}
			let volume = 0;
			Object.keys(totalsByCurrency).forEach((code) => {
				volume += totalsByCurrency[code].volume || 0;
			});
			sumVol.textContent = fmtMoneyAmount(volume) + " L";
			sumCost.textContent = formatMoneyByCurrency(totalsByCurrency, "cost");
			sumTax.textContent = formatMoneyByCurrency(totalsByCurrency, "tax");
			sumNet.textContent = formatMoneyByCurrency(totalsByCurrency, "net");
			sumProfit.textContent = formatMoneyByCurrency(totalsByCurrency, "profit");
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
				t("js.economy.col.delivered"),
				t("js.economy.col.id"),
				t("js.economy.col.name"),
				t("js.economy.col.brewery"),
				t("js.economy.col.abv") + " %",
				t("js.economy.col.volume"),
				t("js.economy.col.cost"),
				t("js.economy.col.tax"),
				t("js.economy.col.net"),
				t("js.economy.col.profit"),
				t("js.economy.col.currency"),
				t("js.economy.net_per_l", { currency: currencyCode() }),
			];
			const lines = [header.join(",")];
			rows.forEach((r) => {
				const abv =
					r.og != null && r.fg != null
						? ((r.og - r.fg) * 131.25).toFixed(1)
						: "";
				const cost = r.cost != null ? Number(r.cost) : NaN;
				const net = r.net != null ? Number(r.net) : NaN;
				const profit =
					!Number.isNaN(cost) && !Number.isNaN(net) ? (net - cost).toFixed(2) : "";
				const cur = recipeCurrency(r);
				lines.push(
					[
						datePart(r.delivered_at),
						r.id,
						r.name,
						r.brewery_name || "",
						abv,
						r.delivery_volume != null ? r.delivery_volume : "",
						r.cost != null ? Number(r.cost).toFixed(2) : "",
						r.tax != null ? Number(r.tax).toFixed(2) : "",
						r.net != null ? Number(r.net).toFixed(2) : "",
						profit,
						cur,
						netPerLiter(r),
					]
						.map(csvEscape)
						.join(",")
				);
			});
			const blob = new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = "deliveries-" + month + ".csv";
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
			try {
				let url = "/api/recipes/delivered?month=" + encodeURIComponent(month);
				const brewerySel = panel.querySelector("#economy-deliveries-brewery");
				if (brewerySel && brewerySel.value) {
					url += "&brewery_id=" + encodeURIComponent(brewerySel.value);
				}
				rows = (await api(url)) || [];
				if (brewerySel && canRoles("admin") && !brewerySel.dataset.loaded) {
					const breweries = await api("/api/breweries");
					brewerySel.innerHTML =
						'<option value="">' +
						esc(t("js.economy.all_breweries")) +
						"</option>" +
						(breweries || [])
							.map((b) => '<option value="' + b.id + '">' + esc(b.name) + "</option>")
							.join("");
					brewerySel.dataset.loaded = "1";
					brewerySel.hidden = false;
				}
				const totalsByCurrency = {};
				rows.forEach((r) => {
					const cur = recipeCurrency(r);
					if (!totalsByCurrency[cur]) {
						totalsByCurrency[cur] = { volume: 0, cost: 0, tax: 0, net: 0, profit: 0 };
					}
					const cost = Number(r.cost) || 0;
					const net = Number(r.net) || 0;
					totalsByCurrency[cur].volume += Number(r.delivery_volume) || 0;
					totalsByCurrency[cur].cost += cost;
					totalsByCurrency[cur].tax += Number(r.tax) || 0;
					totalsByCurrency[cur].net += net;
					totalsByCurrency[cur].profit += net - cost;
				});
				setSummary(totalsByCurrency);
				if (!rows.length) {
					list.innerHTML =
						'<p class="panel__empty">' + esc(t("js.economy.no_deliveries", { month: month })) + "</p>";
					return;
				}
				list.innerHTML = helpTable(
					rows
						.map((r) => {
							const cost = Number(r.cost) || 0;
							const net = Number(r.net) || 0;
							const cur = recipeCurrency(r);
							return (
								"<tr><td>" +
								esc(datePart(r.delivered_at)) +
								"</td><td>" +
								r.id +
								"</td><td>" +
								esc(r.name) +
								"</td><td>" +
								esc(r.brewery_name || "") +
								"</td><td>" +
								esc(recipeABV(r)) +
								"</td><td>" +
								fmtMoneyAmount(r.delivery_volume) +
								"</td><td>" +
								fmtMoney(r.cost, cur) +
								"</td><td>" +
								fmtMoney(r.tax, cur) +
								"</td><td>" +
								fmtMoney(r.net, cur) +
								"</td><td>" +
								fmtMoney(net - cost, cur) +
								"</td><td>" +
								esc(netPerLiter(r)) +
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
			.querySelector('[data-action="economy-deliveries-refresh"]')
			.addEventListener("click", refresh);
		panel
			.querySelector('[data-action="economy-deliveries-csv"]')
			.addEventListener("click", downloadCSV);
		monthInput.addEventListener("change", refresh);
		const brewerySelInit = panel.querySelector("#economy-deliveries-brewery");
		if (brewerySelInit) {
			brewerySelInit.addEventListener("change", refresh);
		}
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
	window.BrewhousePanels["economy-deliveries"] = loadEconomyDeliveries;
})();
