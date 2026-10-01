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

	async function loadSchedule(panel) {
		const list = panel.querySelector("#schedule-list");
		const form = panel.querySelector("#schedule-form");
		const errEl = panel.querySelector("#schedule-error");
		const tankSel = form.querySelector('[name="tank_id"]');
		const recipeSel = panel.querySelector("#schedule-recipe");
		const weekEl = panel.querySelector("#schedule-week");
		const weekLabel = panel.querySelector("#schedule-week-label");
		const ganttEl = panel.querySelector("#schedule-gantt");
		let weekStart = startOfWeek(new Date());
		let tanksCache = [];
		let bookingsCache = [];

		function startOfWeek(d) {
			const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
			const day = (x.getDay() + 6) % 7;
			x.setDate(x.getDate() - day);
			return x;
		}
		function ymd(d) {
			return (
				d.getFullYear() +
				"-" +
				String(d.getMonth() + 1).padStart(2, "0") +
				"-" +
				String(d.getDate()).padStart(2, "0")
			);
		}
		function addDays(d, n) {
			const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
			x.setDate(x.getDate() + n);
			return x;
		}
		function parseYMD(s) {
			const p = String(s || "").split("-");
			return new Date(+p[0], +p[1] - 1, +p[2]);
		}

		async function confirmUnbook(recipeId) {
			const ok = await appConfirm({
				title: t("js.schedule.remove_title"),
				message: t("js.schedule.remove_message"),
			});
			if (!ok) {
				return;
			}
			try {
				await api("/api/recipes/" + recipeId + "/schedule", { method: "DELETE" });
				refresh();
			} catch (e) {
				await appInfo({ title: noticeTitle(), message: e.message });
			}
		}

		function renderWeek() {
			if (!weekEl || !weekLabel) {
				return;
			}
			const end = addDays(weekStart, 6);
			weekLabel.textContent = ymd(weekStart) + " – " + ymd(end);
			const byDate = {};
			(bookingsCache || []).forEach((b) => {
				const key = b.date;
				if (!byDate[key]) {
					byDate[key] = [];
				}
				byDate[key].push(b);
			});
			let html = "";
			for (let i = 0; i < 7; i++) {
				const day = addDays(weekStart, i);
				const key = ymd(day);
				const items = (byDate[key] || [])
					.map(
						(b) =>
							'<button type="button" class="schedule-day__item" data-action="schedule-unbook" data-recipe-id="' +
							b.recipe_id +
							'">' +
							esc(b.name || "") +
							(b.tank_name ? " · " + esc(b.tank_name) : "") +
							"</button>"
					)
					.join("");
				html +=
					'<div class="schedule-day"><span class="schedule-day__date">' +
					esc(key) +
					"</span>" +
					(items || '<span class="panel__empty">—</span>') +
					"</div>";
			}
			weekEl.innerHTML = html;
		}

		function renderGantt() {
			if (!ganttEl) {
				return;
			}
			const from = weekStart;
			const days = 14;
			const dayKeys = [];
			for (let i = 0; i < days; i++) {
				dayKeys.push(ymd(addDays(from, i)));
			}
			const tanks = tanksCache || [];
			if (!tanks.length) {
				ganttEl.innerHTML = "<p class=\"panel__empty\">" + esc(t("js.schedule.no_tanks")) + "</p>";
				return;
			}
			let html =
				'<div class="schedule-gantt" style="grid-template-columns: 7rem repeat(' +
				days +
				', minmax(2.2rem, 1fr));">';
			html +=
				'<div class="schedule-gantt__cell schedule-gantt__label schedule-gantt__head">' +
				esc(t("schedule.tank")) +
				"</div>";
			dayKeys.forEach((k) => {
				html +=
					'<div class="schedule-gantt__cell schedule-gantt__head">' + esc(k.slice(5)) + "</div>";
			});
			tanks.forEach((tank) => {
				html +=
					'<div class="schedule-gantt__cell schedule-gantt__label">' + esc(tank.name) + "</div>";
				const rowBookings = (bookingsCache || []).filter(
					(b) => Number(b.tank_id) === Number(tank.id) || (!b.tank_id && b.tank_name === tank.name)
				);
				for (let i = 0; i < days; i++) {
					html += '<div class="schedule-gantt__cell">';
					rowBookings.forEach((b) => {
						const start = parseYMD(b.date);
						const end = parseYMD(b.end_date || b.date);
						const cell = addDays(from, i);
						if (cell < start || cell > end) {
							return;
						}
						if (ymd(cell) !== ymd(start) && i !== 0) {
							return;
						}
						let span = 0;
						for (let j = i; j < days; j++) {
							const c = addDays(from, j);
							if (c > end) {
								break;
							}
							span++;
						}
						if (span < 1) {
							return;
						}
						html +=
							'<button type="button" class="schedule-gantt__bar" style="width: calc(' +
							span +
							" * 100% + " +
							(span - 1) +
							' * 1px);" data-action="schedule-unbook" data-recipe-id="' +
							b.recipe_id +
							'">' +
							esc(b.name || "") +
							"</button>";
					});
					html += "</div>";
				}
			});
			html += "</div>";
			ganttEl.innerHTML = html;
		}

		async function refresh() {
			list.textContent = t("js.loading");
			try {
				const from = ymd(addDays(weekStart, -7));
				const to = ymd(addDays(weekStart, 21));
				const [tanks, recipes, bookings] = await Promise.all([
					api("/api/settings/tanks?active=1"),
					api("/api/recipes"),
					api("/api/schedule?from=" + encodeURIComponent(from) + "&to=" + encodeURIComponent(to)),
				]);
				tanksCache = tanks || [];
				bookingsCache = bookings || [];
				tankSel.innerHTML = tanksCache
					.map((tk) => '<option value="' + tk.id + '">' + esc(tk.name) + "</option>")
					.join("");
				const bookable = (recipes || []).filter(
					(r) => r.status === "created" || r.status === "scheduled"
				);
				fillRecipeSelect(recipeSel, bookable, t("js.schedule.no_bookable"));
				renderWeek();
				renderGantt();
				if (!bookingsCache.length) {
					list.innerHTML = "<p class=\"panel__empty\">" + esc(t("js.schedule.empty")) + "</p>";
					refreshBrewingNavCounts();
					return;
				}
				list.innerHTML = table(
					[
						t("js.schedule.col.date"),
						t("js.schedule.col.end_date"),
						t("js.schedule.col.brewery"),
						t("js.schedule.col.recipe"),
						t("js.schedule.col.tank"),
						t("js.schedule.col.actions"),
					],
					bookingsCache
						.map((b) => {
							let actions = "";
							if (b.status === "scheduled" && b.recipe_id) {
								actions =
									'<button type="button" class="btn btn--small" data-action="schedule-unbook" data-recipe-id="' +
									b.recipe_id +
									'">' +
									esc(t("common.remove")) +
									"</button>";
							}
							return (
								"<tr><td>" +
								esc(b.date) +
								"</td><td>" +
								esc(b.end_date || b.date || "") +
								"</td><td>" +
								esc(b.brewery_name || "") +
								"</td><td>" +
								esc(b.name || "") +
								"</td><td>" +
								esc(b.tank_name || "") +
								"</td><td>" +
								actions +
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

		panel.querySelector('[data-action="schedule-refresh"]').addEventListener("click", refresh);
		panel.querySelector('[data-action="schedule-week-prev"]').addEventListener("click", () => {
			weekStart = addDays(weekStart, -7);
			refresh();
		});
		panel.querySelector('[data-action="schedule-week-next"]').addEventListener("click", () => {
			weekStart = addDays(weekStart, 7);
			refresh();
		});
		panel.querySelector('[data-action="schedule-week-today"]').addEventListener("click", () => {
			weekStart = startOfWeek(new Date());
			refresh();
		});
		panel.addEventListener("click", async (ev) => {
			const el = ev.target;
			if (!(el instanceof HTMLElement)) {
				return;
			}
			const btn = el.closest('[data-action="schedule-unbook"]');
			if (!btn) {
				return;
			}
			const recipeId = btn.getAttribute("data-recipe-id");
			if (!recipeId) {
				return;
			}
			await confirmUnbook(recipeId);
		});
		form.addEventListener("submit", async (ev) => {
			ev.preventDefault();
			errEl.hidden = true;
			const fd = new FormData(form);
			const recipeId = fd.get("recipe_id");
			try {
				await api("/api/recipes/" + recipeId + "/schedule", {
					method: "POST",
					body: JSON.stringify({
						date: fd.get("date"),
						tank_id: parseInt(fd.get("tank_id"), 10),
						tank_days: parseInt(fd.get("tank_days"), 10) || 14,
					}),
				});
				refresh();
				await appInfo(pipelineGuide("scheduled"));
			} catch (e) {
				errEl.hidden = false;
				errEl.textContent = e.message;
			}
		});
		refresh();
	}

	window.BrewhousePanels = window.BrewhousePanels || {};
	window.BrewhousePanels["schedule"] = loadSchedule;
})();
